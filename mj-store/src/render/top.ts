import { cardArt, games } from '../data/games';
import { site } from '../data/site';
import type { BotId } from '../data/types';
import { botHtml, markSvg, wordHtml } from './brand';
import { allNews, faqHtml, gameCard, newsList, patchList, priceChip, requestBand, secHead } from './parts';
import {
  catchEm,
  catchHtml,
  deviceHtml,
  esc,
  gameHref,
  heroBgShot,
  href,
  icon,
  pad2,
  ph,
  platformsHtml,
  shotImg,
  themeVars,
  type RenderCtx,
} from './util';

const BOOT_LINES: [string, string, string][] = [
  ['MUSIC', 'BGM・効果音', 'OK'],
  ['GAMES', `${games.length} TITLES`, 'OK'],
  ['ROBOTS', '5体 出勤', 'OK'],
  ['LOVE', '過積載', 'OK'],
];

function bootHtml(): string {
  return `
  <div class="boot" data-boot hidden aria-hidden="true">
    <div class="boot__panel">
      <div class="boot__mark logo logo--boot">${markSvg('logo__mark')}${wordHtml()}</div>
      <ol class="boot__log">
        <li class="boot__line boot__line--head"><span>MJ STORE SYSTEM</span><span>v2.0</span></li>
        ${BOOT_LINES.map(
          ([k, v, ok], i) =>
            `<li class="boot__line" style="--i:${i}"><span class="boot__key">${k}</span><span class="boot__dots"></span><span class="boot__val">${v}</span><span class="boot__ok">[ ${ok} ]</span></li>`,
        ).join('')}
      </ol>
      <div class="boot__bar"><i></i></div>
      <p class="boot__skip">CLICK TO SKIP</p>
    </div>
  </div>`;
}

function featureHtml(ctx: RenderCtx): string {
  const n = games.length;
  return `
  <section class="feature" data-feature aria-roledescription="カルーセル" aria-label="おすすめ作品">
    <div class="feature__stage">
      ${games
        .map(
          (g, i) => `
      <article class="slide slide--${g.device}${i === 0 ? ' is-active' : ''}" data-slide="${i}" style="${themeVars(g)};--catch-em:${catchEm(g.catch, g.theme.latinWidth)}" aria-roledescription="スライド" aria-label="${i + 1} / ${n}：${esc(g.title)}"${i === 0 ? '' : ' aria-hidden="true"'}>
        <div class="slide__bg" aria-hidden="true">${heroBgShot(g) ? shotImg(ctx, heroBgShot(g)!, { cls: 'slide__bgimg', priority: i === 0, lazy: i !== 0 }) : ''}</div>
        <canvas class="ambient slide__ambient" data-ambient="${g.theme.ambient}" aria-hidden="true"></canvas>
        <div class="slide__shade" aria-hidden="true"></div>
        <div class="slide__device">${deviceHtml(ctx, g, { max: 4 })}</div>
        <div class="slide__body">
          <p class="slide__eyebrow"><span class="slide__badge">FEATURED</span><span class="slide__count">${pad2(i + 1)} / ${pad2(n)}</span><span class="slide__genre">${esc(g.genre)}</span></p>
          <p class="slide__title">${ph(g.title)}</p>
          <h2 class="slide__catch catch">${catchHtml(g.catch)}</h2>
          <p class="slide__note">${esc(g.catchNote)}</p>
          <div class="slide__cta">
            <a class="btn btn--game" href="${gameHref(ctx, g)}" data-sfx${i === 0 ? '' : ' tabindex="-1"'}><span>ストアページを見る</span>${icon.arrow}</a>
            ${priceChip()}
            ${platformsHtml(g.platforms, true)}
          </div>
        </div>
      </article>`,
        )
        .join('')}
      <div class="feature__wipe" aria-hidden="true"></div>
    </div>
    <ol class="feature__rail" role="tablist" aria-label="作品を選ぶ">
      ${games
        .map((g, i) => {
          const art = cardArt(g);
          return `
      <li role="presentation">
        <button type="button" class="rail${i === 0 ? ' is-active' : ''}" role="tab" aria-selected="${i === 0}" data-goto="${i}" style="${themeVars(g)}" data-sfx>
          <span class="rail__thumb">${art ? shotImg(ctx, art, { cls: 'rail__img', style: `object-position:${g.cardFocus}` }) : ''}</span>
          <span class="rail__meta">
            <span class="rail__no">${pad2(i + 1)}</span>
            <span class="rail__title">${esc(g.title)}</span>
            <span class="rail__genre">${esc(g.genre)}</span>
          </span>
          <span class="rail__bar" aria-hidden="true"><i></i></span>
        </button>
      </li>`;
        })
        .join('')}
    </ol>
  </section>`;
}

/** ストアの店員：Music Japan のちびロボ5体 */
function crewSection(): string {
  const roles: [BotId, string, string][] = [
    ['tune', '案内係', 'いらっしゃいませ担当。元気だけは負けない。'],
    ['spin', '夜ふかし係', 'いつも眠そう。プロペラで浮いている。'],
    ['pod', '音響係', 'ヘッドホンは外さない。BGMにうるさい。'],
    ['reel', '記録係', '更新は、ぜんぶ覚えている。'],
    ['mic', '司会係', 'お知らせとご要望の窓口。声が大きい。'],
  ];
  const stats = [
    { v: String(games.length), u: 'TITLES', l: '配信中の作品' },
    { v: '0', u: '円', l: '全作品 基本プレイ料金', prefix: '¥' },
    { v: '0', u: '回', l: 'インストール' },
    { v: '5', u: '体', l: 'ストアの店員' },
  ];
  return `
  <section class="crew-sec" data-crew-sec>
    <div class="container">
      ${secHead({ no: '04', en: 'STORE CREW', title: 'ストアの店員は、ちびロボです。' })}
      <p class="crew-sec__lead" data-reveal>${ph('Music Japanのちびロボ5体が、ストアのあちこちで作品を案内しています。')}${ph('見かけたら、押してみてください。しゃべります。')}</p>
      <ul class="crew-sec__list" data-bot-crew>
        ${roles
          .map(
            ([id, role, body], i) => `
        <li class="crew-card crew-card--${id}" data-reveal style="--d:${i}">
          ${botHtml(id)}
          <p class="crew-card__role">${role}</p>
          <p class="crew-card__body">${ph(body)}</p>
        </li>`,
          )
          .join('')}
      </ul>
      <dl class="made__stats">
        ${stats
          .map(
            (s) => `
        <div class="stat" data-reveal>
          <dt>${s.l}</dt>
          <dd><span class="stat__v">${s.prefix ?? ''}<span data-count="${s.v}">${s.v}</span></span><span class="stat__u">${s.u}</span></dd>
        </div>`,
          )
          .join('')}
      </dl>
    </div>
  </section>`;
}

export function topBody(ctx: RenderCtx): string {
  return `
  ${bootHtml()}
  <main id="main" class="store">
    <h1 class="sr">${site.name}｜${site.tagline}</h1>
    ${featureHtml(ctx)}

    <section class="shelf container">
      ${secHead({
        no: '01',
        en: 'ALL TITLES',
        title: 'ぜんぶ、ここにある。',
        more: { href: href(ctx, 'games/'), label: '作品一覧へ' },
        bot: botHtml('tune', { note: '気になる作品、押してみて！' }),
      })}
      <ul class="shelf__grid">
        ${games.map((g, i) => gameCard(ctx, g, i)).join('')}
      </ul>
    </section>

    <section class="updates container">
      <div class="updates__col">
        ${secHead({
          no: '02',
          en: 'NEWS',
          title: 'お知らせ',
          small: true,
          more: { href: href(ctx, 'news/'), label: 'すべて見る' },
          bot: botHtml('mic', { note: 'お知らせだよー！' }),
        })}
        ${newsList(ctx, allNews(games, site.news), 5)}
      </div>
      <div class="updates__col">
        ${secHead({
          no: '03',
          en: 'PATCH NOTES',
          title: 'バージョン履歴',
          small: true,
          more: { href: href(ctx, 'news/#patch'), label: 'すべて見る' },
          bot: botHtml('reel', { note: '更新、ぜんぶ記録してるよ' }),
        })}
        ${patchList(ctx, games)}
      </div>
    </section>

    ${crewSection()}

    <section class="top-faq container" aria-labelledby="top-faq-title">
      ${secHead({ no: '05', en: 'FAQ', title: 'よくある質問', id: 'top-faq-title', bot: botHtml('pod', { note: '…困ったら、ここ' }) })}
      ${faqHtml([...site.faq])}
    </section>

    <div class="container">${requestBand(ctx)}</div>
  </main>`;
}
