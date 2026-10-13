import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This diagnostic has one fixed target and never follows redirects.
export const TARGET_URL = 'https://sustainaboy-works.onrender.com/about/';
export const MAX_BODY_BYTES = 300000;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
const HEADER_NAMES = [
  'content-type', 'content-security-policy',
  'content-security-policy-report-only', 'referrer-policy',
  'strict-transport-security', 'x-content-type-options',
  'x-frame-options', 'permissions-policy'
];

async function readBounded(stream) {
  if (!stream) return { body: Buffer.alloc(0), truncated: false };
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const available = MAX_BODY_BYTES - size;
      const kept = value.subarray(0, available);
      chunks.push(Buffer.from(kept));
      size += kept.byteLength;
      if (value.byteLength > available) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { body: Buffer.concat(chunks), truncated };
}

// This exact same-host asset was referenced by the captured /about/ HTML.
export const SCRIPT_URL = 'https://sustainaboy-works.onrender.com/assets/site.js';

export function collectPage(fetcher = globalThis.fetch) {
  return collectResource(TARGET_URL, 'text/html', fetcher);
}

export function collectScript(fetcher = globalThis.fetch) {
  return collectResource(SCRIPT_URL, 'application/javascript', fetcher);
}

// Only the two fixed wrappers above can select a resource. Captured code is
// stored as bytes: it is never evaluated, imported, or followed to other URLs.
async function collectResource(url, accept, fetcher) {
  const checkedAt = new Date().toISOString();
  const response = await fetcher(url, {
    method: 'GET',
    redirect: 'manual',
    credentials: 'omit',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'REDLINE-Selected-Target-Evidence/1.0',
      Accept: accept
    }
  });
  if (response.redirected || (response.url && response.url !== url)) {
    await response.body?.cancel();
    throw new Error('unexpected_response_url');
  }
  const redirectBlocked = REDIRECT_STATUSES.includes(response.status);
  let captured;
  if (redirectBlocked) {
    await response.body?.cancel();
    captured = { body: Buffer.alloc(0), truncated: false };
  } else {
    captured = await readBounded(response.body);
  }
  const headers = Object.fromEntries(HEADER_NAMES
    .map(name => [name, response.headers.get(name)])
    .filter(([, value]) => value !== null));
  return {
    body: captured.body,
    evidence: {
      schema: url === TARGET_URL ? 'redline-selected-page/v1' : 'redline-selected-script/v1',
      checked_at: checkedAt,
      target: url,
      registered_page: TARGET_URL,
      method: 'GET',
      status: response.status,
      redirect_followed: false,
      redirect_blocked: redirectBlocked,
      headers,
      body_bytes: captured.body.byteLength,
      body_limit_bytes: MAX_BODY_BYTES,
      body_truncated: captured.truncated,
      body_sha256: createHash('sha256').update(captured.body).digest('hex'),
      note: 'HTTP observation only; not an authorization test or proof of deployment revision.'
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--script')) {
    throw new Error('unsupported_arguments');
  }
  const scriptOnly = args[0] === '--script';
  const { body, evidence } = await (scriptOnly ? collectScript() : collectPage());
  const bodyName = scriptOnly ? 'site.js' : 'about.html';
  const metadataName = scriptOnly ? 'site.json' : 'page.json';
  const directory = fileURLToPath(new URL('../reports/redline-sustainaboy-20261013/', import.meta.url));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, bodyName), body);
  await writeFile(path.join(directory, metadataName), JSON.stringify(evidence, null, 2) + String.fromCharCode(10));
  console.log(JSON.stringify({
    ...evidence,
    files: [bodyName, metadataName].map(name => 'reports/redline-sustainaboy-20261013/' + name)
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error('Evidence capture failed:', error instanceof Error ? error.message : 'unknown_error');
    process.exitCode = 1;
  });
}
