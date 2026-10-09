import { STATUS_LABEL, statusOf } from '../data/games';
import type { Faq, Game, NewsItem } from '../data/types';
import { dot, esc, gameHref, href, icon, platformsHtml, shotImg, themeVars, type RenderCtx } from './util';

export function statusBadge(g: Game): string {
  const s = statusOf(g);
  return `<span class="status status--${s}"><i aria-hidden="true"></i>${STATUS_LABEL[s]}</span>`;
}

export function priceChip(): string {
  return `<span class="price-chip"><b>¥0</b><span>基本プレイ無料</span></span>`;
}

/** ストアの棚に並ぶカード。トップ・ストアページ下部で使う */
export function gameCard(ctx: RenderCtx, g: Game, i: number): string {
  return `
  <li class="card" style="${themeVars(g)};--d:${i}" data-reveal>
    <a class="card__link" href="${gameHref(ctx, g)}" data-tilt data-sfx>
      <span class="card__art">
        ${g.shots[0] ? shotImg(ctx, g.shots[0], { cls: 'card__img', style: `object-position:${g.cardFocus}` }) : ''}
        ${statusBadge(g)}
        <span class="card__title">${esc(g.title)}</span>
      </span>
      <span class="card__body">
        <span class="card__catch">${esc(g.catch.join(''))}</span>
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

interface TaggedNews extends NewsItem {
  game?: Game;
}

export function newsList(ctx: RenderCtx, items: TaggedNews[], limit = 6): string {
  return `<ul class="news-list">${items
    .slice(0, limit)
    .map(
      (n) => `
    <li class="news-item" data-reveal>
      <time datetime="${n.date}">${dot(n.date)}</time>
      <span class="news-item__tag">${esc(n.tag)}</span>
      <div class="news-item__body">
        ${
          n.game
            ? `<a class="news-item__game" href="${gameHref(ctx, n.game)}" style="--g-accent:${n.game.theme.accent}">${esc(n.game.title)}</a>`
            : ''
        }
        <p class="news-item__title">${esc(n.title)}</p>
        ${n.body ? `<p class="news-item__text">${esc(n.body)}</p>` : ''}
      </div>
    </li>`,
    )
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

/** 各ゲームの最新バージョンを並べる */
export function patchList(ctx: RenderCtx, games: Game[]): string {
  const rows = games
    .filter((g) => g.versions.length)
    .map((g) => ({ g, v: g.versions[0] }))
    .sort((a, b) => (a.v.date < b.v.date ? 1 : a.v.date > b.v.date ? -1 : 0));
  return `<ul class="patch-list">${rows
    .map(
      ({ g, v }) => `
    <li class="patch-item" style="${themeVars(g)}" data-reveal>
      <a href="${gameHref(ctx, g)}#versions" data-sfx>
        <span class="patch-item__ver">${esc(v.version)}</span>
        <span class="patch-item__main">
          <span class="patch-item__game">${esc(g.title)}</span>
          <span class="patch-item__title">${esc(v.title)}</span>
        </span>
        <time datetime="${v.date}">${dot(v.date)}</time>
      </a>
    </li>`,
    )
    .join('')}</ul>`;
}

export function requestBand(ctx: RenderCtx, g?: Game): string {
  const q = g ? `?game=${encodeURIComponent(g.slug)}` : '';
  return `
  <section class="call" data-reveal>
    <div class="call__inner">
      <p class="eyebrow"><span>REQUEST</span></p>
      <h2 class="call__title">バグを見つけたら、<br class="sp" />教えてください。</h2>
      <p class="call__text">「こうしたらいいやん」も大歓迎。${
        g ? `『${esc(g.title)}』への声は、` : 'いただいた声は、'
      }開発チームが全部読んで、次のアップデートに活かします。</p>
      <div class="call__actions">
        <a class="btn btn--primary" href="${href(ctx, `request/${q}`)}" data-sfx>
          <span>ご要望・バグ報告へ</span>${icon.arrow}
        </a>
      </div>
    </div>
    <div class="call__deco" aria-hidden="true">${icon.bug}</div>
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
      <summary><span class="faq__q">Q</span><span class="faq__qt">${esc(f.q)}</span><span class="faq__icon" aria-hidden="true"></span></summary>
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
