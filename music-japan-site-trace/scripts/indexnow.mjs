// Tells Bing / Yandex / Seznam / Naver (IndexNow) that every public page changed.
// Run once after a production deploy:  npm run indexnow
// The key file /<key>.txt is published by the build (next/src/render/machine.ts).
const SITE = "https://music-japan.com";
const KEY = "844274c99df5a67456015ef85d22911f";
const pages = ["", "business/", "company/", "profile/", "partners/", "contact/", "privacy/"];
const urlList = pages.flatMap((p) => [`${SITE}/${p}`, `${SITE}/en/${p}`]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "music-japan.com", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} (${urlList.length} URLs)`);
if (res.status >= 300) process.exit(1);
