import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Q=require('../learning/english/arcade.cjs');
const E=require('../learning/english/engine.cjs');
const units=[...JSON.parse(readFileSync(new URL('../learning/english/units.json',import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL('../learning/english/expansion.json',import.meta.url),'utf8'))];
const predictable=()=>.3;
test('all 264 lessons produce four different playable prompt types, based on authored examples',()=>{
 assert.equal(units.length,264);
 for(const u of units){
  for(const mode of ['words','chunks','meaning','listen']){
   const q=Q.build(u,units,mode,predictable);
   assert.equal(q.mode,mode);
   assert.ok(q.options.length>q.answer.length, u.id+': distractors missing');
   for(const part of q.answer) assert.ok(q.options.includes(part),u.id+': answer unavailable '+part);
   assert.equal(Q.correct(q,q.answer),true,u.id+': correct answer rejected');
   assert.equal(Q.correct(q,q.answer.slice(0,-1)),false,u.id+': incomplete accepted');
   const wrong=q.mode==='meaning'||q.mode==='listen'?[q.options.find(x=>x!==q.answer[0])]:[...q.answer.slice(0,-1),'wrong option'];
   assert.equal(Q.correct(q,wrong),false,u.id+': wrong answer accepted');
   if(mode==='words')assert.ok(q.answer.length>=1&&q.answer.length<=u.examples[0].en.split(/\s+/).length);
   if(['meaning','listen'].includes(mode))assert.equal(new Set(q.options).size,4,'no duplicate options');
  }
 }
});
test('repeated visible words may be selected in any tile order when the printed answer is identical',()=>{
 const u=structuredClone(units[0]);u.examples[0].chunks=[{en:'I know that',ja:'知っている'},{en:'that matters to people.',ja:'それが大切'}];
 const q=Q.build(u,units,'words',predictable);
 assert.equal(q.answer.filter(w=>w.toLowerCase().replace(/[^a-z]/g,'')==='that').length,2);
 assert.equal(Q.correct(q,q.answer),true);
});
test('game scoring is independent, persists via existing English backup and safely bounds imported values',()=>{
 const original=E.emptyState(); assert.equal(original.settings.effects,false);
 const after=Q.score(original.game,true);assert.equal(after.xp,15);assert.equal(after.streak,1);
 const hinted=Q.score(after,true,true);assert.equal(hinted.xp,23);assert.equal(hinted.best,2);
 const wrong=Q.score(hinted,false);assert.equal(wrong.streak,0);assert.equal(wrong.answered,3);
 const raw={...original,game:wrong,settings:{...original.settings,effects:true}};
 const restored=E.restore(JSON.parse(JSON.stringify(raw)),units);
 assert.deepEqual(restored.game,wrong);assert.equal(restored.settings.effects,true);
 const forged=E.restore({...raw,game:{xp:-4,streak:Infinity,best:2,answered:1,correct:200}},units);
 assert.equal(forged.game.xp,0);assert.equal(forged.game.streak,0);assert.equal(forged.game.correct,1);
});
test('arcade builder never prints source contact lists or arbitrary learner data',()=>{
 for(const u of units){const q=Q.build(u,units,'meaning',predictable);assert.equal(q.options.length,4)}
});
