export type ConsultPayload = {
  partnerId: string;
  partnerName: string;
  receiptId: string;
  timestamp: string;
  source: 'web';
  page: string;
  answers: Record<string, string | string[]>;
  questions: Record<string, string>;
  profile: { company: string; name: string; email: string; role: string; lineName: string };
  comment: string;
};

const ENDPOINT = (import.meta.env.VITE_GAS_ENDPOINT ?? '').trim();
const TIMEOUT_MS = 15000;

/** 送信先が未設定の間はデモとして動かす（実際には送らない） */
export const IS_DEMO = !ENDPOINT || import.meta.env.VITE_DEMO === '1';

/**
 * GAS の Web App へ送る。CORS プリフライトを避けるため no-cors + text/plain。
 * no-cors のレスポンスは読めないので、ネットワークまで届いたかだけを成否とする。
 * 受付番号はブラウザ側で発行して一緒に送る（画面に出す番号と記録の番号を必ず一致させるため）。
 */
export async function submitConsult(payload: ConsultPayload): Promise<void> {
  if (IS_DEMO) {
    console.info('[baton-partners] デモのため送信していません:', payload);
    await new Promise((r) => setTimeout(r, 700));
    return;
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
    throw new Error('送信できませんでした。時間をおいて、もう一度お試しください。');
  } finally {
    window.clearTimeout(timer);
  }
}

/** 例: BP-EVORG-260928-7K2Q */
export function makeReceiptId(partner: string, now = new Date()): string {
  const d = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const rand = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `BP-${partner.toUpperCase()}-${d}-${rand}`;
}
