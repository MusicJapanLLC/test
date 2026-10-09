/* Guaranteed upgrades and protected dismantling; all costs are visible. */
(()=>{'use strict';
function empty(){return{dust:0,tonicLevel:0,tonicCount:3};}
function restore(v){if(!v)return empty();if(!['dust','tonicLevel','tonicCount'].every(k=>Number.isInteger(v[k]))||v.dust<0||v.dust>999999||v.tonicLevel<0||v.tonicLevel>5||v.tonicCount<0||v.tonicCount>99)return null;return{dust:v.dust,tonicLevel:v.tonicLevel,tonicCount:v.tonicCount};}
function cost(x){const n=(x.level||0)+1;return{coin:4*n,dust:n};}
function value(x){return 1+x.rarity*2+(x.level||0);}
function protectedItem(s,id){return s.loot.equipped.some(l=>Object.values(l).includes(id))||s.loot.bag.find(x=>x.id===id)?.locked;}
function upgrade(s,id){const x=s.loot.bag.find(x=>x.id===id);if(!x||(x.level||0)>=5)return false;const c=cost(x);if(s.resources.coin<c.coin||s.forge.dust<c.dust)return false;s.resources.coin-=c.coin;s.forge.dust-=c.dust;x.level=(x.level||0)+1;return true;}
function dismantle(s,ids){if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return false;const items=ids.map(id=>s.loot.bag.find(x=>x.id===id));if(items.some(x=>!x||protectedItem(s,x.id)))return false;const dust=items.reduce((n,x)=>n+value(x),0);s.loot.bag=s.loot.bag.filter(x=>!ids.includes(x.id));s.forge.dust=Math.min(999999,s.forge.dust+dust);return dust;}
function tonicCost(s){return{coin:8*(s.forge.tonicLevel+1),dust:2*(s.forge.tonicLevel+1)};}
function improveTonic(s){const c=tonicCost(s);if(s.forge.tonicLevel>=5||s.resources.coin<c.coin||s.forge.dust<c.dust)return false;s.resources.coin-=c.coin;s.forge.dust-=c.dust;s.forge.tonicLevel++;return true;}
function brew(s){if(s.resources.coin<3||s.forge.tonicCount>96)return false;s.resources.coin-=3;s.forge.tonicCount+=3;return true;}
function healAmount(s){return 12+s.forge.tonicLevel*4;}
function useTonic(s){const r=s.run;if(!r||s.forge.tonicCount<1||r.tonicsUsed>=2)return false;const alive=r.party.filter(p=>p.joined&&p.hp>0);if(!alive.some(p=>p.hp<p.maxHp*.45))return false;s.forge.tonicCount--;r.tonicsUsed++;const healed=[];r.party.forEach((p,i)=>{if(p.joined&&p.hp>0){const old=p.hp;p.hp=Math.min(p.maxHp,p.hp+healAmount(s));healed.push({unit:i,amount:p.hp-old});}});return healed;}
window.LanternForge=Object.freeze({empty,restore,cost,value,protectedItem,upgrade,dismantle,tonicCost,improveTonic,brew,healAmount,useTonic});
})();
