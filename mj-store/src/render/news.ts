import { games } from '../data/games';
import { site } from '../data/site';
import { botHtml } from './brand';
import { allNews, newsHref, patchRow, requestBand } from './parts';
import { dot, esc, href, icon, ph, type RenderCtx } from './util';

/**
 * お知らせ・更新のページ。ストアと全作品のお知らせ、全作品のバージョン履歴をまとめて読める。
 * 上のチップで作品ごとに絞り込める（[data-news-filter]）
 */
export function newsBody(ctx: RenderCtx): string {
  const news = allNews(games, site.news);
  const versions = games
    .flatMap((g) => g.versions.map((v, i) => ({ g, v, latest: i === 0 })))
    .sort((a, b) => (a.v.date < b.v.date ? 1 : a.v.date > b.v.date ? -1 : 0));

  const chip = (key: string, label: string, style = '') =>
    `<button type="button" class="chip${key === 'all' ? ' is-on' : ''}" data-filter="${key}" aria-pressed="${key === 'all'}"${style ? ` style="${style}"` : ''} data-sfx>${label}</button>`;

  return `
  <main id="main" class="news-page">
    <section class="page-hero container">
      <nav class="crumbs" aria-label="現在地">
        <a href="${href(ctx, '')}">STORE</a><span aria-hidden="true">/</span><span aria-current="page">お知らせ・更新</span>
      </nav>
      <p class="eyebrow"><span>NEWS</span><span>UPDATES</span></p>
      <h1 class="page-hero__title">${ph('お知らせ・更新')}</h1>
      <p class="page-hero__lead">${ph('ストアと全作品のお知らせ、アップデートの記録をまとめています。')}${ph('押すと、その作品のページへ飛べます。')}</p>
      <div class="page-hero__bots">
        ${botHtml('mic', { note: '新しい順に並んでるよー！' })}
        ${botHtml('reel', { note: '更新は、ぜんぶ記録済み', side: 'left' })}
      </div>
    </section>

    <div class="container">
      <div class="chips" role="group" aria-label="作品で絞り込む" data-news-filter>
        ${chip('all', 'すべて')}
        ${chip('store', 'ストア')}
        ${games.map((g) => chip(g.id, esc(g.title), `--g-accent:${g.theme.accent}`)).join('')}
      </div>
    </div>

    <section class="news-sec container" aria-labelledby="news-title">
      <header class="sec-head sec-head--small" data-reveal>
        <p class="eyebrow"><span>01</span><span>NEWS</span></p>
        <h2 class="sec-title" id="news-title">お知らせ</h2>
      </header>
      <ul class="news-list news-list--full">
        ${news
          .map((n) => {
            const to = newsHref(ctx, n);
            const inner = `
          <span class="news-item__meta"><time datetime="${n.date}">${dot(n.date)}</time><span class="news-item__tag">${esc(n.tag)}</span></span>
          <span class="news-item__body">
            ${n.game ? `<span class="news-item__game">${esc(n.game.title)}</span>` : '<span class="news-item__game is-store">MJ STORE</span>'}
            <span class="news-item__title">${ph(n.title)}</span>
            ${n.body ? `<span class="news-item__text">${esc(n.body)}</span>` : ''}
          </span>
          ${to ? `<span class="news-item__go" aria-hidden="true">${icon.arrow}</span>` : ''}`;
            return `
        <li class="news-item" data-reveal data-key="${n.game ? n.game.id : 'store'}"${n.game ? ` style="--g-accent:${n.game.theme.accent}"` : ''}>
          ${to ? `<a class="news-item__link" href="${to}" data-sfx>${inner}</a>` : `<div class="news-item__link">${inner}</div>`}
        </li>`;
          })
          .join('')}
      </ul>
    </section>

    <section class="news-sec container" id="patch" aria-labelledby="patch-title">
      <header class="sec-head sec-head--small" data-reveal>
        <p class="eyebrow"><span>02</span><span>PATCH NOTES</span></p>
        <h2 class="sec-title" id="patch-title">バージョン履歴</h2>
      </header>
      <ul class="patch-list patch-list--full">
        ${versions.map(({ g, v, latest }) => patchRow(ctx, g, v, { latest }).replace('<li class="patch-item"', `<li class="patch-item" data-key="${g.id}"`)).join('')}
      </ul>
      <p class="news-sec__empty" data-news-empty hidden>${ph('この作品のお知らせは、まだありません。')}</p>
    </section>

    <div class="container">${requestBand(ctx)}</div>
  </main>`;
}
