import { routes, site } from '../../config/site';
import type { Partner } from '../../types';
import { operatorPartner, partners } from '../../partners';
import { bpMark } from '../logo';
import { bpHeader, bpNo, breadcrumb, document, footer, shortName, type BuildEnv } from '../layout';
import { answerBox } from '../parts';
import { breadcrumbLd, ids, orgLd, pageLd } from '../seo';
import { esc, heading, jp } from '../text';

const SITE_ANSWER = {
  q: 'Baton Partnersとは？',
  a: '合同会社Music Japanのパートナー企業を、一社ずつ番号をつけて紹介するページです。各社の事業とサービスを、専用のページにまとめています。',
};

const INDEX_TITLE = 'Baton Partners｜合同会社Music Japanのパートナー企業';

/** 傾いたレコード盤（CSSで描く。動きを減らす設定では止まる） */
function disc(cls: string): string {
  const ring = 'BATON PARTNERS · MUSIC JAPAN · CONNECTIONS · FROM JAPAN · ';
  return `
  <div class="${cls}" aria-hidden="true">
    <div class="disc-tilt">
      <div class="disc-spin">
        <span class="disc-label">
          <svg viewBox="0 0 200 200"><defs><path id="${cls}-ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"/></defs><text><textPath href="#${cls}-ring">${ring}</textPath></text></svg>
          ${bpMark({ size: 56 })}
        </span>
      </div>
      <span class="disc-sheen"></span>
    </div>
  </div>`;
}

/** ルート：Baton Partners のトップ。music-japan.com/partners と同じ見せ方で、パートナー企業を並べる */
export function renderIndex(list: Partner[], env: BuildEnv): string {
  const count = String(list.length).padStart(2, '0');
  const logos = list.flatMap((p) => p.catalog.logos.map((l) => ({ ...l, href: routes.top(p.slug) })));
  const logoRun = Array.from({ length: 3 }, () => logos)
    .flat()
    .map(
      (l) =>
        `<span class="lg-dot" aria-hidden="true"></span><img src="${l.src}" alt="" width="${l.size[0]}" height="${l.size[1]}" />`,
    )
    .join('');
  const cards = list
    .map(
      (p) => `
      <li class="rc" style="--brand:${p.brand.primary}">
        <a class="rc-sleeve" href="${routes.top(p.slug)}" tabindex="-1" aria-hidden="true">
          <span class="rc-sleeve-top"><b>${bpNo(p)}</b>BATON PARTNERS</span>
          <span class="rc-vinyl"><span class="rc-vinyl-l"></span></span>
          <span class="rc-jacket">
            <img src="${p.catalog.logos[0].src}" alt="" width="${p.catalog.logos[0].size[0]}" height="${p.catalog.logos[0].size[1]}" loading="lazy" />
          </span>
          <span class="rc-sleeve-bot">${esc(p.catalog.base)} — JAPAN</span>
        </a>
        <div class="rc-body">
          <p class="rc-cat"><b>${bpNo(p)}</b>${esc(p.catalog.category)}</p>
          <h3 class="rc-name"><a href="${routes.top(p.slug)}">${esc(p.company.name)}</a></h3>
          <p class="rc-catch">${jp(p.catalog.catch)}</p>
          <p class="rc-lead">${jp(p.catalog.lead)}</p>
          <dl class="rc-spec">
            <div><dt>BASE</dt><dd>${esc(p.catalog.base)}</dd></div>
            ${p.catalog.service ? `<div><dt>SERVICE</dt><dd>${esc(p.catalog.service)}</dd></div>` : ''}
            <div><dt>SERIES</dt><dd>BATON PARTNERS</dd></div>
          </dl>
          <a class="rc-go" href="${routes.top(p.slug)}">${esc(shortName(p))}を見る<span class="arrow" aria-hidden="true">→</span></a>
          <ul class="rc-links">
            <li><a href="${routes.about(p.slug)}">取り組み</a></li>
            <li><a href="${routes.service(p.slug)}">${esc(p.service.name)}</a></li>
            <li><a href="${routes.insight(p.slug, p.insight.slug)}">記事</a></li>
            <li><a href="${routes.contact(p.slug)}">話してみる</a></li>
          </ul>
        </div>
      </li>`,
    )
    .join('');
  const body = `
${bpHeader(list, 'index')}
<main id="main" class="bpx">
  <section class="bpx-hero">
    <p class="bpx-ghost" aria-hidden="true">PARTNERS</p>
    ${disc('bpx-disc')}
    <div class="wrap bpx-hero-in">
      <nav class="bpx-crumb" aria-label="パンくずリスト"><ol><li><a href="${site.operator.url}">Music Japan</a></li><li><span aria-current="page">Baton Partners</span></li></ol></nav>
      <p class="bpx-kicker">BATON PARTNERS / CONNECTIONS</p>
      <h1 class="bpx-h1">パートナー</h1>
      <p class="bpx-sub">${jp('事業の強みを知り、次のつながりへ。')}</p>
      <p class="bpx-count"><strong>${count}</strong><span>社 — BATON PARTNERS / MUSIC JAPAN</span></p>
      <a class="bpx-origin" href="${routes.top(operatorPartner.slug)}">
        <b>${bpNo(operatorPartner)}</b>
        <span class="bpx-origin-t">Baton Partnersとは</span>
        <span class="bpx-origin-s">${esc(`運営：${operatorPartner.company.name}　専用LP × SEO × AIO × 紹介`)}</span>
        <span class="arrow" aria-hidden="true">→</span>
      </a>
    </div>
  </section>
  <div class="bpx-logos" aria-hidden="true"><div class="bpx-logos-track">${logoRun}${logoRun}</div></div>
  <section id="catalog" class="bpx-cat" aria-labelledby="cat-h">
    <div class="wrap">
      <p class="bpx-sec-k"><i>01</i>CATALOG — BATON PARTNERS</p>
      <h2 id="cat-h" class="bpx-h2">${heading(['一社ずつ、', '盤に刻むように。'])}</h2>
      <p class="bpx-lead">${jp('一社ずつ、レコードのように番号をつけて並べています。それぞれの事業とサービスは、各社のページで詳しくご覧いただけます。')}</p>
      <ol class="rcs">${cards}</ol>
    </div>
  </section>
  <section class="bpx-band" aria-labelledby="band-h">
    <div class="wrap bpx-band-in">
      <p class="bpx-sec-k">CONTACT / COLLABORATE</p>
      <h2 id="band-h" class="bpx-h2">${heading(['次の音を、', '一緒につくろう。'])}</h2>
      <p class="bpx-lead">${jp('パートナー企業とのおつなぎや、Baton Partnersへの掲載、協業のご相談はこちらから。内容を確認後、担当よりご連絡します。')}</p>
      <a class="bpx-btn" href="https://music-japan.com/contact/">話を始める<span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </section>
</main>
${footer()}`;
  return document(
    {
      kind: 'index',
      path: '/',
      title: INDEX_TITLE,
      description:
        '合同会社Music Japanのパートナー企業。福岡で人材紹介会社向けCRM・MA「Empro」を提供するエボルグ、名古屋でAI研修と開発を手がけるCentral AX。各社の事業とサービスを、一社ずつ専用のページで紹介しています。',
      og: '/og/site.png',
      jsonLd: [
        pageLd(env, {
          type: 'CollectionPage',
          path: '/',
          name: INDEX_TITLE,
          description: SITE_ANSWER.a,
          image: '/og/site.png',
          dateModified: site.updated,
        }),
        {
          '@type': 'ItemList',
          '@id': `${env.siteUrl}/#partners`,
          name: 'Music Japan のパートナー企業',
          itemListElement: list.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${env.siteUrl}${routes.top(p.slug)}`,
            name: p.company.name,
          })),
        },
        ...list.flatMap((p) => orgLd(env, p)),
      ],
    },
    env,
    body,
  );
}

/** Baton Partners 編集部：運営者と編集方針。記事の著者情報の参照先（E-E-A-T） */
export function renderEditorial(list: Partner[], env: BuildEnv): string {
  const path = routes.editorial();
  const policy = [
    '事実は、掲載企業の公式サイト、プレスリリース、公開されている導入事例から書きます。記事の最後には出典を載せています。',
    '公式に書かれていない話（商談で伺った内容など）は、「〜そうです」と書き分けます。',
    '料金や契約条件は載せません。条件は変わることがあるので、必ず企業に直接確かめてほしいからです。',
    '記事には公開日と更新日を載せます。内容を大きく直したときは、更新日を改めます。',
    '誤りに気づいたら、下の連絡先からお知らせください。確かめたうえで、すぐに直します。',
  ];
  const partners = list
    .map((p) => `<li><a href="${routes.top(p.slug)}">${esc(p.company.name)}（${esc(p.service.name)}）</a></li>`)
    .join('');
  const answer = {
    q: 'このサイトは、誰が書いていますか？',
    a: `合同会社Music Japan の Baton Partners 編集部です。掲載企業の公式サイトや公開資料をもとに書き、出典を記事に載せています。運営会社の代表は${site.operator.representative.replace('代表社員 ', '')}さんです。`,
  };
  const body = `
${bpHeader(list, 'editorial')}
<main id="main" class="pv-main">
  <div class="wrap pv">
    ${breadcrumb([{ name: 'Baton Partners 編集部' }])}
    <h1 class="pv-h1">Baton Partners 編集部について</h1>
    <p>${jp('Baton Partnersは、合同会社Music Japanのパートナー企業を紹介するページです。編集部は、各社のページと記事の制作を担当しています。')}</p>
  </div>
  ${answerBox(answer, 'editorial-answer')}
  <div class="wrap pv">
    <section class="pv-sec">
      <h2 class="pv-h">運営者</h2>
      <dl class="prof">
        <div class="prof-row"><dt>運営会社</dt><dd><a href="${site.operator.url}" target="_blank" rel="noopener">${esc(site.operator.name)}</a></dd></div>
        <div class="prof-row"><dt>代表</dt><dd>${esc(site.operator.representative)}</dd></div>
        <div class="prof-row"><dt>所在地</dt><dd>${esc(site.operator.address)}</dd></div>
        <div class="prof-row"><dt>連絡先</dt><dd>${esc(site.operator.email)}</dd></div>
      </dl>
    </section>
    <section class="pv-sec">
      <h2 class="pv-h">編集の方針</h2>
      <ul>${policy.map((t) => `<li>${jp(t)}</li>`).join('')}</ul>
    </section>
    <section class="pv-sec">
      <h2 class="pv-h">紹介の進め方</h2>
      <p>${jp('話してみたい会社があれば、各社の「話してみる」ページから、公式LINEの追加とアンケートへの回答をお願いしています。Music Japanが内容を確かめ、ご相談の概要を先方に共有したうえで、双方の了承がそろったらLINEグループでおつなぎします。お名前や連絡先が先方に伝わるのは、その時点です。')}</p>
    </section>
    <section class="pv-sec">
      <h2 class="pv-h">Baton Partnersについて</h2>
      <p>${jp(`Baton Partnersのサービス内容と、運営会社・代表者については、[Baton Partnersとは](${routes.top(operatorPartner.slug)})のページにまとめています。`)}</p>
    </section>
    <section class="pv-sec">
      <h2 class="pv-h">パートナー企業</h2>
      <ul>${partners}</ul>
    </section>
  </div>
</main>
${footer()}`;
  return document(
    {
      kind: 'editorial',
      path,
      title: 'Baton Partners 編集部について｜運営者と編集方針',
      description: '合同会社Music Japanが運営するBaton Partners編集部の紹介です。掲載企業のページは公式サイトや公開資料をもとに書き、出典・公開日・更新日を載せています。編集の方針と運営者の情報をまとめました。',
      og: '/og/site.png',
      jsonLd: [
        pageLd(env, {
          type: 'AboutPage',
          path,
          name: 'Baton Partners 編集部について',
          description: answer.a,
          image: '/og/site.png',
          dateModified: site.updated,
          mainEntity: ids.editorial(env),
        }),
        breadcrumbLd(env, path, [{ name: 'Baton Partners 編集部', href: path }]),
      ],
    },
    env,
    body,
  );
}

/** 404。トップへまとめて転送せず、行き先を示す（soft 404 を避ける） */
export function renderNotFound(list: Partner[], env: BuildEnv): string {
  const links = list
    .map(
      (p) => `
      <li><a href="${routes.top(p.slug)}">${esc(p.company.name)}（${esc(p.service.name)}）</a></li>
      <li><a href="${routes.contact(p.slug)}">${esc(shortName(p))}と話してみる</a></li>`,
    )
    .join('');
  const body = `
${bpHeader(list)}
<main id="main" class="pv-main">
  <div class="wrap pv">
    <h1 class="pv-h1">ページが見つかりませんでした</h1>
    <p>${jp('URLが変わったか、ページが削除された可能性があります。お探しの内容に近いページを、下から選んでください。')}</p>
    <section class="pv-sec">
      <h2 class="pv-h">パートナー企業</h2>
      <ul><li><a href="/">パートナー企業の一覧</a></li>${links}</ul>
    </section>
  </div>
</main>
${footer()}`;
  return document(
    {
      kind: 'notfound',
      path: '/404.html',
      title: 'ページが見つかりません - Baton Partners',
      description: 'お探しのページは見つかりませんでした。パートナー企業の一覧からお探しください。',
      og: '/og/site.png',
      noindex: true,
    },
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
  {
    h: '7. Cookie・アクセス解析について',
    body: [
      '本サイトはGoogle LLCのGoogle アナリティクス 4を利用し、閲覧ページ、アクセス日時、端末・ブラウザ情報等をCookieとともに取得して、サイトと企業ページの閲覧数の把握と改善に使用します。フォームの氏名・連絡先・回答内容はアクセス解析に送信しません。URLのクエリ文字列・フラグメントは計測対象から除き、広告パーソナライズは無効にしています。',
      'Googleの情報利用について：https://policies.google.com/technologies/partner-sites?hl=ja',
      'Google アナリティクス オプトアウト アドオン：https://tools.google.com/dlpage/gaoptout?hl=ja',
      '改定日：2026年10月3日',
    ],
  },
];

export function renderPrivacy(env: BuildEnv): string {
  const blocks = PRIVACY.map(
    (b) => `
    <section class="pv-sec">
      <h2 class="pv-h">${esc(b.h)}</h2>
      ${b.body.map((t) => `<p>${t.includes('https://policies.google.com/') || t.includes('https://tools.google.com/') ? esc(t).replace(/https:\/\/(?:policies\.google\.com\/technologies\/partner-sites|tools\.google\.com\/dlpage\/gaoptout)\?hl=ja/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`) : jp(t)}</p>`).join('')}
      ${b.list ? `<ul>${b.list.map((t) => `<li>${jp(t)}</li>`).join('')}</ul>` : ''}
    </section>`,
  ).join('');
  const body = `
${bpHeader(partners)}
<main id="main" class="pv-main">
  <div class="wrap pv">
    ${breadcrumb([{ name: 'プライバシーポリシー' }])}
    <h1 class="pv-h1">プライバシーポリシー</h1>
    <p>${jp(`${site.operator.name}（以下「当社」）は、パートナー企業のページ（Baton Partners）の運営にあたり、お客様の個人情報を次のとおり取り扱います。`)}</p>
    ${blocks}
  </div>
</main>
${footer()}`;
  return document(
    {
      kind: 'privacy',
      path: routes.privacy(),
      title: `プライバシーポリシー - ${site.name}`,
      description: `${site.operator.name}が運営するBaton Partnersのプライバシーポリシーです。アンケートで取得する情報、利用目的、掲載企業への提供の範囲、保管の方法を定めています。`,
      og: '/og/site.png',
      jsonLd: [
        pageLd(env, {
          path: routes.privacy(),
          name: `プライバシーポリシー - ${site.name}`,
          description: 'Baton Partnersのプライバシーポリシー',
          image: '/og/site.png',
          dateModified: site.updated,
        }),
        breadcrumbLd(env, routes.privacy(), [{ name: 'プライバシーポリシー', href: routes.privacy() }]),
      ],
    },
    env,
    body,
  );
}
