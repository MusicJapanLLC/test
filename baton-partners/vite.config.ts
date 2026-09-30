import { defineConfig, type Plugin } from 'vite';
import { generatePages, type GeneratedPage } from './src/render/generate';
import { llmsFullTxt, llmsTxt } from './src/render/llms';
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

/**
 * 検索とAI向けのファイル。
 *   robots.txt  … 検索エンジンと、AI検索・AIアシスタントのクローラーを名前で明示して許可
 *   sitemap.xml … canonical のURLだけ。lastmod は内容を大きく見直した日
 *   llms.txt / llms-full.txt … AIがサイト全体を把握するための索引と全文
 */
const AI_BOTS = [
  // 検索・回答のための取得（ここを止めると AI の回答に出にくくなる）
  'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
  // 学習・生成AI機能での利用（Google-Extended と Applebot-Extended は Google 検索・Apple の検索順位には影響しない）
  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent',
];

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
          : [
              '# Baton Partners（合同会社Music Japan）',
              '# 検索エンジンも AI のクローラーも、すべてのページを読んでかまいません。',
              '',
              'User-agent: *',
              'Allow: /',
              '',
              '# AI検索・AIアシスタント（明示的に許可）',
              ...AI_BOTS.map((b) => `User-agent: ${b}`),
              'Allow: /',
              '',
              `Sitemap: ${env.siteUrl}/sitemap.xml`,
              '',
            ].join('\n'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages
            .filter((p) => p.lastmod)
            .map((p) => `  <url><loc>${env.siteUrl}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`)
            .join('\n') +
          '\n</urlset>\n',
      });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(env) });
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFullTxt(env) });
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
