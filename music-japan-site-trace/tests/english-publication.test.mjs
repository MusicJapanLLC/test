import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadEnglish,validateEnglish,publishEnglish} from '../scripts/publish-english.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),data=loadEnglish(root);
test('complete authored curriculum:200 distinct targets,24 conversations,IPA and exact example chunks',()=>{
 const counts=validateEnglish(data);assert.equal(counts.units,200);assert.equal(counts.dialogues,24);assert.equal(counts.lines,240);
 const keys=data.units.map(u=>u.en.toLowerCase().replace(/[.…]/g,'').replace(/\s+/g,' ').trim());
 assert.equal(new Set(keys).size,200,'Learning targets must not be counted twice');
 assert.equal(data.units.filter(u=>u.kind==='chunk').length,100);assert.equal(data.units.filter(u=>u.kind==='vocabulary').length,60);assert.equal(data.units.filter(u=>u.kind==='grammar').length,40);
 for(const u of data.units)for(const x of u.examples){assert.ok(x.en.split(/\s+/).length>=16,`${u.id} should demonstrate a developed sentence`);assert.ok(u.explanation.length>=50,`${u.id} needs useful Japanese teaching`);assert.doesNotMatch(u.en+x.en+u.ipa+x.ipa,/[\u3040-\u30ff]/);}
 const urls=data.sources.filter(s=>s.status==='reviewed').map(s=>new URL(s.url).href.replace(/\/$/,''));assert.equal(new Set(urls).size,urls.length,'Source counts must be deduplicated');
});
test('English publication is reproducible, scoped and source/license complete',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'mj-english-publication-'));
 try{cpSync(join(root,'learning/english'),join(tmp,'learning/english'),{recursive:true});mkdirSync(join(tmp,'deploy-dist'),{recursive:true});
 const skeleton={'_headers':'/*\n  Permissions-Policy: microphone=()\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex\n','sitemap.xml':'<urlset><url><loc>https://music-japan.com/</loc></url></urlset>','llms.txt':'# Existing site\n','llms-full.txt':'# Existing full site\n'};
 for(const [name,body] of Object.entries(skeleton))writeFileSync(join(tmp,'deploy-dist',name),body);
 const first=publishEnglish(tmp),files=['_headers','sitemap.xml','llms.txt','llms-full.txt','english/index.html','learning/index.html'];
 const bytes=files.map(f=>readFileSync(join(tmp,'deploy-dist',f),'utf8'));const second=publishEnglish(tmp);assert.deepEqual(second,first);assert.deepEqual(files.map(f=>readFileSync(join(tmp,'deploy-dist',f),'utf8')),bytes);
 assert.ok(bytes[0].startsWith(skeleton._headers));assert.doesNotMatch(bytes[0].slice(skeleton._headers.length),/Permissions-Policy|noindex/);
 assert.equal(readFileSync(join(tmp,'deploy-dist/english/CMU-LICENSE.txt'),'utf8'),readFileSync(join(root,'learning/english/CMU-LICENSE.txt'),'utf8'));
 const allRoutes=first.urls;for(const route of allRoutes){const html=readFileSync(join(tmp,'deploy-dist',route,'index.html'),'utf8');assert.ok(html.includes(`href="https://music-japan.com${route}"`));assert.equal((html.match(/<h1[\s>]/g)||[]).length,1);assert.doesNotMatch(html,/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/);const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1])['@graph'];assert.ok(graph.some(x=>x['@type']==='BreadcrumbList'));assert.doesNotMatch(html,/hreflang=/,'Distinct courses are not invented language translations');}
 assert.ok(readFileSync(join(tmp,'deploy-dist/learning/index.html'),'utf8').includes('href="/english/"'));
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('invalid English data fails before adding public files',()=>{
 const bad=structuredClone(data);bad.units[0].examples[0].chunks.pop();assert.throws(()=>validateEnglish(bad),/chunk coverage/);
 const badSource=structuredClone(data);badSource.units[0].sourceIds=['unavailable-fake'];assert.throws(()=>validateEnglish(badSource),/unreviewed/);
});
