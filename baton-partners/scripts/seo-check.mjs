// Check the generated HTML rather than a second, manually maintained URL list.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';

const root = join(process.cwd(), 'dist');
const xml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];
const urls = entries.map((m) => m[1]);
assert.equal(urls.length, (xml.match(/<loc>/g) || []).length, 'Every sitemap URL needs a lastmod');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
for (const [, url, date] of entries) {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `Invalid lastmod: ${url}`);
  assert.equal(new Date(date).toISOString().slice(0, 10), date, `Invalid calendar date: ${url}`);
  assert.ok(date <= new Date().toISOString().slice(0, 10), `Future lastmod: ${url}`);
}
const pages = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (item.name.endsWith('.html')) pages.push(file);
  }
}
walk(root);
const indexable = [];
const links = new Set();
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) links.add(href.split('#')[0]);
  const path = '/' + relative(root, file).replaceAll('\\', '/').replace(/index\.html$/, '');
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  if (/name="robots"[^>]*content="[^"]*noindex/i.test(html)) {
    assert.ok(!urls.some((u) => new URL(u).pathname === path), `Noindex page in sitemap: ${path}`);
    continue;
  }
  assert.equal(canonical.length, 1, `Expected one canonical: ${path}`);
  assert.equal(new URL(canonical[0]).pathname, path, `Canonical path mismatch: ${path}`);
  assert.ok(urls.includes(canonical[0]), `Missing sitemap URL: ${path}`);
  assert.match(html, /<title>[^<]+<\/title>/, `Missing title: ${path}`);
  assert.match(html, /name="description" content="[^"]+"/, `Missing description: ${path}`);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `Expected one H1: ${path}`);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.ok(schemas.length, `Missing structured data: ${path}`);
  if (path.split('/').filter(Boolean).length >= 1 && !['/privacy/', '/editorial/'].includes(path)) {
    assert.ok(schemas.some((s) => s['@graph']?.some((n) => ['Organization', 'Corporation'].includes(n['@type']))), `Missing company data: ${path}`);
  }
  indexable.push(canonical[0]);
}
assert.deepEqual([...urls].sort(), [...indexable].sort(), 'Sitemap must equal indexable generated pages');
for (const url of indexable) {
  const path = new URL(url).pathname;
  if (path !== '/') assert.ok(links.has(path) || links.has(url), `Orphan page: ${path}`);
}
console.log(`SEO check: ${indexable.length} indexable pages; sitemap, lastmod, canonical, metadata, schemas and links OK`);
