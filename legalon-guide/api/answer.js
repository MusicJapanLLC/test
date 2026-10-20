/**
 * 「話してみる」の回答を受け取り、Google Apps Script（gas/Code.gs）へ渡す。
 * GAS が music.japan.llc@gmail.com にだけメールを送る。
 *
 * - 送信先の URL は環境変数 GAS_ENDPOINT（ページのソースには出さない）
 * - ここで形と長さを確かめてから渡す。おとりの欄が埋まっていたら、送ったふりだけする
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEXT_FIELDS = ['company', 'name', 'email', 'role', 'capital', 'employees', 'q1', 'q2', 'tel'];
const LIST_FIELDS = ['q3', 'q4', 'q5'];
const REQUIRED = ['company', 'name', 'email', 'role', 'capital', 'employees', 'q1', 'q2', 'tel'];

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function normalize(body) {
  const out = {};
  for (const key of TEXT_FIELDS) out[key] = clip(body[key], key === 'company' ? 120 : 80);
  for (const key of LIST_FIELDS) {
    const list = Array.isArray(body[key]) ? body[key] : [];
    out[key] = list.slice(0, 12).map((s) => clip(s, 60)).filter(Boolean);
  }
  return out;
}

function invalid(a) {
  for (const key of REQUIRED) if (!a[key]) return key;
  if (!EMAIL_RE.test(a.email)) return 'email';
  const digits = a.tel.replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 13) return 'tel';
  if (!a.q3.length) return 'q3';
  if (!a.q4.length) return 'q4';
  return '';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'body' });

  // おとりの欄が埋まっている、または開いてすぐの送信は機械とみなす（相手には成功に見せる）
  if (body.website || Number(body.elapsed) < 4000) return res.status(200).json({ ok: true });

  const answer = normalize(body);
  const bad = invalid(answer);
  if (bad) return res.status(400).json({ ok: false, error: 'invalid', field: bad });

  const endpoint = (process.env.GAS_ENDPOINT || '').trim();
  if (!endpoint) return res.status(503).json({ ok: false, error: 'not_configured' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(answer),
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!r.ok || !data || data.ok !== true) return res.status(502).json({ ok: false, error: 'relay' });
    return res.status(200).json({ ok: true, id: data.id || '' });
  } catch {
    return res.status(502).json({ ok: false, error: 'relay' });
  } finally {
    clearTimeout(timer);
  }
};
