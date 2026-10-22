/**
 * Platform-specific, conservative UI flows for user-authorized meeting links.
 * Controls are matched by accessible roles/names; no DOM injection, CAPTCHA or
 * sign-in bypass, and no recording until explicit upstream consent is verified.
 */
const NAMES = Object.freeze({
  zoom: {
    browser: /^(?:Join from (?:your )?browser|Join from browser|ブラウザから参加)$/i,
    join: /^(?:Join|Join Meeting|ミーティングに参加|参加)$/i,
    leave: /^(?:Leave|Leave Meeting|Leave meeting|ミーティングから退出|退出)$/i,
  },
  google_meet: {
    join: /^(?:Join now|今すぐ参加|参加)$/i,
    request: /^(?:Ask to join|Request to join|参加をリクエスト|参加をリクエストする)$/i,
    leave: /^(?:Leave call|Leave meeting|通話から退出|通話を終了|退出)$/i,
  },
  teams: {
    browser: /^(?:Continue on this browser|Join on the web instead|Use the web app instead|このブラウザーで続ける|このブラウザで続行|ブラウザーで続ける)$/i,
    join: /^(?:Join now|Join meeting|今すぐ参加|会議に参加|参加)$/i,
    leave: /^(?:Leave|Leave call|Hang up|会議から退出|退出|通話を終了)$/i,
  },
});
const GUEST_NAME = /^(?:your name|enter your name|display name|type your name|name|名前|名前を入力|名前を入力してください)$/i;
const DENIAL = /(?:you (?:were|have been) denied|host (?:denied|declined|rejected)|(?:join|entry) request was (?:denied|rejected)|参加を拒否され|参加が拒否され|主催者が参加を拒否)/i;
const ADMISSION = /(?:waiting room|waiting to be admitted|waiting for (?:someone|the host)|asking to join|request to join sent|someone in the meeting should let you in|lobby.*admit|承認待ち|参加リクエストを送信|ホストが参加を許可するまで|ロビーで待機)/i;
const IDENTITY = /(?:sign in to join|you need to sign in|verification code|one.time (?:passcode|code)|verify your (?:email|identity)|enter (?:the )?code (?:sent|from)|サインインする必要|ログインする必要|確認コード|ワンタイム(?:パスコード|コード)|メールアドレスを確認)/i;

export function supportedPlatform(platform) { return Object.hasOwn(NAMES, platform); }

async function visible(page, role, name) {
  if (!name) return false;
  try { return Boolean(await page.getByRole(role, { name }).first().isVisible({ timeout: 900 })); }
  catch { return false; }
}

async function click(page, role, name) {
  if (!await visible(page, role, name)) return false;
  try {
    await page.getByRole(role, { name }).first().click({ timeout: 4500 });
    return true;
  } catch { return false; }
}

async function bodyText(page) {
  try { return (await page.locator('body').innerText({ timeout: 3500 })).slice(0, 16000); }
  catch { return ''; }
}

export async function classifyPlatformState(page, platform) {
  if (!supportedPlatform(platform)) return 'UNSUPPORTED';
  const text = await bodyText(page);
  // Terminal/consent boundaries are checked *before* meeting controls. A
  // stale Leave control must never override a host's actual denial.
  if (DENIAL.test(text)) return 'HOST_DENIED';
  if (IDENTITY.test(text)) return 'REQUIRES_HUMAN';
  if (ADMISSION.test(text)) return 'WAITING_ADMISSION';
  if (await visible(page, 'button', NAMES[platform].leave)) return 'JOINED';
  return 'UNKNOWN';
}

async function fillGuestName(page, displayName) {
  if (typeof displayName !== 'string' || displayName.length > 128) return false;
  try {
    const field = page.getByRole('textbox', { name: GUEST_NAME }).first();
    if (await field.isVisible({ timeout: 700 })) {
      await field.fill(displayName, { timeout: 2500 });
      return true;
    }
  } catch {}
  try {
    const field = page.locator('input[placeholder]').filter({ hasNot: page.locator('[type=password]') }).first();
    if (!await field.isVisible({ timeout: 700 })) return false;
    const placeholder = await field.getAttribute('placeholder');
    if (!placeholder || !/name|名前/i.test(placeholder)) return false;
    await field.fill(displayName, { timeout: 2500 });
    return true;
  } catch { return false; }
}

export async function performPlatformPrejoin(page, platform, { displayName, pause = async () => {} } = {}) {
  if (!supportedPlatform(platform)) return { state: 'UNSUPPORTED', code: 'UNSUPPORTED_PLATFORM' };

  // Teams opens an interstitial offering the desktop app or supported browser.
  if (platform === 'teams') {
    const browserEntry = await click(page, 'button', NAMES.teams.browser) ||
                         await click(page, 'link', NAMES.teams.browser);
    if (browserEntry) await pause(1000);
  }

  // Zoom may present a browser entry alongside its native-app handoff. Never
  // activate the app from this browser route; it belongs to the desktop route.
  if (platform === 'zoom') {
    // Dismiss, never accept, an optional cookie popup if its close button is
    // visibly labeled. Meeting consent is separate from cookie consent.
    await click(page, 'button', /^(?:Close cookie banner|Close privacy dialog|Cookie バナーを閉じる)$/i);
    const browserEntry = await click(page, 'button', NAMES.zoom.browser) ||
                         await click(page, 'link', NAMES.zoom.browser);
    if (browserEntry) await pause(1000);
  }

  let state = await classifyPlatformState(page, platform);
  if (state !== 'UNKNOWN') return { state, code: state };

  await fillGuestName(page, displayName);
  state = await classifyPlatformState(page, platform);
  if (state !== 'UNKNOWN') return { state, code: state };

  if (platform === 'google_meet') {
    const asked = await click(page, 'button', NAMES.google_meet.request);
    if (asked) {
      await pause(1000);
      const after = await classifyPlatformState(page, platform);
      if (after === 'HOST_DENIED' || after === 'REQUIRES_HUMAN') return { state: after, code: after };
      // Ask-to-join is not permission to enter and cannot trigger another bot.
      return { state: 'WAITING_ADMISSION', code: 'HOST_ADMISSION_PENDING' };
    }
  }

  const pressed = await click(page, 'button', NAMES[platform].join);
  if (pressed) return { state: 'JOIN_ATTEMPTED', code: 'JOIN_BUTTON_PRESSED' };
  return { state: 'NO_JOIN_CONTROL', code: 'PLATFORM_JOIN_CONTROL_NOT_FOUND' };
}

export function browserEntryPattern(platform) {
  return NAMES[platform]?.browser || null;
}
