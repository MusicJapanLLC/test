import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlatformState, performPlatformPrejoin, supportedPlatform, browserEntryPattern } from '../src/platform-flows.mjs';

function fakePage({ buttons = [], links = [], textbox = [], body = '', onClick = () => {} } = {}) {
  const state = { buttons: [...buttons], links: [...links], textbox: [...textbox], body, events: [], fields: [] };
  const arrays = { button: 'buttons', link: 'links', textbox: 'textbox' };
  const lookup = (role, pattern) => (state[arrays[role]] || []).find(label => pattern?.test(label));
  const page = {
    getByRole(role, { name }) {
      return {
        first() {
          return {
            async isVisible() { return !!lookup(role, name); },
            async click() {
              const found = lookup(role, name);
              if (!found) throw new Error('not found');
              state.events.push('CLICK:' + found);
              onClick(found, state);
            },
            async fill(value) {
              const found = lookup(role, name);
              if (!found) throw new Error('not found');
              state.fields.push({ name: found, value });
            },
          };
        },
      };
    },
    locator(selector) {
      if (selector === 'body') return { innerText: async () => state.body };
      return {
        filter() { return this; },
        first() { return { isVisible: async () => false, getAttribute: async () => null }; },
      };
    },
  };
  return { page, state };
}

test('Google Meet: signed-in account uses Join now and verifies Leave call afterwards', async () => {
  const { page, state } = fakePage({
    buttons: ['Join now'],
    onClick: (_, s) => { s.buttons = ['Leave call']; s.body = 'In the meeting'; },
  });
  const pre = await performPlatformPrejoin(page, 'google_meet', { displayName: 'Music Japan AI' });
  assert.equal(pre.state, 'JOIN_ATTEMPTED');
  assert.equal(state.events[0], 'CLICK:Join now');
  assert.equal(await classifyPlatformState(page, 'google_meet'), 'JOINED');
});

test('Google Meet: guest name and Ask to join do not mean admitted', async () => {
  const { page, state } = fakePage({
    buttons: ['Ask to join'], textbox: ['Your name'],
    onClick: (_, s) => { s.body = 'Waiting to be admitted by the host'; },
  });
  const pre = await performPlatformPrejoin(page, 'google_meet', { displayName: 'Music Japan AI' });
  assert.equal(pre.state, 'WAITING_ADMISSION');
  assert.deepEqual(state.fields, [{ name:'Your name', value:'Music Japan AI' }]);
  assert.equal(await classifyPlatformState(page, 'google_meet'), 'WAITING_ADMISSION');
});

test('Teams: choose Continue on this browser, then Join now', async () => {
  const { page, state } = fakePage({
    buttons: ['Continue on this browser'],
    onClick: (name, s) => {
      if (name === 'Continue on this browser') { s.buttons = ['Join now']; s.textbox = ['Enter your name']; }
      if (name === 'Join now') { s.buttons = ['Leave']; s.body = 'Participants'; }
    },
  });
  const pre = await performPlatformPrejoin(page, 'teams', { displayName: 'Music Japan AI' });
  assert.equal(pre.state, 'JOIN_ATTEMPTED');
  assert.deepEqual(state.events, ['CLICK:Continue on this browser', 'CLICK:Join now']);
  assert.equal(state.fields[0].value, 'Music Japan AI');
  assert.equal(await classifyPlatformState(page, 'teams'), 'JOINED');
});

test('Teams: organization identity verification is a human boundary, not automatic bypass', async () => {
  const { page, state } = fakePage({
    buttons: ['Continue on this browser', 'Join now'],
    body: 'You must verify your email with a one-time passcode',
  });
  const pre = await performPlatformPrejoin(page, 'teams', { displayName: 'Music Japan AI' });
  assert.equal(pre.state, 'REQUIRES_HUMAN');
  assert.equal(state.events.includes('CLICK:Join now'), false);
});

test('Teams: waiting lobby blocks attempts to launch another client', async () => {
  const { page, state } = fakePage({ body:'Waiting in the lobby for someone to admit you', buttons:['Join now'] });
  const pre = await performPlatformPrejoin(page, 'teams', { displayName:'Music Japan AI' });
  assert.equal(pre.state, 'WAITING_ADMISSION');
  assert.equal(state.events.length, 0);
});

test('Teams Japanese locale joins via browser without a Microsoft app', async () => {
  const { page, state } = fakePage({
    buttons: ['このブラウザーで続ける'],
    onClick: (name, s) => {
      if (name === 'このブラウザーで続ける') s.buttons = ['今すぐ参加'];
    },
  });
  const pre = await performPlatformPrejoin(page, 'teams', { displayName: 'Music Japan AI' });
  assert.equal(pre.state, 'JOIN_ATTEMPTED');
  assert.deepEqual(state.events, ['CLICK:このブラウザーで続ける','CLICK:今すぐ参加']);
});

test('Zoom: browser link follows website join, never launches native OS app', async () => {
  const { page, state } = fakePage({
    buttons:['Join from browser'],
    onClick: (_, s)=>{ s.buttons=['Join']; },
  });
  const pre = await performPlatformPrejoin(page,'zoom',{displayName:'Music Japan AI'});
  assert.equal(pre.state,'JOIN_ATTEMPTED');
  assert.deepEqual(state.events,['CLICK:Join from browser','CLICK:Join']);
});

test('Denied admission dominates stale Leave controls on all platforms', async () => {
  for (const [platform, leave] of [['google_meet','Leave call'],['zoom','Leave Meeting'],['teams','Leave']]) {
    const { page } = fakePage({ buttons:[leave],body:'Host denied your request' });
    assert.equal(await classifyPlatformState(page,platform),'HOST_DENIED',platform);
  }
});
test('Meeting entry controls never imply participation by themselves', async () => {
  for (const [platform, buttons] of [['google_meet',['Join now']],['teams',['Join now']],['zoom',['Join']]]) {
    const {page}=fakePage({buttons});
    assert.equal(await classifyPlatformState(page,platform),'UNKNOWN');
  }
});
test('Missing join control is reported as unresolved, not success',async()=>{
  const {page}=fakePage({buttons:['Record a meeting']});
  assert.deepEqual(await performPlatformPrejoin(page,'google_meet',{displayName:'Music Japan AI'}),
    {state:'NO_JOIN_CONTROL',code:'PLATFORM_JOIN_CONTROL_NOT_FOUND'});
});
test('All three supported platforms have real route configuration',()=>{
  for(const platform of ['zoom','google_meet','teams']) assert.equal(supportedPlatform(platform),true);
  assert.equal(supportedPlatform('webex'),false);
  assert.equal(browserEntryPattern('teams').test('Continue on this browser'),true);
});
