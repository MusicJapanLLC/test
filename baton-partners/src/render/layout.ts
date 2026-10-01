import { routes, site } from '../config/site';
import { bpLogo } from './logo';
import type { Partner } from '../types';
import { abs, siteLd } from './seo';
import { esc, heading, jp } from './text';

export type PageKind = 'top' | 'about' | 'insight' | 'service' | 'contact' | 'privacy' | 'index' | 'editorial' | 'notfound';

export type PageMeta = {
  kind: PageKind;
  path: string;
  title: string;
  description: string;
  partner?: Partner;
  jsonLd?: Record<string, unknown>[];
  ogType?: 'website' | 'article';
  /** SNS・AIの引用で使う画像（/og/<key>.png、1200×630） */
  og: string;
  /** 画像の説明（og:image:alt） */
  ogAlt?: string;
  /** 404 など、検索に出さないページ */
  noindex?: boolean;
};

export type BuildEnv = {
  siteUrl: string;
  /** true の間は noindex。公開するときに BP_INDEX=1 でビルドする */
  noindex: boolean;
  /**
   * true のときは Web フォントを Google Fonts から読み込む（BP_FONTS=google）。
   * ファイルを直接アップロードしてデプロイするとき、フォントファイル数百個を送らずに済ませるため。
   */
  googleFonts: boolean;
};

const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Archivo:wdth,wght@62..125,100..900&family=Zen+Kaku+Gothic+New:wght@400;700;900&family=Zen+Old+Mincho:wght@700;900&display=swap';

/** 掲載番号。music-japan.com/partners と同じ「BP-001」 */
export const bpNo = (p: Partner): string => `BP-${p.no.padStart(3, '0')}`;

/** 「株式会社エボルグ」→「エボルグ」 */
export const shortName = (p: Partner): string =>
  p.company.name.replace(/^(株式会社|合同会社|有限会社)|(株式会社|合同会社|有限会社)$/g, '');

export function head(meta: PageMeta, env: BuildEnv): string {
  const p = meta.partner;
  const canonical = abs(env, meta.path);
  const graph = [...siteLd(env), ...(meta.jsonLd ?? [])];
  const ld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph,
  }).replace(/</g, '\\u003c')}</script>`;
  const noindex = env.noindex || meta.noindex;
  const ogImage = abs(env, meta.og);
  return `
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}" />
${noindex ? '<meta name="robots" content="noindex, nofollow, noarchive" />' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />'}
${meta.noindex ? '' : `<link rel="canonical" href="${canonical}" />`}
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
${env.googleFonts ? `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${GOOGLE_FONTS}" media="print" onload="this.media='all'" />` : ''}
<meta name="theme-color" content="${site.colors.paper}" />
<meta name="format-detection" content="telephone=no" />
<meta property="og:type" content="${meta.ogType ?? 'website'}" />
<meta property="og:site_name" content="${site.name}" />
<meta property="og:title" content="${esc(meta.title)}" />
<meta property="og:description" content="${esc(meta.description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:locale" content="ja_JP" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(meta.ogAlt ?? meta.title)}" />
<meta name="twitter:card" content="summary_large_image" />
${p ? `<style>html:root{--brand:${p.brand.primary};--brand-2:${p.brand.accent};--scene-a:${p.brand.scene.a};--scene-b:${p.brand.scene.b};--scene-match:${p.brand.scene.match}}</style>` : ''}
${ld}`.trim();
}

const NAV: { kind: PageKind; en: string; ja: string }[] = [
  { kind: 'about', en: 'About', ja: '取り組み' },
  { kind: 'insight', en: 'Insights', ja: '記事' },
  { kind: 'service', en: 'Service', ja: 'サービス' },
];

function navHref(p: Partner, kind: PageKind): string {
  switch (kind) {
    case 'about':
      return routes.about(p.slug);
    case 'insight':
      return routes.insight(p.slug, p.insight.slug);
    case 'service':
      return routes.service(p.slug);
    case 'contact':
      return routes.contact(p.slug);
    default:
      return routes.top(p.slug);
  }
}

export function header(p: Partner, current: PageKind): string {
  const items = NAV.map((n, i) => {
    const on = n.kind === current ? ' aria-current="page"' : '';
    return `<li><a href="${navHref(p, n.kind)}"${on}><span class="nav-no">0${i + 1}</span><span class="nav-en">${n.en}</span><span class="nav-ja">${n.ja}</span></a></li>`;
  }).join('');
  const menuItems = [
    { kind: 'top' as PageKind, en: 'Top', ja: 'トップ' },
    ...NAV,
    { kind: 'contact' as PageKind, en: 'Talk', ja: '話してみる' },
  ]
    .map(
      (n, i) =>
        `<li><a href="${navHref(p, n.kind)}"${n.kind === current ? ' aria-current="page"' : ''}><span class="m-no">0${i}</span><span class="m-en">${n.en}</span><span class="m-ja">${n.ja}</span></a></li>`,
    )
    .join('');

  return `
<a class="skip" href="#main">本文へ移動</a>
<header class="hdr" data-hdr>
  <div class="hdr-in">
    <a class="brand" href="${routes.top(p.slug)}" aria-label="${esc(p.company.name)} トップへ">
      <img class="brand-logo" src="${p.brand.logo}" alt="${esc(p.brand.logoAlt)}" width="${p.brand.logoSize[0]}" height="${p.brand.logoSize[1]}" />
      <span class="brand-sep" aria-hidden="true"></span>
      ${bpLogo({ size: 26, className: "brand-bp" })}
    </a>
    <nav class="nav" aria-label="メインメニュー"><ul>${items}</ul></nav>
    <a class="btn btn-cta hdr-cta" href="${routes.contact(p.slug)}"${current === 'contact' ? ' aria-current="page"' : ''} data-cursor="Talk"><span>話してみる</span><span class="arrow" aria-hidden="true">→</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" data-menu-btn>
      <span class="menu-lines" aria-hidden="true"><i></i><i></i></span><span class="menu-label">Menu</span>
    </button>
  </div>
</header>
<div class="menu" id="menu" data-menu hidden>
  <div class="menu-in">
    <p class="menu-kicker">Music Japan Partners — ${bpNo(p)}</p>
    <ul class="menu-list">${menuItems}</ul>
    <a class="btn btn-cta btn-lg menu-cta" href="${routes.contact(p.slug)}">${esc(shortName(p))}と、話してみる</a>
  </div>
</div>`.trim();
}

export function ctaBand(p: Partner): string {
  return `
<section class="cta-band" aria-labelledby="cta-band-h">
  <div class="scene scene-aurora" data-scene="aurora" data-count="0" aria-hidden="true"><canvas></canvas></div>
  <div class="wrap cta-band-in">
    <p class="kicker kicker-light">Talk</p>
    <h2 id="cta-band-h" class="cta-band-h">${heading([`${shortName(p)}と、`, 'まずは話してみる。'])}</h2>
    <p class="cta-band-p">${jp(`予約カレンダーはありません。Music Japanがご相談内容を確認し、双方の了承を得てからLINEでおつなぎします。`)}</p>
    <a class="btn btn-cta btn-lg" href="${routes.contact(p.slug)}"><span>話してみる</span><span class="arrow" aria-hidden="true">→</span></a>
  </div>
</section>`.trim();
}

/**
 * Baton Partners のヘッダー（一覧・編集部・プライバシー・404）。
 * 本体サイトのヘッダーは使わない。ここは「Baton Partners」というブランドの入口なので、ロゴとパートナー企業だけを並べる。
 */
export function bpHeader(list: Partner[], current: 'index' | 'editorial' | 'other' = 'other'): string {
  const items = [
    { no: '01', label: 'パートナー', href: '/#catalog', on: current === 'index' },
    ...list.map((p) => ({ no: bpNo(p), label: shortName(p), href: routes.top(p.slug), on: false })),
    { no: String(list.length + 2).padStart(2, '0'), label: '編集部', href: routes.editorial(), on: current === 'editorial' },
  ];
  return `
<a class="skip" href="#main">本文へ移動</a>
<header class="bph" data-hdr>
  <div class="bph-in">
    <a class="bph-brand" href="/" aria-label="Baton Partners トップへ">${bpLogo({ size: 30, tone: 'paper', animated: true })}</a>
    <nav class="bph-nav" aria-label="Baton Partners のメニュー">
      <ul>${items.map((n) => `<li><a href="${n.href}"${n.on ? ' aria-current="page"' : ''}><i>${n.no}</i>${esc(n.label)}</a></li>`).join('')}</ul>
    </nav>
    <a class="bph-mj" href="${site.operator.url}" aria-label="運営：合同会社Music Japan">MJ</a>
  </div>
</header>`.trim();
}

/** 本体サイトと同じフッター。各社のページでも共通にして、Music Japan のパートナーであることを示す */
export function footer(p?: Partner): string {
  const partnerLinks = p
    ? `<div class="ftr-col">
        <p class="ftr-k">${esc(p.company.name)}｜${bpNo(p)}</p>
        <ul class="ftr-links">
          <li><a href="${routes.top(p.slug)}">トップ</a></li>
          <li><a href="${routes.about(p.slug)}">取り組み</a></li>
          <li><a href="${routes.service(p.slug)}">${esc(p.service.name)}</a></li>
          <li><a href="${routes.insight(p.slug, p.insight.slug)}">記事</a></li>
          <li><a href="${routes.contact(p.slug)}">話してみる</a></li>
        </ul>
      </div>`
    : '';
  const run = Array.from({ length: 4 }, () => '<span>MUSIC. STORIES. CONNECTIONS. FROM JAPAN.</span>').join('');
  return `
<footer class="ftr">
  <div class="ftr-mq" aria-hidden="true"><div class="ftr-mq-track">${run}${run}</div></div>
  <div class="wrap ftr-in">
    <div class="ftr-brand">
      <a class="ftr-bp" href="/" aria-label="Baton Partners トップへ">${bpLogo({ size: 34, tone: 'paper' })}</a>
      <p class="ftr-op">運営　<a href="${site.operator.url}">${esc(site.operator.name)}</a></p>
      <p class="ftr-addr">${esc(site.operator.address).replace(' ', '<br />')}</p>
      <p><a href="mailto:${site.operator.email}">${site.operator.email}</a></p>
      ${p ? `<p class="ftr-about">${jp(`${p.company.name}は、合同会社Music Japanのパートナー企業です。このページは Music Japan が制作・運営し、掲載内容は${shortName(p)}の公式情報をもとにしています。`)}</p>` : ''}
    </div>
    ${partnerLinks}
    <div class="ftr-col">
      <p class="ftr-k">Music Japan</p>
      <ul class="ftr-links">
        <li><a href="${site.operator.url}">トップ</a></li>
        ${site.mainNav.map((n) => `<li><a href="${n.url}">${esc(n.label)}</a></li>`).join('')}
      </ul>
    </div>
    <div class="ftr-col">
      <p class="ftr-k">Partners</p>
      <ul class="ftr-links">
        <li><a href="/">パートナー企業の一覧</a></li>
        <li><a href="${routes.editorial()}">編集部について</a></li>
        <li><a href="${routes.privacy()}">プライバシーポリシー</a></li>
      </ul>
      <p class="ftr-k ftr-k-follow">Follow</p>
      <ul class="ftr-social">${site.social.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`).join('')}</ul>
    </div>
  </div>
  <p class="wrap ftr-copy">© ${new Date().getFullYear()} ${site.operator.nameEn}</p>
</footer>`.trim();
}

/** 画面のパンくず。先頭は必ず Baton Partners（/）。構造化データ（seo.ts の breadcrumbLd）と同じ並び */
export function breadcrumb(items: { name: string; href?: string }[]): string {
  const all = [{ name: site.hubName, href: '/' }, ...items];
  return `<nav class="crumb" aria-label="パンくずリスト"><ol>${all
    .map((it) =>
      it.href
        ? `<li><a href="${it.href}">${esc(it.name)}</a></li>`
        : `<li><span aria-current="page">${esc(it.name)}</span></li>`,
    )
    .join('')}</ol></nav>`;
}

export function document(meta: PageMeta, env: BuildEnv, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
${head(meta, env)}
</head>
<body data-page="${meta.kind}"${meta.partner ? ` data-partner="${meta.partner.slug}" data-theme="${meta.partner.world.theme}" data-world-scene="${meta.partner.world.scene}"` : ''}>
<div class="progress" aria-hidden="true"><i data-scroll-progress></i></div>
<div class="curtain" data-curtain aria-hidden="true">
  <div class="curtain-in">${meta.partner ? `<img src="${meta.partner.brand.logo}" alt="" width="${meta.partner.brand.logoSize[0]}" height="${meta.partner.brand.logoSize[1]}" />` : ''}${bpLogo({ size: 30, animated: true, className: "curtain-bp" })}<span class="curtain-line"><i></i></span></div>
</div>
<div class="cursor" data-cursor-el aria-hidden="true"><span class="cursor-dot"></span><span class="cursor-ring"><span class="cursor-label" data-cursor-label></span></span></div>
${body}
<script type="module" src="/src/client/main.ts"></script>
</body>
</html>
`;
}
