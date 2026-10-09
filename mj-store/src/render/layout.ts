import { games } from '../data/games';
import { site } from '../data/site';
import { abs, esc, gameHref, href, icon, type RenderCtx } from './util';

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Zen+Kaku+Gothic+New:wght@400;500;700;900',
    'family=Unbounded:wght@400;600;800',
    'family=JetBrains+Mono:wght@400;600',
    'family=DotGothic16',
    'family=Shippori+Mincho+B1:wght@700;800',
    'family=Cinzel:wght@600;700',
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

export type NavKey = 'store' | 'library' | 'request' | null;

export function headerHtml(ctx: RenderCtx, active: NavKey): string {
  const link = (key: Exclude<NavKey, null>, path: string, ja: string, en: string) =>
    `<a href="${href(ctx, path)}" class="nav-link${active === key ? ' is-active' : ''}"${
      active === key ? ' aria-current="page"' : ''
    }><span class="nav-link__en">${en}</span><span class="nav-link__ja">${ja}</span></a>`;

  return `
  <a class="skip" href="#main">本文へ移動</a>
  <header class="chrome" data-chrome>
    <div class="chrome__inner">
      <a class="logo" href="${href(ctx, '')}" aria-label="MJ STORE トップへ" data-sfx>
        <span class="logo__mark" aria-hidden="true">MJ</span>
        <span class="logo__word">STORE</span>
      </a>
      <nav class="chrome__nav" aria-label="メインメニュー">
        ${link('store', '', 'ストア', 'STORE')}
        ${link('library', 'games/', '作品一覧', 'LIBRARY')}
        ${link('request', 'request/', 'ご要望', 'REQUEST')}
      </nav>
      <div class="chrome__tools">
        <button type="button" class="tool tool--trophy" data-ach-toggle aria-expanded="false" aria-controls="ach-panel" aria-label="実績を見る">
          ${icon.trophy}<span class="tool__count" data-ach-count>0/0</span>
        </button>
        <button type="button" class="tool tool--sound" data-sound-toggle aria-pressed="false" aria-label="サウンドをオンにする">
          <span class="tool__off">${icon.soundOff}</span><span class="tool__on">${icon.soundOn}</span>
        </button>
        <button type="button" class="tool tool--menu" data-menu-toggle aria-expanded="false" aria-controls="menu-sheet" aria-label="メニューを開く">
          <span class="burger" aria-hidden="true"><i></i><i></i></span>
        </button>
      </div>
    </div>
  </header>
  <div class="ach-panel" id="ach-panel" role="dialog" aria-label="実績" hidden data-ach-panel></div>
  <div class="menu-sheet" id="menu-sheet" hidden data-menu-sheet>
    <nav class="menu-sheet__nav" aria-label="メニュー">
      <a href="${href(ctx, '')}"><small>01</small>ストア</a>
      <a href="${href(ctx, 'games/')}"><small>02</small>作品一覧</a>
      <a href="${href(ctx, 'request/')}"><small>03</small>ご要望・バグ報告</a>
    </nav>
    <ul class="menu-sheet__games">
      ${games
        .map(
          (g) =>
            `<li><a href="${gameHref(ctx, g)}" style="--g-accent:${g.theme.accent};font-family:${esc(g.theme.font)}">${esc(g.title)}</a></li>`,
        )
        .join('')}
    </ul>
  </div>
  <div class="toasts" aria-live="polite" data-toasts></div>`;
}

export function footerHtml(ctx: RenderCtx): string {
  const word = 'MJ STORE';
  return `
  <footer class="foot" data-foot>
    <div class="foot__giant" aria-hidden="true"><div class="foot__giant-track">${`<span>${word}</span><i>✦</i>`.repeat(6)}</div></div>
    <div class="foot__grid container">
      <div class="foot__brand">
        <button type="button" class="logo logo--lg" data-town-tap aria-label="MJ STORE">
          <span class="logo__mark" aria-hidden="true">MJ</span>
          <span class="logo__word">STORE</span>
        </button>
        <p>音楽も、物語も、システムも。<br />ぜんぶ自社製のゲームストア。</p>
      </div>
      <nav class="foot__col" aria-label="フッターメニュー">
        <p class="foot__label">MENU</p>
        <a href="${href(ctx, '')}">ストア</a>
        <a href="${href(ctx, 'games/')}">作品一覧</a>
        <a href="${href(ctx, 'request/')}">ご要望・バグ報告</a>
      </nav>
      <nav class="foot__col" aria-label="作品">
        <p class="foot__label">GAMES</p>
        ${games.map((g) => `<a href="${gameHref(ctx, g)}">${esc(g.title)}</a>`).join('')}
      </nav>
    </div>
    <div class="foot__bottom container">
      <small class="foot__copy">© ${site.year} ${esc(site.operator.name)}</small>
      <span class="foot__cmd" aria-hidden="true">↑ ↑ ↓ ↓ ← → ← → B A</span>
    </div>
  </footer>`;
}
