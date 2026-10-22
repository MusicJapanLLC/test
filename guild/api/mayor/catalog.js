// GET /mayor/pay/api/catalog … 売り場の状態（preview / test / live）と品の一覧
const { json } = require('../_common');
const { CATALOG, mode } = require('../_mayor');
module.exports = async function handler(req, res) {
  json(res, 200, { mode: mode(), products: CATALOG });
};
