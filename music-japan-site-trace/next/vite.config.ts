import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { generatePages } from './src/render/generate';

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

export default defineConfig(() => {
  const pages = generatePages(root);
  return {
    root,
    publicDir: resolve(root, 'public'),
    plugins: [regenerate()],
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
