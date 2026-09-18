import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleLoop } from '../src/webgl-runtime.js';

test('rAF is cancelled offscreen/hidden and never restarted after disposal',()=>{
  const saved={};
  const keys=['requestAnimationFrame','cancelAnimationFrame','document','IntersectionObserver','addEventListener','removeEventListener'];
  keys.forEach(k=>saved[k]=Object.getOwnPropertyDescriptor(globalThis,k));
  const events=new Map(),pending=new Map();let id=0,observer,draws=0,resets=0;
  try{
    globalThis.requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};
    globalThis.cancelAnimationFrame=n=>pending.delete(n);
    globalThis.document={hidden:false,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
    globalThis.addEventListener=(n,f)=>events.set(n,f);globalThis.removeEventListener=n=>events.delete(n);
    globalThis.IntersectionObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){}};
    const loop=visibleLoop({},()=>draws++,()=>resets++);
    assert.equal(pending.size,0);
    observer([{isIntersecting:true}]);assert.equal(pending.size,1);
    const [key,callback]=[...pending.entries()][0];pending.delete(key);callback(16);
    assert.equal(draws,1);assert.equal(pending.size,1);
    observer([{isIntersecting:false}]);assert.equal(pending.size,0);assert.ok(resets>0);
    observer([{isIntersecting:true}]);assert.equal(pending.size,1);
    document.hidden=true;events.get('visibilitychange')();assert.equal(pending.size,0);
    document.hidden=false;events.get('visibilitychange')();assert.equal(pending.size,1);
    loop.enable(false);assert.equal(pending.size,0);loop.enable(true);assert.equal(pending.size,1);
    loop.dispose();assert.equal(pending.size,0);loop.enable(true);assert.equal(pending.size,0);
    assert.equal(events.size,0);
  }finally{keys.forEach(k=>{if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];});}
});
