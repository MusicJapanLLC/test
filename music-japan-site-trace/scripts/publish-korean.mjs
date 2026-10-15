// Byte-verified Korean learning app. No private source logs are deployed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const SHA256='3da5e732b47401cea010b64ded1086d9af773688f1b1c03f88e50dd5e90650c3';
const RULE='\n# BEGIN KOREAN MOBILE\n/korean/*\n  ! Permissions-Policy\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: public, max-age=0, must-revalidate\n# END KOREAN MOBILE\n';
export function publishKorean(root=fileURLToPath(new URL('..',import.meta.url))){
  const source=readFileSync(join(root,'learning/korean/index.html'));
  const hash=createHash('sha256').update(source).digest('hex');
  if(hash!==SHA256)throw new Error('Korean source integrity check failed');
  const output=join(root,'deploy-dist'),path=join(output,'_headers');
  const headers=readFileSync(path,'utf8').replace(/\r?\n# BEGIN KOREAN MOBILE\r?\n[\s\S]*?# END KOREAN MOBILE\r?\n/g,'');
  mkdirSync(join(output,'korean'),{recursive:true});
  writeFileSync(join(output,'korean/index.html'),source);
  // Browser microphone permission is still required. Other paths remain unchanged.
  writeFileSync(path,headers+RULE);
  console.log(`Korean ready at /korean/: ${source.length} bytes; sha256 ${hash}`);
}
