import test from 'node:test';
import assert from 'node:assert/strict';
import { phrases } from '../src/typeset.js';

const flat = text => phrases(text).map(line => line.filter(p => p.trim()));

test('punctuation and particles never start a phrase',()=>{
  for (const text of ['聴く時間そのものを、ブランドにする。','日本から。音楽と物語を、記憶に残る形へ。','音楽は、ジャンルを越えて残っていく。']) {
    for (const phrase of flat(text).flat()) assert.doesNotMatch(phrase, /^[、。をにのはがへと]/, `${text} → ${phrase}`);
  }
});
test('authored line breaks become separate lines',()=>{
  assert.deepEqual(flat('人生の困難や逆境を\n自分を彩る表現へと昇華する。'),[['人生の','困難や','逆境を'],['自分を','彩る','表現へと','昇華する。']]);
});
test('compounds, brackets and honorific prefixes stay together',()=>{
  const all = flat('Podcast出演、インタビュー掲載、Batonや協業についてご相談ください。「取材・発信」').flat();
  assert.ok(all.includes('インタビュー掲載、'));
  assert.ok(all.includes('「取材・発信」'));
  assert.ok(all.some(p => p.includes('ご相談')));
});
test('text is preserved exactly',()=>{
  const text = '経営者の決断や苦悩をPodcast×記事に残し、それが次のつながりを生む。';
  assert.equal(phrases(text).flat().join(''), text);
});
