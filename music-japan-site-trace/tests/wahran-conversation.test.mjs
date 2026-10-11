// Real production data and browser modules, executed in an isolated JS realm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const appDir=process.env.WAHRAN_APP_DIR||fileURLToPath(new URL('../next/public/wahran/',import.meta.url));
const html=readFileSync(join(appDir,'index.html'),'utf8');
const raw=JSON.parse(html.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const originalArabic=[...raw.words,...raw.lessons.flatMap(x=>x.lines)].map(x=>[x.id,x.ar,x.ipa]);
const realm=vm.createContext({});
const engineScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('root.WahranEngine=api'));
assert.ok(engineScript,'Real browser engine not found');
vm.runInContext(engineScript,realm);
for(const filename of ['japanese-data.js','conversation-course.js'])vm.runInContext(readFileSync(join(appDir,filename),'utf8'),realm,{filename});
const C=realm.WahranConversation,data=C.enrich(raw),old=realm.WahranEngine,E=C.extend(old.create(data));
const plain=x=>JSON.parse(JSON.stringify(x));
test('release has the English profile and bilingual teaching assets',()=>{assert.match(html,/name="wahran-version" content="1\.2\.0"/);assert.match(html,/I am…/);assert.match(html,/I’m speaking to…/);assert.match(html,/conversation-ui\.css/)});
test('all original Arabic, IPA and stable IDs are retained',()=>{assert.deepEqual(plain([...data.words,...data.lessons.flatMap(x=>x.lines)].map(x=>[x.id,x.ar,x.ipa])),originalArabic);assert.equal(data.words.length,500);assert.equal(data.lessons.flatMap(x=>x.lines).length,160);assert.equal(new Set(Array.from({length:10000},(_,n)=>E.combo(n).ar)).size,10000)});
test('all 660 fixed entries have Japanese meanings and usage notes',()=>{for(const x of [...data.words,...data.lessons.flatMap(l=>l.lines)]){assert.match(x.ja,/[ぁ-んァ-ン一-龯]/,x.id);assert.ok(x.usageJa.length>=12,x.id)}});
test('all 10000 combinations have Japanese meanings and explanations',()=>{for(let i=0;i<10000;i++){const x=E.combo(i);assert.match(x.ja,/[ぁ-んァ-ン一-龯]/);assert.ok(x.usageJa.length>=15);assert.ok(!/[{}]|undefined/.test(x.ja));assert.equal(E.entry(x.id).ja,x.ja)}});
for(const speaker of ['m','f'])for(const listener of ['m','f']){
const p={speaker,listener};
test(`${speaker}→${listener}: speaker and addressee agree independently`,()=>{assert.equal(C.visible(E.entry('l01-03'),p),listener==='m');assert.equal(C.visible(E.entry('l01-04'),p),listener==='f');assert.equal(C.visible(E.entry('l01-05'),p),speaker==='m');assert.equal(C.visible(E.entry('l01-06'),p),speaker==='f');assert.equal(C.visible(E.entry('l15-08'),p),speaker==='m'&&listener==='m')});
test(`${speaker}→${listener}: shared words, noun gender and third parties remain`,()=>{for(const id of ['l01-01','l01-02','l05-01','l05-02','l10-05','w104','w119','w120','w227'])assert.ok(C.visible(E.entry(id),p),id)});
test(`${speaker}→${listener}: 9800 matching combinations retain original identifiers`,()=>{assert.equal(Array.from({length:10000},(_,i)=>i).filter(i=>C.visible(E.combo(i),p)).length,9800);assert.equal(C.visible(E.combo(1400),p),listener==='m');assert.equal(C.visible(E.combo(1600),p),listener==='f')});
test(`${speaker}→${listener}: all guided scene models match chosen forms`,()=>{for(const s of C.scenes(data,p)){assert.ok(s.prompts.length);for(const [,id]of s.prompts)assert.ok(C.visible(E.entry(id),p),id)}});
}
test('cultural, sound and lesson explanations all include Japanese',()=>{for(const c of data.culture)assert.ok(c.textJa&&c.practiceJa);for(const s of data.sounds)assert.ok(s.textJa);for(const l of data.lessons)assert.ok(l.noteJa)});
test('invalid profiles cannot expose unfiltered learning items',()=>{for(const v of [null,{},[],{speaker:'m'},{speaker:'x',listener:'f'},{speaker:'m',listener:[]}]){assert.equal(C.validProfile(v),false);assert.equal(C.visible(E.entry('l01-01'),v),false)}});
test('older progress backups migrate without losing saved items',()=>{const before=old.create(data).emptyState();before.saved=['w001','l01-06'];let s=E.restore(JSON.stringify(before));assert.equal(s.profile,null);s.profile={speaker:'m',listener:'f'};assert.deepEqual(plain(E.restore(JSON.stringify(s)).saved),before.saved);assert.deepEqual(plain(E.restore(JSON.stringify(s)).profile),s.profile)});
test('invalid backup profile fails instead of silently changing settings',()=>{const s=E.emptyState();s.profile={speaker:'m',listener:'bad'};assert.throws(()=>E.restore(JSON.stringify(s)),/profile/i)});
test('repeated enrichment never rewrites Arabic or IPA',()=>{const before=plain(data.words.map(x=>[x.id,x.ar,x.ipa]));C.enrich(data);assert.deepEqual(plain(data.words.map(x=>[x.id,x.ar,x.ipa])),before)});
