import { cardArt, games } from '../data/games';
import { site } from '../data/site';
import { BOT_IDS, botHtml, brandDefs, logoHtml, musicJapanLogo, type BotId } from './brand';
import { abs, esc, gameHref, href, icon, ph, shotImg, type RenderCtx } from './util';

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Zen+Kaku+Gothic+New:wght@400;500;700;900',
    'family=Unbounded:wght@400;600;800',
    'family=JetBrains+Mono:wght@400;600',
    'family=DotGothic16',
    'family=Shippori+Mincho+B1:wght@700;800',
    'family=Cinzel:wght@600;700',
    'family=Silkscreen:wght@400;700',
  ].join('&') +
  '&display=swap';

export interface PageMeta {
  title: string;
  description: string;
  /** ルートからのパス。'/' や '/games/the-world/' */
  path: string;
  themeColor: string;
  ogType?: 'website' | 'article';
  /** OGP 画像（public からのパス） */
  image: string;
  imageAlt: string;
  /** ページ固有の構造化データ。共通の Organization / WebSite は自動で足す */
  jsonLd?: Record<string, unknown>[];
  /** 最初に見える画像（LCP）の先読み */
  preloadImage?: string;
  noindex?: boolean;
}

/** すべてのページに入れる、組織とサイトの構造化データ */
export function baseGraph(ctx: RenderCtx): Record<string, unknown>[] {
  return [
    {
      '@type': 'Organization',
      '@id': `${ctx.siteUrl}/#organization`,
      name: site.operator.name,
      alternateName: site.operator.nameEn,
      url: site.operator.url,
      logo: abs(ctx, 'favicon.svg'),
      sameAs: site.operator.sameAs,
      address: {
        '@type': 'PostalAddress',
        addressLocality: site.operator.address.locality,
        addressRegion: site.operator.address.region,
        addressCountry: site.operator.address.country,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${ctx.siteUrl}/#website`,
      name: site.name,
      alternateName: site.nameJa,
      description: site.description,
      url: `${ctx.siteUrl}/`,
      inLanguage: 'ja',
      publisher: { '@id': `${ctx.siteUrl}/#organization` },
    },
  ];
}

export function headHtml(ctx: RenderCtx, m: PageMeta): string {
  const url = abs(ctx, m.path);
  const image = abs(ctx, m.image);
  const graph = { '@context': 'https://schema.org', '@graph': [...baseGraph(ctx), ...(m.jsonLd ?? [])] };
  return `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style" href="${FONT_HREF}" />
    <link rel="stylesheet" href="${FONT_HREF}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="${FONT_HREF}" /></noscript>
    ${m.preloadImage ? `<link rel="preload" as="image" href="${href(ctx, m.preloadImage)}" fetchpriority="high" />` : ''}
    <title>${esc(m.title)}</title>
    <meta name="description" content="${esc(m.description)}" />
    <meta name="robots" content="${m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />
    <link rel="canonical" href="${url}" />
    <meta name="author" content="${esc(site.operator.name)}" />
    <meta name="theme-color" content="${m.themeColor}" />
    <meta name="application-name" content="${site.name}" />
    <meta property="og:type" content="${m.ogType ?? 'website'}" />
    <meta property="og:site_name" content="${site.name}" />
    <meta property="og:locale" content="${site.locale}" />
    <meta property="og:title" content="${esc(m.title)}" />
    <meta property="og:description" content="${esc(m.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(m.imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(m.title)}" />
    <meta name="twitter:description" content="${esc(m.description)}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="alternate" type="text/plain" href="${href(ctx, 'llms.txt')}" title="LLM向けのサイト概要" />
    <link rel="sitemap" type="application/xml" href="${href(ctx, 'sitemap.xml')}" />
    <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`.trim();
}

export type NavKey = 'store' | 'library' | 'news' | 'request' | null;

/** メニューのちびロボのひとこと（開くたびに2〜3体が出る） */
const MENU_BOT_NOTE: Record<BotId, string> = {
  tune: 'どこ行く？',
  spin: 'ねむ…どれでも…',
  pod: '…音はオンで',
  reel: '更新はNEWSに',
  mic: 'ご要望もどうぞ！',
};

export function headerHtml(ctx: RenderCtx, active: NavKey): string {
  const link = (key: Exclude<NavKey, null>, path: string, ja: string, en: string) =>
    `<a href="${href(ctx, path)}" class="nav-link${active === key ? ' is-active' : ''}"${
      active === key ? ' aria-current="page"' : ''
    } data-sfx><span class="nav-link__en">${en}</span><span class="nav-link__ja">${ja}</span></a>`;
  const cmd = (key: Exclude<NavKey, null>, path: string, ja: string, en: string) =>
    `<a class="cmd__item${active === key ? ' is-current' : ''}" href="${href(ctx, path)}"${
      active === key ? ' aria-current="page"' : ''
    } data-sfx><span class="cmd__cursor" aria-hidden="true"></span><span class="cmd__ja">${ja}</span><span class="cmd__en">${en}</span></a>`;

  return `
  ${brandDefs()}
  <a class="skip" href="#main">本文へ移動</a>
  <header class="chrome" data-chrome>
    <div class="chrome__inner">
      ${logoHtml(ctx, { attrs: 'data-sfx' })}
      <nav class="chrome__nav" aria-label="メインメニュー">
        ${link('store', '', 'ストア', 'STORE')}
        ${link('library', 'games/', '作品一覧', 'LIBRARY')}
        ${link('news', 'news/', 'お知らせ', 'NEWS')}
        ${link('request', 'request/', 'ご要望', 'REQUEST')}
      </nav>
      <div class="chrome__tools">
        <button type="button" class="tool tool--trophy" data-ach-toggle aria-expanded="false" aria-controls="ach-panel" aria-label="実績を見る">
          ${icon.trophy}<span class="tool__count" data-ach-count>0/0</span>
        </button>
        <button type="button" class="tool tool--sound is-on" data-sound-toggle aria-pressed="true" aria-label="サウンドをオフにする">
          <span class="tool__off">${icon.soundOff}</span><span class="tool__on">${icon.soundOn}</span>
        </button>
        <button type="button" class="tool tool--menu" data-menu-toggle aria-expanded="false" aria-controls="menu-sheet" aria-label="メニューを開く">
          <span class="burger" aria-hidden="true"><i></i><i></i></span>
        </button>
      </div>
    </div>
  </header>
  <div class="ach-panel" id="ach-panel" role="dialog" aria-label="実績" hidden data-ach-panel></div>
  <div class="menu-sheet" id="menu-sheet" hidden data-menu-sheet role="dialog" aria-label="メニュー">
    <div class="menu-sheet__inner">
      <p class="menu-sheet__head" aria-hidden="true"><span class="menu-sheet__pause"><i></i><i></i>PAUSE</span><span>MJ STORE</span></p>
      <nav class="cmd" aria-label="メニュー">
        ${cmd('store', '', 'ストア', 'STORE')}
        ${cmd('library', 'games/', '作品一覧', 'LIBRARY')}
        ${cmd('news', 'news/', 'お知らせ・更新', 'NEWS')}
        ${cmd('request', 'request/', 'ご要望・バグ報告', 'REQUEST')}
      </nav>
      <p class="menu-sheet__label">GAMES</p>
      <ul class="menu-games">
        ${games
          .map(
            (g) => `
        <li><a href="${gameHref(ctx, g)}" style="--g-accent:${g.theme.accent}" data-sfx>
          <span class="menu-games__art">${cardArt(g) ? shotImg(ctx, cardArt(g)!, { cls: 'menu-games__img', style: `object-position:${g.cardFocus}` }) : ''}</span>
          <span class="menu-games__title" style="font-family:${esc(g.theme.font)}">${ph(g.title)}</span>
        </a></li>`,
          )
          .join('')}
      </ul>
      <div class="menu-sheet__foot">
        <div class="menu-bots" data-bot-menu>${BOT_IDS.map((id) => botHtml(id, { note: MENU_BOT_NOTE[id] })).join('')}</div>
        <p class="menu-sheet__hint" aria-hidden="true">↑↑↓↓←→←→BA</p>
      </div>
    </div>
  </div>
  <div class="toasts" aria-live="polite" data-toasts></div>`;
}

export function footerHtml(ctx: RenderCtx): string {
  return `
  <footer class="foot" data-foot>
    <div class="foot__stage">
      <div class="container foot__stage-inner">
        <p class="foot__staff">${ph('またのご来店を、お待ちしています。')}</p>
        <div class="foot__crew">${BOT_IDS.map((id) => botHtml(id)).join('')}</div>
      </div>
    </div>
    <div class="foot__grid container">
      <div class="foot__brand">
        ${logoHtml(ctx, { as: 'button', cls: 'logo--lg', attrs: 'data-town-tap' })}
        <p>${ph('音楽も、物語も、システムも。')}<br />${ph('Music Japanがつくったゲームが、ぜんぶここに。')}</p>
      </div>
      <nav class="foot__col" aria-label="フッターメニュー">
        <p class="foot__label">MENU</p>
        <a href="${href(ctx, '')}">ストア</a>
        <a href="${href(ctx, 'games/')}">作品一覧</a>
        <a href="${href(ctx, 'news/')}">お知らせ・更新</a>
        <a href="${href(ctx, 'request/')}">ご要望・バグ報告</a>
        <a class="foot__corp" href="${esc(site.operator.url)}" target="_blank" rel="noopener">
          ${musicJapanLogo(ctx, 'foot__corp-logo')}
          <span class="foot__corp-name">${esc(site.operator.name)}<span class="foot__corp-go" aria-hidden="true">↗</span></span>
        </a>
      </nav>
      <nav class="foot__col" aria-label="作品">
        <p class="foot__label">GAMES</p>
        ${games.map((g) => `<a href="${gameHref(ctx, g)}">${ph(g.title)}</a>`).join('')}
      </nav>
    </div>
    <div class="foot__bottom container">
      <small class="foot__copy">© ${site.year} ${esc(site.operator.name)}</small>
      <span class="foot__cmd" aria-hidden="true">↑ ↑ ↓ ↓ ← → ← → B A</span>
    </div>
  </footer>`;
}
