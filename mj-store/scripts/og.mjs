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
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Unbounded:wght@600;800&family=DotGothic16&family=Shippori+Mincho+B1:wght@800&family=Cinzel:wght@700&display=block';
const file = (p) => pathToFileURL(resolve(root, 'public', p)).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const shell = (body, bg) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:${bg};color:#fff;font-family:'Zen Kaku Gothic New',sans-serif;font-feature-settings:'palt'}
.logo{display:flex;align-items:center;gap:10px}
.mark{display:grid;place-items:center;width:46px;height:42px;border-radius:12px;background:#ff4d2e;font-family:Unbounded;font-weight:800;font-size:15px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}
.word{font-family:Unbounded;font-weight:600;font-size:18px;letter-spacing:.26em}
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
       <div class="logo"><span class="mark">MJ</span><span class="word">STORE</span></div>
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
    .map(
      (g, i) => `<div style="position:relative;width:200px;height:300px;border-radius:20px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(${[-6, -2, 2, 6][i % 4]}deg) translateY(${[20, 0, 0, 20][i % 4]}px)">
        <img src="${file(g.shots[0].src)}" style="width:100%;height:100%;object-fit:cover;object-position:${g.cardFocus}">
        <p style="position:absolute;left:14px;right:14px;bottom:12px;font-family:${g.theme.font};font-size:17px;line-height:1.25;text-shadow:0 2px 12px rgba(0,0,0,.7)">${esc(g.title)}</p>
      </div>`,
    )
    .join('');
  return shell(
    `<div style="position:absolute;inset:0;background:radial-gradient(60% 70% at 85% 10%,rgba(255,77,46,.28),transparent 70%),radial-gradient(50% 60% at 0% 100%,rgba(255,181,71,.16),transparent 70%)"></div>
     <div style="position:absolute;left:64px;top:60px"><div class="logo"><span class="mark" style="width:62px;height:56px;font-size:20px;border-radius:16px">MJ</span><span class="word" style="font-size:30px">STORE</span></div></div>
     <h1 style="position:absolute;left:64px;top:170px;font-weight:900;font-size:58px;line-height:1.15;letter-spacing:-.01em">音楽も、物語も、<br>システムも。<br><span style="color:#ff4d2e">ぜんぶ自社製。</span></h1>
     <p style="position:absolute;left:64px;bottom:56px;font-weight:700;font-size:20px;opacity:.85">${esc(site.operator.name)} の公式ゲームストア ・ 全作品 基本プレイ無料</p>
     <div style="position:absolute;right:-6px;top:160px;display:flex;transform:scale(.9);transform-origin:right top">${cards.replace(/<div style="position:relative;/g, '<div style="margin-left:-40px;position:relative;')}</div>`,
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
