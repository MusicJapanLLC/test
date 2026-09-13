import type { Service, TalkProfile } from '../types';

export type JsonLd = Record<string, unknown>;

const officialProfileUrl = (profile: TalkProfile): string | undefined =>
  profile.media?.find((item) => /^公式(?:HP|サイト)?$/.test(item.label))?.url;

const officialCompanyUrl = (service: Service): string | undefined =>
  service.links.find((item) => item.label === '会社HP')?.url;

export function profileStructuredData(
  profile: TalkProfile,
  profileUrl: string,
  profileHubUrl: string,
): JsonLd[] {
  const companyUrl = officialProfileUrl(profile);
  const organization: JsonLd = {
    '@type': 'Organization',
    name: profile.company,
    ...(companyUrl ? { url: companyUrl } : {}),
  };

  const person: JsonLd = {
    '@type': 'Person',
    '@id': `${profileUrl}#person`,
    name: profile.name,
    jobTitle: profile.title,
    description: profile.bio,
    url: profileUrl,
    worksFor: organization,
    ...(profile.businessTags?.length || profile.keywordTags?.length
      ? {
          knowsAbout: [...new Set([...(profile.businessTags ?? []), ...(profile.keywordTags ?? [])])],
        }
      : {}),
  };

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': `${profileUrl}#profilepage`,
      url: profileUrl,
      name: `${profile.name}｜${profile.company}`,
      description: profile.bio,
      mainEntity: person,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Baton -バトン-',
          item: profileHubUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: profile.name,
          item: profileUrl,
        },
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
): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${profileHubUrl}#collection`,
      url: profileHubUrl,
      name: 'Baton -バトン-｜選んだ人が、選んだ人へ。',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: profiles
          .filter((profile) => profile.active)
          .map((profile, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: profile.name,
            url: profileUrlFor(profile),
          })),
      },
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
