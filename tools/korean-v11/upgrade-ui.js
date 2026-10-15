// Korean v1.1 additions. Injected inside the existing application closure.
const readingEngine=WahranReading.create(D);
const readingPreferenceKey='wahran-korean-reading-v1';
let readingPreferences={kana:true,ipa:true};
try{const p=JSON.parse(localStorage.getItem(readingPreferenceKey)||'null');if(p&&typeof p==='object'&&!Array.isArray(p)){for(const k of ['kana','ipa'])if(typeof p[k]==='boolean')readingPreferences[k]=p[k]}}catch{}
let conversation=null,conversationDelay=null;
function applyReadingPreferences(){
 document.documentElement.classList.toggle('hide-kana',!readingPreferences.kana);
 document.documentElement.classList.toggle('hide-ipa',!readingPreferences.ipa);
 $$('[data-reading-toggle]').forEach(b=>b.setAttribute('aria-pressed',String(readingPreferences[b.dataset.readingToggle])));
 for(const k of ['kana','ipa']){const input=$('#'+k+'-setting');if(input)input.checked=readingPreferences[k]}
}
function setReadingPreference(key,value){
 if(!['kana','ipa'].includes(key)||typeof value!=='boolean')return;
 readingPreferences[key]=value;applyReadingPreferences();
 try{localStorage.setItem(readingPreferenceKey,JSON.stringify(readingPreferences))}catch{toast('Reading hints changed for this session. This browser could not save the preference.')}
}
function readingToolbar(){return`<div class="reading-toolbar" role="group" aria-label="Reading hints"><span>Reading hints · approximate</span><button data-reading-toggle="kana" aria-pressed="${readingPreferences.kana}" aria-label="Show Katakana reading hints">カナ</button><button data-reading-toggle="ipa" aria-pressed="${readingPreferences.ipa}" aria-label="Show IPA pronunciation hints">IPA</button></div>`}
function koreanMarkup(text,small=false){
 const p=readingEngine.forText(text);
 return`<div class="reading${small?' reading-small':''}" data-reading-text="${esc(text)}">${p?`<div class="kana" lang="ja" aria-label="Approximate Katakana reading">${esc(p.kana)}</div>`:''}<div class="ar" lang="ko-KR" dir="ltr">${esc(text)}</div>${p?`<div class="ipa" aria-label="Approximate IPA pronunciation">${esc(p.ipa)}${p.scope==='chunks'?'<span class="guide-scope"> · chunk guide</span>':''}</div>`:''}</div>`;
}
function readingSettings(){return`<section class="section"><h3>Read it, then say it</h3><label class="toggle">Katakana above Korean<input id="kana-setting" type="checkbox" ${readingPreferences.kana?'checked':''}></label><label class="toggle">IPA below Korean<input id="ipa-setting" type="checkbox" ${readingPreferences.ipa?'checked':''}></label><p class="reading-help">Katakana is a starting aid, not the exact Korean sound. IPA is an automatically generated broad pronunciation guide using Korean sound-change rules. Neither replaces a trusted speaker. Generated combinations join precomputed chunk guides; cross-chunk changes and intonation are not represented.</p><p class="ja-inline" lang="ja">カタカナは入口としての近似です　母音や濃音などの違いは表しきれません<br>IPAも自動生成の目安で、全教材の母語話者校閲は未実施です　音声と合わせて練習してください<br>小さな ㇰ・ㇺ・ㇽ・ㇷ゚ は、余分な母音を足さない語末音の目安です</p><p class="help">Both hints start on. Turn either off when you are ready. These two display preferences stay on this browser and are separate from your existing progress backup.</p></section>`}
function examplePreview(word){
 const x=E.entry(word.usageId);if(!x)return'';
 return`<div class="usage-preview" data-usage-id="${x.id}" data-audio-id="${x.id}"><div class="usage-caption"><span>Use it like this</span><span>${x.register==='casual'?'With close friends':'Everyday example'}</span></div>${koreanMarkup(x.ar,true)}<div class="en">${esc(x.en)}</div><div class="ja-inline" lang="ja">${esc(x.ja)}</div><div class="usage-actions"><button data-play="${x.id}" aria-label="Listen to example: ${esc(x.en)}">${icon('play')} Listen</button><button data-slow="${x.id}" aria-label="Slow example: ${esc(x.en)}">${icon('slow')} Slow</button><button data-open="${x.id}">Open example ${icon('arrow')}</button></div></div>`;
}
function renderWordResultsV11(){
 const due=new Set(E.due(S).map(x=>x.id)),matches=D.words.filter(w=>(wordTopic==='all'||w.topic===wordTopic)&&E.matches(w,wordQuery)&&(wordScope==='all'||(wordScope==='saved'?S.saved.includes(w.id):due.has(w.id))));
 $('#word-results').innerHTML=`<div class="count">${matches.length} ${wordScope==='saved'?'saved ':''}words · ${Object.keys(S.reviews).filter(id=>id.startsWith('w')).length} ever reviewed</div>${matches.slice(0,wordLimit).map(w=>`<article class="word-card"><div class="word-row" data-audio-id="${w.id}"><button class="word-main" data-open="${w.id}"><div class="word-topic">${esc(D.topics.find(t=>t.id===w.topic).title)}</div>${koreanMarkup(w.ar)}<div class="en">${esc(w.en)}</div><div class="ja-inline" lang="ja">${esc(w.ja)}</div></button><button class="icon-button" data-play="${w.id}" aria-label="Listen: ${esc(w.en)}">${icon('play')}</button></div>${examplePreview(w)}</article>`).join('')}${matches.length>wordLimit?'<div class="spacer"></div><button class="secondary wide" data-action="more-words">Show 30 more</button>':''}${matches.length?'':'<div class="empty">No words match<br>Try another topic or a shorter search.</div>'}`;
 loadVisibleReferences();
}
function openWordV11(id){
 const x=E.entry(id);if(!x)return;
 const usage=x.usageId?E.entry(x.usageId):null,related=(x.examples||[]).map(i=>E.entry(i)).filter(Boolean);
 openModal(x.pos?'Vocabulary':x.kind==='usage'?'Use it in a sentence':'Useful line',phrase(x)+`<p class="help">${esc(x.pos?D.topics.find(t=>t.id===x.topic).description:x.note||'An authored example, not a rule for every situation. Use the wording with the relationship shown.')}</p>${usage?`<h3>Use it like this</h3><div class="spacer"></div>${phrase(usage)}`:''}${related.length?`<details class="section"><summary>More related lesson lines</summary><div class="spacer"></div>${related.map(y=>phrase(y,{mini:true})).join('')}</details>`:''}${x.wordId?`<button class="secondary wide" data-open="${x.wordId}">${icon('back')} Back to the word</button><div class="spacer"></div>`:''}<div class="assessment"><button class="secondary" data-grade="${id}" data-result="again">Review again soon</button><button class="primary" data-grade="${id}" data-result="good">I can recall this</button></div><p class="help">Self-review: “again” in 10 minutes; successful reviews at increasing day intervals.</p>`);
}
function conversationCatalog(){
 return`<section class="section" id="conversation-catalog"><div class="section-title"><h2>Conversations that keep going</h2><span class="eyebrow">${D.dialogues.length} conversations</span></div><p class="help">Choose A or B. Listen to your partner, say your reply, then reveal the Korean. These are authored practice conversations, not live AI chats. Scene wording follows the relationship and does not automatically change with the style buttons above.</p><div class="conversation-list">${D.dialogues.map((d,i)=>`<button class="conversation-card" data-dialogue="${d.id}"><div class="row between"><span>${String(i+1).padStart(2,'0')} · ${d.turns.length} turns</span><span>${d.register==='mixed'?'Polite → casual':'Everyday polite'}</span></div><strong>${esc(d.title)}</strong><small lang="ja">${esc(d.ja)}</small><small>Choose a role · listen · reply ›</small></button>`).join('')}</div></section>`;
}
function stopConversationPlayback(){
 if(conversation){conversation.run++;conversation.playing=false}
 if(conversationDelay){clearTimeout(conversationDelay.timer);conversationDelay.resolve(false);conversationDelay=null}
 $$('[data-conversation-turn]').forEach(el=>el.classList.remove('is-playing'));
 updateConversationPlayButton();
}
function updateConversationPlayButton(){
 const b=$('[data-conversation-play]');if(b){b.setAttribute('aria-pressed',String(!!conversation?.playing));b.textContent=conversation?.playing?'Stop conversation':'Listen to conversation'}
}
function openConversation(id){
 const d=D.dialogues.find(d=>d.id===id);if(!d)return;
 openModal('Conversation practice','');
 conversation={d,role:'A',index:0,revealed:false,mode:'practice',run:0,playing:false};
 renderConversation();
}
function conversationTop(c){
 return`<div class="conversation-intro"><div class="eyebrow">Conversation practice · ${c.d.turns.length} turns</div><h2>${esc(c.d.title)}</h2><p class="help">${esc(c.d.situation)}</p><p class="ja-inline" lang="ja">${esc(c.d.ja)}</p><div class="conversation-controls" role="group" aria-label="Your conversation role"><button data-conversation-role="A" aria-pressed="${c.role==='A'}">I am A</button><button data-conversation-role="B" aria-pressed="${c.role==='B'}">I am B</button><button data-conversation-mode="${c.mode==='practice'?'transcript':'practice'}">${c.mode==='practice'?'Read full conversation':'Practise my replies'}</button></div><div class="conversation-role-label">A · ${esc(c.d.roles.A)}<br>B · ${esc(c.d.roles.B)}</div><div class="conversation-controls"><button data-conversation-play aria-pressed="${c.playing}">${c.playing?'Stop conversation':'Listen to conversation'}</button></div><p class="reading-help">${esc(c.d.tip)}</p></div>`;
}
function renderConversation(){
 const c=conversation;if(!c||!dialog.open)return;
 if(c.mode==='transcript'){
  modal.innerHTML=conversationTop(c)+`<div class="conversation-transcript">${c.d.turns.map((t,i)=>`<section class="conversation-turn" data-speaker="${t.speaker}" data-conversation-turn="${i}"><div class="conversation-badge">${t.speaker} · ${esc(c.d.roles[t.speaker])}${t.speaker===c.role?' · YOU':''}</div>${phrase(t,{mini:true,practice:false})}</section>`).join('')}</div><p class="help">Device Korean synthesis · no automatic pronunciation score. You can save any line and practise its recording from your saved collection.</p>`;
 }else if(c.index>=c.d.turns.length){
  modal.innerHTML=conversationTop(c)+`<div class="conversation-complete"><div class="eyebrow">You reached the end</div><h2>Now try the other side.</h2><p class="help">${c.d.turns.length} turns explored. This is self-guided practice, not a measured speaking result.</p><button class="primary wide" data-conversation-restart>Practise again</button><div class="spacer"></div><button class="secondary wide" data-conversation-mode="transcript">Read the whole conversation</button></div>`;
 }else{
  const t=c.d.turns[c.index],mine=t.speaker===c.role;
  modal.innerHTML=conversationTop(c)+`<section class="conversation-step"><div class="row between count"><span>${mine?'Your reply':'Your partner speaks'}</span><span>${c.index+1} / ${c.d.turns.length}</span></div><div class="progress-track"><span style="width:${c.index/c.d.turns.length*100}%"></span></div><div class="conversation-badge">${t.speaker} · ${esc(c.d.roles[t.speaker])}</div>${mine&&!c.revealed?`<div class="conversation-prompt"><div class="eyebrow">Try saying this in Korean</div><div class="en">${esc(t.en)}</div><p class="ja-inline" lang="ja">${esc(t.ja)}</p><button class="secondary wide" data-conversation-reveal>Show my line</button></div>`:phrase(t,{mini:true,practice:false})}<p class="help">${mine?'Say it out loud at your own pace. Reveal the model when you need a hint.':'Listen to this line, then continue to your reply.'}</p><div class="conversation-navigation"><button class="secondary" data-conversation-back ${c.index===0?'disabled':''}>Back</button><button class="primary" data-conversation-next>${c.index===c.d.turns.length-1?'Finish conversation':mine?'I said it → Next':'Continue →'}</button></div></section>`;
 }
 loadVisibleReferences();
}
function conversationWait(ms){return new Promise(resolve=>{conversationDelay={resolve,timer:setTimeout(()=>{conversationDelay=null;resolve(true)},ms)}})}
async function playConversation(){
 const c=conversation;if(!c)return;
 if(c.playing){stopConversationPlayback();stopAudio();return}
 stopConversationPlayback();pauseSession();stopAudio();
 c.mode='transcript';c.playing=true;const token=++c.run;renderConversation();
 try{
  for(let i=0;i<c.d.turns.length;i++){
   if(conversation!==c||c.run!==token||!dialog.open)break;
   $$('[data-conversation-turn]').forEach(el=>el.classList.toggle('is-playing',+el.dataset.conversationTurn===i));
   const row=$(`[data-conversation-turn="${i}"]`);row?.scrollIntoView({block:'nearest',behavior:'instant'});
   const ok=await playEntry(c.d.turns[i].id);
   if(!ok||conversation!==c||c.run!==token||!dialog.open)break;
   if(i<c.d.turns.length-1)await conversationWait(700);
  }
 }catch(err){if(conversation===c&&c.run===token)showError(err.message||'Conversation audio could not play. Tap an individual line to try again.')}
 finally{if(conversation===c&&c.run===token){c.playing=false;$$('[data-conversation-turn]').forEach(el=>el.classList.remove('is-playing'));updateConversationPlayButton()}}
}
function handleConversationClick(button){
 const a=button.dataset;
 if(a.dialogue){openConversation(a.dialogue);return true}
 if(!conversation)return false;
 if(Object.hasOwn(a,'conversationPlay')){playConversation().catch(e=>showError(e.message));return true}
 if(!Object.keys(a).some(k=>k.startsWith('conversation')))return false;
 stopConversationPlayback();stopAudio();const c=conversation;
 if(a.conversationRole&&['A','B'].includes(a.conversationRole)){c.role=a.conversationRole;c.revealed=false}
 else if(a.conversationMode&&['practice','transcript'].includes(a.conversationMode)){c.mode=a.conversationMode}
 else if(Object.hasOwn(a,'conversationReveal'))c.revealed=true;
 else if(Object.hasOwn(a,'conversationNext')){c.index=Math.min(c.index+1,c.d.turns.length);c.revealed=false}
 else if(Object.hasOwn(a,'conversationBack')){c.index=Math.max(0,c.index-1);c.revealed=false}
 else if(Object.hasOwn(a,'conversationRestart')){c.index=0;c.revealed=false;c.mode='practice'}
 renderConversation();return true;
}
applyReadingPreferences();
