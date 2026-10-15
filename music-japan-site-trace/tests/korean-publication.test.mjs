import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const publisher=new URL('../scripts/publish-korean.mjs',import.meta.url);
const sha='3ff48194aec4f932d964c7d17cb02e1236f3a8c0a17080dce581220840b4b2e0';
const baseline='/*\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n/wahran/*\n  ! Permissions-Policy\n';
async function fixture(fn){
  assert.ok(existsSync(publisher),'Korean production publisher must exist');
  const {publishKorean}=await import(publisher);
  const d=mkdtempSync(join(tmpdir(),'mj-korean-'));
  mkdirSync(join(d,'learning/korean'),{recursive:true});mkdirSync(join(d,'deploy-dist'),{recursive:true});
  writeFileSync(join(d,'learning/korean/index.html'),readFileSync(join(root,'learning/korean/index.html')));
  writeFileSync(join(d,'deploy-dist/_headers'),baseline);
  try{await fn(d,publishKorean);}finally{rmSync(d,{recursive:true,force:true});}
}
test('Korean bundle is published byte-for-byte',()=>fixture((d,publish)=>{
  publish(d);assert.equal(createHash('sha256').update(readFileSync(join(d,'deploy-dist/korean/index.html'))).digest('hex'),sha);
}));
test('Microphone exception is scoped and existing headers stay intact',()=>fixture((d,publish)=>{
  publish(d);const h=readFileSync(join(d,'deploy-dist/_headers'),'utf8');
  assert.ok(h.startsWith(baseline));assert.match(h,/\/korean\/\*\n  ! Permissions-Policy\n/);
  assert.match(h,/X-Robots-Tag: noindex, nofollow/);
}));
test('Publication is idempotent',()=>fixture((d,publish)=>{
  publish(d);const h=readFileSync(join(d,'deploy-dist/_headers'),'utf8');publish(d);
  assert.equal(readFileSync(join(d,'deploy-dist/_headers'),'utf8'),h);
}));
test('Altered source fails before publishing',()=>fixture((d,publish)=>{
  writeFileSync(join(d,'learning/korean/index.html'),'wrong bytes');assert.throws(()=>publish(d),/integrity/);
  assert.equal(existsSync(join(d,'deploy-dist/korean/index.html')),false);
  assert.equal(readFileSync(join(d,'deploy-dist/_headers'),'utf8'),baseline);
}));
test('Both site editions run Korean publication',()=>{
  const s=readFileSync(join(root,'scripts/build-deploy.mjs'),'utf8');
  assert.match(s,/publish-korean\.mjs/);assert.match(s,/publishKorean\(\)/);
});
