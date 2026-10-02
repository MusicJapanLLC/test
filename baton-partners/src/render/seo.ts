import { routes, site } from '../config/site';
import type { Partner } from '../types';
import type { BuildEnv } from './layout';
import { text } from './text';

/**
 * 構造化データ（JSON-LD）。サイト全体をひとつのグラフとしてつなぐ。
 *
 *   WebSite（Baton Partners） ── publisher ──> 合同会社Music Japan
 *   WebPage（各ページ） ── isPartOf ──> WebSite / about ──> 掲載企業 / breadcrumb ──> BreadcrumbList
 *   掲載企業（Corporation） ── founder / employee ──> 代表者（Person）
 *   サービス（SoftwareApplication / Service） ── provider ──> 掲載企業
 *   記事（Article） ── author ──> Baton Partners 編集部 ── parentOrganization ──> Music Japan
 *
 * どれも「ページに見えている内容」だけを書く（Google の構造化データ ガイドライン）。価格は載せない。
 */

type Ld = Record<string, unknown>;

export const ids = {
  website: (env: BuildEnv) => `${env.siteUrl}/#website`,
  operator: `${site.operator.url}#organization`,
  editorial: (env: BuildEnv) => `${env.siteUrl}${routes.editorial()}#team`,
  org: (env: BuildEnv, p: Partner) => `${env.siteUrl}${routes.top(p.slug)}#org`,
  founder: (env: BuildEnv, p: Partner) => `${env.siteUrl}${routes.about(p.slug)}#leader`,
  service: (env: BuildEnv, p: Partner) => `${env.siteUrl}${routes.service(p.slug)}#service`,
  page: (env: BuildEnv, path: string) => `${env.siteUrl}${path}#webpage`,
  crumb: (env: BuildEnv, path: string) => `${env.siteUrl}${path}#breadcrumb`,
  article: (env: BuildEnv, path: string) => `${env.siteUrl}${path}#article`,
  faq: (env: BuildEnv, path: string) => `${env.siteUrl}${path}#faq`,
};

export const abs = (env: BuildEnv, path: string) => (path.startsWith('http') ? path : `${env.siteUrl}${path}`);

/** 全ページに入れる土台：サイト・運営会社・編集部 */
export function siteLd(env: BuildEnv): Ld[] {
  return [
    {
      '@type': 'WebSite',
      '@id': ids.website(env),
      name: site.name,
      alternateName: 'バトンパートナーズ',
      url: `${env.siteUrl}/`,
      description: site.description,
      inLanguage: 'ja',
      publisher: { '@id': ids.operator },
    },
    {
      '@type': 'Organization',
      '@id': ids.operator,
      name: site.operator.name,
      alternateName: site.operator.nameEn,
      url: site.operator.url,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'JP',
        addressRegion: '大阪府',
        addressLocality: '大阪市北区',
        streetAddress: '梅田1丁目2番2号 大阪駅前第2ビル12-12',
      },
      founder: { '@type': 'Person', name: '壁谷友生', jobTitle: '代表社員' },
    },
    {
      '@type': 'Organization',
      '@id': ids.editorial(env),
      name: 'Baton Partners 編集部',
      url: `${env.siteUrl}${routes.editorial()}`,
      parentOrganization: { '@id': ids.operator },
    },
  ];
}

/** 掲載企業。公式サイトの会社概要と同じ表記にする */
export function orgLd(env: BuildEnv, p: Partner): Ld[] {
  const o = p.seo.org;
  const people: Ld[] = [];
  const org: Ld = {
    '@type': o.type,
    '@id': ids.org(env, p),
    name: p.company.name,
    alternateName: p.company.nameEn,
    url: p.company.url,
    logo: { '@type': 'ImageObject', url: abs(env, p.brand.logo), width: p.brand.logoSize[0], height: p.brand.logoSize[1] },
    sameAs: o.sameAs,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: o.address.region,
      addressLocality: o.address.locality,
      streetAddress: o.address.street,
    },
    description: text(p.seo.about.answer.a),
  };
  if (o.leader) {
    org[o.leader.relation] = { '@id': ids.founder(env, p) };
    people.push({
      '@type': 'Person',
      '@id': ids.founder(env, p),
      name: o.leader.name,
      jobTitle: o.leader.jobTitle,
      worksFor: { '@id': ids.org(env, p) },
      ...(p.leader?.photo ? { image: abs(env, p.leader.photo) } : {}),
    });
  }
  return [org, ...people];
}

/** サービス。ソフトウェアなら SoftwareApplication、それ以外は Service。価格（offers）は載せない */
export function serviceLd(env: BuildEnv, p: Partner): Ld {
  const s = p.service;
  const base = {
    '@id': ids.service(env, p),
    name: text(s.name),
    description: text(s.description),
    url: s.url,
    provider: { '@id': ids.org(env, p) },
    areaServed: p.seo.org.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
  };
  if (p.seo.serviceType === 'SoftwareApplication') {
    return {
      '@type': 'SoftwareApplication',
      ...base,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: text(s.category),
      operatingSystem: 'Web',
      featureList: s.features.map((f) => text(f.title)),
      image: abs(env, s.logo),
    };
  }
  return {
    '@type': 'Service',
    ...base,
    serviceType: s.features.map((f) => text(f.title)),
  };
}

/** 各ページ。type は WebPage / AboutPage / ContactPage / CollectionPage */
export function pageLd(
  env: BuildEnv,
  o: {
    type?: string;
    path: string;
    name: string;
    description: string;
    image: string;
    partner?: Partner;
    dateModified?: string;
    mainEntity?: string;
  },
): Ld {
  return {
    '@type': o.type ?? 'WebPage',
    '@id': ids.page(env, o.path),
    url: abs(env, o.path),
    name: o.name,
    description: o.description,
    inLanguage: 'ja',
    isPartOf: { '@id': ids.website(env) },
    publisher: { '@id': ids.operator },
    breadcrumb: o.path === '/' ? undefined : { '@id': ids.crumb(env, o.path) },
    primaryImageOfPage: { '@type': 'ImageObject', url: abs(env, o.image), width: 1200, height: 630 },
    ...(o.partner ? { about: { '@id': ids.org(env, o.partner) } } : {}),
    ...(o.mainEntity ? { mainEntity: { '@id': o.mainEntity } } : {}),
    ...(o.dateModified ? { dateModified: o.dateModified } : {}),
  };
}

/** パンくず。先頭は必ず Baton Partners（/）。画面のパンくずと同じ並び */
export function breadcrumbLd(env: BuildEnv, path: string, items: { name: string; href: string }[]): Ld {
  const all = [{ name: site.hubName, href: '/' }, ...items];
  return {
    '@type': 'BreadcrumbList',
    '@id': ids.crumb(env, path),
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: text(it.name),
      item: abs(env, it.href),
    })),
  };
}

/** 見えているFAQと同じ内容。リッチリザルトは終了しているが、読み手とAIの理解のために残す */
export function faqLd(env: BuildEnv, path: string, faq: { q: string; a: string }[]): Ld {
  return {
    '@type': 'FAQPage',
    '@id': ids.faq(env, path),
    isPartOf: { '@id': ids.page(env, path) },
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: text(f.q),
      acceptedAnswer: { '@type': 'Answer', text: text(f.a) },
    })),
  };
}
