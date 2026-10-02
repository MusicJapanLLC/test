import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { document, type BuildEnv } from './layout';
import { mjMarkFile } from './icons';

/**
 * src/ の文章とテンプレートから index.html を書き出す（.gitignore 済み。直接編集しない）。
 * Vite はこの index.html を入口にして、JS・CSS を差し込んだ dist/index.html を作る。
 */
export function generate(root: string, env: BuildEnv): string {
  const file = resolve(root, 'index.html');
  writeFileSync(file, document(env));
  writeFileSync(resolve(root, 'public/favicon.svg'), mjMarkFile());
  return file;
}
