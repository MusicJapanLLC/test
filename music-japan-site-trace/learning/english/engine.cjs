/* English study state is deliberately separate from the Korean and Wahran apps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DAY=86400000;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
 function emptyState(){return {app:'mj-english',version:1,saved:[],reviews:{},history:{},settings:{ipa:true,japanese:true,speed:1,voice:'',accent:'en-US'},lastUnit:null};}
 function normalize(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}'\s]/gu,'').replace(/\s+/g,' ').trim();}
 function sameAnswer(a,b){return !!normalize(a)&&normalize(a)===normalize(b);}
 function localDay(now){const d=new Date(now);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function grade(state,id,rating,now=Date.now()){
  if(!['again','good','easy'].includes(rating)||typeof id!=='string'||!id||['__proto__','prototype','constructor'].includes(id))throw new Error('Invalid review');
  const next={...state,reviews:{...state.reviews},history:{...state.history}};
  const previous=own(state.reviews,id)?state.reviews[id]:{streak:0,attempts:0};
  const streak=rating==='again'?0:Math.min(10,previous.streak+(rating==='easy'?2:1));
  const intervals=[0,1,3,7,14,30,60,90,120,150,180];
  next.reviews[id]={streak,attempts:previous.attempts+1,last:now,due:now+(rating==='again'?600000:intervals[streak]*DAY)};
  const day=localDay(now);next.history[day]=(next.history[day]||0)+1;next.lastUnit=id;
  return next;
 }
 function filter(entries,{query='',kind='all',category='all',level='all'}={}){
  const q=normalize(query);
  return entries.filter(e=>(kind==='all'||e.kind===kind)&&(category==='all'||e.category===category)&&(level==='all'||e.level===level)&&(!q||normalize([e.en,e.ja,e.explanation,e.useWhen,...(e.related||[]),...(e.examples||[]).flatMap(x=>[x.en,x.ja])].join(' ')).includes(q)));
 }
 function due(entries,state,now=Date.now()){return entries.filter(e=>own(state.reviews,e.id)&&state.reviews[e.id].due<=now).sort((a,b)=>state.reviews[a.id].due-state.reviews[b.id].due);}
 function queue(entries,state,{reviewOnly=false,now=Date.now(),limit=10,category='all'}={}){
  const list=filter(entries,{category});const ready=due(list,state,now);
  return (reviewOnly?ready:[...ready,...list.filter(e=>!state.reviews[e.id]),...list.filter(e=>state.reviews[e.id]&&state.reviews[e.id].due>now)]).slice(0,Math.max(1,Math.min(200,limit)));
 }
 function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function orderMatches(order,count){return order.length===count&&order.every((n,i)=>n===i);}
 function restore(raw,entries){
  if(!object(raw)||raw.version!==1)throw new Error('Unsupported progress version');
  if(raw.app!=='mj-english')throw new Error('Not an English progress backup');
  if(!Array.isArray(raw.saved)||!object(raw.reviews)||!object(raw.history)||!object(raw.settings))throw new Error('Invalid saved progress structure');
  if(raw.saved!==undefined&&!Array.isArray(raw.saved))throw new Error('Invalid saved list');
  if(raw.reviews!==undefined&&!object(raw.reviews))throw new Error('Invalid reviews');
  const state=emptyState(),ids=new Set(entries.map(e=>e.id));
  state.saved=[...new Set((raw.saved||[]).filter(id=>ids.has(id)))];
  for(const id of ids){if(!own(raw.reviews||{},id))continue;const r=raw.reviews[id];if(!object(r))continue;
   if(['due','streak','attempts','last'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&r.due<=8640000000000000&&r.last<=8640000000000000){state.reviews[id]={due:r.due,streak:Math.min(10,Math.floor(r.streak)),attempts:Math.min(1000000,Math.floor(r.attempts)),last:r.last};}
  }
  if(object(raw.history))for(const [key,value] of Object.entries(raw.history)){if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&Number.isInteger(value)&&value>=0&&value<=1000000)state.history[key]=value;}
  if(object(raw.settings)){const s=raw.settings;if(typeof s.ipa==='boolean')state.settings.ipa=s.ipa;if(typeof s.japanese==='boolean')state.settings.japanese=s.japanese;
   if([.7,.85,1,1.1].includes(s.speed))state.settings.speed=s.speed;
   if(typeof s.voice==='string'&&s.voice.length<300)state.settings.voice=s.voice;
   if(['en-US','en-GB','en-AU'].includes(s.accent))state.settings.accent=s.accent;
  }
  if(ids.has(raw.lastUnit))state.lastUnit=raw.lastUnit;
  return state;
 }
 return {emptyState,normalize,sameAnswer,localDay,grade,filter,due,queue,shuffle,orderMatches,restore};
});
