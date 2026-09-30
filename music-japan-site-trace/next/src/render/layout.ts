import type { Locale } from '../content/releases';
import { copy, EMAIL, LAST_MODIFIED, nav, path, SITE_URL, SOCIAL_IMAGE, socials, type PageKey } from '../content/site';
import { arrow, esc, prose } from './html';
import { mark } from './mark';

export type PageMeta = {
  locale: Locale;
  page: PageKey;
  title: string;
  description: string;
  body: string;
  /** Extra JSON-LD nodes for this page */
  graph?: object[];
  bodyClass?: string;
  /** world preset for the fixed WebGL layer */
  world?: 'home' | 'inner';
  /** Full-screen layer rendered outside <main> so it can sit above the header */
  overlay?: string;
};

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=JetBrains+Mono:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap';
const ICON_VERSION = '20261001';

const socialIcon: Record<string, string> = {
  LinkedIn: '<path d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2ZM8 19H5V9.5h3V19ZM6.5 8.2a1.8 1.8 0 1 1 0-3.5 1.8 1.8 0 0 1 0 3.5ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.8 13 12.8 14.3V19h-3V9.5h2.9v1.3a3.2 3.2 0 0 1 2.9-1.6c3.1 0 3.6 2 3.6 4.7V19Z"/>',
  Instagram: '<path d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3Zm0 7.8a3.1 3.1 0 1 1 3.1-3.1 3.1 3.1 0 0 1-3.1 3.1Zm6-8a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 18 7.1ZM21.9 8.2a5.5 5.5 0 0 0-1.5-3.9 5.5 5.5 0 0 0-3.9-1.5C15 2.7 9 2.7 7.5 2.8a5.5 5.5 0 0 0-3.9 1.5A5.5 5.5 0 0 0 2.1 8.2C2 9.7 2 14.3 2.1 15.8a5.5 5.5 0 0 0 1.5 3.9 5.5 5.5 0 0 0 3.9 1.5c1.5.1 7.5.1 9 0a5.5 5.5 0 0 0 3.9-1.5 5.5 5.5 0 0 0 1.5-3.9c.1-1.5.1-6.1 0-7.6Zm-2 9.9a3.2 3.2 0 0 1-1.8 1.8c-1.3.5-4.3.4-6.1.4s-4.8.1-6.1-.4a3.2 3.2 0 0 1-1.8-1.8C3.6 16.8 3.7 13.8 3.7 12s-.1-4.8.4-6.1a3.2 3.2 0 0 1 1.8-1.8C7.2 3.6 10.2 3.7 12 3.7s4.8-.1 6.1.4a3.2 3.2 0 0 1 1.8 1.8c.5 1.3.4 4.3.4 6.1s.1 4.8-.4 6.1Z"/>',
  X: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/>',
};

function header(locale: Locale, page: PageKey): string {
  const c = copy[locale];
  const other: Locale = locale === 'ja' ? 'en' : 'ja';
  const links = nav
    .map((k, i) => `<a href="${path(locale, k)}"${k === page ? ' aria-current="page"' : ''}><i>0${i + 1}</i><span>${c.navLabels[k]}</span></a>`)
    .join('');
  return `<header class="hd" data-hd>
  <a class="hd-brand" href="${path(locale, 'home')}" aria-label="${esc(c.brand)} — ${c.navLabels.home}">${mark({ id: 'hd' })}<span class="hd-name">${locale === 'ja' ? '合同会社<b>Music Japan</b>' : '<b>Music Japan</b> LLC'}</span></a>
  <nav class="hd-nav" id="nav" aria-label="${locale === 'ja' ? '主要ナビゲーション' : 'Primary navigation'}">${links}</nav>
  <div class="hd-tools">
    <span class="hd-eq" data-eq aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <a class="hd-lang" href="${path(other, page)}" hreflang="${other}" lang="${other}">${other === 'en' ? 'EN' : 'JP'}</a>
    <button class="hd-menu" type="button" aria-controls="nav" aria-expanded="false" data-menu data-open="${c.menu[0]}" data-close="${c.menu[1]}" aria-label="${c.menu[0]}"><span></span><span></span></button>
  </div>
</header>`;
}

function footer(locale: Locale): string {
  const c = copy[locale];
  const line = `<span>${esc(c.footer.line)}</span>${mark({ id: 'fmq' })}`;
  return `<footer class="ft">
  <div class="ft-marquee" aria-hidden="true" data-velocity-marquee><div class="ft-marquee__track">${line.repeat(4)}</div></div>
  <div class="ft-grid">
    <div class="ft-id">${mark({ id: 'ftm', cls: 'mj-mark ft-mark' })}<p class="ft-name">${locale === 'ja' ? '合同会社Music Japan' : 'Music Japan LLC'}</p><p class="ft-addr">${locale === 'ja' ? '大阪府大阪市北区梅田1丁目2番2号<br>大阪駅前第2ビル12-12' : 'Osaka Ekimae No. 2 Building 12-12<br>1-2-2 Umeda, Kita-ku, Osaka, Japan'}</p><a class="ft-mail" href="mailto:${EMAIL}">${EMAIL}</a></div>
    <nav class="ft-nav" aria-label="${locale === 'ja' ? 'フッター' : 'Footer'}">${(['home', ...nav, 'privacy'] as PageKey[]).map((k) => `<a href="${path(locale, k)}">${c.navLabels[k]}</a>`).join('')}</nav>
    <div class="ft-social"><p>${c.footer.follow}</p><div>${socials.map((s) => `<a href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.name}${c.newTab}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcon[s.name]}</svg></a>`).join('')}</div></div>
  </div>
  <div class="ft-bottom"><span>${c.footer.rights}</span><span>MUSIC &amp; MEDIA — OSAKA / JAPAN</span><a href="#top" data-top>${c.footer.top} ↑</a></div>
</footer>`;
}

export function organization(locale: Locale) {
  return {
    '@type': 'Corporation',
    '@id': `${SITE_URL}/#organization`,
    name: '合同会社Music Japan',
    alternateName: 'Music Japan LLC',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/music-japan-logo.png`,
    email: EMAIL,
    telephone: '+81-70-3175-7567',
    address: {
      '@type': 'PostalAddress',
      postalCode: '530-0001',
      addressRegion: '大阪府',
      addressLocality: '大阪市北区',
      streetAddress: '梅田1丁目2番2号 大阪駅前第2ビル12-12',
      addressCountry: 'JP',
    },
    founder: { '@id': `${SITE_URL}/#founder` },
    knowsAbout: ['音楽制作', '楽曲配信', 'BGM制作', 'Podcast制作', '経営者インタビュー', 'メディア企画'],
    sameAs: socials.map((s) => s.href),
    identifier: { '@type': 'PropertyValue', propertyID: '法人番号', value: '8120003031493' },
    description: copy[locale].home.description,
  };
}

export function page(m: PageMeta): string {
  const { locale, page: key } = m;
  const c = copy[locale];
  const url = `${SITE_URL}${path(locale, key)}`;
  const ja = `${SITE_URL}${path('ja', key)}`;
  const en = `${SITE_URL}${path('en', key)}`;
  const graph = [
    organization(locale),
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: '合同会社Music Japan', alternateName: 'Music Japan LLC', inLanguage: ['ja', 'en'], publisher: { '@id': `${SITE_URL}/#organization` } },
    { '@type': key === 'contact' ? 'ContactPage' : key === 'profile' ? 'ProfilePage' : key === 'company' ? 'AboutPage' : 'WebPage', '@id': `${url}#webpage`, url, name: m.title, description: m.description, inLanguage: locale, dateModified: LAST_MODIFIED, isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#organization` } },
    ...(key === 'home'
      ? []
      : [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [{ '@type': 'ListItem', position: 1, name: c.navLabels.home, item: `${SITE_URL}${path(locale, 'home')}` }, { '@type': 'ListItem', position: 2, name: c.navLabels[key], item: url }] }]),
    ...(m.graph ?? []),
  ];
  const ogImage = `${SITE_URL}${SOCIAL_IMAGE}`;
  return `<!doctype html>
<html lang="${locale}" data-world="${m.world ?? 'inner'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="theme-color" content="#060607">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja-JP" href="${ja}">
<link rel="alternate" hreflang="en" href="${en}">
<link rel="alternate" hreflang="x-default" href="${ja}">
<meta property="og:type" content="${key === 'profile' ? 'profile' : 'website'}">
<meta property="og:site_name" content="Music Japan LLC">
<meta property="og:locale" content="${locale === 'ja' ? 'ja_JP' : 'en_US'}">
<meta property="og:locale:alternate" content="${locale === 'ja' ? 'en_US' : 'ja_JP'}">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1500">
<meta property="og:image:height" content="500">
<meta property="og:image:alt" content="Music Japan LLC corporate logo">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(m.title)}">
<meta name="twitter:description" content="${esc(m.description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" type="image/svg+xml" href="/favicon-music-japan.svg?v=${ICON_VERSION}">
<link rel="apple-touch-icon" href="/music-japan-symbol.png?v=${ICON_VERSION}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<script>document.documentElement.classList.add('js');try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.world==='home'){document.documentElement.dataset.intro=sessionStorage.getItem('mj-intro')?'short':'full'}}catch(e){}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>
<script type="module" src="/src/client/main.ts"></script>
</head>
<body class="${m.bodyClass ?? ''}" data-page="${key}" data-locale="${locale}" id="top">
<a class="skip" href="#main">${c.skip}</a>
${m.overlay ?? ''}
<canvas class="world" data-world-canvas aria-hidden="true"></canvas>
<div class="world-veil" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
${header(locale, key)}
<main id="main" tabindex="-1">
${m.body}
</main>
${footer(locale)}
<div class="cursor" data-cursor aria-hidden="true"><i></i><b></b></div>
<div class="wipe" data-wipe aria-hidden="true">${mark({ id: 'wp', cls: 'mj-mark wipe-mark' })}</div>
</body>
</html>
`;
}

export function innerHero(locale: Locale, key: Exclude<PageKey, 'home'>, extra = ''): string {
  const p = copy[locale].pages[key];
  return `<section class="ih" data-world-zone="inner-hero">
  <p class="ih-display" aria-hidden="true" data-split-display>${esc(p.display)}</p>
  <div class="ih-copy">
    <p class="kicker">${esc(p.kicker)}</p>
    <h1 class="ih-title" data-split>${esc(p.title)}</h1>
    ${p.lead ? `<p class="ih-lead">${prose(p.lead)}</p>` : ''}
    ${extra}
  </div>
</section>`;
}

export { arrow };
