import { loadDefaultJapaneseParser } from 'budoux';

/**
 * 日本語の改行をビルド時に決める。
 * BudouX で文節に区切り、見出しは文節ごとの inline-block、本文は <wbr> を入れる。
 * CSS 側は word-break: keep-all なので、文節の途中（「理|由」など）では折り返さない。
 */
const parser = loadDefaultJapaneseParser();

export const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // 改行指定の波かっこ（{取りこぼさずに}）は、どこに出しても表示しない
    .replace(/[{}]/g, '');

/**
 * 文節に区切る。BudouX が割ってしまう語は、データ側で {取りこぼさずに} のように
 * 波かっこで囲むと1文節として扱う（波かっこは表示されない）。
 */
function phrases(text: string): string[] {
  return text
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
    .flatMap((part) => (part.startsWith('{') ? [part.slice(1, -1)] : parser.parse(part).flatMap(splitLong)));
}

/**
 * 「ワンストップCRM/MA」のように長い1文節は、スマホで1行に収まらない。
 * 8文字を超える文節だけ、和文と英字の境目で分ける。
 */
function splitLong(ph: string): string[] {
  if (ph.length <= 8) return [ph];
  return ph.split(/(?<=[\u3040-\u30ff\u4e00-\u9fff])(?=[A-Za-z0-9])/);
}

/** **強調** だけを許す最小のリッチテキスト */
const rich = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** 本文・リード文：文節の切れ目に <wbr> を入れる */
export function jp(text: string): string {
  return text
    .split(/(\*\*.+?\*\*)/g)
    .map((chunk) => {
      const bold = /^\*\*(.+)\*\*$/.exec(chunk);
      const body = bold ? bold[1] : chunk;
      const html = phrases(body).map(esc).join('<wbr>');
      return bold ? `<strong>${html}</strong>` : html;
    })
    .join('');
}

/**
 * 見出し：行ごとに <span class="ln">、文節ごとに <span class="ph">。
 * 文節単位で出現アニメーションもかけられる。
 */
export function heading(lines: string | string[], start = 0): string {
  let i = start;
  const list = Array.isArray(lines) ? lines : [lines];
  return list
    .map(
      (line) =>
        `<span class="ln">${phrases(line)
          .map((ph) => `<span class="ph" style="--i:${i++}">${esc(ph)}</span>`)
          .join('')}</span>`,
    )
    .join('');
}

/** 見出しの文字列だけ（title や JSON-LD 用） */
export const plain = (lines: string | string[]): string =>
  (Array.isArray(lines) ? lines.join('') : lines).replace(/\*\*|[{}]/g, '');

export { rich };
