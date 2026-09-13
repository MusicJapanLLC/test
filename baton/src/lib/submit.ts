export type SurveyPayload = {
  serviceId: string;
  timestamp: string;
  answers: Record<string, string | string[]>;
  profile: Record<string, string>;
  comment: string;
  contactMethod: string;
};

const ENDPOINT = (import.meta.env.VITE_GAS_ENDPOINT ?? '').trim();
const TIMEOUT_MS = 15000;

/** プレビュー用。送信先を持たずに、通しで動きだけ確かめたいとき */
const DEMO = (import.meta.env.VITE_DEMO ?? '') === '1';

/**
 * ?debug=1 を付けて開くと、実際に焼き込まれた送信先をコンソールに出す。
 * no-cors 送信は成否が読めないので、環境変数が正しいかを確かめる唯一の手段になる。
 */
if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  console.info(
    '[baton] 送信先:',
    ENDPOINT || '(未設定)',
    DEMO ? '/ デモモード（送信しません）' : '',
  );
}

/**
 * GAS の Web App へ送る。
 * CORS プリフライトを避けるため mode:'no-cors' + text/plain。
 * GAS 側は e.postData.contents を JSON.parse する前提。
 *
 * no-cors のレスポンスは opaque なので中身は読めない。
 * ネットワークまで届いたかどうかだけを成否として扱う。
 */
export async function submitSurvey(payload: SurveyPayload): Promise<void> {
  if (DEMO) {
    console.info('[baton] プレビューのため送信していません。内容:', payload);
    await new Promise((r) => setTimeout(r, 700));
    return;
  }

  if (!ENDPOINT) {
    if (import.meta.env.DEV) {
      console.warn('[baton] VITE_GAS_ENDPOINT が未設定です。送信内容:', payload);
      await new Promise((r) => setTimeout(r, 600));
      return;
    }
    throw new Error('送信先がまだ設定されていません。');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('送信に時間がかかっています。通信環境をご確認ください。');
    }
    throw new Error('送信できませんでした。');
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  Baton Introduction System 用の通信
 * ═══════════════════════════════════════════════════════════════
 *  こちらは応答を読む必要があるため（重複申請・トークン失効などを
 *  画面に伝える必要がある）、上の submitSurvey とは違い no-cors を使わない。
 *  プリフライトを避けるため POST の Content-Type は text/plain のまま。
 */

export type TalkAttachment = { name: string; mimeType: string; data: string };

export type TalkRequestPayload = {
  profileId: string;
  applicant: { name: string; company: string; title: string; email: string };
  /** 複数選択可 */
  purposes: string[];
  comment: string;
  note: string;
  /** 最大3件。data は base64（data:URLのヘッダは含まない） */
  attachments: TalkAttachment[];
  /** ハニーポット。人間には見えない欄で、埋まっていたらスパム扱いにする */
  hp: string;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type BatonResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string; message?: string };

async function batonFetch<T>(
  init: { method: 'GET' | 'POST'; query?: Record<string, string>; body?: unknown },
): Promise<BatonResult<T>> {
  if (!ENDPOINT) {
    return { ok: false, error: 'no_endpoint' };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = new URL(ENDPOINT);
    if (init.method === 'GET' && init.query) {
      Object.entries(init.query).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method: init.method,
      redirect: 'follow',
      signal: controller.signal,
      ...(init.method === 'POST'
        ? { headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(init.body) }
        : {}),
    });

    const text = await res.text();
    try {
      return JSON.parse(text) as BatonResult<T>;
    } catch {
      return { ok: false, error: 'bad_response' };
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'network' };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 「この人と話したい」の申請を送る */
export function submitTalkRequest(payload: TalkRequestPayload): Promise<BatonResult> {
  if (DEMO || (!ENDPOINT && import.meta.env.DEV)) {
    console.info('[baton] プレビューのため送信していません。内容:', payload);
    return new Promise((resolve) => window.setTimeout(() => resolve({ ok: true }), 700));
  }
  return batonFetch({ method: 'POST', body: { action: 'baton_talk_submit', ...payload } });
}

export type VerifyCheckResult = { state: 'ready' | 'used' | 'expired' | 'invalid'; profileName?: string };

/** メール認証リンクのトークンを確認する（画面表示用。状態は変えない） */
export function checkVerifyToken(token: string): Promise<BatonResult<VerifyCheckResult>> {
  return batonFetch({ method: 'GET', query: { action: 'baton_verify_check', t: token } });
}

/** メール認証を確定する（ここではじめて状態が変わる） */
export function confirmVerify(token: string): Promise<BatonResult> {
  return batonFetch({ method: 'POST', body: { action: 'baton_verify_confirm', t: token } });
}

export type RespondCheckResult = {
  state: 'ready' | 'used' | 'expired' | 'invalid';
  profileName?: string;
  request?: {
    applicantName: string;
    applicantCompany: string;
    applicantTitle: string;
    purposes: string[];
    comment: string;
    note: string;
  };
};

/** 承認/辞退リンクのトークンを確認する（画面表示用。状態は変えない） */
export function checkRespondToken(token: string): Promise<BatonResult<RespondCheckResult>> {
  return batonFetch({ method: 'GET', query: { action: 'baton_respond_check', t: token } });
}

/** 承認/辞退を確定する（ボタンを押した瞬間だけ呼ぶ。POSTで確定） */
export function submitRespondAction(
  token: string,
  decision: 'approved' | 'declined',
): Promise<BatonResult> {
  return batonFetch({ method: 'POST', body: { action: 'baton_respond_action', t: token, decision } });
}
