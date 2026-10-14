// ビルドしたページの点検（全ページ）。1つでも問題があれば失敗させる（公開前の見落としを防ぐ）
// - h1 は1つ / title・description の長さ / canonical / 構造化データが読めるか / 画像の alt と大きさ / 外部リンクの rel
// - ページの中のリンク先が、このサイトに実在するか
// - 文章の決まり（docs/writing-sources.md）：使わない言葉・価格・「お問い合わせ」・ダッシュ・決まり文句
// - 予約ページ（TimeRex）へのボタンは /talk/ にだけ置く
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const PAGES = ['/', '/baton-partners/', '/baton/', '/second-take/', '/works/', '/news/', '/about/', '/talk/'];
const TIMEREX = /href="https:\/\/timerex\.net\/s\/music\.japan\.llc_5445\/2f8e527f"/g;
const BANNED = [
  // 中身のない言葉・営業の決まり文句
  '設計', 'リード獲得', 'を実現', '寄り添', 'を加速', '次のステージ', 'ソリューション', 'シームレス', 'ワンストップ', '圧倒的', '革新的',
  '最適化', 'に貢献', 'お気軽に', 'まずはお気軽', '無料相談', '今すぐ', '限定', '準備はいりません', '予約しても', '何かが決まる',
  // 問い合わせ・価格は載せない
  'お問い合わせ', '円', '料金', '月額', '費用', '見積',
  // 記号
  '——', '—', '──',
  // 出してはいけない数字
  '16組', '30件',
  // 壊れた表示
  'undefined', 'NaN', '[object',
];
// 「〜ではなく、〜」の言い回しは、1ページに1回まで
const NEGATIVE_PARALLEL = /ではなく/g;

const problems = [];
const warn = [];
const summary = [];
const ids = new Map();

const fileOf = (path) => resolve(dist, path === '/' ? 'index.html' : `.${path}index.html`);
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

for (const path of [...PAGES, '/404.html']) {
  const file = path === '/404.html' ? resolve(dist, '404.html') : fileOf(path);
  const at = (msg) => `${path} ${msg}`;
  if (!existsSync(file)) {
    problems.push(at('のHTMLがありません'));
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const text = visibleText(html);
  const is404 = path === '/404.html';

  const h1 = html.match(/<h1[\s>]/g) ?? [];
  if (h1.length !== 1) problems.push(at(`h1 が ${h1.length} 個あります`));
  const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
  if (!title || title.length > 60) problems.push(at(`title の長さ: ${title.length}`));
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!is404 && (desc.length < 60 || desc.length > 160)) warn.push(at(`description の長さ: ${desc.length}`));
  if (!is404) {
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
    if (!canonical.startsWith('https://') || !canonical.endsWith(path)) problems.push(at(`canonical が正しくありません: ${canonical}`));
    if (!/<meta property="og:image" content="https:\/\/[^"]+\/og\/[a-z]+\.png/.test(html)) problems.push(at('og:image がありません'));
  } else if (!/<meta name="robots" content="noindex/.test(html)) {
    problems.push(at('404 に noindex がありません'));
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      problems.push(at(`構造化データが読めません: ${e.message}`));
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) problems.push(at(`alt のない画像: ${m[0].slice(0, 80)}`));
    if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) warn.push(at(`大きさの指定がない画像: ${m[0].slice(0, 80)}`));
  }
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(m[0])) problems.push(at(`rel=noopener がないリンク: ${m[0].slice(0, 80)}`));
  }
  // id の重複
  ids.clear();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.set(m[1], (ids.get(m[1]) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) problems.push(at(`id="${id}" が ${n} 個あります`));
  // ページの中のリンク
  for (const m of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)(#[^"]*)?"/g)) {
    const href = m[1];
    if (/\.(xml|json|txt)$/.test(href)) {
      if (!existsSync(resolve(dist, `.${href}`))) problems.push(at(`リンク先がありません: ${href}`));
    } else if (!PAGES.includes(href)) {
      problems.push(at(`リンク先がありません: ${href}`));
    }
  }
  // 文章の決まり
  for (const w of BANNED) {
    const i = text.indexOf(w);
    if (i >= 0) problems.push(at(`使わない言葉: 「${w}」 …${text.slice(Math.max(0, i - 30), i + 30)}…`));
  }
  const neg = (text.match(NEGATIVE_PARALLEL) ?? []).length;
  if (neg > 1) warn.push(at(`「ではなく」が ${neg} 回あります`));
  // 予約ボタンは /talk/ だけ
  const book = (html.match(TIMEREX) ?? []).length;
  if (path === '/talk/' ? book !== 1 : book !== 0) problems.push(at(`予約ページへのリンクが ${book} 個あります（/talk/ に1つだけ）`));
  // 「話してみる」の入口は、ヘッダー（とメニュー・フッター）だけ。本文には「次のページ」の1つまで
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
  const toTalk = (main.match(/<a\b[^>]*href="\/talk\/"/g) ?? []).length;
  if (toTalk > 1) problems.push(at(`本文から /talk/ へのリンクが ${toTalk} 個あります`));
  summary.push(`${path.padEnd(16)} title ${String(title.length).padStart(2)}字 / description ${String(desc.length).padStart(3)}字 / 文字 ${text.length}`);
}

for (const w of warn) console.warn('注意:', w);
if (problems.length) {
  for (const p of problems) console.error('問題:', p);
  process.exit(1);
}
console.log(summary.join('\n'));
console.log(`点検OK — ${PAGES.length}ページ＋404`);
