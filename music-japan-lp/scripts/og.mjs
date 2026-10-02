// SNS・検索で使う画像（public/og/ja-top.png 1200×630）と apple-touch-icon.png を作る。
// 使い方：npm run build のあと node scripts/og.mjs（Playwright の Chromium を使う）。画像はコミットする。
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const root = resolve(import.meta.dirname, '..');
const f = (p) => pathToFileURL(resolve(root, p)).href;
const archivo = readdirSync(resolve(root, 'node_modules/@fontsource-variable/archivo/files')).find((n) => n.includes('latin-wdth-normal') && !n.includes('ext'));
const mark = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');

// 点の散らばり（決まった乱数で毎回同じ絵に）
let s = 7;
const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const dots = Array.from({ length: 260 }, () => {
  const x = r() * 1200;
  const y = r() * 630;
  if (x < 900 && y > 190 && y < 460) return '';
  const big = r() < 0.12;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big ? 2.4 : 1.2}" fill="${big && r() < 0.3 ? '#e1222f' : '#efe9e0'}" opacity="${big ? 0.9 : 0.35}"/>`;
}).join('');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
@font-face{font-family:'ZKG';font-weight:900;src:url('${f('public/fonts/zkg-900-h.woff2')}') format('woff2')}
@font-face{font-family:'ZKG2';font-weight:900;src:url('${f('public/fonts/zkg-900.woff2')}') format('woff2')}
@font-face{font-family:'ZKG7';font-weight:700;src:url('${f('public/fonts/zkg-700.woff2')}') format('woff2')}
@font-face{font-family:'Archivo';font-weight:100 900;font-stretch:62% 125%;src:url('${f(`node_modules/@fontsource-variable/archivo/files/${archivo}`)}') format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#060607;color:#efe9e0;font-family:'ZKG','ZKG2',sans-serif;position:relative;overflow:hidden}
.dots{position:absolute;inset:0}
.glow{position:absolute;right:-120px;top:-140px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(225,34,47,.32),transparent 65%)}
.in{position:absolute;inset:58px 70px 54px 72px;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:center;gap:16px;font-family:'Archivo';font-weight:800;font-size:22px;letter-spacing:.06em;font-variation-settings:'wdth' 118}
.top svg{width:52px;height:52px}
.top small{margin-left:14px;font-family:'Archivo';font-weight:500;font-size:14px;letter-spacing:.24em;color:#8f887f}
h1{font-weight:900;font-size:62px;line-height:1.24;letter-spacing:-.01em}
h1 .r{color:#e1222f}
.foot{display:flex;justify-content:space-between;align-items:end;font-family:'ZKG7';font-weight:700;font-size:20px;color:#cfc7bc}
.foot b{font-family:'Archivo';font-weight:800;letter-spacing:.12em;font-size:15px;color:#efe9e0;font-variation-settings:'wdth' 120}
.link{position:absolute;right:80px;top:96px;width:300px;height:80px}
</style></head><body>
<svg class="dots" viewBox="0 0 1200 630">${dots}</svg>
<div class="glow"></div>
<svg class="link" viewBox="0 0 300 80"><circle cx="12" cy="40" r="11" fill="#efe9e0"/><circle cx="288" cy="40" r="11" fill="#e1222f"/><path d="M24 40 C 100 0, 200 0, 276 40" fill="none" stroke="#e1222f" stroke-width="3.5" stroke-linecap="round"/></svg>
<div class="in">
  <div class="top">${mark}<span>Music Japan</span><small>WHAT WE DO</small></div>
  <h1>会社を、見つけてもらう。<br>知ってもらう。<br>そして、<span class="r">話したくなる</span>ところまで。</h1>
  <div class="foot"><span>企業の専用ページ・人物プロフィール・経営者インタビュー</span><b>BATON PARTNERS / BATON / SECOND TAKE</b></div>
</div></body></html>`;

const browser = await chromium.launch();
const tmp = resolve(root, '.og-tmp.html');
writeFileSync(tmp, html);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(root, 'public/og/ja-top.png') });
console.log('og ja-top.png');

const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<html><body style="margin:0;background:#060607;display:grid;place-items:center;height:180px">${mark.replace('<svg', '<svg width="132" height="132"')}</body></html>`);
await icon.screenshot({ path: resolve(root, 'public/apple-touch-icon.png') });
console.log('apple-touch-icon.png');
await browser.close();
rmSync(tmp, { force: true });
