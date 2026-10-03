import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { generatePages } from './src/render/generate';
import { INDEXNOW_KEY, llms, llmsFull, robots, sitemap } from './src/render/machine';
import { LAST_MODIFIED } from './src/content/site';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MJ_OUT_DIR ? resolve(process.env.MJ_OUT_DIR) : resolve(root, '../deploy-dist');

function regenerate(): Plugin {
  return {
    name: 'mj-regenerate',
    apply: 'serve',
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/src/render/') || ctx.file.includes('/src/content/')) {
        generatePages(root);
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

/** sitemap / robots / llms / IndexNow key are generated from the same content as the pages. */
function machineFiles(): Plugin {
  return {
    name: 'mj-machine-files',
    apply: 'build',
    generateBundle() {
      const files: Record<string, string> = {
        // Use the editorial update date shared with page/schema metadata.
        // Redeploying identical content must not claim a new modification.
        'sitemap.xml': sitemap(LAST_MODIFIED),
        'robots.txt': robots(),
        'llms.txt': llms(),
        'llms-full.txt': llmsFull(),
        [`${INDEXNOW_KEY}.txt`]: INDEXNOW_KEY,
      };
      for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

export default defineConfig(() => {
  const pages = generatePages(root);
  return {
    root,
    publicDir: resolve(root, 'public'),
    plugins: [regenerate(), machineFiles()],
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2020',
      assetsInlineLimit: 0,
      rollupOptions: {
        input: Object.fromEntries(pages.map((p) => [p.key, p.file])),
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
