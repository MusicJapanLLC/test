// POST /api/shop/claim { session, save } … 支払いを確かめて、中身を渡す（同じ支払いは1つのセーブに1回だけ）
const { json, readBody, product, pub } = require('../_common');
const { call } = require('../_stripe');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const b = await readBody(req);
  const id = String(b.session || '');
  const save = String(b.save || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json(res, 400, { error: 'session' });
  try {
    const s = await call('GET', `/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent`);
    if (s.payment_status !== 'paid') return json(res, 402, { error: 'unpaid' });
    const p = product(s.metadata && s.metadata.product);
    if (!p) return json(res, 400, { error: 'product' });
    const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
    const claimed = pi && pi.metadata && pi.metadata.claimed === '1';
    // 受け取り済みでも、買ったときと同じセーブなら、もう一度返す（通信が切れたときのため。ゲーム側で二重に受け取らない）
    if (claimed && s.metadata.save !== save) return json(res, 409, { error: 'claimed' });
    if (pi && !claimed) await call('POST', `/payment_intents/${pi.id}`, { metadata: { claimed: '1', claimed_at: String(Math.floor(Date.now() / 1000)) } });
    return json(res, 200, { ok: true, session: s.id, product: pub(p), amount: s.amount_total, at: s.created });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
