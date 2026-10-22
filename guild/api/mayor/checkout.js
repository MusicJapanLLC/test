// POST /mayor/pay/api/checkout { sku, requestId }（Authorization: Bearer <復元コード>）→ Stripe の決済ページの URL
const { json, readBody, origin } = require('../_common');
const { call } = require('../_stripe');
const { GAME, TITLE, item, mode, verify, bearer, owned } = require('../_mayor');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (mode() === 'preview') return json(res, 503, { error: 'not_ready' });
  const b = await readBody(req);
  const p = item(String(b.sku || ''));
  if (!p) return json(res, 400, { error: 'sku' });
  const rid = String(b.requestId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  try {
    const customer = await verify(bearer(req));
    if (!customer) return json(res, 401, { error: 'identity' });
    if ((await owned(customer)).includes(p.sku)) return json(res, 409, { error: 'already_owned' });
    const base = origin(req);
    const md = { mj_game: GAME, sku: p.sku };
    const s = await call('POST', '/checkout/sessions', {
      mode: 'payment',
      locale: 'ja',
      customer,
      client_reference_id: customer,
      payment_method_types: ['card'],
      line_items: [{ quantity: 1, price_data: { currency: 'jpy', unit_amount: p.amount, product_data: { name: `${TITLE} ${p.name}`, description: p.description } } }],
      metadata: md,
      payment_intent_data: { metadata: md, description: `${TITLE} ${p.name}` },
      success_url: `${base}/mayor/?checkout=success`,
      cancel_url: `${base}/mayor/?checkout=cancel`,
    }, rid ? `mayor-${customer}-${rid}` : undefined);
    return json(res, 200, { url: s.url, id: s.id });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
