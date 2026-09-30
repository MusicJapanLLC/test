import { routes, site } from '../../config/site';
import { bpLogo } from '../logo';
import type { Partner } from '../../types';
import { breadcrumb, document, footer, type BuildEnv } from '../layout';
import { esc, heading, jp } from '../text';

const simpleHeader = `
<a class="skip" href="#main">本文へ移動</a>
<header class="hdr hdr-simple" data-hdr>
  <div class="hdr-in">
    <a class="brand" href="/" aria-label="Baton Partners">${bpLogo({ size: 34, animated: true, className: "brand-bp-solo" })}</a>
  </div>
</header>`;

/** ルート：デモ用の掲載企業一覧（非公開・noindex） */
export function renderIndex(list: Partner[], env: BuildEnv): string {
  const cards = list
    .map(
      (p) => `
      <li>
        <a class="pcard" href="${routes.top(p.slug)}" style="--brand:${p.brand.primary}">
          <span class="pcard-no">No.${p.no}</span>
          <img src="${p.brand.logo}" alt="" width="${p.brand.logoSize[0]}" height="${p.brand.logoSize[1]}" />
          <span class="pcard-name">${esc(p.company.name)}</span>
          <span class="pcard-svc">${esc(p.service.name)}｜${esc(p.service.category)}</span>
          <span class="arrow" aria-hidden="true">→</span>
        </a>
      </li>`,
    )
    .join('');
  const body = `
${simpleHeader}
<main id="main" class="index-main">
  <section class="wrap index-in">
    <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>Partner Companies — Demo</p>
    <h1 class="index-h">${heading(['会う前に、', '選ばれる理由をつくる。'])}</h1>
    <p class="index-lead">${jp('企業の魅力を伝え、紹介と検索の両方から、確度の高い相談へ。掲載企業ごとに、5ページの専用サイトを用意しています。')}</p>
    <ul class="pcards">${cards}</ul>
  </section>
</main>
${footer()}`;
  return document(
    { kind: 'index', path: '/', title: `${site.name}｜Partner Companies`, description: site.description },
    env,
    body,
  );
}

const PRIVACY: { h: string; body: string[]; list?: string[] }[] = [
  {
    h: '1. 取得する情報',
    body: ['当社は、本サイトのアンケートを通じて、次の情報を取得します。'],
    list: ['会社名、お名前、メールアドレス、役職', 'アンケートへのご回答内容、ひとこと欄の内容', '共有いただいた資料・ポートフォリオのファイルやURL（ご提出いただいた場合）'],
  },
  {
    h: '2. 利用目的',
    body: ['取得した情報は、次の目的の範囲内で利用します。'],
    list: ['ご相談内容の確認と、ご紹介の可否の判断', 'ご紹介先とのおつなぎに関するご連絡', '個人を特定しない形での、サービス改善のための統計的な分析'],
  },
  {
    h: '3. 第三者提供について',
    body: [
      'ご相談先の企業へは、新しいご相談があったことと受付番号をお知らせします。あわせて、おつなぎの可否を確かめるため、会社名・お名前・連絡先を除いたご相談の概要を事前にお伝えします。',
      'お客様の会社名・お名前・連絡先と、共有いただいた資料は、お客様とご相談先の双方の了承を得たうえで、おつなぎに必要な範囲に限って提供します。',
      '上記のほか、法令に基づく場合を除き、あらかじめご本人の同意を得ることなく第三者へ提供することはありません。',
    ],
  },
  {
    h: '4. 安全管理',
    body: ['取得した情報は、当社が管理するスプレッドシートとGoogleドライブに保管し、閲覧できる者を限定して管理します。'],
  },
  {
    h: '5. 開示・訂正・削除のご請求',
    body: ['ご本人から、保有する情報の開示・訂正・利用停止・削除のご請求があった場合は、ご本人であることを確認したうえで、遅滞なく対応します。'],
  },
  {
    h: '6. お問い合わせ窓口',
    body: [`${site.operator.name}　${site.operator.representative}`, `所在地：${site.operator.address}`, `メール：${site.operator.email}`],
  },
];

export function renderPrivacy(env: BuildEnv): string {
  const blocks = PRIVACY.map(
    (b) => `
    <section class="pv-sec">
      <h2 class="pv-h">${esc(b.h)}</h2>
      ${b.body.map((t) => `<p>${jp(t)}</p>`).join('')}
      ${b.list ? `<ul>${b.list.map((t) => `<li>${jp(t)}</li>`).join('')}</ul>` : ''}
    </section>`,
  ).join('');
  const body = `
${simpleHeader}
<main id="main" class="pv-main">
  <div class="wrap pv">
    ${breadcrumb([{ name: 'Baton Partners', href: '/' }, { name: 'プライバシーポリシー' }])}
    <h1 class="pv-h1">プライバシーポリシー</h1>
    <p>${jp(`${site.operator.name}（以下「当社」）は、Baton Partnersの運営にあたり、お客様の個人情報を次のとおり取り扱います。`)}</p>
    ${blocks}
  </div>
</main>
${footer()}`;
  return document(
    {
      kind: 'privacy',
      path: routes.privacy(),
      title: `プライバシーポリシー - ${site.name}`,
      description: `${site.operator.name}が運営するBaton Partnersのプライバシーポリシーです。`,
    },
    env,
    body,
  );
}
