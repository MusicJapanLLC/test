import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const base=new URL('../next/public/wahran/',import.meta.url);
const HTML=fs.readFileSync(new URL('index.html',base),'utf8');
const D=JSON.parse(HTML.match(/<script id="course-data" type="application\/json">(.*?)<\/script>/s)[1]);
const fixed=[...D.words,...D.lessons.flatMap(l=>l.lines)];
const ref=t=>'audio/'+createHash('sha256').update(t.trim()).digest('hex').slice(0,24)+'.mp3';
const M={version:2,voice:'ar-DZ-test',entries:Object.fromEntries(fixed.map(x=>[x.id,ref(x.ar)])),families:D.families.map(f=>({frames:f.frames.map(t=>ref(t.ar.split('{x}')[0])),items:f.items.map(x=>ref(x.ar)),contexts:f.contexts.map(x=>ref(x.ar))}))};
function api(){const file=new URL('hosted-audio.js',base);assert.ok(fs.existsSync(file),'Hosted audio implementation is missing');const c={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(file,'utf8'),c);return c.module.exports;}
class FakeAudio{
 static instances=[];constructor(){this.paths=[];this.currentTime=0;this.paused=true;FakeAudio.instances.push(this)}
 play(){this.paths.push(this.src);this.paused=false;if(this.fail)return Promise.reject(new Error('NotAllowedError'));const started=this.onplaying;const ended=this.onended;setTimeout(()=>{if(!this.paused){started?.();ended?.()}},2);return Promise.resolve()}
 pause(){this.paused=true}setAttribute(){}
}
function env(){return{Audio:FakeAudio,setTimeout,clearTimeout}}
test('all 660 fixed entries resolve to included audio without system voices',()=>{const get=api().createResolver(D,M);for(const x of fixed){const p=get(x.ar);assert.ok(p?.length);assert.equal(p.length,1);assert.match(p[0],/^audio\/[a-f0-9]{24}\.mp3$/)}});
test('every one of 10000 combinations has a complete one-or-three-file playlist',()=>{const get=api().createResolver(D,M);let n=0;for(const f of D.families)for(const t of f.frames)for(const x of f.items)for(const c of f.contexts){const p=get(t.ar.replace('{x}',x.ar).replace('{c}',c.ar));assert.ok(p&&(p.length===1||p.length===3));n++}assert.equal(n,10000)});
test('unrecognized text and external manifest paths are rejected',()=>{const A=api();assert.equal(A.createResolver(D,M)('not a course entry'),null);const bad=JSON.parse(JSON.stringify(M));bad.entries.w001='https://outside.invalid/a.mp3';assert.throws(()=>A.createResolver(D,bad),/audio path/i)});
test('one media element is reused across chunks and later requests',async()=>{const A=api();const p=new A.Player(env());const paths=[ref('one'),ref('two'),ref('three')];assert.equal(await p.play(paths,.75),true);assert.equal(p.audio.playbackRate,.75);assert.deepEqual(p.audio.paths,paths);const a=p.audio;assert.equal(await p.play([paths[0]],1),true);assert.equal(p.audio,a)});
test('stop settles an active request and suppresses stale completion',async()=>{const A=api();const p=new A.Player(env());const result=p.play([ref('one'),ref('two')]);const old=p.audio.onended;p.stop();old?.();assert.equal(await result,false);assert.equal(p.audio.paths.length,1)});
test('autoplay rejection is actionable and does not mention installing a voice',async()=>{const A=api();const p=new A.Player(env());p.audio.fail=true;await assert.rejects(p.play([ref('one')]),e=>/tap Listen/i.test(e.message)&&!/install/i.test(e.message))});
test('HTML media errors reject instead of waiting forever',async()=>{const A=api();const p=new A.Player(env());const promise=p.play([ref('one')]);p.audio.onerror();await assert.rejects(promise,/audio file/i)});
test('Speech adapter plays without speechSynthesis or any Arabic voice',async()=>{const A=api();class Base{constructor(e){this.env=e;this.active=false;this.token=0;this.onStatus=()=>{}}stop(){this.token++;this.active=false}play(){throw new Error('Device speech must not run')}}const e=env();e.WahranAudio={Speech:Base};A.install(e,D,M);const s=new e.WahranAudio.Speech(e);assert.equal(await s.play(fixed[0].ar,{rate:.85}),true);assert.equal(s.active,false)});
test('real audio pack covers the complete curriculum with nonempty MP3 assets',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('audio-manifest.js',base),'utf8'),context);
 const real=context.window.WahranFiles;assert.equal(real.entriesCount,660);assert.equal(real.combinationCount,10000);assert.match(real.voice,/^ar-DZ-/);
 const get=api().createResolver(D,real);const files=new Set();
 for(const x of fixed)for(const p of get(x.ar))files.add(p);
 for(const f of D.families)for(const t of f.frames)for(const x of f.items)for(const c of f.contexts)for(const p of get(t.ar.replace('{x}',x.ar).replace('{c}',c.ar)))files.add(p);
 for(const file of files)assert.ok(fs.statSync(new URL(file,base)).size>=1000,file+' is missing or empty');
 assert.equal(files.size,real.filesCount);
});
