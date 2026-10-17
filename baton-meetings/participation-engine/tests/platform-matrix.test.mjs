import test from 'node:test';
import assert from 'node:assert/strict';
import { performPlatformPrejoin, classifyPlatformState, supportedPlatform, browserEntryPattern } from '../src/platform-flows.mjs';
import { parseMeetingUrl } from '../src/core.mjs';

// Simulated accessible UI controls only. These tests do NOT imply real meeting admission.
function makePage({ body = '', buttons = [], links = [], textboxes = [], onClick = () => {} } = {}) {
  const state = { body, buttons: new Set(buttons), links: new Set(links), textboxes: new Set(textboxes), clicked: [], filled: [] };
  return {
    state,
    page: {
      getByRole(role, { name } = {}) {
        return {
          first() {
            const items = role === 'button' ? state.buttons : role === 'link' ? state.links : role === 'textbox' ? state.textboxes : new Set();
            const hit = [...items].find(x => name?.test(x));
            return {
              isVisible: async () => Boolean(hit),
              click: async () => {
                if (!hit) throw Error('not visible');
                state.clicked.push([role, hit]);
                onClick({ role, label: hit, state });
              },
              fill: async (value) => {
                if (!hit) throw Error('not visible');
                state.filled.push([hit, value]);
              },
            };
          }
        };
      },
      locator(selector) {
        if (selector === 'body') return { innerText: async () => state.body };
        // safe anonymous input fallback isn't needed by these fixtures
        return { filter: () => ({ first: () => ({ isVisible: async () => false }) }) };
      }
    }
  };
}

const cases = [
  { platform: 'zoom', url: 'https://zoom.us/j/123456789?pwd=secret', join: 'Join', leave: 'Leave Meeting' },
  { platform: 'google_meet', url: 'https://meet.google.com/abc-defg-hij', join: 'Join now', leave: 'Leave call' },
  { platform: 'teams', url: 'https://teams.microsoft.com/l/meetup-join/fake', join: 'Join now', leave: 'Leave' },
];
for (const c of cases) {
  test(c.platform + ': URL accepted with correct platform identifier', () => {
    assert.equal(parseMeetingUrl(c.url).platform, c.platform);
    assert.equal(supportedPlatform(c.platform), true);
  });
  test(c.platform + ': clicking Join is not admission proof', async () => {
    const { page, state } = makePage({ buttons: [c.join] });
    const result = await performPlatformPrejoin(page, c.platform, { displayName: 'Music Japan AI', pause: async () => {} });
    assert.equal(result.state, 'JOIN_ATTEMPTED');
    assert.equal(await classifyPlatformState(page, c.platform), 'UNKNOWN');
    assert.deepEqual(state.clicked.at(-1), ['button', c.join]);
  });
  test(c.platform + ': verified in-call Leave control is distinguishable', async () => {
    const { page } = makePage({ buttons: [c.leave] });
    assert.equal(await classifyPlatformState(page, c.platform), 'JOINED');
  });
  test(c.platform + ': explicit host refusal beats a stale Leave control', async () => {
    const { page } = makePage({ body: 'Host denied your join request', buttons: [c.leave] });
    assert.equal(await classifyPlatformState(page, c.platform), 'HOST_DENIED');
    const result = await performPlatformPrejoin(page, c.platform, {displayName:'Music Japan AI'});
    assert.equal(result.state, 'HOST_DENIED');
  });
  test(c.platform + ': an authentication requirement is not silently bypassed', async () => {
    const { page, state } = makePage({ body: 'You need to sign in to join', buttons: [c.join] });
    assert.equal((await performPlatformPrejoin(page, c.platform, {displayName:'Music Japan AI'})).state, 'REQUIRES_HUMAN');
    assert.equal(state.clicked.length, 0);
  });
}

test('Google Meet: Ask to join returns WAITING_ADMISSION and never JOINED', async () => {
  const { page, state } = makePage({
    buttons: ['Ask to join'],
    onClick: ({ label, state: s }) => {
      if (label === 'Ask to join') { s.body = 'You asked to join'; s.buttons.clear(); }
    },
  });
  const result = await performPlatformPrejoin(page, 'google_meet', { displayName: 'Music Japan AI', pause: async () => {} });
  assert.equal(result.state, 'WAITING_ADMISSION');
  assert.deepEqual(state.clicked, [['button', 'Ask to join']]);
  assert.notEqual(await classifyPlatformState(page, 'google_meet'), 'JOINED');
});
test('Teams: Continue on this browser -> guest name -> Join now in that order', async () => {
  const { page, state } = makePage({
    buttons: ['Continue on this browser'],
    textboxes: ['Your name'],
    onClick: ({ label, state: s }) => {
      if (label === 'Continue on this browser') { s.buttons.clear(); s.buttons.add('Join now'); }
      if (label === 'Join now') { s.body = 'Someone in the meeting should let you in'; s.buttons.clear(); }
    },
  });
  const result = await performPlatformPrejoin(page, 'teams', { displayName: 'Music Japan AI', pause: async () => {} });
  assert.equal(result.state, 'JOIN_ATTEMPTED');
  assert.deepEqual(state.clicked, [['button', 'Continue on this browser'], ['button', 'Join now']]);
  assert.deepEqual(state.filled, [['Your name', 'Music Japan AI']]);
  assert.equal(await classifyPlatformState(page, 'teams'), 'WAITING_ADMISSION');
});
test('Teams: email/OTP requirement halts before submission', async () => {
  const { page, state } = makePage({
    buttons: ['Continue on this browser'],
    onClick: ({ label, state: s }) => {
      if (label === 'Continue on this browser') s.body = 'Verify your identity. Enter the one-time passcode.';
    },
  });
  const result = await performPlatformPrejoin(page, 'teams', {displayName:'Music Japan AI',pause:async()=>{}});
  assert.equal(result.state, 'REQUIRES_HUMAN');
  assert.deepEqual(state.clicked, [['button', 'Continue on this browser']]);
});
test('Teams: official web entry option is a distinct browser route', () => {
  assert.equal(browserEntryPattern('teams').test('Continue on this browser'), true);
  assert.equal(browserEntryPattern('teams').test('Open your Teams app'), false);
});
test('Google Meet: 3rd party join waiting text is not counted as joined', async () => {
  const { page } = makePage({ body: 'Waiting for the host to let you in' });
  assert.equal(await classifyPlatformState(page, 'google_meet'), 'WAITING_ADMISSION');
});
