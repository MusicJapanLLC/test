// POST /api/shop/checkout { id, save } → Stripe の決済ページの URL
const { readiness, json, readBody, origin, product } = require('../_common');
const { call } = require('../_stripe');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!readiness().enabled) return json(res, 503, { error: 'not_ready' });
  const b = await readBody(req);
  const p = product(String(b.id || ''));
  const save = String(b.save || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!p) return json(res, 400, { error: 'product' });
  if (!save) return json(res, 400, { error: 'save' });
  const base = origin(req);
  try {
    const s = await call('POST', '/checkout/sessions', {
      mode: 'payment',
      locale: 'ja',
      payment_method_types: ['card'],
      client_reference_id: save,
      line_items: [{ quantity: 1, price_data: { currency: 'jpy', unit_amount: p.price, product_data: { name: `ギルドの灯 ${p.name}`, description: p.desc } } }],
      metadata: { product: p.id, save },
      payment_intent_data: { metadata: { product: p.id, save }, description: `ギルドの灯 ${p.name}` },
      success_url: `${base}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?paid=cancel`,
    });
    return json(res, 200, { url: s.url, id: s.id });
  } catch (e) {
    return json(res, 502, { error: e.code || 'stripe' });
  }
};
