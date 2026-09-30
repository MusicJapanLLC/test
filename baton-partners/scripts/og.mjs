// SNS・AIの引用で使う画像（1200×630）と、PNG/ICO のファビコンを作る。
// 使い方：`npm run build` のあとに `npm run og`（ブラウザは Playwright の Chromium を使う）。
// 出力：public/og/<key>.png、public/favicon-192.png、public/apple-touch-icon.png、public/favicon.ico
// Google の検索結果は SVG のファビコンに対応していないため、PNG と ICO も用意する。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const items = JSON.parse(readFileSync(resolve(root, '.og-manifest.json'), 'utf8'));
const font = (pkg, weight) => pathToFileURL(resolve(root, 'node_modules/@fontsource', pkg, `${weight}.css`)).href;
const file = (p) => pathToFileURL(resolve(root, 'public', p.replace(/^\//, ''))).href;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bpLogo = readFileSync(resolve(root, 'public/brand/baton-partners-logo.svg'), 'utf8');

function html(it) {
  const mono = it.theme === 'mono';
  const brand = it.brand ?? '#C8102E';
  const accent = it.accent ?? '#1CCCE8';
  const long = it.heading.length > 26;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-old-mincho', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#fff;font-family:'Zen Kaku Gothic New',sans-serif;color:#0E0F12;position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:${mono ? 'linear-gradient(#0000000d 1px,transparent 1px),linear-gradient(90deg,#0000000d 1px,transparent 1px)' : 'none'};background-size:48px 48px}
  .glow{position:absolute;right:-160px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle, ${brand}22, transparent 65%)}
  .glow2{position:absolute;right:120px;bottom:-220px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${accent}22, transparent 65%)}
  .bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:${mono ? '#0E0F12' : `linear-gradient(180deg, ${brand}, ${accent})`}}
  .in{position:absolute;inset:64px 80px 56px 96px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:24px}
  .top img{height:56px;width:auto}
  .label{font-size:22px;font-weight:700;letter-spacing:.12em;color:${mono ? '#0E0F12' : brand};text-transform:uppercase}
  h1{font-family:${mono ? "'Zen Kaku Gothic New'" : "'Zen Old Mincho'"},serif;font-weight:900;font-size:${long ? 52 : 68}px;line-height:1.4;letter-spacing:.01em;max-width:980px;word-break:keep-all;overflow-wrap:anywhere}
  .foot{display:flex;align-items:center;justify-content:space-between;font-size:24px;font-weight:700;color:#3a3b40}
  .foot svg{height:40px;width:auto}
</style></head><body>
<div class="grid"></div><div class="glow"></div><div class="glow2"></div><div class="bar"></div>
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="label">${esc(it.label)}</span></div>
  <h1>${esc(it.heading)}</h1>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
mkdirSync(resolve(root, 'public/og'), { recursive: true });
// about:blank からは file:// の書体・画像を読めないので、一時ファイルに書いて開く
const tmp = resolve(root, '.og-tmp.html');
for (const it of items) {
  writeFileSync(tmp, html(it));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'public/og', `${it.key}.png`) });
  console.log('og', it.key);
}

// ファビコン（SVG のマークを PNG に）
const mark = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
for (const [name, size] of [['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['.favicon-48.png', 48]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:${name.startsWith('apple') ? '#fff' : 'transparent'}">${mark.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: resolve(root, 'public', name), omitBackground: !name.startsWith('apple') });
  await p.close();
  console.log('icon', name);
}
await browser.close();
(await import('node:fs')).rmSync(tmp, { force: true });
