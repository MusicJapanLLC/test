/* A permanent, deterministic journey pass. Purchase ownership never lives in a save. */
(()=>{'use strict';
const R=window.LanternRPG,J=window.LanternJourney,X=window.LanternExpansion,Q=window.LanternRewards;
const rewards=Array.from({length:30},(_,i)=>{const n=i+1;return n%10===0?{gear:n===30?4:n===20?3:2,tickets:n/5}:n%5===0?{crystal:25,tickets:2}:n%3===0?{books:4+Math.floor(n/6),crests:1}:n%2===0?{dust:10+Math.floor(n/3)*2}: {coin:40+n*3};});
const styles=[{id:'harbor',name:'潮鐘の青',color:'#78cbbf',unlock:0},{id:'ember',name:'帰港の琥珀',color:'#efb277',unlock:5},{id:'lilac',name:'星渡りの紫',color:'#b9a0ee',unlock:10},{id:'rose',name:'約束の茜',color:'#e59baf',unlock:15},{id:'jade',name:'森守りの翠',color:'#87cfb0',unlock:20},{id:'moon',name:'月灯りの銀',color:'#b6d9ef',unlock:25},{id:'sunrise',name:'七灯の金',color:'#f5d27e',unlock:30}];
function ensure(s){if(!s.pass)s.pass={version:15,points:0,claimed:Array(30).fill(false),theme:'harbor'};return s.pass;}
function valid(s){const p=s.pass;return p?.version===15&&Number.isInteger(p.points)&&p.points>=0&&p.points<=1200&&Array.isArray(p.claimed)&&p.claimed.length===30&&p.claimed.every(x=>typeof x==='boolean')&&styles.some(x=>x.id===p.theme);}
function points(s){const q=Q.ensure(s),x=X.ensure(s);return Math.min(1200,s.next*24+(s.trials?.hard||0)*30+(s.trials?.expert||0)*40+q.wins*10+Math.min(200,J.ensure(s).upgrades*2)+(s.unlocked.length-1)*18+x.tower*20+q.hunts*20);}
function sync(s){const p=ensure(s);p.points=Math.max(p.points,points(s));return p;}
function level(s){return Math.floor(sync(s).points/40);}
function ready(s){const p=sync(s),n=level(s);return p.claimed.filter((v,i)=>!v&&i<n).length;}
function claim(s,i){const p=sync(s),r=rewards[i];if(!Number.isInteger(i)||!r||i>=level(s)||p.claimed[i]||r.gear!==undefined&&s.gear.length>=300)return false;
 const out={};for(const [k,v]of Object.entries(r)){if(k==='gear'){const g=R.grant(s,'weapon',s.party[0],Math.max(1,Math.min(7,Math.floor(s.next/3)+1)),v);g.locked=true;g.affix='edge';out.item=g;}else out[k]=v;}
 const {item,...currency}=out;QCredit(s,currency);p.claimed[i]=true;J.collect(s);return out;
}
function QCredit(s,r){const {tickets=0,...rest}=r;J.credit(s,rest);X.ensure(s).tickets=Math.min(999999,s.expansion.tickets+tickets);}
function claimAll(s){const result={items:[],rewards:{},count:0};for(let i=0;i<30;i++){const r=claim(s,i);if(!r)continue;result.count++;for(const [k,v]of Object.entries(r))if(k==='item')result.items.push(v);else result.rewards[k]=(result.rewards[k]||0)+v;}return result.count?result:false;}
function theme(s,owned=false){const p=ensure(s),t=styles.find(t=>t.id===p.theme);return t&&(!t.unlock||owned&&level(s)>=t.unlock)?t:styles[0];}
function setTheme(s,id,owned=false){const t=styles.find(t=>t.id===id);if(!t||t.unlock&&(!owned||level(s)<t.unlock))return false;ensure(s).theme=id;return true;}
window.LanternPass=Object.freeze({ensure,valid,sync,level,ready,claim,claimAll,rewards,styles,theme,setTheme});})();
