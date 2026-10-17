/* Authored-examples-first arcade question builder: shared by browser and Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishArcade=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const distractorWords=['actually','although','almost','instead','already','could','would','might','should','rather','before','after','unless','because','perhaps','quite','without','during','really','usually','still','more','another','different','someone','anything','somewhere','every','both','neither','probably','eventually','especially','somehow','clearly','honestly','possibly'];
 const words=text=>String(text).trim().split(/\s+/u).filter(Boolean);
 const unique=list=>[...new Set(list.filter(Boolean))];
 function sample(values,n,random=Math.random){const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy.slice(0,n);}
 function build(unit,all,mode='words',random=Math.random){
  if(!unit?.examples?.[0]?.chunks?.length)throw new Error('Missing authored examples');
  const x=unit.examples[0];
  if(mode==='words'){
   const prefix=[];let length=0;
   for(const c of x.chunks){prefix.push(c);length+=words(c.en).length;if(length>=10||prefix.length>=3)break;}
   const correct=words(prefix.map(c=>c.en).join(' '));
   const existing=new Set(correct.map(w=>w.toLocaleLowerCase('en-US').replace(/[^\p{L}]/gu,'')));
   const decoys=sample(distractorWords.filter(w=>!existing.has(w)),Math.min(4,Math.max(2,Math.round(correct.length/4))),random);
   return {mode,answer:correct,options:sample([...correct,...decoys],correct.length+decoys.length,random),
    prompt:prefix.map(c=>c.ja).join(' ／ '), instruction:'単語をタップして、英文の前半を完成させよう',full:x.en};
  }
  if(mode==='chunks'){
   const correct=x.chunks.map(c=>c.en);
   const foreign=unique(all.filter(v=>v.id!==unit.id&&v.category===unit.category)
    .flatMap(v=>v.examples?.[0]?.chunks?.map(c=>c.en)||[])
    .filter(c=>!correct.includes(c)&&Math.abs(words(c).length-4)<=3));
   const backup=unique(all.filter(v=>v.id!==unit.id).flatMap(v=>v.examples?.[0]?.chunks?.map(c=>c.en)||[]).filter(c=>!correct.includes(c)));
   const decoys=sample(foreign.length>=2?foreign:backup,2,random);
   return {mode,answer:correct,options:sample([...correct,...decoys],correct.length+decoys.length,random),
    prompt:x.ja,instruction:'意味のまとまりを正しい順番に並べよう',full:x.en};
  }
  if(mode==='meaning'){
   const group=all.filter(v=>v.id!==unit.id&&v.category===unit.category&&v.kind===unit.kind&&v.ja!==unit.ja);
   const fallback=all.filter(v=>v.id!==unit.id&&v.ja!==unit.ja);
   const possibilities=unique([...sample(group,8,random).map(v=>v.ja),...sample(fallback,6,random).map(v=>v.ja)]);
   const distractors=possibilities.filter(text=>text!==unit.ja).slice(0,3);
   if(distractors.length<3)throw new Error('Not enough unique choices');
   return {mode,answer:[unit.ja],options:sample([unit.ja,...distractors],4,random),
    prompt:unit.en,instruction:'この英語に最も近い日本語の意味は？',full:x.en};
  }
  if(mode==='listen'){
   const correct=unit.en;
   const others=unique(all.filter(v=>v.id!==unit.id&&v.category===unit.category&&v.kind===unit.kind)
    .map(v=>v.en).filter(s=>s!==correct));
   const backup=unique(all.filter(v=>v.id!==unit.id&&v.en!==correct).map(v=>v.en));
   const distractors=sample(others.length>=3?others:backup,3,random);
   return {mode,answer:[correct],options:sample([correct,...distractors],4,random),
    prompt:'',instruction:'音声を聞き、話された英語を選ぼう',full:correct};
  }
  throw new Error('Invalid game mode');
 }
 function correct(question,selection){
  if(!Array.isArray(selection))return false;
  if(!['words','chunks','meaning','listen'].includes(question.mode))return false;
  if(question.mode==='meaning'||question.mode==='listen')return selection.length===1&&selection[0]===question.answer[0];
  return selection.length===question.answer.length&&selection.every((part,i)=>part===question.answer[i]);
 }
 function points(result,hintUsed=false){return result?(hintUsed?8:15):0;}
 function score(game,isRight,hintUsed=false){
  const old=game&&typeof game==='object'?game:{};
  const streak=isRight?(Number.isInteger(old.streak)?old.streak:0)+1:0;
  return {xp:Math.max(0,Number(old.xp)||0)+points(isRight,hintUsed),streak,best:Math.max(Number(old.best)||0,streak),answered:Math.max(0,Number(old.answered)||0)+1,correct:Math.max(0,Number(old.correct)||0)+(isRight?1:0)};
 }
 return {words,sample,build,correct,points,score};
});
