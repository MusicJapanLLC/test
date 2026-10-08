// GET /api/shop/config … 売り場が開いているか・品の一覧・表示用の事業者情報
const { CATALOG, seller, readiness, json, pub } = require('../_common');
module.exports = async function handler(req, res) {
  const r = readiness();
  json(res, 200, { enabled: r.enabled, products: CATALOG.map(pub), seller: seller(), missing: r.enabled ? [] : r.missing });
};
