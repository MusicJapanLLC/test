export type ConsultPayload = {
  partnerId: string;
  partnerName: string;
  receiptId: string;
  timestamp: string;
  source: 'web';
  page: string;
  answers: Record<string, string | string[]>;
  questions: Record<string, string>;
  profile: { company: string; name: string; email: string; role: string };
  comment: string;
  /** ポートフォリオ・資料のURL（任意） */
  portfolioUrl: string;
  /** 事前に共有したい資料（任意）。中身は base64 */
  files: { name: string; type: string; size: number; data: string }[];
};

/** 添付の上限。GAS の受け口（gas/Code.gs）と揃える */
export const FILE_LIMIT = { totalBytes: 30 * 1024 * 1024, count: 5 };
export const FILE_EXT = /\.(pdf|pptx?|key|docx?|xlsx?|csv|png|jpe?g|gif|webp|zip)$/i;

export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error(`「${file.name}」を読み込めませんでした。`));
    r.readAsDataURL(file);
  });
}

const ENDPOINT = (import.meta.env.VITE_GAS_ENDPOINT ?? '').trim();
const TIMEOUT_MS = 15000;
/** 添付があるときは、1MBあたり4秒を足す（回線が遅くても途中で切らない） */
const timeoutFor = (bytes: number) => TIMEOUT_MS + Math.ceil(bytes / 1024 / 1024) * 4000;

/** 送信先が未設定の間はデモとして動かす（実際には送らない） */
export const IS_DEMO = !ENDPOINT || import.meta.env.VITE_DEMO === '1';

/**
 * GAS の Web App へ送る。CORS プリフライトを避けるため no-cors + text/plain。
 * no-cors のレスポンスは読めないので、ネットワークまで届いたかだけを成否とする。
 * 受付番号はブラウザ側で発行して一緒に送る（画面に出す番号と記録の番号を必ず一致させるため）。
 */
export async function submitConsult(payload: ConsultPayload): Promise<void> {
  if (IS_DEMO) {
    const files = payload.files.map((f) => ({ ...f, data: `(${f.data.length} chars)` }));
    console.info('[baton-partners] デモのため送信していません:', { ...payload, files });
    await new Promise((r) => setTimeout(r, 700));
    return;
  }
  const controller = new AbortController();
  const bytes = payload.files.reduce((n, f) => n + f.size, 0);
  const timer = window.setTimeout(() => controller.abort(), timeoutFor(bytes));
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
  // 32-character alphabet: each output symbol maps to exactly 8 byte values.
  // Using the high five bits avoids modulo reduction and keeps the mapping uniform.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const rand = [...bytes].map((b) => alphabet[b >>> 3]).join('');
  return `BP-${partner.toUpperCase()}-${d}-${rand}`;
}
