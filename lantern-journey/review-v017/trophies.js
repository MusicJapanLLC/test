/* v17 permanent trophies. Historical facts are imported once; new tactics require observed victorious actions. */
(()=>{'use strict';
const R=window.LanternRPG,MAX=999999;
const int=(n,max=MAX)=>Number.isInteger(n)&&n>=0&&n<=max;
const amount=n=>int(n)?n:0,cap=n=>Math.min(MAX,n);
const categories=Object.freeze({stage:'旅路',tactics:'戦術',gear:'装備',companions:'仲間',festival:'灯祭',tower:'星灯の塔',milestones:'歩み'});
const tacticKeys=['weak','breaks','critical','stops','skills','support'],statKeys=[...tacticKeys,'wins'];
const metricKeys=['upgrades','dismantled','rarity','gearRank','collection','sets','maxGearSlots','companions','level','bond','mastered','heroRank','days'];
const blank=keys=>Object.fromEntries(keys.map(k=>[k,0]));
const definitions=[];
function add(id,category,name,description,target,source,reward){definitions.push(Object.freeze({id,category,name,description,target,source,reward:Object.freeze(reward)}));}
const modes=['NORMAL','HARD','EXPERT'];
for(let d=0;d<3;d++)for(let i=0;i<21;i++){
 const location=(Math.floor(i/3)+1)+'-'+(i%3+1),reward={coin:[4,7,10][d]};
 if(i%3===2)reward.dust=d+1;
 if(i===20)reward.crystal=5;
 add('stage.'+d+'.'+i,'stage',modes[d]+' '+location+' 踏破',modes[d]+'のステージ'+location+'をクリア',i+1,'stage.'+d,reward);
}
const tactical=[
 ['weak','弱点を見抜く','弱点追撃を決めた行動',[1,10,25,75,150]],
 ['breaks','護りを切り開く','敵の護りを崩した行動',[1,5,15,40,100]],
 ['critical','隙を逃さない','会心を決めた行動',[1,10,30,100,250]],
 ['stops','敵の企てを止める','敵の溜め・詠唱を中断、または回復を阻止した行動',[1,5,15,40,100]],
 ['skills','必殺のひらめき','必殺技を使った行動',[1,10,30,100,250]],
 ['support','支え合う灯','仲間を回復、または守りの技を使った行動（薬を除く）',[1,10,30,100,250]]
];
for(const [key,name,description,targets]of tactical)targets.forEach((n,i)=>add('tactics.'+key+'.'+n,'tactics',name+' '+['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][i],description+'を累計'+n+'回記録して勝利',n,'stats.'+key,i<3?{coin:3+i,dust:1}:{coin:6+i,books:1}));
function series(category,key,name,description,targets,rewards){targets.forEach((n,i)=>add(category+'.'+key+'.'+n,category,name+' '+['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][i],description(n),n,'metrics.'+key,rewards(i,n)));}
series('gear','upgrades','鍛冶の積み重ね',n=>'装備を累計'+n+'段階強化する',[1,5,15,30,60],i=>({coin:4+i,dust:1+i}));
series('gear','dismantled','素材を次の旅へ',n=>'装備を累計'+n+'個分解する',[1,10,30,75],i=>({coin:4+i,dust:1+i}));
for(const rarity of [2,3,4])add('gear.rarity.'+rarity,'gear',['','','希少の一品','英雄の一品','神話の一品'][rarity],['','','SR','SSR','UR'][rarity]+'以上の装備を所持する',rarity,'metrics.rarity',{coin:4+rarity,dust:rarity});
series('gear','gearRank','磨いた一品',n=>'ひとつの装備を+'+n+'に育てる',[2,3,5],i=>({coin:5+i,dust:2+i}));
series('gear','collection','装備の図鑑',n=>'上質以上の装備を'+n+'種登録する（章×部位）',[5,10,20,35],(i,n)=>n===35?{dust:4,crystal:3}:{coin:5+i,dust:2});
series('gear','sets','装いの記録',n=>'上質以上の装備セットを'+n+'章分揃えて登録する',[1,3,7],i=>({coin:6+i,dust:2+i}));
series('gear','maxGearSlots','全身の研鑽',n=>'仲間ひとりに+5の装備を'+n+'部位同時に装備する',[3,5],i=>({coin:8+i*2,books:1+i}));
series('companions','companions','広がる旅の輪',n=>'仲間を'+n+'人迎える',[2,4,8,12,20],i=>({coin:5+i,books:1}));
series('companions','level','重ねた経験',n=>'仲間ひとりをLv.'+n+'に育てる',[10,20,30,45,60],(i,n)=>n===60?{books:2,crystal:3}:{coin:5+i,books:1});
series('companions','bond','深まる絆',n=>'仲間ひとりの絆を'+n+'に育てる',[1,3,5],i=>({coin:6+i,books:1+i}));
add('companions.mastered.1','companions','三つの技の熟練','仲間ひとりの必殺技・支援技・固有技をすべてLv.3にする',1,'metrics.mastered',{coin:10,books:2});
add('companions.heroRank.5','companions','覚醒の頂','仲間ひとりの覚醒を5段階にする',5,'metrics.heroRank',{coin:10,dust:4});
for(let i=0;i<3;i++)add('festival.clear.'+i,'festival','灯祭の試練 '+(i+1),'灯祭の試練'+(i+1)+'をクリア',1,'festival.'+i,{coin:6,dust:2});
add('festival.complete','festival','三つの灯祭','灯祭の3つの試練をすべてクリア',3,'festival.complete',{books:2,crystal:3});
for(const n of [10,25])add('festival.wins.'+n,'festival','灯祭の常連 '+(n===10?'Ⅰ':'Ⅱ'),'灯祭で累計'+n+'回勝利',n,'festival.wins',{coin:n===10?8:12,dust:3});
for(const n of [1,5,10,15,20,30])add('tower.floor.'+n,'tower','星灯の塔 '+n+'F','星灯の塔'+n+'Fを踏破',n,'tower',n===30?{coin:15,dust:5,crystal:5}:{coin:5+Math.floor(n/5),dust:2});
for(const n of [10,25,50,100])add('milestones.wins.'+n,'milestones','勝利の足跡 '+n,'旅路・塔・灯祭で累計'+n+'回勝利',n,'stats.wins',n===100?{coin:12,books:2,crystal:3}:{coin:6,dust:2});
for(const n of [7,30])add('milestones.days.'+n,'milestones','帰ってくる灯 '+n,'日々の贈り物を累計'+n+'日受け取る（連続でなくてよい）',n,'metrics.days',{coin:n===7?7:12,books:1});
Object.freeze(definitions);
const byId=new Map(definitions.map(t=>[t.id,t]));
const seenEvents=new WeakSet();
function refresh(s,q){
 const j=s.journey,t=s.trials,heroes=(s.unlocked||[]).map(id=>s.heroes?.[id]).filter(Boolean),gear=s.gear||[],known=j?.known||[];
 const fullSets=Array.from({length:7},(_,i)=>known.slice(i*5,i*5+5)).filter(items=>items.length===5&&items.every(Boolean)).length;
 const maxSlots=Math.max(0,...(s.unlocked||[]).map(id=>Object.values(s.equipped?.[id]||{}).filter(gid=>gear.some(g=>g.id===gid&&g.rank===5)).length));
 const facts={upgrades:amount(j?.upgrades),dismantled:amount(j?.dismantled),rarity:Math.max(0,...gear.map(g=>amount(g.rarity))),gearRank:Math.max(0,...gear.map(g=>amount(g.rank))),collection:known.filter(Boolean).length,sets:fullSets,maxGearSlots:maxSlots,companions:heroes.length,level:Math.max(0,...heroes.map(h=>R.level(h.xp))),bond:Math.max(0,...(s.unlocked||[]).map(id=>amount(t?.bonds?.[id]))),mastered:heroes.some(h=>['special','secondary','passive'].every(k=>h.skills[k]===3))?1:0,heroRank:Math.max(0,...heroes.map(h=>amount(h.rank))),days:amount(s.daily?.day)};
 for(const key of metricKeys)q.metrics[key]=cap(Math.max(q.metrics[key],facts[key]));
 return q;
}
function ensure(s){
 if(!s.trophies){const stats=blank(statKeys);for(const key of ['weak','breaks','stops'])stats[key]=amount(s.rewards?.[key]);stats.wins=cap(Math.max(amount(s.journey?.victories),amount(s.rewards?.wins))+(s.festival?.wins||[]).reduce((a,n)=>a+amount(n),0));s.trophies={version:17,stats,metrics:blank(metricKeys),claims:[]};}
 return refresh(s,s.trophies);
}
function countersValid(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>int(value[k]));}
function valid(s){
 const q=s.trophies,r=s.run;
 if(q&&(q.version!==17||!countersValid(q.stats,statKeys)||!countersValid(q.metrics,metricKeys)||!Array.isArray(q.claims)||q.claims.length>definitions.length||new Set(q.claims).size!==q.claims.length||q.claims.some(id=>!byId.has(id))))return false;
 if(r?.trophyStats!==undefined&&!countersValid(r.trophyStats,tacticKeys))return false;
 if(r?.trophyRecorded!==undefined&&typeof r.trophyRecorded!=='boolean')return false;
 if(r?.trophyRecorded===true&&!['won','defeat','retreat'].includes(r.reason))return false;
 return true;
}
function rawValue(s,t,q){
 const [key,sub]=t.source.split('.');
 if(key==='stage')return sub==='0'?amount(s.next):sub==='1'?amount(s.trials?.hard):amount(s.trials?.expert);
 if(key==='stats'||key==='metrics')return q[key][sub];
 if(key==='tower')return amount(s.expansion?.tower);
 const wins=s.festival?.wins||[0,0,0];
 if(sub==='complete')return wins.filter(n=>n>0).length;
 if(sub==='wins')return cap(wins.reduce((a,n)=>a+amount(n),0));
 return amount(wins[Number(sub)]);
}
function definition(id){return byId.get(typeof id==='string'?id:id?.id);}
function value(s,id){const t=definition(id);return t?rawValue(s,t,ensure(s)):0;}
function status(s,id){const t=definition(id);if(!t)return null;const q=ensure(s),n=rawValue(s,t,q),claimed=q.claims.includes(t.id);return{...t,value:n,progress:Math.min(n,t.target),complete:n>=t.target,claimed,ready:!claimed&&n>=t.target};}
function list(s,category){const q=ensure(s);return definitions.filter(t=>!category||t.category===category).map(t=>{const n=rawValue(s,t,q),claimed=q.claims.includes(t.id);return{...t,value:n,progress:Math.min(n,t.target),complete:n>=t.target,claimed,ready:!claimed&&n>=t.target};});}
function observe(s,event){
 const r=s.run;if(!r||r.reason||!event||typeof event!=='object'||event.done||seenEvents.has(event))return false;
 seenEvents.add(event);ensure(s);const m=r.trophyStats||(r.trophyStats=blank(tacticKeys));
 const count=key=>{m[key]=cap(m[key]+1);};
 if(!event.enemyAttack&&event.kind!=='dot'){
  if(event.weak===true)count('weak');if(event.broken===true)count('breaks');if(event.critical===true)count('critical');if(event.kind==='skill')count('skills');
  // Each action counts once even when it heals several targets. Potion actions are excluded.
  if(event.kind==='guard'||event.title!=='灯の薬'&&event.numbers?.some(n=>n.unit!==undefined&&n.heal===true&&n.n>0))count('support');
 }
 // Weakness and break text alone is not a counter: an actual interruption or blocked heal is required.
 if(event.interrupted===true||event.counter==='回復を阻止'||event.enemyAttack&&['回復を阻止','燃焼で回復を阻止'].includes(event.title))count('stops');
 return true;
}
function record(s){
 const r=s.run;if(!r||!['won','defeat','retreat'].includes(r.reason)||r.trophyRecorded)return false;
 const migrating=!s.trophies,q=ensure(s);r.trophyRecorded=true;
 if(r.reason==='won'){
  if(r.trophyStats)for(const key of tacticKeys)q.stats[key]=cap(q.stats[key]+amount(r.trophyStats[key]));
  // A legacy result without a ledger is already included in the trustworthy source counters.
  if(!migrating)q.stats.wins=cap(q.stats.wins+1);
 }
 refresh(s,q);return r.reason==='won';
}
function credit(s,reward){
 for(const key of ['coin','dust','books'])if(reward[key])s.resources[key]=cap(s.resources[key]+reward[key]);
 if(reward.crystal){window.LanternJourney.ensure(s);s.journey.crystals.free=cap(s.journey.crystals.free+reward.crystal);}
}
function claim(s,id){const t=status(s,id);if(!t?.ready)return false;s.trophies.claims.push(t.id);credit(s,t.reward);return{...t.reward};}
function claimAll(s){const available=list(s).filter(t=>t.ready);if(!available.length)return false;const rewards={};for(const t of available){s.trophies.claims.push(t.id);for(const [key,n]of Object.entries(t.reward))rewards[key]=(rewards[key]||0)+n;}credit(s,rewards);return{count:available.length,rewards};}
function ready(s){return list(s).filter(t=>t.ready).length;}
function summary(s){const rows=list(s);return{total:rows.length,completed:rows.filter(t=>t.complete).length,claimed:s.trophies.claims.length,ready:rows.filter(t=>t.ready).length};}
window.LanternTrophies=Object.freeze({categories,definitions,ensure,valid,validate:valid,list,value,status,observe,record,claim,claimAll,ready,summary});
})();
