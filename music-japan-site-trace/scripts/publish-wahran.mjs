// Add the self-contained learning app without changing the official site's pages.
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const EXPECTED_SHA256='8738826cb4dd06301b837fb61592fde36faed534cfb49eb8f5ef075b1cb6d4fe';
const RULE='\n# BEGIN WAHRAN MOBILE\n/wahran/*\n  ! Permissions-Policy\n  X-Robots-Tag: noindex, nofollow\n# END WAHRAN MOBILE\n';
export function publishWahran(root=fileURLToPath(new URL('..',import.meta.url))) {
  const source=readFileSync(join(root,'next/public/wahran/index.html'));
  const sha=createHash('sha256').update(source).digest('hex');
  if(sha!==EXPECTED_SHA256) throw new Error('Wahran source integrity check failed');
  const output=join(root,'deploy-dist');
  const headersPath=join(output,'_headers');
  const headers=readFileSync(headersPath,'utf8').replace(/\n# BEGIN WAHRAN MOBILE\n[\s\S]*?# END WAHRAN MOBILE\n/g,'');
  mkdirSync(join(output,'wahran'),{recursive:true});
  cpSync(join(root,'next/public/wahran'),join(output,'wahran'),{recursive:true});
  // The global deny policy stays intact for every other path. On this path,
  // remove that policy; the browser's default same-origin microphone policy
  // still requires an explicit user permission prompt. No recording is uploaded.
  writeFileSync(headersPath,headers+RULE);
  console.log(`Wahran ready at /wahran/: ${source.length} bytes; sha256 ${sha}`);
}
