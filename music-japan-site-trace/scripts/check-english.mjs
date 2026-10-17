import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnglish,validateEnglish} from './publish-english.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const out=process.argv[2]||join(root,'deploy-dist'),data=loadEnglish(root),counts=validateEnglish(data);
const manifest=JSON.parse(readFileSync(join(out,'english/build-manifest.json'),'utf8')),errors=[];
const sitemap=readFileSync(join(out,'sitemap.xml'),'utf8'),titles=new Set(),descriptions=new Set();
for(const route of manifest.urls){const path=join(out,route,'index.html');if(!existsSync(path)){errors.push('Missing '+route);continue;}const html=readFileSync(path,'utf8');const head=html.match(/<head>([\s\S]*?)<\/head>/)?.[1]||'';
 const title=head.match(/<title>(.*?)<\/title>/)?.[1],desc=head.match(/<meta name="description" content="([^"]+)"/)?.[1];
 if(!title||titles.has(title))errors.push('Missing/duplicate title '+route);titles.add(title);
 if(!desc||desc.length<30||descriptions.has(desc))errors.push('Missing/duplicate description '+route);descriptions.add(desc);
 if(!head.includes(`rel="canonical" href="https://music-japan.com${route}"`))errors.push('Canonical '+route);
 if(!sitemap.includes(`<loc>https://music-japan.com${route}</loc>`))errors.push('Sitemap '+route);
 if((html.match(/<h1[\s>]/g)||[]).length!==1)errors.push('H1 '+route);
 if(!/<nav\b[^>]*class="[^"]*\b(?:crumbs|learning-breadcrumb)\b/.test(html))errors.push('Visible breadcrumb '+route);
 for(const match of html.matchAll(/(?:href|src)="(\/(?!\/)[^"]+)"/g)){const target=match[1].split(/[?#]/)[0],file=join(out,target,target.endsWith('/')?'index.html':'');if(!existsSync(file))errors.push(`${route}: missing ${target}`);}
 const graph=JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)?.[1]||'{}')['@graph'];if(!graph?.some(x=>x['@type']==='BreadcrumbList'))errors.push('Breadcrumb data '+route);
 if(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(head))errors.push('Noindex '+route);
}
for(const file of ['course.js','engine.js','arcade.js','app.js','style.css','base.css','og.png','CMU-LICENSE.txt','llms.txt','sitemap.xml','manifest.webmanifest'])if(!existsSync(join(out,'english',file)))errors.push('Asset '+file);
for(const file of ['llms.txt','llms-full.txt'])if(!readFileSync(join(out,file),'utf8').includes('https://music-japan.com/english/'))errors.push('Root discovery '+file);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(JSON.stringify({status:'PASS',scope:'English pages and discovery integration',revision:manifest.revision,...counts,pages:manifest.urls.length,errors:0}));
