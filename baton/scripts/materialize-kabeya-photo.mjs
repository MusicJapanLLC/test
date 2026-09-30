import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const batonRoot = resolve(here, '..');
const chunksDir = resolve(batonRoot, 'src/data/kabeya-photo-hq-final');
const output = resolve(batonRoot, 'public/profile-kabeya-hq.webp');

const base64 = [0, 1, 2, 3]
  .map((index) => readFileSync(resolve(chunksDir, `part${index}.txt`), 'utf8').trim())
  .join('');

const image = Buffer.from(base64, 'base64');

// WebP files start with RIFF....WEBP. Fail the build instead of silently shipping a broken image.
if (
  image.length < 50_000 ||
  image.subarray(0, 4).toString('ascii') !== 'RIFF' ||
  image.subarray(8, 12).toString('ascii') !== 'WEBP'
) {
  throw new Error('Kabeya HQ photo reconstruction failed');
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, image);
console.log(`[baton] materialized Kabeya HQ photo: ${image.length} bytes`);
