import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * 壁谷プロフィール1件だけを見せる単一ファイルプレビュー用ビルド。
 * 共有・確認専用。本番（vite.config.ts）とは別物。
 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-kabeya-preview',
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: resolve(process.cwd(), 'kabeya-preview.html'),
      output: { inlineDynamicImports: true, entryFileNames: 'bundle.js', assetFileNames: 'bundle[extname]' },
    },
  },
});
