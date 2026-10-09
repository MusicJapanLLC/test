/* 灯霊の加護 — optional support slots; never replaces or consumes recruited allies. */
(()=>{'use strict';
const R=window.LanternRPG,MAX=999999,thresholds=Object.freeze([0,1,3,6,10]);
const elements=Object.freeze({fire:'焔',frost:'霜',gale:'風',storm:'雷',tide:'潮',light:'光'});
const effects={fire:'追撃し、敵に燃焼を2回与える',frost:'追撃し、敵の次の攻撃を弱め、自分に護りを張る',gale:'生存している敵全体へ追撃する',storm:'敵の防御を無視した強い追撃を放つ',tide:'追撃し、最も傷ついた生存中の仲間を回復する',light:'追撃し、生存中の仲間全員に護りを張る'};
const catalog=Object.freeze([
 {key:'elphina',name:'エルフィナ',element:'gale',race:'エルフ',age:126,title:'翠風の花守',bio:'森の灯を育てるエルフ。失われた道に花を咲かせ、旅人の帰りを待つ。'},
 {key:'brigid',name:'ブリジット',element:'fire',race:'ドワーフ',age:32,title:'熾火の鍛冶姫',bio:'灯台の炉を直すドワーフ職人。小柄な体に大きな金槌を担ぎ、誰より温かな火を守る。'},
 {key:'selene',name:'セレーネ',element:'frost',race:'月巫女',age:27,title:'月霜の祈り手',bio:'氷湖に映る月を見守る巫女。静かな祈りで、帰れなかった人の想いをほどく。'},
 {key:'nagisa',name:'ナギサ',element:'tide',race:'海民',age:25,title:'真珠の潮歌',bio:'珊瑚の島々を巡る海民。海の記憶を歌にして、離れた故郷へ届ける。'},
 {key:'tsubaki',name:'ツバキ',element:'storm',race:'狐人',age:29,title:'紫電の灯導',bio:'嵐の峠で灯籠を掲げる狐人。いたずら好きだが、迷った旅人だけは決して見捨てない。'},
 {key:'aurora',name:'アウロラ',element:'light',race:'有翼人',age:28,title:'暁翼の鐘守',bio:'空の鐘楼から降りた有翼人。七つの灯がもう一度つながる日を、人々とともに迎えたい。'}
].map(c=>Object.freeze({...c,rarity:'SSR',rarityIndex:2,adult:true,source:'spirit',probability:1/6,description:effects[c.element]})));
const int=(v,max=MAX)=>Number.isInteger(v)&&v>=0&&v<=max;
function seed(){return{version:1,spirits:{},equipped:[null,null,null,null],pulls:0};}
function ensure(s){if(s.guardians===undefined)s.guardians=seed();return s.guardians;}
function get(key){const native=catalog.find(c=>c.key===key);if(native)return native;if(typeof key!=='string'||!/^ally:[1-9]\d*$/.test(key))return null;const id=Number(key.slice(5)),c=R.chars[id];if(!c||id<4)return null;return{key,name:c.name,element:c.element,rarity:['R','SR','SSR','UR'][c.rarity]||'R',rarityIndex:c.rarity||0,race:'旅の仲間',bio:c.bio,title:c.job,source:'ally',heroId:id,description:effects[c.element]};}
function own(s,key){const c=get(key);return !!c&&(c.source==='ally'?s.unlocked?.includes(c.heroId):Object.prototype.hasOwnProperty.call(s.guardians?.spirits||{},key));}
function valid(raw,s){if(raw===undefined)return true;if(!raw||raw.version!==1||!int(raw.pulls)||!raw.spirits||typeof raw.spirits!=='object'||Array.isArray(raw.spirits)||!Array.isArray(raw.equipped)||raw.equipped.length!==4)return false;
 if(Object.entries(raw.spirits).some(([key,value])=>!catalog.some(c=>c.key===key)||!value||!int(value.xp,10)))return false;
 const occupied=raw.equipped.filter(v=>v!==null);if(new Set(occupied).size!==occupied.length)return false;
 return raw.equipped.every((key,id)=>{if(key===null)return true;const c=get(key);if(!c||s&&!s.unlocked?.includes(id))return false;return c.source==='spirit'?Object.prototype.hasOwnProperty.call(raw.spirits,key):!s||s.unlocked?.includes(c.heroId);});}
function validate(s){return valid(s.guardians,s);}
function deployed(s,id){return s.party?.includes(id)||s.scene==='battle'&&!s.run?.reason&&s.run?.party?.some(p=>p.id===id);}
function level(s,key){const c=get(key);if(!c||!own(s,key))return 0;if(c.source==='ally')return Math.min(5,1+(s.trials?.bonds?.[c.heroId]||0));const xp=s.guardians.spirits[key].xp;return thresholds.filter(n=>xp>=n).length;}
function detail(s,key){const c=get(key);if(!c||!own(s,key))return null;const lv=level(s,key),xp=c.source==='spirit'?s.guardians.spirits[key].xp:null,host=s.guardians?.equipped?.indexOf(key)??-1;
 return{...c,level:lv,xp,nextXp:c.source==='spirit'&&lv<5?thresholds[lv]:null,equippedTo:host>=0?host:null,available:c.source!=='ally'||!deployed(s,c.heroId),description:effects[c.element]};}
function owned(s){ensure(s);return[...catalog.filter(c=>own(s,c.key)).map(c=>detail(s,c.key)),...(s.unlocked||[]).filter(id=>id>=4&&R.chars[id]).map(id=>detail(s,'ally:'+id))];}
function equipped(s,heroId){if(!int(heroId,3))return null;const key=s.guardians?.equipped?.[heroId];return key?detail(s,key):null;}
function equip(s,heroId,key){if(!int(heroId,3)||!s.unlocked?.includes(heroId))return false;const g=ensure(s);if(!valid(g,s))return false;if(key===null){g.equipped[heroId]=null;return true;}const c=detail(s,key);if(!c||!c.available||g.equipped.some((v,i)=>v===key&&i!==heroId))return false;g.equipped[heroId]=key;return true;}
function bonus(s,heroId){const c=equipped(s,heroId),z={hp:0,atk:0,def:0,heal:0};if(!c||!c.available||!s.unlocked?.includes(heroId))return z;z.hp=8+c.level*4;if(['fire','gale','storm'].includes(c.element))z.atk=1+c.level;if(['frost','light'].includes(c.element))z.def=1+c.level;if(c.element==='tide')z.heal=2+c.level*2;return z;}
function cost(s,n){if(![1,10].includes(n))return false;const available=s.expansion?.tickets||0,free=s.journey?.crystals?.free||0;if(!int(available)||!int(free))return false;const tickets=Math.min(available,n),crystal=(n-tickets)*10;return{tickets,crystal,affordable:free>=crystal};}
function summon(s,n,rng=Math.random){const c=cost(s,n);if(!c||!c.affordable||!validate(s)||!int(s.resources?.dust)||typeof rng!=='function')return false;
 // Draw before charging: malformed random sources cannot partially spend a ten-pull.
 const draws=[];try{for(let i=0;i<n;i++){const r=rng();if(!Number.isFinite(r)||r<0||r>=1)return false;draws.push(catalog[Math.floor(r*catalog.length)]);}}catch{return false;}
 const g=ensure(s);if(c.tickets)s.expansion.tickets-=c.tickets;if(c.crystal)s.journey.crystals.free-=c.crystal;const results=[];
 for(const item of draws){const entry=g.spirits[item.key],duplicate=!!entry,before=duplicate?level(s,item.key):0;let resonance=0,dust=0;
  if(!duplicate)g.spirits[item.key]={xp:0};else if(entry.xp<10){entry.xp++;resonance=1;}else{dust=Math.min(20,MAX-s.resources.dust);s.resources.dust+=dust;}
  g.pulls=Math.min(MAX,g.pulls+1);results.push({...detail(s,item.key),duplicate,beforeLevel:before,resonance,dust,compensation:{resonance,dust}});
 }return results;}
const seen=new WeakSet();
function modify(s,event){const r=s.run;if(!r||r.reason||!event||event.done||event.enemyAttack||['dot','burst','heal','guard'].includes(event.kind)||seen.has(event)||!Array.isArray(event.numbers)||!event.numbers.some(n=>n.enemy!==undefined&&!n.heal&&n.n>0))return false;
 const p=r.party?.[event.unit];if(!p||p.hp<=0)return false;const c=equipped(s,p.id);if(!c?.available)return false;seen.add(event);p.guardianTurns=((p.guardianTurns||0)+1)%4;if(p.guardianTurns!==0&&event.kind!=='skill')return false;
 let index=event.targetEnemy;if(!r.enemies[index]||r.enemies[index].hp<=0)index=r.enemies.findIndex(e=>e.hp>0);if(index<0)return false;
 const z=R.stats(s,p.id),target=r.enemies[index],scale=.28+c.level*.055,base=Math.max(1,Math.round(z.atk*scale));
 const info={key:c.key,name:c.name,element:c.element,level:c.level,targetEnemy:index,shields:[],hits:[],heals:[]};
 const hit=(enemy,i,multiplier=1)=>{if(enemy.hp<=0)return;const weak=enemy.weak===c.element,amount=Math.min(enemy.hp,Math.max(1,Math.round(base*multiplier*(weak?1.4:1))));enemy.hp-=amount;event.numbers.push({enemy:i,n:amount,guardian:true,followup:true});info.hits.push({enemy:i,n:amount});if(weak)event.weak=true;};
 const shield=(q)=>{if(q.hp<=0)return;const amount=Math.min(1000-(q.shield||0),Math.max(1,Math.round(base*.7)));q.shield=(q.shield||0)+amount;if(amount)info.shields.push({unit:r.party.indexOf(q),n:amount});};
 if(c.element==='gale')r.enemies.forEach((enemy,i)=>hit(enemy,i,.8));else hit(target,index,c.element==='storm'?1.5:1);
 if(c.element==='fire'&&target.hp>0)target.burn=Math.max(target.burn||0,2);
 if(c.element==='frost'){if(target.hp>0)target.chill=1;shield(p);}
 if(c.element==='light')r.party.forEach(shield);
 if(c.element==='tide'){const q=r.party.filter(a=>a.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(q){const n=Math.min(q.maxHp-q.hp,Math.max(1,Math.round(base+z.heal*.4)));q.hp+=n;if(n){const value={unit:r.party.indexOf(q),n,heal:true,guardian:true};event.numbers.push(value);info.heals.push(value);}}}
 event.guardian=info;event.killed=!!r.enemies[event.targetEnemy]&&r.enemies[event.targetEnemy].hp<=0;event.title=(event.title||R.chars[p.id].name+'の攻撃')+' · '+c.name+'の加護';return event;
}
window.LanternGuardians=Object.freeze({catalog,elements,thresholds,ensure,valid,validate,get,owned,equipped,equip,bonus,cost,summon,modify,level});
})();
