// POST /mayor/pay/api/restore { recoveryCode } … 別の端末で、保存した復元コードから購入を戻す
const { json, readBody } = require('../_common');
const { mode, verify, owned } = require('../_mayor');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const m = mode();
  if (m === 'preview') return json(res, 503, { error: 'not_ready' });
  const b = await readBody(req);
  const token = String(b.recoveryCode || '').trim();
  try {
    const customer = await verify(token);
    if (!customer) return json(res, 401, { error: 'identity' });
    return json(res, 200, { token, playerId: customer, mode: m, entitlements: await owned(customer) });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
