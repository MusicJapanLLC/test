import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as esbuild } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';
import { profiles } from './src/data/profiles';
import { services } from './src/data/services';
import { site } from './src/data/site';
import {
  hubHeroHtml,
  profileHeroHtml,
  profileHubHeroHtml,
  serviceHeroHtml,
} from './src/lib/hero';
import {
  faqPageStructuredData,
  profileHubStructuredData,
  profileStructuredData,
  serviceHubStructuredData,
  serviceStructuredData,
  type JsonLd,
} from './src/lib/seo';
import { llmsFullTxt, llmsTxt, profileMarkdown } from './src/lib/ai-text';
import { profileDescription, profileTitle } from './src/lib/profile-facts';
import type { Service, TalkProfile } from './src/types';

const root = process.cwd();

/** サブパス配信するときだけ設定する。例: GitHub Pages なら /test/ */
const base = process.env.VITE_BASE ?? '/';

/**
 * 法人向けサービス + ハブ + プライバシーポリシー
 * + Baton Introduction System（プロフィール一覧 + 各プロフィール + 認証/承認・辞退ページ）
 */
const pages = {
  main: resolve(root, 'index.html'),
  hub: resolve(root, 'hub', 'index.html'),
  ...Object.fromEntries(
    services.map((s) => [s.id, resolve(root, s.slug, 'index.html')]),
  ),
  privacy: resolve(root, 'privacy', 'index.html'),
  faq: resolve(root, 'faq', 'index.html'),
  'profile-hub': resolve(root, 'profile', 'index.html'),
  ...Object.fromEntries(
    profiles.map((p) => [`profile-${p.id}`, resolve(root, 'profile', p.slug, 'index.html')]),
  ),
  verify: resolve(root, 'verify', 'index.html'),
  respond: resolve(root, 'respond', 'index.html'),
};

/**
 * トップページ（/）に出すプロフィール。
 * 法人向けサービスハブはトップから外し、`/hub/` に置く。
 */
const homeProfile: TalkProfile | null = profiles.find((p) => p.slug === 'kabeya') ?? profiles[0] ?? null;

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

/** プロフィールページの見出し専用。他ページには読み込まない */
const PROFILE_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700' +
  '&family=Jost:ital,wght@0,300;1,300&display=swap';

const PRODUCTION_SITE_URL = 'https://baton.music-japan.com';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL?.trim();
  return (explicit || PRODUCTION_SITE_URL).replace(/\/$/, '');
}

/**
 * canonical / schema / sitemap は必ず公開中の独自ドメインを指す。
 * Vercel / GitHub Pages 等のプレビューURLへ検索評価を分散させない。
 */
function absoluteUrl(path: string): string {
  const cleanPath = `/${path.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  return `${siteUrl()}${cleanPath}`;
}

function jsonLdHtml(items: JsonLd[] | undefined): string {
  if (!items?.length) return '';
  return items
    .map(
      (item) =>
        `<script type="application/ld+json">${JSON.stringify(item).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');
}

function head(opts: {
  title: string;
  description: string;
  themeColor: string;
  path: string;
  vars: string;
  canonicalPath?: string;
  ogType?: 'website' | 'profile';
  jsonLd?: JsonLd[];
  /** プロフィールページだけ、見出し用の明朝体をもう1本読み込む */
  extraFontHref?: string;
  /** SNS・検索のプレビュー画像（絶対URL, 1200x630） */
  ogImage?: string;
  /** 同じ内容のMarkdown版（AI向け）。/llms.txt の提案に沿って置く */
  markdownPath?: string;
  /** メール認証など、検索結果に出さないページ */
  noindex?: boolean;
}) {
  const extraFont = opts.extraFontHref
    ? `
    <link rel="preload" as="style" href="${opts.extraFontHref}" />
    <link rel="stylesheet" href="${opts.extraFontHref}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="${opts.extraFontHref}" /></noscript>`
    : '';
  const canonical = absoluteUrl(opts.canonicalPath ?? opts.path);
  const structuredData = jsonLdHtml(opts.jsonLd);

  return `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <!--
      フォントのCSSは描画を止めない形で読む。
      素の状態でまず本文が出て、あとから Zen Kaku Gothic New に差し替わる。
      普通に stylesheet で読むと、ここでLCPが0.7秒ほど遅れる。
    -->
    <link rel="preload" as="style" href="${FONT_HREF}" />
    <link rel="stylesheet" href="${FONT_HREF}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="${FONT_HREF}" /></noscript>${extraFont}
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="${opts.themeColor}" />
    <meta property="og:type" content="${opts.ogType ?? 'website'}" />
    <meta property="og:site_name" content="${esc(site.nameJa)}" />
    <meta property="og:title" content="${esc(opts.title)}" />
    <meta property="og:description" content="${esc(opts.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:locale" content="ja_JP" />${
      opts.ogImage
        ? `
    <meta property="og:image" content="${opts.ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${opts.ogImage}" />`
        : ''
    }
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(opts.title)}" />
    <meta name="twitter:description" content="${esc(opts.description)}" />
    <meta name="robots" content="${
      opts.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    }" />
    <meta name="author" content="${esc(site.operator.name)}" />${
      opts.markdownPath
        ? `
    <link rel="alternate" type="text/markdown" href="${absoluteUrl(opts.markdownPath)}" title="Markdown版" />`
        : ''
    }
    ${structuredData}
    <style>:root{${opts.vars}}</style>`.trim();
}

/**
 * AI検索（回答で引用する）クローラー。JavaScriptを実行しないものが多いので、
 * 本文は静的HTMLに焼き込んである。ここでは robots.txt で明示的に許可する。
 * 学習用（GPTBot / Google-Extended / Applebot-Extended / CCBot）も、
 * AIに Baton と掲載者を「知ってもらう」ために許可している。止めたいときはここから外す。
 */
const AI_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bingbot',
  'Googlebot',
];

/** 検索結果に出す必要のない、メール認証・承認用のページ */
const PRIVATE_PATHS = ['/verify/', '/respond/'];

/** robots.txt・sitemap.xml・llms.txt・各プロフィールの index.md をビルド時に生成する */
function batonSeoFiles(): Plugin {
  return {
    name: 'baton-seo-files',
    apply: 'build',
    generateBundle() {
      const siteBase = siteUrl();
      const active = profiles.filter((p) => p.active);
      const latest = active
        .map((p) => p.updatedAt)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);

      const group = (agent: string) =>
        [`User-agent: ${agent}`, 'Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`)].join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source:
          [group('*'), ...AI_CRAWLERS.map(group)].join('\n\n') +
          `\n\n# AI向けの要約: ${siteBase}/llms.txt\nSitemap: ${siteBase}/sitemap.xml\n`,
      });

      type Entry = { path: string; lastmod?: string; image?: string };
      const entries: Entry[] = [
        { path: 'profile/', lastmod: latest, image: `${siteBase}/og/baton.jpg` },
        ...active.map((p) => ({
          path: `profile/${p.slug}/`,
          lastmod: p.updatedAt,
          image: p.photo ? `${siteBase}${p.photo.src}` : undefined,
        })),
        { path: 'faq/', lastmod: latest },
        { path: 'hub/' },
        ...services.map((s) => ({ path: `${s.slug}/` })),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
          entries
            .map(
              (e) =>
                `  <url><loc>${siteBase}/${e.path}</loc>` +
                (e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '') +
                (e.image ? `<image:image><image:loc>${e.image}</image:loc></image:image>` : '') +
                '</url>',
            )
            .join('\n') +
          '\n</urlset>\n',
      });

      const url = (path: string) => absoluteUrl(path);
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(profiles, url) });
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFullTxt(profiles, url) });
      active.forEach((p) =>
        this.emitFile({ type: 'asset', fileName: `profile/${p.slug}/index.md`, source: profileMarkdown(p, url) }),
      );
    },
  };
}

type StaticHtml = { profiles: Record<string, string>; hub: string; faq: string; footer: string };
let staticHtml: Promise<StaticHtml | null> | null = null;

/**
 * 本文の静的HTML（src/prerender/entry.ts）を1回だけ組み立てる。
 * 失敗してもビルドは止めない（その場合は従来どおりブラウザだけで描く）。
 */
function loadStaticHtml(): Promise<StaticHtml | null> {
  staticHtml ??= (async () => {
    try {
      const outDir = resolve(root, 'node_modules', '.cache', 'baton-prerender');
      mkdirSync(outDir, { recursive: true });
      const outFile = resolve(outDir, `entry-${Date.now()}.mjs`);
      const result = await esbuild({
        entryPoints: [resolve(root, 'src', 'prerender', 'entry.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        write: false,
        external: ['linkedom'],
        loader: { '.css': 'empty' },
        define: {
          'import.meta.env.BASE_URL': JSON.stringify(base),
          'import.meta.env.DEV': 'false',
          'import.meta.env.PROD': 'true',
          'import.meta.env.MODE': JSON.stringify('production'),
          'import.meta.env': JSON.stringify({ BASE_URL: base, DEV: false, PROD: true, MODE: 'production' }),
        },
        logLevel: 'silent',
      });
      writeFileSync(outFile, result.outputFiles[0].text);
      const mod = (await import(pathToFileURL(outFile).href)) as { renderStatic: () => Promise<StaticHtml> };
      return await mod.renderStatic();
    } catch (err) {
      console.warn('[baton] 静的HTMLの生成に失敗したため、ブラウザ描画のみで出力します:', err);
      return null;
    }
  })();
  return staticHtml;
}

/** JavaScriptが動かない環境でも本文が読めるよう、出現アニメーションの初期状態を解除する */
const NOSCRIPT_REVEAL =
  '<noscript><style>[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}</style></noscript>';

function injectStatic(html: string, body: string | undefined, footer: string | undefined): string {
  let out = html;
  if (body) out = out.replace('<main id="app"></main>', `<main id="app">${body}</main>`);
  if (footer) out = out.replace('<footer id="footer"></footer>', `<footer id="footer" class="profile-footer">${footer}</footer>`);
  return out.replace('</head>', `    ${NOSCRIPT_REVEAL}\n  </head>`);
}

function batonPages(): Plugin {
  return {
    name: 'baton-pages',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const prerendered = await loadStaticHtml();
        const filename = ctx.filename.replace(/\\/g, '/');
        const profileHubUrl = absoluteUrl('/profile/');
        const serviceHubUrl = absoluteUrl('/hub/');

        const s = serviceForPath(ctx.filename);
        if (s) {
          const vars = [
            `--primary:${s.theme.primary}`,
            `--accent:${s.theme.accent}`,
            `--bg:${s.theme.bg}`,
            `--text:${s.theme.text}`,
          ].join(';');
          const servicePath = `/${s.slug}/`;
          const serviceUrl = absoluteUrl(servicePath);
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: `${s.serviceName}｜${s.company} - ${site.name}`,
                description: s.description,
                themeColor: s.theme.primary,
                path: servicePath,
                vars,
                jsonLd: serviceStructuredData(s, serviceUrl, serviceHubUrl),
              }),
            )
            .replace('<!--BATON:HERO-->', serviceHeroHtml(s, base));
        }

        const isHome = filename === `${root.replace(/\\/g, '/')}/index.html`;
        const p = profileForPath(ctx.filename) ?? (isHome ? homeProfile : null);
        if (p) {
          const vars = [
            `--primary:${p.theme.primary}`,
            `--accent:${p.theme.accent}`,
            `--bg:${p.theme.bg}`,
            `--text:${p.theme.text}`,
          ].join(';');
          const path = isHome ? '/' : `/profile/${p.slug}/`;
          const canonicalPath = `/profile/${p.slug}/`;
          const profileUrl = absoluteUrl(canonicalPath);
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: profileTitle(p),
                description: profileDescription(p),
                themeColor: p.theme.primary,
                path,
                canonicalPath,
                ogType: 'profile',
                vars,
                jsonLd: profileStructuredData(p, profileUrl, profileHubUrl, siteUrl(), absoluteUrl(`/og/${p.slug}.jpg`)),
                extraFontHref: PROFILE_FONT_HREF,
                ogImage: absoluteUrl(`/og/${p.slug}.jpg`),
                markdownPath: `/profile/${p.slug}/index.md`,
              }),
            )
            .replace('<!--BATON:HERO-->', profileHeroHtml(p, `${base}profile/`.replace(/\/{2,}/g, '/')))
            .replace('<body class="profile">', `<body class="${profileBodyClass(p)}">`)
            .replace(/^([\s\S]*)$/, (whole) => injectStatic(whole, prerendered?.profiles[p.id], prerendered?.footer));
        }

        const isProfileHub = filename.includes('/profile/index.html');
        if (isProfileHub) {
          const vars = `--primary:${site.theme.text};--accent:${site.theme.accent};--bg:${site.theme.bg};--text:${site.theme.text}`;
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: 'Baton -バトン-｜経営者・事業者を紹介する招待制サービス｜合同会社Music Japan',
                description:
                  '合同会社Music Japanが実際に対話した経営者・事業者のプロフィールを掲載し、双方に可能性があると判断した相手どうしを紹介する、招待制の紹介サービス「Baton -バトン-」です。',
                themeColor: '#FDFCFA',
                path: '/profile/',
                vars,
                extraFontHref: PROFILE_FONT_HREF,
                jsonLd: profileHubStructuredData(
                  profiles,
                  profileHubUrl,
                  (profile) => absoluteUrl(`/profile/${profile.slug}/`),
                  siteUrl(),
                ),
                ogImage: absoluteUrl('/og/baton.jpg'),
                markdownPath: '/llms.txt',
              }),
            )
            .replace('<!--BATON:HERO-->', profileHubHeroHtml())
            .replace(/^([\s\S]*)$/, (whole) => injectStatic(whole, prerendered?.hub, prerendered?.footer));
        }

        const isFaq = filename === `${root.replace(/\\/g, '/')}/faq/index.html`;
        if (isFaq) {
          const vars = `--primary:${site.theme.text};--accent:${site.theme.accent};--bg:#FDFCFA;--text:${site.theme.text}`;
          const faqUrl = absoluteUrl('/faq/');
          return injectStatic(
            html.replace(
              '<!--BATON:HEAD-->',
              head({
                title: 'よくある質問｜Baton -バトン-（招待制の紹介サービス）',
                description:
                  'Baton -バトン-とは何か、運営者、掲載されている経営者・事業者を紹介してもらう方法と流れ、掲載のご相談方法をまとめています。',
                themeColor: '#FDFCFA',
                path: '/faq/',
                vars,
                jsonLd: faqPageStructuredData(faqUrl, profileHubUrl, siteUrl()),
                extraFontHref: PROFILE_FONT_HREF,
                ogImage: absoluteUrl('/og/baton.jpg'),
              }),
            ),
            prerendered?.faq,
            prerendered?.footer,
          );
        }

        const isVerify = filename.includes('/verify/index.html');
        const isRespond = filename.includes('/respond/index.html');
        if (isVerify || isRespond) {
          const vars = `--primary:${site.theme.text};--accent:${site.theme.accent};--bg:${site.theme.bg};--text:${site.theme.text}`;
          return html.replace(
            '<!--BATON:HEAD-->',
            head({
              title: `${isVerify ? 'メール認証' : '確認'} - ${site.name}`,
              description: 'Baton Introduction System',
              themeColor: site.theme.bg,
              path: isVerify ? '/verify/' : '/respond/',
              vars,
              noindex: true,
            }),
          );
        }

        const isPrivacy = filename.includes('/privacy/');
        const vars = `--primary:${site.theme.text};--accent:${site.theme.accent};--bg:${site.theme.bg};--text:${site.theme.text}`;
        if (isPrivacy) {
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: `プライバシーポリシー - ${site.name}`,
                description: `${site.operator.name}のプライバシーポリシーです。`,
                themeColor: site.theme.bg,
                path: '/privacy/',
                vars,
              }),
            )
            .replace('<!--BATON:HERO-->', '');
        }

        return html
          .replace(
            '<!--BATON:HEAD-->',
            head({
              title: '法人向け厳選サービス｜Baton -バトン-',
              description:
                '合同会社Music Japanが法人向けに選んだ専門サービスを掲載しています。IT人材、Web制作、システム開発、新卒採用、WordPress、CRMなど、課題に応じて相談できます。',
              themeColor: site.theme.bg,
              path: '/hub/',
              vars,
              jsonLd: serviceHubStructuredData(
                services,
                serviceHubUrl,
                (service) => absoluteUrl(`/${service.slug}/`),
              ),
            }),
          )
          .replace('<!--BATON:HERO-->', hubHeroHtml());
      },
    },
  };
}

/**
 * ページのパスから、対応するサービス設定を引く（なければハブ/法務ページ）。
 * サービスは常にルート直下（/<slug>/index.html）にあるため、
 * 「/profile/<slug>/index.html」のように途中に別のセグメントが挟まる
 * パスと混同しないよう、直前が root であることまで確認する。
 */
function serviceForPath(filename: string): Service | null {
  const normalized = filename.replace(/\\/g, '/');
  const normalizedRoot = root.replace(/\\/g, '/');
  return (
    services.find((s) => normalized === `${normalizedRoot}/${s.slug}/index.html`) ?? null
  );
}

/** ページのパスから、対応するBaton Talkプロフィールを引く */
/**
 * 背景色が暗いプロフィールかどうか。
 * テンプレートは1つで、色だけがプロフィールごとに変わる。
 * 暗いときだけ body に profile--dark を付け、白地前提の共通部品
 * （カード・入力欄・フッター）を暗色側へまとめて寄せる。
 */
function isDarkTheme(hex: string): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.2;
}

/** そのプロフィールの body クラス。テンプレート／色の出し分けはここ1箇所 */
function profileBodyClass(p: TalkProfile): string {
  const classes = ['profile'];
  if (isDarkTheme(p.theme.bg)) classes.push('profile--dark');
  if (p.heroVariant === 'editorial') classes.push('profile--editorial');
  return classes.join(' ');
}

function profileForPath(filename: string): TalkProfile | null {
  const normalized = filename.replace(/\\/g, '/');
  const normalizedRoot = root.replace(/\\/g, '/');
  return (
    profiles.find((p) => normalized === `${normalizedRoot}/profile/${p.slug}/index.html`) ?? null
  );
}

export default defineConfig({
  base,
  plugins: [batonPages(), batonSeoFiles()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      input: pages,
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['gsap', 'gsap/ScrollTrigger', 'lenis'],
        },
      },
    },
  },
});
