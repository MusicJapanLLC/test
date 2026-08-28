import { site } from '../data/site';
import type { Service } from '../types';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * ヒーローのHTML。
 * 本番ビルドではこれをビルド時にHTMLへ焼き込む（LCPをJS待ちにしないため）。
 * 単一ファイルのプレビューでは同じ関数を実行時に使う。出どころを1つにしておく。
 */
export function serviceHeroHtml(
  s: Service,
  homeHref = '/',
  opts: { showBackLink?: boolean } = {},
): string {
  const showBack = opts.showBackLink !== false;
  const eyebrow = showBack
    ? `<a class="hero__back" href="${homeHref}">Baton</a><span aria-hidden="true">/</span><span>${esc(s.company)}</span>`
    : `<span>${esc(s.company)}</span>`;

  return `
<header class="hero${s.heavyWebGL ? ' hero--heavy' : ''}" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hero__inner">
    <p class="hero__eyebrow">${eyebrow}</p>
    <h1 class="hero__title">${esc(s.serviceName)}</h1>
    <p class="hero__tagline">${esc(s.tagline)}</p>
    <p class="hero__desc">${esc(s.description)}</p>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}

export function hubHeroHtml(): string {
  return `
<header class="hub-hero" data-hero>
  <canvas class="hub-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hub-hero__inner">
    <h1 class="hub-hero__title">${esc(site.name)}</h1>
    <p class="hub-hero__tagline">${esc(site.tagline)}</p>
  </div>
  <div class="hub-hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}
