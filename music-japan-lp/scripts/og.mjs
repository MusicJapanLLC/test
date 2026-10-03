// SNS・検索で使う画像（public/og/<ページ>.png 1200×630）と apple-touch-icon.png を作る。
// 使い方：npm run build のあと npm run og（画像はコミットする。Vercel のビルドではブラウザを動かさない）
//   dist/ をこのスクリプトの中で配信し、各ページの最初の画面の絵（トップはWebGLのレコード）を撮って、
//   同じ書体・同じ色で 1200×630 に組み直す。
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(dist, p);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, ok));
const base = `http://localhost:${server.address().port}`;
const HOST = 'about.music-japan.com';

const PAGES = [
  ['top', '/', '.hero-visual'],
  ['partners', '/baton-partners/', '.phero-aside'],
  ['baton', '/baton/', '.phero-aside'],
  ['secondtake', '/second-take/', '.phero-aside'],
  ['works', '/works/', '.phero-aside'],
  ['news', '/news/', '.phero-aside'],
  ['about', '/about/', '.phero-aside'],
  ['talk', '/talk/', '.phero-aside'],
];

const CSS = `
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--paper); }
*, *::before, *::after { transition: none !important; animation: none !important; }
.og { position: relative; box-sizing: border-box; width: 1200px; height: 630px; padding: 60px 72px 50px; display: grid;
  grid-template-columns: minmax(0, 1fr) 420px; grid-template-rows: minmax(0, 1fr) auto; column-gap: 44px; }
.og-copy { position: relative; z-index: 2; align-self: center; display: grid; gap: 22px; }
.og-label { display: inline-flex; align-items: center; gap: 12px; font-family: var(--f-sans); font-weight: 700; font-size: 22px; letter-spacing: .12em; color: var(--mute); }
.og-label::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.og-title { font-family: var(--f-serif); font-weight: 700; font-size: 88px; line-height: 1.08; color: var(--ink); white-space: nowrap; }
.og-title.is-jp { font-size: 76px; line-height: 1.25; }
.og-catch { font-family: var(--f-serif); font-weight: 700; font-size: 34px; line-height: 1.55; color: var(--ink); }
.og-art { position: relative; z-index: 1; align-self: center; justify-self: center; width: 420px; height: 420px; display: grid; place-items: center; }
.og-art img { max-width: 100%; max-height: 100%; object-fit: contain; }
.og-foot { position: relative; z-index: 2; grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid var(--line-2); }
.og-brand { display: inline-flex; align-items: center; gap: 14px; font-family: var(--f-latin); font-weight: 800; font-size: 26px; color: var(--ink); }
.og-brand svg { width: 42px; height: 42px; color: var(--ink); }
.og-url { font-family: var(--f-latin); font-size: 21px; letter-spacing: .03em; color: var(--mute); }
.og-top .og-copy { gap: 26px; }
.og-top .og-title { font-weight: 900; font-size: 62px; line-height: 1.36; }
.og-top .og-title span { display: block; }
.og-top .og-title u { text-decoration: none; background: linear-gradient(var(--accent), var(--accent)) 0 94% / 100% .08em no-repeat; }
.og-top .og-art { position: absolute; right: -120px; top: -10px; width: 580px; height: 580px; }
.og-top .og-foot { border-top: 0; }
`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shoot = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
mkdirSync(resolve(root, 'public/og'), { recursive: true });

for (const [key, path, artSel] of PAGES) {
  // 1. ページの絵を撮る（線を描き終え、レコードが回り始めるまで待つ）
  await shoot.goto(base + path, { waitUntil: 'networkidle' });
  await shoot.evaluate(() => document.fonts.ready);
  await shoot.waitForTimeout(key === 'top' ? 3200 : 2600);
  // 回転したカードや、外へ飛ぶ点も入るように、中の要素ぜんぶの外枠で切り抜く
  const box = await shoot.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    let [x1, y1, x2, y2] = [r.left, r.top, r.right, r.bottom];
    el.querySelectorAll('*').forEach((c) => {
      const q = c.getBoundingClientRect();
      if (q.width && q.height) [x1, y1, x2, y2] = [Math.min(x1, q.left), Math.min(y1, q.top), Math.max(x2, q.right), Math.max(y2, q.bottom)];
    });
    const pad = 28;
    const x = Math.max(0, x1 - pad);
    const y = Math.max(0, y1 - pad);
    return { x, y, width: Math.min(innerWidth, x2 + pad) - x, height: Math.min(innerHeight, y2 + pad) - y };
  }, artSel);
  const art = (await shoot.screenshot({ clip: box, omitBackground: true })).toString('base64');
  const info = await shoot.evaluate(() => ({
    title: document.querySelector('h1')?.textContent?.trim() ?? '',
    lines: [...document.querySelectorAll('.hero-title .ln')].map((l) => l.textContent?.trim() ?? ''),
    label: document.querySelector('.phero-label, .hero-eyebrow')?.textContent?.trim() ?? '',
    catch: document.querySelector('.phero-catch')?.textContent?.trim() ?? '',
    mark: document.querySelector('.hd-brand svg')?.outerHTML ?? '',
  }));

  // 2. 同じページの書体と色のまま、1200×630 に組み直す
  await og.goto(base + path, { waitUntil: 'networkidle' });
  const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const isJp = /[぀-ヿ一-鿿]/.test(info.title);
  const title =
    key === 'top'
      ? info.lines.map((l) => `<span>${esc(l).replace('音楽を売らない', '<u>音楽を売らない</u>')}</span>`).join('')
      : esc(info.title);
  await og.evaluate(
    ({ css, html }) => {
      document.documentElement.className = 'js rm';
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      document.body.innerHTML = html;
    },
    {
      css: CSS,
      html: `<div class="og og-${key}">
  <div class="og-copy">
    <p class="og-label">${esc(info.label)}</p>
    <p class="og-title${isJp && key !== 'top' ? ' is-jp' : ''}">${title}</p>
    ${info.catch ? `<p class="og-catch">${esc(info.catch)}</p>` : ''}
  </div>
  <div class="og-art"><img src="data:image/png;base64,${art}" alt=""></div>
  <div class="og-foot"><span class="og-brand">${info.mark}Music Japan</span><span class="og-url">${HOST}${path === '/' ? '' : path}</span></div>
</div>`,
    },
  );
  await og.evaluate(() => document.fonts.ready);
  await og.waitForTimeout(300);
  await og.screenshot({ path: resolve(root, `public/og/${key}.png`) });
  console.log(`og/${key}.png`);
}

// ホーム画面のアイコン（生成りの地に墨のマーク）
const mark = await shoot.evaluate(() => document.querySelector('.hd-brand svg')?.outerHTML ?? '');
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(
  `<html><body style="margin:0;background:#f6f4ef;color:#141414;display:grid;place-items:center;height:180px">${mark.replace('<svg', '<svg width="128" height="128"')}</body></html>`,
);
await icon.screenshot({ path: resolve(root, 'public/apple-touch-icon.png') });
console.log('apple-touch-icon.png');
await browser.close();
server.close();
