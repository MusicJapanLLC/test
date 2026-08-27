import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { services } from './src/data/services';
import { site } from './src/data/site';
import type { Service } from './src/types';

const root = process.cwd();

/** サブパス配信するときだけ設定する。例: GitHub Pages なら /test/ */
const base = process.env.VITE_BASE ?? '/';

/** 6サービス + ハブ + プライバシーポリシー = 8エントリ */
const pages = {
  main: resolve(root, 'index.html'),
  ...Object.fromEntries(
    services.map((s) => [s.id, resolve(root, s.slug, 'index.html')]),
  ),
  privacy: resolve(root, 'privacy', 'index.html'),
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ページのパスから、対応するサービス設定を引く（なければハブ/法務ページ） */
function serviceForPath(filename: string): Service | null {
  const normalized = filename.replace(/\\/g, '/');
  return (
    services.find((s) => normalized.includes(`/${s.slug}/index.html`)) ?? null
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
 * ヒーローだけはビルド時に静的HTMLとして焼き込む。
 * LCP要素がJS待ちにならないようにするため。中身の出どころは services.ts のまま。
 */
function serviceHero(s: Service) {
  return `
<header class="hero${s.heavyWebGL ? ' hero--heavy' : ''}" data-hero>
  <canvas class="hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hero__inner">
    <p class="hero__eyebrow"><a class="hero__back" href="${base}">Baton</a><span aria-hidden="true">/</span><span>${esc(s.company)}</span></p>
    <h1 class="hero__title">${esc(s.serviceName)}</h1>
    <p class="hero__tagline">${esc(s.tagline)}</p>
    <p class="hero__desc">${esc(s.description)}</p>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
}

function hubHero() {
  return `
<header class="hub-hero" data-hero>
  <canvas class="hub-hero__canvas" data-hero-canvas aria-hidden="true"></canvas>
  <div class="hub-hero__inner">
    <h1 class="hub-hero__title">${esc(site.name)}</h1>
    <p class="hub-hero__tagline">${esc(site.tagline)}</p>
  </div>
  <div class="hub-hero__scroll" aria-hidden="true"><span></span></div>
</header>`.trim();
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
      const paths = ['', ...services.map((s) => `${s.slug}/`), 'privacy/'].map(
        (p) => `${base}${p}`.replace(/\/{2,}/g, '/'),
      );

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
            .replace('<!--BATON:HERO-->', serviceHero(s));
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
              vars,
            }),
          )
          .replace('<!--BATON:HERO-->', isPrivacy ? '' : hubHero());
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
