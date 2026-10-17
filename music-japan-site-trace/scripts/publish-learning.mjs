// Public discovery layer for the existing learning apps; runs in both site editions.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headerNoindex } from './seo-audit.mjs';

export const LEARNING_UPDATED = '2026-10-17';
export const LEARNING_ROUTES = ['/learning/', '/korean/', '/wahran/'];
const SITE = 'https://music-japan.com';
const START = '<!-- BEGIN MUSIC JAPAN LEARNING -->';
const END = '<!-- END MUSIC JAPAN LEARNING -->';
const SUMMARY = `${START}
## Music Japan Learning — 無料の言語学習

- [Music Japan Learning](${SITE}/learning/): 合同会社Music Japanのブラウザ言語学習サイト。韓国語とアルジェリアのアラビア語Darijaを、単語・例文・会話で練習できます。無料・会員登録不要。
- [韓国語学習アプリ](${SITE}/korean/): 1,000単語と1,000使用例、20レッスン、12会話104発言。カタカナ・IPA・英語・日本語の意味を確認し、3種類の話し方を練習。カタカナとIPAは独立して切替可能。音声は端末で利用できる韓国語の合成音声を使用。
- [アラビア語・アルジェリアDarija学習 Wahran](${SITE}/wahran/): OranのWahraniを中心とするアルジェリアDarijaの入門練習。700単語・240例文・30レッスン。アラビア文字、IPA、英語、日本語の意味・解説と合成音声。標準アラビア語の総合コースではありません。

両アプリの発音表記・合成音声は学習補助であり、教材全件の母語話者による校閲や地域の発音との完全一致を保証しません。教材と音声は公開ページから取得し、学習履歴・保存した項目・録音は端末のブラウザ内で扱います。詳細な利用方法は各ページの可視本文を参照してください。
${END}`;

function replaceSection(text, section) {
  return text.replace(new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, 'g'), '').trimEnd() + '\n\n' + section + '\n';
}

export function publishLearning(root = fileURLToPath(new URL('..', import.meta.url))) {
  const out = join(root, 'deploy-dist');
  const source = readFileSync(join(root, 'learning/index.html'), 'utf8');
  const headerPath = join(out, '_headers');
  const headers = readFileSync(headerPath, 'utf8');
  // Fail before writing when an app was not published or the custom domain is excluded.
  for (const route of LEARNING_ROUTES) {
    const html = route === '/learning/' ? source : readFileSync(join(out, route, 'index.html'), 'utf8');
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    const canonicals = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map(m => m[0].match(/href="([^"]+)"/)?.[1]);
    if (canonicals.length !== 1 || canonicals[0] !== `${SITE}${route}`) throw new Error(`Learning canonical missing or incorrect: ${route}`);
    if (/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head) || headerNoindex(headers, `${SITE}${route}`)) throw new Error(`Learning page is still noindex: ${route}`);
  }
  const sitemapPath = join(out, 'sitemap.xml');
  let sitemap = readFileSync(sitemapPath, 'utf8');
  if (!sitemap.includes('</urlset>')) throw new Error('Learning publication requires a URL sitemap');
  // Regeneration and repeated publication must not duplicate canonical URLs.
  sitemap = sitemap.replace(/\s*<url>[\s\S]*?<\/url>/g, entry => LEARNING_ROUTES.some(route => entry.includes(`<loc>${SITE}${route}</loc>`)) ? '' : entry);
  const entries = LEARNING_ROUTES.map(route => `  <url><loc>${SITE}${route}</loc><lastmod>${LEARNING_UPDATED}</lastmod></url>`).join('\n');
  sitemap = sitemap.replace(/\s*<\/urlset>/, `\n${entries}\n</urlset>`);
  const textFiles = ['llms.txt', 'llms-full.txt'].map(name => [name, replaceSection(readFileSync(join(out, name), 'utf8'), SUMMARY)]);

  mkdirSync(join(out, 'learning'), { recursive: true });
  writeFileSync(join(out, 'learning/index.html'), source);
  // Shared social artwork exists in the current site; preserve it in legacy builds too.
  if (!existsSync(join(out, 'og/ja-home.png'))) {
    mkdirSync(join(out, 'og'), { recursive: true });
    copyFileSync(join(root, 'next/public/og/ja-home.png'), join(out, 'og/ja-home.png'));
  }
  writeFileSync(sitemapPath, sitemap);
  for (const [name, text] of textFiles) writeFileSync(join(out, name), text);
  const block = '\n# BEGIN LEARNING PUBLIC\n/learning/*\n  Cache-Control: public, max-age=0, must-revalidate\n# END LEARNING PUBLIC\n';
  writeFileSync(headerPath, headers.replace(/\n# BEGIN LEARNING PUBLIC\n[\s\S]*?# END LEARNING PUBLIC\n/g, '') + block);
  const redirectsPath = join(out, '_redirects');
  let redirects = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
  for (const route of LEARNING_ROUTES) {
    const rule = `${route.slice(0, -1)} ${route} 301`;
    if (!redirects.split(/\r?\n/).includes(rule)) redirects = redirects.trimEnd() + '\n' + rule + '\n';
  }
  writeFileSync(redirectsPath, redirects);
  console.log(`Music Japan Learning published: ${LEARNING_ROUTES.join(', ')}; canonical sitemap and public summaries updated`);
}
