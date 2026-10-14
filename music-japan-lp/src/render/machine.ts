import * as C from '../content/copy';
import { dotDate, sortedActivity } from '../content/activity';
import { faqGeneral, faqPartners } from '../content/faq';
import { PAGES } from '../content/pages';
import { projects } from '../content/projects';
import { BATON_URL, company, EMAIL, LP_URL, OFFICIAL_URL, PARTNERS_URL, SECOND_TAKE_URL, socials, TIMEREX_URL, UPDATED } from '../content/site';
import { plain } from './text';

/**
 * 検索エンジンとAI向けのファイル（ビルド時に書き出す）。
 *   robots.txt / sitemap.xml / llms.txt / llms-full.txt / feed.xml（Atom）/ activity.json（JSON Feed）
 */

const AI_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot', 'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Amazonbot', 'MistralAI-User',
];

export function robots(noindex: boolean): string {
  if (noindex) return 'User-agent: *\nDisallow: /\n';
  return [
    '# 合同会社Music Japan（Baton Partners / Baton / SECOND TAKE）',
    `# AI向けの要約: ${LP_URL}/llms.txt（全文: ${LP_URL}/llms-full.txt）`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
    ...AI_BOTS.map((b) => `User-agent: ${b}`),
    'Allow: /',
    '',
    `Sitemap: ${LP_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemap(): string {
  const images: Record<string, string[]> = {
    top: projects.map((p) => p.shots.desktop),
    works: projects.flatMap((p) => [p.shots.desktop, p.shots.desktop2]),
    about: ['/people/kabeya-800.webp'],
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${PAGES.map(
  (p) => `  <url>
    <loc>${LP_URL}${p.path}</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
    <image:image><image:loc>${LP_URL}/og/${p.key}.png</image:loc></image:image>
${(images[p.key] ?? []).map((src) => `    <image:image><image:loc>${LP_URL}${src}</image:loc></image:image>`).join('\n')}
  </url>`,
).join('\n')}
</urlset>
`;
}

const pageList = () => PAGES.map((p) => `- [${p.crumb}](${LP_URL}${p.path}): ${p.description}`).join('\n');

export function llms(): string {
  return `# 合同会社Music Japan

> ${plain(C.top.lead)}

合同会社Music Japan（大阪・梅田）のサイトです。会社の公式情報の正本は、公式サイト（${OFFICIAL_URL}/）にあります。

## このサイトのページ

${pageList()}

## サービスのサイト

- Baton Partners（会社の専用ページ）: ${PARTNERS_URL}
${projects.map((p) => `  - ${p.no} ${p.name}: ${p.href}`).join('\n')}
- Baton（経営者の招待制プロフィール）: ${BATON_URL}
- SECOND TAKE（経営者インタビュー）: ${SECOND_TAKE_URL}
- 相談の予約（TimeRex）: ${TIMEREX_URL}

## 会社

- 会社名: ${company.name}（${company.nameEn}）
- 代表社員: ${company.representative}（${company.representativeEn}）
- 所在地: 〒${company.postal} ${company.address}
- 法人番号: ${company.corporateNo}
- メール: ${EMAIL}
- SNS: ${socials.map((s) => `${s.name} ${s.href}`).join(' / ')}

全文は ${LP_URL}/llms-full.txt にあります。
`;
}

export function llmsFull(): string {
  const T = C.top;
  const P = C.partners;
  const B = C.baton;
  const S = C.secondTake;
  return `# ${plain(T.title)}

${plain(T.lead)}

## ${plain(T.answer.title)}

${T.answer.body.map(plain).join('\n\n')}

${T.answer.music}

## ${plain(T.services.title)}

${T.services.items.map((s) => `- ${s.name}（${s.kind}）: ${plain(s.body)} ${LP_URL}${s.href}`).join('\n')}

---

# Baton Partners（${P.label}）

${plain(P.catch)}

${plain(P.lead)}

## ${plain(P.pages.title)}

${P.pages.items.map((it, i) => `${i + 1}. ${it.name}: ${plain(it.body)}`).join('\n')}

## ${plain(P.build.title)}

${P.build.steps.map((s, i) => `${i + 1}. ${s.name}: ${plain(s.body)}`).join('\n')}

## ${plain(P.after.title)}

${P.after.steps.map((s, i) => `${i + 1}. ${s.name}: ${plain(s.body)}`).join('\n')}

${P.after.note} ${plain(P.after.noteBody)}

## 公開中のページ

${projects.map((p) => `- ${p.no} ${p.name}（${p.category}、${p.base}）: ${p.href}\n  ${plain(p.world.note)}`).join('\n')}

## よくある質問（Baton Partners）

${faqPartners.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

---

# Baton（${B.label}）

${plain(B.catch)}

${plain(B.lead)}

${B.rules.items.map((r) => `- ${r.name}: ${plain(r.body)}`).join('\n')}

${B.flow.steps.map((s, i) => `${i + 1}. ${s.name}: ${plain(s.body)}`).join('\n')}

${plain(B.versus.title)}: ${plain(B.versus.body)}

---

# SECOND TAKE（${S.label}）

${plain(S.catch)}

${plain(S.lead)}

${S.outputs.items.map((o) => `- ${o.name}: ${plain(o.body)}`).join('\n')}

${S.rules.items.map((r) => `- ${r.name}: ${plain(r.body)}`).join('\n')}

${plain(S.now.body)}

---

# お知らせ

${sortedActivity()
  .map((a) => `- ${dotDate(a.date)} ${a.title}${a.body ? `: ${plain(a.body)}` : ''}${a.href ? ` ${a.href}` : ''}`)
  .join('\n')}

---

# 会社概要

${C.about.official}

- 会社名: ${company.name}（${company.nameEn}）
- 代表社員: ${company.representative}
- 所在地: 〒${company.postal} ${company.address}
- 法人番号: ${company.corporateNo}
- していること: ${C.about.business.join('、')}
- メール: ${EMAIL}

## よくある質問

${faqGeneral.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

---

# 話してみる

${plain(C.talk.lead)}

${C.talk.topics.map((t) => `- ${t.name}: ${t.body}`).join('\n')}

予約: ${TIMEREX_URL}
`;
}

const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const iso = (d: string) => (d.length === 7 ? `${d}-01` : d) + 'T09:00:00+09:00';
const NEWS = `${LP_URL}/news/`;

export function atom(): string {
  const items = sortedActivity();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">
  <title>Music Japan お知らせ</title>
  <subtitle>${xml(plain(C.news.lead))}</subtitle>
  <link href="${LP_URL}/feed.xml" rel="self"/>
  <link href="${NEWS}"/>
  <id>${NEWS}</id>
  <updated>${iso(UPDATED)}</updated>
  <author><name>${company.name}</name></author>
${items
  .map(
    (a, i) => `  <entry>
    <title>${xml(a.title)}</title>
    <link href="${xml(a.href ?? NEWS)}"/>
    <id>${NEWS}#${a.date}-${i}</id>
    <updated>${iso(a.date)}</updated>
    <category term="${xml(C.news.types[a.type] ?? a.type)}"/>
    <summary>${xml(plain(a.body ?? a.title))}</summary>
  </entry>`,
  )
  .join('\n')}
</feed>
`;
}

export function jsonFeed(): string {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Music Japan お知らせ',
      home_page_url: NEWS,
      feed_url: `${LP_URL}/activity.json`,
      language: 'ja',
      items: sortedActivity().map((a, i) => ({
        id: `${a.date}-${i}`,
        title: a.title,
        content_text: plain(a.body ?? a.title),
        url: a.href ?? NEWS,
        date_published: iso(a.date),
        tags: [C.news.types[a.type] ?? a.type, a.source],
      })),
    },
    null,
    2,
  );
}
