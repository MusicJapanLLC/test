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
        <path d="M620 320 C662 274 672 206 640 136 C598 192 588 264 620 320 Z" />
        <path d="M620 320 C672 288 706 232 700 156 C646 182 606 244 620 320 Z" />
        <path d="M620 320 C664 350 730 358 792 322 C756 272 682 254 620 320 Z" />
        <path d="M620 320 C650 372 654 442 616 502 C572 458 566 386 620 320 Z" />
        <path d="M620 320 C572 356 508 364 448 328 C482 278 558 258 620 320 Z" />
        <path d="M620 320 C588 274 528 254 462 268 C480 322 546 356 620 320 Z" />
        <path d="M620 320 C596 268 546 238 480 236 C486 292 546 336 620 320 Z" opacity="0.85" />
      </g>
      <g class="hero__editorial-sprig">
        <path d="M604 486 C588 590 566 690 520 764 C548 690 552 594 560 500" />
        <path d="M560 590 C534 608 502 612 476 598" />
        <path d="M544 672 C518 686 488 688 462 674" />
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
