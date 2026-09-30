import { routes, site } from '../config/site';
import { partners } from '../partners';
import type { BuildEnv } from './layout';
import { shortName } from './layout';
import { text } from './text';

/**
 * /llms.txt（https://llmstxt.org の提案仕様）。AIがサイト全体を短時間で把握できるよう、
 * 要約と主要ページへのリンクをMarkdownで並べる。順位の施策ではなく「AIが読みやすい索引」。
 */
export function llmsTxt(env: BuildEnv): string {
  const u = (path: string) => `${env.siteUrl}${path}`;
  const blocks = partners.map((p) => {
    const s = p.seo;
    return [
      `## ${p.company.name}（${p.service.name}）`,
      '',
      text(s.top.answer.a),
      '',
      `- [${s.top.title}](${u(routes.top(p.slug))}): ${text(s.top.description)}`,
      `- [${s.about.title}](${u(routes.about(p.slug))}): ${text(s.about.description)}`,
      `- [${s.service.title}](${u(routes.service(p.slug))}): ${text(s.service.description)}`,
      `- [${text(p.insight.title)}](${u(routes.insight(p.slug, p.insight.slug))}): ${text(p.insight.description)}`,
      `- [${s.contact.title}](${u(routes.contact(p.slug))}): ${text(s.contact.description)}`,
      `- 公式サイト: ${p.company.url}`,
    ].join('\n');
  });
  return [
    `# ${site.name}`,
    '',
    `> ${site.description} 掲載企業ごとに、トップ・取り組み・サービス・記事・話してみる の5ページがあります。価格や契約条件は載せていません。`,
    '',
    `運営は${site.operator.name}（${site.operator.url}）。掲載企業との相談は、各社の「話してみる」ページから公式LINEとアンケートで受け付け、Music Japanが内容を確かめてから、双方の了承を得ておつなぎします。`,
    '',
    ...blocks.flatMap((b) => [b, '']),
    '## 運営・編集',
    '',
    `- [Baton Partners 編集部について](${u(routes.editorial())}): 運営者と編集方針。事実は公式情報から書き、出典を載せる`,
    `- [プライバシーポリシー](${u(routes.privacy())})`,
    `- [合同会社Music Japan](${site.operator.url})`,
    '',
    '## Optional',
    '',
    `- [llms-full.txt](${u('/llms-full.txt')}): 各社の要約・FAQ・記事の要点をまとめた全文版`,
    '',
  ].join('\n');
}

/** /llms-full.txt：各社の要約・FAQ・記事の要点を1つのテキストに（AIがページを巡回しなくても答えられるように） */
export function llmsFullTxt(env: BuildEnv): string {
  const u = (path: string) => `${env.siteUrl}${path}`;
  const parts = partners.map((p) => {
    const s = p.seo;
    const profile = p.company.profile.map((r) => `- ${r.label}: ${r.url ?? text(r.value)}`).join('\n');
    const faq = p.faq.map((f) => `### ${text(f.q)}\n\n${text(f.a)}`).join('\n\n');
    return [
      `# ${p.company.name}（${p.service.name}）`,
      '',
      `出典ページ: ${u(routes.top(p.slug))}　最終更新: ${s.updated}`,
      '',
      ...[s.top, s.about, s.service, s.contact].flatMap((x) => [`## ${x.answer.q}`, '', text(x.answer.a), '']),
      '## 会社概要',
      '',
      profile,
      '',
      `## ${p.service.name}の機能`,
      '',
      p.service.features.map((f) => `- ${f.title}: ${text(f.detail)}`).join('\n'),
      '',
      `## ${p.service.name}について、よくある質問`,
      '',
      faq,
      '',
      `## 記事：${text(p.insight.title)}`,
      '',
      `URL: ${u(routes.insight(p.slug, p.insight.slug))}`,
      '',
      p.insight.keyPoints.map((k) => `- ${text(k)}`).join('\n'),
      '',
      '出典:',
      p.insight.sources.map((x) => `- ${x.label}: ${x.url}`).join('\n'),
      '',
      `## ${shortName(p)}と話してみるには`,
      '',
      `${u(routes.contact(p.slug))} から、公式LINEの追加とアンケートへの回答をお願いしています。`,
      '',
    ].join('\n');
  });
  return [`# ${site.name}（全文版）`, '', `> ${site.description}`, '', ...parts].join('\n');
}
