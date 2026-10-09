/* Permanent objectives and targeted loot, with no expiry or paid currency. */
(()=>{'use strict';const R=window.LanternRPG,J=window.LanternJourney,X=window.LanternExpansion;
const int=(n,max=999999)=>Number.isInteger(n)&&n>=0&&n<=max;
function seed(){return{version:14,hunt:{slot:'weapon',hero:0,count:0,difficulty:2,tier:7},hunts:0,wins:0,weak:0,breaks:0,stops:0,claims:Array(7).fill(false)};}
function ensure(s){return s.rewards||(s.rewards=seed());}
function valid(s){const q=s.rewards,h=q?.hunt;return q?.version===14&&h&&R.slots.includes(h.slot)&&s.unlocked.includes(h.hero)&&int(h.count,3)&&int(h.difficulty,2)&&int(h.tier,7)&&h.tier>=1&&['hunts','wins','weak','breaks','stops'].every(k=>int(q[k]))&&Array.isArray(q.claims)&&q.claims.length===7&&q.claims.every(v=>typeof v==='boolean');}
function setHunt(s,slot,hero){const q=ensure(s);if(q.hunt.count||!R.slots.includes(slot)||!s.unlocked.includes(hero))return false;Object.assign(q.hunt,{slot,hero});return true;}
function observe(s,e){const r=s.run;if(!r)return;const m=r.counterStats||(r.counterStats={weak:0,breaks:0,stops:0});if(e.weak)m.weak++;if(e.broken)m.breaks++;if(e.counter==='回復を阻止'||e.interrupted)m.stops++;if(e.counter)r.lastCounter=e.counter;}
function record(s){const r=s.run;if(!r||r.reason!=='won'||r.rewardsRecorded)return false;r.rewardsRecorded=true;const q=ensure(s);q.wins=Math.min(999999,q.wins+1);for(const key of ['weak','breaks','stops'])q[key]=Math.min(999999,q[key]+(r.counterStats?.[key]||0));if(!r.tower&&q.hunt.count<3){q.hunt.count++;q.hunt.difficulty=Math.min(q.hunt.difficulty,r.difficulty);q.hunt.tier=Math.min(q.hunt.tier,r.difficulty===2?7:r.difficulty===1?Math.max(4,Math.floor(r.stage/3)+1):Math.floor(r.stage/3)+1);r.huntProgress=q.hunt.count;}return true;}
function claimHunt(s){const q=ensure(s),h=q.hunt;if(h.count<3||s.gear.length>=300)return false;const g=R.grant(s,h.slot,h.hero,h.tier,[2,3,4][h.difficulty]);g.locked=true;g.tempered=h.difficulty;g.affix=h.slot==='weapon'?'edge':['armor','helm'].includes(h.slot)?'ward':'heart';q.hunts=Math.min(999999,q.hunts+1);q.hunt={slot:h.slot,hero:h.hero,count:0,difficulty:2,tier:7};J.collect(s);return g;}
const milestones=[
 {name:'三つの灯をつなぐ',description:'クエストで3回勝利',target:3,value:s=>ensure(s).wins,reward:{tickets:3,coin:60}},
 {name:'支度を重ねて',description:'装備を合計10段階強化',target:10,value:s=>J.ensure(s).upgrades,reward:{dust:20,books:6}},
 {name:'灯の大家族',description:'仲間を8人迎える',target:8,value:s=>s.unlocked.length,reward:{tickets:3,crests:3}},
 {name:'弱点を見抜く',description:'紋章の弱点追撃を8回決めて勝利',target:8,value:s=>ensure(s).weak,reward:{tickets:3,books:8}},
 {name:'護りの向こうへ',description:'護り崩しを4回決めて勝利',target:4,value:s=>ensure(s).breaks,reward:{crystal:30,dust:20}},
 {name:'狙った一品',description:'指定装備を3回受け取る',target:3,value:s=>ensure(s).hunts,reward:{tickets:5,crests:3}},
 {name:'星灯の見晴らし',description:'星灯の塔5Fを踏破',target:5,value:s=>X.ensure(s).tower,reward:{tickets:5,crystal:30}}
];
function credit(s,reward){const {tickets=0,...rest}=reward;J.credit(s,rest);X.ensure(s).tickets=Math.min(999999,s.expansion.tickets+tickets);}
function claim(s,i){const m=milestones[i],q=ensure(s);if(!m||q.claims[i]||m.value(s)<m.target)return false;q.claims[i]=true;credit(s,m.reward);return {...m.reward};}
function claimAll(s){const sum={},add=r=>{if(r)for(const [k,v]of Object.entries(r))if(typeof v==='number'&&k!=='target')sum[k]=(sum[k]||0)+v;};for(let i=0;i<7;i++)add(claim(s,i));for(let i=0;i<21;i++)add(J.claimMastery(s,i));for(let i=1;i<=7;i++)add(J.claimSet(s,i));for(let i=0;i<3;i++){const c=X.claim(s,i);if(c)add({coin:c.coin,tickets:c.tickets});}return Object.keys(sum).length?sum:false;}
function ready(s){const q=ensure(s),d=X.today(s);return milestones.filter((m,i)=>!q.claims[i]&&m.value(s)>=m.target).length+J.ensure(s).mastery.filter((m,i)=>m&~s.journey.claims[i]).length+s.journey.setClaims.filter((v,i)=>!v&&s.journey.known.slice(i*5,i*5+5).every(Boolean)).length+X.contracts.filter((c,i)=>!d.claims[i]&&d[c.key]>=c.target).length;}
window.LanternRewards=Object.freeze({ensure,valid,setHunt,observe,record,claimHunt,milestones,claim,claimAll,ready});})();
