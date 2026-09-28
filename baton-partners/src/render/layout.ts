import { routes, site } from '../config/site';
import type { Partner } from '../types';
import { esc, jp } from './text';

export type PageKind = 'top' | 'about' | 'insight' | 'service' | 'contact' | 'privacy' | 'index';

export type PageMeta = {
  kind: PageKind;
  path: string;
  title: string;
  description: string;
  partner?: Partner;
  jsonLd?: Record<string, unknown>[];
  ogType?: 'website' | 'article';
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
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Noto+Sans+JP:wght@400;700&family=Shippori+Mincho:wght@700;800&display=swap';

/** 「株式会社エボルグ」→「エボルグ」 */
export const shortName = (p: Partner): string =>
  p.company.name.replace(/^(株式会社|合同会社|有限会社)|(株式会社|合同会社|有限会社)$/g, '');

const abs = (env: BuildEnv, path: string) => `${env.siteUrl}${path}`;

export function head(meta: PageMeta, env: BuildEnv): string {
  const p = meta.partner;
  const canonical = abs(env, meta.path);
  const ld = meta.jsonLd?.length
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': meta.jsonLd,
      }).replace(/</g, '\\u003c')}</script>`
    : '';
  return `
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}" />
${env.noindex ? '<meta name="robots" content="noindex, nofollow, noarchive" />' : ''}
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
${env.googleFonts ? `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${GOOGLE_FONTS}" media="print" onload="this.media='all'" />` : ''}
<meta name="theme-color" content="${site.colors.paper}" />
<meta name="format-detection" content="telephone=no" />
<meta property="og:type" content="${meta.ogType ?? 'website'}" />
<meta property="og:site_name" content="${site.name}" />
<meta property="og:title" content="${esc(meta.title)}" />
<meta property="og:description" content="${esc(meta.description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:locale" content="ja_JP" />
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
    { kind: 'contact' as PageKind, en: 'Contact', ja: 'お問い合わせ' },
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
      <span class="brand-bp"><em>Baton</em> Partners</span>
    </a>
    <nav class="nav" aria-label="メインメニュー"><ul>${items}</ul></nav>
    <a class="btn btn-cta hdr-cta" href="${routes.contact(p.slug)}"${current === 'contact' ? ' aria-current="page"' : ''}>相談する</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" data-menu-btn>
      <span class="menu-lines" aria-hidden="true"><i></i><i></i></span><span class="menu-label">Menu</span>
    </button>
  </div>
</header>
<div class="menu" id="menu" data-menu hidden>
  <div class="menu-in">
    <p class="menu-kicker">Baton Partners — No.${p.no}</p>
    <ul class="menu-list">${menuItems}</ul>
    <a class="btn btn-cta btn-lg menu-cta" href="${routes.contact(p.slug)}">${esc(shortName(p))}に相談する</a>
  </div>
</div>`.trim();
}

export function ctaBand(p: Partner): string {
  return `
<section class="cta-band" aria-labelledby="cta-band-h">
  <div class="wrap cta-band-in">
    <p class="kicker kicker-light">Contact</p>
    <h2 id="cta-band-h" class="cta-band-h">${jp(`${shortName(p)}に、相談してみる。`)}</h2>
    <p class="cta-band-p">${jp(`予約カレンダーはありません。Music Japanがご相談内容を確認し、双方の了承を得てからLINEでおつなぎします。`)}</p>
    <a class="btn btn-cta btn-lg" href="${routes.contact(p.slug)}"><span>相談の流れを見る</span><span class="arrow" aria-hidden="true">→</span></a>
  </div>
</section>`.trim();
}

export function footer(p?: Partner): string {
  const partnerLinks = p
    ? `<ul class="ftr-links">
        <li><a href="${routes.top(p.slug)}">トップ</a></li>
        <li><a href="${routes.about(p.slug)}">取り組み</a></li>
        <li><a href="${routes.insight(p.slug, p.insight.slug)}">記事</a></li>
        <li><a href="${routes.service(p.slug)}">${esc(p.service.name)}</a></li>
        <li><a href="${routes.contact(p.slug)}">お問い合わせ</a></li>
      </ul>`
    : '';
  const about = p
    ? `このページは、Baton Partners（運営：${site.operator.name}）が、${p.company.name}のご紹介を目的として制作・運営しています。`
    : `Baton Partnersは、${site.operator.name}が運営する法人向けのパートナープログラムです。`;
  return `
<footer class="ftr">
  <div class="wrap ftr-in">
    <div class="ftr-brand">
      <p class="ftr-mark"><em>Baton</em> Partners</p>
      <p class="ftr-about">${jp(about)}</p>
    </div>
    ${partnerLinks}
    <div class="ftr-meta">
      <p>運営：<a href="${site.operator.url}" target="_blank" rel="noopener">${site.operator.name}</a></p>
      <p><a href="${routes.privacy()}">プライバシーポリシー</a></p>
      <p class="ftr-copy">© ${new Date().getFullYear()} ${site.operator.nameEn}</p>
    </div>
  </div>
</footer>`.trim();
}

export function breadcrumb(items: { name: string; href?: string }[]): string {
  return `<nav class="crumb" aria-label="パンくずリスト"><ol>${items
    .map((it) =>
      it.href
        ? `<li><a href="${it.href}">${esc(it.name)}</a></li>`
        : `<li><span aria-current="page">${esc(it.name)}</span></li>`,
    )
    .join('')}</ol></nav>`;
}

export function breadcrumbLd(env: BuildEnv, items: { name: string; href: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(env, it.href),
    })),
  };
}

export function orgLd(env: BuildEnv, p: Partner) {
  return [
    {
      '@type': 'Organization',
      '@id': `${abs(env, routes.top(p.slug))}#org`,
      name: p.company.name,
      url: p.company.url,
    },
    {
      '@type': 'Organization',
      '@id': `${env.siteUrl}/#operator`,
      name: site.operator.name,
      url: site.operator.url,
    },
  ];
}

export function document(meta: PageMeta, env: BuildEnv, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
${head(meta, env)}
</head>
<body data-page="${meta.kind}"${meta.partner ? ` data-partner="${meta.partner.slug}"` : ''}>
${body}
<script type="module" src="/src/client/main.ts"></script>
</body>
</html>
`;
}
