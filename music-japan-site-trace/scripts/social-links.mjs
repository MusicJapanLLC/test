import { readFileSync } from 'node:fs';

// Original brand-supplied path geometry; uniform scaling only to fit a 24px viewBox.
const glyphs = JSON.parse(readFileSync(new URL('./social-glyphs.json', import.meta.url), 'utf8'));
const links = [
  ['LinkedIn', 'https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/'],
  ['Instagram', 'https://www.instagram.com/music.japan.llc2/'],
  ['X', 'https://x.com/Music_Japan_LLC']
];
export function renderSocialInner(locale) {
  const suffix = locale === 'ja' ? '（新しいタブで開きます）' : ' (opens in a new tab)';
  return `<span class="mj-socials__label">FOLLOW / MUSIC JAPAN</span><div>${links.map(([name, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${name}${suffix}" title="${name}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${glyphs[name].markup}</svg></a>`).join('')}</div>`;
}
export function renderSocialLinks(locale) {
  return `<nav class="mj-socials" aria-label="${locale === 'ja' ? 'SNSリンク' : 'Social links'}">${renderSocialInner(locale)}</nav>`;
}
