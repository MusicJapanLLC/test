/* v13 independent ascension campaigns and character recruitment. */
(()=>{'use strict';const R=window.LanternRPG,X=window.LanternExpansion,J=window.LanternJourney;
const int=(v,m=999999)=>Number.isInteger(v)&&v>=0&&v<=m;
function ensure(s){
 while(s.heroes.length<R.chars.length)s.heroes.push({xp:0,rank:0,skills:{special:0,secondary:0,passive:0}});
 while(s.equipped.length<R.chars.length)s.equipped.push(Object.fromEntries(R.slots.map(k=>[k,null])));
 const x=X.ensure(s);while(x.equipped.length<R.chars.length)x.equipped.push(null);while(x.styles.length<R.chars.length)x.styles.push(0);
 if(!s.trials){s.trials={version:13,hard:0,expert:0,pity:0,rarePity:0,pulls:0,shards:0,gift:false,bonds:Array(R.chars.length).fill(0)};if(s.difficulty>0){s.difficulty=0;if(s.run&&!s.run.tower)s.run.difficulty=0;}}
 const t=s.trials;while(t.bonds.length<R.chars.length)t.bonds.push(0);if(t.ultraPity===undefined)t.ultraPity=0;if(t.heroGoal===undefined)t.heroGoal=null;return t;
}
function valid(s){const t=s.trials;return !!t&&t.version===13&&int(t.hard,21)&&int(t.expert,21)&&(!t.hard||s.next===21)&&(!t.expert||t.hard===21)&&['pulls','shards'].every(k=>int(t[k]))&&int(t.pity,29)&&int(t.rarePity,9)&&(t.ultraPity===undefined||int(t.ultraPity,99))&&(t.heroGoal===undefined||t.heroGoal===null||int(t.heroGoal,R.chars.length-1)&&t.heroGoal>=4)&&typeof t.gift==='boolean'&&Array.isArray(t.bonds)&&t.bonds.length===s.heroes.length&&t.bonds.every(x=>int(x,5))&&(s.heroes.length>=4&&s.heroes.length<=R.chars.length)&&(!s.unlocked.some(id=>id>=4)||s.next>=3)&&(!s.run||s.run.tower||s.run.difficulty===0||open(s,s.run.difficulty)&&s.run.stage<=progress(s,s.run.difficulty));}
function progress(s,d=s.difficulty){const t=ensure(s);return d===0?s.next:d===1?t.hard:t.expert;}
function open(s,d){return d===0||d===1&&s.next===21||d===2&&ensure(s).hard===21;}
function can(s,index,d=s.difficulty){return Number.isInteger(index)&&index>=0&&index<21&&open(s,d)&&index<=progress(s,d);}
function gift(s){const t=ensure(s);if(s.next<3||t.gift)return false;t.gift=true;X.ensure(s).tickets=Math.min(999999,s.expansion.tickets+10);return true;}
function summon(s,n,rng=Math.random){if(s.next<3||![1,10].includes(n))return false;const t=ensure(s),cost=X.summonCost(s,n);if(J.ensure(s).crystals.free<cost.crystal)return false;s.expansion.tickets-=cost.tickets;s.journey.crystals.free-=cost.crystal;const result=[];
 for(let i=0;i<n;i++){const p=rng(),rarity=t.ultraPity>=99||p<.01?3:t.pity>=29?2:p<.10?2:t.rarePity>=9?1:p<.40?1:0,pool=R.chars.slice(4).filter(c=>c.rarity===rarity),c=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))],duplicate=s.unlocked.includes(c.id),shards=duplicate?[4,12,40,100][rarity]:0;if(duplicate)t.shards=Math.min(999999,t.shards+shards);else R.recruit(s,c.id);t.ultraPity=rarity===3?0:t.ultraPity+1;t.pity=rarity>=2?0:t.pity+1;t.rarePity=rarity>=1?0:t.rarePity+1;t.pulls=Math.min(999999,t.pulls+1);result.push({...c,duplicate,shards});}return result;
}
function exchange(s,id){const t=ensure(s),c=R.chars[id],price=[24,72,200,500][c?.rarity];if(id<4||!c||s.next<3||s.unlocked.includes(id)||t.shards<price)return false;t.shards-=price;return R.recruit(s,id);}
function reserved(s){const t=ensure(s),c=R.chars[t.heroGoal];return c&&!s.unlocked.includes(c.id)?[24,72,200,500][c.rarity]:0;}
function bond(s,id){const t=ensure(s),lv=t.bonds[id],price=8*(lv+1);if(!s.unlocked.includes(id)||lv>=5||t.shards-reserved(s)<price)return false;t.shards-=price;t.bonds[id]++;return true;}
function afterAction(s,event){if(event.enemyAttack||event.kind==='burst'||event.kind==='dot')return;const r=s.run,p=r.party[event.unit],c=R.chars[p.id];if(!c.trait)return;const z=R.stats(s,p.id),target=r.enemies[event.targetEnemy],damaging=event.numbers.some(n=>n.enemy!==undefined&&!n.heal),hit=(e,i,n)=>{n=Math.min(e.hp,Math.max(1,Math.round(n)));e.hp-=n;if(n)event.numbers.push({enemy:i,n});},heal=(q,n)=>{const amount=Math.min(q.maxHp-q.hp,Math.round(n));q.hp+=amount;if(amount)event.numbers.push({unit:r.party.indexOf(q),n:amount,heal:true});};
 p.traitTurns=(p.traitTurns||0)+1;
 if(c.trait==='cleanse'){const weak=r.party.filter(q=>q.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];weak.poison=0;heal(weak,z.heal*.25);}
 if(c.trait==='haste')r.party.filter(q=>q.hp>0).forEach(q=>q.charge=Math.min(100,q.charge+5));
 if(c.trait==='bulwark')r.party.filter(q=>q.hp>0).forEach(q=>q.shield=Math.min(1000,q.shield+Math.round(z.def*.5)));
 if(c.trait==='remedy'&&p.traitTurns%3===0)for(const q of r.party)if(q.hp>0){q.poison=0;heal(q,z.heal*.5);}
 if(c.trait==='daybreak'&&event.kind==='skill')for(const q of r.party)if(q.hp>0)q.charge=Math.min(100,q.charge+10);
 if(c.trait==='oath'&&event.kind==='skill')for(const q of r.party)if(q.hp>0){q.shield=Math.min(1000,q.shield+Math.round(z.atk*.5));if(q.hp<q.maxHp*.5)heal(q,z.atk*.5);}
 if(damaging&&target){if(c.trait==='shatterer'&&target.ward){target.ward--;if(!target.ward){target.poise=2;event.broken=true;}}
 if(c.trait==='hunter'&&target.charge){hit(target,event.targetEnemy,z.atk*.4);p.charge=Math.min(100,p.charge+10);}
 if(c.trait==='disrupt'&&event.kind==='skill'){event.interrupted=target.charge>0;target.charge=0;target.chill=1;if(event.interrupted)event.counter='詠唱を封じた';}
 if(c.trait==='starlight'&&event.weak){const i=r.enemies.findIndex((e,i)=>e.hp>0&&i!==event.targetEnemy);if(i>=0)hit(r.enemies[i],i,z.atk*.5);}
event.element=event.element||c.element;if(c.trait==='burn')target.burn=2;if(c.trait==='chill'&&p.traitTurns%3===0)target.chill=1;if(c.trait==='execute'&&target.hp/target.maxHp<=.35)hit(target,event.targetEnemy,z.atk*.35);if(c.trait==='chain'){const i=r.enemies.findIndex((e,i)=>e.hp>0&&i!==event.targetEnemy);if(i>=0)hit(r.enemies[i],i,z.atk*.3);}if(c.trait==='pierce')hit(target,event.targetEnemy,z.atk*.2);if(c.trait==='drain')heal(p,event.numbers.filter(n=>n.enemy!==undefined&&!n.heal).reduce((v,n)=>v+n.n,0)*.12);if(c.trait==='nova'&&event.kind==='skill')r.enemies.forEach((e,i)=>{if(e.hp>0)hit(e,i,z.atk*.6);});}
}
function wave(s,r){for(const p of r.party)if(p.hp>0&&['guard','rampart'].includes(R.chars[p.id].trait)){const n=R.stats(s,p.id).def*2;for(const q of r.party)if(q.hp>0)q.shield=Math.min(1000,q.shield+n);if(R.chars[p.id].trait==='rampart')p.shield=Math.min(1000,p.shield+n);}for(const p of r.party)if(p.hp>0&&R.chars[p.id].trait==='daybreak')for(const q of r.party)if(q.hp>0)q.charge=Math.min(100,q.charge+20);}
function finish(s){const r=s.run,d=r.difficulty,t=ensure(s),key=d===1?'hard':'expert';if(d>0&&r.first)t[key]=Math.min(21,t[key]+1);if(r.first&&d>0){X.ensure(s).tickets=Math.min(999999,s.expansion.tickets+(r.stage%3===2?3:1));r.extraTickets=r.stage%3===2?3:1;}if(r.party.some(p=>R.chars[p.id].trait==='plunder')){const bonus=Math.round(r.reward.coin*.15);r.reward.coin+=bonus;s.resources.coin=Math.min(999999,s.resources.coin+bonus);}}
const modifiers=['堅牢：敵の防御を増加','呪毒：毒の牙を追加','魔唱：全体攻撃を追加'];
window.LanternTrials=Object.freeze({ensure,valid,progress,open,can,gift,summon,exchange,reserved,bond,afterAction,wave,finish,modifiers});})();
