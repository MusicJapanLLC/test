import { routes, site } from '../config/site';
import type { Partner } from '../types';
import { bpNo, type BuildEnv } from './layout';

/** 公開先。プレビューのビルドでも、フィードのURLは本番の独自ドメインで書く（読む側が本番の画像を使うため） */
const PUBLIC_URL = 'https://partners.music-japan.com';

/**
 * /partners.json：掲載企業の一覧を、ほかのサイトが読める形で書き出す。
 *
 * music-japan.com（公式サイト）のパートナー欄は、ビルドのたびにこのファイルを読んで作り直す
 * （music-japan-site-trace/scripts/sync-partners.mjs）。企業を足す・文言を直すのは src/partners/ だけでよい。
 * 中身は一覧ページ（/）と同じ：draft の企業は本番ビルドに入らない。運営会社（BP-000）は operator に分けて入れる。
 */
export function partnersFeed(list: Partner[], operator: Partner, env: BuildEnv, updated: string): string {
  const abs = (path: string) => `${PUBLIC_URL}${path}`;
  const entry = (p: Partner) => ({
    id: p.slug,
    no: bpNo(p),
    href: abs(routes.top(p.slug)),
    website: p.company.url,
    name: { ja: p.company.name, en: p.catalog.en.name },
    base: { ja: p.catalog.base, en: p.catalog.en.base },
    category: { ja: p.catalog.category, en: p.catalog.en.category },
    title: { ja: p.catalog.catch, en: p.catalog.en.catch },
    body: { ja: p.catalog.lead, en: p.catalog.en.lead },
    service: p.catalog.service ?? null,
    logos: p.catalog.logos.map((l) => ({ src: abs(l.src), alt: l.alt, width: l.size[0], height: l.size[1] })),
    colors: p.catalog.colors ?? [p.brand.primary, p.brand.accent],
    updated: p.seo.updated,
  });
  return `${JSON.stringify(
    {
      version: 1,
      name: site.name,
      url: `${PUBLIC_URL}/`,
      updated,
      ...(env.noindex ? { preview: true } : {}),
      operator: entry(operator),
      partners: list.map(entry),
    },
    null,
    2,
  )}\n`;
}
