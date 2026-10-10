import { cardArt, games } from '../data/games';
import type { Platform } from '../data/types';
import { botHtml } from './brand';
import { statusBadge } from './parts';
import { dot, esc, gameHref, href, icon, pad2, ph, platformsHtml, shotImg, themeVars, type RenderCtx } from './util';

const FILTERS: ('ALL' | Platform)[] = ['ALL', 'スマホ', 'PC'];

export function libraryBody(ctx: RenderCtx): string {
  const usedPlatforms = new Set(games.flatMap((g) => g.platforms));
  const filters = FILTERS.filter((f) => f === 'ALL' || usedPlatforms.has(f));

  return `
  <main id="main" class="library">
    <section class="lib-head container">
      <p class="eyebrow" data-reveal><span>LIBRARY</span><span>作品一覧</span></p>
      <div class="lib-head__top">
        <h1 class="lib-title" data-reveal>
          <span class="lib-title__en" aria-hidden="true">LIBRARY</span>
          <span class="lib-title__ja">作品一覧</span>
        </h1>
        <div class="lib-head__bot" data-reveal>${botHtml('tune', { note: '全部、無料で遊べるよ！', line: 'どれから遊ぶ？｜スマホでもPCでもOK！' })}</div>
      </div>
      <div class="lib-head__row" data-reveal>
        <p class="lib-count"><b data-lib-count>${games.length}</b><span>TITLES</span><em>全作品、基本プレイ無料。</em></p>
        <div class="lib-tools">
          <div class="chips" role="group" aria-label="対応機種で絞り込む">
            ${filters
              .map(
                (f, i) =>
                  `<button type="button" class="chip${i === 0 ? ' is-on' : ''}" data-filter="${f}" aria-pressed="${i === 0}" data-sfx>${f === 'ALL' ? 'すべて' : esc(f)}</button>`,
              )
              .join('')}
          </div>
          <div class="view-toggle" role="group" aria-label="表示の切り替え">
            <button type="button" class="view-btn is-on" data-view="grid" aria-pressed="true" data-sfx>GRID</button>
            <button type="button" class="view-btn" data-view="list" aria-pressed="false" data-sfx>LIST</button>
          </div>
        </div>
      </div>
    </section>

    <section class="container" aria-label="作品">
      <ul class="lib-grid" data-lib data-view="grid">
        ${games
          .map((g, i) => {
            const v = g.versions[0];
            return `
        <li class="lib-item" style="${themeVars(g)};--d:${i}" data-platforms="${g.platforms.join(' ')}" data-reveal>
          <a class="lib-item__link" href="${gameHref(ctx, g)}" data-tilt data-sfx>
            <span class="lib-item__no">No.${pad2(i + 1)}</span>
            <span class="lib-item__art lib-item__art--${g.device}">
              ${[cardArt(g), g.shots.find((sh) => sh !== cardArt(g))]
                .filter((sh) => sh !== undefined)
                .map((sh, k) => shotImg(ctx, sh!, { cls: `lib-item__img${k === 1 ? ' lib-item__img--alt' : ''}`, style: `object-position:${g.cardFocus}` }))
                .join('')}
              ${statusBadge(g)}
            </span>
            <span class="lib-item__body">
              <span class="lib-item__genre">${esc(g.genre)}</span>
              <span class="lib-item__title">${ph(g.title)}</span>
              <span class="lib-item__catch">${ph(g.catch.join(''))}</span>
              <span class="lib-item__meta">
                ${platformsHtml(g.platforms, true)}
                ${v ? `<span class="lib-item__ver">${esc(v.version)}<time datetime="${v.date}">${dot(v.date)}</time></span>` : ''}
                <span class="lib-item__price"><b>¥0</b> 基本プレイ無料</span>
              </span>
            </span>
            <span class="lib-item__go" aria-hidden="true">${icon.arrow}</span>
          </a>
        </li>`;
          })
          .join('')}
        <li class="lib-item lib-item--next" data-reveal>
          <div class="lib-next">
            <span class="lib-item__no">No.${pad2(games.length + 1)}</span>
            <p class="lib-next__label">NEXT TITLE</p>
            <p class="lib-next__title">${ph('次の作品、')}<br />${ph('開発中。')}</p>
            <p class="lib-next__text">${ph('ここに並ぶ日を、私たちがいちばん楽しみにしています。')}</p>
            <div class="lib-next__bot">${botHtml('reel', { note: '完成したら、ここに記録するね', line: 'いま、つくってるところ｜ネタバレは記録できません' })}</div>
            <a class="btn btn--ghost" href="${href(ctx, 'request/?type=idea')}" data-sfx><span>こんなゲームが遊びたい、を送る</span>${icon.arrow}</a>
          </div>
        </li>
      </ul>
      <p class="lib-empty" data-lib-empty hidden>この機種の作品は、いま準備中です。</p>
    </section>
  </main>`;
}
