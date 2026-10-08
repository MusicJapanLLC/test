// POST /api/shop/claim { session, save } … 支払いを確かめて、中身を渡す
//  - 買ったときのセーブにだけ渡す（決済ページの URL を知っていても、ほかのセーブでは受け取れない）
//  - 返金・異議申し立てのあった支払いは渡さない
//  - 受け取り済みでも、同じセーブなら、もう一度返す（通信が切れたときのため。ゲーム側で二重に受け取らない）
const { json, readBody, product, pub } = require('../_common');
const { call } = require('../_stripe');
const { refused } = require('../_refund');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const b = await readBody(req);
  const id = String(b.session || '');
  const save = String(b.save || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json(res, 400, { error: 'session' });
  try {
    const s = await call('GET', `/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent.latest_charge`);
    if (s.payment_status !== 'paid') return json(res, 402, { error: 'unpaid' });
    const p = product(s.metadata && s.metadata.product);
    if (!p) return json(res, 400, { error: 'product' });
    if (!s.metadata || s.metadata.save !== save) return json(res, 409, { error: 'other_save' });
    const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
    if (refused(pi)) return json(res, 410, { error: 'refunded' });
    const claimed = pi && pi.metadata && pi.metadata.claimed === '1';
    if (pi && !claimed) await call('POST', `/payment_intents/${pi.id}`, { metadata: { claimed: '1', claimed_at: String(Math.floor(Date.now() / 1000)) } });
    return json(res, 200, { ok: true, session: s.id, product: pub(p), amount: s.amount_total, at: s.created });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
