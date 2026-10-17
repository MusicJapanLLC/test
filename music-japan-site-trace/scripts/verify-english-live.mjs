/** Read-only release check against the explicit official English-app URL. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=join(root,'deploy-dist/english');
const out=join(root,'artifacts/english-browser');
const origin='https://music-japan.com';
const expected=JSON.parse(await readFile(join(dir,'build-manifest.json'),'utf8'));
const started=Date.now();
const report={startedAt:new Date().toISOString(),origin,expectedRevision:expected.revision,status:'running',checks:[]};
await mkdir(out,{recursive:true});

async function get(path){
  const response=await fetch(origin+path,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(response.status,200,`${path}: expected HTTP 200`);
  assert.equal(new URL(response.url).origin,origin,`${path}: unexpected origin`);
  assert.equal(response.headers.get('x-robots-tag')?.includes('noindex')||false,false,`${path}: HTTP noindex`);
  return response;
}

try{
  // A provider build may still be running after GitHub's build. Check for at most 10 minutes.
  let observed;
  while(Date.now()-started<600000){
    try{observed=await (await get('/english/build-manifest.json?release='+expected.revision)).json();}catch(error){observed={error:error.message};}
    if(observed.revision===expected.revision)break;
    console.log('Waiting for official English deployment:',JSON.stringify(observed));
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  assert.equal(observed?.revision,expected.revision,'The official domain did not serve this tested English revision');
  report.observedManifest=observed;
  for(const file of ['base.css','style.css','app.js','arcade.js','engine.js','course.js','og.png','icon.svg','manifest.webmanifest','CMU-LICENSE.txt']){
    const actual=Buffer.from(await (await get('/english/'+file+'?release='+expected.revision)).arrayBuffer());
    const local=await readFile(join(dir,file));
    assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(local).digest('hex'),`Live asset mismatch: ${file}`);
    report.checks.push({path:'/english/'+file,bytes:actual.length,sha256:createHash('sha256').update(actual).digest('hex')});
  }
  for(const path of expected.urls){
    const response=await get(path+'?release='+expected.revision);
    const html=await response.text();
    assert.ok(html.includes('href="'+origin+path+'"'),`Missing canonical ${path}`);
    assert.ok(/<h1[ >]/.test(html),`Missing h1 ${path}`);
    assert.ok(html.includes('BreadcrumbList'),`Missing breadcrumb schema ${path}`);
    assert.ok(!/<meta[^>]+(?:name="robots"[^>]+content="[^"]*noindex|content="[^"]*noindex[^>]+name="robots")/.test(html),`HTML noindex ${path}`);
    if(path.startsWith('/english/')){
      assert.ok(html.includes('data-content-revision="'+expected.revision+'"'),`Live HTML revision mismatch ${path}`);
      const local=await readFile(join(root,'deploy-dist',path.slice(1),'index.html'),'utf8');
      const title=value=>value.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const schema=value=>JSON.parse(value.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]||'null');
      const mainText=value=>(value.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      assert.equal(title(html),title(local),`Live title mismatch ${path}`);
      assert.deepEqual(schema(html),schema(local),`Live structured data mismatch ${path}`);
      assert.ok(mainText(local).length>100,`Expected readable body is empty ${path}`);
      assert.equal(mainText(html),mainText(local),`Live readable lesson content mismatch ${path}`);
    }else if(path==='/learning/')assert.ok(html.includes('href="/english/"'),'Learning hub does not link the new English app');
    report.checks.push({path,status:response.status,canonical:true,contentVerified:path.startsWith('/english/')});
  }
  const sitemap=await (await get('/sitemap.xml')).text();
  for(const path of expected.urls)assert.ok(sitemap.includes('<loc>'+origin+path+'</loc>'),`Sitemap omits ${path}`);
  for(const path of ['/llms.txt','/llms-full.txt','/english/llms.txt']){
    const body=await (await get(path)).text();
    assert.ok(body.includes(origin+'/english/'),`${path} omits the English canonical URL`);
    report.checks.push({path,englishLinked:true});
  }
  report.status='passed';
  report.finishedAt=new Date().toISOString();
  console.log(JSON.stringify(report,null,2));
}catch(error){
  report.status='failed';report.error=error.stack||String(error);process.exitCode=1;
  console.error(report.error);
}finally{
  await writeFile(join(out,'live-report.json'),JSON.stringify(report,null,2)+'\n');
}
