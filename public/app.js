const $=(s)=>document.querySelector(s);
const STORE='ai-foundry-threads-v1';
const GATEWAY='https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/ai-foundry-runtime';
let threads=loadThreads();
let activeId=threads[0]?.id||null;
let busy=false;

function loadThreads(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return[]}}
function saveThreads(){localStorage.setItem(STORE,JSON.stringify(threads))}
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function active(){return threads.find(t=>t.id===activeId)}
function stamp(){return new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function formatText(text){return String(text).split(/```/).map((p,i)=>i%2?`<pre>${escapeHtml(p.replace(/^\w+\n/,''))}</pre>`:escapeHtml(p)).join('')}
function newThread(){const t={id:uid(),title:'New AI Development',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};threads.unshift(t);activeId=t.id;saveThreads();renderAll();return t}
function log(line,type='ok'){const el=$('#terminal');const tag=type==='err'?'ERR':type==='warn'?'WRN':'RUN';el.textContent+=`[${stamp()}] ${tag}  ${line}\n`;el.scrollTop=el.scrollHeight}
function state(sel,value,pass=false){const el=$(sel);el.textContent=value;el.style.color=pass?'#65ff9b':''}

async function postJson(url,payload,credentials='same-origin'){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials,redirect:'follow'});
  const ct=r.headers.get('content-type')||'';
  if(!ct.includes('application/json'))throw new Error(`non-json runtime response (${r.status})`);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
async function direct(action,payload){return postJson('/api/foundry',{action,...payload})}
async function gateway(action,payload){return postJson(GATEWAY,{action,...payload},'omit')}
async function call(action,payload){
  try{
    const r=await direct(action,payload);
    return {...r,route:'GPT-5.6 SOL / VERCEL'};
  }catch(primaryError){
    log(`primary runtime protected/unavailable -> Supabase gateway (${primaryError.message})`,'warn');
    const r=await gateway(action,payload);
    return {...r,route:r.route||'AI FOUNDRY DEEP / SUPABASE'};
  }
}

function renderThreads(){
  const el=$('#threadList');el.innerHTML='';
  threads.forEach(t=>{
    const row=document.createElement('div');row.className=`thread ${t.id===activeId?'active':''}`;
    row.innerHTML=`<div><div class="thread-title">${escapeHtml(t.title)}</div><div class="thread-time">${new Date(t.updatedAt).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</div></div><button class="thread-delete">×</button>`;
    row.addEventListener('click',e=>{if(e.target.classList.contains('thread-delete'))return;activeId=t.id;renderAll()});
    row.querySelector('.thread-delete').addEventListener('click',e=>{e.stopPropagation();threads=threads.filter(x=>x.id!==t.id);if(activeId===t.id)activeId=threads[0]?.id||null;saveThreads();renderAll()});
    el.appendChild(row);
  });
}
function renderMessages(){
  const t=active();$('#threadTitle').textContent=t?.title||'New AI Development';const box=$('#messages');
  if(!t||!t.messages.length){box.innerHTML='<div class="welcome"><h3>AI FOUNDRY CORE</h3><p>AI開発専用の3ペインIDE。中央で設計・実装・評価・デバッグを会話し、右の <code>RUN BUILD PIPELINE</code> で AI仕様生成 → Smoke Test → 実行URL発行まで進めます。</p></div>';return}
  box.innerHTML=t.messages.map(m=>`<article class="message ${m.role} ${m.error?'error':''}"><div class="role">${m.role==='user'?'YOU':'FOUNDRY'}</div><div class="content">${formatText(m.content)}</div></article>`).join('');
  box.scrollTop=box.scrollHeight;
}
function renderAll(){renderThreads();renderMessages()}
function resizeComposer(){const c=$('#composer');c.style.height='auto';c.style.height=Math.min(c.scrollHeight,190)+'px'}

async function titleThread(t,first){
  if(t.messages.filter(m=>m.role==='user').length!==1)return;
  try{const r=await call('title',{text:first});t.title=r.title||t.title;t.updatedAt=Date.now();saveThreads();renderThreads();$('#threadTitle').textContent=t.title}catch(e){log(`title generation failed: ${e.message}`,'warn')}
}
async function send(){
  if(busy)return;const c=$('#composer');const text=c.value.trim();if(!text)return;
  const t=active()||newThread();t.messages.push({role:'user',content:text});t.updatedAt=Date.now();saveThreads();c.value='';resizeComposer();renderAll();busy=true;$('#sendBtn').disabled=true;log('chat dispatch');titleThread(t,text);
  try{const r=await call('chat',{messages:t.messages});t.messages.push({role:'assistant',content:r.text});t.updatedAt=Date.now();saveThreads();renderAll();log(`chat complete · ${r.route||r.model||'runtime'}`)}
  catch(e){t.messages.push({role:'assistant',content:`RUNTIME ERROR: ${e.message}`,error:true});saveThreads();renderAll();log(e.message,'err')}
  finally{busy=false;$('#sendBtn').disabled=false;c.focus()}
}

function encodeSpec(spec){const bytes=new TextEncoder().encode(JSON.stringify(spec));let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function showArtifact(spec,url){$('#artifact').classList.remove('hidden');$('#artifactName').textContent=spec.name;$('#artifactDescription').textContent=spec.description;$('#artifactCaps').innerHTML=(spec.capabilities||[]).slice(0,8).map(x=>`<span class="cap">${escapeHtml(x)}</span>`).join('');$('#artifactUrl').href=url;$('#copyUrl').dataset.url=url}
async function pipeline(){
  if(busy)return;const t=active();if(!t||!t.messages.some(m=>m.role==='user')){log('build aborted: no development conversation','warn');return}
  busy=true;$('#runPipeline').disabled=true;$('#artifact').classList.add('hidden');state('#buildState','RUNNING');state('#testState','WAIT');state('#publishState','WAIT');log('FRAME -> compile development conversation');
  try{
    const built=await call('build',{messages:t.messages});state('#buildState','PASS',true);log(`BUILD PASS · ${built.spec.name} · ${built.route||built.model||'runtime'}`);
    state('#testState','RUNNING');const smoke=await call('smoke',{spec:built.spec});if(!smoke.pass)throw new Error('smoke test returned fail');state('#testState','PASS',true);log(`TEST PASS · ${(smoke.output||'').slice(0,180).replace(/\n/g,' ')}`);
    state('#publishState','RUNNING');const url=`${location.origin}/agent#agent=${encodeSpec(built.spec)}`;showArtifact(built.spec,url);state('#publishState','READY',true);log('PUBLISH PASS · generated AI URL issued');log(`URL ${url}`);
  }catch(e){log(`pipeline failed: ${e.message}`,'err');if($('#buildState').textContent==='RUNNING')state('#buildState','FAIL');else if($('#testState').textContent==='RUNNING')state('#testState','FAIL');else state('#publishState','FAIL')}
  finally{busy=false;$('#runPipeline').disabled=false}
}

$('#newThread').addEventListener('click',newThread);$('#sendBtn').addEventListener('click',send);$('#composer').addEventListener('input',resizeComposer);$('#composer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});$('#runPipeline').addEventListener('click',pipeline);$('#clearLog').addEventListener('click',()=>{$('#terminal').textContent=''});$('#copyUrl').addEventListener('click',async e=>{const url=e.currentTarget.dataset.url;if(url){await navigator.clipboard.writeText(url);log('URL copied')}});setInterval(()=>{$('#clock').textContent=stamp()},1000);
if(!activeId)newThread();else renderAll();
log('AI FOUNDRY IDE boot');log('primary: GPT-5.6 Sol / Vercel');log('fallback: AI FOUNDRY DEEP / Supabase gateway');
