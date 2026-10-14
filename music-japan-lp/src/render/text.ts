import { loadDefaultJapaneseParser } from 'budoux';

/**
 * 日本語の改行をビルド時に決める（baton-partners と同じ考え方）。
 * BudouX で文節に区切り、見出しは文節ごとの inline-block、本文は <wbr>。
 * CSS は word-break: keep-all。{波かっこ} で囲んだ語は1文節として扱う（表示しない）。
 */
const parser = loadDefaultJapaneseParser();

/** そのまま（title・meta 用） */
export const escRaw = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[{}]/g, '');

/**
 * 名前の途中では改行しない。「Central / AX」「SECOND / TAKE」のような折り返しを防ぐため、
 * 名前の中の空白を改行しない空白にし、名前の中に入った <wbr> や見出しの文節の切れ目を取る。
 */
const NAMES = ['Music Japan LLC', 'Music Japan', 'Central AX', 'SECOND TAKE', 'Baton Partners'];
const NAME_RE = new RegExp(
  NAMES.map((n) => [...n].map((c) => (c === ' ' ? '(?: |\u00a0|</span> <span class="ph">)' : c)).join('(?:<wbr>)?')).join('|'),
  'g',
);
const keepNames = (html: string): string =>
  html.replace(NAME_RE, (m) => m.replace(/<wbr>/g, '').replace(/<\/span> <span class="ph">/g, '\u00a0').replace(/ /g, '\u00a0'));

/** 画面に出す文字（名前は折り返さない） */
export const esc = (s: string): string => keepNames(escRaw(s));

const hasJa = (s: string) => /[぀-ヿ㐀-鿿]/.test(s);

function phraseList(text: string): string[] {
  return text
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
    .flatMap((part) => {
      if (part.startsWith('{')) return [part.slice(1, -1)];
      if (!hasJa(part)) return part.split(/(?<=\s)/);
      return parser.parse(part);
    });
}

const LINK = /\[([^\]]+)\]\((https:\/\/[^)\s]+|#[\w-]+)\)/;
const LINK_SPLIT = /(\[[^\]]+\]\((?:https:\/\/[^)\s]+|#[\w-]+)\))/g;

function jpText(text: string): string {
  return text
    .split(/(\*\*.+?\*\*)/g)
    .map((chunk) => {
      const bold = /^\*\*(.+)\*\*$/.exec(chunk);
      const body = bold ? bold[1] : chunk;
      const html = keepNames(phraseList(body).map(escRaw).join('<wbr>'));
      return bold ? `<strong>${html}</strong>` : html;
    })
    .join('');
}

/** 本文：文節の切れ目に <wbr>。**強調** と [リンク](https://…) が使える */
export function jp(text: string): string {
  return text
    .split(LINK_SPLIT)
    .map((part) => {
      const m = LINK.exec(part);
      if (!m || m[0] !== part) return jpText(part);
      const external = m[2].startsWith('https://');
      return `<a class="in-link" href="${esc(m[2])}"${external ? ' target="_blank" rel="noopener"' : ''}>${jpText(m[1])}</a>`;
    })
    .join('');
}

/**
 * 見出し：行ごとに <span class="ln">、文節ごとに <span class="ph">。
 * クライアント側で .ph を1文字ずつ <span class="c"> に分けて、下から立ち上げる。
 */
export function heading(lines: string | string[]): string {
  const list = Array.isArray(lines) ? lines : [lines];
  return list
    .map((line) => {
      const parts = phraseList(line);
      return `<span class="ln">${parts
        .map((ph) => {
          // 英語の語のあいだの空白は、inline-block の外に出す（中に入れると消える）
          const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(ph)!;
          return `${m[1] ? ' ' : ''}${m[2] ? `<span class="ph">${escRaw(m[2])}</span>` : ''}${m[3] ? ' ' : ''}`;
        })
        .join('')}</span>`;
    })
    .map(keepNames)
    .join('');
}

/** 記号を外した素の文（title・構造化データ・llms.txt 用） */
export const plain = (s: string | string[]): string =>
  (Array.isArray(s) ? s.join('') : s).replace(new RegExp(LINK.source, 'g'), '$1').replace(/\*\*|[{}]/g, '');

export const attr = (o: Record<string, string | number | boolean | undefined>): string =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(String(v))}"`))
    .join(' ');
