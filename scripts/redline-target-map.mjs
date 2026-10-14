import { readdir, open } from 'node:fs/promises';
import path from 'node:path';

// Read-only source discovery. No target requests or repository code execution.
const MAX_SOURCE_BYTES = 1048576;

async function readBoundedSource(filename) {
  const handle = await open(filename, 'r');
  try {
    // Inspect and read the opened file, without reopening its pathname.
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      const error = new Error('not_regular_file');
      error.code = 'ENOTFILE';
      throw error;
    }
    if (metadata.size > MAX_SOURCE_BYTES) return null;
    // One extra byte detects growth after stat without an unbounded read.
    const bytes = Buffer.alloc(MAX_SOURCE_BYTES + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, used);
      if (bytesRead === 0) break;
      used += bytesRead;
    }
    if (used > MAX_SOURCE_BYTES) return null;
    return bytes.subarray(0, used).toString('utf8');
  } finally {
    await handle.close();
  }
}

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '.next', '.venv', 'venv', 'dist', 'build', 'coverage', '__pycache__', '.cache']);
const terms = ['standment-redteam-console', 'STANDMENT // REDTEAM', '認可ターゲット未登録', 'scope=authorized-only', 'sustainaboy-works.onrender.com', 'SUSTAINABOY WORKS'];
const readable = /\.(?:[cm]?js|jsx|tsx?|json|md|ya?ml|toml|html|py)$/i;
const hints = /redteam|sustainaboy|(?:^|[/])(?:package\.json|vercel\.json|render\.ya?ml|AGENTS\.md)$/i;
const queue = [''];
const candidates = [];
const matches = [];
const errors = [];
let visited = 0;
let oversized = 0;
let capped = false;
while (queue.length && !capped) {
  const dir = queue.pop();
  let entries;
  try { entries = await readdir(path.join(root, dir), { withFileTypes: true }); }
  catch (error) { errors.push({ path: dir, code: error.code }); continue; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) queue.push(relative);
      continue;
    }
    if (!entry.isFile() || relative === 'scripts/redline-target-map.mjs') continue;
    if (++visited > 50000) { capped = true; break; }
    if (hints.test(relative)) candidates.push(relative);
    if (!readable.test(entry.name)) continue;
    try {
      const filename = path.join(root, relative);
      const content = await readBoundedSource(filename);
      if (content === null) { oversized++; continue; }
      if (!terms.some(term => content.toLowerCase().includes(term.toLowerCase()))) continue;
      const lines = content.split(/\r?\n/);
      const found = new Set();
      for (let index = 0; index < lines.length; index++) {
        for (let termIndex = 0; termIndex < terms.length; termIndex++) {
          if (!found.has(termIndex) && lines[index].toLowerCase().includes(terms[termIndex].toLowerCase())) {
            matches.push({ path: relative, line: index + 1, term: terms[termIndex], priority: termIndex });
            found.add(termIndex);
          }
        }
      }
    } catch (error) { errors.push({ path: relative, code: error.code }); }
  }
}
const rank = value => /redteam/i.test(value) ? 0 : /sustainaboy/i.test(value) ? 1 : 2;
candidates.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
matches.sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path) || a.line - b.line);
console.log(JSON.stringify({
  purpose: 'Locate source references; references alone do not prove deployment or authorization',
  visited, capped, oversized,
  candidateCount: candidates.length, candidates: candidates.slice(0, 80),
  matchCount: matches.length, matches: matches.slice(0, 80).map(({ priority, ...match }) => match),
  errorCount: errors.length, errors: errors.slice(0, 10),
  outputTruncated: candidates.length > 80 || matches.length > 80 || errors.length > 10
}, null, 2));
