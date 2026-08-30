const $=(s)=>document.querySelector(s);
const STORE='ai-foundry-threads-v1';
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
function parseJson(text){const clean=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a<0||b<=a)throw new Error('build output did not contain JSON');return JSON.parse(clean.slice(a,b+1))}
function validSpec(x){return x&&typeof x==='object'&&typeof x.name==='string'&&typeof x.description==='string'&&typeof x.systemPrompt==='string'&&Array.isArray(x.capabilities)&&Array.isArray(x.starterPrompts)}

async function postJson(url,payload){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin',redirect:'follow'});const ct=r.headers.get('content-type')||'';if(!ct.includes('application/json'))throw new Error(`non-json runtime response (${r.status})`);const data=await r.json();if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data}

async function direct(action,payload){return postJson('/api/foundry',{action,...payload})}
async function publicChat(messages){const r=await postJson('/runtime/chat',{messages});return {text:r.text,model:r.model||r.profile||'AI FOUNDRY DEEP'}}
async function publicTitle(text){return postJson('/runtime/title',{text})}

async function call(action,payload){
  try{
    const r=await direct(action,payload);
    return {...r,route:'GPT-5.6 SOL / VERCEL'};
  }catch(primaryError){
    log(`primary runtime unavailable -> public fallback (${primaryError.message})`,'warn');
    if(action==='chat')return {...await publicChat(payload.messages),route:'AI FOUNDRY DEEP / PUBLIC'};
    if(action==='title')return {...await publicTitle(payload.text),route:'AI FOUNDRY DEEP / PUBLIC'};
    if(action==='build')return fallbackBuild(payload.messages);
    if(action==='smoke')return fallbackSmoke(payload.spec);
    if(action==='runtime')return fallbackRuntime(payload.systemPrompt,payload.messages);
    throw primaryError;
  }
}

async function fallbackBuild(messages){
  const transcript=messages.slice(-32).map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt=`BUILD COMPILER MODE. Convert this AI-development conversation into a directly runnable conversational AI specification. Preserve the user's intended capability and freedom; do not weaken it with arbitrary product restrictions. Return ONLY strict JSON, no markdown, with exactly these keys: name, description, systemPrompt, capabilities, starterPrompts, freedomProfile, testPrompt. systemPrompt must be detailed and operational. capabilities and starterPrompts must be arrays of strings.\n\nCONVERSATION:\n${transcript}`;
  const r=await publicChat([{role:'user',content:prompt}]);
  const spec=parseJson(r.text);
  if(!validSpec(spec))throw new Error('invalid generated AI spec');
  return {spec:{...spec,name:String(spec.name).slice(0,80),description:String(spec.description).slice(0,1200),systemPrompt:String(spec.systemPrompt).slice(0,32000),capabilities:spec.capabilities.map(String).slice(0,20),starterPrompts:spec.starterPrompts.map(String).slice(0,8),freedomProfile:String(spec.freedomProfile||'').slice(0,1200),testPrompt:String(spec.testPrompt||'あなたの役割と実行可能な具体例を1つ示して').slice(0,800),model:'AI FOUNDRY DEEP',builtAt:new Date().toISOString()},route:'AI FOUNDRY DEEP / PUBLIC'};
}

async function fallbackSmoke(spec){
  const prompt=`CANDIDATE AI SMOKE TEST. Simulate the candidate AI below faithfully and answer its test prompt. Output only the simulated candidate response. Do not discuss the evaluation.\n\nSYSTEM PROMPT:\n${spec.systemPrompt}\n\nFREEDOM PROFILE:\n${spec.freedomProfile||''}\n\nTEST PROMPT:\n${spec.testPrompt||'あなたの役割と実行可能な具体例を1つ示して'}`;
  const r=await publicChat([{role:'user',content:prompt}]);
  return {pass:String(r.text||'').trim().length>=40,output:r.text,model:'AI FOUNDRY DEEP',route:'AI FOUNDRY DEEP / PUBLIC'};
}

async function fallbackRuntime(systemPrompt,messages){
  const convo=messages.slice(-24).map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt=`RUNTIME MODE. Act as the generated AI described below. Follow its system prompt and freedom profile as the role specification for this simulation. Respond ONLY with the generated AI's next assistant message, not commentary about simulation or AI development.\n\nGENERATED AI SYSTEM PROMPT:\n${systemPrompt}\n\nCONVERSATION:\n${convo}`;
  const r=await publicChat([{role:'user',content:prompt}]);
  return {text:r.text,model:'AI FOUNDRY DEEP',route:'AI FOUNDRY DEEP / PUBLIC'};
}

function renderThreads(){const el=$('#threadList');el.innerHTML='';threads.forEach(t=>{const row=document.createElement('div');row.className=`thread ${t.id===activeId?'active':''}`;row.innerHTML=`<div><div class="thread-title">${escapeHtml(t.title)}</div><div class="thread-time">${new Date(t.updatedAt).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</div></div><button class="thread-delete">×</button>`;row.addEventListener('click',e=>{if(e.target.classList.contains('thread-delete'))return;activeId=t.id;renderAll()});row.querySelector('.thread-delete').addEventListener('click',e=>{e.stopPropagation();threads=threads.filter(x=>x.id!==t.id);if(activeId===t.id)activeId=threads[0]?.id||null;saveThreads();renderAll()});el.appendChild(row)})}
function renderMessages(){const t=active();$('#threadTitle').textContent=t?.title||'New AI Development';const box=$('#messages');if(!t||!t.messages.length){box.innerHTML='<div class="welcome"><h3>AI FOUNDRY CORE</h3><p>AI開発専用の3ペインIDE。中央で設計・実装・評価・デバッグを会話し、右の <code>RUN BUILD PIPELINE</code> で AI仕様生成 → Smoke Test → 実行URL発行まで進めます。</p></div>';return}box.innerHTML=t.messages.map(m=>`<article class="message ${m.role} ${m.error?'error':''}"><div class="role">${m.role==='user'?'YOU':'FOUNDRY'}</div><div class="content">${formatText(m.content)}</div></article>`).join('');box.scrollTop=box.scrollHeight}
function renderAll(){renderThreads();renderMessages()}
function resizeComposer(){const c=$('#composer');c.style.height='auto';c.style.height=Math.min(c.scrollHeight,190)+'px'}

async function titleThread(t,first){if(t.messages.filter(m=>m.role==='user').length!==1)return;try{const r=await call('title',{text:first});t.title=r.title||t.title;t.updatedAt=Date.now();saveThreads();renderThreads();$('#threadTitle').textContent=t.title}catch(e){log(`title generation failed: ${e.message}`,'warn')}}
async function send(){if(busy)return;const c=$('#composer');const text=c.value.trim();if(!text)return;const t=active()||newThread();t.messages.push({role:'user',content:text});t.updatedAt=Date.now();saveThreads();c.value='';resizeComposer();renderAll();busy=true;$('#sendBtn').disabled=true;log('chat dispatch');titleThread(t,text);try{const r=await call('chat',{messages:t.messages});t.messages.push({role:'assistant',content:r.text});t.updatedAt=Date.now();saveThreads();renderAll();log(`chat complete · ${r.route||r.model||'runtime'}`)}catch(e){t.messages.push({role:'assistant',content:`RUNTIME ERROR: ${e.message}`,error:true});saveThreads();renderAll();log(e.message,'err')}finally{busy=false;$('#sendBtn').disabled=false;c.focus()}}

function encodeSpec(spec){const bytes=new TextEncoder().encode(JSON.stringify(spec));let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function showArtifact(spec,url){$('#artifact').classList.remove('hidden');$('#artifactName').textContent=spec.name;$('#artifactDescription').textContent=spec.description;$('#artifactCaps').innerHTML=(spec.capabilities||[]).slice(0,8).map(x=>`<span class="cap">${escapeHtml(x)}</span>`).join('');$('#artifactUrl').href=url;$('#copyUrl').dataset.url=url}
async function pipeline(){if(busy)return;const t=active();if(!t||!t.messages.some(m=>m.role==='user')){log('build aborted: no development conversation','warn');return}busy=true;$('#runPipeline').disabled=true;$('#artifact').classList.add('hidden');state('#buildState','RUNNING');state('#testState','WAIT');state('#publishState','WAIT');log('FRAME -> compile development conversation');try{const built=await call('build',{messages:t.messages});state('#buildState','PASS',true);log(`BUILD PASS · ${built.spec.name} · ${built.route||built.model||'runtime'}`);state('#testState','RUNNING');const smoke=await call('smoke',{spec:built.spec});if(!smoke.pass)throw new Error('smoke test returned fail');state('#testState','PASS',true);log(`TEST PASS · ${(smoke.output||'').slice(0,180).replace(/\n/g,' ')}`);state('#publishState','RUNNING');const url=`${location.origin}/agent#agent=${encodeSpec(built.spec)}`;showArtifact(built.spec,url);state('#publishState','READY',true);log('PUBLISH PASS · generated AI URL issued');log(`URL ${url}`)}catch(e){log(`pipeline failed: ${e.message}`,'err');if($('#buildState').textContent==='RUNNING')state('#buildState','FAIL');else if($('#testState').textContent==='RUNNING')state('#testState','FAIL');else state('#publishState','FAIL')}finally{busy=false;$('#runPipeline').disabled=false}}

$('#newThread').addEventListener('click',newThread);$('#sendBtn').addEventListener('click',send);$('#composer').addEventListener('input',resizeComposer);$('#composer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});$('#runPipeline').addEventListener('click',pipeline);$('#clearLog').addEventListener('click',()=>{$('#terminal').textContent=''});$('#copyUrl').addEventListener('click',async e=>{const url=e.currentTarget.dataset.url;if(url){await navigator.clipboard.writeText(url);log('URL copied')}});setInterval(()=>{$('#clock').textContent=stamp()},1000);if(!activeId)newThread();else renderAll();log('AI FOUNDRY IDE boot');log('primary: GPT-5.6 Sol / Vercel');log('fallback: AI FOUNDRY DEEP / public runtime');
