/* Pure, exact-state growth plans. One review, one atomic commit. */
(()=>{'use strict';const R=window.LanternRPG,X=window.LanternExpansion,T=window.LanternTrials;
const categories={equip:'最強装備',gear:'装備強化',skills:'スキル',rank:'覚醒',sigils:'紋章',bonds:'絆',tonic:'回復薬'};
function plan(s,choice){const kinds=Array.isArray(choice)?Object.keys(categories).filter(k=>choice.includes(k)):[choice],next=R.copy(s),events=[],before=s.unlocked.map(id=>({id,stats:R.stats(s,id)}));T.ensure(next);
 function change(category,id,key,label,old,value){if(old===value)return;const event=events.find(e=>e.category===category&&e.id===id&&e.key===key);if(event)event.after=value;else events.push({category,id,key,label,before:old,after:value});}
 if(kinds.includes('equip')){next.equipped=R.recommend(next);for(const id of s.party)for(const slot of R.slots){const old=s.equipped[id][slot],key=next.equipped[id][slot];if(old!==key)change('equip',id,slot,R.slotNames[slot],s.gear.find(x=>x.id===old)?R.gearName(s.gear.find(x=>x.id===old)):'未装備',next.gear.find(x=>x.id===key)?R.gearName(next.gear.find(x=>x.id===key)):'未装備');}}
 // One level per pass keeps a four-person party from giving every resource to its first hero.
 for(let round=0;round<5;round++){
  for(const id of s.party){
   if(kinds.includes('skills'))for(const key of ['passive','special','secondary']){const old=next.heroes[id].skills[key];if(R.grow(next,id,key))change('skills',id,key,R.chars[id][key],old,next.heroes[id].skills[key]);}
   if(kinds.includes('rank')){const old=next.heroes[id].rank;if(R.grow(next,id,'rank'))change('rank',id,'rank','覚醒',old,next.heroes[id].rank);}
   if(kinds.includes('gear'))for(const slot of R.slots){const x=next.gear.find(g=>g.id===next.equipped[id][slot]);if(x){const old=x.rank;if(R.upgrade(next,x.id))change('gear',id,x.id,R.slotNames[slot]+'：'+R.gearName(s.gear.find(g=>g.id===x.id)),old,x.rank);}}
   if(kinds.includes('sigils')){const key=next.expansion.equipped[id];if(key!==null&&key!==undefined){const old=next.expansion.levels[key];if(X.upgrade(next,key))change('sigils',id,key,X.sigils[key].name,old,next.expansion.levels[key]);}}
   if(kinds.includes('bonds')){const old=next.trials.bonds[id];if(T.bond(next,id))change('bonds',id,'bonds','絆',old,next.trials.bonds[id]);}
  }
  if(kinds.includes('tonic')){const old=next.tonic.level,c={coin:15*(old+1),dust:3*(old+1)};if(old<5&&next.resources.coin>=c.coin&&next.resources.dust>=c.dust){next.resources.coin-=c.coin;next.resources.dust-=c.dust;next.tonic.level++;change('tonic',s.party[0],'tonic','回復薬（全員共通）',old,old+1);}}
 }
 return {kind:Array.isArray(choice)?'all':choice,kinds,fingerprint:JSON.stringify(s),next,events,before,after:next.unlocked.map(id=>({id,stats:R.stats(next,id)})),powerBefore:R.total(s),powerAfter:R.total(next),spent:{...Object.fromEntries(Object.keys(s.resources).map(k=>[k,s.resources[k]-next.resources[k]])),sigilShards:(s.expansion?.shards||0)-next.expansion.shards,bondShards:(s.trials?.shards||0)-next.trials.shards}};
}
function commit(s,p){if(!p.events.length||JSON.stringify(s)!==p.fingerprint)return false;return R.copy(p.next);}
window.LanternWorkshop=Object.freeze({categories,plan,commit});})();
