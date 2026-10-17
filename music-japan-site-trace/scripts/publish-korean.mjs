// Byte-verified Korean learning app. No private source logs are deployed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const SHA256='4e03a6c8fcd7edfb05aa1c6234c4be0598790ab5a624f8cf12bcadf05c97f843';
const RULE='\n# BEGIN KOREAN MOBILE\n/korean/*\n  ! Permissions-Policy\n  Cache-Control: public, max-age=0, must-revalidate\n# END KOREAN MOBILE\n';
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
