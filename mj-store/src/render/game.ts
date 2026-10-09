import { faqOf, games, statusOf } from '../data/games';
import { site } from '../data/site';
import type { Game } from '../data/types';
import { faqHtml, faqJsonLd, gameCard, requestBand, statusBadge } from './parts';
import {
  abs,
  catchEm,
  catchHtml,
  deviceHtml,
  isBrowserShot,
  dot,
  esc,
  href,
  icon,
  pad2,
  platformsHtml,
  heroBgShot,
  shotImg,
  stars,
  type RenderCtx,
} from './util';

function playButton(g: Game, extraClass = ''): string {
  if (statusOf(g) === 'live' && g.playUrl) {
    return `<a class="btn btn--play ${extraClass}" href="${esc(g.playUrl)}" target="_blank" rel="noopener" data-sfx data-play>
      <span class="btn__icon">${icon.play}</span><span>無料でプレイ</span></a>`;
  }
  return `<span class="btn btn--play is-soon ${extraClass}" aria-disabled="true">
      <span class="btn__icon">${icon.play}</span><span>まもなく配信</span></span>`;
}

function heroHtml(ctx: RenderCtx, g: Game): string {
  return `
  <section class="g-hero g-hero--${g.device}" style="--catch-em:${catchEm(g.catch, g.theme.latinWidth)}">
    <div class="g-hero__bg" aria-hidden="true">${heroBgShot(g) ? shotImg(ctx, heroBgShot(g)!, { cls: 'g-hero__bgimg', lazy: false }) : ''}</div>
    <canvas class="ambient g-hero__ambient" data-ambient="${g.theme.ambient}" aria-hidden="true"></canvas>
    <div class="g-hero__shade" aria-hidden="true"></div>
    <div class="g-hero__inner container">
      <nav class="crumbs" aria-label="現在地">
        <a href="${href(ctx, '')}">STORE</a><span aria-hidden="true">/</span>
        <a href="${href(ctx, 'games/')}">作品一覧</a><span aria-hidden="true">/</span>
        <span aria-current="page">${esc(g.title)}</span>
      </nav>
      <div class="g-hero__head">
        <p class="g-hero__title">${esc(g.title)}<small>${esc(g.titleEn)}</small></p>
        ${statusBadge(g)}
      </div>
      <h1 class="g-hero__catch catch"><span class="sr">${esc(g.title)}｜</span>${catchHtml(g.catch)}</h1>
      <p class="g-hero__note">${esc(g.catchNote)}</p>
      <div class="g-hero__buy" data-buy-anchor>
        ${playButton(g)}
        <div class="price">
          <b>¥0</b>
          <span>基本プレイ無料<br />ゲーム内課金あり</span>
        </div>
        ${platformsHtml(g.platforms, true)}
      </div>
    </div>
    <div class="g-hero__device">${deviceHtml(ctx, g, { priority: true })}</div>
    <p class="g-hero__scroll" aria-hidden="true"><span>SCROLL</span><i></i></p>
  </section>`;
}

function aboutHtml(g: Game): string {
  const facts: [string, string][] = [
    ['ジャンル', g.genre],
    ['対応', `${g.platforms.join('・')}（ブラウザ）`],
    ['価格', '基本プレイ無料'],
    ['最新版', g.currentVersion],
  ];
  return `
  <section class="g-sec g-about container" id="about">
    <header class="g-head" data-reveal>
      <p class="g-head__en">ABOUT</p>
      <h2 class="g-head__ja">この作品について</h2>
    </header>
    <div class="g-about__grid">
      <div class="g-about__text" data-reveal>
        <p class="g-about__lead">${esc(g.lead)}</p>
        ${g.description.map((p) => `<p>${esc(p)}</p>`).join('')}
        <ul class="tags">${g.tags.map((t) => `<li>#${esc(t)}</li>`).join('')}</ul>
      </div>
      <aside class="review" data-reveal>
        <p class="review__label">おすすめ度</p>
        ${stars()}
        <p class="review__quote">「${esc(g.review)}」</p>
        <p class="review__by">── 開発チーム調べ</p>
        <dl class="facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>
      </aside>
    </div>
  </section>`;
}

function shotsHtml(ctx: RenderCtx, g: Game): string {
  if (!g.shots.length) return '';
  /* ブラウザで撮った画面とフル画面が混ざるときは、ブラウザの画面の比率にそろえる */
  const ref = g.device === 'phone' ? g.shots.find(isBrowserShot) : undefined;
  const ratio = ref ? ` style="--shot-ratio:${ref.w} / ${ref.h}"` : '';
  return `
  <section class="g-sec g-shots g-shots--${g.device}" id="screenshots">
    <div class="container">
      <header class="g-head" data-reveal>
        <p class="g-head__en">SCREENSHOTS</p>
        <h2 class="g-head__ja">実際の画面</h2>
      </header>
    </div>
    <ul class="shots shots--${g.device}" data-shots${ratio}>
      ${g.shots
        .map(
          (s, i) => `
      <li class="shot" data-reveal style="--d:${i}">
        <button type="button" class="shot__btn" data-lightbox="${i}" aria-label="${esc(s.caption)}を大きく見る" data-sfx>
          ${shotImg(ctx, s, { cls: 'shot__img', style: s.focus ? `object-position:${s.focus}` : undefined })}
        </button>
        <p class="shot__cap"><span class="shot__no">${pad2(i + 1)}</span>${esc(s.caption)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </section>`;
}

const KANJI = ['壱', '弐', '参', '肆', '伍', '陸'];

function featuresHtml(g: Game): string {
  return `
  <section class="g-sec g-features container" id="features">
    <header class="g-head" data-reveal>
      <p class="g-head__en">FEATURES</p>
      <h2 class="g-head__ja">ここが、推し。</h2>
    </header>
    <ol class="feats">
      ${g.features
        .map(
          (f, i) => `
      <li class="feat" data-reveal style="--d:${i}">
        <div class="feat__post" aria-hidden="true">
          <span class="feat__avatar">${esc(g.title.slice(0, 1))}</span>
          <span class="feat__name">${esc(g.title)} 公式<small>@${esc(g.slug.replace(/-/g, '_'))}</small></span>
        </div>
        <span class="feat__no" data-alt="${KANJI[i] ?? pad2(i + 1)}">${pad2(i + 1)}</span>
        <h3 class="feat__title">${esc(f.title)}</h3>
        <p class="feat__body">${esc(f.body)}</p>
        <div class="feat__actions" aria-hidden="true">
          <span>${icon.reply}返信</span><span>${icon.repost}リポスト</span><span class="is-liked">${icon.heart}いいね</span>
        </div>
      </li>`,
        )
        .join('')}
    </ol>
  </section>`;
}

function logHtml(ctx: RenderCtx, g: Game): string {
  return `
  <section class="g-sec g-log container">
    <div class="g-log__col" id="news">
      <header class="g-head" data-reveal>
        <p class="g-head__en">NEWS</p>
        <h2 class="g-head__ja">お知らせ</h2>
      </header>
      <ul class="g-news">
        ${g.news
          .map(
            (n) => `
        <li class="g-news__item" data-reveal>
          <p class="g-news__meta"><time datetime="${n.date}">${dot(n.date)}</time><span class="g-news__tag">${esc(n.tag)}</span></p>
          <p class="g-news__title">${esc(n.title)}</p>
          ${n.body ? `<p class="g-news__body">${esc(n.body)}</p>` : ''}
        </li>`,
          )
          .join('')}
      </ul>
    </div>
    <div class="g-log__col" id="versions">
      <header class="g-head" data-reveal>
        <p class="g-head__en">VERSION HISTORY</p>
        <h2 class="g-head__ja">バージョン履歴</h2>
      </header>
      <ol class="vers" data-versions>
        <li class="ver ver--next" data-reveal>
          <p class="ver__head"><span class="ver__no">NEXT</span><span class="ver__date">COMING SOON</span></p>
          <p class="ver__title">次のアップデートを、つくっています。</p>
          <p class="ver__text">入れてほしい機能は、<a href="${href(ctx, `request/?game=${g.slug}&type=idea`)}">こちらから</a>どうぞ。</p>
        </li>
        ${g.versions
          .map(
            (v, i) => `
        <li class="ver${i === 0 ? ' is-latest' : ''}" data-reveal>
          <p class="ver__head"><span class="ver__no">${esc(v.version)}</span><time class="ver__date" datetime="${v.date}">${dot(v.date)}</time>${i === 0 ? '<span class="ver__latest">LATEST</span>' : ''}</p>
          <p class="ver__title">${esc(v.title)}</p>
          <ul class="ver__notes">${v.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </li>`,
          )
          .join('')}
      </ol>
      <span class="vers__end" data-versions-end aria-hidden="true"></span>
    </div>
  </section>`;
}

function infoHtml(g: Game): string {
  const rows: [string, string, string?][] = [
    ['タイトル', `${g.title}（${g.subtitle}）`],
    ['ジャンル', g.genre],
    ['遊べる場所', g.playUrl, g.playUrl],
    ['対応', `${g.platforms.join('・')}（ブラウザで動作・インストール不要）`],
    ['言語', g.languages.join('・')],
    ['価格', '基本プレイ無料（ゲーム内課金あり）'],
    ['最新版', g.currentVersion],
    ['操作', g.controls],
    ['セーブ', g.save],
    ['音楽', 'Music Japan'],
    ['物語', 'Music Japan'],
    ['システム', 'Music Japan'],
    ['開発・運営', '合同会社Music Japan'],
    ['配信', 'MJ STORE'],
  ];
  return `
  <section class="g-sec g-info container" id="info">
    <header class="g-head" data-reveal>
      <p class="g-head__en">INFORMATION</p>
      <h2 class="g-head__ja">作品情報</h2>
    </header>
    <dl class="info" data-reveal>
      ${rows
        .map(
          ([k, v, link]) =>
            `<div class="info__row${v.includes('Music Japan') ? ' is-mj' : ''}"><dt>${k}</dt><dd>${
              link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)
            }</dd></div>`,
        )
        .join('')}
    </dl>
  </section>`;
}

function faqSection(ctx: RenderCtx, g: Game): string {
  return `
  <section class="g-sec g-faq container" id="faq">
    <header class="g-head" data-reveal>
      <p class="g-head__en">FAQ</p>
      <h2 class="g-head__ja">よくある質問</h2>
    </header>
    ${faqHtml(faqOf(g, abs(ctx, 'request/')))}
  </section>`;
}

function moreHtml(ctx: RenderCtx, g: Game): string {
  const others = games.filter((o) => o.id !== g.id);
  if (!others.length) return '';
  return `
  <section class="g-more">
    <div class="container">
      <header class="sec-head" data-reveal>
        <p class="eyebrow"><span>MORE</span><span>ほかの作品</span></p>
        <h2 class="sec-title">こちらも、自社製です。</h2>
        <a class="link-more" href="${href(ctx, 'games/')}" data-sfx><span>作品一覧へ</span>${icon.arrow}</a>
      </header>
      <ul class="shelf__grid">${others.map((o, i) => gameCard(ctx, o, i)).join('')}</ul>
    </div>
  </section>`;
}

function buybarHtml(g: Game): string {
  return `
  <div class="buybar" data-buybar aria-hidden="true">
    <div class="buybar__inner">
      <p class="buybar__title">${esc(g.title)}</p>
      <p class="buybar__price"><b>¥0</b><span>基本プレイ無料</span></p>
      ${playButton(g, 'btn--small')}
    </div>
  </div>`;
}

function lightboxHtml(ctx: RenderCtx, g: Game): string {
  return `
  <div class="lightbox" data-lightbox-root hidden role="dialog" aria-modal="true" aria-label="${esc(g.title)}の画面">
    <button type="button" class="lightbox__close" data-lb-close aria-label="閉じる">${icon.close}</button>
    <button type="button" class="lightbox__nav lightbox__nav--prev" data-lb-prev aria-label="前の画面">←</button>
    <figure class="lightbox__fig lightbox__fig--${g.device}">
      <img class="lightbox__img" data-lb-img alt="" />
      <figcaption class="lightbox__cap" data-lb-cap></figcaption>
    </figure>
    <button type="button" class="lightbox__nav lightbox__nav--next" data-lb-next aria-label="次の画面">→</button>
    <script type="application/json" data-lb-data>${JSON.stringify(
      g.shots.map((s) => ({ src: href(ctx, s.src), alt: s.alt, cap: s.caption })),
    ).replace(/</g, '\\u003c')}</script>
  </div>`;
}

export function gameBody(ctx: RenderCtx, g: Game): string {
  return `
  <main id="main" class="game skin-${g.theme.skin}" data-game="${g.id}">
    ${heroHtml(ctx, g)}
    ${aboutHtml(g)}
    ${shotsHtml(ctx, g)}
    ${featuresHtml(g)}
    ${logHtml(ctx, g)}
    ${infoHtml(g)}
    ${faqSection(ctx, g)}
    <div class="container">${requestBand(ctx, g)}</div>
    ${moreHtml(ctx, g)}
  </main>
  ${buybarHtml(g)}
  ${lightboxHtml(ctx, g)}`;
}

/** ストアページの構造化データ：ゲーム本体・パンくず・よくある質問 */
export function gameJsonLd(ctx: RenderCtx, g: Game): Record<string, unknown>[] {
  const url = abs(ctx, `games/${g.slug}/`);
  const latest = g.versions[0];
  const lang: Record<string, string> = { 日本語: 'ja', English: 'en', 한국어: 'ko' };
  const game: Record<string, unknown> = {
    '@type': ['VideoGame', 'SoftwareApplication'],
    '@id': `${url}#game`,
    name: g.title,
    alternateName: [g.titleEn, `${g.title} ${g.subtitle}`],
    description: `${g.lead} ${g.description.join(' ')}`,
    url,
    genre: g.genre,
    keywords: g.tags.join(', '),
    inLanguage: g.languages.map((l) => lang[l] ?? l),
    gamePlatform: g.platforms.map((p) => (p === 'PC' ? 'PC（Webブラウザ）' : 'スマートフォン（Webブラウザ）')),
    operatingSystem: 'Webブラウザ（Windows / macOS / iOS / Android）',
    applicationCategory: 'GameApplication',
    playMode: 'SinglePlayer',
    softwareVersion: g.currentVersion,
    image: g.shots.map((s) => abs(ctx, s.src)),
    screenshot: g.shots.map((s) => ({
      '@type': 'ImageObject',
      url: abs(ctx, s.src),
      width: s.w,
      height: s.h,
      caption: s.alt,
    })),
    author: { '@id': `${ctx.siteUrl}/#organization` },
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    creator: { '@id': `${ctx.siteUrl}/#organization` },
    musicBy: { '@id': `${ctx.siteUrl}/#organization` },
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
      url: g.playUrl || url,
      description: '基本プレイ無料（ゲーム内課金あり）',
    },
  };
  if (g.playUrl) {
    game.sameAs = [g.playUrl];
    game.potentialAction = { '@type': 'PlayAction', target: g.playUrl };
  }
  if (latest) {
    game.dateModified = latest.date;
    game.releaseNotes = `${latest.version} ${latest.title}：${latest.notes.join('／')}`;
  }
  return [
    game,
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.name, item: `${ctx.siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: '作品一覧', item: abs(ctx, 'games/') },
        { '@type': 'ListItem', position: 3, name: g.title, item: url },
      ],
    },
    faqJsonLd(faqOf(g, abs(ctx, 'request/')), url),
  ];
}
