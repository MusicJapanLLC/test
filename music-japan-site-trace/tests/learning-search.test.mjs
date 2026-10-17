import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headerNoindex, audit } from '../scripts/seo-audit.mjs';
import { publishLearning, LEARNING_ROUTES } from '../scripts/publish-learning.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://music-japan.com';
const HEADERS = '/*\n  Permissions-Policy: camera=(), microphone=()\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex\n/private/*\n  X-Robots-Tag: noindex\n';
const app = route => `<!doctype html><html lang="ja"><head><title>${route} learning fixture</title><meta name="description" content="A public learning page with genuine practice material for visitors."><link rel="canonical" href="${SITE}${route}"><meta name="robots" content="index,follow"></head><body><h1>Learning</h1></body></html>`;
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'learning-search-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = join(dir, 'deploy-dist');
  for (const p of ['learning', 'deploy-dist/korean', 'deploy-dist/wahran', 'deploy-dist/og']) mkdirSync(join(dir, p), { recursive: true });
  writeFileSync(join(dir, 'learning/index.html'), app('/learning/'));
  for (const route of ['/korean/', '/wahran/']) writeFileSync(join(out, route, 'index.html'), app(route));
  writeFileSync(join(out, '_headers'), HEADERS);
  writeFileSync(join(out, 'og/ja-home.png'), 'existing artwork');
  writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc></url></urlset>`);
  for (const f of ['llms.txt', 'llms-full.txt']) writeFileSync(join(out, f), '# Existing company facts\n');
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  return { dir, out };
}

test('public learning routes and restricted preview/private routes retain distinct header policies', () => {
  for (const route of LEARNING_ROUTES) assert.equal(headerNoindex(HEADERS, SITE + route), false);
  for (const url of ['https://mj.pages.dev/korean/', 'https://abc.mj.pages.dev/wahran/', SITE + '/private/notes/']) assert.equal(headerNoindex(HEADERS, url), true);
  assert.equal(headerNoindex(HEADERS + '/wahran/*\n  X-Robots-Tag: noindex, nofollow\n', SITE + '/wahran/'), true);
});

test('publication advertises each canonical once and preserves existing company and header data', t => {
  const { dir, out } = fixture(t);
  publishLearning(dir);
  const files = ['learning/index.html', 'sitemap.xml', 'llms.txt', 'llms-full.txt', '_headers', '_redirects'];
  const first = files.map(f => readFileSync(join(out, f), 'utf8'));
  publishLearning(dir);
  assert.deepEqual(files.map(f => readFileSync(join(out, f), 'utf8')), first);
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes(`<loc>${SITE}/</loc>`));
  for (const route of LEARNING_ROUTES) assert.equal(sitemap.split(`<loc>${SITE}${route}</loc>`).length - 1, 1);
  assert.ok(readFileSync(join(out, '_headers'), 'utf8').startsWith(HEADERS));
  assert.ok(readFileSync(join(out, 'llms.txt'), 'utf8').startsWith('# Existing company facts'));
});

test('stale noindex prevents publication before output is changed', t => {
  const { dir, out } = fixture(t);
  writeFileSync(join(out, '_headers'), HEADERS + '/korean/*\n  X-Robots-Tag: noindex\n');
  const before = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.throws(() => publishLearning(dir), /still noindex/);
  assert.equal(readFileSync(join(out, 'sitemap.xml'), 'utf8'), before);
  assert.equal(existsSync(join(out, 'learning/index.html')), false);
});

test('wrong canonical cannot be disguised by another reference to the expected URL', t => {
  const { dir, out } = fixture(t);
  writeFileSync(join(out, 'korean/index.html'), app('/korean/').replace('rel="canonical"', 'rel="alternate"').replace('</head>', `<link rel="canonical" href="${SITE}/wahran/"></head>`));
  assert.throws(() => publishLearning(dir), /canonical/);
});

test('each learning source has truthful machine-readable and static page identity without fake alternates', () => {
  const sources = ['learning/index.html', 'learning/korean/index.html', 'next/public/wahran/index.html'];
  for (const [i, path] of sources.entries()) {
    const html = readFileSync(join(root, path), 'utf8');
    const staticHtml = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    assert.equal((staticHtml.match(/<h1\b/g) || []).length, 1, path);
    assert.match(html, new RegExp(`rel="canonical" href="${SITE}${LEARNING_ROUTES[i]}"`));
    assert.doesNotMatch(html.slice(0, html.indexOf('</head>')), /noindex|hreflang=|aggregateRating|"review"/);
    const graph = JSON.parse(html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])['@graph'];
    const breadcrumb = graph.find(node => node['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement.at(-1).item, SITE + LEARNING_ROUTES[i]);
    assert.match(staticHtml, /<nav\b[^>]*class="[^"]*\b(?:crumbs|learning-breadcrumb)\b/);
  }
});

test('final audit detects HTTP noindex and ignores script template headings', t => {
  const { dir, out } = fixture(t);
  publishLearning(dir);
  const file = join(out, 'korean/index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('</body>', '<script>const template="<h1>runtime template</h1>";</script></body>'));
  let results = audit(out);
  assert.equal(results.errors.some(e => e.startsWith('/korean/:') && /hreflang|<h1>/.test(e)), false);
  writeFileSync(join(out, '_headers'), HEADERS + '/korean/*\n  X-Robots-Tag: noindex\n');
  results = audit(out);
  assert.ok(results.errors.includes('/korean/: noindex page listed in sitemap'));
});
