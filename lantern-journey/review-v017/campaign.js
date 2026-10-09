/* Five authored quests. Recruitment is a consequence of an actual clear. */
(()=>{'use strict';
const quests=[
 {id:0,chapter:'01',name:'ふたり、灯を持って',place:'里の外れ',route:'forest',node:0,hp:100,damage:5,heavy:8,enemy:'霧に迷う角獣',text:'帰らない宿守りを探す。アレンとミナ、二人で踏み出す最初の一歩。',reward:'剣と弓 ／ 灯晶4' ,join:2,dialogue:'firstTrail'},
 {id:1,chapter:'02',name:'弓手と、帰り道',place:'風見の林道',route:'forest',node:1,hp:160,damage:6,heavy:9,enemy:'林道の護森獣',text:'ミナの矢で守り手の隙を作り、森の奥へ。',reward:'強化素材 ／ 装備1個',join:2,dialogue:'trail'},
 {id:2,chapter:'03',name:'灯をつなぐ見習い',place:'森の祠',route:'forest',node:2,hp:205,damage:7,heavy:10,enemy:'深森の主・オルン',text:'ユナと、彼女を守る鐘守りの見習いを救い出す。',reward:'ユナ帰還 ／ 波待ちの宿',join:2,dialogue:'rescueYuna'},
 {id:3,chapter:'04',name:'炉に眠る歌',place:'苔むす旧道',route:'stone',node:2,hp:225,damage:8,heavy:11,enemy:'護石の主・ガルム',text:'鐘守りの見習いを探し、炉の奥の守り手と向き合う。',reward:'リオ加入 ／ 海風の工房',join:3,dialogue:'joinRio'},
 {id:4,chapter:'05',name:'帰る場所の鐘',place:'星渡りの入江',route:'tide',node:2,hp:325,damage:10,heavy:14,enemy:'封印守・アステル',text:'全員の灯で海の封印を越え、里の朝を取り戻す。',reward:'第一章完結 ／ 周回解放',join:3,dialogue:'chapterEnd'}
];
function empty(){return{next:0,roster:2,cleared:[],training:0,mastery:[0,0,0,0,0],rioEarly:false};}
function restore(v,legacy=false,old=false){if(!v)return legacy?{...empty(),next:3,roster:3,cleared:[0,1,2],rioEarly:true}:null;
 if(!Number.isInteger(v.next)||v.next<0||v.next>5||!Number.isInteger(v.training)||v.training<0||v.training>20||!Array.isArray(v.cleared)||v.cleared.length!==v.next||v.cleared.some((x,i)=>x!==i))return null;
 const r=JSON.parse(JSON.stringify(v));if(old){r.rioEarly=v.next===3&&v.roster===3;r.roster=v.next<4&&!r.rioEarly?2:3;r.mastery=Array.from({length:5},(_,i)=>i<v.next?1:0);}
 if(typeof r.rioEarly!=='boolean'||r.rioEarly&&r.next<3||r.roster!==(r.next<4&&!(r.rioEarly&&r.next===3)?2:3)||!Array.isArray(r.mastery)||r.mastery.length!==5||r.mastery.some((x,i)=>!Number.isInteger(x)||x<0||x>3||i>=r.next&&x!==0||i<r.next&&x===0))return null;return r;}
window.LanternCampaign=Object.freeze({quests,empty,restore,get:id=>quests[id]});
})();
