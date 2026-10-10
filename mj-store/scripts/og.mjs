/**
 * OGP 画像（1200×630）を作る。SNS やチャットにリンクを貼ったときに出る絵。
 * 実際のゲーム画面（public/shots/）を使って、作品ごと＋ストア全体の分を public/og/ に書き出す。
 *
 * 使い方（作品を足したら一度だけ実行して、できた画像をコミットする）:
 *   node --experimental-strip-types scripts/og.mjs
 *
 * Playwright（Chromium）が必要。
 */
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const { games } = await import(pathToFileURL(resolve(root, 'src/data/games.ts')).href);
const { site } = await import(pathToFileURL(resolve(root, 'src/data/site.ts')).href);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs'));
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Unbounded:wght@600;800&family=DotGothic16&family=Shippori+Mincho+B1:wght@800&family=Cinzel:wght@700&family=Silkscreen:wght@700&display=block';

/* ロゴのマーク（src/render/brand.ts と同じ絵） */
const GROOVES = [22, 17.5, 13].map((r) => `<circle cx="32" cy="32" r="${r}"/>`).join('');
const MARK = `<svg class="mark" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2b33"/><stop offset=".55" stop-color="#16161b"/><stop offset="1" stop-color="#0a0a0d"/></linearGradient>
    <radialGradient id="shine" cx=".22" cy=".12" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#ff3b30" stop-opacity=".75"/></linearGradient>
    <radialGradient id="red" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff7a6b"/><stop offset=".45" stop-color="#ef2a2a"/><stop offset="1" stop-color="#a50f1c"/></radialGradient>
    <clipPath id="l"><rect width="32" height="64"/></clipPath><clipPath id="r"><rect x="32" width="32" height="64"/></clipPath>
    <filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bg)"/><rect width="64" height="64" rx="15" fill="url(#shine)"/>
  <rect x=".6" y=".6" width="62.8" height="62.8" rx="14.4" fill="none" stroke="url(#rim)" stroke-width="1.2"/>
  <g fill="none" stroke="#efe9e0"><g clip-path="url(#l)" stroke-width="1.6">${GROOVES}</g><g clip-path="url(#r)" stroke-opacity=".4" stroke-width="1.1">${GROOVES}</g></g>
  <circle cx="33" cy="32" r="8" fill="#ff3b30" opacity=".5" filter="url(#halo)"/>
  <path d="M28.6 25.6 39.4 32 28.6 38.4Z" fill="url(#red)" stroke="url(#red)" stroke-width="2.4" stroke-linejoin="round"/>
</svg>`;
const LOGO = (h = 46) =>
  `<div class="logo" style="--h:${h}px">${MARK}<span class="word">MJ<b>STORE</b></span></div>`;

/* ちびロボ（公式サイトと同じドット絵）を OGP に描くため、描画コードをまとめておく */
let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  esbuild = null;
}
const CREW_JS = esbuild
  ? (
      await esbuild.build({
        entryPoints: [resolve(root, 'src/lib/crew/bots.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'MJCrew',
        write: false,
      })
    ).outputFiles[0].text
  : '';
const file = (p) => pathToFileURL(resolve(root, 'public', p)).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const shell = (body, bg) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:${bg};color:#fff;font-family:'Zen Kaku Gothic New',sans-serif;font-feature-settings:'palt'}
.logo{display:flex;align-items:center;gap:calc(var(--h)*.3)}
.logo .mark{width:var(--h);height:var(--h);filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.word{display:flex;align-items:baseline;gap:.3em;font-family:Unbounded;font-weight:800;font-size:calc(var(--h)*.5);line-height:1}
.word b{font-family:Silkscreen;font-weight:700;font-size:.86em;letter-spacing:.08em;background:linear-gradient(180deg,#ff6a4d,#ffb547);-webkit-background-clip:text;color:transparent}
</style></head><body>${body}</body></html>`;

function gameOg(g) {
  const t = g.theme;
  const play = g.shots[1] ?? g.shots[0];
  const phone = g.device === 'phone';
  /* スマホのブラウザで撮った画面は、アドレスバーごと見せる（ストアの実機フレームと同じ） */
  const inBrowser = play.h < play.w * 1.95;
  const host = g.playUrl.replace(/^https?:\/\//, '').split('/')[0];
  const screen = inBrowser
    ? `<div style="display:flex;flex-direction:column;width:100%;height:100%;border-radius:32px;overflow:hidden;background:#2a2d31">
         <div style="flex:none;height:72px;display:flex;align-items:flex-end;padding:0 12px 9px"><span style="flex:1;height:27px;border-radius:999px;background:rgba(255,255,255,.12);display:grid;place-items:center;font:500 11px/1 'Helvetica Neue',sans-serif;color:rgba(255,255,255,.85)">${esc(host)}</span></div>
         <img src="${file(play.src)}" style="display:block;width:100%">
       </div>`
    : `<img src="${file(play.src)}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:32px">`;
  const device = phone
    ? `<div style="position:absolute;right:70px;top:46px;width:250px;height:541px;padding:9px;border-radius:40px;background:linear-gradient(145deg,#2b2b31,#0d0d10);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.14);transform:rotate(3deg)">
         ${screen}
         <span style="position:absolute;top:18px;left:50%;width:74px;height:21px;margin-left:-37px;border-radius:999px;background:#050506"></span>
       </div>
       ${g.shots[0] && g.shots[1] ? `<div style="position:absolute;right:300px;top:120px;width:190px;height:411px;padding:7px;border-radius:32px;background:#0d0d10;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(-6deg);opacity:.92">
         <img src="${file(g.shots[0].src)}" style="width:100%;height:100%;object-fit:cover;border-radius:26px">
       </div>` : ''}`
    : `<div style="position:absolute;right:-60px;top:110px;width:720px;border-radius:14px;overflow:hidden;background:#1a1c1f;box-shadow:0 40px 90px rgba(0,0,0,.55);transform:perspective(1600px) rotateY(-14deg)">
         <div style="height:28px;background:#24272b;display:flex;align-items:center;gap:6px;padding:0 12px"><i style="width:9px;height:9px;border-radius:50%;background:#ff5f57"></i><i style="width:9px;height:9px;border-radius:50%;background:#febc2e"></i><i style="width:9px;height:9px;border-radius:50%;background:#28c840"></i></div>
         <img src="${file(play.src)}" style="display:block;width:100%">
       </div>`;
  const longest = Math.max(...g.catch.map((l) => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? t.latinWidth : 1), 0)));
  const size = Math.min(84, Math.floor((phone ? 600 : 560) / (longest + 0.3)));
  const darkBg = t.scheme === 'light' ? '#1F2D26' : t.bg;
  return shell(
    `<img src="${file(g.shots[0].src)}" style="position:absolute;inset:-40px;width:1280px;height:710px;object-fit:cover;filter:blur(28px) saturate(1.3);opacity:.45">
     <div style="position:absolute;inset:0;background:linear-gradient(90deg,${darkBg} 0%,${darkBg}e6 48%,${darkBg}55 100%)"></div>
     ${device}
     <div style="position:absolute;left:64px;top:56px;bottom:56px;width:${phone ? 640 : 600}px;display:flex;flex-direction:column">
       ${LOGO(46)}
       <p style="margin-top:auto;font-family:${t.font};font-size:30px;color:${t.scheme === 'light' ? '#E8C96B' : t.accent}">${esc(g.title)}</p>
       <h1 style="margin-top:14px;font-family:${t.font};font-weight:400;font-size:${size}px;line-height:1.08;text-shadow:0 6px 30px rgba(0,0,0,.4)">${g.catch.map(esc).join('<br>')}</h1>
       <p style="margin-top:26px;display:flex;gap:12px;align-items:center;font-weight:900;font-size:20px">
         <span style="padding:6px 16px;border-radius:999px;background:${t.scheme === 'light' ? '#A64B38' : t.accent};color:${t.scheme === 'light' ? '#fff' : t.onAccent}">基本プレイ無料</span>
         <span style="opacity:.85">ブラウザですぐ遊べる</span>
       </p>
     </div>`,
    darkBg,
  );
}

function storeOg() {
  const cards = games
    .map((g, i) => {
      const art = g.shots[g.cardShot ?? 0] ?? g.shots[0];
      return `<div style="position:relative;width:190px;height:285px;margin-left:-34px;border-radius:20px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(${[-6, -2, 2, 6][i % 4]}deg) translateY(${[20, 0, 0, 20][i % 4]}px)">
        <img src="${file(art.src)}" style="width:100%;height:100%;object-fit:cover;object-position:${g.cardFocus}">
        <div style="position:absolute;inset:auto 0 0;height:50%;background:linear-gradient(transparent,rgba(0,0,0,.75))"></div>
        <p style="position:absolute;left:14px;right:14px;bottom:12px;font-family:${g.theme.font};font-size:16px;line-height:1.25;text-shadow:0 2px 12px rgba(0,0,0,.7)">${esc(g.title)}</p>
      </div>`;
    })
    .join('');
  const bots = [0, 1, 2, 3, 4].map((i) => `<canvas data-bot="${i}" width="32" height="48" style="width:64px;height:96px;image-rendering:pixelated"></canvas>`).join('');
  return shell(
    `<div style="position:absolute;inset:0;background:radial-gradient(60% 70% at 85% 10%,rgba(255,77,46,.26),transparent 70%),radial-gradient(50% 60% at 0% 100%,rgba(255,181,71,.14),transparent 70%)"></div>
     <div style="position:absolute;left:64px;top:56px">${LOGO(62)}</div>
     <h1 style="position:absolute;left:64px;top:180px;font-weight:900;font-size:46px;line-height:1.2;letter-spacing:-.01em">音楽も、物語も、<br>システムも。<br><span style="color:#ff4d2e">Music Japanのゲーム。</span></h1>
     <p style="position:absolute;left:64px;bottom:52px;font-weight:700;font-size:19px;opacity:.85">全作品 基本プレイ無料 ・ ブラウザですぐ遊べる</p>
     <div style="position:absolute;right:24px;top:118px;display:flex;transform:scale(.8);transform-origin:right top">${cards}</div>
     <div style="position:absolute;right:56px;bottom:26px;display:flex;gap:12px">${bots}</div>
     <script>${CREW_JS}
       document.querySelectorAll('canvas[data-bot]').forEach((c) => {
         const P = MJCrew.newPose(0); P.face = ['smile','smile','cool','open','grin'][+c.dataset.bot]; P.armR = +c.dataset.bot === 0 ? 'wave1' : 'down';
         MJCrew.renderRobot(c.getContext('2d'), +c.dataset.bot, P);
       });
     </script>`,
    '#0c0c0e',
  );
}

mkdirSync(resolve(root, 'public/og'), { recursive: true });
const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const jobs = [['store', storeOg()], ...games.map((g) => [g.slug, gameOg(g)])];
const tmp = mkdtempSync(join(tmpdir(), 'mj-og-'));
for (const [name, html] of jobs) {
  /* file:// の画像を読むため、いったんファイルに書いて開く */
  const htmlPath = join(tmp, `${name}.html`);
  writeFileSync(htmlPath, html);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = resolve(root, 'public/og', `${name}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log('wrote', out);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
