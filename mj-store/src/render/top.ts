import { games } from '../data/games';
import { site } from '../data/site';
import { allNews, faqHtml, gameCard, newsList, patchList, priceChip, requestBand } from './parts';
import {
  catchEm,
  catchHtml,
  deviceHtml,
  esc,
  gameHref,
  href,
  icon,
  pad2,
  platformsHtml,
  heroBgShot,
  shotImg,
  themeVars,
  type RenderCtx,
} from './util';

const BOOT_LINES: [string, string, string][] = [
  ['MUSIC', '自社製', 'OK'],
  ['STORY', '自社製', 'OK'],
  ['SYSTEM', '自社製', 'OK'],
  ['LOVE', '過積載', 'OK'],
];

function bootHtml(): string {
  return `
  <div class="boot" data-boot hidden aria-hidden="true">
    <div class="boot__panel">
      <div class="boot__mark"><span class="logo__mark">MJ</span><span class="boot__word">STORE</span></div>
      <ol class="boot__log">
        <li class="boot__line boot__line--head"><span>MJ STORE SYSTEM</span><span>v1.0</span></li>
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
          <p class="slide__eyebrow"><span class="slide__badge">FEATURED</span><span>${pad2(i + 1)} / ${pad2(n)}</span><span class="slide__genre">${esc(g.genre)}</span></p>
          <p class="slide__title">${esc(g.title)}</p>
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
        .map(
          (g, i) => `
      <li role="presentation">
        <button type="button" class="rail${i === 0 ? ' is-active' : ''}" role="tab" aria-selected="${i === 0}" data-goto="${i}" style="${themeVars(g)}" data-sfx>
          <span class="rail__thumb">${g.shots[0] ? shotImg(ctx, g.shots[0], { cls: 'rail__img', style: `object-position:${g.cardFocus}` }) : ''}</span>
          <span class="rail__meta">
            <span class="rail__no">${pad2(i + 1)}</span>
            <span class="rail__title">${esc(g.title)}</span>
            <span class="rail__genre">${esc(g.genre)}</span>
          </span>
          <span class="rail__bar" aria-hidden="true"><i></i></span>
        </button>
      </li>`,
        )
        .join('')}
    </ol>
  </section>`;
}

function tickerHtml(): string {
  const unit = [
    ['MUSIC', '自社製'],
    ['STORY', '自社製'],
    ['SYSTEM', '自社製'],
    ['LOVE', '自社製'],
  ]
    .map(([en, ja]) => `<span><b>${en}</b>${ja}</span><i>✦</i>`)
    .join('');
  return `<div class="ticker" aria-hidden="true"><div class="ticker__track">${unit.repeat(4)}</div></div>`;
}

function madeHtml(): string {
  const pillars = [
    {
      en: 'MUSIC',
      ja: '音楽',
      body: 'BGMも、効果音も、ぜんぶ自分たちで鳴らしています。音楽の会社がつくるゲームは、耳から楽しい。',
      svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 6h14v4H16v14a5 5 0 1 1-4-4.9z" fill="currentColor"/></svg>',
    },
    {
      en: 'STORY',
      ja: '物語',
      body: '引っ越す村長も、灯を探す旅人も、ギルドの受付のリナも。物語はぜんぶ、ここで生まれました。キャラクターは全員、うちの子です。',
      svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 6h10a4 4 0 0 1 2 .6A4 4 0 0 1 18 6h10v20H18a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z" fill="currentColor"/></svg>',
    },
    {
      en: 'SYSTEM',
      ja: 'システム',
      body: 'ゲームの仕組みも、このストアも、自分たちで組み上げました。遊び心の置き場所まで、ぜんぶ設計しています。',
      svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M14 3h4l.7 3.4 2.6 1.1 2.9-1.9 2.8 2.8-1.9 2.9 1.1 2.6L29 14v4l-3.4.7-1.1 2.6 1.9 2.9-2.8 2.8-2.9-1.9-2.6 1.1L18 29h-4l-.7-3.4-2.6-1.1-2.9 1.9-2.8-2.8 1.9-2.9-1.1-2.6L3 18v-4l3.4-.7 1.1-2.6-1.9-2.9 2.8-2.8 2.9 1.9 2.6-1.1zM16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fill="currentColor"/></svg>',
    },
  ];
  const stats = [
    { v: '100', u: '%', l: '自社製率' },
    { v: String(games.length), u: 'TITLES', l: '配信作品数' },
    { v: '0', u: '円', l: '全作品 基本プレイ料金', prefix: '¥' },
    { v: '∞', u: '', l: '作品への愛' },
  ];
  return `
  <section class="made" data-made>
    <div class="container">
      <p class="eyebrow" data-reveal><span>04</span><span>MADE IN MUSIC JAPAN</span></p>
      <h2 class="made__title" data-reveal>
        <span class="made__line">音楽も、物語も、</span>
        <span class="made__line">システムも。</span>
        <span class="made__line made__line--big">ぜんぶ<em>自社製</em>。</span>
      </h2>
      <p class="made__lead" data-reveal>だから、ほかのどこにも売っていない。<br />Music Japanが本気でつくって、本気で好きなゲームだけを並べています。</p>
      <ul class="made__pillars">
        ${pillars
          .map(
            (p, i) => `
        <li class="pillar" data-reveal style="--d:${i}">
          <span class="pillar__icon">${p.svg}</span>
          <p class="pillar__en">${p.en}</p>
          <h3 class="pillar__ja">${p.ja}<span>──── 自社製</span></h3>
          <p class="pillar__body">${p.body}</p>
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
    <div class="store-intro">
      <h1 class="store-intro__title"><span class="store-intro__name">MJ STORE</span><span class="store-intro__tag">音楽も、物語も、システムも。ぜんぶ自社製のゲームストア</span></h1>
      <p class="store-intro__meta"><b>${games.length}</b> TITLES<i aria-hidden="true">／</i>全作品 基本プレイ無料<i aria-hidden="true">／</i>ブラウザですぐ遊べる</p>
    </div>
    ${featureHtml(ctx)}
    ${tickerHtml()}

    <section class="shelf container">
      <header class="sec-head" data-reveal>
        <p class="eyebrow"><span>01</span><span>ALL TITLES</span></p>
        <h2 class="sec-title">ぜんぶ、ここにある。</h2>
        <a class="link-more" href="${href(ctx, 'games/')}" data-sfx><span>作品一覧へ</span>${icon.arrow}</a>
      </header>
      <ul class="shelf__grid">
        ${games.map((g, i) => gameCard(ctx, g, i)).join('')}
      </ul>
    </section>

    <section class="updates container">
      <div class="updates__col">
        <header class="sec-head sec-head--small" data-reveal>
          <p class="eyebrow"><span>02</span><span>NEWS</span></p>
          <h2 class="sec-title">お知らせ</h2>
        </header>
        ${newsList(ctx, allNews(games, site.news), 6)}
      </div>
      <div class="updates__col">
        <header class="sec-head sec-head--small" data-reveal>
          <p class="eyebrow"><span>03</span><span>PATCH NOTES</span></p>
          <h2 class="sec-title">バージョン履歴</h2>
        </header>
        ${patchList(ctx, games)}
        <p class="updates__note" data-reveal>各作品の履歴は、それぞれのストアページにすべて載っています。</p>
      </div>
    </section>

    ${madeHtml()}

    <section class="top-faq container" aria-labelledby="top-faq-title">
      <header class="sec-head" data-reveal>
        <p class="eyebrow"><span>05</span><span>FAQ</span></p>
        <h2 class="sec-title" id="top-faq-title">よくある質問</h2>
      </header>
      ${faqHtml([...site.faq])}
    </section>

    <div class="container">${requestBand(ctx)}</div>
  </main>`;
}
