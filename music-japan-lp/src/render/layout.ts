import * as C from '../content/copy';
import { faq } from '../content/faq';
import { projects } from '../content/projects';
import {
  BATON_KABEYA_URL,
  BATON_SERVICE_ID,
  BATON_URL,
  company,
  EMAIL,
  FOUNDER_ID,
  LP_URL,
  OFFICIAL_URL,
  ORG_ID,
  PARTNERS_URL,
  SECOND_TAKE_ID,
  SECOND_TAKE_URL,
  socials,
  TIMEREX_URL,
  UPDATED,
} from '../content/site';
import { body, footer, header, overlays } from './page';
import { escRaw as esc, plain } from './text';

export type BuildEnv = { noindex: boolean };

const OG = `${LP_URL}/og/ja-top.png?v=20261002`;

/** 構造化データ。会社・代表は公式サイトと同じ @id で、同じ会社・同じ人物として結ぶ */
function graph() {
  const page = `${LP_URL}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${LP_URL}/#website`,
        url: page,
        name: 'Music Japan — 企業と人を、見つけてもらい、つなぐ',
        inLanguage: 'ja',
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': ['WebPage', 'AboutPage', 'FAQPage'],
        '@id': `${LP_URL}/#webpage`,
        url: page,
        name: C.meta.title,
        description: C.meta.description,
        inLanguage: 'ja',
        datePublished: '2026-10-02',
        dateModified: UPDATED,
        isPartOf: { '@id': `${LP_URL}/#website` },
        about: { '@id': ORG_ID },
        primaryImageOfPage: { '@type': 'ImageObject', url: OG, width: 1200, height: 630 },
        breadcrumb: { '@id': `${LP_URL}/#breadcrumb` },
        mentions: [{ '@id': `${PARTNERS_URL}#service` }, { '@id': BATON_SERVICE_ID }, { '@id': SECOND_TAKE_ID }, ...projects.map((p) => ({ '@id': `${p.href}#org` }))],
        significantLink: [PARTNERS_URL, BATON_URL, SECOND_TAKE_URL, ...projects.map((p) => p.href), TIMEREX_URL],
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        potentialAction: { '@type': 'ScheduleAction', name: '打ち合わせの日時を選ぶ', target: TIMEREX_URL },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${LP_URL}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '合同会社Music Japan', item: `${OFFICIAL_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Music Japanの仕事', item: page },
        ],
      },
      {
        '@type': 'Corporation',
        '@id': ORG_ID,
        name: company.name,
        alternateName: company.nameEn,
        url: `${OFFICIAL_URL}/`,
        logo: { '@type': 'ImageObject', url: `${OFFICIAL_URL}/music-japan-logo.png`, width: 1500, height: 500 },
        email: EMAIL,
        telephone: '+81-70-3175-7567',
        address: {
          '@type': 'PostalAddress',
          postalCode: company.postal,
          addressRegion: '大阪府',
          addressLocality: '大阪市北区',
          streetAddress: '梅田1丁目2番2号 大阪駅前第2ビル12-12',
          addressCountry: 'JP',
        },
        founder: { '@id': FOUNDER_ID },
        identifier: { '@type': 'PropertyValue', propertyID: '法人番号', value: company.corporateNo },
        description: C.about.official,
        knowsAbout: ['企業の専用ページ制作', 'SEO', 'LLMO', 'Webサイト制作', 'LP制作', '経営者インタビュー', 'Podcast', '経営者の紹介', '音楽制作'],
        sameAs: socials.filter((s) => s.owner === 'Music Japan').map((s) => s.href),
        makesOffer: [
          { '@type': 'Offer', itemOffered: { '@id': `${PARTNERS_URL}#service` } },
          { '@type': 'Offer', itemOffered: { '@id': BATON_SERVICE_ID } },
          { '@type': 'Offer', itemOffered: { '@id': `${LP_URL}/#web` } },
          { '@type': 'Offer', itemOffered: { '@id': `${LP_URL}/#introductions` } },
        ],
      },
      {
        '@type': 'Person',
        '@id': FOUNDER_ID,
        name: company.representative,
        alternateName: [company.representativeEn, 'Kabeya Tomoki', company.representativeKana],
        jobTitle: company.role,
        worksFor: { '@id': ORG_ID },
        image: `${LP_URL}/people/kabeya-800.webp`,
        url: `${OFFICIAL_URL}/profile/`,
        sameAs: [socials[0].href, BATON_KABEYA_URL],
        homeLocation: { '@type': 'Place', name: '大阪' },
      },
      {
        '@type': 'Service',
        '@id': `${PARTNERS_URL}#service`,
        name: 'Baton Partners',
        url: PARTNERS_URL,
        serviceType: '企業ごとの専用ページ制作・記事・検索対策と、Music Japanを介した紹介',
        description: plain(C.partners.lead),
        provider: { '@id': ORG_ID },
        areaServed: { '@type': 'Country', name: 'Japan' },
      },
      {
        '@type': 'Service',
        '@id': BATON_SERVICE_ID,
        name: 'Baton',
        alternateName: 'Baton -バトン-',
        url: BATON_URL,
        serviceType: '経営者・事業者の招待制プロフィールと紹介',
        provider: { '@id': ORG_ID },
      },
      {
        '@type': 'PodcastSeries',
        '@id': SECOND_TAKE_ID,
        name: 'SECOND TAKE',
        url: SECOND_TAKE_URL,
        inLanguage: 'ja',
        description: '経営者が一度目につまずいたあと、二度目に何を選んだのかを聞くインタビューメディア。',
        publisher: { '@id': ORG_ID },
      },
      { '@type': 'Service', '@id': `${LP_URL}/#web`, name: 'Webサイト・LPの制作', provider: { '@id': ORG_ID }, serviceType: 'Webサイト制作' },
      { '@type': 'Service', '@id': `${LP_URL}/#introductions`, name: '経営者どうしの紹介', provider: { '@id': ORG_ID }, serviceType: '紹介' },
      {
        '@type': 'ItemList',
        '@id': `${LP_URL}/#live`,
        name: 'Baton Partnersで公開しているページ',
        itemListElement: projects.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'WebSite', name: `${p.name}｜Baton Partners`, url: p.href, creator: { '@id': ORG_ID }, about: { '@id': `${p.href}#org` } },
        })),
      },
    ],
  };
}

/** ページ全体（index.html）。Vite がこのファイルを入口にしてJS・CSSを差し込む */
export function document(env: BuildEnv): string {
  const title = C.meta.title;
  const desc = C.meta.description;
  return `<!doctype html>
<html lang="ja" data-air="ink">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${env.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
<link rel="canonical" href="${LP_URL}/">
<link rel="alternate" hreflang="ja" href="${LP_URL}/">
<link rel="alternate" hreflang="x-default" href="${LP_URL}/">
<meta name="author" content="${company.name}">
<meta name="theme-color" content="#060607">
<meta name="color-scheme" content="dark light">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Music Japan">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(C.meta.ogTitle)}｜Music Japan">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${LP_URL}/">
<meta property="og:image" content="${OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(C.meta.ogTitle)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@Music_Japan_LLC">
<meta name="twitter:title" content="${esc(C.meta.ogTitle)}｜Music Japan">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${OG}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/atom+xml" title="Music Japan — NOW" href="/feed.xml">
<link rel="alternate" type="application/feed+json" title="Music Japan — NOW" href="/activity.json">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://timerex.net">
<link rel="preload" href="/fonts/zkg-900-h.woff2" as="font" type="font/woff2" crossorigin>
<script>
  document.documentElement.classList.add('js');
  try {
    var rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) document.documentElement.classList.add('rm');
    else document.documentElement.dataset.intro = sessionStorage.getItem('mjlp-intro') ? 'short' : 'full';
  } catch (e) {}
</script>
<script type="speculationrules">{"prefetch":[{"urls":${JSON.stringify(projects.map((p) => p.href))},"eagerness":"moderate"}]}</script>
<script type="application/ld+json">${JSON.stringify(graph()).replaceAll('<', '\\u003c')}</script>
<script type="module" src="/src/client/main.ts"></script>
</head>
<body id="body">
<a class="skip" href="#main">本文へ移動</a>
${overlays()}
${header()}
<main id="main">
${body()}
</main>
${footer()}
</body>
</html>
`;
}
