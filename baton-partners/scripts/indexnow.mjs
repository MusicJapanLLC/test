// IndexNow：本番のサイトマップにあるURLを、Bing などの検索エンジンにまとめて知らせる。
// 使い方：本番デプロイのあとに `npm run indexnow`（公開中の sitemap.xml を読む）
// キーは public/<32桁の16進>.txt。中身とファイル名が同じ文字列（https://www.indexnow.org/documentation）
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = process.env.SITE_URL ?? 'https://partners.music-japan.com';
const host = new URL(SITE).host;
const keyFile = readdirSync(resolve(import.meta.dirname, '../public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('public/ に IndexNow のキーファイルがありません');
const key = keyFile.replace('.txt', '');

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error('sitemap.xml からURLを読めませんでした');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `${SITE}/${keyFile}`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText}（${urlList.length}件）`);
if (res.status >= 300) process.exit(1);
