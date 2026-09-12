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
import type { Service, TalkProfile } from './src/types';

const root = process.cwd();

/** サブパス配信するときだけ設定する。例: GitHub Pages なら /test/ */
const base = process.env.VITE_BASE ?? '/';

/**
 * 6サービス + ハブ + プライバシーポリシー
 * + Baton Introduction System（プロフィール6枚 + 一覧 + 認証/承認・辞退の2ページ）
 */
const pages = {
  main: resolve(root, 'index.html'),
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

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function head(opts: {
  title: string;
  description: string;
  themeColor: string;
  path: string;
  vars: string;
}) {
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
    <noscript><link rel="stylesheet" href="${FONT_HREF}" /></noscript>
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <meta name="theme-color" content="${opts.themeColor}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.nameJa)}" />
    <meta property="og:title" content="${esc(opts.title)}" />
    <meta property="og:description" content="${esc(opts.description)}" />
    <meta property="og:url" content="${siteUrl()}${(base + opts.path.replace(/^\//, '')).replace(/\/{2,}/g, '/')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>:root{${opts.vars}}</style>`.trim();
}

/**
 * 本番のドメイン。Vercel なら VERCEL_PROJECT_PRODUCTION_URL が入る。
 * 独自ドメインを当てたら VITE_SITE_URL で上書きする。
 */
function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:4173';
}

/** robots.txt と sitemap.xml はビルド時に services から作る。手で直す場所を増やさない */
function batonSeoFiles(): Plugin {
  return {
    name: 'baton-seo-files',
    apply: 'build',
    generateBundle() {
      const siteBase = siteUrl();
      const paths = [
        '',
        ...services.map((s) => `${s.slug}/`),
        'privacy/',
        'profile/',
        ...profiles.map((p) => `profile/${p.slug}/`),
      ].map((p) => `${base}${p}`.replace(/\/{2,}/g, '/'));

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteBase}${base}sitemap.xml\n`.replace(
          /([^:])\/{2,}/g,
          '$1/',
        ),
      });

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          paths.map((p) => `  <url><loc>${siteBase}${p}</loc></url>`).join('\n') +
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

        const s = serviceForPath(ctx.filename);
        if (s) {
          const vars = [
            `--primary:${s.theme.primary}`,
            `--accent:${s.theme.accent}`,
            `--bg:${s.theme.bg}`,
            `--text:${s.theme.text}`,
          ].join(';');
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: `${s.serviceName}｜${s.company} - ${site.name}`,
                description: s.description,
                themeColor: s.theme.primary,
                path: `/${s.slug}/`,
                vars,
              }),
            )
            .replace('<!--BATON:HERO-->', serviceHeroHtml(s, base));
        }

        const p = profileForPath(ctx.filename);
        if (p) {
          const vars = [
            `--primary:${p.theme.primary}`,
            `--accent:${p.theme.accent}`,
            `--bg:${p.theme.bg}`,
            `--text:${p.theme.text}`,
          ].join(';');
          return html
            .replace(
              '<!--BATON:HEAD-->',
              head({
                title: `${p.name}｜${p.company} - Baton Talk`,
                description: p.bio,
                themeColor: p.theme.primary,
                path: `/profile/${p.slug}/`,
                vars,
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
                title: `Baton Talk｜この人と話したい - ${site.name}`,
                description: 'Music Japanが紹介する人物プロフィール一覧です。',
                themeColor: site.theme.bg,
                path: '/profile/',
                vars,
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
        return html
          .replace(
            '<!--BATON:HEAD-->',
            head({
              title: isPrivacy
                ? `プライバシーポリシー - ${site.name}`
                : `${site.nameJa}｜${site.tagline}`,
              description: isPrivacy
                ? `${site.operator.name}のプライバシーポリシーです。`
                : site.description,
              themeColor: site.theme.bg,
              path: isPrivacy ? '/privacy/' : '/',
              vars,
            }),
          )
          .replace('<!--BATON:HERO-->', isPrivacy ? '' : hubHeroHtml());
      },
    },
  };
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
