#!/usr/bin/env node
/**
 * 公開後に、Bing などの検索エンジンへ「このURLを更新した」と知らせる（IndexNow）。
 * Bing・Yandex・Naver・Seznam が受け取り、互いに共有する。Google は IndexNow に参加していない
 * （Google には Search Console でサイトマップを送信する）。
 *
 * 使い方（本番に公開されたのを確認してから）:
 *   node scripts/indexnow.mjs
 *
 * キーの確認用ファイル public/<KEY>.txt が本番で開けることが前提。
 */
const SITE = 'https://baton.music-japan.com';
const KEY = '384b7059f6bebefee7b9806960da2b0a';

const sitemap = await fetch(`${SITE}/sitemap.xml`).then((r) => {
  if (!r.ok) throw new Error(`sitemap.xml を取得できません: ${r.status}`);
  return r.text();
});
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => u.startsWith(SITE));

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText}（${urlList.length}件）`);
if (res.status >= 400) process.exit(1);
