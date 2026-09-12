import { site } from '../data/site';
import type { Service, TalkProfile } from '../types';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * ヒーローのHTML。
 * 本番ビルドではこれをビルド時にHTMLへ焼き込む（LCPをJS待ちにしないため）。
 * 単一ファイルのプレビューでは同じ関数を実行時に使う。出どころを1つにしておく。
 */
export function serviceHeroHtml(s: Service, homeHref = '/'): string {
  return `
<header class="hero${s.heavyWebGL ? ' hero--heavy' : ''}" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hero__inner">
    <p class="hero__eyebrow"><a class="hero__back" href="${homeHref}">Baton</a><span aria-hidden="true">/</span><span>${esc(s.company)}</span></p>
    <h1 class="hero__title">${esc(s.serviceName)}</h1>
    <p class="hero__tagline">${esc(s.tagline)}</p>
    <p class="hero__desc">${esc(s.description)}</p>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}

/**
 * プロフィールページのヒーロー。サービスページと同じく、ビルド時に
 * 静的HTMLへ焼き込む（写真は今回プレースホルダーのイニシャル表示）。
 *
 * `monument` を持つプロフィール（＝実データが入った「ミニLP」）だけ、
 * サービスページと同じ `.hero`（フル高さ + WebGL立体）を使う。
 * 持たないプロフィール（暫定の6件）は今まで通りの簡易ヒーローのまま。
 */
export function profileHeroHtml(p: TalkProfile, homeHref = '/'): string {
  const initial = esc(p.name.slice(0, 1));

  if (p.monument || p.heavyWebGL) {
    return `
<header class="hero${p.heavyWebGL ? ' hero--heavy' : ''}" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hero__inner">
    <p class="hero__eyebrow">
      <span class="hero__avatar" aria-hidden="true">${initial}</span>
      <a class="hero__back" href="${homeHref}">Baton Talk</a><span aria-hidden="true">/</span><span>${esc(p.company)}</span>
    </p>
    <h1 class="hero__title">${esc(p.name)}</h1>
    <p class="hero__tagline">${esc(p.tagline ?? p.title)}</p>
    <p class="hero__desc">${esc(p.bio)}</p>
    <div class="hero__cta"><a class="btn btn--primary" href="#talk-request">この人と話したい</a></div>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
  }

  return `
<header class="talk-hero" data-hero>
  <div class="wrap talk-hero__inner">
    <div class="talk-hero__photo" aria-hidden="true">${initial}</div>
    <div>
      <p class="talk-hero__eyebrow"><a class="hero__back" href="${homeHref}">Baton Talk</a><span aria-hidden="true"> / </span><span>${esc(p.company)}</span></p>
      <h1 class="talk-hero__name">${esc(p.name)}</h1>
      <p class="talk-hero__role">${esc(p.title)}・${esc(p.company)}</p>
      <p class="talk-hero__bio">${esc(p.bio)}</p>
      <div class="talk-hero__cta">
        <a class="btn btn--primary" href="#talk-request">この人と話したい</a>
      </div>
    </div>
  </div>
</header>`.trim();
}

export function profileHubHeroHtml(): string {
  return `
<header class="talk-hub-hero" data-hero>
  <div class="wrap talk-hub-hero__inner">
    <p class="talk-hub-hero__eyebrow"><a class="hero__back" href="/">Baton</a></p>
    <h1 class="talk-hub-hero__title">Baton Talk</h1>
    <p class="talk-hub-hero__tagline">この人と話してみたい、を紹介にかえる。</p>
  </div>
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
