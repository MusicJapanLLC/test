import assert from 'node:assert/strict';
globalThis.HTMLRewriter=class {
  handlers=[];
  on(selector,handler){this.handlers.push([selector,handler]);return this;}
  async transform(response){let html=await response.text();for(const [selector,h] of this.handlers)h.element({append(value){html=html.replace(`</${selector}>`,value+`</${selector}>`);}});return new Response(html,response);}
};
for(const route of ['world']){
  const {default:worker}=await import(`./${route}-proxy.mjs`);
  let observed;
  globalThis.fetch=async req=>{observed=req;return new Response('<html><head></head><body>Original game</body></html>',{headers:{'content-type':'text/html','set-cookie':'upstream=private'}});};
  const html=await worker.fetch(new Request(`https://game.music-japan.com/${route}/`,{headers:{cookie:'private=1',authorization:'Bearer private'}}));
  const text=await html.text();
  assert.equal((text.match(/data-ga4-id=/g)||[]).length,1);
  assert.ok(text.includes('Original game'));
  assert.ok(text.includes('https://music-japan.com/privacy/'));
  assert.equal(html.headers.has('set-cookie'),false);
  assert.equal(observed.headers.has('cookie'),false);
  assert.equal(observed.headers.has('authorization'),false);
  globalThis.fetch=async()=>new Response('const originalGameBytes=1;',{headers:{'content-type':'application/javascript'}});
  const asset=await worker.fetch(new Request(`https://game.music-japan.com/${route}/engine.js?v=19`));
  assert.equal(await asset.text(),'const originalGameBytes=1;');
  const redirect=await worker.fetch(new Request(`https://game.music-japan.com/${route}`));
  assert.equal(redirect.status,308);
  assert.equal(redirect.headers.get('location'),`https://game.music-japan.com/${route}/`);
  console.log(`${route}: HTML tag, privacy link, unchanged assets, credential stripping and redirect passed`);
}
{
  const {default:worker}=await import('./fire-proxy.mjs');
  let called=false;
  globalThis.fetch=async()=>{called=true;return new Response('upstream');};
  for(const path of ['/fire','/fire/','/fire/game.js?v=19','/fire/api/commerce/status']){
    const res=await worker.fetch(new Request(`https://game.music-japan.com${path}`,{headers:{cookie:'private=1'}}));
    assert.equal(res.status,302);
    assert.equal(res.headers.get('location'),'https://store.music-japan.com/games/');
  }
  assert.equal(called,false);
  await worker.fetch(new Request('https://game.music-japan.com/firewood'));
  assert.equal(called,true);
  console.log('fire: closed, every /fire path redirects to the store without contacting the old upstream');
}
