import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const moduleURL = new URL('../scripts/publish-wahran.mjs', import.meta.url);
const source = readFileSync(new URL('../next/public/wahran/index.html', import.meta.url));
const originalHeaders='/*\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n';
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'wahran-publish-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'next/public/wahran'),{recursive:true});
  mkdirSync(join(root,'deploy-dist'),{recursive:true});
  writeFileSync(join(root,'next/public/wahran/index.html'),source);
  writeFileSync(join(root,'deploy-dist/_headers'),originalHeaders);
  writeFileSync(join(root,'deploy-dist/index.html'),'UNRELATED OFFICIAL SITE');
  return root;
}
async function installer() { assert.ok(existsSync(moduleURL),'Publication module has not been implemented'); return (await import(moduleURL)).publishWahran; }
test('publishes exact course and preserves official home page',async t=>{
  const root=fixture(t);(await installer())(root);
  assert.deepEqual(readFileSync(join(root,'deploy-dist/wahran/index.html')),source);
  assert.equal(readFileSync(join(root,'deploy-dist/index.html'),'utf8'),'UNRELATED OFFICIAL SITE');
});
test('microphone exemption is restricted to Wahran path',async t=>{
  const root=fixture(t);(await installer())(root);
  const headers=readFileSync(join(root,'deploy-dist/_headers'),'utf8');
  assert.ok(headers.startsWith(originalHeaders));
  assert.ok(headers.includes('/wahran/*\n  ! Permissions-Policy\n  X-Robots-Tag: noindex, nofollow'));
});
test('repeated publication does not duplicate header rules',async t=>{
  const root=fixture(t);const install=await installer();install(root);
  const once=readFileSync(join(root,'deploy-dist/_headers'),'utf8');install(root);
  assert.equal(readFileSync(join(root,'deploy-dist/_headers'),'utf8'),once);
});
test('corrupted course fails before publishing anything',async t=>{
  const root=fixture(t);writeFileSync(join(root,'next/public/wahran/index.html'),'incomplete');
  const install=await installer();assert.throws(()=>install(root),/integrity/);
  assert.equal(existsSync(join(root,'deploy-dist/wahran/index.html')),false);
  assert.equal(readFileSync(join(root,'deploy-dist/_headers'),'utf8'),originalHeaders);
});
