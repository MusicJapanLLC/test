/* A one-time, origin-bound handoff. Never places the save in a URL or overwrites silently. */
(()=>{'use strict';
const trial='https://lantern-journey.vocal-shore-1441.chatgpt.site',official='https://game.music-japan.com',path='/lantern-journey/',tag='lantern-save-handoff-v1';
function init(api){
 if(location.origin===trial){
  const button=document.createElement('button');button.className='official-transfer';button.textContent='公式版でつづける';button.type='button';document.querySelector('.title-start').append(button);
  button.addEventListener('click',()=>{
   const nonce=crypto.randomUUID(),child=window.open(official+path+'#from-trial='+nonce,'_blank');
   if(!child){api.notice('公式版を開くため、ポップアップを許可してください');return;}
   button.disabled=true;button.textContent='公式版に冒険をつないでいます';
   const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(timer);button.disabled=false;button.textContent='公式版でつづける';};
   const receive=e=>{if(e.origin!==official||e.source!==child||e.data?.tag!==tag||e.data.nonce!==nonce)return;if(e.data.type==='ready'){const save=api.snapshot();child.postMessage({tag,nonce,type:'save',save},official);}else if(e.data.type==='saved'||e.data.type==='cancel')cleanup();};
   window.addEventListener('message',receive);const timer=setTimeout(cleanup,90000);
  });
 }
 const nonce=new URLSearchParams(location.hash.slice(1)).get('from-trial');
 if(location.origin!==official||!location.pathname.startsWith(path)||!window.opener||!nonce||!/^[0-9a-f-]{36}$/.test(nonce))return;
 const parent=window.opener;history.replaceState(null,'',location.pathname+location.search);api.wait(true);
 let received=false;
 const cleanup=()=>{clearInterval(ping);clearTimeout(timeout);window.removeEventListener('message',receive);api.wait(false);};
 const ack=type=>{parent.postMessage({tag,nonce,type},trial);cleanup();};
 const receive=e=>{if(received||e.origin!==trial||e.source!==parent||e.data?.tag!==tag||e.data.nonce!==nonce||e.data.type!=='save')return;const raw=e.data.save;if(JSON.stringify(raw).length>1000000){ack('cancel');return;}const incoming=api.validate(raw);if(!incoming){ack('cancel');api.notice('引き継ぐ冒険を確認できませんでした');return;}received=true;clearInterval(ping);clearTimeout(timeout);api.receive(incoming,()=>ack('saved'),()=>ack('cancel'));};
 window.addEventListener('message',receive);
 const ping=setInterval(()=>parent.postMessage({tag,nonce,type:'ready'},trial),300),timeout=setTimeout(()=>{cleanup();api.notice('引き継ぎ元を開いたまま、もう一度お試しください');},20000);
 parent.postMessage({tag,nonce,type:'ready'},trial);
}
window.LanternSaveTransfer=Object.freeze({init});
})();
