// POST /mayor/pay/api/player … はじめて買うときに購入用IDと復元コードを作る
const { json } = require('../_common');
const { mode, newPlayer } = require('../_mayor');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (mode() === 'preview') return json(res, 503, { error: 'not_ready' });
  try {
    return json(res, 200, await newPlayer());
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
