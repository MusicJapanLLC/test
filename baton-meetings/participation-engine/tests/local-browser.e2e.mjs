import { createServer } from 'node:http';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createBrowserAdapter } from '../src/adapters.mjs';

if (!process.env.MJ_PLAYWRIGHT_MODULE) {
  console.log(JSON.stringify({ status: 'SKIPPED', code: 'PLAYWRIGHT_MODULE_NOT_CONFIGURED' }));
  process.exit(0);
}
if (os.freemem() < 900 * 1024 * 1024) {
  console.log(JSON.stringify({ status: 'SKIPPED', code: 'MEMORY_BELOW_900_MIB' }));
  process.exit(0);
}
const pageHtml = String.raw`<!DOCTYPE html><html lang="en"><head><title>Local synthetic join fixture</title></head><body>
<h1>Local fixture — not a real meeting</h1>
<button id="join">Join now</button><button id="leave" aria-label="Leave call" hidden>Leave call</button>
<script>
document.querySelector('#join').onclick = () => {
  document.querySelector('#join').hidden = true;
  document.querySelector('#leave').hidden = false;
  setTimeout(() => {
    document.querySelector('#leave').hidden = true;
    document.querySelector('#join').hidden = false;
  }, 1200);
};
</script></body></html>`;
const server = createServer((req,res) => { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(pageHtml); });
const profile = await mkdtemp(join(os.tmpdir(), 'mj-meeting-e2e-'));
let adapter;
try {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => err ? reject(err) : resolve()));
  const port = server.address().port;
  adapter = createBrowserAdapter({ pause: (ms) => new Promise(r => setTimeout(r, Math.min(ms, 150))) });
  const joined = await adapter.join({
    meetingUrl: 'http://127.0.0.1:' + port + '/',
    platform: 'google_meet',
    browserProfile: profile,
    browserChannel: 'msedge',
    displayName: 'Music Japan AI',
    joinTimeoutMs: 12000,
    testFixture: true,
  });
  assert.equal(joined.state, 'JOINED', 'real Edge browser must click synthetic Join and detect Leave');
  assert.equal(joined.proof.type, 'IN_CALL_LEAVE_CONTROL');
  const session = await adapter.maintain({ intervalMs: 150, maxSessionMs: 10000 });
  assert.equal(session.state, 'SESSION_DISCONNECTED');
  console.log(JSON.stringify({
    status: 'PASS',
    test: 'REAL_EDGE_BROWSER_LOCAL_SYNTHETIC_JOIN',
    joinDetected: true,
    residentDisconnectDetected: true,
    realMeetingJoined: false,
  }));
} catch (error) {
  console.log(JSON.stringify({ status: 'FAIL', code: 'E2E_FAILED', type: error?.name || 'Error' }));
  process.exitCode = 1;
} finally {
  if (adapter) await adapter.close().catch(() => {});
  await new Promise((resolve) => server.close(() => resolve()));
  await rm(profile, { recursive: true, force: true, maxRetries: 2 }).catch(() => {});
}
