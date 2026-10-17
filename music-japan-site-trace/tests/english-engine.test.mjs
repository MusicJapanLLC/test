import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const E=require('../learning/english/engine.cjs');
const entries=[{id:'one',kind:'chunk',category:'business',level:'B2',en:'What I have in mind',ja:'考えていること',explanation:'提案を具体的にする',examples:[{en:'What I have in mind is a short trial.'}]},{id:'two',kind:'vocabulary',category:'travel',level:'B1+',en:'declare',ja:'申告する',explanation:'税関で申告する',examples:[{en:'I have some food to declare.'}]}];
test('a saved English review keeps due times and grades independently',()=>{
 const state=E.emptyState(); const now=1792227600000;
 const next=E.grade(state,'one','good',now);
 assert.equal(Object.keys(state.reviews).length,0);
 assert.equal(next.reviews.one.due,now+86400000);
 assert.equal(E.due(entries,next,now).length,0);
 assert.equal(E.due(entries,next,now+86400000)[0].id,'one');
 const again=E.grade(next,'one','again',now+86400000);
 assert.equal(again.reviews.one.due,now+86400000+600000);
 assert.equal(again.reviews.one.streak,0);
 assert.equal(again.reviews.one.attempts,2);
});
test('restore rejects malformed and foreign progress without importing arbitrary keys',()=>{
 assert.throws(()=>E.restore({version:9},entries),/version/i);
 assert.throws(()=>E.restore({app:'mj-english',version:1,saved:'wrong'},entries),/saved/i);
 const result=E.restore({app:'mj-english',version:1,saved:['one','other','one'],reviews:{one:{due:0,streak:2,attempts:3,last:0},other:{due:2}},settings:{ipa:false,speed:99},history:{}},entries);
 assert.deepEqual(result.saved,['one']); assert.equal(result.settings.ipa,false);assert.equal(result.settings.speed,1);
 assert.deepEqual(Object.keys(result.reviews),['one']);
});
test('search covers headwords, Japanese explanations and longer examples together',()=>{
 assert.equal(E.filter(entries,{query:'short trial'})[0].id,'one');
 assert.equal(E.filter(entries,{query:'税関'})[0].id,'two');
 assert.equal(E.filter(entries,{category:'business',kind:'vocabulary'}).length,0);
 assert.equal(E.filter(entries,{level:'B2'}).length,1);
});
test('chunk assembly identifies repeated chunks by position, not just text',()=>{
 assert.equal(E.orderMatches([0,1,2],3),true);
 assert.equal(E.orderMatches([0,0,2],3),false);
 assert.equal(E.orderMatches([2,1,0],3),false);
 assert.equal(E.orderMatches([0,1],3),false);
});
test('normalization recognizes punctuation and contractions without accepting unrelated answers',()=>{
 assert.equal(E.sameAnswer(' I’M   open to it! ',"I'm open to it."),true);
 assert.equal(E.sameAnswer('I refuse it',"I'm open to it."),false);
});
test('study queue puts due reviews first and has no duplicates or unseen review-only entries',()=>{
 const state=E.emptyState();state.reviews.one={due:0,attempts:1,streak:0,last:0};
 assert.deepEqual(E.queue(entries,state,{reviewOnly:true,now:100}).map(x=>x.id),['one']);
 assert.deepEqual(E.queue(entries,state,{now:100}).map(x=>x.id),['one','two']);
});

test('English backup identity rejects foreign or empty replacements',()=>{
 assert.throws(()=>E.restore({version:1,saved:[],reviews:{},history:{},settings:{}},entries),/English/);
 assert.throws(()=>E.restore({app:'korean',version:1,saved:[],reviews:{},history:{},settings:{}},entries),/English/);
 assert.throws(()=>E.restore({app:'mj-english',version:1},entries),/structure/);
});
