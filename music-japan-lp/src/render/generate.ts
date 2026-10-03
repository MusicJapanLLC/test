import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PAGES } from '../content/pages';
import { mjMarkFile } from './icons';
import { document, type BuildEnv } from './layout';

/**
 * src/ の文章とテンプレートから、ページごとの index.html を書き出す（.gitignore 済み。直接編集しない）。
 * Vite はこれらを入口にして、JS・CSS を差し込んだ dist/ を作る（複数ページ）。
 */
export function pageFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const p of PAGES) files[p.key] = resolve(root, `.${p.path}index.html`);
  files['404'] = resolve(root, '404.html');
  return files;
}

export function generate(root: string, env: BuildEnv): Record<string, string> {
  const files = pageFiles(root);
  for (const [key, file] of Object.entries(files)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, document(key as never, env));
  }
  writeFileSync(resolve(root, 'public/favicon.svg'), mjMarkFile());
  return files;
}
