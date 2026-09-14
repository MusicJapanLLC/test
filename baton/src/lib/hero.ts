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
/** 名前を1文字ずつ span に包む。ヒーローで順に立ち上げるため（初期状態はCSS側） */
function splitChars(text: string): string {
  return Array.from(text)
    .map((ch, i) =>
      ch === ' ' || ch === '\u3000'
        ? '<span class="pf-name__char pf-name__char--space">&nbsp;</span>'
        : `<span class="pf-name__char" style="--i:${i}">${esc(ch)}</span>`,
    )
    .join('');
}

/**
 * 本人写真。src が無いとき・読み込みに失敗したときは頭文字に戻す
 * （失敗時の差し替えは profile/effects.ts 側でやる）。
 * 枠・罫・キャプションは写真そのものではなく額装として付ける。
 */
function heroShotHtml(p: TalkProfile): string {
  const initial = esc(p.name.slice(0, 1));
  const photo = p.photo;

  const inner = photo
    ? `<img class="pf-shot__img" src="${esc(photo.src)}" alt="${esc(photo.alt ?? p.name)}" data-shot-img />
       <span class="pf-shot__initial" aria-hidden="true">${initial}</span>`
    : `<span class="pf-shot__initial is-only" aria-hidden="true">${initial}</span>`;

  return `
  <figure class="pf-shot${photo ? '' : ' pf-shot--noimg'}" data-shot>
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

/**
 * プロフィールページのヒーロー。サービスページと同じく、ビルド時に
 * 静的HTMLへ焼き込む。
 *
 * `monument` / `heavyWebGL` を持つプロフィール（＝実データが入った「ミニLP」）は、
 * 写真を左・肩書きと本文を右に置く二段組の誌面型ヒーローを使う。
 * 持たないプロフィール（暫定の6件）は今まで通りの簡易ヒーローのまま。
 */
export function profileHeroHtml(p: TalkProfile, homeHref = '/'): string {
  const initial = esc(p.name.slice(0, 1));

  if (p.monument || p.heavyWebGL) {
    return `
<header class="pf-hero${p.heavyWebGL ? ' pf-hero--heavy' : ''}" data-hero>
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
        <a class="btn btn--primary" href="#talk-request">この人と話したい</a>
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

export function profileHubHeroHtml(): string {
  return `
<header class="hub-hero" data-hero>
  <canvas class="hub-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hub-hero__intro" aria-hidden="true"></div>
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
