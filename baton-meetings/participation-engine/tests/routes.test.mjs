import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserAdapter } from '../src/adapters.mjs';
import { ParticipationEngine, parseMeetingUrl, defaultRoutes } from '../src/core.mjs';

const url = 'https://zoom.us/j/123456789?pwd=test-token';
const context = { platform: 'zoom', meetingUrl: url, browserProfile: 'C:\\test\\meeting-profiles', browserChannel:'msedge', displayName:'Music Japan AI', joinTimeoutMs: 1 };
function pageMock({ status=403, landing=false }={}) {
  let clicks=0;
  const page={
    goto:async()=>({status:()=>status}),
    getByRole:(role,{name})=>({first:()=>({
      isVisible:async()=>landing && role==='button' && name.test('Join from browser'),
      click:async()=>{clicks++;},
      fill:async()=>{},
    })}),
    locator:()=>({ innerText:async()=>'Join from browser' }),
    isClosed:()=>false,
    evaluate:async()=>0,
  };
  return {page,clicks:()=>clicks};
}
test('default routing independently tries Edge, Chrome, Recall, then official desktop client',()=>{
  assert.deepEqual(defaultRoutes('zoom'), ['edge','chrome','recall','desktop']);
});
test('Edge and Chrome use independent profile paths, not the signed-in regular browser',async()=>{
  const observed=[];
  const fake={chromium:{launchPersistentContext:async(profile,config)=>{
    observed.push({profile,channel:config.channel});
    return {pages:()=>[pageMock().page],close:async()=>{}};
  }}};
  const edge=createBrowserAdapter({channel:'msedge',playwrightProvider:async()=>fake,pause:async()=>{}});
  const chrome=createBrowserAdapter({channel:'chrome',playwrightProvider:async()=>fake,pause:async()=>{}});
  const e=await edge.join(context);
  const c=await chrome.join(context);
  assert.equal(e.state,'FAILED');
  assert.equal(c.state,'FAILED');
  assert.equal(e.code,'BROWSER_HTTP_403');
  assert.equal(c.code,'BROWSER_HTTP_403');
  assert.equal(observed[0].channel,'msedge');
  assert.equal(observed[1].channel,'chrome');
  assert.notEqual(observed[0].profile,observed[1].profile);
});
test('Zoom link landing page that never transitions is a confirmed non-join',async()=>{
  const {page,clicks}=pageMock({status:200,landing:true});
  let closed=0;
  const fake={chromium:{launchPersistentContext:async()=>({pages:()=>[page],close:async()=>{closed++;}})}};
  const adapter=createBrowserAdapter({playwrightProvider:async()=>fake,pause:async()=>{}});
  const out=await adapter.join(context);
  assert.equal(out.state,'FAILED');
  assert.equal(out.code,'ZOOM_WEB_ENTRY_STALLED');
  assert.ok(clicks()>=1);
  assert.equal(closed,1);
});
test('technical browser failure proceeds to next allowed route without false joined',async()=>{
  const adapters={
    edge:{probe:async()=>({available:true}),join:async()=>({state:'FAILED',code:'BROWSER_HTTP_403'})},
    chrome:{probe:async()=>({available:false,code:'LOW_AVAILABLE_MEMORY'}),join:async()=>{throw Error('must-not-launch');}},
    recall:{probe:async()=>({available:false,code:'RECALL_KEY_MISSING'}),join:async()=>{throw Error('no-key');}},
    desktop:{probe:async()=>({available:true}),join:async()=>({state:'LAUNCHED_UNVERIFIED',code:'OS_MEETING_HANDLER_LAUNCHED'})},
  };
  const run=await new ParticipationEngine({adapters}).join({meetingUrl:url,authorized:true,recordingConsentConfirmed:true,live:true});
  assert.equal(run.status,'LAUNCHED_UNVERIFIED');
  assert.equal(run.history.length,4);
  assert.equal(run.history[0].state,'FAILED');
  assert.equal(run.history[3].state,'LAUNCHED_UNVERIFIED');
});
test('host denial halts all alternate routes even with multiple browsers',async()=>{
  let called=0;
  const run=await new ParticipationEngine({adapters:{
    edge:{join:async()=>({state:'HOST_DENIED',code:'HOST_REFUSED_ADMISSION'})},
    chrome:{join:async()=>{called++;return{state:'JOINED'};}},
  }}).join({meetingUrl:url,authorized:true,recordingConsentConfirmed:true,live:true,routes:['edge','chrome']});
  assert.equal(run.status,'HOST_DENIED');
  assert.equal(called,0);
});
test('different URL access tokens to same meeting preserve meeting lock identity',()=>{
  const a=parseMeetingUrl(url);
  const b=parseMeetingUrl('https://us04web.zoom.us/j/123456789?pwd=another-token');
  assert.equal(a.meetingHash,b.meetingHash);
});
