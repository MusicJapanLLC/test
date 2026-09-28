import { defineConfig, type Plugin } from 'vite';
import { generatePages, type GeneratedPage } from './src/render/generate';
import type { BuildEnv } from './src/render/layout';

const root = process.cwd();

/**
 * 公開URL。Vercel なら自動で入る。独自ドメイン（サブドメイン）を当てたら VITE_SITE_URL で上書き。
 */
function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:4174';
}

/** デモの間は noindex。公開するときだけ BP_INDEX=1 でビルドする */
const googleFonts = process.env.BP_FONTS === 'google';
const env: BuildEnv = { siteUrl: siteUrl(), noindex: process.env.BP_INDEX !== '1', googleFonts };

function seoFiles(pages: GeneratedPage[]): Plugin {
  return {
    name: 'bp-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: env.noindex
          ? 'User-agent: *\nDisallow: /\n'
          : `User-agent: *\nAllow: /\n\nSitemap: ${env.siteUrl}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages
            .filter((p) => p.key !== 'index')
            .map((p) => `  <url><loc>${env.siteUrl}${p.path}</loc></url>`)
            .join('\n') +
          '\n</urlset>\n',
      });
    },
  };
}

/** テンプレートを編集したら、開発サーバーでもページを作り直す */
function regenerate(): Plugin {
  return {
    name: 'bp-regenerate',
    apply: 'serve',
    async handleHotUpdate(ctx) {
      if (ctx.file.includes('/src/render/') || ctx.file.includes('/src/partners/') || ctx.file.includes('/src/config/')) {
        await generatePages(root, env);
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig(async () => {
  const pages = await generatePages(root, env);
  return {
    plugins: [seoFiles(pages), regenerate()],
    define: { __GOOGLE_FONTS__: JSON.stringify(googleFonts) },
    build: {
      target: 'es2020',
      // フォントはbase64でCSSに埋め込まない（CSSが肥大化して描画が遅れる）
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
      rollupOptions: {
        input: Object.fromEntries(pages.map((p) => [p.key, p.file])),
        output: {
          manualChunks(id: string) {
            return id.includes('/node_modules/three/') ? 'three' : undefined;
          },
        },
      },
    },
  };
});
