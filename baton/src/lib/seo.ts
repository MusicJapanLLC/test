import { profiles } from '../data/profiles';
import { site } from '../data/site';
import type { Service, TalkProfile } from '../types';
import {
  BATON_ABOUT,
  companySameAs,
  hubFaqs,
  officialUrl,
  personSameAs,
  profileDescription,
  profileFaqs,
  profileTitle,
  type Faq,
} from './profile-facts';

export type JsonLd = Record<string, unknown>;

const officialCompanyUrl = (service: Service): string | undefined =>
  service.links.find((item) => item.label === '会社HP')?.url;

/**
 * サイト全体で共通の実体（エンティティ）。@id でつなぎ、ページごとに同じものを指す。
 * 名前・URL・所在地を全ページで一致させることが、検索エンジンとAIが
 * 「同じ運営者・同じ人物」と判断する手がかりになる。
 */
function siteEntities(siteBase: string): JsonLd[] {
  // 運営者（Music Japan）本人のプロフィールに載っている、会社の公式アカウント
  const operatorProfile = profiles.find((p) => p.company === site.operator.name);
  const operatorSameAs = operatorProfile ? companySameAs(operatorProfile) : [];
  return [
    {
      '@type': 'WebSite',
      '@id': `${siteBase}/#website`,
      url: `${siteBase}/profile/`,
      name: site.nameJa,
      alternateName: site.name,
      description: BATON_ABOUT,
      inLanguage: 'ja',
      publisher: { '@id': `${siteBase}/#operator` },
    },
    {
      '@type': 'Organization',
      '@id': `${siteBase}/#operator`,
      name: site.operator.name,
      url: site.operator.url,
      ...(operatorSameAs.length ? { sameAs: operatorSameAs } : {}),
      founder: { '@type': 'Person', name: site.operator.representative.replace(/^代表社員\s*/, '') },
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.operator.address.replace(/^大阪市北区/, ''),
        addressLocality: '大阪市北区',
        addressRegion: '大阪府',
        addressCountry: 'JP',
      },
    },
  ];
}

/** その人の会社。運営者本人の会社なら、運営者と同じ @id を使う */
function companyRef(profile: TalkProfile, profileUrl: string, siteBase: string): { ref: JsonLd; entity: JsonLd | null } {
  if (profile.company === site.operator.name) {
    return { ref: { '@id': `${siteBase}/#operator` }, entity: null };
  }
  const url = officialUrl(profile);
  const id = `${profileUrl}#company`;
  return {
    ref: { '@id': id },
    entity: {
      '@type': 'Organization',
      '@id': id,
      name: profile.company,
      ...(url ? { url } : {}),
      ...(companySameAs(profile).length ? { sameAs: companySameAs(profile) } : {}),
      ...(profile.location ? { location: { '@type': 'Place', name: profile.location } } : {}),
    },
  };
}

function faqPage(faqs: Faq[], pageUrl: string): JsonLd {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: 'ja',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function profileStructuredData(
  profile: TalkProfile,
  profileUrl: string,
  profileHubUrl: string,
  siteBase: string,
  imageUrl?: string,
): JsonLd[] {
  const company = companyRef(profile, profileUrl, siteBase);
  const sameAs = personSameAs(profile);
  // 専門分野は「事業タグ」だけ。キーワードタグには地域や方針（東海発・完全招待制など）が混ざるため入れない
  const knowsAbout = [...new Set(profile.businessTags ?? [])];

  const person: JsonLd = {
    '@type': 'Person',
    '@id': `${profileUrl}#person`,
    name: profile.name,
    jobTitle: profile.title,
    description: profile.bio,
    url: profileUrl,
    ...(imageUrl ? { image: imageUrl } : {}),
    worksFor: company.ref,
    ...(profile.location ? { workLocation: { '@type': 'Place', name: profile.location } } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    mainEntityOfPage: { '@id': `${profileUrl}#profilepage` },
  };

  const page: JsonLd = {
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profilepage`,
    url: profileUrl,
    name: profileTitle(profile),
    description: profileDescription(profile),
    inLanguage: 'ja',
    isPartOf: { '@id': `${siteBase}/#website` },
    breadcrumb: { '@id': `${profileUrl}#breadcrumb` },
    mainEntity: { '@id': `${profileUrl}#person` },
    ...(imageUrl ? { primaryImageOfPage: imageUrl } : {}),
    ...(profile.updatedAt ? { dateModified: profile.updatedAt } : {}),
  };

  const breadcrumb: JsonLd = {
    '@type': 'BreadcrumbList',
    '@id': `${profileUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.nameJa, item: profileHubUrl },
      { '@type': 'ListItem', position: 2, name: profile.name, item: profileUrl },
    ],
  };

  return [
    {
      '@context': 'https://schema.org',
      '@graph': [
        ...siteEntities(siteBase),
        page,
        person,
        ...(company.entity ? [company.entity] : []),
        breadcrumb,
        faqPage(profileFaqs(profile), profileUrl),
      ],
    },
  ];
}

export function serviceStructuredData(
  service: Service,
  serviceUrl: string,
  serviceHubUrl: string,
): JsonLd[] {
  const companyUrl = officialCompanyUrl(service);

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${serviceUrl}#service`,
      name: service.serviceName,
      description: service.description,
      url: serviceUrl,
      provider: {
        '@type': 'Organization',
        name: service.company,
        ...(companyUrl ? { url: companyUrl } : {}),
      },
      mainEntityOfPage: serviceUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Baton 法人向けサービス',
          item: serviceHubUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: service.serviceName,
          item: serviceUrl,
        },
      ],
    },
  ];
}

export function profileHubStructuredData(
  profiles: TalkProfile[],
  profileHubUrl: string,
  profileUrlFor: (profile: TalkProfile) => string,
  siteBase: string,
): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@graph': [
        ...siteEntities(siteBase),
        {
          '@type': 'CollectionPage',
          '@id': `${profileHubUrl}#collection`,
          url: profileHubUrl,
          name: `${site.nameJa}｜経営者・事業者を紹介する招待制サービス`,
          description: BATON_ABOUT,
          inLanguage: 'ja',
          isPartOf: { '@id': `${siteBase}/#website` },
          about: { '@id': `${siteBase}/#operator` },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: profiles
              .filter((profile) => profile.active)
              .map((profile, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: `${profile.name}（${profile.company} ${profile.title}）`,
                url: profileUrlFor(profile),
              })),
          },
        },
      ],
    },
  ];
}

/** よくある質問ページ（/faq/） */
export function faqPageStructuredData(faqUrl: string, profileHubUrl: string, siteBase: string): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@graph': [
        ...siteEntities(siteBase),
        { ...faqPage(hubFaqs(), faqUrl), isPartOf: { '@id': `${siteBase}/#website` }, name: `よくある質問｜${site.nameJa}` },
        {
          '@type': 'BreadcrumbList',
          '@id': `${faqUrl}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: site.nameJa, item: profileHubUrl },
            { '@type': 'ListItem', position: 2, name: 'よくある質問', item: faqUrl },
          ],
        },
      ],
    },
  ];
}

export function serviceHubStructuredData(
  services: Service[],
  serviceHubUrl: string,
  serviceUrlFor: (service: Service) => string,
): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${serviceHubUrl}#collection`,
      url: serviceHubUrl,
      name: '法人向け厳選サービス｜Baton -バトン-',
      description:
        '合同会社Music Japanが法人向けに選んだ専門サービスを掲載しています。課題に応じて各サービスへ相談できます。',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: services.map((service, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: service.serviceName,
          url: serviceUrlFor(service),
        })),
      },
    },
  ];
}
