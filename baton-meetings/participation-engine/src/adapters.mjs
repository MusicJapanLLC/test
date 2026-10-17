import os from 'node:os';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyPlatformState, performPlatformPrejoin } from './platform-flows.mjs';

const RECALL_REGIONS = new Set(['us-east-1', 'us-west-2', 'eu-central-1', 'ap-northeast-1']);
const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const joinedCodes = new Set(['in_call_not_recording', 'in_call_recording']);
const fatalCodes = new Set(['fatal', 'done']);
const leaveLabels = {
  zoom: /^(Leave Meeting|Leave|ミーティングから退出|退出)$/i,
  teams: /^(Leave|退出|Hang up|通話を終了)$/i,
  google_meet: /^(Leave call|Leave|通話を終了|退出)$/i,
};
const joinLabels = {
  zoom: /^(Join|Join Meeting|参加|ミーティングに参加)$/i,
  teams: /^(Join now|Join meeting|今すぐ参加|会議に参加)$/i,
  google_meet: /^(Join now|Ask to join|今すぐ参加|参加をリクエスト)$/i,
};

export function extractRecallStatus(bot) {
  const changes = Array.isArray(bot?.status_changes) ? bot.status_changes : [];
  const current = changes.at(-1)?.code || bot?.status?.code || bot?.status || '';
  return typeof current === 'string' ? current.replace(/^bot\./, '').toLowerCase() : '';
}

export function createRecallAdapter({ http = fetch, now = () => new Date(), pause = sleep } = {}) {
  return {
    name: 'recall',
    async probe(ctx) {
      if (!ctx.allowBillable) return { available: false, code: 'BILLING_NOT_AUTHORIZED' };
      if (!process.env.RECALL_API_KEY) return { available: false, code: 'RECALL_KEY_MISSING' };
      if (!RECALL_REGIONS.has(process.env.RECALL_REGION)) return { available: false, code: 'RECALL_REGION_MISSING' };
      return { available: true };
    },
    async join(ctx) {
      const key = process.env.RECALL_API_KEY;
      const region = process.env.RECALL_REGION;
      if (!ctx.allowBillable || !key || !RECALL_REGIONS.has(region))
        return { state: 'UNAVAILABLE', code: 'RECALL_NOT_CONFIGURED' };
      const base = 'https://' + region + '.recall.ai/api/v1/bot/';
      const headers = { 'Authorization': key, 'Content-Type': 'application/json', 'Accept': 'application/json' };
      let created;
      try {
        const rsp = await http(base, {
          method: 'POST', headers,
          body: JSON.stringify({ meeting_url: ctx.meetingUrl, bot_name: ctx.displayName }),
          signal: AbortSignal.timeout(25000),
        });
        if (rsp.status === 401 || rsp.status === 403)
          return { state: 'ROUTE_AUTH_MISSING', code: 'RECALL_AUTH_FAILED' };
        if (!rsp.ok) return { state: 'FAILED', code: rsp.status === 429 || rsp.status >= 500 ? 'RECALL_TEMPORARY_FAILURE' : 'RECALL_CREATE_FAILED' };
        created = await rsp.json();
      } catch { return { state: 'FAILED', code: 'RECALL_NETWORK_FAILURE' }; }
      if (!/^[a-f0-9-]{30,40}$/i.test(created?.id || '')) return { state: 'UNCERTAIN', code: 'RECALL_BOT_ID_NOT_CONFIRMED' };
      const deadline = Date.now() + ctx.joinTimeoutMs;
      let waitingSeen = false;
      while (Date.now() < deadline) {
        let bot;
        try {
          const rsp = await http(base + created.id + '/', { headers, signal: AbortSignal.timeout(15000) });
          if (rsp.status === 401 || rsp.status === 403) return { state: 'UNCERTAIN', code: 'RECALL_STATUS_AUTH_FAILED' };
          if (!rsp.ok) { await pause(3000); continue; }
          bot = await rsp.json();
        } catch { await pause(3000); continue; }
        const code = extractRecallStatus(bot);
        if (joinedCodes.has(code)) {
          return {
            state: 'JOINED', code: 'RECALL_JOINED',
            proof: { type: 'PROVIDER_BOT_IN_CALL', observedAt: now().toISOString(), botId: created.id, providerStatus: code },
          };
        }
        if (code === 'in_waiting_room') waitingSeen = true;
        if (fatalCodes.has(code)) {
          const subcodes = (bot?.status_changes || []).flatMap((s) => Array.isArray(s?.sub_code) ? s.sub_code : [s?.sub_code]).filter(Boolean);
          const s = subcodes.join(' ').toLowerCase();
          if (/not_admitted|denied|rejected|recording_permission/.test(s))
            return { state: 'POLICY_BLOCKED', code: 'HOST_OR_RECORDING_PERMISSION_DENIED' };
          return { state: 'FAILED', code: 'RECALL_BOT_FATAL' };
        }
        await pause(3000);
      }
      // A live bot might still be connected or in a lobby; never deploy a second bot blindly.
      return {
        state: waitingSeen ? 'WAITING_ADMISSION' : 'UNCERTAIN',
        code: waitingSeen ? 'HOST_ADMISSION_PENDING' : 'RECALL_JOIN_UNCONFIRMED',
      };
    },
  };
}

async function loadPlaywright() {
  if (process.env.MJ_PLAYWRIGHT_MODULE) {
    return import(pathToFileURL(resolve(process.env.MJ_PLAYWRIGHT_MODULE)).href);
  }
  return import('playwright');
}
async function visibleByRole(page, role, regex) {
  try { return await page.getByRole(role, { name: regex }).first().isVisible({ timeout: 1000 }); }
  catch { return false; }
}
async function clickByRole(page, role, regex) {
  try {
    const locator = page.getByRole(role, { name: regex }).first();
    if (await locator.isVisible({ timeout: 1000 })) { await locator.click({ timeout: 4000 }); return true; }
  } catch {}
  return false;
}
async function classifyPage(page, platform) {
  return classifyPlatformState(page, platform);
}
async function maybeFillGuestName(page, name) {
  const names = [/your name|display name|名前を入力|名前を入力してください/i];
  for (const regexp of names) {
    try {
      const loc = page.getByRole('textbox', { name: regexp }).first();
      if (await loc.isVisible({ timeout: 450 })) { await loc.fill(name, { timeout: 2500 }); return true; }
    } catch {}
  }
  return false;
}
function countAttachedAudioTracks(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('audio,video')) {
      if (el.srcObject instanceof MediaStream) {
        for (const track of el.srcObject.getAudioTracks()) if (track.readyState === 'live') n++;
      }
    }
    return n;
  }).catch(() => 0);
}

export function createBrowserAdapter({ playwrightProvider = loadPlaywright, pause = sleep, now = () => new Date(), channel = null } = {}) {
  let active = null;
  return {
    name: 'browser',
    async probe() {
      // Avoid disrupting the other AI workers on the desktop's low-memory system.
      if (os.freemem() < 650 * 1024 * 1024) return { available: false, code: 'LOW_AVAILABLE_MEMORY' };
      try {
        const pw = await playwrightProvider();
        return { available: !!pw?.chromium?.launchPersistentContext, code: 'PLAYWRIGHT_NOT_AVAILABLE' };
      } catch { return { available: false, code: 'PLAYWRIGHT_NOT_AVAILABLE' }; }
    },
    async join(ctx) {
      const pw = await playwrightProvider();
      if (!ctx.browserProfile) return { state: 'REQUIRES_HUMAN', code: 'DEDICATED_PROFILE_NOT_CONFIGURED' };
      let browser;
      let keepAlive = false;
      try {
        const selectedChannel = channel || ctx.browserChannel || 'msedge';
        browser = await pw.chromium.launchPersistentContext(resolve(ctx.browserProfile, selectedChannel), {
          channel: selectedChannel,
          headless: ctx.testFixture === true, // only synthetic local E2E may opt into headless
          viewport: { width: 1260, height: 860 },
          args: ['--no-first-run'],
          acceptDownloads: false,
        });
        const page = browser.pages()[0] || await browser.newPage();
        const navigation = await page.goto(ctx.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (navigation?.status?.() === 403) return { state: 'FAILED', code: 'BROWSER_HTTP_403' };
        await pause(2200);
        const prejoin = await performPlatformPrejoin(page, ctx.platform, {
          displayName: ctx.displayName,
          pause,
        });
        if (['HOST_DENIED', 'POLICY_BLOCKED', 'WAITING_ADMISSION', 'REQUIRES_HUMAN'].includes(prejoin.state)) {
          return { state: prejoin.state, code: prejoin.code };
        }
        if (prejoin.state === 'UNSUPPORTED') {
          return { state: 'UNAVAILABLE', code: 'UNSUPPORTED_PLATFORM' };
        }
        let current = await classifyPage(page, ctx.platform);
        const until = Date.now() + ctx.joinTimeoutMs;
        while (Date.now() < until) {
          current = await classifyPage(page, ctx.platform);
          if (current === 'JOINED') {
            const audioTracks = await countAttachedAudioTracks(page);
            active = { browser, page, platform: ctx.platform };
            keepAlive = true;
            return {
              state: 'JOINED', code: 'BROWSER_JOINED',
              proof: { type: 'IN_CALL_LEAVE_CONTROL', observedAt: now().toISOString(), audioTracksDetected: audioTracks },
            };
          }
          if (current === 'HOST_DENIED') return { state: 'HOST_DENIED', code: 'HOST_REFUSED_ADMISSION' };
          if (current === 'REQUIRES_HUMAN') return { state: 'REQUIRES_HUMAN', code: 'SIGN_IN_REQUIRED' };
          await pause(2000);
        }
        if (current === 'WAITING_ADMISSION') return { state: 'WAITING_ADMISSION', code: 'HOST_ADMISSION_PENDING' };
        if (ctx.platform === 'zoom' && await visibleByRole(page,'button',/join from (?:your )?browser/i))
          return { state: 'FAILED', code: 'ZOOM_WEB_ENTRY_STALLED' };
        return { state: 'UNCERTAIN', code: 'BROWSER_JOIN_NOT_VERIFIED' };
      } catch {
        return { state: 'FAILED', code: 'BROWSER_LAUNCH_OR_JOIN_FAILED' };
      } finally {
        // Stay in the conference after admission. Only close an unsuccessful attempt.
        if (browser && !keepAlive) await browser.close().catch(() => {});
      }
    },
    async maintain({ signal, intervalMs = 3000, maxSessionMs = 4 * 60 * 60 * 1000 } = {}) {
      if (!active) return { state: 'NO_ACTIVE_SESSION' };
      const until = Date.now() + maxSessionMs;
      let missing = 0;
      let ticks = 0;
      while (Date.now() < until && !signal?.aborted) {
        if (active.page.isClosed()) return { state: 'SESSION_DISCONNECTED', reason: 'PAGE_CLOSED' };
        const state = await classifyPage(active.page, active.platform);
        if (state === 'HOST_DENIED') return { state: 'HOST_DENIED' };
        if (state === 'JOINED') { missing = 0; ticks++; }
        else {
          missing++;
          if (missing >= 3) return { state: 'SESSION_DISCONNECTED', reason: 'LEAVE_CONTROL_MISSING' };
        }
        await pause(intervalMs);
      }
      return { state: signal?.aborted ? 'OPERATOR_STOPPED' : 'SESSION_MAX_DURATION', healthyChecks: ticks };
    },
    async close() {
      if (!active) return;
      const old = active;
      active = null;
      await old.browser.close().catch(() => {});
    },
  };
}

export function createDesktopAdapter({ launcher = spawn, platform = process.platform } = {}) {
  return {
    name: 'desktop',
    async probe() {
      return { available: platform === 'win32', code: 'WINDOWS_REQUIRED' };
    },
    async join(ctx) {
      if (platform !== 'win32') return { state: 'UNAVAILABLE', code: 'WINDOWS_REQUIRED' };
      try {
        const child = launcher('rundll32.exe', ['url.dll,FileProtocolHandler', ctx.meetingUrl], {
          shell: false, windowsHide: true, stdio: 'ignore',
        });
        await new Promise((resolveSpawn, rejectSpawn) => {
          child.once('spawn', resolveSpawn);
          child.once('error', rejectSpawn);
        });
        // An OS link handler only launches a client; it does not prove meeting admission.
        return { state: 'LAUNCHED_UNVERIFIED', code: 'OS_MEETING_HANDLER_LAUNCHED' };
      } catch {
        return { state: 'FAILED', code: 'OS_HANDLER_LAUNCH_FAILED' };
      }
    },
  };
}

export function createAdapters() {
  return {
    browser: createBrowserAdapter(),
    edge: createBrowserAdapter({ channel: 'msedge' }),
    chrome: createBrowserAdapter({ channel: 'chrome' }),
    recall: createRecallAdapter(),
    desktop: createDesktopAdapter(),
  };
}
