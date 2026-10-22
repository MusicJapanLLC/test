import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { fetchReference, references } from './redline-sustainaboy-research.mjs';

const reference = references.find(item => item.id === 'WSTG-ATHN-04');
const canonical = new URL('index.html', reference.url).href;

// Synthetic HTML fixtures exercise the actual transport response handler offline.
function serveHtml(context, html) {
  const calls = [];
  context.mock.method(https, 'get', (url, options, respond) => {
    calls.push(url);
    const request = new EventEmitter();
    request.destroy = () => request;
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      response.headers = { 'content-type': 'text/html; charset=utf-8' };
      response.complete = true;
      response.destroy = () => response;
      respond(response);
      response.emit('data', Buffer.from(html));
      response.emit('end');
    });
    return request;
  });
  return calls;
}

test('WSTG sources point directly to the verified versioned documents', () => {
  assert.deepEqual(references.filter(item => item.id.startsWith('WSTG-')).map(item => item.url), [
    'https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/04-Authentication_Testing/04-Testing_for_Bypassing_Authentication_Schema/',
    'https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References/',
  ]);
});

for (const [name, html] of [
  ['observed-style relocation notice', '<html><head><title>Redirecting…</title></head><body><p>This page has moved to /v4.2/4-Web_Application_Security_Testing/04-Authentication_Testing/04-Testing_for_Bypassing_Authentication_Schema/.</p></body></html>'],
  ['meta refresh with an ordinary title', '<html><head><title>Authentication guidance</title><meta content="0; url=https://example.invalid/" http-equiv="refresh"></head><body><p>Authentication guidance has moved to a different page; this response only describes the relocation.</p></body></html>'],
]) {
  test('HTTP 200 ' + name + ' is not a fetched document', async context => {
    const calls = serveHtml(context, html);
    const result = await fetchReference(reference);
    assert.equal(result.status, 200);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.reason, 'html_redirect_document');
    assert.deepEqual(calls, [reference.url]);
    assert.equal(result.redirectsFollowed, 0);
    assert.equal(result.passages, undefined);
  });
}

test('a substantive HTTP 200 document retains its passage and body digest', async context => {
  const passage = 'Authentication must be applied to every protected service, with authorization checked for each requested operation and object.';
  const html = '<html><head><title>WSTG authentication guidance</title></head><body><h1>WSTG-ATHN-04</h1><p>' + passage + '</p></body></html>';
  const calls = serveHtml(context, html);
  const result = await fetchReference(reference);
  assert.equal(result.outcome, 'fetched');
  assert.equal(result.status, 200);
  assert.deepEqual(result.passages, [passage]);
  assert.equal(result.sha256, createHash('sha256').update(html).digest('hex'));
  assert.deepEqual(calls, [reference.url]);
});

test('decodes HTML character references exactly once', async context => {
  const encodedPassage = 'Authorization guidance keeps the literal &amp;lt;account&amp;gt; notation when decoding a nested character reference.';
  const expectedPassage = 'Authorization guidance keeps the literal &lt;account&gt; notation when decoding a nested character reference.';
  const html = '<html><head><title>Authentication &amp;lt;account&amp;gt;</title></head><body><p>' + encodedPassage + '</p></body></html>';
  serveHtml(context, html);
  const result = await fetchReference(reference);
  assert.equal(result.outcome, 'fetched');
  assert.equal(result.title, 'Authentication &lt;account&gt;');
  assert.deepEqual(result.passages, [expectedPassage]);
});

test('excludes script content even when its closing tag is absent', async context => {
  const passage = 'Authentication checks protect each account and authorization must be evaluated for every requested operation and object.';
  const hiddenText = 'Authorization example text inside a script must never be included in research passages or treated as document evidence.';
  const html = '<html><head><title>Authentication guidance</title></head><body><p>' + passage + '</p><script>/* ' + hiddenText + ' */';
  serveHtml(context, html);
  const result = await fetchReference(reference);
  assert.equal(result.outcome, 'fetched');
  assert.equal(result.status, 200);
  assert.deepEqual(result.passages, [passage]);
});

function sequence(responses) {
  const calls = [];
  return {
    calls,
    request: async request => {
      calls.push(request.url);
      assert.ok(calls.length <= responses.length, 'Unexpected additional HTTP request');
      return { ...request, responseBytes: 0, outcome: 'unavailable', ...responses[calls.length - 1] };
    },
  };
}

test('HTTP 308 follows a same-collection redirect and preserves evidence', async () => {
  const stub = sequence([
    { status: 308, redirectLocation: canonical },
    { status: 200, outcome: 'fetched', sha256: 'fixture-digest' },
  ]);
  const result = await fetchReference(reference, stub.request);
  assert.deepEqual(stub.calls, [reference.url, canonical]);
  assert.equal(result.outcome, 'fetched');
  assert.equal(result.url, reference.url);
  assert.equal(result.finalUrl, canonical);
  assert.equal(result.redirectsFollowed, 1);
  assert.deepEqual(result.redirectChain, [{ from: reference.url, status: 308, to: canonical }]);
  assert.equal(result.sha256, 'fixture-digest');
  assert.equal('redirectLocation' in result, false);
});

for (const [name, destination] of [
  ['third party', 'https://example.invalid/document'],
  ['hostname suffix', 'https://wstg.owasp.org.example.invalid/document'],
  ['HTTP downgrade', canonical.replace('https:', 'http:')],
  ['non-default port', canonical.replace('wstg.owasp.org', 'wstg.owasp.org:444')],
  ['URL credentials', canonical.replace('https://', 'https://reviewer:dummy@')],
  ['query string', canonical + '?session=fixture'],
  ['fragment', canonical + '#section'],
  ['unrelated official path', 'https://wstg.owasp.org/account/'],
  ['other research origin', 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'],
]) {
  test('blocks ' + name + ' before another request', async () => {
    const stub = sequence([{ status: 308, redirectLocation: destination }]);
    const result = await fetchReference(reference, stub.request);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.reason, 'redirect_outside_reference_boundary');
    assert.deepEqual(stub.calls, [reference.url]);
    assert.equal(result.redirectsFollowed, 0);
    assert.equal('redirectLocation' in result, false);
    assert.ok(!JSON.stringify(result).includes('reviewer:dummy'));
  });
}

test('detects a redirect loop without issuing its repeated request', async () => {
  const stub = sequence([
    { status: 308, redirectLocation: canonical },
    { status: 302, redirectLocation: reference.url },
  ]);
  const result = await fetchReference(reference, stub.request);
  assert.equal(result.reason, 'redirect_loop');
  assert.equal(result.redirectsFollowed, 1);
  assert.equal(stub.calls.length, 2);
});

test('follows at most three redirects', async () => {
  const stub = sequence(Array.from({ length: 4 }, (_, index) => ({
    status: 307, redirectLocation: reference.url + '/hop-' + index,
  })));
  const result = await fetchReference(reference, stub.request);
  assert.equal(result.reason, 'redirect_limit');
  assert.equal(result.redirectsFollowed, 3);
  assert.equal(stub.calls.length, 4);
});

for (const location of [undefined, '', 'https://[invalid']) {
  test('rejects missing or malformed Location: ' + String(location), async () => {
    const stub = sequence([{ status: 308, redirectLocation: location }]);
    const result = await fetchReference(reference, stub.request);
    assert.equal(result.reason, 'invalid_redirect');
    assert.equal(stub.calls.length, 1);
  });
}

test('allows a relative redirect within the same research collection', async () => {
  const destination = new URL('./replacement', reference.url).href;
  const stub = sequence([
    { status: 301, redirectLocation: './replacement' },
    { status: 200, outcome: 'fetched' },
  ]);
  const result = await fetchReference(reference, stub.request);
  assert.equal(result.outcome, 'fetched');
  assert.deepEqual(stub.calls, [reference.url, destination]);
});

test('preserves HTTP failure instead of reporting a successful fetch', async () => {
  const stub = sequence([{ status: 503, reason: 'http_status' }]);
  const result = await fetchReference(reference, stub.request);
  assert.equal(result.status, 503);
  assert.equal(result.outcome, 'unavailable');
  assert.equal(stub.calls.length, 1);
});

test('unknown initial sources are rejected before transport', async () => {
  const stub = sequence([]);
  await assert.rejects(
    fetchReference({ id: reference.id, url: 'https://example.invalid/' }, stub.request),
    /Unknown research reference/,
  );
  assert.equal(stub.calls.length, 0);
});

test('the authorization cheat sheet remains an independent fixed source', async () => {
  const sheet = references.find(item => item.id === 'OWASP-Authorization-Cheat-Sheet');
  const stub = sequence([{ status: 200, outcome: 'fetched' }]);
  const result = await fetchReference(sheet, stub.request);
  assert.equal(result.outcome, 'fetched');
  assert.equal(result.redirectsFollowed, 0);
  assert.deepEqual(stub.calls, [sheet.url]);
});
