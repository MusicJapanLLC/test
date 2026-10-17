import { readFile } from 'node:fs/promises';
import { evaluateThreePlatformAcceptance } from '../src/acceptance.mjs';
const path = process.argv[2];
if (!path) {
 console.error('E2E_NOT_VERIFIED: provide a local evidence-metadata JSON path (no raw media or credentials)');
 process.exitCode=2;
} else {
 let data;
 try { data=JSON.parse(await readFile(path,'utf8')); }
 catch { console.error('E2E_NOT_VERIFIED: evidence metadata unavailable');process.exitCode=2; }
 if (data) {
  const result=evaluateThreePlatformAcceptance(data);
  console.log(JSON.stringify(result,null,2));
  if (!result.productionReady) process.exitCode=2;
 }
}
