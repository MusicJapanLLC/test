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

  if (p.heroVariant === 'editorial') {
    return `
<header class="hero hero--editorial" data-hero>
  <div class="hero__editorial-art" aria-hidden="true">
    <svg viewBox="0 0 900 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g class="hero__editorial-bloom">
        <path d="M540 120 C620 180 660 280 630 380 C700 340 780 360 820 430 C760 470 700 470 650 440 C700 520 690 620 620 690 C590 610 560 540 560 460 C520 540 450 590 370 590 C400 510 450 450 510 410 C430 400 370 350 340 270 C430 260 500 290 540 340 C520 260 530 180 540 120 Z" />
        <path d="M300 460 C360 500 390 570 370 640 C430 610 500 620 540 670 C490 700 440 700 400 680 C430 750 410 830 350 880 C330 810 320 740 330 680 C280 740 210 760 150 730 C190 670 240 630 300 610 C240 590 200 540 190 470 C250 470 280 480 300 460 Z" opacity="0.72" />
      </g>
      <g class="hero__editorial-sprig">
        <path d="M760 560 C740 640 690 700 620 730 C650 660 660 590 640 520" />
        <path d="M700 600 C680 620 650 630 625 622" />
        <path d="M715 650 C695 665 668 670 645 660" />
      </g>
    </svg>
  </div>
  <div class="hero__editorial-grain" aria-hidden="true"></div>
  <a class="hero__brand hero__brand--editorial" href="${homeHref}">
    <span class="hero__brand-logo">Baton -バトン-</span>
    <p class="hero__brand-tagline">選んだ人が、選んだ人へ。</p>
  </a>
  <div class="hero__inner hero__inner--editorial">
    <p class="hero__eyebrow hero__eyebrow--editorial">
      <span>${esc(p.company)}</span><span aria-hidden="true">/</span><span>${esc(p.title)}</span>
    </p>
    <p class="hero__wordmark" aria-hidden="true">Unveil the <em>Core</em></p>
    <h1 class="hero__title hero__title--editorial">${esc(p.name)}</h1>
    <p class="hero__tagline hero__tagline--editorial">${esc(p.tagline ?? p.title)}</p>
    <p class="hero__desc hero__desc--editorial">${esc(p.bio)}</p>
  </div>
  <div class="hero__scroll hero__scroll--editorial" aria-hidden="true"><span></span></div>
</header>`.trim();
  }

  if (p.monument || p.heavyWebGL) {
    return `
<header class="hero${p.heavyWebGL ? ' hero--heavy' : ''}" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <a class="hero__brand" href="${homeHref}">
    <span class="hero__brand-logo">Baton -バトン-</span>
    <p class="hero__brand-tagline">選んだ人が、選んだ人へ。</p>
  </a>
  <div class="hero__inner">
    <p class="hero__eyebrow">
      <span class="hero__avatar" aria-hidden="true">${initial}</span>
      <span>${esc(p.company)}</span><span aria-hidden="true">/</span><span>${esc(p.title)}</span>
    </p>
    <h1 class="hero__title">${esc(p.name)}</h1>
    <p class="hero__tagline">${esc(p.tagline ?? p.title)}</p>
    <p class="hero__desc">${esc(p.bio)}</p>
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
<header class="hub-hero" data-hero>
  <canvas class="hub-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hub-hero__intro" aria-hidden="true">
    <span class="hub-hero__intro-wash"></span>
    <span class="hub-hero__intro-trail"></span>
    <span class="hub-hero__intro-comet"></span>
    <span class="hub-hero__intro-flash"></span>
    <span class="hub-hero__intro-ring"></span>
  </div>
  <div class="hub-hero__inner">
    <h1 class="hub-hero__title"><a href="/profile/" aria-label="Batonトップへ戻る" style="color:inherit;text-decoration:none">Baton -バトン-</a></h1>
    <p class="hub-hero__tagline">選んだ人が、選んだ人へ。</p>
  </div>
  <div class="hub-hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}

export function hubHeroHtml(): string {
  return `
<header class="hub-hero" data-hero>
  <canvas class="hub-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hub-hero__inner">
    <h1 class="hub-hero__title">${esc(site.name)}</h1>
    <p class="hub-hero__tagline">一つひとつ、確かめて選んだ6つ。</p>
  </div>
  <div class="hub-hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}
