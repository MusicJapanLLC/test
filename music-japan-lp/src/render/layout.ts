import * as C from '../content/copy';
import { sortedActivity } from '../content/activity';
import { faqGeneral, faqPartners, type QA } from '../content/faq';
import { PAGES, page, type PageKey, type PageMeta } from '../content/pages';
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
import fonts from './fonts.json';
import { footer, header } from './parts';
import { notFound, PAGE_BODY } from './pages';
import { escRaw as esc, plain } from './text';

export type BuildEnv = { noindex: boolean };

const OG_V = '20261002b';
export const ogImage = (key: PageKey | '404') => `${LP_URL}/og/${key === '404' ? 'top' : key}.png?v=${OG_V}`;
const url = (p: PageMeta) => `${LP_URL}${p.path}`;

const faqNodes = (items: QA[]) => items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));

const organization = {
  '@type': 'Corporation',
  '@id': ORG_ID,
  name: company.name,
  alternateName: company.nameEn,
  url: `${OFFICIAL_URL}/`,
  logo: { '@type': 'ImageObject', url: `${OFFICIAL_URL}/music-japan-logo.png`, width: 1500, height: 500 },
  email: EMAIL,
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
  knowsAbout: ['会社の専用ページ制作', 'Webサイト制作', '検索対策', '経営者インタビュー', 'Podcast', '経営者の紹介', '音楽制作', '音楽配信'],
  sameAs: socials.filter((s) => s.owner === 'Music Japan').map((s) => s.href),
};

const person = {
  '@type': 'Person',
  '@id': FOUNDER_ID,
  name: company.representative,
  alternateName: [company.representativeEn, company.representativeKana],
  jobTitle: company.role,
  worksFor: { '@id': ORG_ID },
  image: `${LP_URL}/people/kabeya-800.webp`,
  url: `${OFFICIAL_URL}/profile/`,
  sameAs: [socials[0].href, BATON_KABEYA_URL],
};

const services = {
  partners: {
    '@type': 'Service',
    '@id': `${PARTNERS_URL}#service`,
    name: 'Baton Partners',
    url: PARTNERS_URL,
    serviceType: '会社ごとの専用ページの制作と、Music Japanを通した紹介',
    description: plain(C.partners.lead),
    provider: { '@id': ORG_ID },
    areaServed: { '@type': 'Country', name: 'Japan' },
  },
  baton: {
    '@type': 'Service',
    '@id': BATON_SERVICE_ID,
    name: 'Baton',
    alternateName: 'Baton -バトン-',
    url: BATON_URL,
    serviceType: '経営者の招待制プロフィールと紹介',
    description: plain(C.baton.lead),
    provider: { '@id': ORG_ID },
  },
  secondtake: {
    '@type': 'PodcastSeries',
    '@id': SECOND_TAKE_ID,
    name: 'SECOND TAKE',
    url: SECOND_TAKE_URL,
    inLanguage: 'ja',
    description: plain(C.secondTake.lead),
    publisher: { '@id': ORG_ID },
  },
};

/** ページごとの構造化データ。会社・代表は公式サイトと同じ @id で結ぶ */
function graph(p: PageMeta) {
  const pageUrl = url(p);
  const webpage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: p.title,
    description: p.description,
    inLanguage: 'ja',
    dateModified: UPDATED,
    isPartOf: { '@id': `${LP_URL}/#website` },
    about: { '@id': ORG_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: ogImage(p.key), width: 1200, height: 630 },
  };
  const nodes: Record<string, unknown>[] = [
    { '@type': 'WebSite', '@id': `${LP_URL}/#website`, url: `${LP_URL}/`, name: 'Music Japan', inLanguage: 'ja', publisher: { '@id': ORG_ID } },
    webpage,
  ];
  if (p.key !== 'top') {
    webpage.breadcrumb = { '@id': `${pageUrl}#breadcrumb` };
    nodes.push({
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'トップ', item: `${LP_URL}/` },
        { '@type': 'ListItem', position: 2, name: p.crumb, item: pageUrl },
      ],
    });
  }
  switch (p.key) {
    case 'top':
      webpage['@type'] = ['WebPage', 'AboutPage'];
      webpage.mentions = [{ '@id': services.partners['@id'] }, { '@id': BATON_SERVICE_ID }, { '@id': SECOND_TAKE_ID }];
      webpage.significantLink = PAGES.filter((x) => x.key !== 'top').map(url);
      nodes.push(organization, services.partners, services.baton, services.secondtake);
      break;
    case 'partners':
      webpage['@type'] = ['WebPage', 'FAQPage'];
      webpage.mainEntity = faqNodes(faqPartners);
      webpage.mentions = projects.map((x) => ({ '@type': 'WebSite', name: `${x.name}｜Baton Partners`, url: x.href }));
      nodes.push(services.partners);
      break;
    case 'baton':
      nodes.push(services.baton);
      break;
    case 'secondtake':
      nodes.push(services.secondtake);
      break;
    case 'works':
      webpage['@type'] = ['WebPage', 'CollectionPage'];
      nodes.push({
        '@type': 'ItemList',
        '@id': `${pageUrl}#list`,
        name: 'Baton Partnersで公開しているページ',
        itemListElement: projects.map((x, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'WebSite', name: `${x.name}｜Baton Partners`, url: x.href, creator: { '@id': ORG_ID } },
        })),
      });
      break;
    case 'news':
      webpage['@type'] = ['WebPage', 'CollectionPage'];
      nodes.push({
        '@type': 'ItemList',
        '@id': `${pageUrl}#list`,
        name: 'お知らせ',
        itemListElement: sortedActivity().map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.title, ...(a.href ? { url: a.href } : {}) })),
      });
      break;
    case 'about':
      webpage['@type'] = ['WebPage', 'AboutPage', 'FAQPage'];
      webpage.mainEntity = faqNodes(faqGeneral);
      nodes.push(organization, person);
      break;
    case 'talk':
      webpage['@type'] = ['WebPage', 'ContactPage'];
      webpage.potentialAction = { '@type': 'ScheduleAction', name: '相談の日程を選ぶ', target: TIMEREX_URL };
      nodes.push(person);
      break;
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}

function head(p: PageMeta | null, env: BuildEnv): string {
  const title = p ? p.title : `${C.notFound.title}｜Music Japan`;
  const desc = p ? p.description : C.notFound.body;
  const canonical = p ? url(p) : `${LP_URL}/`;
  const og = ogImage(p ? p.key : '404');
  const robots = env.noindex || !p ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  // 同じサイトのリンクは、指を乗せたら先に読み込んでおく（ページの切り替えを速く）
  const speculation = { prerender: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/*.xml' } }, { not: { href_matches: '/*.json' } }] }, eagerness: 'moderate' }] };
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
${p ? `<link rel="canonical" href="${canonical}">\n<link rel="alternate" hreflang="ja" href="${canonical}">\n<link rel="alternate" hreflang="x-default" href="${canonical}">` : ''}
<meta name="author" content="${esc(company.name)}">
<meta name="theme-color" content="#f6f4ef">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="${p?.key === 'top' ? 'website' : 'article'}">
<meta property="og:site_name" content="Music Japan">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@Music_Japan_LLC">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/atom+xml" title="Music Japan お知らせ" href="/feed.xml">
<link rel="alternate" type="application/feed+json" title="Music Japan お知らせ" href="/activity.json">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preload" href="${p?.key === 'top' ? fonts.top : fonts.page}" as="font" type="font/woff2" crossorigin>
<script>
  document.documentElement.classList.add('js');
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('rm'); } catch (e) {}
</script>
<script type="speculationrules">${JSON.stringify(speculation)}</script>
${p ? `<script type="application/ld+json">${JSON.stringify(graph(p)).replaceAll('<', '\\u003c')}</script>` : ''}
<script type="module" src="/src/client/main.ts"></script>`;
}

/** 1ページ分のHTML。Vite がこれを入口にしてJS・CSSを差し込む */
export function document(key: PageKey | '404', env: BuildEnv): string {
  const p = key === '404' ? null : page(key);
  const main = key === '404' ? notFound() : PAGE_BODY[key]();
  return `<!doctype html>
<html lang="ja" data-page="${key}">
<head>
${head(p, env)}
</head>
<body id="top">
<a class="skip" href="#main">${esc(C.common.skip)}</a>
${header(key === '404' ? 'top' : key)}
<main id="main">
${main}
</main>
${footer()}
</body>
</html>
`;
}
