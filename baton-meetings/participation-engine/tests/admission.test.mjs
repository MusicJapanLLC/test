import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserAdapter } from '../src/adapters.mjs';
import { isVerifiedJoin } from '../src/core.mjs';

function fakeRoom(platform) {
  const state = {
    buttons: [platform === 'google_meet' ? 'Ask to join' : 'Join now'],
    body: '',
    clicked: [],
    closed: 0,
    stage: 'prejoin',
  };
  const leave = platform === 'google_meet' ? 'Leave call' : 'Leave';
  const page = {
    isClosed: () => false,
    goto: async () => ({ status: () => 200 }),
    locator: (selector) => {
      if (selector === 'body') return { innerText: async () => state.body };
      return { filter() { return this; }, first: () => ({ isVisible: async () => false }) };
    },
    getByRole: (role, { name }) => ({
      first: () => ({
        isVisible: async () => role === 'button' && state.buttons.some(label => name.test(label)),
        click: async () => {
          const button = state.buttons.find(label => name.test(label));
          if (!button) throw new Error('button missing');
          state.clicked.push(button);
          state.stage = 'lobby';
          state.buttons = [];
          state.body = platform === 'teams' ? 'Waiting in the lobby for someone to admit you' : 'Waiting to be admitted';
        },
        fill: async () => {},
      }),
    }),
    evaluate: async () => 1,
  };
  const browser = { pages: () => [page], close: async () => { state.closed++; } };
  const adapter = createBrowserAdapter({
    playwrightProvider: async () => ({ chromium: { launchPersistentContext: async () => browser } }),
    pause: async () => {},
  });
  function admit() { state.body = 'Participants'; state.buttons = [leave]; state.stage = 'joined'; }
  function reject() { state.body = 'Host denied your request'; state.buttons = [leave]; state.stage = 'denied'; }
  return { adapter, state, admit, reject };
}
function options(platform) {
  return {
    platform,
    meetingUrl: platform === 'google_meet' ? 'https://meet.google.com/abc-defg-hij' : 'https://teams.microsoft.com/l/meetup-join/abc',
    browserProfile: 'C:\\testing\\dedicated-profile',
    browserChannel: 'msedge',
    displayName: 'Music Japan AI',
    joinTimeoutMs: 30,
  };
}

test('Google Meet guest lobby remains open and becomes joined only after host approval', async () => {
  const t = fakeRoom('google_meet');
  const request = await t.adapter.join(options('google_meet'));
  assert.equal(request.state, 'WAITING_ADMISSION');
  assert.equal(t.state.closed, 0);
  assert.deepEqual(t.state.clicked, ['Ask to join']);
  t.admit();
  const proof = await t.adapter.awaitAdmission({ maxLobbyMs: 2000, intervalMs: 1 });
  assert.equal(proof.state, 'JOINED');
  assert.equal(isVerifiedJoin(proof), true);
  assert.equal(t.state.closed, 0);
  await t.adapter.close();
  assert.equal(t.state.closed, 1);
});

test('Google Meet host refusal stops admission and never pretends join success', async () => {
  const t = fakeRoom('google_meet');
  await t.adapter.join(options('google_meet'));
  t.reject();
  const r = await t.adapter.awaitAdmission({ maxLobbyMs: 200, intervalMs: 1 });
  assert.equal(r.state, 'HOST_DENIED');
  assert.equal(isVerifiedJoin(r), false);
  await t.adapter.close();
  assert.equal(t.state.closed, 1);
});

test('Teams browser lobby is retained until the session is admitted', async () => {
  const t = fakeRoom('teams');
  const requested = await t.adapter.join(options('teams'));
  assert.equal(requested.state, 'WAITING_ADMISSION');
  assert.equal(t.state.closed, 0, 'do not close Teams while awaiting host admission');
  t.admit();
  const admitted = await t.adapter.awaitAdmission({ maxLobbyMs: 2000, intervalMs: 1 });
  assert.equal(admitted.state, 'JOINED');
  assert.equal(admitted.proof.type, 'IN_CALL_LEAVE_CONTROL');
  await t.adapter.close();
  assert.equal(t.state.closed, 1);
});

test('abort waiting cleanly then release browser without alternate identity', async () => {
  const t = fakeRoom('google_meet');
  await t.adapter.join(options('google_meet'));
  const abort = new AbortController();
  abort.abort();
  const state = await t.adapter.awaitAdmission({ signal: abort.signal });
  assert.equal(state.state, 'OPERATOR_STOPPED');
  await t.adapter.close();
  assert.equal(t.state.closed, 1);
});
