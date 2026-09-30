import { brandNames, businesses, facts, partners, profile } from '../content/company';
import { faq } from '../content/faq';
import { artwork, releases, type Locale } from '../content/releases';
import { BATON_URL, copy, EMAIL, path, SECOND_TAKE_URL, SITE_URL, TIMEREX_URL, type PageKey } from '../content/site';

/** Public by design: IndexNow verifies ownership by fetching /<key>.txt from the site. */
export const INDEXNOW_KEY = '844274c99df5a67456015ef85d22911f';

export const PAGES: PageKey[] = ['home', 'business', 'company', 'profile', 'partners', 'contact', 'privacy'];
export const allUrls = () => PAGES.flatMap((k) => (['ja', 'en'] as Locale[]).map((l) => `${SITE_URL}${path(l, k)}`));

const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function sitemap(lastmod: string): string {
  const images: Partial<Record<PageKey, { loc: string; title: string }[]>> = {
    home: releases.map((r) => ({ loc: `${SITE_URL}${artwork(r, 1200)}`, title: `${r.title} — ${r.artist}` })),
    business: releases.map((r) => ({ loc: `${SITE_URL}${artwork(r, 1200)}`, title: `${r.title} — ${r.artist}` })),
    profile: [{ loc: `${SITE_URL}/kabeya-tomoki.png`, title: '壁谷 友生 / Tomoki Kabeya' }],
    company: [{ loc: `${SITE_URL}/music-japan-logo.png`, title: '合同会社Music Japan' }],
  };
  const entries = PAGES.flatMap((k) =>
    (['ja', 'en'] as Locale[]).map((l) => {
      const imgs = [{ loc: `${SITE_URL}/og/${l}-${k}.png`, title: copy[l].pages[k as Exclude<PageKey, 'home'>]?.title ?? copy[l].home.title }, ...(images[k] ?? [])];
      return `  <url>
    <loc>${SITE_URL}${path(l, k)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${k === 'home' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${k === 'home' ? (l === 'ja' ? '1.0' : '0.9') : k === 'privacy' ? '0.3' : '0.8'}</priority>
    <xhtml:link rel="alternate" hreflang="ja-JP" href="${SITE_URL}${path('ja', k)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${path('en', k)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${path('ja', k)}" />
${imgs.map((i) => `    <image:image><image:loc>${xml(i.loc)}</image:loc><image:title>${xml(i.title)}</image:title></image:image>`).join('\n')}
  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;
}

/** Search and AI crawlers are named explicitly so a later blanket rule cannot silently block them. */
export function robots(): string {
  const bots = ['Googlebot', 'Googlebot-Image', 'Bingbot', 'Applebot', 'DuckDuckBot', 'Yandex', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Amazonbot', 'cohere-ai', 'MistralAI-User'];
  const block = (ua: string) => `User-agent: ${ua}\nAllow: /\nDisallow: /audio/\n`;
  return `# 合同会社Music Japan / Music Japan LLC — https://music-japan.com/
# Summary for AI systems: ${SITE_URL}/llms.txt (full: ${SITE_URL}/llms-full.txt)

${block('*')}
${bots.map(block).join('\n')}
Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function pageList(l: Locale) {
  const c = copy[l];
  return PAGES.map((k) => {
    const d = k === 'home' ? c.home.description : c.pages[k].description;
    return `- [${c.navLabels[k]}](${SITE_URL}${path(l, k)}): ${d}`;
  }).join('\n');
}

export function llms(): string {
  const ja = copy.ja;
  return `# 合同会社Music Japan（Music Japan LLC）

> ${ja.pages.company.lead}

合同会社Music Japanは大阪の音楽・メディア会社です。音楽制作・楽曲配信（アーティストYumaと、ジャズ・クラシック・睡眠音楽のブランド）、経営者メディア「SECOND TAKE」のPodcastとインタビュー記事、招待制の紹介サービス「Baton」を手がけています。

## 公式ページ

${pageList('ja')}

## English

${pageList('en')}

## 会社情報

${facts.map((f) => `- ${f.label.ja}: ${f.value.ja}`).join('\n')}
- 公式サイト: ${SITE_URL}/

## 事業

${businesses.map((b) => `- ${b.name}: ${b.body.ja}`).join('\n')}

## 関連サービス

- SECOND TAKE（経営者メディア / Podcast・インタビュー）: ${SECOND_TAKE_URL}
- Baton（招待制の紹介サービス）: ${BATON_URL}

## よくある質問

${faq.ja.map((i) => `### ${i.q}\n${i.a}`).join('\n\n')}

## 詳細版

- ${SITE_URL}/llms-full.txt
`;
}

export function llmsFull(): string {
  const release = (l: Locale) =>
    releases
      .map((r, i) => `- MJ-${String(i + 1).padStart(3, '0')} ${r.title} — ${r.artist}（${r.type}）: ${r.description[l]} ${r.platform}: ${r.href}`)
      .join('\n');
  return `${llms()}
## 作品カタログ

${release('ja')}

## 展開ブランド・アーティスト

${brandNames.map((b) => `- ${b}`).join('\n')}

## パートナー企業（Baton Partners）

${partners.map((p) => `- ${p.no} ${p.name.ja}（${p.name.en}）/ 拠点: ${p.base.ja} / ${p.category.ja}: ${p.title.ja} ${p.body.ja} ${p.href}`).join('\n')}

## 代表プロフィール

- ${profile.name.ja}（${profile.name.en}）: ${profile.role.ja}
${profile.statement.ja.map((s) => `> ${s}`).join('\n>\n')}

## お問い合わせ

- フォーム: ${SITE_URL}${path('ja', 'contact')}
- メール: ${EMAIL}
- 打ち合わせ予約（TimeRex）: ${TIMEREX_URL}

---

# Music Japan LLC (English)

> ${copy.en.pages.company.lead}

## Company facts

${facts.map((f) => `- ${f.label.en}: ${f.value.en}`).join('\n')}

## Business

${businesses.map((b) => `- ${b.name}: ${b.body.en}`).join('\n')}

## Catalogue

${release('en')}

## Partners

${partners.map((p) => `- ${p.no} ${p.name.en} / ${p.base.en} / ${p.category.en}: ${p.title.en} ${p.body.en} ${p.href}`).join('\n')}

## FAQ

${faq.en.map((i) => `### ${i.q}\n${i.a}`).join('\n\n')}
`;
}
