// Build and serve first. Uses fresh browser contexts; never records or plays audible speech.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.LEARNING_BASE_URL || 'http://127.0.0.1:4173';
const engine = process.env.LEARNING_BROWSER || 'chromium';
const out = process.env.LEARNING_EVIDENCE_DIR || fileURLToPath(new URL('../learning-browser-evidence/', import.meta.url));
const paths = ['/learning/', '/korean/', '/wahran/'];
const report = { startedAt: new Date().toISOString(), browser: engine, baseURL: base, http: [], cases: [], screenshots: [], limitations: ['No audible playback or accent assessment', 'No microphone permission or recording test', 'Korean system voice availability and real iPhone audio are not verified', 'An HTTP success or indexable page does not prove search-engine indexing'] };
mkdirSync(out, { recursive: true });
let browser;
const url = path => new URL(path, base).href;
async function navigate(page, path) {
  const response = await page.goto(url(path), { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${path}: document HTTP status`);
}
async function ready(page, path) {
  if (path === '/learning/') return;
  await page.locator('.bottom-nav button').first().waitFor();
  if (path === '/wahran/' && await page.locator('#dialog[open][data-mode="profile"]').count()) {
    await page.locator('[data-profile-role="speaker"][data-profile-gender="m"]').click();
    await page.locator('[data-profile-role="listener"][data-profile-gender="f"]').click();
    await page.locator('#profile-apply').click();
    await page.locator('#dialog[open]').waitFor({ state: 'hidden' });
  }
  await page.locator('#main .page-heading h2').waitFor();
  assert.ok((await page.locator('#main').innerText()).trim().length > 60, `${path}: app rendered`);
}
async function metadata(page, path) {
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://music-japan.com${path}`);
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  assert.match(robots, /(^|[\s,])index([\s,]|$)/); assert.match(robots, /(^|[\s,])follow([\s,]|$)/); assert.doesNotMatch(robots, /noindex|nofollow/i);
  assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 40);
  assert.equal(await page.locator('h1:visible').count(), 1, `${path}: one visible h1`);
  assert.ok(await page.locator('nav[aria-label*="パンくず"]').isVisible(), `${path}: visible breadcrumb`);
  const graph = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.flatMap(n => { const d = JSON.parse(n.textContent); return d['@graph'] || [d]; }));
  assert.ok(graph.some(n => n['@type'] === 'BreadcrumbList'), `${path}: valid breadcrumb JSON-LD`);
  assert.ok(graph.some(n => n['@id'] === `https://music-japan.com${path}#webpage`));
}
async function layout(page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(Math.max(dimensions.document, dimensions.body) <= dimensions.viewport + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
}
async function tabs(page) {
  for (const tab of ['learn', 'build', 'speak', 'words', 'culture']) {
    const button = page.locator(`.bottom-nav [data-tab="${tab}"]`); await button.click();
    assert.equal(await button.getAttribute('aria-current'), 'page'); await page.locator('#main .page-heading h2').waitFor(); await layout(page);
  }
}
async function search(page) {
  await page.locator('.bottom-nav [data-tab="words"]').click();
  const word = await page.evaluate(() => { const d = JSON.parse(document.querySelector('#course-data').textContent); return d.words.find(w => w.en.toLowerCase() === 'coffee') || d.words[0]; });
  await page.locator('#word-search').fill(word.ar);
  await page.locator(`#word-results [data-audio-id="${word.id}"]`).waitFor();
  assert.ok((await page.locator('#word-results .count').innerText()).match(/^[1-9]\d* /)); await layout(page);
}
async function korean(page) {
  for (const hint of ['kana', 'ipa']) { const b = page.locator(`[data-reading-toggle="${hint}"]`); assert.equal(await b.getAttribute('aria-pressed'), 'true'); await b.click(); assert.equal(await b.getAttribute('aria-pressed'), 'false'); }
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, '/korean/');
  for (const hint of ['kana', 'ipa']) { const b = page.locator(`[data-reading-toggle="${hint}"]`); assert.equal(await b.getAttribute('aria-pressed'), 'false'); assert.ok(await page.locator('html').evaluate((el, h) => el.classList.contains(`hide-${h}`), hint)); await b.click(); }
  await search(page); await page.locator('.bottom-nav [data-tab="speak"]').click();
  await page.locator('[data-dialogue="first-meeting"]').click();
  await page.locator('[data-conversation-reveal]').click(); assert.ok(await page.locator('.conversation-step .reading .ar').isVisible());
  await page.locator('[data-conversation-next]').click(); assert.match(await page.locator('.conversation-step .count').innerText(), /2\s*\/\s*10/);
  await page.locator('[data-conversation-mode="transcript"]').click(); assert.equal(await page.locator('[data-conversation-turn]').count(), 10);
  await page.locator('[data-conversation-role="B"]').click(); assert.equal(await page.locator('[data-conversation-role="B"]').getAttribute('aria-pressed'), 'true');
  await layout(page); await page.locator('#dialog [data-action="close-dialog"]').click();
}
async function wahran(page, context) {
  assert.match(await page.locator('#conversation-bar').innerText(), /Man.*Woman/i);
  await search(page); await page.locator('.bottom-nav [data-tab="learn"]').click(); await page.locator('[data-lesson="l01"]').first().click();
  const save = page.locator('#main [data-save]').first(); const id = await save.getAttribute('data-save');
  assert.equal(await save.getAttribute('aria-pressed'), 'false'); await save.click(); assert.equal(await save.getAttribute('aria-pressed'), 'true');
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, '/wahran/');
  await page.locator('[data-lesson="l01"]').first().click(); assert.equal(await page.locator(`#main [data-save="${id}"]`).getAttribute('aria-pressed'), 'true');
  const file = await page.evaluate(() => Object.values(window.WahranFiles.entries)[0]); assert.match(file, /^audio\/[a-f0-9]{24}\.mp3$/);
  const audioURL = new URL(file, url('/wahran/')).href; const response = await context.request.get(audioURL);
  const bytes = (await response.body()).length; assert.equal(response.status(), 200); assert.match(response.headers()['content-type'], /^audio\/(mpeg|mp3)(;|$)/i); assert.ok(bytes >= 1000);
  const duration = await page.evaluate(src => new Promise((resolve, reject) => {
    const audio = new Audio(); let settled = false;
    const finish = fn => { if (settled) return; settled = true; clearTimeout(timer); audio.onloadedmetadata = audio.ondurationchange = audio.onloadeddata = audio.oncanplay = audio.onerror = null; audio.removeAttribute('src'); audio.load(); fn(); };
    const timer = setTimeout(() => { const detail = `duration=${String(audio.duration)}, readyState=${audio.readyState}, networkState=${audio.networkState}`; finish(() => reject(new Error(`Audio duration did not become available (${detail})`))); }, 12000);
    const ready = () => { const duration = audio.duration; if (Number.isFinite(duration) && duration > 0) finish(() => resolve(duration)); };
    // WebKit can emit loadedmetadata with duration=0 before durationchange.
    audio.preload = 'auto'; audio.onloadedmetadata = audio.ondurationchange = audio.onloadeddata = audio.oncanplay = ready;
    audio.onerror = () => finish(() => reject(new Error('Audio metadata could not load'))); audio.src = src; audio.load();
  }), audioURL);
  assert.ok(Number.isFinite(duration) && duration > 0, `MP3 metadata duration must be finite and positive; received ${String(duration)}`); report.http.push({ url: audioURL, status: response.status(), contentType: response.headers()['content-type'], bytes, browserMetadataDuration: duration, playedAudibly: false });
}
async function courseLinks(page) {
  for (const path of ['/korean/', '/wahran/']) {
    await page.locator(`a.button[href="${path}"]`).first().click(); await page.waitForURL(u => u.pathname === path); await ready(page, path);
    await page.locator('.learning-breadcrumb a[href="/learning/"]').click(); await page.waitForURL(u => u.pathname === '/learning/');
    assert.ok(await page.locator('h1').isVisible());
  }
}
async function visit(path, width, javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 900 : 844 }, javaScriptEnabled, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const entry = { path, width, javaScriptEnabled, passed: [], pageErrors: [] }; report.cases.push(entry);
  page.on('pageerror', error => entry.pageErrors.push(error.message));
  page.on('response', response => { if (response.request().isNavigationRequest()) report.http.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'], xRobotsTag: response.headers()['x-robots-tag'] || null }); });
  const shot = async suffix => { const name = `${engine}-${path.split('/')[1]}-${width}${javaScriptEnabled ? '' : '-nojs'}${suffix}.png`; await page.screenshot({ path: join(out, name) }); report.screenshots.push(name); };
  try {
    await navigate(page, path); if (javaScriptEnabled) await ready(page, path); await metadata(page, path); await layout(page);
    entry.passed.push('HTTP 200; canonical; index/follow; description; single h1; breadcrumb; JSON-LD; viewport width');
    if (javaScriptEnabled && [390, 1280].includes(width)) await shot('');
    if (!javaScriptEnabled) {
      const intro = page.locator(path === '/learning/' ? 'main' : '.learning-intro'); assert.ok((await intro.innerText()).length > 30);
      const detail = page.locator('details').first(); await detail.locator('summary').click(); assert.ok(await detail.evaluate(el => el.open)); await layout(page);
      entry.passed.push('Static description and breadcrumb available; details opens with JavaScript disabled');
    } else if (path !== '/learning/') {
      await tabs(page); entry.passed.push('All five app tabs render without overflow');
      if (width === 390) { if (path === '/korean/') await korean(page); else await wahran(page, context); entry.passed.push(path === '/korean/' ? 'Kana/IPA independent toggles persist on reload; word search; 10-turn dialogue reveal/next/transcript/A-B role' : 'Fresh male-to-female profile; word search; saved phrase persists on reload; MP3 GET and silent browser metadata load'); }
    } else if (width === 390) { await courseLinks(page); entry.passed.push('Both primary course CTAs navigate; both app breadcrumbs return to hub'); }
    assert.deepEqual(entry.pageErrors, [], 'Uncaught browser page errors'); entry.passed.push('No uncaught browser page errors');
  } catch (error) { entry.error = error.stack || String(error); }
  finally { if (entry.error) { try { await shot('-failure'); } catch (error) { entry.screenshotError = String(error); } } await context.close(); }
}
try {
  assert.ok(['chromium', 'webkit'].includes(engine), 'LEARNING_BROWSER must be chromium or webkit');
  const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  report.browserVersion = browser.version();
  for (const width of [320, 390, 1280]) for (const path of paths) await visit(path, width);
  for (const path of paths) await visit(path, 390, false);
} catch (error) { report.error = error.stack || String(error); }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); report.ok = !report.error && report.cases.length === 12 && report.cases.every(c => !c.error);
  const file = join(out, `report-${engine}.json`); writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: report.ok, browser: engine, cases: report.cases.length, failures: report.cases.filter(c => c.error).map(c => ({ path: c.path, width: c.width, javaScriptEnabled: c.javaScriptEnabled, error: c.error.split('\n')[0] })), report: file }));
  if (!report.ok) process.exitCode = 1;
}
