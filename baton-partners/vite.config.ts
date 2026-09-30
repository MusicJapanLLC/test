import { defineConfig, type Plugin } from 'vite';
import { generatePages, type GeneratedPage } from './src/render/generate';
import type { BuildEnv } from './src/render/layout';

const root = process.cwd();

/** 本番の公開URL（Cloudflare の DNS で partners → cname.vercel-dns.com） */
const PRODUCTION_URL = 'https://partners.music-japan.com';
const isProduction = process.env.VERCEL_ENV === 'production';

/**
 * canonical・sitemap に使うURL。本番は独自ドメインに固定する。
 * VITE_SITE_URL があればそれを優先。プレビューやローカルでは、そのデプロイ自身のURL。
 */
function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (isProduction) return PRODUCTION_URL;
  const vercel = process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:4174';
}

/**
 * 本番ビルドだけ検索に載せる。プレビュー・ローカルは noindex。
 * 本番でも止めたいときは BP_NOINDEX=1 でビルドする。
 * （vercel.app のURLは、本番の中身でも vercel.json の X-Robots-Tag で noindex にしている）
 */
const googleFonts = process.env.BP_FONTS === 'google';
const noindex = !isProduction || process.env.BP_NOINDEX === '1';
const env: BuildEnv = { siteUrl: siteUrl(), noindex, googleFonts };

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
