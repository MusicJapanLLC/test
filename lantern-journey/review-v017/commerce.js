/* Only a verified server response may unlock purchase benefits. */
(()=>{'use strict';
const catalog=[{id:'harbor-pass',name:'帰港祭プレミアムパス',yen:980,label:'買い切り',description:'航路パスの追加装飾6色を解放。取得済みの段階まで遡って使えます。期限・自動更新なし。',benefits:['ホームの灯彩 6色','仲間の肖像を彩るフレーム','進行に合わせて開く装飾レーン']},{id:'star-lantern',name:'星灯の祝祭',yen:480,label:'ホーム装飾',description:'ホームに星灯の祝祭演出を追加。いつでも設定を戻せます。',benefits:['星灯が舞うホーム演出','帰還時の祝祭エフェクト','戦力・召喚確率への影響なし']}];
let state={status:'loading',available:false,owned:[],error:null},pending=null;
async function request(path,body){const r=await fetch(new URL('api/commerce/'+path,document.baseURI),{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('購入情報を確認できません');const data=await r.json();return data;}
async function refresh(){if(pending)return pending;pending=(async()=>{try{const d=await request('status');state={status:'ready',available:d.available===true,test:d.test===true,owned:Array.isArray(d.owned)?d.owned.filter(id=>catalog.some(p=>p.id===id)):[],error:null};}catch{state={...state,status:'unavailable',available:false,error:'購入情報を確認できません'};}finally{pending=null;}return snapshot();})();return pending;}
function snapshot(){return {...state,owned:[...state.owned]};}
async function checkout(id){if(!catalog.some(p=>p.id===id))return false;await refresh();if(!state.available||state.owned.includes(id))return false;const d=await request('checkout',{product:id});const u=new URL(d.url);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com')throw Error('決済先を確認できません');window.location.assign(u.href);return true;}
function owns(id){return state.owned.includes(id);}
window.LanternCommerce=Object.freeze({catalog,snapshot,refresh,checkout,owns});})();
