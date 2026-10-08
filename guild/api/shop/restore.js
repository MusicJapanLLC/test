// POST /api/shop/restore { save } … そのセーブで買ったもの（返金されていない支払い）の一覧
//  受け取りの途中でブラウザを閉じた・端末の記録が消えた、などのときに、もう一度受け取るため。
//  ゲーム側は受け取り済みの決済（session）を覚えているので、二重には受け取らない
const { readiness, json, readBody, product, pub } = require('../_common');
const { call } = require('../_stripe');
const { refused } = require('../_refund');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!readiness().keyed) return json(res, 503, { error: 'not_ready' });
  const b = await readBody(req);
  const save = String(b.save || '');
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(save)) return json(res, 400, { error: 'save' });
  try {
    const q = `metadata['save']:'${save}' AND status:'succeeded'`;
    const r = await call('GET', `/payment_intents/search?limit=20&expand[]=data.latest_charge&query=${encodeURIComponent(q)}`);
    const out = [];
    for (const pi of r.data || []) {
      if (refused(pi) || (pi.metadata || {}).save !== save) continue;
      const p = product(pi.metadata.product);
      if (!p) continue;
      const ss = await call('GET', `/checkout/sessions?limit=1&payment_intent=${encodeURIComponent(pi.id)}`);
      const s = (ss.data || [])[0];
      if (!s || s.payment_status !== 'paid') continue;
      out.push({ session: s.id, product: pub(p), amount: s.amount_total, at: s.created });
    }
    return json(res, 200, { ok: true, items: out });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
