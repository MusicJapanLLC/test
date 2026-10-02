// SNS・AIの引用で使う画像（1200×630）と、PNG/ICO のファビコンを作る。
// 使い方：`npm run build` のあとに `npm run og`（ブラウザは Playwright の Chromium を使う）。
// 一部の会社だけ作り直すとき：`OG_ONLY=music-japan npm run og`（キーの先頭で絞る。ファビコンは作り直さない）
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

const only = process.env.OG_ONLY;
const items = JSON.parse(readFileSync(resolve(root, '.og-manifest.json'), 'utf8')).filter((it) => !only || it.key.startsWith(only));
const font = (pkg, weight) => pathToFileURL(resolve(root, 'node_modules/@fontsource', pkg, `${weight}.css`)).href;
const file = (p) => pathToFileURL(resolve(root, 'public', p.replace(/^\//, ''))).href;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bpLogo = readFileSync(resolve(root, 'public/brand/baton-partners-logo.svg'), 'utf8');

// minka（Cominkaなど）は生成りの和紙に麻の葉、朱の判子。見出しはしっぽり明朝
const asanoha = readFileSync(resolve(root, 'src/styles/theme-minka.css'), 'utf8').match(/--asanoha:\s*url\("([^"]+)"\)/)?.[1] ?? '';
const fontFile = (name) => pathToFileURL(resolve(root, 'public/fonts', name)).href;

function minka(it) {
  const brand = it.brand ?? '#E5262B';
  const long = it.heading.length > 26;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-old-mincho', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  @font-face{font-family:'SMB1h';font-weight:800;src:url('${fontFile('shippori-mincho-b1-800-h.woff2')}') format('woff2')}
  @font-face{font-family:'SMB1r';font-weight:800;src:url('${fontFile('shippori-mincho-b1-800.woff2')}') format('woff2')}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#F6F1E6;font-family:'Zen Kaku Gothic New',sans-serif;color:#1A1311;position:relative;overflow:hidden}
  .wa{position:absolute;right:0;top:0;bottom:0;width:430px;background-image:url("${asanoha}");background-size:36px 62.36px;-webkit-mask:linear-gradient(90deg,transparent,#000 60%);mask:linear-gradient(90deg,transparent,#000 60%)}
  .ink{position:absolute;left:0;top:0;bottom:0;width:18px;background:#1A1311}
  .shu{position:absolute;left:18px;top:0;bottom:0;width:6px;background:${brand}}
  .seal{position:absolute;right:96px;top:220px;width:132px;height:132px;background:${brand};color:#fff;display:grid;place-items:center;font-family:'SMB1h','SMB1r','Zen Old Mincho',serif;font-weight:800;font-size:92px;line-height:1;transform:rotate(-4deg);box-shadow:inset 0 0 0 6px ${brand},inset 0 0 0 9px #ffffffcc;border-radius:6px}
  .in{position:absolute;inset:64px 300px 56px 96px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:24px}
  .top img{height:52px;width:auto}
  .label{font-size:20px;font-weight:700;letter-spacing:.18em;color:${brand};text-transform:uppercase}
  h1{font-family:'SMB1h','SMB1r','Zen Old Mincho',serif;font-weight:800;font-size:${long ? 50 : 72}px;line-height:1.42;letter-spacing:.02em;word-break:keep-all;overflow-wrap:anywhere}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:40px;font-size:22px;font-weight:700;color:#5A3A28;width:calc(100% + 220px)}
  .foot svg{height:40px;width:auto}
</style></head><body>
<div class="wa"></div><div class="ink"></div><div class="shu"></div><div class="seal">縁</div>
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="label">${esc(it.label)}</span></div>
  <h1>${esc(it.heading)}</h1>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</div></body></html>`;
}

// relay（Music Japan）は白に、ロゴの赤い輪と点。足もとにトラックのレーン、見出しは極太のゴシック
function relay(it) {
  const red = it.accent ?? '#C8102E';
  const long = it.heading.length > 24;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#fff;font-family:'Zen Kaku Gothic New',sans-serif;color:#0D0D0F;position:relative;overflow:hidden}
  .lanes{position:absolute;left:0;right:0;bottom:0;height:150px;background:repeating-linear-gradient(180deg,transparent 0 24px,#ffffff66 24px 26px),linear-gradient(180deg,#C8102E,#A8112A)}
  .lanes::after{content:'';position:absolute;left:640px;top:0;bottom:0;width:12px;background:#fff}
  .ring{position:absolute;right:96px;top:70px;width:250px;height:250px;border-radius:50%;border:5px solid ${red}}
  .dot{position:absolute;right:203px;top:177px;width:36px;height:36px;border-radius:50%;background:${red}}
  .baton{position:absolute;left:700px;bottom:58px;width:130px;height:32px;border-radius:99px;background:linear-gradient(90deg,transparent 0 66%,${red} 66% 74%,transparent 74%),linear-gradient(180deg,#fff,#eee);box-shadow:-40px 0 0 -10px #ffffff88,-80px 0 0 -12px #ffffff44}
  .in{position:absolute;inset:60px 80px 186px 88px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{height:44px;width:auto}
  .label{font-size:20px;font-weight:700;letter-spacing:.2em;color:#0D0D0F;text-transform:uppercase}
  h1{font-weight:900;font-size:${long ? 50 : 66}px;line-height:1.3;letter-spacing:0;max-width:760px;word-break:keep-all;overflow-wrap:anywhere}
  .foot{position:absolute;left:88px;right:80px;bottom:52px;display:flex;align-items:center;justify-content:space-between;color:#fff;font-size:22px;font-weight:700}
  .foot svg{height:38px;width:auto;background:#fff;border-radius:99px;padding:6px 16px}
</style></head><body>
<div class="ring"></div><div class="dot"></div><div class="lanes"></div><div class="baton"></div>
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="label">${esc(it.label)}</span></div>
  <h1>${esc(it.heading)}</h1>
</div>
<div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</body></html>`;
}

function html(it) {
  if (it.theme === 'minka') return minka(it);
  if (it.theme === 'relay') return relay(it);
  const con = it.theme === 'console';
  // console（DPパートナーズなど）も見出しは太いゴシック。方眼は点、縦の帯は紺から復旧の緑へ
  const mono = it.theme === 'mono' || con;
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
  .grid{position:absolute;inset:0;background-image:${con ? 'radial-gradient(#0a163024 1.4px,transparent 1.8px)' : mono ? 'linear-gradient(#0000000d 1px,transparent 1px),linear-gradient(90deg,#0000000d 1px,transparent 1px)' : 'none'};background-size:${con ? '28px 28px' : '48px 48px'}}
  .glow{position:absolute;right:-160px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle, ${brand}22, transparent 65%)}
  .glow2{position:absolute;right:120px;bottom:-220px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${accent}22, transparent 65%)}
  .bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:${con ? `linear-gradient(180deg, ${brand}, ${accent})` : mono ? '#0E0F12' : `linear-gradient(180deg, ${brand}, ${accent})`}}
  .in{position:absolute;inset:64px 80px 56px 96px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:24px}
  .top img{height:56px;width:auto}
  .label{font-size:22px;font-weight:700;letter-spacing:.12em;color:${con ? brand : mono ? '#0E0F12' : brand};text-transform:uppercase}
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

// ファビコン（SVG のマークを PNG に）。一部だけ作り直すときは触らない
const mark = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
for (const [name, size] of only ? [] : [['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['.favicon-48.png', 48]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:${name.startsWith('apple') ? '#fff' : 'transparent'}">${mark.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: resolve(root, 'public', name), omitBackground: !name.startsWith('apple') });
  await p.close();
  console.log('icon', name);
}
await browser.close();
(await import('node:fs')).rmSync(tmp, { force: true });
