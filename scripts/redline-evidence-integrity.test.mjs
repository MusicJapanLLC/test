import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const directory = new URL('../reports/redline-sustainaboy-20261013/', import.meta.url);
const describeBytes = bytes => ({
  bytes: bytes.byteLength,
  sha256: createHash('sha256').update(bytes).digest('hex')
});

// Read snapshots as bytes. Never execute captured HTML or JavaScript.
for (const [bodyName, metadataName] of [['about.html', 'page.json'], ['site.js', 'site.json']]) {
  test(`stored ${bodyName} bytes match acquisition metadata`, async () => {
    const [body, metadataText] = await Promise.all([
      readFile(new URL(bodyName, directory)),
      readFile(new URL(metadataName, directory), 'utf8')
    ]);
    const metadata = JSON.parse(metadataText);
    const lfCandidate = Buffer.from(body.toString('utf8').replace(/\r\n/g, '\n'));
    assert.deepEqual(describeBytes(body), {
      bytes: metadata.body_bytes,
      sha256: metadata.body_sha256
    }, `Snapshot differs from acquisition metadata; LF candidate: ${JSON.stringify(describeBytes(lfCandidate))}`);
  });
}
