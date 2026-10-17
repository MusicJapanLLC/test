// Platform-specific pre-join controls are intentionally separate from the router.
// Visible page text is untrusted; these helpers only choose narrowly scoped UI actions.
// They NEVER auto-approve sign-in, email OTP, lobby admission, or recording consent.

export const JOIN_BUTTONS = Object.freeze({
  zoom: /^(?:Join|Join Meeting|Join now|参加|ミーティングに参加|今すぐ参加)$/i,
  google_meet: /^(?:Join now|Ask to join|Request to join|今すぐ参加|参加をリクエスト|参加をリクエストする|参加を求める)$/i,
  teams: /^(?:Join now|Join meeting|Join|今すぐ参加|会議に参加|参加)$/i,
});
export const BROWSER_ENTRY_BUTTONS = Object.freeze({
  zoom: /^(?:Join from browser|Join from your browser|ブラウザから参加|ブラウザーから参加)$/i,
  teams: /^(?:Continue on this browser|Continue in this browser|Join on the web instead|Continue on web|このブラウザーで続行|このブラウザで続行|ブラウザーで続行)$/i,
});
export const BROWSER_ENTRY_LINKS = Object.freeze({
  zoom: /^(?:Join from browser|Join from your browser|ブラウザから参加|ブラウザーから参加)$/i,
  teams: /^(?:Continue on this browser|Continue in this browser|Join on the web instead|Continue on web|このブラウザーで続行|このブラウザで続行|ブラウザーで続行)$/i,
});
export const IN_CALL_LEAVE_BUTTONS = Object.freeze({
  zoom: /^(?:Leave Meeting|Leave|ミーティングから退出|退出)$/i,
  google_meet: /^(?:Leave call|Leave|通話を終了|退出|通話から退出)$/i,
  teams: /^(?:Leave|Hang up|Leave meeting|退出|通話を終了|会議を退出)$/i,
});

const DENIED = /(?:you (?:were|have been) denied|host (?:denied|rejected)|request (?:was )?(?:denied|rejected)|not allowed to join|access denied|参加を拒否され|参加が拒否され|入室を拒否され|参加できません)/i;
const AUTH_REQUIRED = /(?:you need to sign in|sign in to join|sign in is required|verify your identity|enter (?:the |a )?(?:one.time )?(?:passcode|verification code)|enter your email address|check your email for (?:a |the )?code|サインインする必要|ログインする必要|本人確認が必要|確認コードを入力|メールに届いたコード|メールアドレスを入力してください)/i;
const GENERIC_LOBBY = /(?:waiting room|waiting for (?:the )?host|waiting to be admitted|waiting for someone to (?:let|admit) you in|you(?:'re| are) in the lobby|someone in the meeting should let you in|承認待ち|待機室|入室を待っています|ホストが参加を許可するまで|参加を承認)/i;
const GOOGLE_REQUESTED = /(?:asking to join|you asked to join|request to join (?:was )?sent|your request to join|参加リクエストを送信|参加をリクエストしました|参加をリクエストしています)/i;

export function classifyMeetingText(platform, text) {
  if (!['zoom', 'google_meet', 'teams'].includes(platform)) return 'UNSUPPORTED_PLATFORM';
  if (typeof text !== 'string') return 'UNKNOWN';
  const normalized = text.slice(0, 16000);
  if (DENIED.test(normalized)) return 'HOST_DENIED';
  if (AUTH_REQUIRED.test(normalized)) return 'REQUIRES_HUMAN';
  if (GENERIC_LOBBY.test(normalized) || platform === 'google_meet' && GOOGLE_REQUESTED.test(normalized))
    return 'WAITING_ADMISSION';
  return 'UNKNOWN';
}

export async function executePreJoin(page, platform, actions) {
  const { click, fillName, classify, pause, displayName } = actions;
  if (!JOIN_BUTTONS[platform]) return { status: 'UNSUPPORTED_PLATFORM', actions: [] };
  const done = [];
  const initial = await classify(page, platform);
  if (['HOST_DENIED', 'REQUIRES_HUMAN', 'WAITING_ADMISSION', 'JOINED'].includes(initial))
    return { status: initial, actions: done };
  const buttonLabel = BROWSER_ENTRY_BUTTONS[platform];
  if (buttonLabel) {
    const clicked = await click(page, 'button', buttonLabel) || await click(page, 'link', BROWSER_ENTRY_LINKS[platform]);
    if (clicked) {
      done.push('SELECT_BROWSER_CLIENT');
      await pause(900);
    }
  }
  const afterChoice = await classify(page, platform);
  if (['HOST_DENIED', 'REQUIRES_HUMAN', 'WAITING_ADMISSION', 'JOINED'].includes(afterChoice))
    return { status: afterChoice, actions: done };
  if (await fillName(page, displayName)) done.push('SET_GUEST_DISPLAY_NAME');
  const join = await click(page, 'button', JOIN_BUTTONS[platform]);
  if (join) done.push('SUBMIT_JOIN_REQUEST');
  // Clicking a join control is never authoritative evidence of meeting admission.
  return { status: join ? 'JOIN_REQUEST_SUBMITTED' : 'NO_JOIN_CONTROL', actions: done };
}
