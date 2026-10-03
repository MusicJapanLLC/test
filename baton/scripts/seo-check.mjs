import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseHTML } from 'linkedom';

const root = join(process.cwd(), 'dist');
const xml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
const pages = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.html')) pages.push(file);
  }
}
walk(root);
const indexable = [];
const incoming = new Map();
for (const file of pages) {
  const path = '/' + relative(root, file).replaceAll('\\', '/').replace(/index\.html$/, '');
  const { document } = parseHTML(readFileSync(file, 'utf8'));
  for (const a of document.querySelectorAll('a[href]')) {
    const target = new URL(a.getAttribute('href'), 'https://baton.music-japan.com' + path);
    if (target.hostname === 'baton.music-japan.com' && target.pathname !== path) incoming.set(target.pathname, true);
  }
  const noindex = document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex');
  if (noindex) {
    assert.ok(!urls.some(u => new URL(u).pathname === path), `Noindex page in sitemap: ${path}`);
    continue;
  }
  const canonical = document.querySelectorAll('link[rel="canonical"]');
  assert.equal(canonical.length, 1, `Missing canonical: ${path}`);
  const url = canonical[0].getAttribute('href');
  // The existing home page intentionally presents the Kabeya profile.
  if (path === '/') {
    assert.equal(url, 'https://baton.music-japan.com/profile/kabeya/');
    assert.ok(!urls.includes('https://baton.music-japan.com/'));
    continue;
  }
  assert.equal(new URL(url).pathname, path, `Canonical mismatch: ${path}`);
  assert.ok(urls.includes(url), `Page missing from sitemap: ${path}`);
  assert.equal(document.querySelectorAll('h1').length, 1, `Missing H1: ${path}`);
  assert.ok(document.querySelector('title')?.textContent, `Missing title: ${path}`);
  assert.ok(document.querySelector('meta[name="description"]')?.getAttribute('content'), `Missing description: ${path}`);
  assert.ok(document.querySelector('main')?.textContent.trim().length > 100, `Empty static body: ${path}`);
  const schemas = document.querySelectorAll('script[type="application/ld+json"]');
  assert.ok(schemas.length, `Missing structured data: ${path}`);
  for (const schema of schemas) JSON.parse(schema.textContent);
  indexable.push(url);
}
assert.deepEqual(indexable.sort(), urls.sort(), 'Sitemap differs from indexable generated pages');
for (const url of indexable) assert.ok(incoming.has(new URL(url).pathname), `Orphan page: ${url}`);
assert.ok(readFileSync(join(root, '404.html'), 'utf8').includes('noindex'), 'A real 404 page is required for Cloudflare Pages');
console.log(`SEO check: ${urls.length} indexable pages; static bodies, sitemap, canonical, schemas and incoming links OK`);
