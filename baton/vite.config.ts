import { resolve } from 'node:path';
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
  profileHubStructuredData,
  profileStructuredData,
  serviceHubStructuredData,
  serviceStructuredData,
  type JsonLd,
} from './src/lib/seo';
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
  'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&display=swap';

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
    <meta name="twitter:card" content="summary_large_image" />
    ${structuredData}
    <style>:root{${opts.vars}}</style>`.trim();
}

/** robots.txt と sitemap.xml はビルド時に公開中の独自ドメインで生成する */
function batonSeoFiles(): Plugin {
  return {
    name: 'baton-seo-files',
    apply: 'build',
    generateBundle() {
      const siteBase = siteUrl();
      const paths = [
        'hub/',
        ...services.map((s) => `${s.slug}/`),
        'profile/',
        ...profiles.filter((p) => p.active).map((p) => `profile/${p.slug}/`),
      ];

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteBase}/sitemap.xml\n`,
      });

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          paths.map((p) => `  <url><loc>${siteBase}/${p}</loc></url>`).join('\n') +
          '\n</urlset>\n',
      });
    },
  };
}

function batonPages(): Plugin {
  return {
    name: 'baton-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
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
                title: isHome ? `${p.name}｜${p.company} - ${site.name}` : `${p.name}｜${p.company} - Baton Talk`,
                description: p.bio,
                themeColor: p.theme.primary,
                path,
                canonicalPath,
                ogType: 'profile',
                vars,
                jsonLd: profileStructuredData(p, profileUrl, profileHubUrl),
                extraFontHref: PROFILE_FONT_HREF,
              }),
            )
            .replace('<!--BATON:HERO-->', profileHeroHtml(p, `${base}profile/`.replace(/\/{2,}/g, '/')));
        }

        const isProfileHub = filename.includes('/profile/index.html');
        if (isProfileHub) {
          const vars = `--primary:${site.theme.text};--accent:${site.theme.accent};--bg:${site.theme.bg};--text:${site.theme.text}`;
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: 'Baton -バトン-｜選んだ人が、選んだ人へ。',
                description:
                  '合同会社Music Japanが実際に対話した経営者・事業者のプロフィールを掲載する、招待制の紹介サービス「Baton -バトン-」です。',
                themeColor: site.theme.bg,
                path: '/profile/',
                vars,
                jsonLd: profileHubStructuredData(
                  profiles,
                  profileHubUrl,
                  (profile) => absoluteUrl(`/profile/${profile.slug}/`),
                ),
              }),
            )
            .replace('<!--BATON:HERO-->', profileHubHeroHtml());
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
