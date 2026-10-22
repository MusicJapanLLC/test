// GET /mayor/pay/api/entitlements（Authorization: Bearer <復元コード>）… 買ったもの
const { json } = require('../_common');
const { mode, verify, bearer, owned } = require('../_mayor');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method' });
  const m = mode();
  if (m === 'preview') return json(res, 200, { mode: m, entitlements: [] });
  try {
    const customer = await verify(bearer(req));
    if (!customer) return json(res, 401, { error: 'identity' });
    return json(res, 200, { mode: m, entitlements: await owned(customer) });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
