// Japanese headings are animated per character. Splitting every character into its own
// inline-block span threw away the browser's line-breaking rules: a heading could wrap
// before 「、」 or 「を」 and the authored "\n" line breaks were lost. Phrases group the
// characters again, so lines only break between phrases and never before punctuation.

const HIRAGANA = /^[ぁ-ゟー]/;
const CLOSING = /^[、。，．,.!！?？:：;；)）\]］}｝」』】〉》〕・…ー々ゝゞァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎ]/;
const OPENING = /[(（\[［{｛「『【〈《〔]$/;
const WORDLIKE = /[\p{Script=Han}\p{Script=Katakana}\u30fcA-Za-z0-9]$/u;
const SENTENCE_END = /[、。，．！？!?]$/;
const PREFIX = /^[ごお]$/;
const WORDSTART = /^[\p{Script=Han}\p{Script=Katakana}]/u;

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter('ja', { granularity: 'word' })
  : null;

// Returns lines, each a list of phrases. Whitespace survives as its own breakable phrase.
export function phrases(text) {
  return text.split('\n').map(line => {
    const words = segmenter ? [...segmenter.segment(line)].map(s => s.segment) : line.split(/(\s+)/);
    const out = [];
    let glue = false;
    for (const word of words) {
      if (!word) continue;
      const last = out.at(-1);
      if (/^\s+$/.test(word)) { out.push(word); glue = false; continue; }
      const attach = last !== undefined && !/^\s+$/.test(last) && (
        glue ||
        CLOSING.test(word) ||
        (HIRAGANA.test(word) && !SENTENCE_END.test(last)) ||
        (WORDLIKE.test(last) && WORDSTART.test(word))
      );
      if (attach) out[out.length - 1] = last + word; else out.push(word);
      glue = OPENING.test(word) || PREFIX.test(word) || word.endsWith('・');
    }
    return out;
  });
}

// Replace an element's text with phrase spans. When `perChar` is set, each phrase holds
// one span per character so existing character animations keep working.
export function typeset(el, { perChar = false } = {}) {
  if (el.dataset.mjTypeset) return el.dataset.mjTypeset === 'chars' ? [...el.querySelectorAll('.mj-char')] : [];
  if (el.children.length) return null;
  const original = el.textContent;
  const label = original.replace(/\s*\n\s*/g, ' ').trim();
  if (!label) return null;
  const chars = [];
  const fragment = document.createDocumentFragment();
  phrases(original.trim()).forEach((line, index) => {
    if (index) fragment.append(document.createElement('br'));
    for (const phrase of line) {
      if (/^\s+$/.test(phrase)) { fragment.append(document.createTextNode(' ')); continue; }
      const span = document.createElement('span');
      span.className = 'mj-phrase';
      if (perChar) {
        for (const letter of phrase) {
          const char = document.createElement('span');
          char.className = 'mj-char';
          char.textContent = letter;
          span.append(char);
          chars.push(char);
        }
      } else {
        span.textContent = phrase;
      }
      fragment.append(span);
    }
  });
  el.setAttribute('aria-label', label);
  // Only the label is announced; the visual phrase spans are presentation.
  for (const node of fragment.childNodes) if (node.nodeType === 1) node.setAttribute('aria-hidden', 'true');
  el.replaceChildren(fragment);
  el.dataset.mjTypeset = perChar ? 'chars' : 'phrases';
  return chars;
}

// The refined edition is on when its stylesheet is linked (build flag MJ_REFINE).
export const refineEnabled = () => Boolean(document.querySelector('link[href*="/assets/music-japan-refine.css"]'));

export function restore(el, original) {
  el.textContent = original;
  el.removeAttribute('aria-label');
  delete el.dataset.mjTypeset;
}

const JA_TARGETS = [
  '.hero__lead',
  '.section-heading h2',
  '.manifesto > h2',
  '.related-card h3',
  '.about-brand__heading h3',
  '.inner-page__hero h1',
  '.inner-page__hero > p:not(.kicker)',
  '.partner h2',
  '.entity-page h1',
  '.privacy-page h1'
].join(',');

// Static pass for headings that motion does not animate (and for reduced motion).
export function typesetPage(root = document) {
  if (document.documentElement.lang !== 'ja' && !document.querySelector('.locale-ja')) return;
  root.querySelectorAll(JA_TARGETS).forEach(el => {
    if (!el.closest('.locale-ja,[lang="ja"]')) return;
    typeset(el);
  });
}
