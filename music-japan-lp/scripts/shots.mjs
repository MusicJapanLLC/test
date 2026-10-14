// LIVE PROJECTS のスクリーンショット（public/projects/*.webp）を撮る。
// 使い方：baton-partners を本番と同じ内容でビルドして配信（npx vite preview --port 4815）してから
//   node scripts/shots.mjs   （BP_URL で配信先を変えられる）
// PNG で撮って、python の Pillow で WebP にする（Vercel のビルドではブラウザを動かさない。画像はコミットする）
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'public/projects');
const tmp = resolve(root, '.shots');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });
const base = process.env.BP_URL ?? 'http://localhost:4815';
const shots = [
  // [ファイル名, パス, 幅, 高さ, スクロール位置（画面の何倍か / セレクタ）, 待ち時間]
  ['evorg-desktop', '/evorg/', 1440, 900, 0, 4200],
  ['evorg-desktop-2', '/evorg/', 1440, 900, '.sec-highlight', 3200],
  ['evorg-mobile', '/evorg/', 390, 844, 0, 4200],
  ['central-ax-desktop', '/central-ax/', 1440, 900, 0, 4200],
  ['central-ax-desktop-2', '/central-ax/', 1440, 900, '.sec-highlight', 3200],
  ['central-ax-mobile', '/central-ax/', 390, 844, 0, 4200],
  ['dp-partners-desktop', '/dp-partners/', 1440, 900, 0, 6000],
  ['dp-partners-desktop-2', '/dp-partners/', 1440, 900, '.sec-locker', 3200],
  ['dp-partners-mobile', '/dp-partners/', 390, 844, 0, 6000],
  ['smartaleck-desktop', '/smartaleck/', 1440, 900, 0, 4200],
  ['smartaleck-desktop-2', '/smartaleck/', 1440, 900, '.sec-highlight', 3200],
  ['smartaleck-mobile', '/smartaleck/', 390, 844, 0, 4200],
  ['presence-desktop', '/presence/', 1440, 900, 0, 4200],
  ['presence-desktop-2', '/presence/', 1440, 900, '.sec-highlight', 3200],
  ['presence-mobile', '/presence/', 390, 844, 0, 4200],
  ['zettaichi-desktop', '/zettaichi/', 1440, 900, 0, 6500],
  ['zettaichi-desktop-2', '/zettaichi/', 1440, 900, '.sec-highlight', 3200],
  ['zettaichi-mobile', '/zettaichi/', 390, 844, 0, 6500],
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, path, w, h, pos, wait] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (typeof pos === 'string') {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
    }, pos);
  } else if (pos) {
    await page.evaluate((p) => window.scrollTo(0, window.innerHeight * p), pos);
  }
  await page.waitForTimeout(wait);
  const png = resolve(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  await page.close();
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open(${JSON.stringify(png)}).convert('RGB'); im.save(${JSON.stringify(resolve(out, `${name}.webp`))}, 'WEBP', quality=82, method=6)`]);
  console.log('shot', name);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
