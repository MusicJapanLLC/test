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

const items = JSON.parse(readFileSync(resolve(root, '.og-manifest.json'), 'utf8'));
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

// needle（Music Japan）は公式サイトと同じ黒。右に、公式シンボルを刷った赤いラベルのレコード。見出しは極太のゴシック
const bpLogoWhite = readFileSync(resolve(root, 'public/brand/baton-partners-logo-white.svg'), 'utf8');
const fsv = (pkg, name) => pathToFileURL(resolve(root, 'node_modules/@fontsource-variable', pkg, 'files', name)).href;
function needle(it) {
  const red = it.brand ?? '#e1222f';
  const top = it.key.endsWith('-top');
  const long = it.heading.length > 24;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  @font-face{font-family:'ArchivoW';font-weight:100 900;font-stretch:62% 125%;src:url('${fsv('archivo', 'archivo-latin-wdth-normal.woff2')}') format('woff2')}
  @font-face{font-family:'JBM';font-weight:100 800;src:url('${fsv('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}') format('woff2')}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#060607;font-family:'Zen Kaku Gothic New',sans-serif;color:#efe9e0;position:relative;overflow:hidden}
  .lp{position:absolute;right:-170px;top:50px;width:640px;height:640px;border-radius:50%;
    background:radial-gradient(circle,transparent 0 31%,#0008 31.3%,transparent 32.4%),
      radial-gradient(circle,transparent 0 62%,#efe9e012 62.3%,transparent 62.8%,transparent 80%,#efe9e010 80.3%,transparent 80.8%),
      repeating-radial-gradient(circle,#09090b 0 1.5px,#1d1d22 1.5px 2.2px,#09090b 2.2px 3.4px);
    box-shadow:0 0 0 1px #efe9e01a,0 40px 90px -30px #000}
  .shine{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0deg,#ffffff1c 20deg,#78b4ff12 34deg,transparent 60deg,transparent 180deg,#ffffff16 200deg,#ff788c10 214deg,transparent 240deg)}
  .label{position:absolute;inset:33%;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 35%,#f0303d,${red} 55%,#b11320)}
  .label img{width:46%}
  .glow{position:absolute;right:40px;top:120px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,#e1222f2a,transparent 65%)}
  .deck{position:absolute;right:56px;top:44px;display:grid;justify-items:end;gap:6px;font-family:'JBM',monospace;font-size:14px;letter-spacing:.26em;color:#8d867e}
  .in{position:absolute;inset:56px 430px 52px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{height:34px;width:auto}
  .k{font-family:'JBM',monospace;font-size:16px;letter-spacing:.22em;color:${red};text-transform:uppercase}
  .disp{font-family:'ArchivoW',sans-serif;font-weight:900;font-stretch:112%;font-size:108px;line-height:.84;letter-spacing:-.035em;margin-bottom:18px}
  .disp span{display:block}.disp span:nth-child(2){padding-left:.9em}.disp span:last-child{color:${red}}
  h1{font-weight:900;font-size:${top ? 40 : long ? 50 : 64}px;line-height:1.36;letter-spacing:.02em;word-break:keep-all;overflow-wrap:anywhere}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:40px;font-size:20px;font-weight:700;color:#cfc7bc;width:calc(100% + 360px)}
  .foot svg{height:36px;width:auto}
</style></head><body>
<div class="glow"></div>
<div class="lp"><div class="shine"></div><div class="label"><img src="${file('/partners/music-japan/mark.svg')}" alt=""></div></div>
<div class="deck"><span>45 RPM</span><span>SIDE A</span><span>NOW SPINNING — BP-000</span></div>
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="k">${esc(it.label)}</span></div>
  <div>${top ? '<p class="disp"><span>PASS</span><span>THE</span><span>BATON.</span></p>' : ''}<h1>${esc(it.heading)}</h1></div>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogoWhite}</div>
</div></body></html>`;
}

// studio（Smartaleckなど）は白地に青の網点と集中線、ファインダーの四隅とREC。右に代表の写真をコマの枠で
function studio(it) {
  const brand = it.brand ?? '#1F92CA';
  const ink = it.accent ?? '#231815';
  const long = it.heading.length > 20;
  const hero = /HERO$/.test(it.heading);
  const head = hero
    ? `<span class="h1a">${esc(it.heading.replace(/HERO$/, ''))}</span><span class="h1b">HERO</span>`
    : esc(it.heading);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  @font-face{font-family:'DGOh';src:url('${fontFile('dela-gothic-one-400-h.woff2')}') format('woff2')}
  @font-face{font-family:'DGOr';src:url('${fontFile('dela-gothic-one-400.woff2')}') format('woff2')}
  @font-face{font-family:'ArchivoX';font-style:italic;font-weight:100 900;font-stretch:62% 125%;src:url('${pathToFileURL(resolve(root, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-italic.woff2')).href}') format('woff2')}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#fff;font-family:'Zen Kaku Gothic New',sans-serif;color:${ink};position:relative;overflow:hidden}
  .tone{position:absolute;inset:0;background:radial-gradient(circle,${brand}55 1.5px,transparent 2px) 0 0/14px 14px;-webkit-mask:radial-gradient(ellipse 50% 80% at 86% 50%,#000,transparent 80%);mask:radial-gradient(ellipse 50% 80% at 86% 50%,#000,transparent 80%)}
  .speed{position:absolute;left:640px;top:-250px;width:1130px;height:1130px;border-radius:50%;background:repeating-conic-gradient(${ink}1c 0 .7deg,transparent .7deg 4.3deg);-webkit-mask:radial-gradient(circle,transparent 20%,#000 32%,transparent 66%);mask:radial-gradient(circle,transparent 20%,#000 32%,transparent 66%)}
  .c{position:absolute;width:46px;height:46px;border:0 solid ${ink}}
  .tl{left:28px;top:28px;border-left-width:5px;border-top-width:5px}
  .tr{right:28px;top:28px;border-right-width:5px;border-top-width:5px}
  .bl{left:28px;bottom:28px;border-left-width:5px;border-bottom-width:5px}
  .br{right:28px;bottom:28px;border-right-width:5px;border-bottom-width:5px}
  .rec{position:absolute;right:92px;top:36px;display:flex;align-items:center;gap:10px;font-family:'ArchivoX',sans-serif;font-style:italic;font-weight:900;font-stretch:78%;font-size:22px;letter-spacing:.08em}
  .rec i{width:16px;height:16px;border-radius:50%;background:#FF3B30}
  .photo{position:absolute;right:96px;top:104px;width:290px;height:392px;border:5px solid ${ink};border-radius:30px;overflow:hidden;box-shadow:12px 12px 0 ${brand};background:#eee}
  .photo img{width:100%;height:100%;object-fit:cover;object-position:50% 22%}
  .in{position:absolute;inset:70px 450px 58px 84px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{height:34px;width:auto}
  .label{font-family:'ArchivoX',sans-serif;font-style:italic;font-weight:800;font-stretch:80%;font-size:21px;letter-spacing:.14em;color:${ink};text-transform:uppercase}
  h1{font-family:'DGOh','DGOr','Zen Kaku Gothic New',sans-serif;font-weight:400;font-size:${long ? 46 : 60}px;line-height:1.36;letter-spacing:.02em;word-break:keep-all;overflow-wrap:anywhere}
  .h1a{display:block;font-size:46px}
  .h1b{display:block;margin-top:6px;font-family:'ArchivoX',sans-serif;font-style:italic;font-weight:900;font-stretch:72%;font-size:190px;line-height:.86;color:${brand};-webkit-text-stroke:5px ${ink};paint-order:stroke fill;text-shadow:9px 9px 0 ${ink}}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:40px;font-size:21px;font-weight:700;color:#4b403b;width:calc(100% + 360px)}
  .foot svg{height:38px;width:auto}
</style></head><body>
<div class="tone"></div><div class="speed"></div>
<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div>
<div class="rec"><i></i>REC</div>
${it.photo ? `<div class="photo"><img src="${file(it.photo)}" alt=""></div>` : ''}
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="label">${esc(it.label)}</span></div>
  <h1>${head}</h1>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</div></body></html>`;
}

// 長い見出しは、句読点（、。）のあとで改行し、いちばん長い行が幅に収まる大きさにする（単語の途中で折り返さない）
function fitLines(text, width, max) {
  const lines = text.replace(/([、。])/g, '$1\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const len = (l) => [...l].reduce((n, c) => n + (/[ -~]/.test(c) ? 0.6 : 1), 0);
  const size = Math.min(max, Math.floor(width / Math.max(...lines.map(len))));
  return { size, html: lines.map((l) => `<span style="display:block;white-space:nowrap">${esc(l)}</span>`).join('') };
}

// match（エボルグ / Empro など）は白地に方眼の点。右に、赤と水色の三角が重なった大きな印。見出しは太い丸ゴシック
function match(it) {
  const red = '#EF2B33';
  const cyan = it.accent ?? '#1CCCE8';
  const plum = '#A8284A';
  const fit = fitLines(it.heading, 620, 58);
  const clip = 'polygon(0 0,50% 41.7%,100% 0,100% 100%,50% 58.3%,0 100%)';
  const fill = `linear-gradient(90deg,${red} 0 42%,${plum} 42% 58%,${cyan} 58%)`;
  // 小さな三角を散らす（決まった並び。毎回同じ画像になるように）
  const tris = Array.from({ length: 26 }, (_, i) => {
    const x = 640 + ((i * 137) % 520);
    const y = 30 + ((i * 89) % 560);
    const s = 16 + ((i * 7) % 22);
    const r = (i * 47) % 360;
    const c = i % 5 === 0 ? '#c3c8d0' : i % 2 ? red : cyan;
    const dir = i % 2 ? 'polygon(0 0,100% 50%,0 100%)' : 'polygon(100% 0,0 50%,100% 100%)';
    return `<i style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${c};clip-path:${dir};transform:rotate(${r}deg);opacity:.55"></i>`;
  }).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  @font-face{font-family:'ZMGh';font-weight:900;src:url('${fontFile('zen-maru-gothic-900-h.woff2')}') format('woff2')}
  @font-face{font-family:'ZMGr';font-weight:900;src:url('${fontFile('zen-maru-gothic-900.woff2')}') format('woff2')}
  @font-face{font-family:'PJS';font-weight:200 800;src:url('${fsv('plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2')}') format('woff2')}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#fff;font-family:'Zen Kaku Gothic New',sans-serif;color:#121826;position:relative;overflow:hidden}
  .dots{position:absolute;inset:0;background:radial-gradient(circle,#12182618 1.4px,transparent 1.9px) 0 0/22px 22px;-webkit-mask:radial-gradient(ellipse 55% 85% at 80% 50%,#000,transparent 80%);mask:radial-gradient(ellipse 55% 85% at 80% 50%,#000,transparent 80%)}
  .sc i{position:absolute;display:block}
  .mark{position:absolute;right:76px;top:196px;width:340px;height:236px;background:${fill};clip-path:${clip};filter:drop-shadow(0 30px 40px #12182633)}
  .ring{position:absolute;right:30px;top:58px;width:520px;height:520px;border-radius:50%;border:2px solid ${plum}33}
  .ring2{position:absolute;right:-40px;top:-12px;width:660px;height:660px;border-radius:50%;border:2px solid ${plum}1a}
  .bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,${red},${plum} 50%,${cyan})}
  .in{position:absolute;inset:66px 560px 60px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{height:40px;width:auto}
  .label{font-family:'PJS',sans-serif;font-weight:800;font-size:19px;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:12px}
  .label::before{content:'';width:30px;height:20px;background:${fill};clip-path:${clip}}
  h1{font-family:'ZMGh','ZMGr','Zen Kaku Gothic New',sans-serif;font-weight:900;font-size:${fit.size}px;line-height:1.36;letter-spacing:.02em;width:calc(100% + 80px)}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:40px;font-size:21px;font-weight:700;color:#3a4252;width:calc(100% + 480px)}
  .foot svg{height:38px;width:auto}
</style></head><body>
<div class="dots"></div><div class="sc">${tris}</div><div class="ring2"></div><div class="ring"></div><div class="mark"></div><div class="bar"></div>
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}</div>
  <div><p class="label">${esc(it.label)}</p><h1 style="margin-top:18px">${fit.html}</h1></div>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</div></body></html>`;
}

// mono（Central AX など）は白地に方眼、名古屋駅の座標と十字線。右に代表の写真をトンボの枠で（白黒）
function monoOg(it) {
  const signal = it.accent ?? '#2B4BFF';
  const fit = fitLines(it.heading, 660, 62);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 900)}">
<link rel="stylesheet" href="${font('zen-kaku-gothic-new', 700)}">
<style>
  @font-face{font-family:'JBM';font-weight:100 800;src:url('${fsv('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}') format('woff2')}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#fff;font-family:'Zen Kaku Gothic New',sans-serif;color:#0E0F12;position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(#0000000f 1px,transparent 1px),linear-gradient(90deg,#0000000f 1px,transparent 1px);background-size:40px 40px}
  .cx{position:absolute;left:0;right:0;top:300px;height:1px;background:#0E0F1240}
  .cy{position:absolute;top:0;bottom:0;left:940px;width:1px;background:#0E0F1240}
  .scan{position:absolute;left:640px;right:0;top:420px;height:3px;background:linear-gradient(90deg,transparent,${signal} 30%,${signal} 70%,transparent);box-shadow:0 0 22px 3px ${signal}66}
  .deck{position:absolute;right:48px;top:36px;display:grid;justify-items:end;gap:4px;font-family:'JBM',monospace;font-size:15px;font-weight:600;letter-spacing:.12em}
  .deck span:first-child::before{content:'';display:inline-block;width:11px;height:11px;background:${signal};margin-right:10px}
  .deck span:last-child{color:#6a6e79}
  .photo{position:absolute;right:120px;top:96px;width:300px;height:400px;padding:14px;background:#fff}
  .photo img{width:100%;height:100%;object-fit:cover;object-position:50% 16%;filter:grayscale(1) contrast(1.06)}
  .m{position:absolute;width:28px;height:28px;border:0 solid #0E0F12}
  .m1{left:0;top:0;border-left-width:4px;border-top-width:4px}.m2{right:0;top:0;border-right-width:4px;border-top-width:4px}
  .m3{left:0;bottom:0;border-left-width:4px;border-bottom-width:4px}.m4{right:0;bottom:0;border-right-width:4px;border-bottom-width:4px}
  .cap{position:absolute;left:14px;right:14px;bottom:-30px;display:flex;justify-content:space-between;font-family:'JBM',monospace;font-size:13px;font-weight:600;letter-spacing:.08em}
  .bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:#0E0F12}
  .in{position:absolute;inset:64px 480px 56px 86px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{height:50px;width:auto}
  .label{font-size:19px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
  h1{font-weight:900;font-size:${fit.size}px;line-height:1.38;letter-spacing:.01em;width:calc(100% + 60px)}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:40px;font-size:21px;font-weight:700;color:#3a3b40;width:calc(100% + 400px)}
  .foot svg{height:38px;width:auto}
</style></head><body>
<div class="grid"></div><div class="cx"></div><div class="cy"></div><div class="scan"></div><div class="bar"></div>
<div class="deck"><span>35.17°N 136.88°E</span><span>NAGOYA / MEIEKI</span></div>
${it.photo ? `<div class="photo"><img src="${file(it.photo)}" alt=""><i class="m m1"></i><i class="m m2"></i><i class="m m3"></i><i class="m m4"></i><p class="cap"><span>CEO</span><span>${esc(it.company)}</span></p></div>` : ''}
<div class="in">
  <div class="top">${it.logo ? `<img src="${file(it.logo)}" alt="">` : ''}<span class="label">${esc(it.label)}</span></div>
  <h1>${fit.html}</h1>
  <div class="foot"><span>${esc(it.company)}</span>${bpLogo}</div>
</div></body></html>`;
}
function html(it) {
  if (it.theme === 'minka') return minka(it);
  if (it.theme === 'needle') return needle(it);
  if (it.theme === 'studio') return studio(it);
  if (it.theme === 'match') return match(it);
  if (it.theme === 'mono') return monoOg(it);
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
for (const it of items.filter((x) => !process.env.OG_ONLY || x.key.startsWith(process.env.OG_ONLY))) {
  writeFileSync(tmp, html(it));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'public/og', `${it.key}.png`) });
  console.log('og', it.key);
}

// ファビコン（SVG のマークを PNG に）。一部だけ作り直すときは触らない
const mark = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
// OG_ONLY を付けたときは、指定した企業の画像だけ作り直す（ファビコンには触らない）
for (const [name, size] of process.env.OG_ONLY ? [] : [['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['.favicon-48.png', 48]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:${name.startsWith('apple') ? '#fff' : 'transparent'}">${mark.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: resolve(root, 'public', name), omitBackground: !name.startsWith('apple') });
  await p.close();
  console.log('icon', name);
}
await browser.close();
(await import('node:fs')).rmSync(tmp, { force: true });
