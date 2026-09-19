import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityMonitor } from '../src/quality.js';

function deliver(monitor,from,duration,fps){
  const end=from+duration;
  for(let now=from;now<=end+.001;now+=1000/fps)monitor.tick(now);
}
test('healthy 60 fps does not lower quality',()=>{
  const steps=[],samples=[];const m=new QualityMonitor(s=>steps.push(s),s=>samples.push(s));
  deliver(m,0,12000,60);assert.deepEqual(steps,[]);assert.ok(samples.every(f=>f>=59&&f<=61));
});
test('two seconds below 45 fps lowers one stage, with all three stages in order',()=>{
  const steps=[];const m=new QualityMonitor(s=>steps.push(s));
  deliver(m,0,1975,40);assert.deepEqual(steps,[]);
  m.tick(2000);assert.deepEqual(steps,[1]);
  deliver(m,2025,2000,40);assert.deepEqual(steps,[1,2]);
  deliver(m,4050,2000,40);assert.deepEqual(steps,[1,2,3]);
  deliver(m,6075,6000,20);assert.deepEqual(steps,[1,2,3]);
});
test('brief dips and suspension do not trigger a downgrade',()=>{
  const steps=[];const m=new QualityMonitor(s=>steps.push(s));
  deliver(m,0,1000,30);m.reset();deliver(m,60000,4000,60);
  assert.deepEqual(steps,[]);
});
test('an interrupted bad window must restart after reset',()=>{
  const steps=[];const m=new QualityMonitor(s=>steps.push(s));
  deliver(m,0,1500,30);m.reset();deliver(m,30000,1500,30);assert.deepEqual(steps,[]);
  deliver(m,31500+1000/30,600,30);assert.deepEqual(steps,[1]);
});
