import { loadDefaultJapaneseParser } from 'budoux';

const parser = loadDefaultJapaneseParser();

export const esc = (v: string) =>
  v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const hasJa = (s: string) => /[぀-ヿ㐀-鿿]/.test(s);

/**
 * Text with authored line breaks. Japanese is split into BudouX phrases, each an
 * unbreakable inline-block, so lines only break between phrases (never before 「、」).
 * Latin text is split into words so headings can animate word by word as well.
 */
export function phrases(text: string, cls = 'ph'): string {
  return text
    .split('\n')
    .map((line) => {
      const parts = hasJa(line) ? parser.parse(line) : line.split(/(?<=\s)/);
      return parts.map((p) => `<span class="${cls}">${esc(p)}</span>`).join('');
    })
    .join('<br>');
}

/** Paragraph copy: BudouX <wbr> hints, keep-all handled in CSS. */
export function prose(text: string): string {
  return text
    .split('\n')
    .map((line) => (hasJa(line) ? parser.parse(line).map(esc).join('<wbr>') : esc(line)))
    .join('<br>');
}

export const flat = (text: string) => text.replaceAll('\n', ' ').replace(/\s+/g, ' ').trim();

export const attr = (o: Record<string, string | number | boolean | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(String(v))}"`))
    .join(' ');

export const arrow = (d: 'right' | 'up-right' = 'right') =>
  `<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="${d === 'right' ? 'M4 12h15M13 6l6 6-6 6' : 'M7 17 17 7M8 7h9v9'}"/></svg>`;

export const ext = (href: string) => /^https?:/.test(href);
