import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { syncPartners, validate } from '../scripts/sync-partners.mjs';

const snapshotPath = fileURLToPath(new URL('../next/src/content/partners.json', import.meta.url));
const publicDir = fileURLToPath(new URL('../next/public', import.meta.url));
const snapshot = () => JSON.parse(readFileSync(snapshotPath, 'utf8'));

test('the committed copy passes the feed checks and every logo is on disk', () => {
  const feed = validate(snapshot());
  assert.ok(feed.partners.length >= 6);
  for (const p of [feed.operator, ...feed.partners]) {
    for (const l of p.logos) assert.ok(existsSync(publicDir + new URL(l.src).pathname), `${l.src} missing in next/public`);
  }
});

test('values that would land in HTML attributes or styles are rejected', () => {
  const bad = (mutate) => {
    const feed = snapshot();
    mutate(feed);
    return () => validate(feed);
  };
  assert.throws(bad((f) => (f.partners[0].colors[0] = 'red;background:url(x)')), /colors/);
  assert.throws(bad((f) => (f.partners[0].href = 'https://example.com/')), /href/);
  assert.throws(bad((f) => (f.partners[0].id = 'a" onmouseover="x')), /id/);
  assert.throws(bad((f) => (f.partners[0].logos[0].src = 'https://example.com/partners/x/logo.png')), /logos/);
  assert.throws(bad((f) => (f.partners[0].no = 'BP-1')), /no/);
  assert.throws(bad((f) => delete f.partners[0].name.en), /name/);
  assert.throws(bad((f) => (f.preview = true)), /preview/);
  assert.throws(bad((f) => (f.partners = [])), /no partners/);
  assert.throws(bad((f) => f.partners.push(f.partners[0])), /duplicate/);
});

test('a failed fetch keeps the committed copy instead of breaking the build', async () => {
  const before = readFileSync(snapshotPath, 'utf8');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 503 });
  try {
    await syncPartners();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(readFileSync(snapshotPath, 'utf8'), before);
});

test('an unchanged feed leaves the copy and the logos as they are', async () => {
  const before = readFileSync(snapshotPath, 'utf8');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    if (u.pathname === '/partners.json') return new Response(before, { headers: { 'content-type': 'application/json' } });
    return new Response(readFileSync(publicDir + u.pathname), { headers: { 'content-type': 'image/png' } });
  };
  try {
    await syncPartners();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(readFileSync(snapshotPath, 'utf8'), before);
});
