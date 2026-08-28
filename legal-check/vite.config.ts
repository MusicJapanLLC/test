import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { services } from './src/data/services';
import { site } from './src/data/site';
import { hubHeroHtml as _unusedHero, serviceHeroHtml } from './src/lib/hero';
import type { Service } from './src/types';

void _unusedHero;

const root = process.cwd();

/** サブパス配信するときだけ設定する */
const base = process.env.VITE_BASE ?? '/';

/** 1ページ完結。ハブは無い */
const pages = {
  main: resolve(root, 'index.html'),
  privacy: resolve(root, 'privacy', 'index.html'),
};

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** このサイトが扱うサービスは1件だけ */
const service: Service = services[0];

/**
 * 本番のドメイン。Vercel なら VERCEL_PROJECT_PRODUCTION_URL が入る。
 * 独自ドメインを当てたら VITE_SITE_URL で上書きする。
 */
function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:4174';
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

function batonSeoFiles(): Plugin {
  return {
    name: 'legal-seo-files',
    apply: 'build',
    generateBundle() {
      const siteBase = siteUrl();
      const paths = ['', 'privacy/'].map((p) => `${base}${p}`.replace(/\/{2,}/g, '/'));

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

function legalPages(): Plugin {
  const vars = [
    `--primary:${service.theme.primary}`,
    `--accent:${service.theme.accent}`,
    `--bg:${service.theme.bg}`,
    `--text:${service.theme.text}`,
  ].join(';');

  return {
    name: 'legal-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const isPrivacy = ctx.filename.replace(/\\/g, '/').includes('/privacy/');

        if (isPrivacy) {
          return html.replace(
            '<!--BATON:HEAD-->',
            head({
              title: `プライバシーポリシー - ${site.name}`,
              description: `${site.operator.name}のプライバシーポリシーです。`,
              themeColor: '#ffffff',
              path: '/privacy/',
              vars,
            }),
          );
        }

        return html
          .replace(
            '<!--BATON:HEAD-->',
            head({
              title: `${service.serviceName}｜${service.tagline}`,
              description: service.description,
              themeColor: service.theme.primary,
              path: '/',
              vars,
            }),
          )
          .replace('<!--BATON:HERO-->', serviceHeroHtml(service, base, { showBackLink: false }));
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [legalPages(), batonSeoFiles()],
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
