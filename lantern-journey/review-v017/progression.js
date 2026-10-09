/* Lantern Journey: companions, finds and the inhabited coast. Original rules. */
(()=>{'use strict';
const branches=[
 [{id:'counter',name:'返しの刃',desc:'灯力1 ／ 斬撃と全員への軽い護り',icon:'返'},{id:'rally',name:'灯の誓い',desc:'灯力2 ／ 全員を4回復・崩し+1',icon:'誓'}],
 [{id:'pierce',name:'双つ星',desc:'灯力2 ／ 強い貫通射撃・崩し+1',icon:'双'},{id:'snare',name:'風縛り',desc:'灯力2 ／ 崩し+3・次の攻撃に隙',icon:'縛'}],
 [{id:'renew',name:'星の雨',desc:'灯力3 ／ 全員を7回復・蘇生',icon:'雨'},{id:'brand',name:'導きの星',desc:'灯力2 ／ 灯の一撃・印を2つ',icon:'星'}]
];
const projects={
 inn:{name:'波待ちの宿',who:'宿守りのユナ',icon:'宿',cost:{coin:12,wood:2,stone:1},requires:null,desc:'森からユナを連れ戻し、宿の扉を開く',effect:'旅立ちの灯力が5に・苔むす旧道が開く',line:'三人の席、空けてあるよ　帰りはいつでもここへ'},
 smith:{name:'海風の工房',who:'鍛冶師ガラン',icon:'鍛',cost:{coin:20,wood:2,stone:2},requires:'inn',desc:'旧道の石を届け、ガランの炉を直す',effect:'道具の鍛錬が安くなる・帰還時に銅貨+3',line:'刃の欠け方を見れば、何を守ったか分かる'},
 dock:{name:'星渡りの桟橋',who:'舟守りセト',icon:'舟',cost:{coin:30,wood:3,stone:3},requires:'smith',desc:'桟橋をつなぎ、沖の封印へ渡る',effect:'新しい航路「星渡りの入江」が開く',line:'あの海に、まだ誰も聞いていない鐘がある'}
};
function empty(){return{xp:[0,0,0],bond:[0,0,0],branches:['counter','pierce','renew'],owned:['sword','bow','focus','coat','sprig','amber'],projects:{inn:false,smith:false,dock:false},clears:{forest:0,stone:0,trial:0,tide:0},history:[],unlocked:[],oldRoad:false}}
const number=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
function restore(v,equipment,legacy){const p=empty();if(legacy){p.oldRoad=true;p.owned=['sword','spear','staff','bow','longbow','focus','cedar','coat','mantle','amber','sprig'];p.xp=[0,1,2].map(()=>Math.min(1000000,Math.floor(legacy.wins)*3));p.clears.forest=legacy.wins;return p}
 if(!v||!Array.isArray(v.xp)||v.xp.length!==3||!v.xp.every(x=>number(x,1000000))||!Array.isArray(v.bond)||v.bond.length!==3||!v.bond.every(x=>number(x,100))||!Array.isArray(v.branches)||v.branches.length!==3||!v.branches.every((b,i)=>branches[i].some(x=>x.id===b))||!Array.isArray(v.owned)||!v.owned.every(k=>Object.hasOwn(equipment,k))||!v.projects||!Object.keys(projects).every(k=>typeof v.projects[k]==='boolean')||!v.clears||!['forest','stone','trial','tide'].every(k=>number(v.clears[k],1000000)))return null;
 if(v.projects.smith&&!v.projects.inn||v.projects.dock&&!v.projects.smith||v.projects.inn&&!v.clears.forest||v.projects.smith&&!v.clears.stone)return null;
 Object.assign(p,{xp:v.xp.slice(),bond:v.bond.slice(),branches:v.branches.slice(),owned:[...new Set([...p.owned,...v.owned])],projects:{...v.projects},clears:{...v.clears},oldRoad:v.oldRoad===true});
 p.history=Array.isArray(v.history)?v.history.filter(h=>h&&typeof h.text==='string'&&h.text.length<=200&&number(h.time,1e15)).slice(-12).map(h=>({text:h.text,time:h.time})):[];
 return p;
}
function level(x){return x>=12?4:x>=6?3:x>=3?2:1}
function goal(s){const p=s.progress;if(!p.clears.forest)return{title:'森から、宿守りを連れ戻す',sub:'風見の林道の三つの試練を越える',action:'routes'};
 for(const id of Object.keys(projects)){if(p.projects[id])continue;const b=projects[id];if(id==='smith'&&!p.clears.stone)return{title:'炉に使う、護石を探す',sub:'苔むす旧道を最後まで歩く',action:'routes'};return{title:b.name+'に灯を戻す',sub:'銅貨'+b.cost.coin+'・木材'+b.cost.wood+'・石材'+b.cost.stone,action:'village'};}
 if(!p.clears.tide)return{title:'舟守りと、沖の封印へ',sub:'星渡りの入江で、海の守り手に会う',action:'routes'};
 if(s.bell<3)return{title:'潮鐘を、海の向こうまで響かせる',sub:'鐘の修復 '+s.bell+'/3',action:'bell'};
 return{title:'三人の、次の旅を選ぶ',sub:'装備と技を変えて、別の連携を試す',action:'routes'};
}
function routeAvailable(s,id){return id==='forest'||id==='stone'&&(s.progress.projects.inn||s.progress.oldRoad)||id==='trial'&&s.bell===3||id==='tide'&&s.progress.projects.dock}
function award(s,r,equipment,names){const p=s.progress;r.find=null;r.returnEvents=[];p.clears[r.route]++;for(let i=0;i<3;i++)p.bond[i]=Math.min(100,p.bond[i]+1);
 const pools={forest:['spear','longbow','cedar','mantle','staff'],stone:['saltblade','reefcharm','tidalbow','mantle','staff'],trial:['saltblade','tidalbow','moonstaff','reefcharm'],tide:['moonstaff','saltblade','tidalbow','reefcharm']};
 const pool=pools[r.route].filter(id=>!p.owned.includes(id));if(pool.length){const id=pool[Math.floor(Math.random()*pool.length)];p.owned.push(id);r.find=id;r.returnEvents.push('《'+equipment[id].name+'》を持ち帰った')}else{s.resources.coin=Math.min(999999,s.resources.coin+6);r.reward.coin+=6;r.returnEvents.push('余った戦利品を銅貨6に換えた')}
 if(r.route==='forest'&&p.clears.forest===1)r.returnEvents.push('宿守りのユナと、里へ帰る約束をした');
 if(r.route==='stone'&&p.clears.stone===1)r.returnEvents.push('鍛冶師ガランの護石を見つけた');
 if(r.route==='tide'&&p.clears.tide===1)r.returnEvents.push('海の封印がほどけた　セトの舟が沖へ出られる');
 if(p.projects.smith){s.resources.coin=Math.min(999999,s.resources.coin+3);r.reward.coin+=3;r.returnEvents.push('ガランが戦利品を手入れした　銅貨+3')}
 const metrics=r.metrics||{damage:[0,0,0],combos:0,heals:0,breaks:0};let mvp=metrics.damage.indexOf(Math.max(...metrics.damage));
 const text=metrics.combos?names[mvp]+'たちが灯剣連携を'+metrics.combos+'回つないだ':metrics.heals?names[2]+'の癒しが、帰り道の三人を支えた':names[mvp]+'が先頭に立ち、三人で道を開いた';
 r.memory=text;p.history.push({text:r.route==='tide'?'入江の封印を越えた — '+text:text,time:Date.now()});p.history=p.history.slice(-12);
}
window.LanternProgress=Object.freeze({branches,projects,empty,restore,level,goal,routeAvailable,award});
})();
