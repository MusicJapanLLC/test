// Submit changed canonical URLs after publication. Acceptance is not indexation.
// Usage: npm run indexnow -- https://music-japan.com/learning/ https://music-japan.com/korean/ https://music-japan.com/wahran/
// Without arguments, uses the final built sitemap rather than a stale fixed page list.
import { readFileSync } from 'node:fs';
const SITE = 'https://music-japan.com';
const KEY = '844274c99df5a67456015ef85d22911f';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const supplied = args.filter(a => a !== '--dry-run');
const urlList = [...new Set(supplied.length ? supplied : [...readFileSync(new URL('../deploy-dist/sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]))];
if (!urlList.length || urlList.length > 10000) throw new Error('IndexNow requires 1–10000 canonical URLs');
for (const value of urlList) {
  const url = new URL(value);
  if (url.origin !== SITE || url.search || url.hash || !url.pathname.endsWith('/')) throw new Error(`Not a canonical Music Japan page: ${value}`);
}
const body = { host: 'music-japan.com', key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList };
if (dryRun) {
  console.log(JSON.stringify({ submitted: false, ...body }, null, 2));
} else {
  const keyResponse = await fetch(body.keyLocation, { signal: AbortSignal.timeout(20000) });
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== KEY) throw new Error('Published IndexNow key could not be verified; nothing submitted');
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  console.log(JSON.stringify({ submittedAt: new Date().toISOString(), status: response.status, accepted: [200, 202].includes(response.status), urlList, indexed: 'not verified' }, null, 2));
  if (![200, 202].includes(response.status)) process.exit(1);
}
