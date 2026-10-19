import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const code = () => readFileSync(new URL('../next/public/analytics.js', import.meta.url), 'utf8');
function browser(url, attrs = {}) {
  const location = new URL(url), listeners = {}, scripts = [];
  const tag = { getAttribute: key => ({'data-ga4-id':'G-S2P0JCW50M','data-ga4-host':'music-japan.com',...attrs}[key] ?? null) };
  const window = {addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
  const history = {pushState(_state,_title,url){ if(url) location.href = new URL(url,location).href; },replaceState(_state,_title,url){if(url) location.href = new URL(url,location).href;}};
  const document = {currentScript:tag,title:'Public lesson',referrer:'https://example.com/start?email=private#secret',head:{appendChild:s=>scripts.push(s)},createElement:()=>({})};
  const context = vm.createContext({window,document,location,history,URL,Date});
  const run=()=>vm.runInContext(code(),context);
  const events=()=>Array.from(window.dataLayer??[]).map(x=>Array.from(x)).filter(x=>x[0]==='event'&&x[1]==='page_view');
  return {run,events,window,location,listeners,scripts,history};
}
test('one explicit initial view excludes URL queries, private fragments and referrer queries',()=>{
  const b=browser('https://music-japan.com/korean/?email=private#secret');b.run();
  assert.equal(b.events().length,1);
  assert.equal(b.events()[0][2].page_location,'https://music-japan.com/korean/');
  assert.equal(b.events()[0][2].page_referrer,'https://example.com/start');
  const config=Array.from(b.window.dataLayer).map(x=>Array.from(x)).find(x=>x[0]==='config');
  assert.equal(config[2].send_page_view,false);
  assert.equal(config[2].allow_ad_personalization_signals,false);
});
test('local and preview hosts send nothing; repeated installation cannot double count',()=>{
  for(const url of ['http://localhost:5173/','https://preview.music-japan.pages.dev/']){const b=browser(url);b.run();assert.equal(b.events().length,0);assert.equal(b.scripts.length,0);}
  const b=browser('https://music-japan.com/');b.run();b.run();assert.equal(b.events().length,1);assert.equal(b.scripts.length,1);
});
test('public app routes are distinct and repeated hash/history notifications count once',()=>{
  const b=browser('https://music-japan.com/english/#learn',{'data-ga4-router':'learning'});b.run();
  assert.equal(b.events()[0][2].page_location,'https://music-japan.com/english/_view/learn');
  b.location.hash='#lesson/business-01';b.listeners.hashchange[0]();b.listeners.popstate[0]();
  assert.equal(b.events().length,2);assert.equal(b.events()[1][2].page_location,'https://music-japan.com/english/_view/lesson');
  b.location.hash='#reset-password/private-token';b.listeners.hashchange[0]();
  assert.equal(b.events().at(-1)[2].page_location,'https://music-japan.com/english/');
  b.history.pushState(null,'','/english/?token=private#reset-password/private-token');assert.equal(b.events().length,3);
});
test('real English screens count correctly, default learn is stable and private suffixes never leave the browser',()=>{
  const b=browser('https://music-japan.com/english/',{'data-ga4-router':'learning'});b.run();
  b.location.hash='#learn';b.listeners.hashchange[0]();assert.equal(b.events().length,1);
  b.location.hash='#learn/private-token-123';b.listeners.hashchange[0]();assert.equal(b.events().length,1);
  for(const hash of ['#library','#practice','#session','#quest','#topic/work','#unit/work-001','#unit/work-002']) {b.location.hash=hash;b.listeners.hashchange[0]();}
  assert.equal(b.events().length,8);
  assert.deepEqual(b.events().slice(-2).map(e=>e[2].page_location),['https://music-japan.com/english/_view/unit','https://music-japan.com/english/_view/unit']);
  assert.ok(!JSON.stringify(b.window.dataLayer).includes('private-token-123'));
});
test('build integration adds one production tag to learning and nested pages and updates conflicting disclosure',async()=>{
  const {publishAnalytics}=await import('../scripts/publish-analytics.mjs');
  const root=mkdtempSync(join(tmpdir(),'mj-ga4-'));
  try {
    mkdirSync(join(root,'deploy-dist/english/topics/work'),{recursive:true});
    mkdirSync(join(root,'deploy-dist/korean'),{recursive:true});
    mkdirSync(join(root,'next/public'),{recursive:true});
    writeFileSync(join(root,'next/public/analytics.js'),code());
    writeFileSync(join(root,'deploy-dist/english/topics/work/index.html'),'<html><head><title>Work</title></head><body>Lesson</body></html>');
    writeFileSync(join(root,'deploy-dist/korean/index.html'),`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src data:; form-action 'none'"></head><body>No account or app analytics.</body></html>`);
    publishAnalytics(root);publishAnalytics(root);
    for(const path of ['english/topics/work/index.html','korean/index.html']){const html=readFileSync(join(root,'deploy-dist',path),'utf8');assert.equal((html.match(/data-ga4-id=/g)??[]).length,1);assert.ok(html.includes('data-ga4-host="music-japan.com"'));assert.ok(!html.includes('No account or app analytics'));}
    assert.ok(readFileSync(join(root,'deploy-dist/korean/index.html'),'utf8').includes('Google Analytics 4'));
    const csp=readFileSync(join(root,'deploy-dist/korean/index.html'),'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    const directives=Object.fromEntries(csp.split(';').map(x=>x.trim().split(/\s+/)).map(([name,...sources])=>[name,sources]));
    assert.ok(directives['script-src'].includes("'self'"));
    assert.ok(directives['script-src'].includes('https://www.googletagmanager.com'));
    assert.ok(directives['connect-src'].includes('https://*.google-analytics.com'));
    assert.ok(!directives['connect-src'].includes("'none'"));
    assert.deepEqual(directives['form-action'],["'none'"]);
    assert.deepEqual(directives['default-src'],["'none'"]);
  } finally {rmSync(root,{recursive:true,force:true});}
});
