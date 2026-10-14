// 日本語フォントを「このサイトで、その書体で表示する文字だけ」に絞る。
//
// 使い方：文章を変えたら npm run build → npm run fonts → もう一度 npm run build
//   1. dist/ をこのスクリプトの中で配信し、全ページをブラウザで開く
//   2. 文字ごとに、実際に使われる書体と太さを調べる（Zen Old Mincho 700/900、Zen Kaku Gothic New 400/700）
//   3. scripts/fonts.py が、その文字だけのフォントを public/fonts/ に書き出し、src/styles/fonts-jp.css を作り直す
// 必要なもの：Playwright（Chromium）、python3、pip install fonttools brotli
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
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

const paths = ['/', '/baton-partners/', '/baton/', '/second-take/', '/works/', '/news/', '/about/', '/talk/', '/404.html'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const sets = {};
for (const path of paths) {
  await page.goto(base + path, { waitUntil: 'load' });
  const found = await page.evaluate(() => {
    // CSSの太さの選び方（用意する太さだけで、どのファイルが使われるか）
    const faces = { 'Zen Old Mincho': [700, 900], 'Zen Kaku Gothic New': [400, 700] };
    const pick = (want, have) => {
      const up = have.filter((w) => w >= want).sort((a, b) => a - b);
      const down = have.filter((w) => w < want).sort((a, b) => b - a);
      if (want > 500) return up[0] ?? down[0];
      if (want >= 400) return have.filter((w) => w >= want && w <= 500).sort((a, b) => a - b)[0] ?? down[0] ?? up[0];
      return down[0] ?? up[0];
    };
    const out = {};
    const add = (el, text, pseudo = false) => {
      const cs = getComputedStyle(el, pseudo || null);
      const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      if (!faces[fam]) return;
      const w = pick(Number(cs.fontWeight), faces[fam]);
      // 最初の画面の大きな見出しは、先読みする小さなファイルに分ける
      const h = !pseudo && el.closest('h1, .phero-catch') ? '-h' : '';
      const key = `${fam === 'Zen Old Mincho' ? 'zom' : 'zkg'}-${w}${h}`;
      out[key] = (out[key] ?? '') + text;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      const el = t.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || el.closest('svg')) continue;
      if (t.data.trim()) add(el, t.data);
    }
    // SVGの中の文字（イラストの文字）
    for (const el of document.querySelectorAll('svg text')) add(el, el.textContent ?? '');
    // ::before / ::after の content
    for (const el of document.querySelectorAll('body *')) {
      for (const ps of ['::before', '::after']) {
        const c = getComputedStyle(el, ps).content;
        if (c && c.startsWith('"')) add(el, c.slice(1, -1), ps);
      }
    }
    return out;
  });
  for (const [k, v] of Object.entries(found)) sets[k] = (sets[k] ?? '') + v;
}
await browser.close();
server.close();

const uniq = (s) => [...new Set([...s])].sort().join('');
const result = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, uniq(v)]));
mkdirSync(resolve(root, '.font-cache'), { recursive: true });
const json = resolve(root, '.font-cache/chars.json');
writeFileSync(json, JSON.stringify(result, null, 2));
for (const [k, v] of Object.entries(result)) console.log(`${k}: ${v.length}字`);
execFileSync('python3', [resolve(root, 'scripts/fonts.py'), json], { stdio: 'inherit' });
