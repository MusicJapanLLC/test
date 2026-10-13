import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { collectPage, collectScript, TARGET_URL, SCRIPT_URL, MAX_BODY_BYTES } from './redline-target-evidence.mjs';

// All responses are local fixtures. These tests perform no network requests.
test('requests the registered page once and does not follow an external redirect', async () => {
  const requests = [];
  const { body, evidence } = await collectPage(async (url, options) => {
    requests.push({ url, options });
    return new Response('redirect fixture', {
      status: 302,
      headers: { location: 'https://outside.invalid/private' }
    });
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, TARGET_URL);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.redirect, 'manual');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(evidence.status, 302);
  assert.equal(evidence.redirect_blocked, true);
  assert.equal(evidence.redirect_followed, false);
  assert.equal(body.byteLength, 0);
});

test('preserves a 403 observation and omits cookie values from metadata', async () => {
  const { body, evidence } = await collectPage(async () => new Response('<h1>Forbidden</h1>', {
    status: 403,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': 'session=private-fixture; Secure; HttpOnly'
    }
  }));
  assert.equal(evidence.status, 403);
  assert.equal(evidence.redirect_blocked, false);
  assert.equal(body.toString('utf8'), '<h1>Forbidden</h1>');
  assert.equal(evidence.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(Object.hasOwn(evidence.headers, 'set-cookie'), false);
  assert.equal(JSON.stringify(evidence).includes('private-fixture'), false);
});

test('limits stored bytes and hashes the exact captured bytes', async () => {
  const fixture = new Uint8Array(MAX_BODY_BYTES + 32).fill(120);
  const { body, evidence } = await collectPage(async () => new Response(fixture));
  assert.equal(body.byteLength, MAX_BODY_BYTES);
  assert.equal(evidence.body_bytes, MAX_BODY_BYTES);
  assert.equal(evidence.body_truncated, true);
  assert.equal(evidence.body_sha256, createHash('sha256').update(body).digest('hex'));
});

test('rejects and cancels an unexpected response URL', async () => {
  let cancelled = false;
  await assert.rejects(collectPage(async () => ({
    redirected: false,
    url: 'https://outside.invalid/',
    body: new ReadableStream({ cancel() { cancelled = true; } })
  })), /unexpected_response_url/);
  assert.equal(cancelled, true);
});

test('propagates a transport failure instead of producing successful evidence', async () => {
  await assert.rejects(collectPage(async () => {
    throw new Error('connection_fixture_failure');
  }), /connection_fixture_failure/);
});

test('captures the fixed linked script without stripping markup or following references', async () => {
  const fixture = "if (width < 10) { const sample = '<dt>label</dt>'; }\n// https://outside.invalid/fixture.js\n";
  const requests = [];
  const { body, evidence } = await collectScript(async (url, options) => {
    requests.push({ url, options });
    return new Response(fixture, { headers: { 'content-type': 'application/javascript' } });
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://sustainaboy-works.onrender.com/assets/site.js');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.redirect, 'manual');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(body.toString('utf8'), fixture);
  assert.equal(evidence.schema, 'redline-selected-script/v1');
  assert.equal(evidence.target, SCRIPT_URL);
  assert.equal(evidence.registered_page, TARGET_URL);
  assert.equal(evidence.body_sha256, createHash('sha256').update(Buffer.from(fixture)).digest('hex'));
});

test('does not follow an external redirect from the fixed script', async () => {
  let requests = 0;
  const { body, evidence } = await collectScript(async () => {
    requests++;
    return new Response('redirect fixture', {
      status: 307,
      headers: { location: 'https://outside.invalid/fixture.js' }
    });
  });
  assert.equal(requests, 1);
  assert.equal(evidence.status, 307);
  assert.equal(evidence.redirect_blocked, true);
  assert.equal(evidence.redirect_followed, false);
  assert.equal(body.byteLength, 0);
});
