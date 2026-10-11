// Builds public/data/*.json from the plain-text content in content/.
// - content/cards/*.txt : chunk cards (one block per card, format below)
// - content/words/*.txt : word lines  "word | pos | ja | short English | example | tags"
// American IPA comes from the CMU Pronouncing Dictionary (BSD license), not from hand typing.
// Run with --check to fail on any validation error.
//
// Card block:
//   # head phrase
//   @ source | scene, scene | real|textbook|cringe | vibe, vibe | freq 1-3 [| rare, explicit]
//   = 日本語の意味
//   : short English meaning (optional)
//   A: / B: / C: dialogue line   or   - example line
//   ~ sounds like
//   ✗ unnatural version | textbook|cringe | 日本語メモ
//   ✓ natural version | 日本語メモ
//   ? why it works (grammar, JA)
//   ! culture note (JA)
//   " quoted line            — attribution (next line starts with —)
//   > song / show reference  (Artist — Title)
//   ^ citation | https://doi.org/...
//   ipa /override/

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHECK = process.argv.includes('--check');
const SOURCES = ['talk', 'songs', 'movies', 'books', 'science', 'comedy'];
const SCENES = [
  'cafe', 'bar', 'pickup', 'crush', 'dm', 'gym', 'work', 'business', 'money', 'paperwork', 'travel', 'phone',
  'online', 'friends', 'conflict', 'feelings', 'daily', 'food', 'music', 'study', 'faith', 'health', 'shopping',
];
const REAL = ['real', 'textbook', 'cringe'];
const VIBES = ['warm', 'chill', 'cold', 'rude', 'flirty', 'worksafe', 'funny', 'deep'];
const POS = ['n', 'v', 'adj', 'adv', 'phr', 'int', 'prep', 'conj', 'pron', 'det', 'abbr'];

const errors = [];
const warn = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

// ── CMU dictionary → IPA ──
const cmuPath = path.join(root, '.cache/cmudict.dict');
async function ensureCmu() {
  if (fs.existsSync(cmuPath)) return;
  fs.mkdirSync(path.dirname(cmuPath), { recursive: true });
  await new Promise((resolve, reject) => {
    https.get('https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict', (res) => {
      if (res.statusCode !== 200) return reject(new Error(`cmudict ${res.statusCode}`));
      const out = fs.createWriteStream(cmuPath);
      res.pipe(out);
      out.on('finish', resolve);
    }).on('error', reject);
  });
}

const V = { AA: 'ɑ', AE: 'æ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' };
const C = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p',
  R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
const ONSETS = new Set([
  'p l', 'b l', 'k l', 'g l', 'f l', 's l', 'p r', 'b r', 't r', 'd r', 'k r', 'g r', 'f r', 'th r', 'sh r', 's p', 's t', 's k',
  's m', 's n', 's w', 't w', 'd w', 'k w', 'g w', 'th w', 's p l', 's p r', 's t r', 's k r', 's k w', 'p y', 'b y', 'k y',
  'm y', 'f y', 'v y', 'hh y', 'g y', 's k y',
].map((s) => s.toUpperCase()));

function arpaToIpa(phones) {
  const ph = phones.map((p) => {
    const m = p.match(/^([A-Z]+)([012])?$/);
    return { base: m[1], stress: m[2] };
  });
  const vowels = ph.filter((p) => p.stress !== undefined).length;
  const out = [];
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.stress === undefined) { out.push({ s: C[p.base] ?? p.base.toLowerCase(), v: false, base: p.base }); continue; }
    let s;
    if (p.base === 'AH') s = p.stress === '0' ? 'ə' : 'ʌ';
    else if (p.base === 'ER') s = p.stress === '0' ? 'ɚ' : 'ɝ';
    else s = V[p.base];
    out.push({ s, v: true, stress: p.stress, base: p.base });
  }
  if (vowels > 1) {
    // place stress marks before the syllable onset (maximal legal onset)
    for (let i = 0; i < out.length; i++) {
      const o = out[i];
      if (!o.v || o.stress === '0') continue;
      let j = i;
      while (j > 0 && !out[j - 1].v) {
        const cluster = out.slice(j - 1, i).map((x) => x.base).join(' ');
        if (i - (j - 1) === 1 ? out[j - 1].base !== 'NG' : ONSETS.has(cluster)) j--;
        else break;
      }
      o.mark = o.stress === '1' ? 'ˈ' : 'ˌ';
      out[j].pre = (out[j].pre ?? '') + o.mark;
    }
  }
  return out.map((o) => (o.pre ?? '') + o.s).join('');
}

let CMU = null;
function loadCmu() {
  CMU = new Map();
  for (const line of fs.readFileSync(cmuPath, 'utf8').split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const [w, ...rest] = line.replace(/#.*$/, '').trim().split(/\s+/);
    if (!w || w.includes('(')) continue;
    if (!CMU.has(w)) CMU.set(w, rest);
  }
}
function ipaWord(word) {
  const w = word.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '');
  if (!w) return '';
  const p = CMU.get(w);
  return p ? arpaToIpa(p) : null;
}
function ipaPhrase(text) {
  const words = text.replace(/[~…/()]/g, ' ').replace(/\b(sb|sth|someone|something)\b/gi, '$1').split(/\s+/).filter(Boolean);
  const parts = [];
  for (const w of words) {
    if (/^[A-Z]+$/.test(w) && w.length > 1 && !CMU.has(w.toLowerCase())) return null;
    const ip = ipaWord(w);
    if (ip === null) return null;
    if (ip) parts.push(ip);
  }
  return parts.join(' ');
}

const slug = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'x';

// ── parse cards ──
function parseCards(file) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const cards = [];
  let c = null;
  let lastQuote = null;
  text.split('\n').forEach((raw, n) => {
    const line = raw.trimEnd();
    const where = `${rel}:${n + 1}`;
    if (!line.trim() || line.startsWith('//')) return;
    if (line.startsWith('# ')) {
      c = { head: line.slice(2).trim(), where, l: [], x: [], v: [] };
      cards.push(c);
      lastQuote = null;
      return;
    }
    if (!c) return fail(where, 'line outside a card');
    const tag = line.match(/^(@|=|:|~|✗|✓|\?|!|"|—|>|\^|-|[A-D]:|ipa)\s?(.*)$/);
    if (!tag) return fail(where, `unknown line: ${line.slice(0, 40)}`);
    const [, k, body] = tag;
    const val = body.trim();
    switch (k) {
      case '@': {
        const [source, scenes, real, vibes, freq, flags = ''] = val.split('|').map((s) => s.trim());
        c.s = source; c.sc = scenes ? scenes.split(',').map((s) => s.trim()).filter(Boolean) : [];
        c.re = real; c.vb = vibes ? vibes.split(',').map((s) => s.trim()).filter(Boolean) : []; c.f = Number(freq);
        for (const fl of flags.split(',').map((s) => s.trim()).filter(Boolean)) {
          if (fl === 'rare') c.rare = 1; else if (fl === 'explicit') c.e = 1; else fail(where, `unknown flag ${fl}`);
        }
        break;
      }
      case '=': c.ja = val; break;
      case ':': c.d = val; break;
      case '~': c.sl = val; break;
      case '✗': { const [t, lab, note] = val.split('|').map((s) => s.trim()); c.x.push([t, lab || 'textbook', note || '']); if (!['textbook', 'cringe'].includes(lab || 'textbook')) fail(where, `bad ✗ label ${lab}`); break; }
      case '✓': { const [t, note] = val.split('|').map((s) => s.trim()); c.v.push([t, note || '']); break; }
      case '?': c.y = (c.y ? c.y + '\n' : '') + val; break;
      case '!': c.n = (c.n ? c.n + '\n' : '') + val; break;
      case '"': lastQuote = [val, '']; c.q = lastQuote; break;
      case '—': if (!lastQuote) fail(where, 'attribution without quote'); else lastQuote[1] = val; break;
      case '>': c.r = val; break;
      case '^': { const [cite, url] = val.split('|').map((s) => s.trim()); c.c = cite; if (url) c.u = url; break; }
      case '-': c.l.push(['', val]); break;
      case 'ipa': c.ipa = val; break;
      default: c.l.push([k[0], val]); break;
    }
  });
  return cards;
}

function checkCard(c) {
  const w = c.where;
  if (!SOURCES.includes(c.s)) fail(w, `bad source ${c.s}`);
  for (const s of c.sc ?? []) if (!SCENES.includes(s)) fail(w, `bad scene ${s}`);
  if (!REAL.includes(c.re)) fail(w, `bad realness ${c.re}`);
  for (const v of c.vb ?? []) if (!VIBES.includes(v)) fail(w, `bad vibe ${v}`);
  if (![1, 2, 3].includes(c.f)) fail(w, `bad freq ${c.f}`);
  if (!c.ja) fail(w, 'missing = meaning');
  if (!c.l.length) fail(w, 'no example lines');
  if (c.re !== 'real' && !c.v.length) fail(w, 'textbook/cringe card needs ✓ alternatives');
  if (c.s === 'books' && !(c.q && c.q[1])) fail(w, 'books card needs a quote with attribution');
  if (c.s === 'movies' && !(c.q && c.q[1]) && !c.r) fail(w, 'movies card needs a quote or reference');
  if (c.s === 'songs' && !c.r) fail(w, 'songs card needs > reference');
  if (c.s === 'science' && !c.c) fail(w, 'science card needs ^ citation');
  if (c.q && c.q[0].split(/\s+/).length > 40) fail(w, 'quote too long (keep quotes to one short line)');
  // the chunk should appear in at least one example (loose match: first 2 content words)
  if (c.re === 'real') {
    const core = c.head.toLowerCase().replace(/\(.*?\)/g, '').replace(/[~…]/g, ' ').replace(/\b(sb|sth|someone|something|one's|your|my)\b/g, ' ').split(/[^a-z']+/).filter((x) => x.length > 2 && !['the', 'and', "i'm", 'you', 'are', 'for'].includes(x)).slice(0, 2);
    const all = [...c.l.map((l) => l[1]), c.q?.[0] ?? ''].join(' ').toLowerCase();
    if (core.length && !core.every((k) => all.includes(k.replace(/'s$/, '')))) warn.push(`${w}: "${c.head}" not clearly used in examples`);
  }
}

// ── parse words ──
function parseWords(file) {
  const rel = path.relative(root, file);
  const words = [];
  let tier = path.basename(file, '.txt').replace(/^\d+-/, '');
  fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n').forEach((raw, n) => {
    const line = raw.trim();
    const where = `${rel}:${n + 1}`;
    if (!line || line.startsWith('//')) return;
    if (line.startsWith('@tier')) { tier = line.slice(5).trim(); return; }
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length < 5) return fail(where, `word line needs 5 fields: ${line.slice(0, 40)}`);
    const [head, pos, ja, d, ex, tags = ''] = parts;
    if (!POS.includes(pos)) fail(where, `bad pos ${pos}`);
    const sc = tags.split(',').map((s) => s.trim()).filter(Boolean);
    for (const s of sc) if (!SCENES.includes(s)) fail(where, `bad scene ${s}`);
    if (!ja || !d || !ex) fail(where, 'empty field');
    const lw = head.toLowerCase();
    const stem = lw.length > 4 ? lw.slice(0, Math.max(3, lw.length - 3)) : lw;
    if (!ex.toLowerCase().includes(stem.split(' ')[0])) warn.push(`${where}: "${head}" not in example`);
    words.push({ head, pos, ja, d, ex, sc, tier, where });
  });
  return words;
}

const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => path.join(dir, f)) : []);

await ensureCmu();
loadCmu();

const cards = list(path.join(root, 'content/cards')).flatMap(parseCards);
const words = list(path.join(root, 'content/words')).flatMap(parseWords);

const ids = new Set();
const outCards = [];
for (const c of cards) {
  checkCard(c);
  let id = slug(c.head);
  if (ids.has(id)) id = `${id}-${c.s}`;
  let k = 2;
  while (ids.has(id)) id = `${slug(c.head)}-${k++}`;
  ids.add(id);
  const ipa = c.ipa ?? (c.re === 'real' ? ipaPhrase(c.head.replace(/\(.*?\)/g, '')) : null);
  const o = { id, k: 'c', s: c.s, sc: c.sc, h: c.head, ja: c.ja, l: c.l, re: c.re, vb: c.vb, f: c.f };
  if (ipa) o.ipa = ipa;
  for (const key of ['d', 'sl', 'y', 'n', 'q', 'r', 'c', 'u', 'rare', 'e']) if (c[key] !== undefined) o[key] = c[key];
  if (c.x.length) o.x = c.x;
  if (c.v.length) o.v = c.v;
  outCards.push(o);
}

const seenWords = new Map();
const outWords = [];
let noIpa = 0;
for (const w of words) {
  const key = w.head.toLowerCase();
  if (seenWords.has(key)) { fail(w.where, `duplicate word "${w.head}" (also ${seenWords.get(key)})`); continue; }
  seenWords.set(key, w.where);
  let id = `w-${slug(w.head)}`;
  if (ids.has(id)) id = `${id}-2`;
  ids.add(id);
  const ipa = w.head.includes(' ') ? ipaPhrase(w.head) : ipaWord(w.head);
  if (!ipa) noIpa++;
  const o = { id, k: 'w', s: 'words', sc: w.sc, h: w.head, pos: w.pos, ja: w.ja, d: w.d, l: [['', w.ex]], t: w.tier };
  if (ipa) o.ipa = ipa;
  outWords.push(o);
}

// duplicate heads across cards (same phrase twice)
const heads = new Map();
for (const c of outCards) {
  const k = c.h.toLowerCase().replace(/[^a-z]/g, '');
  if (heads.has(k) && heads.get(k).s === c.s) fail(c.id, `duplicate head "${c.h}" in ${c.s}`);
  heads.set(k, c);
}

const stats = {};
for (const c of outCards) stats[c.s] = (stats[c.s] ?? 0) + 1;
console.log(`cards ${outCards.length} ${JSON.stringify(stats)} · words ${outWords.length} (no IPA: ${noIpa})`);
if (warn.length) console.log(`warnings ${warn.length}${CHECK ? '\n  ' + warn.slice(0, 40).join('\n  ') : ''}`);
if (errors.length) {
  console.error(`errors ${errors.length}\n  ${errors.slice(0, 80).join('\n  ')}`);
  process.exit(1);
}

const outDir = path.join(root, 'public/data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cards.json'), JSON.stringify(outCards));
fs.writeFileSync(path.join(outDir, 'words.json'), JSON.stringify(outWords));
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ cards: outCards.length, words: outWords.length, sources: stats, built: new Date().toISOString().slice(0, 10) }));
