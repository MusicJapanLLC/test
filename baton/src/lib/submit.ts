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
