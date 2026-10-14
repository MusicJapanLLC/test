export interface RequestPayload {
  ticket: string;
  timestamp: string;
  type: string;
  typeLabel: string;
  game: string;
  gameTitle: string;
  severity: string;
  message: string;
  name: string;
  contact: string;
  env: string;
  page: string;
}

const ENDPOINT = (import.meta.env.VITE_GAS_ENDPOINT ?? '').trim();
const DEMO = (import.meta.env.VITE_DEMO ?? '') === '1';
const TIMEOUT_MS = 15000;

if (new URLSearchParams(location.search).has('debug')) {
  console.info('[mj-store] 送信先:', ENDPOINT || '(未設定)', DEMO ? '/ デモモード（送信しません）' : '');
}

/**
 * GAS の Web App へ送る（Baton と同じ方式）。
 * CORS のプリフライトを避けるため mode:'no-cors' + text/plain で送り、
 * GAS 側で e.postData.contents を JSON.parse する。
 */
export async function submitRequest(payload: RequestPayload): Promise<void> {
  if (DEMO) {
    console.info('[mj-store] デモモードのため送信していません。内容:', payload);
    await new Promise((r) => setTimeout(r, 800));
    return;
  }
  if (!ENDPOINT) {
    if (import.meta.env.DEV) {
      console.warn('[mj-store] VITE_GAS_ENDPOINT が未設定です。送信内容:', payload);
      await new Promise((r) => setTimeout(r, 600));
      return;
    }
    throw new Error('ただいま受付の準備中です。少し時間をおいて、もう一度お試しください。');
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
      throw new Error('送信に時間がかかっています。通信環境をご確認のうえ、もう一度お試しください。');
    }
    throw new Error('送信できませんでした。もう一度お試しください。');
  } finally {
    window.clearTimeout(timer);
  }
}
