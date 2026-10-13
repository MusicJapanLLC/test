import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const scanner = fileURLToPath(new URL('./redline-target-map.mjs', import.meta.url));
const LIMIT = 1048576;
const marker = 'SUSTAINABOY WORKS';

// Inject deterministic filesystem changes into the real CLI, using only
// disposable local fixtures. Both pathname and handle metadata calls are
// supported so the same regression runs before and after the repair.
const preload = String.raw`
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const target = process.env.REDLINE_MAP_FIXTURE;
const scenario = process.env.REDLINE_MAP_RACE;
const originalStat = fs.stat;
const originalOpen = fs.open;
let changed = false;
async function mutate(filename) {
  if (String(filename) !== target || changed) return;
  changed = true;
  if (scenario === 'replace') {
    await fs.rename(target, target + '.original');
    await fs.writeFile(target, 'SUSTAINABOY WORKS');
  } else if (scenario === 'grow') {
    await fs.appendFile(target, Buffer.alloc(1048577, 120));
  }
}
fs.stat = async (filename, ...args) => {
  const result = await originalStat(filename, ...args);
  await mutate(filename);
  return result;
};
fs.open = async (filename, ...args) => {
  const handle = await originalOpen(filename, ...args);
  if (String(filename) !== target) return handle;
  const handleStat = handle.stat.bind(handle);
  handle.stat = async (...statArgs) => {
    const result = await handleStat(...statArgs);
    await mutate(filename);
    return result;
  };
  if (scenario === 'read-error') {
    handle.read = async () => {
      const error = new Error('fixture_read_failure');
      error.code = 'EIO';
      throw error;
    };
  }
  const close = handle.close.bind(handle);
  handle.close = async () => {
    await close();
    await fs.writeFile(process.env.REDLINE_MAP_CLOSE, 'closed');
  };
  return handle;
};
syncBuiltinESMExports();
`;

async function scan(t, content, scenario = 'none') {
  const directory = await mkdtemp(path.join(tmpdir(), 'redline-map-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cache = path.join(directory, '.cache');
  await mkdir(cache);
  const fixture = path.join(directory, 'source.json');
  const hook = path.join(cache, 'race.mjs');
  const closed = path.join(cache, 'closed');
  await writeFile(fixture, content);
  await writeFile(hook, preload);
  const { stdout, stderr } = await execute(process.execPath, [
    '--import', pathToFileURL(hook).href, scanner
  ], {
    cwd: directory,
    timeout: 10000,
    windowsHide: true,
    env: {
      ...process.env,
      REDLINE_MAP_FIXTURE: fixture,
      REDLINE_MAP_RACE: scenario,
      REDLINE_MAP_CLOSE: closed
    }
  });
  assert.equal(stderr.trim(), '');
  return { report: JSON.parse(stdout), closed };
}

test('reads exactly 1 MiB and preserves UTF-8 text and line numbers', async t => {
  const prefix = Buffer.from('先頭行\n' + marker + '\n');
  const content = Buffer.concat([prefix, Buffer.alloc(LIMIT - prefix.length, 120)]);
  const { report } = await scan(t, content);
  assert.equal(report.oversized, 0);
  assert.equal(report.errorCount, 0);
  assert.deepEqual(report.matches, [{ path: 'source.json', line: 2, term: marker }]);
});

test('skips an initially oversized file', async t => {
  const { report } = await scan(t, marker + 'x'.repeat(LIMIT));
  assert.equal(report.oversized, 1);
  assert.equal(report.matchCount, 0);
  assert.equal(report.errorCount, 0);
});

test('does not read a replacement pathname after metadata lookup', async t => {
  const { report } = await scan(t, 'ordinary fixture\n', 'replace');
  assert.equal(report.matchCount, 0);
  assert.equal(report.errorCount, 0);
});

test('rejects growth beyond the byte limit after metadata lookup', async t => {
  const { report } = await scan(t, marker, 'grow');
  assert.equal(report.oversized, 1);
  assert.equal(report.matchCount, 0);
  assert.equal(report.errorCount, 0);
});

test('reports a read failure and closes the opened file', async t => {
  const { report, closed } = await scan(t, marker, 'read-error');
  assert.equal(report.matchCount, 0);
  assert.equal(report.errorCount, 1);
  assert.deepEqual(report.errors, [{ path: 'source.json', code: 'EIO' }]);
  assert.equal(await readFile(closed, 'utf8'), 'closed');
});
