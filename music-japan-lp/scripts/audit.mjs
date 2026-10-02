// ビルドしたページの点検。1つでも問題があれば失敗させる（公開前の見落としを防ぐ）
// - h1 は1つ / title・description の長さ / canonical / 構造化データが読めるか / 画像の alt / 外部リンクの rel
// - 文章の決まり：使わない言葉（「設計」「リード獲得」「〜を実現」など）・価格・「お問い合わせ」・ダッシュ
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'dist/index.html');
const problems = [];
const warn = [];
if (!existsSync(file)) {
  console.error('dist/index.html がありません');
  process.exit(1);
}
const html = readFileSync(file, 'utf8');
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

const h1 = html.match(/<h1[\s>]/g) ?? [];
if (h1.length !== 1) problems.push(`h1 が ${h1.length} 個あります`);
const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
if (!title || title.length > 60) problems.push(`title の長さ: ${title.length}`);
const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
if (desc.length < 60 || desc.length > 160) warn.push(`description の長さ: ${desc.length}`);
if (!/<link rel="canonical" href="https:\/\//.test(html)) problems.push('canonical がありません');
for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try {
    JSON.parse(m[1]);
  } catch (e) {
    problems.push(`構造化データが読めません: ${e.message}`);
  }
}
for (const m of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\balt="/.test(m[0])) problems.push(`alt のない画像: ${m[0].slice(0, 80)}`);
  if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) warn.push(`大きさの指定がない画像: ${m[0].slice(0, 80)}`);
}
for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
  if (!/rel="[^"]*noopener/.test(m[0])) problems.push(`rel=noopener がないリンク: ${m[0].slice(0, 80)}`);
}
const banned = ['設計', 'リード獲得', 'を実現', '寄り添', 'を加速', '次のステージ', 'お問い合わせ', '——', '円', '料金', '月額', 'undefined', 'NaN'];
for (const w of banned) {
  if (text.includes(w)) problems.push(`使わない言葉が入っています: 「${w}」 …${text.slice(Math.max(0, text.indexOf(w) - 30), text.indexOf(w) + 30)}…`);
}
const talk = (html.match(/timerex\.net\/s\/music\.japan\.llc_5445\/2f8e527f/g) ?? []).length;
if (talk < 6) problems.push(`予約ページへのボタンが少なすぎます（${talk}）`);

for (const w of warn) console.warn('注意:', w);
if (problems.length) {
  for (const p of problems) console.error('問題:', p);
  process.exit(1);
}
console.log(`点検OK — h1:1 / title ${title.length}字 / description ${desc.length}字 / 予約ボタン ${talk}か所`);
