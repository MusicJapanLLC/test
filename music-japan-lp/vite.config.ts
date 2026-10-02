import { defineConfig, type Plugin } from 'vite';
import { generate } from './src/render/generate';
import { atom, jsonFeed, llms, llmsFull, robots, sitemap } from './src/render/machine';

const root = process.cwd();

/**
 * 本番（Vercel の Production）だけ検索に載せる。プレビューとローカルは noindex。
 * *.vercel.app のURLは、本番の中身でも vercel.json の X-Robots-Tag で noindex にしている。
 */
const noindex = process.env.VERCEL_ENV !== 'production' || process.env.MJ_NOINDEX === '1';

function machineFiles(): Plugin {
  return {
    name: 'mjlp-machine-files',
    apply: 'build',
    generateBundle() {
      const files: Record<string, string> = {
        'robots.txt': robots(noindex),
        'sitemap.xml': sitemap(),
        'llms.txt': llms(),
        'llms-full.txt': llmsFull(),
        'index.md': llmsFull(),
        'feed.xml': atom(),
        'activity.json': jsonFeed(),
      };
      for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

/** 文章やテンプレートを変えたら、開発サーバーでも index.html を作り直す */
function regenerate(): Plugin {
  return {
    name: 'mjlp-regenerate',
    apply: 'serve',
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/src/render/') || ctx.file.includes('/src/content/')) {
        generate(root, { noindex: true });
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig(() => {
  generate(root, { noindex });
  return {
    plugins: [machineFiles(), regenerate()],
    build: {
      target: 'es2022',
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('/node_modules/three/')) return 'three';
            if (id.includes('/node_modules/gsap/') || id.includes('/node_modules/lenis/')) return 'motion';
            return undefined;
          },
        },
      },
    },
  };
});
