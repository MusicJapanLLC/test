import { site } from '../data/site';
import type { TalkProfile } from '../types';
import {
  appearances,
  BATON_ABOUT,
  LISTING_CONTACT_URL,
  officialUrl,
  oneLiner,
  personSameAs,
  profileFaqs,
  REQUEST_FLOW,
} from './profile-facts';

/**
 * AI向けのテキスト（/llms.txt・/llms-full.txt・各プロフィールの index.md）。
 * llms.txt の提案（https://llmstxt.org/）に沿って、Markdownで要点だけを渡す。
 * 中身は画面・構造化データと同じ事実から作る。
 */

type UrlFor = (path: string) => string;

export function profileMarkdown(profile: TalkProfile, url: UrlFor): string {
  const page = url(`/profile/${profile.slug}/`);
  const official = officialUrl(profile);
  const lines: string[] = [
    `# ${profile.name}（${profile.company} ${profile.title}）`,
    '',
    `> ${oneLiner(profile)}`,
    '',
    profile.bio,
    '',
    '## 基本情報',
    '',
    `- 氏名: ${profile.name}`,
    `- 所属: ${profile.company}${official ? `（${official}）` : ''}`,
    `- 役職: ${profile.title}`,
    ...(profile.location ? [`- 拠点: ${profile.location}`] : []),
    ...(profile.businessTags?.length ? [`- 主な事業: ${profile.businessTags.join('・')}`] : []),
    ...(profile.keywordTags?.length ? [`- キーワード: ${profile.keywordTags.join('・')}`] : []),
    ...personSameAs(profile).map((u) => `- 本人の発信: ${u}`),
    `- プロフィールページ: ${page}`,
    ...(profile.updatedAt ? [`- 最終更新: ${profile.updatedAt}`] : []),
    '',
  ];

  if (profile.business?.length) {
    lines.push('## 事業内容', '', ...profile.business.flatMap((p) => [p, '']));
  }
  if (profile.services?.length) {
    lines.push(`## ${profile.servicesTitle ?? '運営メディア・サービス'}`, '');
    profile.services.forEach((s) => lines.push(`- **${s.name}**: ${s.description}`));
    lines.push('');
  }
  const shows = appearances(profile);
  const others = (profile.media ?? []).filter((m) => !shows.includes(m));
  if (shows.length) {
    lines.push('## 登壇・掲載', '');
    shows.forEach((m) =>
      lines.push(`- ${m.date ? `${m.date} ` : ''}[${m.label}](${m.url})（${m.kind}）${m.note ? `: ${m.note}` : ''}`),
    );
    lines.push('');
  }
  if (others.length) {
    lines.push('## 関連リンク', '');
    others.forEach((m) => lines.push(`- [${m.label}](${m.url})${m.note ? `: ${m.note}` : ''}`));
    lines.push('');
  }
  lines.push('## よくある質問', '');
  profileFaqs(profile).forEach((f) => lines.push(`### ${f.q}`, '', f.a, ''));
  lines.push(
    '## 紹介を希望するには',
    '',
    `${REQUEST_FLOW} 申請フォーム: ${page}#talk-request`,
    '',
    `出典: ${site.nameJa}（運営: ${site.operator.name}）`,
    '',
  );
  return lines.join('\n');
}

export function llmsTxt(profiles: TalkProfile[], url: UrlFor): string {
  const active = profiles.filter((p) => p.active);
  return [
    `# ${site.nameJa}`,
    '',
    `> ${BATON_ABOUT}`,
    '',
    `運営: ${site.operator.name}（${site.operator.representative}、${site.operator.url}）。`,
    `所在地: ${site.operator.address}。`,
    '掲載されている経営者・事業者への紹介は、各プロフィールページのフォームから申請できます。',
    '',
    '## プロフィール',
    '',
    ...active.map(
      (p) =>
        `- [${p.name}（${p.company} ${p.title}）](${url(`/profile/${p.slug}/`)}): ${oneLiner(p)} Markdown版: ${url(`/profile/${p.slug}/index.md`)}`,
    ),
    '',
    '## 紹介・掲載のご相談',
    '',
    `- [プロフィール一覧（Batonトップ）](${url('/profile/')}): ${REQUEST_FLOW}`,
    `- [紹介・掲載をご希望の方（予約ページ）](${LISTING_CONTACT_URL}): ${site.operator.name}への相談窓口`,
    `- [${site.operator.name} 公式サイト](${site.operator.url})`,
    '',
    '## Optional',
    '',
    `- [全プロフィールの本文（1ファイル）](${url('/llms-full.txt')})`,
    `- [法人向け厳選サービス](${url('/hub/')}): ${site.operator.name}が法人向けに選んだ専門サービスの紹介`,
    `- [プライバシーポリシー](${url(site.privacyPath)})`,
    '',
  ].join('\n');
}

export function llmsFullTxt(profiles: TalkProfile[], url: UrlFor): string {
  const active = profiles.filter((p) => p.active);
  return [llmsTxt(profiles, url), ...active.map((p) => profileMarkdown(p, url))].join('\n---\n\n');
}
