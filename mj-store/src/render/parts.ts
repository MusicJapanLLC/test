import { cardArt, STATUS_LABEL, statusOf } from '../data/games';
import type { Faq, Game, NewsItem } from '../data/types';
import { botHtml } from './brand';
import { dot, esc, gameHref, href, icon, ph, platformsHtml, shotImg, themeVars, type RenderCtx } from './util';

export function statusBadge(g: Game): string {
  const s = statusOf(g);
  return `<span class="status status--${s}"><i aria-hidden="true"></i>${STATUS_LABEL[s]}</span>`;
}

export function priceChip(): string {
  return `<span class="price-chip"><b>¥0</b><span>基本プレイ無料</span></span>`;
}

/** 見出し（英字の小見出し＋日本語の大見出し）。ロボを添えると、見出しの横で解説する */
export function secHead(opts: {
  no?: string;
  en: string;
  title: string;
  id?: string;
  small?: boolean;
  more?: { href: string; label: string };
  bot?: string;
}): string {
  return `
  <header class="sec-head${opts.small ? ' sec-head--small' : ''}${opts.bot ? ' has-bot' : ''}" data-reveal>
    <p class="eyebrow">${opts.no ? `<span>${opts.no}</span>` : ''}<span>${opts.en}</span></p>
    <h2 class="sec-title"${opts.id ? ` id="${opts.id}"` : ''}>${ph(opts.title)}</h2>
    ${opts.more ? `<a class="link-more" href="${opts.more.href}" data-sfx><span>${esc(opts.more.label)}</span>${icon.arrow}</a>` : ''}
    ${opts.bot ?? ''}
  </header>`;
}

/** ストアの棚に並ぶカード。トップ・ストアページ下部で使う */
export function gameCard(ctx: RenderCtx, g: Game, i: number): string {
  const art = cardArt(g);
  return `
  <li class="card" style="${themeVars(g)};--d:${i}" data-reveal>
    <a class="card__link" href="${gameHref(ctx, g)}" data-tilt data-sfx>
      <span class="card__art">
        ${art ? shotImg(ctx, art, { cls: 'card__img', style: `object-position:${g.cardFocus}` }) : ''}
        ${statusBadge(g)}
        <span class="card__title">${ph(g.title)}</span>
      </span>
      <span class="card__body">
        <span class="card__catch">${ph(g.catch.join(''))}</span>
        <span class="card__meta">
          <span class="card__genre">${esc(g.genre)}</span>
          ${platformsHtml(g.platforms)}
        </span>
        <span class="card__foot">
          ${priceChip()}
          <span class="card__go" aria-hidden="true">${icon.arrow}</span>
        </span>
      </span>
    </a>
  </li>`;
}

export interface TaggedNews extends NewsItem {
  game?: Game;
}

/** お知らせの行き先。作品のお知らせは作品ページのお知らせ欄へ */
export const newsHref = (ctx: RenderCtx, n: TaggedNews): string | null =>
  n.game ? `${gameHref(ctx, n.game)}#news` : n.href !== undefined ? href(ctx, n.href) : null;

export function newsList(ctx: RenderCtx, items: TaggedNews[], limit = 6): string {
  return `<ul class="news-list">${items
    .slice(0, limit)
    .map((n) => {
      const to = newsHref(ctx, n);
      const inner = `
        <span class="news-item__meta">
          <time datetime="${n.date}">${dot(n.date)}</time>
          <span class="news-item__tag">${esc(n.tag)}</span>
        </span>
        <span class="news-item__body">
          ${n.game ? `<span class="news-item__game">${esc(n.game.title)}</span>` : ''}
          <span class="news-item__title">${ph(n.title)}</span>
          ${n.body ? `<span class="news-item__text">${esc(n.body)}</span>` : ''}
        </span>
        ${to ? `<span class="news-item__go" aria-hidden="true">${icon.arrow}</span>` : ''}`;
      return `
    <li class="news-item" data-reveal${n.game ? ` style="--g-accent:${n.game.theme.accent}"` : ''}>
      ${to ? `<a class="news-item__link" href="${to}" data-sfx>${inner}</a>` : `<div class="news-item__link">${inner}</div>`}
    </li>`;
    })
    .join('')}</ul>`;
}

/** ストア全体と各ゲームのお知らせを、日付の新しい順にまとめる */
export function allNews(games: Game[], storeNews: readonly NewsItem[]): TaggedNews[] {
  const list: TaggedNews[] = [
    ...storeNews.map((n) => ({ ...n })),
    ...games.flatMap((g) => g.news.map((n) => ({ ...n, game: g }))),
  ];
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * バージョン履歴の1行。左の札（版の名前と日付）はどの作品でも同じ大きさ。
 * 押すと、その作品のバージョン履歴へ飛ぶ
 */
export function patchRow(ctx: RenderCtx, g: Game, v: Game['versions'][number], opts: { latest?: boolean } = {}): string {
  return `
    <li class="patch-item" style="${themeVars(g)}" data-reveal>
      <a href="${gameHref(ctx, g)}#versions" data-sfx>
        <span class="patch-item__tag">
          <span class="patch-item__ver">${v.version === dot(v.date) ? 'UPDATE' : esc(v.version)}</span>
          <time datetime="${v.date}">${dot(v.date)}</time>
        </span>
        <span class="patch-item__main">
          <span class="patch-item__game">${esc(g.title)}${opts.latest ? '<span class="patch-item__new">NEW</span>' : ''}</span>
          <span class="patch-item__title">${esc(v.title)}</span>
        </span>
        <span class="patch-item__go" aria-hidden="true">${icon.arrow}</span>
      </a>
    </li>`;
}

/** 各ゲームの最新バージョンを並べる */
export function patchList(ctx: RenderCtx, games: Game[]): string {
  const rows = games
    .filter((g) => g.versions.length)
    .map((g) => ({ g, v: g.versions[0] }))
    .sort((a, b) => (a.v.date < b.v.date ? 1 : a.v.date > b.v.date ? -1 : 0));
  return `<ul class="patch-list">${rows.map(({ g, v }) => patchRow(ctx, g, v)).join('')}</ul>`;
}

export function requestBand(ctx: RenderCtx, g?: Game): string {
  const q = g ? `?game=${encodeURIComponent(g.slug)}` : '';
  return `
  <section class="call" data-reveal>
    <div class="call__inner">
      <p class="eyebrow"><span>REQUEST</span></p>
      <h2 class="call__title">${ph('バグを見つけたら、教えてください。')}</h2>
      <p class="call__text">「こうしたらいいやん」も大歓迎。${
        g ? `『${esc(g.title)}』への声は、` : 'いただいた声は、'
      }開発チームが全部読んで、次のアップデートに活かします。</p>
      <div class="call__actions">
        <a class="btn btn--primary" href="${href(ctx, `request/${q}`)}" data-sfx>
          <span>ご要望・バグ報告へ</span>${icon.arrow}
        </a>
      </div>
    </div>
    <div class="call__bot">${botHtml('mic', { note: 'ご要望、聞かせて！', line: 'バグ、見つけた？｜「こうしたらいいやん」も歓迎！' })}</div>
  </section>`;
}

/** 「よくある質問」。<details> で開閉。構造化データ（FAQPage）と同じ中身を出す */
export function faqHtml(items: Faq[]): string {
  return `
  <div class="faq">
    ${items
      .map(
        (f, i) => `
    <details class="faq__item" data-reveal${i === 0 ? ' open' : ''}>
      <summary data-sfx><span class="faq__q">Q</span><span class="faq__qt">${ph(f.q)}</span><span class="faq__icon" aria-hidden="true"></span></summary>
      <div class="faq__a"><span class="faq__al">A</span><p>${esc(f.a)}</p></div>
    </details>`,
      )
      .join('')}
  </div>`;
}

export function faqJsonLd(items: Faq[], url: string): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
