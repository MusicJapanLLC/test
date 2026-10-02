import * as C from '../content/copy';
import { dotDate, sortedActivity } from '../content/activity';
import { faq } from '../content/faq';
import { projects } from '../content/projects';
import { BATON_URL, company, EMAIL, LP_URL, OFFICIAL_URL, PARTNERS_URL, SECOND_TAKE_URL, socials, TIMEREX_URL, UPDATED } from '../content/site';
import { plain } from './text';

/**
 * 検索エンジンとAI向けのファイル（ビルド時に書き出す）。
 *   robots.txt / sitemap.xml / llms.txt / llms-full.txt / index.md / feed.xml（Atom）/ activity.json（JSON Feed）
 */

const AI_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot', 'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Amazonbot', 'MistralAI-User',
];

export function robots(noindex: boolean): string {
  if (noindex) return 'User-agent: *\nDisallow: /\n';
  return [
    '# 合同会社Music Japan — Music Japanの仕事（Baton Partners / Baton / SECOND TAKE）',
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${LP_URL}/</loc>
    <lastmod>${UPDATED}</lastmod>
    <image:image><image:loc>${LP_URL}/og/ja-top.png</image:loc></image:image>
    <image:image><image:loc>${LP_URL}/people/kabeya-800.webp</image:loc></image:image>
${projects.map((p) => `    <image:image><image:loc>${LP_URL}${p.shots.desktop}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`;
}

const links = () => [
  `- Baton Partners（企業の専用ページと紹介）: ${PARTNERS_URL}`,
  ...projects.map((p) => `  - ${p.no} ${p.name}: ${p.href}`),
  `- Baton（招待制のプロフィールと紹介）: ${BATON_URL}`,
  `- SECOND TAKE（経営者インタビュー）: ${SECOND_TAKE_URL}`,
  `- 合同会社Music Japan 公式サイト: ${OFFICIAL_URL}/`,
  `- 打ち合わせの予約（TimeRex）: ${TIMEREX_URL}`,
];

export function llms(): string {
  return `# 合同会社Music Japan — Music Japanの仕事

> ${plain(C.hero.lead)}

このページ（${LP_URL}/）は、合同会社Music Japan（大阪）が企業・経営者と一緒にする仕事を1ページにまとめたものです。
会社の公式情報の正本は公式サイト（${OFFICIAL_URL}/）です。

## 4つの段階

${C.what.stages.map((s, i) => `${i + 1}. ${s.title}（${s.en}）: ${plain(s.body)}`).join('\n')}

## サービス

${links().join('\n')}

## 会社

- 会社名: ${company.name}（${company.nameEn}）
- 代表社員: ${company.representative}（${company.representativeEn}）
- 所在地: 〒${company.postal} ${company.address}
- 法人番号: ${company.corporateNo}
- メール: ${EMAIL}
- 公式SNS: ${socials.map((s) => `${s.name} ${s.href}`).join(' / ')}

## よくある質問

${faq.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}
`;
}

/** ページの文章をそのままMarkdownにしたもの（AIが本文を読むため） */
export function llmsFull(): string {
  const P = C.partners;
  return `# ${plain(C.hero.title)}

${plain(C.hero.pre)}

${plain(C.hero.lead)}

## ${plain(C.what.title)}

${plain(C.what.lead)}

${C.what.stages.map((s) => `### ${s.title}（${s.en}）\n${plain(s.body)}\n関わるサービス: ${s.where.join('、')}`).join('\n\n')}

${plain(C.what.aside)}

## ${plain(C.ecosystem.title)}

${plain(C.ecosystem.lead)}

${C.ecosystem.nodes.map((n) => `- ${n.name}（${n.sub}）: ${plain(n.body)}${n.href ? ` ${n.href}` : ''}`).join('\n')}

${plain(C.ecosystem.example.title)}${plain(C.ecosystem.example.body)}

## Baton Partners — ${plain(P.title)}

${plain(P.lead)}

### ${P.anatomy.title}

${plain(P.anatomy.lead)}

${P.anatomy.pages.map((pg) => `- ${pg.name}（${pg.en}）: ${plain(pg.body)}`).join('\n')}

${P.anatomy.parts.map((pt) => `- ${pt.name}: ${plain(pt.body)}`).join('\n')}

### ${plain(P.world.title)}

${plain(P.world.lead)}

### ${plain(P.after.title)}

${P.after.steps.map((s, i) => `${i + 1}. ${s.name}: ${plain(s.body)}`).join('\n')}

${plain(P.after.note)}

「${P.after.quote}」— ${P.after.quoteBy}

### ${plain(P.origin.title)}

${P.origin.paragraphs.map(plain).join('\n\n')}

## ${plain(C.build.title)}

${plain(C.build.lead)}

${C.build.steps.map((s, i) => `${i + 1}. ${s.name}（${s.en}）: ${plain(s.body)}`).join('\n')}

## ${plain(C.live.title)}

${projects.map((p) => `### ${p.no} ${p.name}\n${p.category}（${p.base}）。${p.catch}\n${plain(p.world.note)}\n${p.pages.map((pg) => `- ${pg.label}: ${pg.href}`).join('\n')}`).join('\n\n')}

## Baton — ${plain(C.baton.title)}

${plain(C.baton.lead)}

${C.baton.points.map((p) => `- ${p.title}: ${plain(p.body)}`).join('\n')}

紹介までの流れ: ${C.baton.flow.map((f) => f.name).join(' → ')}

${plain(C.baton.stat.label)}: ${C.baton.stat.value}${C.baton.stat.unit}（${C.baton.stat.source}）

## SECOND TAKE — ${plain(C.secondTake.title)}

${plain(C.secondTake.lead)}

${C.secondTake.outputs.map((o) => `- ${o.name}: ${plain(o.body)}`).join('\n')}

${C.secondTake.principles.map((p) => `- ${p.name}: ${plain(p.body)}`).join('\n')}

${plain(C.secondTake.notAd)} ${C.secondTake.status}

## ${plain(C.search.title)}

${plain(C.search.lead)}

${plain(C.search.principle)}

## ${plain(C.now.title)}

${sortedActivity()
  .map((a) => `- ${dotDate(a.date)} [${a.type}] ${a.title}${a.body ? ` — ${plain(a.body)}` : ''}${a.href ? ` ${a.href}` : ''}`)
  .join('\n')}

## ${C.about.title}

${C.about.official}

${C.about.own}

代表社員 ${C.about.person.name}（${C.about.person.kana} / ${C.about.person.en}）: ${plain(C.about.person.bio)}

${C.about.person.statement.join('\n\n')}

## よくある質問

${faq.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## 話してみる

${plain(C.cta.lead)}

${C.talk.steps.map((s) => `${s.no}. ${s.title}: ${plain(s.body)}`).join('\n')}

予約: ${TIMEREX_URL}
`;
}

const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const iso = (d: string) => (d.length === 7 ? `${d}-01` : d) + 'T09:00:00+09:00';

export function atom(): string {
  const items = sortedActivity();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">
  <title>Music Japan — NOW</title>
  <subtitle>${xml(plain(C.now.lead))}</subtitle>
  <link href="${LP_URL}/feed.xml" rel="self"/>
  <link href="${LP_URL}/#now"/>
  <id>${LP_URL}/#now</id>
  <updated>${iso(UPDATED)}</updated>
  <author><name>${company.name}</name></author>
${items
  .map(
    (a, i) => `  <entry>
    <title>${xml(`[${a.type}] ${a.title}`)}</title>
    <link href="${xml(a.href ?? `${LP_URL}/#now`)}"/>
    <id>${LP_URL}/#now-${a.date}-${i}</id>
    <updated>${iso(a.date)}</updated>
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
      title: 'Music Japan — NOW',
      home_page_url: `${LP_URL}/`,
      feed_url: `${LP_URL}/activity.json`,
      language: 'ja',
      items: sortedActivity().map((a, i) => ({
        id: `${a.date}-${i}`,
        title: a.title,
        content_text: plain(a.body ?? a.title),
        url: a.href ?? `${LP_URL}/#now`,
        date_published: iso(a.date),
        tags: [a.type, a.source],
      })),
    },
    null,
    2,
  );
}
