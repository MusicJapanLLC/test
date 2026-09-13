import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { services } from './src/data/services';
import { site } from './src/data/site';
import { hubHeroHtml, serviceHeroHtml } from './src/lib/hero';
import type { Service } from './src/types';

const root = process.cwd();

/** サブパス配信するときだけ設定する。例: GitHub Pages なら /test/ */
const base = process.env.VITE_BASE ?? '/';
const CANONICAL_SITE_URL = 'https://baton.music-japan.com';

/** 6サービス + ハブ + プライバシーポリシー = 8エントリ */
const pages = {
  main: resolve(root, 'index.html'),
  ...Object.fromEntries(
    services.map((s) => [s.id, resolve(root, s.slug, 'index.html')]),
  ),
  privacy: resolve(root, 'privacy', 'index.html'),
};

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ページのパスから、対応するサービス設定を引く（なければハブ/法務ページ） */
function serviceForPath(filename: string): Service | null {
  const normalized = filename.replace(/\\/g, '/');
  return (
    services.find((s) => normalized.includes(`/${s.slug}/index.html`)) ?? null
  );
}

function canonicalUrl(path: string): string {
  const normalized = `/${path.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  return `${CANONICAL_SITE_URL}${normalized}`;
}

function head(opts: {
  title: string;
  description: string;
  themeColor: string;
  path: string;
  canonicalPath?: string;
  vars: string;
}) {
  const canonical = canonicalUrl(opts.canonicalPath ?? opts.path);

  return `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <!--
      baton-liart.vercel.app は営業導線として残すが、検索評価は独自ドメイン版へ集約する。
      noindex にしてもフォームや直接アクセスには影響しない。
    -->
    <link rel="preload" as="style" href="${FONT_HREF}" />
    <link rel="stylesheet" href="${FONT_HREF}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="${FONT_HREF}" /></noscript>
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="${opts.themeColor}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.nameJa)}" />
    <meta property="og:title" content="${esc(opts.title)}" />
    <meta property="og:description" content="${esc(opts.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>:root{${opts.vars}}</style>`.trim();
}

/**
 * Vercel標準URLは直接営業導線として残す。
 * robots.txt からは独自ドメインのsitemapだけを案内し、検索評価を分散させない。
 */
function batonSeoFiles(): Plugin {
  return {
    name: 'baton-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${CANONICAL_SITE_URL}/sitemap.xml\n`,
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

        const isPrivacy = ctx.filename.replace(/\\/g, '/').includes('/privacy/');
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
              canonicalPath: isPrivacy ? '/privacy/' : '/hub/',
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
