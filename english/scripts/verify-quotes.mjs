// Checks every Classic Books quote word-for-word against the Project Gutenberg text of the work.
// Texts live in .cache/pg/<gutenberg id>.txt (fetched once; not committed).
// Matching ignores case, punctuation and line breaks, but every word must appear in order.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKS = [
  ['Pride and Prejudice', 1342], ['The Great Gatsby', 64317], ["Alice's Adventures in Wonderland", 11],
  ['Through the Looking-Glass', 12], ['A Scandal in Bohemia', 1661], ['The Sign of the Four', 2097],
  ['Abbey Grange', 108], ['The Crooked Man', 834], ['Dorian Gray', 174], ["Lady Windermere's Fan", 790],
  ['Importance of Being Earnest', 844], ['An Ideal Husband', 885], ['A Tale of Two Cities', 98],
  ['A Christmas Carol', 46], ['Oliver Twist', 730], ['Tom Sawyer', 74], ['Meditations', 2680], ['Walden', 205],
  ['Self-Reliance', 2944], ['Shakespeare', 100], ['Wizard of Oz', 55], ['Peter Pan', 16], ['Anne of Green Gables', 45],
  ['Moby-Dick', 2701], ['Little Women', 514], ['Jane Eyre', 1260], ['Frankenstein', 84], ['Gettysburg', 4],
  ['Roosevelt', 104], ['Kennedy', 3], ['King James', 10],
];
const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/'(?![a-z])|(?<![a-z])'/g, ' ')
  .replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ').trim();

const cards = JSON.parse(fs.readFileSync(path.join(root, 'public/data/cards.json'), 'utf8')).filter((c) => c.s === 'books');
const cache = new Map();
let ok = 0;
const bad = [];
for (const c of cards) {
  const work = WORKS.find(([k]) => c.q[1].includes(k));
  if (!work) { bad.push(`${c.h}: no source mapping (${c.q[1]})`); continue; }
  const file = path.join(root, '.cache/pg', `${work[1]}.txt`);
  if (!fs.existsSync(file)) { bad.push(`${c.h}: missing text #${work[1]}`); continue; }
  if (!cache.has(file)) cache.set(file, ` ${norm(fs.readFileSync(file, 'utf8').replace(/_/g, ''))} `);
  const text = cache.get(file);
  // "…" marks an omission (e.g. "he said"): each part must appear, in order, close together
  const parts = c.q[0].split(/…|\.\.\./).map(norm).filter(Boolean);
  const q = parts.join(' ');
  let pos = -1;
  let found = true;
  for (const p of parts) {
    const at = text.indexOf(p, pos + 1);
    if (at < 0 || (pos >= 0 && at - pos > 400)) { found = false; break; }
    pos = at + p.length;
  }
  if (found) ok++;
  else {
    // show the longest matching prefix to make fixing easy
    const words = q.split(' ');
    let n = words.length;
    while (n > 2 && !text.includes(words.slice(0, n).join(' '))) n--;
    const at = text.indexOf(words.slice(0, n).join(' '));
    bad.push(`${c.h}\n    quote: ${c.q[0]}\n    text:  ${at >= 0 ? text.slice(at, at + q.length + 40) : '(not found)'}`);
  }
}
console.log(`books quotes verified ${ok}/${cards.length}`);
if (bad.length) { console.log(bad.join('\n')); process.exitCode = 1; }
