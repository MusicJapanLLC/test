import { site } from '../data/site';
import type { Service, TalkProfile } from '../types';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function splitChars(text: string): string {
  return Array.from(text)
    .map((ch, i) =>
      ch === ' ' || ch === '\u3000'
        ? '<span class="pf-name__char pf-name__char--space">&nbsp;</span>'
        : `<span class="pf-name__char" style="--i:${i}">${esc(ch)}</span>`,
    )
    .join('');
}

function heroShotHtml(p: TalkProfile): string {
  const initial = esc(p.name.slice(0, 1));
  const photo = p.photo;
  const inner = photo
    ? `<img class="pf-shot__img" src="${esc(photo.src)}" alt="${esc(photo.alt ?? p.name)}" fetchpriority="high" decoding="async" data-shot-img />
       <span class="pf-shot__initial" aria-hidden="true">${initial}</span>`
    : `<span class="pf-shot__initial is-only" aria-hidden="true">${initial}</span>`;

  return `
  <figure class="pf-shot${photo ? '' : ' pf-shot--noimg'}${photo?.tint ? ' pf-shot--tint' : ''}" data-shot${
    photo?.tint ? ` style="--shot-tint:${esc(photo.tint)}"` : ''
  }>
    <div class="pf-shot__frame">
      ${inner}
      <span class="pf-shot__sheen" aria-hidden="true"></span>
      <span class="pf-shot__rule" aria-hidden="true"></span>
      <span class="pf-shot__edge pf-shot__edge--tl" aria-hidden="true"></span>
      <span class="pf-shot__edge pf-shot__edge--br" aria-hidden="true"></span>
      ${photo?.caption ? `<figcaption class="pf-shot__caption">${esc(photo.caption)}</figcaption>` : ''}
    </div>
  </figure>`;
}

export function profileHeroHtml(p: TalkProfile, homeHref = '/'): string {
  const initial = esc(p.name.slice(0, 1));

  if (p.heroVariant === 'editorial') {
    return `
<header class="hero hero--editorial" data-hero>
  <canvas class="hero__canvas hero__canvas--editorial" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hero__editorial-art" data-editorial-parallax aria-hidden="true">
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
    <div class="hero__veil" data-veil aria-hidden="true"></div>
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

  if (p.heroVariant !== 'simple') {
    return `
<header class="pf-hero" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="pf-hero__veil" aria-hidden="true"></div>
  <div class="pf-hero__scrim" aria-hidden="true"></div>
  <div class="pf-hero__rules" aria-hidden="true"></div>
  <a class="hero__brand" href="${homeHref}">
    <span class="hero__brand-logo">Baton -バトン-</span>
    <p class="hero__brand-tagline">選んだ人が、選んだ人へ。</p>
  </a>
  <div class="pf-hero__inner">
    ${heroShotHtml(p)}
    <div class="pf-lead">
      <p class="pf-lead__eyebrow">
        <span>${esc(p.company)}</span><span class="pf-lead__slash" aria-hidden="true">/</span><span>${esc(p.title)}</span>
      </p>
      <h1 class="pf-name" aria-label="${esc(p.name)}">${splitChars(p.name)}</h1>
      <p class="pf-lead__tagline">${esc(p.tagline ?? p.title)}</p>
      <span class="pf-lead__rule" aria-hidden="true"></span>
      <p class="pf-lead__bio">${esc(p.bio)}</p>
      <div class="pf-lead__cta">
        <a class="btn btn--primary" href="#talk-request" data-magnetic>この人と話したい</a>
      </div>
    </div>
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

/**
 * Baton トップ（/profile/）のヒーロー。
 * 文字は最初から描画しておき（LCPを遅らせない）、暗く沈んだ「消灯」状態から、
 * WebGLのレーザーが着弾した瞬間に点灯させる。演出は profile/hub-hero-scene.ts。
 */
export function profileHubHeroHtml(): string {
  const title = Array.from('Baton')
    .map((ch, i) => `<span class="bt-hero__char" style="--i:${i}">${esc(ch)}</span>`)
    .join('');
  // ヒーローの下（一覧・フッターの手前）でも、光のリボンがゆっくり流れ続ける背景。CSSだけで動かす
  const wave = (y: number, amp: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const x = i * 720;
      return `${i === 0 ? `M${x} ${y}` : ''} C${x + 240} ${y - amp} ${x + 480} ${y + amp} ${x + 720} ${y}`;
    }).join(' ');
  const ribbons = [
    { y: 260, amp: 70, cls: 'a' },
    { y: 470, amp: 95, cls: 'b' },
    { y: 690, amp: 60, cls: 'c' },
  ]
    .map(
      (r) =>
        `<g class="bt-ambient__ribbon bt-ambient__ribbon--${r.cls}"><path class="bt-ambient__silk" d="${wave(r.y, r.amp)}"/><path class="bt-ambient__glint" d="${wave(r.y, r.amp)}"/></g>`,
    )
    .join('');
  const dust = Array.from({ length: 14 }, (_, i) => {
    // 位置と速さは決め打ちの疑似乱数（ビルドごとに変わらないように）
    const x = (i * 37 + 11) % 100;
    const d = 18 + ((i * 7) % 11);
    const delay = -((i * 5.3) % d);
    const size = 2 + (i % 3);
    return `<span style="left:${x}%;--d:${d}s;--delay:${delay.toFixed(1)}s;--s:${size}px"></span>`;
  }).join('');
  const ambient = `
<div class="bt-ambient" aria-hidden="true">
  <span class="bt-ambient__glow bt-ambient__glow--1"></span>
  <span class="bt-ambient__glow bt-ambient__glow--2"></span>
  <span class="bt-ambient__glow bt-ambient__glow--3"></span>
  <svg class="bt-ambient__ribbons" viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
    <defs>
      <linearGradient id="bt-silk" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#c8102e" />
        <stop offset="0.55" stop-color="#c9a052" />
        <stop offset="1" stop-color="#c8102e" />
      </linearGradient>
    </defs>
    ${ribbons}
  </svg>
  <div class="bt-ambient__dust">${dust}</div>
</div>`;

  return `${ambient}
<header class="bt-hero" data-hero data-bt-hero>
  <canvas class="bt-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="bt-hero__fallback" aria-hidden="true"><span class="bt-hero__fallback-line"></span></div>
  <div class="bt-hero__frame" aria-hidden="true">
    <span class="bt-hero__corner bt-hero__corner--tl"></span>
    <span class="bt-hero__corner bt-hero__corner--tr"></span>
    <span class="bt-hero__corner bt-hero__corner--bl"></span>
    <span class="bt-hero__corner bt-hero__corner--br"></span>
  </div>
  <div class="bt-hero__inner">
    <p class="bt-hero__eyebrow"><span class="bt-hero__eyebrow-line" aria-hidden="true"></span>Invitation-only Introduction<span class="bt-hero__eyebrow-line" aria-hidden="true"></span></p>
    <h1 class="bt-hero__title">
      <a href="/profile/" aria-label="Baton -バトン- トップへ戻る">
        <span class="bt-hero__word" aria-hidden="true">${title}</span>
        <span class="bt-hero__kana" aria-hidden="true">バトン</span>
      </a>
    </h1>
    <span class="bt-hero__rule" data-bt-line aria-hidden="true"></span>
    <p class="bt-hero__tagline">選んだ人が、選んだ人へ。</p>
  </div>
  <div class="bt-hero__meta" aria-hidden="true">
    <span>Est. 2026 — Osaka</span>
    <span>by Music Japan</span>
  </div>
  <div class="bt-hero__scroll" aria-hidden="true"><span>Scroll</span><i></i></div>
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
