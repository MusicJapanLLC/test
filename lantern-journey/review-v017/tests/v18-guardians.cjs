'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..');
const box={window:{},Intl,Date,Math};vm.createContext(box);
for(const name of ['content','roster','rpg','narrative','journey','expansion','trials','rewards','combat','guardians'])vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),box);
const {LanternRPG:R,LanternJourney:J,LanternExpansion:X,LanternGuardians:G}=box.window;
function fresh(){const s=R.empty();J.ensure(s);X.ensure(s);G.ensure(s);return s;}
function event(){return{unit:0,actor:0,targetEnemy:0,kind:'slash',title:'アレンの攻撃',numbers:[{enemy:0,n:5}]};}
function combat(s){s.scene='battle';s.run={party:[{id:0,hp:60,maxHp:120,charge:0,shield:0},{id:1,hp:0,maxHp:100,shield:0}],enemies:[{hp:1000,maxHp:1000,weak:'fire',chill:0,burn:0},{hp:1000,maxHp:1000,weak:'gale'}]};return s;}
const s=fresh();assert.equal(G.catalog.length,6);assert.equal(new Set(G.catalog.map(c=>c.key)).size,6);assert(G.catalog.every(c=>c.adult&&c.age>=18&&c.rarity==='SSR'&&c.probability===1/6));
assert(G.validate(s));const legacy=R.copy(s);delete legacy.guardians;assert(G.validate(legacy));G.ensure(legacy);assert(G.validate(legacy));assert(R.validate(R.copy(s)));
const before=JSON.stringify(s);assert.equal(G.summon(s,1),false);assert.equal(JSON.stringify(s),before,'insufficient funds never change state');
assert.equal(G.cost(s,2),false);assert.equal(G.summon(s,0),false);s.journey.crystals.free=100;s.expansion.tickets=3;
assert.deepEqual(JSON.parse(JSON.stringify(G.cost(s,10))),{tickets:3,crystal:70,affordable:true});
const invalid=JSON.stringify(s);assert.equal(G.summon(s,10,()=>NaN),false);assert.equal(G.summon(s,1,()=>1),false);assert.equal(G.summon(s,1,()=>{throw Error('broken RNG');}),false);assert.equal(JSON.stringify(s),invalid);
const costGold=s.resources.coin,paid=s.journey.crystals.paid;const draws=G.summon(s,10,()=>0);assert.equal(draws.length,10);assert.equal(s.expansion.tickets,0);assert.equal(s.journey.crystals.free,30);assert.equal(s.resources.coin,costGold);assert.equal(s.journey.crystals.paid,paid);assert.equal(s.guardians.pulls,10);assert.equal(draws[0].duplicate,false);assert.equal(draws[1].resonance,1);assert.equal(G.level(s,'elphina'),4);
G.summon(s,1,()=>0);assert.equal(G.level(s,'elphina'),5);const dust=s.resources.dust;const maxed=G.summon(s,1,()=>0)[0];assert.equal(maxed.dust,20);assert.equal(maxed.resonance,0);assert.equal(s.resources.dust,dust+20);s.resources.dust=999994;const capped=G.summon(s,1,()=>0)[0];assert.equal(capped.dust,5);assert.equal(s.resources.dust,999999);assert(G.validate(JSON.parse(JSON.stringify(s))));assert(R.validate(R.copy(s)));
assert(G.equip(s,0,'elphina'));assert(G.bonus(s,0).atk>0);assert.equal(G.equip(s,1,'elphina'),false,'locked hero cannot equip');
s.next=3;s.clears[0]=s.clears[1]=s.clears[2]=1;R.recruit(s,1);assert.equal(G.equip(s,1,'elphina'),false,'support cannot occupy two slots');assert(G.equip(s,0,null));assert(G.equip(s,1,'elphina'));assert(G.equip(s,1,null));assert(G.equip(s,0,'elphina'));assert.equal(G.equip(s,0,'missing'),false);
const corrupt=R.copy(s);corrupt.guardians.equipped[1]='elphina';assert.equal(G.validate(corrupt),false);corrupt.guardians.equipped[1]=null;corrupt.guardians.spirits.elphina.xp=11;assert.equal(G.validate(corrupt),false);
// Recruited allies retain all their ownership, levels, equipment and roles.
R.recruit(s,4);const hero=JSON.stringify(s.heroes[4]),gear=JSON.stringify(s.equipped[4]);assert(G.equip(s,0,'ally:4'));assert(G.owned(s).some(c=>c.key==='ally:4'));assert(G.bonus(s,0).atk>0);s.party.push(4);assert.equal(G.bonus(s,0).atk,0);assert.equal(G.equipped(s,0).available,false);assert(G.validate(s),'changing party suppresses support instead of invalidating the save');s.party=s.party.filter(id=>id!==4);assert(G.bonus(s,0).atk>0);assert.equal(JSON.stringify(s.heroes[4]),hero);assert.equal(JSON.stringify(s.equipped[4]),gear);assert(s.unlocked.includes(4));assert.equal(G.equip(s,4,'elphina'),false);
// Four actions, per-event de-duplication, and partial progress survive JSON reload.
const f=combat(fresh());f.journey.crystals.free=60;G.summon(f,1,()=>0);assert(G.equip(f,0,'elphina'));
const first=event();assert.equal(G.modify(f,first),false);assert.equal(G.modify(f,first),false);assert.equal(f.run.party[0].guardianTurns,1);G.modify(f,event());const restored=R.copy(f);assert(G.validate(restored));assert.equal(G.modify(restored,event()),false);const fourth=event();assert(G.modify(restored,fourth));assert.equal(fourth.guardian.key,'elphina');assert.equal(fourth.guardian.hits.length,2);assert.equal(G.modify(restored,fourth),false);
for(const [i,c] of G.catalog.entries()){
 const state=combat(fresh());state.journey.crystals.free=10;G.summon(state,1,()=>(i+.1)/6);G.equip(state,0,c.key);const e=event();e.kind='skill';assert(G.modify(state,e),c.key);assert.equal(e.guardian.element,c.element);assert(e.numbers.some(n=>n.guardian&&n.n>0));assert.equal(state.run.party[1].hp,0,'no resurrection');
 if(c.element==='fire')assert.equal(state.run.enemies[0].burn,2);
 if(c.element==='frost'){assert.equal(state.run.enemies[0].chill,1);assert(state.run.party[0].shield>0);}
 if(c.element==='light')assert(state.run.party[0].shield>0);
 if(c.element==='tide')assert(state.run.party[0].hp>60);
 const old=JSON.stringify(state.run);state.run.reason='won';assert.equal(G.modify(state,event()),false);delete state.run.reason;assert.equal(JSON.stringify(state.run),old);assert.equal(G.modify(state,{...event(),enemyAttack:true}),false);assert.equal(G.modify(state,{done:'won'}),false);
}
const suppress=combat(s);suppress.guardians.equipped[0]='ally:4';suppress.run.party.push({id:4,hp:1,maxHp:1,shield:0});assert.equal(G.bonus(suppress,0).atk,0);assert.equal(G.modify(suppress,{...event(),kind:'skill'}),false);
const last=combat(fresh());last.journey.crystals.free=10;G.summon(last,1,()=>.55);G.equip(last,0,'nagisa');last.run.enemies[0].hp=1;const kill={...event(),kind:'skill'};assert(G.modify(last,kill));assert.equal(kill.killed,true);assert.equal(last.run.enemies[0].hp,0);
console.log('v18 guardians: PASS — migration, exact costs, atomic draws, resonance, compensation cap, ally preservation, slots, deployment suppression, reload, six combat effects');
