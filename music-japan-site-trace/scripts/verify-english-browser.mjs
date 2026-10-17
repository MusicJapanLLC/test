#!/usr/bin/env node
/**
 * Browser acceptance checks for the BUILT English app, served only on loopback.
 *
 * Prerequisites (GitHub Actions / Ubuntu):
 *   npm ci
 *   npm install --no-save --package-lock=false playwright
 *   npx playwright install --with-deps chromium webkit
 *   npm run build:deploy
 *   node scripts/verify-english-browser.mjs
 *
 * SPEECH IS A STUB. It tests utterance text, settings, sequencing and cancellation;
 * it makes no claim about actual sound, pronunciation quality or installed voices.
 * The app, curriculum, DOM, CSS, storage, File/Blob, downloads, clock and RNG are real.
 * No microphone API is stubbed, requested or granted permission.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import playwright from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'mj-english-progress-v1';
const DAY = 86_400_000;
const MOBILE = {width: 390, height: 844};
const DESKTOP = {width: 1365, height: 900};
const SPEECH_LABEL = 'STUB: speech lifecycle only; no real audio or pronunciation validation';
const FOREIGN_STORAGE = {
  'wahran-v1': '{"qaSentinel":"existing Arabic progress must be untouched"}',
  'wahran-korean-polite-v1': '{"qaSentinel":"existing Korean progress must be untouched"}',
  'wahran-korean-register': 'polite',
  'wahran-korean-reading-v1': '{"kana":false,"ipa":true}',
  'english-qa-unrelated': 'an unrelated origin-local value',
};

function argument(name, fallback) {
  const key = `--${name}`;
  const index = process.argv.indexOf(key);
  const inline = process.argv.find(value => value.startsWith(`${key}=`));
  if (inline) return inline.slice(key.length + 1);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value after ${key}`);
  return value;
}

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/verify-english-browser.mjs [--port 0] [--dist deploy-dist] [--out artifacts/english-browser] [--browsers chromium,webkit]');
  console.log('Environment equivalents: ENGLISH_QA_PORT, ENGLISH_QA_DIST, ENGLISH_QA_OUT, ENGLISH_QA_BROWSERS. Default port 0 picks a free loopback port.');
  console.log(SPEECH_LABEL);
  process.exit(0);
}

const PORT = Number(argument('port', process.env.ENGLISH_QA_PORT || '0'));
const DIST = resolve(ROOT, argument('dist', process.env.ENGLISH_QA_DIST || 'deploy-dist'));
const OUT = resolve(ROOT, argument('out', process.env.ENGLISH_QA_OUT || 'artifacts/english-browser'));
const ENGINES = argument('browsers', process.env.ENGLISH_QA_BROWSERS || 'chromium,webkit').split(',').map(x => x.trim());
assert.ok(Number.isInteger(PORT) && PORT >= 0 && PORT <= 65535, 'Port must be 0–65535');
assert.ok(ENGINES.length && ENGINES.every(x => ['chromium', 'webkit'].includes(x)), 'Supported engines: chromium,webkit');
assert.equal(new Set(ENGINES).size, ENGINES.length, 'Do not repeat engines');

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  target: 'loopback server serving the built deploy-dist; no production requests',
  requestedEngines: ENGINES,
  fullEngineMatrix: ENGINES.includes('chromium') && ENGINES.includes('webkit'),
  mobileViewport: MOBILE,
  desktopViewport: DESKTOP,
  speech: SPEECH_LABEL,
  fixtures: 'Only synthetic localStorage progress fixtures are seeded. No real learner records are read.',
  limitations: [
    'Linux Playwright WebKit is exercised; this is not an actual iPhone/Safari device run.',
    'Speech synthesis is explicitly stubbed. Audible output and OS voice installation need device listening checks.',
    'pagehide listener cancellation is dispatched as a lifecycle event; browser back/forward-cache behavior is not certified.',
    'Screenshot capture and layout assertions do not replace human visual review or assistive-technology testing.',
  ],
  engines: [],
  cases: [],
};

let origin;
let course;
let manifest;
let server;

const safeName = value => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const action = (page, name, more = '') => page.locator(`[data-action="${name}"]${more}`);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function poll(read, accepts, message, timeout = 7000) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (accepts(value)) return value;
    await pause(35);
  } while (Date.now() < end);
  assert.fail(`${message}; last value: ${JSON.stringify(value)}`);
}

async function textIs(locator, expected, message = `Expected text: ${expected}`) {
  await locator.waitFor({state: 'visible'});
  await poll(() => locator.innerText(), value => value.trim() === expected.trim(), message);
}

async function countIs(locator, expected, message = `Expected ${expected} matching elements`) {
  await poll(() => locator.count(), value => value === expected, message);
}

async function attributeIs(locator, name, value) {
  await poll(() => locator.getAttribute(name), actual => actual === value, `Expected ${name}=${value}`);
}

async function visible(locator, expected = true) {
  await locator.waitFor({state: expected ? 'visible' : 'hidden'});
}

async function loaded(page) {
  await page.waitForFunction(() => globalThis.ENGLISH_COURSE && globalThis.EnglishEngine && document.querySelector('#main h1'));
}

async function go(page, route = 'learn') {
  await page.goto(`${origin}/english/#${route}`, {waitUntil: 'domcontentloaded'});
  await loaded(page);
  await page.waitForURL(url => url.hash === `#${route}`);
}

async function openUnit(page, unit) {
  await go(page, `unit/${unit.id}`);
  await textIs(page.locator('.unit-head h1'), unit.en);
}

async function settings(page) {
  await action(page, 'settings').click();
  await visible(page.locator('#dialog'));
  await visible(page.locator('#setting-ipa'));
}

async function closeSettings(page) {
  await action(page, 'close-dialog').click();
  await visible(page.locator('#dialog'), false);
}

async function progress(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), KEY);
}

async function storage(page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
}

async function seedProgress(page, state) {
  // A documented test fixture changes timestamps without faking Date or calling app functions.
  await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify(state)), {key: KEY, state});
  await page.reload({waitUntil: 'domcontentloaded'});
  await loaded(page);
}

async function assertForeignStorage(page) {
  const current = await storage(page);
  for (const [key, value] of Object.entries(FOREIGN_STORAGE)) assert.equal(current[key], value, `Another app's storage changed: ${key}`);
}

async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const regions = ['#main', '#dialog[open]', '#dialog[open] #dialog-content'].flatMap(selector => {
      const node = document.querySelector(selector);
      return node && node.clientWidth ? [{selector, client: node.clientWidth, scroll: node.scrollWidth}] : [];
    });
    const offenders = Array.from(document.querySelectorAll('body *')).filter(node => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return box.width && box.height && style.display !== 'none' && style.visibility !== 'hidden' && (box.left < -2 || box.right > width + 2);
    }).slice(0, 12).map(node => ({tag: node.tagName, id: node.id, className: typeof node.className === 'string' ? node.className : '', text: (node.textContent || '').slice(0, 90)}));
    return {width, documentWidth, regions, offenders};
  });
  assert.ok(result.documentWidth <= result.width + 2, `${label}: horizontal document overflow ${JSON.stringify(result)}`);
  assert.ok(result.regions.every(region => region.scroll <= region.client + 2), `${label}: content-region overflow ${JSON.stringify(result)}`);
}

async function screenshot(page, engine, size, name, fullPage = true) {
  await assertNoOverflow(page, `${engine}/${size}/${name}`);
  const path = join(OUT, `${engine}-${size}-${name}.png`);
  await page.screenshot({path, fullPage, animations: 'disabled'});
  return relative(OUT, path);
}

function installSpeechStub({unsupported}) {
  // THE ONLY API STUB IN THIS SUITE. It intentionally produces no real sound.
  const label = 'STUB: speech synthesis lifecycle, not audible-output validation';
  const log = [];
  const utterances = [];
  const listeners = new Map();
  let current = null;
  const voices = [
    {name: 'QA STUB American voice', voiceURI: 'qa-stub-en-US', lang: 'en-US', localService: true, default: true},
    {name: 'QA STUB British voice', voiceURI: 'qa-stub-en-GB', lang: 'en-GB', localService: true, default: false},
    {name: 'QA STUB Australian voice', voiceURI: 'qa-stub-en-AU', lang: 'en-AU', localService: true, default: false},
    {name: 'QA STUB Japanese voice (must be filtered out)', voiceURI: 'qa-stub-ja-JP', lang: 'ja-JP', localService: true, default: false},
  ];
  class Utterance {
    constructor(text = '') { this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; }
  }
  const synth = {
    getVoices() { return voices; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    speak(utterance) {
      log.push({op: 'speak', text: utterance.text, lang: utterance.lang, rate: utterance.rate, voiceURI: utterance.voice?.voiceURI || '', overlapped: current !== null});
      utterances.push(utterance);
      current = utterance;
    },
    cancel() { log.push({op: 'cancel', active: current !== null, text: current?.text || ''}); current = null; },
    get speaking() { return current !== null; },
    get pending() { return false; },
    get paused() { return false; },
  };
  Object.defineProperty(globalThis, 'speechSynthesis', {configurable: true, value: unsupported ? undefined : synth});
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {configurable: true, value: unsupported ? undefined : Utterance});
  globalThis.__englishQaSpeech = {
    label,
    snapshot() { return {label, unsupported, active: current !== null, text: current?.text || '', log: log.slice(), utteranceCount: utterances.length}; },
    finish() {
      const utterance = current;
      if (!utterance) throw new Error('Speech STUB has no active utterance to finish');
      current = null;
      log.push({op: 'end', text: utterance.text});
      utterance.onend?.({type: 'end'});
    },
    lateEnd(index) {
      const utterance = utterances[index];
      if (!utterance) throw new Error('Speech STUB lateEnd index is missing');
      log.push({op: 'late-end', text: utterance.text});
      utterance.onend?.({type: 'end'});
    },
    fail(error) {
      const utterance = current;
      if (!utterance) throw new Error('Speech STUB has no active utterance to fail');
      current = null;
      log.push({op: 'error', error});
      utterance.onerror?.({error});
    },
    voicesChanged() { for (const listener of listeners.get('voiceschanged') || []) listener({type: 'voiceschanged'}); },
  };
}

const speech = page => page.evaluate(() => globalThis.__englishQaSpeech.snapshot());
const speakEvents = snapshot => snapshot.log.filter(event => event.op === 'speak');
const cancelCount = snapshot => snapshot.log.filter(event => event.op === 'cancel').length;

async function waitStopped(page) {
  await poll(() => speech(page), value => !value.active, 'Speech STUB should have no active utterance');
  await visible(page.locator('#audio-bar'), false);
}

async function runCase(browser, engine, name, body, {size = 'mobile', unsupported = false, javascript = true} = {}) {
  const started = Date.now();
  const record = {engine, name, viewport: size, speech: javascript ? (unsupported ? 'STUB: API unavailable' : SPEECH_LABEL) : 'JavaScript disabled', status: 'running', diagnostics: []};
  report.cases.push(record);
  const context = await browser.newContext({
    viewport: size === 'mobile' ? MOBILE : DESKTOP,
    deviceScaleFactor: 1,
    isMobile: size === 'mobile',
    hasTouch: size === 'mobile',
    locale: 'ja-JP',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    javaScriptEnabled: javascript,
    acceptDownloads: true,
    permissions: [],
    serviceWorkers: 'block',
    storageState: {cookies: [], origins: [{origin, localStorage: Object.entries(FOREIGN_STORAGE).map(([name, value]) => ({name, value}))}]},
  });
  if (javascript) await context.addInitScript(installSpeechStub, {unsupported});
  await context.tracing.start({screenshots: true, snapshots: true, sources: false});
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(15000);
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') record.diagnostics.push({type: `console-${message.type()}`, message: message.text(), location: message.location()});
  });
  page.on('pageerror', error => record.diagnostics.push({type: 'pageerror', message: error.stack || error.message}));
  page.on('response', response => {
    if (response.status() >= 400) record.diagnostics.push({type: 'http', status: response.status(), url: response.url()});
  });
  page.on('requestfailed', request => {
    const message = request.failure()?.errorText || 'request failed';
    // Explicit navigations may legitimately abort an in-flight icon request; retain it as a diagnostic.
    record.diagnostics.push({type: /abort|cancel/i.test(message) ? 'request-cancelled' : 'requestfailed', message, url: request.url()});
  });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) record.diagnostics.push({type: 'unexpected-external-request', url: request.url()});
  });
  try {
    await body(page, record);
    if (javascript && page.url().startsWith(origin)) await assertForeignStorage(page);
    const failures = record.diagnostics.filter(item => !['console-warning', 'request-cancelled'].includes(item.type));
    assert.deepEqual(failures, [], 'Browser console, runtime, network or external-request errors');
    record.status = 'passed';
    console.log(`PASS ${engine}/${size}: ${name}`);
    await context.tracing.stop();
  } catch (error) {
    record.status = 'failed';
    record.error = error.stack || String(error);
    record.url = page.url();
    const stem = `${engine}-${size}-${safeName(name)}`;
    try {
      await page.screenshot({path: join(OUT, `${stem}-failure.png`), fullPage: true, animations: 'disabled'});
      record.failureScreenshot = `${stem}-failure.png`;
    } catch (captureError) { record.screenshotError = String(captureError); }
    try {
      await context.tracing.stop({path: join(OUT, `${stem}-trace.zip`)});
      record.trace = `${stem}-trace.zip`;
    } catch (traceError) { record.traceError = String(traceError); }
    console.error(`FAIL ${engine}/${size}: ${name}\n${error.stack || error}`);
  } finally {
    record.durationMs = Date.now() - started;
    await context.close();
    await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  }
}

async function navRoutes(page) {
  await go(page);
  const routes = [
    ['library', '使える表現を増やす'],
    ['practice', '思い出す、組み立てる、聞く'],
    ['dialogues', '一言で終わらせない会話'],
    ['review', '思い出すたび、自分の言葉に'],
    ['learn', '言いたいことを、英語で最後まで'],
  ];
  for (const [route, heading] of routes) {
    const link = page.locator(`.bottom-nav a[data-tab="${route}"]`);
    await link.click();
    await textIs(page.locator('#main h1'), heading);
    await attributeIs(link, 'aria-current', 'page');
    await countIs(page.locator('.bottom-nav [aria-current="page"]'), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main', 'Route changes focus the main region');
    await assertNoOverflow(page, `tab ${route}`);
  }
  for (const category of course.categories) {
    await go(page, 'learn');
    await page.locator(`.topic-card[href="#topic/${category.id}"]`).click();
    await textIs(page.locator('#main h1'), category.title);
    await attributeIs(page.locator('.bottom-nav a[data-tab="library"]'), 'aria-current', 'page');
    await countIs(page.locator('.unit-tile'), course.units.filter(unit => unit.category === category.id).length);
    await assertNoOverflow(page, `topic ${category.id}`);
  }
  // Every published unit detail is rendered, including late entries that are behind pagination.
  for (const unit of course.units) {
    await openUnit(page, unit);
    await textIs(page.locator('.unit-head .ipa'), `/${unit.ipa}/`);
    await textIs(page.locator('.long-example .en'), unit.examples[0].en);
    await textIs(page.locator('.long-example .translation'), unit.examples[0].ja);
    await countIs(page.locator('.sentence-chunks button'), unit.examples[0].chunks.length);
    await assertNoOverflow(page, `unit ${unit.id}`);
  }
  for (const route of ['unknown-route', 'unit/missing', 'topic/missing', 'dialogue/missing']) {
    await go(page, route);
    await textIs(page.locator('#main h1'), '教材が見つかりません');
    await page.locator('#main a[href="#library"]').click();
    await textIs(page.locator('#main h1'), '使える表現を増やす');
  }
  // An expired in-memory session must recover to the real practice selector after reload.
  await go(page, 'session');
  await page.reload({waitUntil: 'domcontentloaded'});
  await textIs(page.locator('#main h1'), '思い出す、組み立てる、聞く');
  await countIs(page.locator('.mode-card'), 3);
}

async function searchAndFilters(page) {
  await go(page, 'library');
  await visible(page.locator('#unit-search'));
  const resultIds = () => page.locator('#library-output .unit-tile>a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href').split('/').at(-1)));
  async function expected(ids) {
    await poll(() => resultIds(), actual => JSON.stringify(actual) === JSON.stringify(ids.slice(0, 24)), 'Search/filter results should match the requested set');
    await poll(() => page.locator('.results-count').innerText(), value => value.startsWith(`${ids.length}教材`), 'Result count is the full matching total');
  }
  await expected(course.units.map(unit => unit.id));
  await action(page, 'load-more').click();
  await countIs(page.locator('#library-output .unit-tile'), Math.min(48, course.units.length));

  const phrases = [
    {query: 'feasible', match: unit => [unit.en, unit.ja, unit.explanation, unit.useWhen, ...(unit.related || []), ...unit.examples.flatMap(example => [example.en, example.ja])].join(' ').toLowerCase().includes('feasible')},
    {query: '税関', match: unit => [unit.en, unit.ja, unit.explanation, unit.useWhen, ...(unit.related || []), ...unit.examples.flatMap(example => [example.en, example.ja])].join(' ').includes('税関')},
  ];
  for (const {query, match} of phrases) {
    const ids = course.units.filter(match).map(unit => unit.id);
    assert.ok(ids.length, `The ${query} search fixture must exist in the real curriculum`);
    await page.locator('#unit-search').fill(query);
    await expected(ids);
  }
  const examplePhrase = course.units[0].examples[0].en.split(' ').slice(-6).join(' ');
  await page.locator('#unit-search').fill(examplePhrase);
  await visible(page.locator(`#library-output a[href="#unit/${course.units[0].id}"]`));
  await page.locator('#unit-search').fill('zzzz-no-such-english-lesson-998877');
  await expected([]);
  await visible(page.locator('#library-output .empty'));
  await page.locator('#unit-search').fill('');

  for (const kind of ['chunk', 'vocabulary', 'grammar', 'all']) {
    await action(page, 'filter-kind', `[data-kind="${kind}"]`).click();
    await attributeIs(action(page, 'filter-kind', `[data-kind="${kind}"]`), 'aria-pressed', 'true');
    await expected(course.units.filter(unit => kind === 'all' || unit.kind === kind).map(unit => unit.id));
  }
  for (const category of course.categories) {
    await page.locator('#category-filter').selectOption(category.id);
    await expected(course.units.filter(unit => unit.category === category.id).map(unit => unit.id));
  }
  await page.locator('#category-filter').selectOption('all');
  for (const level of ['B1+', 'B2', 'C1']) {
    await page.locator('#level-filter').selectOption(level);
    await expected(course.units.filter(unit => unit.level === level).map(unit => unit.id));
  }
  const target = course.units.find(unit => unit.kind === 'grammar' && unit.category === 'deep' && unit.level === 'B2');
  assert.ok(target, 'Combined-filter fixture exists');
  await action(page, 'filter-kind', '[data-kind="grammar"]').click();
  await page.locator('#category-filter').selectOption(target.category);
  await page.locator('#level-filter').selectOption(target.level);
  await expected(course.units.filter(unit => unit.kind === target.kind && unit.category === target.category && unit.level === target.level).map(unit => unit.id));
  await assertNoOverflow(page, 'combined library filters');

  await go(page, 'dialogues');
  for (const category of [...course.categories.map(x => x.id), 'all']) {
    await page.locator('#dialogue-category').selectOption(category);
    const ids = course.dialogues.filter(dialogue => category === 'all' || dialogue.category === category).map(dialogue => `#dialogue/${dialogue.id}`);
    await poll(() => page.locator('#dialogue-list>a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), actual => JSON.stringify(actual) === JSON.stringify(ids), `Dialogue category ${category}`);
  }
}

async function preferences(page) {
  const unit = course.units[0];
  await openUnit(page, unit);
  await visible(page.locator('.unit-head .ipa'));
  await visible(page.locator('.long-example .translation'));
  await settings(page);
  await page.locator('#setting-ipa').uncheck();
  await page.locator('#setting-ja').uncheck();
  await page.locator('#setting-speed').selectOption('0.85');
  await page.locator('#setting-accent').selectOption('en-GB');
  await countIs(page.locator('#setting-voice option[value="qa-stub-ja-JP"]'), 0);
  await page.locator('#setting-voice').selectOption('qa-stub-en-GB');
  await page.evaluate(() => globalThis.__englishQaSpeech.voicesChanged());
  assert.equal(await page.locator('#setting-voice').inputValue(), 'qa-stub-en-GB');
  await assertNoOverflow(page, 'settings dialog');
  await closeSettings(page);
  await countIs(page.locator('.ipa:visible'), 0);
  await countIs(page.locator('.translation:visible'), 0);
  await textIs(page.locator('.unit-body .explain'), unit.explanation);
  await visible(page.locator('.unit-head .meaning')); // The switch is explicitly for examples and library translations.

  await page.reload({waitUntil: 'domcontentloaded'});
  await textIs(page.locator('.unit-head h1'), unit.en);
  await countIs(page.locator('.ipa:visible'), 0);
  await countIs(page.locator('.translation:visible'), 0);
  await go(page, 'library');
  await visible(page.locator('#unit-search'));
  await countIs(page.locator('.unit-tile .meaning:visible'), 0);
  await settings(page);
  assert.equal(await page.locator('#setting-ipa').isChecked(), false);
  assert.equal(await page.locator('#setting-ja').isChecked(), false);
  assert.equal(await page.locator('#setting-speed').inputValue(), '0.85');
  assert.equal(await page.locator('#setting-accent').inputValue(), 'en-GB');
  assert.equal(await page.locator('#setting-voice').inputValue(), 'qa-stub-en-GB');
  await action(page, 'voice-test').click();
  const sample = speakEvents(await speech(page)).at(-1);
  assert.equal(sample.lang, 'en-GB');
  assert.equal(sample.rate, 0.85);
  assert.equal(sample.voiceURI, 'qa-stub-en-GB');
  await page.locator('#setting-ipa').check();
  await closeSettings(page);
  await page.reload({waitUntil: 'domcontentloaded'});
  await visible(page.locator('.unit-tile .ipa').first());
  await countIs(page.locator('.unit-tile .meaning:visible'), 0);
  await settings(page);
  await page.locator('#setting-ja').check();
  await closeSettings(page);
  await page.reload({waitUntil: 'domcontentloaded'});
  await visible(page.locator('.unit-tile .meaning').first());
  const state = await progress(page);
  assert.equal(state.settings.ipa, true);
  assert.equal(state.settings.japanese, true);
}

async function saves(page) {
  const unit = course.units[0];
  await go(page, 'review');
  assert.equal(await action(page, 'saved-start').isDisabled(), true);
  assert.equal(await action(page, 'review-start').isDisabled(), true);
  await go(page, 'library');
  const bookmark = action(page, 'save', `[data-id="${unit.id}"]`);
  await attributeIs(bookmark, 'aria-pressed', 'false');
  await bookmark.click();
  await attributeIs(bookmark, 'aria-pressed', 'true');
  assert.deepEqual((await progress(page)).saved, [unit.id]);
  assert.deepEqual((await progress(page)).reviews, {}, 'Saving must not create an SRS review');
  await page.locator(`#library-output a[href="#unit/${unit.id}"]`).click();
  await textIs(action(page, 'toggle-save'), '保存済み');
  await page.reload({waitUntil: 'domcontentloaded'});
  await textIs(action(page, 'toggle-save'), '保存済み');
  await go(page, 'review');
  await textIs(page.locator('.stats-strip .stat').nth(2).locator('strong'), '1');
  assert.equal(await action(page, 'review-start').isDisabled(), true, 'A saved unseen unit is not due');
  await action(page, 'saved-start').click();
  await textIs(page.locator('.step-bar span'), '1 / 1');
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.answer-panel h3'), unit.en);
  await openUnit(page, unit);
  await action(page, 'toggle-save').click();
  await textIs(action(page, 'toggle-save'), '復習用に保存');
  await page.reload({waitUntil: 'domcontentloaded'});
  assert.deepEqual((await progress(page)).saved, []);
  await go(page, 'review');
  await textIs(page.locator('.stats-strip .stat').nth(2).locator('strong'), '0');
  assert.equal(await action(page, 'saved-start').isDisabled(), true);
}

async function srs(page) {
  const [againUnit, goodUnit, easyUnit, unseenUnit] = course.units;
  await go(page, 'review');
  await textIs(page.locator('.stats-strip .stat').first().locator('strong'), '0');
  assert.equal(await action(page, 'review-start').isDisabled(), true);
  for (const [unit, grade, interval, streak] of [[againUnit, 'again', 600000, 0], [goodUnit, 'good', DAY, 1], [easyUnit, 'easy', DAY * 3, 2]]) {
    await openUnit(page, unit);
    await action(page, 'grade', `[data-context="unit"][data-grade="${grade}"]`).click();
    const record = (await progress(page)).reviews[unit.id];
    assert.equal(record.due - record.last, interval, `Initial ${grade} interval`);
    assert.equal(record.streak, streak);
    assert.equal(record.attempts, 1);
  }
  await openUnit(page, goodUnit);
  await action(page, 'grade', '[data-context="unit"][data-grade="good"]').click();
  let state = await progress(page);
  assert.equal(state.reviews[goodUnit.id].attempts, 2);
  assert.equal(state.reviews[goodUnit.id].due - state.reviews[goodUnit.id].last, DAY * 3);
  assert.equal(Object.values(state.history).reduce((total, value) => total + value, 0), 4);
  assert.equal(Object.keys(state.reviews).length, 3);
  assert.equal(state.reviews[unseenUnit.id], undefined);
  await go(page, 'review');
  assert.equal(await action(page, 'review-start').isDisabled(), true, 'Future records must not be due yet');

  state.reviews[againUnit.id].due = Date.now() - 5000;
  state.reviews[goodUnit.id].due = Date.now() + DAY;
  state.reviews[easyUnit.id].due = Date.now() + 3 * DAY;
  const untouchedGood = {...state.reviews[goodUnit.id]};
  await seedProgress(page, state);
  await go(page, 'review');
  await textIs(page.locator('.stats-strip .stat').first().locator('strong'), '1');
  const dueSection = page.locator('#main>section').filter({has: page.locator('h2', {hasText: 'いま復習できる表現'})});
  await countIs(dueSection.locator('.unit-tile'), 1);
  await visible(dueSection.locator(`a[href="#unit/${againUnit.id}"]`));
  await action(page, 'review-start').click();
  await textIs(page.locator('.step-bar span'), '1 / 1');
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.answer-panel h3'), againUnit.en);
  await action(page, 'grade', '[data-context="practice"][data-grade="good"]').click();
  await textIs(page.locator('#main h1'), '今日の表現が、少し増えた');
  state = await progress(page);
  assert.equal(state.reviews[againUnit.id].attempts, 2);
  assert.equal(state.reviews[againUnit.id].due - state.reviews[againUnit.id].last, DAY);
  assert.deepEqual(state.reviews[goodUnit.id], untouchedGood);
  assert.equal(state.reviews[unseenUnit.id], undefined, 'Review-only session must never pull in an unseen entry');
  assert.equal(Object.keys(state.reviews).length, 3);
  await go(page, 'review');
  await textIs(page.locator('.stats-strip .stat').first().locator('strong'), '0');
  assert.equal(await action(page, 'review-start').isDisabled(), true);
}

async function assembly(page) {
  const unit = course.units.find(unit => unit.examples[0].chunks.length >= 4);
  const chunks = unit.examples[0].chunks;
  const indices = chunks.map((_, index) => index);
  const targetText = () => page.locator('#assembly-target button').allTextContents();
  await openUnit(page, unit);
  await action(page, 'start-unit-practice').click();
  await textIs(page.locator('.step-bar span'), '1 / 1');
  const pool = await action(page, 'assembly-pick').evaluateAll(nodes => nodes.map(node => Number(node.dataset.index)));
  assert.deepEqual([...pool].sort((a, b) => a - b), indices);
  assert.notDeepEqual(pool, indices, 'The prompt must actually shuffle the chunks');
  await action(page, 'assembly-pick', '[data-index="0"]').click();
  await countIs(page.locator('#assembly-target button'), 1);
  assert.equal(await action(page, 'assembly-pick', '[data-index="0"]').isDisabled(), true);
  // An adversarial duplicate click event also must not append an already chosen position.
  await action(page, 'assembly-pick', '[data-index="0"]').dispatchEvent('click');
  assert.deepEqual(await targetText(), [chunks[0].en]);
  await action(page, 'assembly-pick', '[data-index="1"]').click();
  await action(page, 'assembly-remove', '[data-position="0"]').click();
  assert.deepEqual(await targetText(), [chunks[1].en]);
  assert.equal(await action(page, 'assembly-pick', '[data-index="0"]').isEnabled(), true);
  await action(page, 'assembly-undo').click();
  await countIs(page.locator('#assembly-target button'), 0);
  await countIs(page.locator('#chunk-pool button:disabled'), 0);
  for (const index of [...indices].reverse()) await action(page, 'assembly-pick', `[data-index="${index}"]`).click();
  assert.deepEqual(await targetText(), [...chunks].reverse().map(chunk => chunk.en));
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.feedback'), '見本の順番を確認して、もう一度声に出してみよう');
  await textIs(page.locator('.answer-panel .en'), unit.examples[0].en);
  const frozen = await targetText();
  await action(page, 'assembly-remove', '[data-position="0"]').dispatchEvent('click');
  assert.deepEqual(await targetText(), frozen, 'Revealed assembly must not silently change');

  await openUnit(page, unit);
  await action(page, 'start-unit-practice').click();
  for (const index of indices) await action(page, 'assembly-pick', `[data-index="${index}"]`).click();
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.feedback'), '見本と同じ順番で組み立てられました');
  await action(page, 'grade', '[data-context="practice"][data-grade="good"]').click();
  await textIs(page.locator('#main h1'), '今日の表現が、少し増えた');
  assert.equal((await progress(page)).reviews[unit.id].attempts, 1, 'Only the explicit grade records a review');
}

async function promptedPractice(page, mode) {
  const unit = course.units[0];
  const example = unit.examples[0];
  await go(page, 'practice');
  await action(page, 'start-practice', `[data-mode="${mode}"]`).click();
  await textIs(page.locator('.step-bar span'), '1 / 10');
  await countIs(page.locator('.answer-panel'), 0);
  await countIs(page.locator('.practice-card [lang="en"]'), 0);
  await countIs(action(page, 'grade'), 0);
  if (mode === 'recall') {
    await textIs(page.locator('.practice-card .prompt-ja'), unit.ja);
    await page.locator('#recall-answer').fill(`  ${unit.en.toUpperCase()}!  `);
  } else {
    await countIs(page.locator('.practice-card .prompt-ja,.practice-card .translation'), 0);
    const text = await page.locator('.practice-card').innerText();
    assert.ok(!text.includes(example.en) && !text.includes(example.ja), 'Listen prompt must hide both answer languages');
    await action(page, 'speak-example').click();
    assert.equal(speakEvents(await speech(page)).at(-1).text, example.en);
    await countIs(page.locator('.answer-panel'), 0);
    await page.locator('#recall-answer').fill(example.en);
  }
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.answer-panel h3'), unit.en);
  await textIs(page.locator('.answer-panel .en'), example.en);
  await textIs(page.locator('.feedback'), '教材の見本と一致しています');
  await countIs(page.locator('.answer-panel .ipa'), 2);
  await action(page, 'grade', '[data-context="practice"][data-grade="again"]').click();
  await textIs(page.locator('.step-bar span'), '2 / 10');
  await countIs(page.locator('.answer-panel'), 0);
  await countIs(action(page, 'grade'), 0);
  assert.equal(await page.locator('#recall-answer').inputValue(), '');
  assert.equal((await progress(page)).reviews[unit.id].due - (await progress(page)).reviews[unit.id].last, 600000);
}

async function dialogueCheck(page, dialogue) {
  await go(page, `dialogue/${dialogue.id}`);
  await textIs(page.locator('#main h1'), dialogue.title);
  await attributeIs(page.locator('.bottom-nav a[data-tab="dialogues"]'), 'aria-current', 'page');
  assert.equal(await page.locator('#dialogue-role').inputValue(), 'B');
  const count = dialogue.lines.length;
  for (const role of ['A', 'B']) {
    await page.locator('#dialogue-role').selectOption(role);
    await textIs(page.locator('.step-bar span'), `1 / ${count}`);
    assert.equal(await action(page, 'dialogue-prev').isDisabled(), true);
    for (let index = 0; index < count; index++) {
      const line = dialogue.lines[index];
      const row = page.locator(`.dialogue-line[data-line="${index}"]`);
      await textIs(page.locator('.step-bar span'), `${index + 1} / ${count}`);
      await countIs(page.locator('.dialogue-line'), 1);
      await visible(row);
      if (line.role === role) {
        assert.ok((await row.getAttribute('class')).split(/\s+/).includes('mine'));
        await textIs(row.locator('.prompt-ja'), line.ja);
        await countIs(row.locator('.en,.ipa,.translation,[data-action="speak-line"]'), 0);
        await countIs(action(page, 'dialogue-next'), 0);
        await action(page, 'dialogue-reveal').click();
      } else {
        assert.ok(!(await row.getAttribute('class')).split(/\s+/).includes('mine'));
        await countIs(action(page, 'dialogue-reveal'), 0);
      }
      await textIs(row.locator('.en'), line.en);
      await textIs(row.locator('.ipa'), `/${line.ipa}/`);
      await textIs(row.locator('.translation'), line.ja);
      await visible(row.locator('[data-action="speak-line"]'));
      await assertNoOverflow(page, `${dialogue.id}, role ${role}, line ${index + 1}`);
      await action(page, 'dialogue-next').click();
    }
    await textIs(page.locator('.step-bar span'), `1 / ${count}`);
    if (dialogue.lines[0].role === role) {
      await countIs(page.locator('.dialogue-line .en'), 0, 'Restart must hide the learner answer again');
      await action(page, 'dialogue-reveal').click();
    }
    await action(page, 'dialogue-next').click();
    await textIs(page.locator('.step-bar span'), `2 / ${count}`);
    await action(page, 'dialogue-prev').click();
    await textIs(page.locator('.step-bar span'), `1 / ${count}`);
    if (dialogue.lines[0].role === role) await countIs(page.locator('.dialogue-line .en'), 0, 'Previous must reset own-turn reveal');
  }
  await action(page, 'dialogue-full').click();
  await countIs(page.locator('.dialogue-line'), count);
  await countIs(action(page, 'dialogue-reveal'), 0);
  for (let index = 0; index < count; index++) {
    const row = page.locator(`.dialogue-line[data-line="${index}"]`);
    await textIs(row.locator('.en'), dialogue.lines[index].en);
    await textIs(row.locator('.translation'), dialogue.lines[index].ja);
    await textIs(row.locator('.ipa'), `/${dialogue.lines[index].ipa}/`);
  }
  for (const id of dialogue.unitIds || []) await visible(page.locator(`.library-results a[href="#unit/${id}"]`));
  await action(page, 'dialogue-full').click();
  await countIs(page.locator('.dialogue-line'), 1);
  await textIs(page.locator('.step-bar span'), `1 / ${count}`);
}

async function speechLifecycle(page) {
  const unit = course.units[0];
  await openUnit(page, unit);
  await action(page, 'speak-unit').click();
  let before = await speech(page);
  assert.equal(before.active, true);
  assert.equal(speakEvents(before).at(-1).text, unit.en);
  await visible(page.locator('#audio-bar'));
  await page.locator('.bottom-nav a[data-tab="library"]').click();
  await textIs(page.locator('#main h1'), '使える表現を増やす');
  await waitStopped(page);
  assert.ok(cancelCount(await speech(page)) > cancelCount(before), 'Route navigation must cancel speech');
  await page.evaluate(() => globalThis.__englishQaSpeech.lateEnd(0));
  await waitStopped(page);

  await openUnit(page, unit);
  await action(page, 'speak-example').click();
  before = await speech(page);
  await settings(page);
  await waitStopped(page);
  assert.ok(cancelCount(await speech(page)) > cancelCount(before), 'Opening settings must stop current speech');
  await action(page, 'voice-test').click();
  before = await speech(page);
  assert.equal(before.active, true);
  await closeSettings(page);
  await waitStopped(page);
  assert.ok(cancelCount(await speech(page)) > cancelCount(before), 'Closing settings must cancel its voice test');

  await action(page, 'speak-unit').click();
  const staleIndex = (await speech(page)).utteranceCount - 1;
  await action(page, 'speak-example').click();
  const latest = await speech(page);
  await page.evaluate(index => globalThis.__englishQaSpeech.lateEnd(index), staleIndex);
  assert.equal((await speech(page)).text, unit.examples[0].en, 'Old onend must not clear a replacement utterance');
  assert.equal((await speech(page)).active, true);
  await visible(page.locator('#audio-bar'));
  assert.equal(speakEvents(latest).at(-1).overlapped, false);
  await page.locator('#audio-bar [data-action="stop-audio"]').click();
  await waitStopped(page);

  const dialogue = course.dialogues[0];
  await go(page, `dialogue/${dialogue.id}`);
  await action(page, 'dialogue-play').click();
  before = await speech(page);
  const firstCount = speakEvents(before).length;
  assert.equal(speakEvents(before).at(-1).text, dialogue.lines[0].en);
  await page.evaluate(() => globalThis.__englishQaSpeech.finish());
  await poll(() => speech(page), value => speakEvents(value).length === firstCount + 1, 'Full dialogue should advance after an ended utterance', 3000);
  assert.equal(speakEvents(await speech(page)).at(-1).text, dialogue.lines[1].en);
  await page.evaluate(() => globalThis.__englishQaSpeech.finish());
  await page.locator('.bottom-nav a[data-tab="review"]').click();
  await textIs(page.locator('#main h1'), '思い出すたび、自分の言葉に');
  await waitStopped(page);
  const stoppedCount = speakEvents(await speech(page)).length;
  // The implementation has a real 500 ms inter-turn gap: wait beyond it to detect stale continuation.
  await pause(800);
  assert.equal(speakEvents(await speech(page)).length, stoppedCount, 'Dialogue must not restart after cancellation during its inter-turn gap');

  await openUnit(page, unit);
  await action(page, 'speak-unit').click();
  before = await speech(page);
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await waitStopped(page);
  assert.ok(cancelCount(await speech(page)) > cancelCount(before), 'pagehide handler must cancel speech');
  await action(page, 'speak-unit').click();
  await page.evaluate(() => globalThis.__englishQaSpeech.fail('synthesis-failed'));
  await waitStopped(page);
  await poll(() => page.locator('#toast').innerText(), text => text.includes('読み上げを開始できませんでした'), 'Speech failure should show recovery guidance');
  await action(page, 'speak-unit').click();
  await page.evaluate(() => globalThis.__englishQaSpeech.finish());
  await waitStopped(page);
  assert.equal(speakEvents(await speech(page)).some(event => event.overlapped), false, 'The app must cancel before a new utterance');
}

async function unsupportedSpeech(page) {
  await openUnit(page, course.units[0]);
  await action(page, 'speak-unit').click();
  await poll(() => page.locator('#toast').innerText(), text => text.includes('このブラウザでは読み上げを利用できません'), 'Unsupported-speech guidance');
  await visible(page.locator('#audio-bar'), false);
  await settings(page);
  await countIs(page.locator('#setting-voice option'), 1);
  await action(page, 'voice-test').click();
  await visible(page.locator('#audio-bar'), false);
  await closeSettings(page);
  await go(page, 'practice');
  await action(page, 'start-practice', '[data-mode="recall"]').click();
  await action(page, 'reveal-practice').click();
  await textIs(page.locator('.answer-panel h3'), course.units[0].en);
  await action(page, 'grade', '[data-context="practice"][data-grade="good"]').click();
  assert.equal((await progress(page)).reviews[course.units[0].id].attempts, 1, 'Text learning still works without speech');
}

async function exportBackup(page, engine, suffix) {
  const pending = page.waitForEvent('download');
  await action(page, 'export').click();
  const download = await pending;
  assert.match(download.suggestedFilename(), /^music-japan-english-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const path = join(OUT, `${engine}-${suffix}.json`);
  await download.saveAs(path);
  assert.equal(await download.failure(), null);
  return JSON.parse(await readFile(path, 'utf8'));
}

async function setImport(page, name, payload) {
  await page.locator('#import-progress').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))});
}

async function backups(page, engine) {
  const [savedUnit, reviewedUnit] = course.units;
  await openUnit(page, savedUnit);
  await action(page, 'toggle-save').click();
  await openUnit(page, reviewedUnit);
  await action(page, 'grade', '[data-context="unit"][data-grade="good"]').click();
  await settings(page);
  await page.locator('#setting-ipa').uncheck();
  const baseline = await progress(page);
  const snapshot = await storage(page);
  const exported = await exportBackup(page, engine, 'exported-backup');
  assert.equal(exported.app, 'mj-english');
  assert.ok(!Number.isNaN(Date.parse(exported.exportedAt)), 'Export date should be an ISO timestamp');
  const {exportedAt, ...exportedState} = exported;
  assert.deepEqual(exportedState, baseline, 'Downloaded JSON must contain exactly the actual learner state');
  assert.equal(exported.units, undefined, 'Export must not duplicate the curriculum');
  assert.deepEqual(await storage(page), snapshot, 'Export must not mutate storage');

  const invalid = [
    ['broken.json', '{broken json'],
    ['wrong-version.json', {...exported, version: 99}],
    ['foreign-app.json', {...exported, app: 'wahran-korean'}],
    ['unbranded.json', {version: 1, saved: [], reviews: {}, history: {}, settings: {}}],
    ['empty-object.json', {}],
    ['wrong-saved-type.json', {...exported, saved: 'not an array'}],
    ['oversize.json', ' '.repeat(1_000_001)],
  ];
  for (const [name, payload] of invalid) {
    await setImport(page, name, payload);
    await poll(() => page.locator('#import-preview').innerText(), value => value.includes(name === 'oversize.json' ? '大きすぎます' : '有効なバックアップではありません'), `Reject ${name}`);
    await countIs(action(page, 'apply-import'), 0);
    assert.deepEqual(await storage(page), snapshot, `${name} must leave every storage key unchanged`);
    // A fresh real settings panel prevents a prior error message from satisfying the next wait.
    await closeSettings(page);
    await settings(page);
  }

  const importedId = course.units[5].id;
  const importTime = Date.now();
  const valid = {
    ...exported,
    saved: [importedId, importedId, 'not-an-english-unit'],
    reviews: {
      [importedId]: {due: importTime + 7 * DAY, last: importTime - DAY, attempts: 3, streak: 2},
      'not-an-english-unit': {due: 0, last: 0, attempts: 1, streak: 0},
    },
    history: {'2026-10-17': 3},
    settings: {...exported.settings, ipa: true, japanese: false, speed: 0.85, accent: 'en-AU', voice: ''},
    lastUnit: importedId,
    arbitraryKey: 'must not enter app state',
  };
  await setImport(page, 'valid-preview-only.json', valid);
  await visible(action(page, 'apply-import'));
  assert.deepEqual(await storage(page), snapshot, 'Selecting a valid file must only preview; confirmation is required');
  await closeSettings(page);
  assert.deepEqual(await storage(page), snapshot, 'Closing preview must cancel import');
  await settings(page);
  await countIs(action(page, 'apply-import'), 0);
  await setImport(page, 'valid-then-invalid.json', valid);
  await visible(action(page, 'apply-import'));
  await setImport(page, 'invalid-after-valid.json', '{bad');
  await poll(() => page.locator('#import-preview').innerText(), value => value.includes('有効なバックアップではありません'), 'Invalid file must discard a previous valid preview');
  await countIs(action(page, 'apply-import'), 0);
  assert.deepEqual(await storage(page), snapshot);

  await setImport(page, 'valid-confirmed.json', valid);
  await visible(action(page, 'apply-import'));
  await action(page, 'apply-import').click();
  await visible(page.locator('#dialog'), false);
  const restored = await progress(page);
  assert.deepEqual(restored.saved, [importedId]);
  assert.deepEqual(Object.keys(restored.reviews), [importedId]);
  assert.deepEqual(restored.reviews[importedId], valid.reviews[importedId]);
  assert.equal(restored.settings.ipa, true);
  assert.equal(restored.settings.japanese, false);
  assert.equal(restored.arbitraryKey, undefined);
  assert.equal(restored.exportedAt, undefined);
  assert.equal(restored.lastUnit, importedId);
  assert.equal(restored.reviews[reviewedUnit.id], undefined, 'Confirmed import replaces English state, rather than silently merging');
  await assertForeignStorage(page);
  await page.reload({waitUntil: 'domcontentloaded'});
  await loaded(page);
  assert.deepEqual(await progress(page), restored, 'Imported state survives reload');
  await go(page, 'review');
  await visible(page.locator(`.unit-tile a[href="#unit/${importedId}"]`));
  await settings(page);
  await setImport(page, 'original-round-trip.json', exported);
  await visible(action(page, 'apply-import'));
  await action(page, 'apply-import').click();
  await visible(page.locator('#dialog'), false);
  assert.deepEqual(await progress(page), baseline, 'An actual downloaded backup must round-trip without losing fields');
  await assertForeignStorage(page);
}

async function visualPages(page, record, engine, size) {
  record.screenshots = [];
  await go(page, 'learn');
  await textIs(page.locator('#main h1'), '言いたいことを、英語で最後まで');
  record.screenshots.push(await screenshot(page, engine, size, 'home'));
  await go(page, 'library');
  await visible(page.locator('#unit-search'));
  record.screenshots.push(await screenshot(page, engine, size, 'library', false));
  const unit = [...course.units].sort((a, b) => b.en.length - a.en.length)[0];
  await openUnit(page, unit);
  record.screenshots.push(await screenshot(page, engine, size, 'unit'));
  const dialogue = course.dialogues[0];
  await go(page, `dialogue/${dialogue.id}`);
  await textIs(page.locator('#main h1'), dialogue.title);
  await page.locator('#dialogue-role').selectOption(dialogue.lines[0].role);
  await countIs(page.locator('.dialogue-line .en'), 0);
  record.screenshots.push(await screenshot(page, engine, size, 'roleplay'));
  await action(page, 'dialogue-reveal').click();
  await textIs(page.locator('.dialogue-line .en'), dialogue.lines[0].en);
  record.screenshots.push(await screenshot(page, engine, size, 'roleplay-revealed'));
  await settings(page);
  record.screenshots.push(await screenshot(page, engine, size, 'settings', false));
  await closeSettings(page);
  const links = page.locator('.bottom-nav>a');
  for (let index = 0; index < await links.count(); index++) {
    const box = await links.nth(index).boundingBox();
    assert.ok(box && box.width >= 40 && box.height >= 44, 'Primary navigation must have usable pointer targets');
    const centreInViewport = box.x + box.width / 2 >= 0 && box.x + box.width / 2 <= (size === 'mobile' ? MOBILE.width : DESKTOP.width) && box.y + box.height / 2 < (size === 'mobile' ? MOBILE.height : DESKTOP.height);
    assert.ok(centreInViewport, 'Fixed navigation centres must stay inside the viewport');
  }
}

async function readablePages(page) {
  const paths = ['/english/', '/english/guide/', '/english/sources/', ...course.categories.map(category => `/english/topics/${category.id}/`)];
  for (const path of paths) {
    const response = await page.goto(origin + path, {waitUntil: 'domcontentloaded'});
    assert.equal(response.status(), 200, `Static readable page ${path}`);
    await visible(page.locator('#main h1'));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://music-japan.com${path}`);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /index,follow/);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.equal(schema['@context'], 'https://schema.org');
    assert.ok(schema['@graph'].some(item => item['@type'] === 'WebPage'));
    assert.ok(schema['@graph'].some(item => item['@type'] === 'BreadcrumbList'));
    const category = course.categories.find(category => path === `/english/topics/${category.id}/`);
    if (category) {
      const entries = course.units.filter(unit => unit.category === category.id);
      await countIs(page.locator('#main article'), entries.length);
      for (const unit of entries) {
        const article = page.locator(`#${unit.id}`);
        await textIs(article.locator('h2'), unit.en);
        await textIs(article.locator('.long-example .en'), unit.examples[0].en);
        await visible(article.locator('.ipa').first());
      }
    }
    if (path === '/english/sources/') await countIs(page.locator('ol.source-list>li'), course.sources.filter(source => source.status === 'reviewed').length);
    await assertNoOverflow(page, `JavaScript disabled ${path}`);
  }
}

async function startServer() {
  const root = await realpath(DIST);
  const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'};
  server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0') || pathname.includes('\\')) { response.writeHead(400); response.end(); return; }
      let file = resolve(root, `.${pathname}`);
      if (pathname.endsWith('/') || !extname(pathname)) file = join(file, 'index.html');
      const rel = relative(root, file);
      if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) { response.writeHead(403); response.end(); return; }
      const resolved = await realpath(file);
      const realRel = relative(root, resolved);
      if (isAbsolute(realRel) || realRel === '..' || realRel.startsWith(`..${sep}`)) { response.writeHead(403); response.end(); return; }
      const metadata = await stat(resolved);
      if (!metadata.isFile()) { response.writeHead(404); response.end('Not Found'); return; }
      response.writeHead(200, {'Content-Type': types[extname(resolved)] || 'application/octet-stream', 'Content-Length': metadata.size, 'Cache-Control': 'no-store'});
      if (request.method === 'HEAD') { response.end(); return; }
      createReadStream(resolved).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, {'Content-Type': 'text/plain'});
      response.end(error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  report.origin = origin;
}

async function preflight() {
  const names = ['index.html', 'app.js', 'engine.js', 'course.js', 'style.css', 'base.css', 'CMU-LICENSE.txt', 'build-manifest.json', 'manifest.webmanifest', 'sitemap.xml', 'llms.txt'];
  const content = Object.fromEntries(await Promise.all(names.map(async name => [name, await readFile(join(DIST, 'english', name), 'utf8')])));
  const match = content['course.js'].match(/^globalThis\.ENGLISH_COURSE\s*=\s*([\s\S]*);\s*$/);
  assert.ok(match, 'course.js must be the generated curriculum payload');
  course = JSON.parse(match[1]);
  manifest = JSON.parse(content['build-manifest.json']);
  assert.ok(course.units.length >= 200, 'Build the full curriculum before browser QA (at least 200 entries)');
  assert.ok(course.dialogues.length >= 24, 'Build all 24 dialogues before browser QA');
  assert.equal(new Set(course.units.map(unit => unit.id)).size, course.units.length);
  assert.equal(new Set(course.dialogues.map(dialogue => dialogue.id)).size, course.dialogues.length);
  assert.equal(manifest.units, course.units.length);
  assert.equal(manifest.dialogues, course.dialogues.length);
  assert.equal(manifest.lines, course.dialogues.reduce((total, dialogue) => total + dialogue.lines.length, 0));
  assert.ok(content['CMU-LICENSE.txt'].includes('Carnegie Mellon'), 'Publish the pronunciation dictionary license');
  assert.ok(!/getUserMedia|MediaRecorder|(?:webkit)?SpeechRecognition/.test(content['app.js']), 'This English app must not request microphone/recognition APIs');
  const webmanifest = JSON.parse(content['manifest.webmanifest']);
  assert.equal(webmanifest.start_url, '/english/');
  assert.equal(webmanifest.scope, '/english/');
  for (const path of manifest.urls) {
    assert.ok(content['sitemap.xml'].includes(`<loc>https://music-japan.com${path}</loc>`), `English sitemap should contain ${path}`);
    if (path !== '/english/') assert.ok(content['llms.txt'].includes(`https://music-japan.com${path}`), `LLM index should link ${path}`);
  }
  report.build = {...manifest, sha256: Object.fromEntries(['app.js', 'engine.js', 'course.js', 'style.css', 'base.css'].map(name => [name, createHash('sha256').update(content[name]).digest('hex')]))};
  console.log(`Built English app: ${manifest.units} entries, ${manifest.dialogues} dialogues, revision ${manifest.revision}`);
  console.log(SPEECH_LABEL);
}

async function main() {
  await mkdir(OUT, {recursive: true});
  try {
    await preflight();
    await startServer();
    for (const engine of ENGINES) {
      let browser;
      try {
        browser = await playwright[engine].launch({headless: true});
        report.engines.push({name: engine, version: browser.version(), status: 'launched'});
      } catch (error) {
        report.engines.push({name: engine, status: 'launch-failed', error: error.stack || String(error)});
        console.error(`Cannot launch ${engine}. Install it with: npx playwright install --with-deps ${engine}\n${error.message}`);
        continue;
      }
      try {
        await runCase(browser, engine, 'navigation, every topic and every unit', navRoutes);
        await runCase(browser, engine, 'English and Japanese search, pagination and combined filters', searchAndFilters);
        await runCase(browser, engine, 'IPA, Japanese and voice preferences persist after reload', preferences);
        await runCase(browser, engine, 'bookmarks persist and stay separate from SRS', saves);
        await runCase(browser, engine, 'SRS grades, due times and unseen exclusion', srs);
        await runCase(browser, engine, 'wrong and correct chunk order, removal and duplicate prevention', assembly);
        await runCase(browser, engine, 'recall hides answers until reveal and resets the next prompt', page => promptedPractice(page, 'recall'));
        await runCase(browser, engine, 'listening hides English and Japanese until reveal', page => promptedPractice(page, 'listen'));
        for (const dialogue of course.dialogues) await runCase(browser, engine, `${dialogue.id}: both roles, every turn, reveal and full transcript`, page => dialogueCheck(page, dialogue));
        await runCase(browser, engine, 'speech STUB sequencing, replacement, navigation, close and pagehide cancellation', speechLifecycle);
        await runCase(browser, engine, 'unsupported speech remains usable without a microphone', unsupportedSpeech, {unsupported: true});
        await runCase(browser, engine, 'real backup download, invalid rejection, preview, restore and other-app isolation', page => backups(page, engine));
        for (const size of ['mobile', 'desktop']) await runCase(browser, engine, 'home, library, unit, roleplay and settings screenshots', (page, record) => visualPages(page, record, engine, size), {size});
        await runCase(browser, engine, 'readable topic pages and metadata with JavaScript disabled', readablePages, {javascript: false});
      } finally { await browser.close(); }
    }
    const failed = report.cases.filter(item => item.status !== 'passed').length;
    const launchFailed = report.engines.some(engine => engine.status !== 'launched');
    report.status = failed || launchFailed || !report.cases.length ? 'failed' : 'passed';
    report.summary = {passed: report.cases.filter(item => item.status === 'passed').length, failed, browserLaunchFailures: report.engines.filter(engine => engine.status !== 'launched').length};
  } catch (error) {
    report.status = 'failed';
    report.fatalError = error.stack || String(error);
    console.error(error.stack || error);
  } finally {
    if (server?.listening) {
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`English browser QA: ${report.status.toUpperCase()} — ${join(OUT, 'report.json')}`);
    process.exitCode = report.status === 'passed' ? 0 : 1;
  }
}

await main();
