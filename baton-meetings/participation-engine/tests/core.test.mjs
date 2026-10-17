import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMeetingUrl, ParticipationError, ParticipationEngine, createAuditWriter, isVerifiedJoin, defaultRoutes } from '../src/core.mjs';
import { extractRecallStatus, createRecallAdapter, createDesktopAdapter, createBrowserAdapter } from '../src/adapters.mjs';

const meet = 'https://meet.google.com/abc-defg-hij';
const zoom = 'https://us06web.zoom.us/j/123456789?pwd=topsecret';
const teams = 'https://teams.microsoft.com/l/meetup-join/abc';
const opts = { meetingUrl: meet, authorized: true, recordingConsentConfirmed: true, live: true };
const fixed = (state, code = 'TEST', proof) => ({
  probe: async () => ({ available: true }),
  join: async () => ({ state, code, proof }),
});
const proof = { type: 'IN_CALL_LEAVE_CONTROL', observedAt: '2026-10-18T00:00:00Z' };

test('accepts only explicit supported HTTPS meeting origins', () => {
  assert.equal(parseMeetingUrl(meet).platform, 'google_meet');
  assert.equal(parseMeetingUrl(zoom).platform, 'zoom');
  assert.equal(parseMeetingUrl(teams).platform, 'teams');
  assert.throws(() => parseMeetingUrl('https://zoom.us.evil.invalid/j/123'), /UNSUPPORTED_PLATFORM/);
});
test('rejects dangerous or invalid URLs', () => {
  for (const url of ['http://meet.google.com/abc', 'https://zoom.us/', 'https://evil.test/j/123', 'https://user:pwd@zoom.us/j/1', 'https://meet.google.com/abc#x', 'javascript:alert(1)']) {
    assert.throws(() => parseMeetingUrl(url), ParticipationError, url);
  }
});
test('redacts Zoom passcodes with hash-only audit identifier', () => {
  const parsed = parseMeetingUrl(zoom);
  assert.equal(parsed.meetingHash.length, 20);
  assert.ok(!parsed.meetingHash.includes('topsecret'));
  assert.equal(defaultRoutes('zoom').length, 4);
});
test('same Zoom meeting ignores join-link token differences for duplication protection', () => {
  const first = parseMeetingUrl('https://us05web.zoom.us/j/81906526578?pwd=first');
  const second = parseMeetingUrl('https://zoom.us/j/81906526578?pwd=second');
  assert.equal(first.meetingHash, second.meetingHash);
  const different = parseMeetingUrl('https://zoom.us/j/81906526579?pwd=first');
  assert.notEqual(first.meetingHash, different.meetingHash);
});
test('requires authorized live consent before any action', async () => {
  let launched = 0;
  const engine = new ParticipationEngine({ adapters: { browser: { join: async () => { launched++; return { state: 'JOINED', proof }; } } } });
  await assert.rejects(engine.join({ meetingUrl: meet, live: true, authorized: true }), /EXPLICIT_AUTHORIZATION/);
  assert.equal(launched, 0);
});
test('falls back after a technical failure and verifies next route', async () => {
  const engine = new ParticipationEngine({ adapters: { browser: fixed('FAILED'), recall: fixed('JOINED', 'TEST', proof) } });
  const result = await engine.join({ ...opts, routes: ['browser', 'recall'] });
  assert.equal(result.status, 'JOINED_VERIFIED');
  assert.equal(result.route, 'recall');
  assert.equal(result.history.length, 2);
});
test('never counts a click without proof as a joined meeting', async () => {
  const engine = new ParticipationEngine({ adapters: { browser: fixed('JOINED') } });
  const result = await engine.join({ ...opts, routes: ['browser'] });
  assert.equal(result.status, 'JOIN_UNVERIFIED');
  assert.equal(isVerifiedJoin({ state: 'JOINED' }), false);
});
test('never tries a second identity after host denial', async () => {
  let calls = 0;
  const engine = new ParticipationEngine({ adapters: {
    browser: fixed('HOST_DENIED'),
    recall: { join: async () => { calls++; return { state: 'JOINED', proof }; } },
  } });
  assert.equal((await engine.join({ ...opts, routes: ['browser', 'recall'] })).status, 'HOST_DENIED');
  assert.equal(calls, 0);
});
test('waits for host admission rather than launching duplicate bot', async () => {
  let calls = 0;
  const engine = new ParticipationEngine({ adapters: {
    browser: fixed('WAITING_ADMISSION'),
    desktop: { join: async () => { calls++; return { state: 'LAUNCHED_UNVERIFIED' }; } },
  } });
  assert.equal((await engine.join({ ...opts, routes: ['browser', 'desktop'] })).status, 'WAITING_ADMISSION');
  assert.equal(calls, 0);
});
test('desktop OS launch is not considered a successful join', async () => {
  const engine = new ParticipationEngine({ adapters: { desktop: fixed('LAUNCHED_UNVERIFIED') } });
  assert.equal((await engine.join({ ...opts, routes: ['desktop'] })).status, 'LAUNCHED_UNVERIFIED');
});
test('protects same-meeting jobs against concurrent duplicate attempts', async () => {
  let release;
  const pending = new Promise((done) => { release = done; });
  const engine = new ParticipationEngine({ adapters: { browser: { join: async () => pending } } });
  const job = engine.join({ ...opts, routes: ['browser'] });
  await assert.rejects(engine.join({ ...opts, routes: ['browser'] }), /MEETING_ALREADY_IN_PROGRESS/);
  release({ state: 'JOINED', proof });
  assert.equal((await job).status, 'JOINED_VERIFIED');
});
test('audit file excludes URL, passcode, and full customer content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mj-runner-'));
  try {
    const audit = createAuditWriter(join(dir, 'audit.jsonl'));
    const engine = new ParticipationEngine({ adapters: { browser: fixed('FAILED') }, audit });
    await engine.join({ ...opts, meetingUrl: zoom, routes: ['browser'] });
    const text = await readFile(join(dir, 'audit.jsonl'), 'utf8');
    assert.ok(text.includes('EXHAUSTED'));
    assert.ok(!text.includes('pwd='));
    assert.ok(!text.includes('topsecret'));
    assert.ok(!text.includes('123456789'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Recall status parsing handles official status_changes', () => {
  assert.equal(extractRecallStatus({ status_changes: [{ code: 'bot.joining_call' }, { code: 'in_call_recording' }] }), 'in_call_recording');
});
test('Recall route demands explicit billing permission', async () => {
  const recall = createRecallAdapter({ http: async () => { throw new Error('must-not-call'); } });
  assert.equal((await recall.probe({ allowBillable: false })).available, false);
});
test('Recall API mocked join uses provider status, not 201 response as success', async () => {
  const prevKey = process.env.RECALL_API_KEY, prevRegion = process.env.RECALL_REGION;
  process.env.RECALL_API_KEY = 'test-api-key-not-real';
  process.env.RECALL_REGION = 'ap-northeast-1';
  const requests = [];
  try {
    const http = async (url, options) => {
      requests.push({ url, method: options.method || 'GET', auth: options.headers.Authorization });
      if (options.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: '123e4567-e89b-12d3-a456-426614174000' }) };
      return { ok: true, status: 200, json: async () => ({ status_changes: [{ code: 'bot.in_call_recording' }] }) };
    };
    const recall = createRecallAdapter({ http, pause: async () => {} });
    const result = await recall.join({ meetingUrl: meet, displayName: 'Music Japan AI', allowBillable: true, joinTimeoutMs: 5000 });
    assert.equal(result.state, 'JOINED');
    assert.equal(result.proof.type, 'PROVIDER_BOT_IN_CALL');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].auth, 'test-api-key-not-real');
    assert.match(requests[0].url, /^https:\/\/ap-northeast-1\.recall\.ai\/api\/v1\/bot\/$/);
  } finally {
    if (prevKey === undefined) delete process.env.RECALL_API_KEY; else process.env.RECALL_API_KEY = prevKey;
    if (prevRegion === undefined) delete process.env.RECALL_REGION; else process.env.RECALL_REGION = prevRegion;
  }
});

test('browser adapter retains the confirmed session and releases it on stop', async () => {
  let inside = false, closes = 0;
  const page = {
    getByRole: (role, { name }) => ({ first: () => ({
      isVisible: async () => role === 'button' && name.test(inside ? 'Leave call' : 'Join now'),
      click: async () => { inside = true; },
      fill: async () => {},
    }) }),
    locator: () => ({ innerText: async () => '' }),
    goto: async () => {},
    isClosed: () => false,
    evaluate: async () => 2,
  };
  const context = { pages: () => [page], newPage: async () => page, close: async () => { closes++; } };
  const abort = new AbortController();
  const adapter = createBrowserAdapter({
    playwrightProvider: async () => ({ chromium: { launchPersistentContext: async () => context } }),
    pause: async () => { if (inside) abort.abort(); },
  });
  const state = await adapter.join({ meetingUrl: meet, platform: 'google_meet', browserProfile: 'mock-profile', browserChannel: 'msedge', displayName: 'Music Japan AI', joinTimeoutMs: 1500 });
  assert.equal(state.state, 'JOINED');
  assert.equal(state.proof.audioTracksDetected, 2);
  assert.equal(closes, 0, 'admitted meeting must not be disconnected at success');
  const resident = await adapter.maintain({ signal: abort.signal, intervalMs: 1 });
  assert.equal(resident.state, 'OPERATOR_STOPPED');
  await adapter.close();
  assert.equal(closes, 1);
});
test('resident session flags lost leave control before relaunch', async () => {
  let inside = false, closes = 0;
  const page = {
    getByRole: (role, { name }) => ({ first: () => ({
      isVisible: async () => role === 'button' && name.test(inside ? 'Leave call' : 'Join now'),
      click: async () => { inside = true; },
      fill: async () => {},
    }) }),
    locator: () => ({ innerText: async () => '' }),
    goto: async () => {},
    isClosed: () => false,
    evaluate: async () => 0,
  };
  const browser = { pages: () => [page], close: async () => { closes++; } };
  const adapter = createBrowserAdapter({ playwrightProvider: async () => ({ chromium: { launchPersistentContext: async () => browser } }), pause: async () => {} });
  await adapter.join({ meetingUrl: meet, platform: 'google_meet', browserProfile: 'mock-profile', browserChannel: 'msedge', displayName: 'Music Japan AI', joinTimeoutMs: 1000 });
  inside = false;
  const monitor = await adapter.maintain({ intervalMs: 1, maxSessionMs: 1000 });
  assert.equal(monitor.state, 'SESSION_DISCONNECTED');
  await adapter.close();
  assert.equal(closes, 1);
});
