import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** 単一ファイルのプレビュー用ビルド。本番（vite.config.ts）とは別物 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-preview',
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: resolve(process.cwd(), 'preview.html'),
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'bundle.js',
        assetFileNames: 'bundle[extname]',
      },
    },
  },
});
