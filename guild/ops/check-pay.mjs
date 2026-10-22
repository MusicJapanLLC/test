// 課金 API（ギルドの灯 /api/shop・村長 /mayor/pay/api）を、本物の Stripe に触らずに確かめる
//   node guild/ops/check-pay.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- 偽の Stripe（必要なぶんだけ）
const db = { customers: {}, sessions: {}, intents: {}, n: 0 };
const id = (p) => `${p}_${(++db.n).toString(36).padStart(8, '0')}`;
const seen = [];
function parseForm(s) {
  const out = {};
  for (const part of String(s || '').split('&').filter(Boolean)) {
    const [k, v = ''] = part.split('=').map(decodeURIComponent);
    let o = out;
    const keys = k.replace(/\]/g, '').split('[');
    keys.forEach((key, i) => { if (i === keys.length - 1) o[key] = v; else o = o[key] = o[key] || {}; });
  }
  return out;
}
const ok = (j) => new Response(JSON.stringify(j), { status: 200 });
const nf = () => new Response(JSON.stringify({ error: { code: 'resource_missing', message: 'No such object' } }), { status: 404 });
const withPi = (s) => ({ ...s, payment_intent: s.payment_intent ? db.intents[s.payment_intent] : null });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  assert.equal(u.origin, 'https://api.stripe.com');
  assert.match(init.headers.Authorization, /^Bearer (sk|rk)_(test|live)_/);
  const path = u.pathname.replace(/^\/v1/, '');
  const body = parseForm(init.body);
  seen.push({ method: init.method, path, body, idem: init.headers['Idempotency-Key'] });
  let m;
  if (init.method === 'POST' && path === '/customers') {
    const c = { id: id('cus'), object: 'customer', metadata: body.metadata || {} };
    return ok((db.customers[c.id] = c));
  }
  if (init.method === 'GET' && (m = /^\/customers\/(\w+)$/.exec(path))) return db.customers[m[1]] ? ok(db.customers[m[1]]) : nf();
  if (init.method === 'POST' && path === '/checkout/sessions') {
    const amount = Number(body.line_items[0].price_data.unit_amount);
    const s = { id: id('cs_test'), object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/x', status: 'open', payment_status: 'unpaid', amount_total: amount, created: 1792650000, customer: body.customer || null, metadata: body.metadata, payment_intent: null, _body: body };
    return ok((db.sessions[s.id] = s));
  }
  if (init.method === 'GET' && path === '/checkout/sessions') {
    const q = u.searchParams;
    const list = Object.values(db.sessions).filter((s) => (!q.get('customer') || s.customer === q.get('customer')) && (!q.get('status') || s.status === q.get('status')) && (!q.get('payment_intent') || s.payment_intent === q.get('payment_intent')));
    return ok({ object: 'list', data: list.map(withPi) });
  }
  if (init.method === 'GET' && (m = /^\/checkout\/sessions\/(\w+)$/.exec(path))) return db.sessions[m[1]] ? ok(withPi(db.sessions[m[1]])) : nf();
  if (init.method === 'POST' && (m = /^\/payment_intents\/(\w+)$/.exec(path))) {
    const pi = db.intents[m[1]];
    Object.assign(pi.metadata, body.metadata || {});
    return ok(pi);
  }
  throw new Error(`unexpected Stripe call ${init.method} ${path}`);
};
// 決済ページで支払いが済んだことにする
function pay(sessionId, charge = {}) {
  const s = db.sessions[sessionId];
  const pi = { id: id('pi'), object: 'payment_intent', status: 'succeeded', metadata: { ...(s._body.payment_intent_data.metadata || {}) }, latest_charge: { id: id('ch'), refunded: false, amount_refunded: 0, disputed: false, ...charge } };
  db.intents[pi.id] = pi;
  Object.assign(s, { status: 'complete', payment_status: 'paid', payment_intent: pi.id });
  return pi;
}

// ---------------------------------------------------------------- 関数を呼ぶ
async function hit(mod, { method = 'GET', body, headers = {} } = {}) {
  const handler = require(`../api/${mod}`);
  const res = { statusCode: 0, headers: {}, out: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { this.out = s; } };
  await handler({ method, body, headers: { host: 'game.music-japan.com', ...headers } }, res);
  return { status: res.statusCode, json: JSON.parse(res.out || '{}'), headers: res.headers };
}
const SELLER = { SELLER_NAME: '合同会社Music Japan', SELLER_REP: 'テスト代表', SELLER_ADDRESS: 'テスト住所', SELLER_PHONE: '000-0000-0000', SELLER_EMAIL: 'test@example.invalid' };
function env(key) {
  for (const k of ['STRIPE_SECRET_KEY', 'SHOP_ENABLED', 'PUBLIC_URL', ...Object.keys(SELLER)]) delete process.env[k];
  if (key) Object.assign(process.env, SELLER, { STRIPE_SECRET_KEY: key });
}

// ---------------------------------------------------------------- ギルドの灯
env(null);
let r = await hit('shop/config');
assert.equal(r.json.enabled, false);
assert.ok(r.json.missing.includes('STRIPE_SECRET_KEY'));
assert.equal((await hit('shop/checkout', { method: 'POST', body: { id: 'cry60', save: 'save12345' } })).status, 503);

env('sk_test_fake');
r = await hit('shop/config');
assert.equal(r.json.enabled, true);
assert.deepEqual(r.json.missing, []);
r = await hit('shop/checkout', { method: 'POST', body: { id: 'cry330', save: 'saveA1234' } });
assert.equal(r.status, 200);
assert.match(r.json.url, /^https:\/\/checkout\.stripe\.com\//);
const gs = db.sessions[r.json.id];
assert.equal(gs._body.line_items[0].price_data.unit_amount, '600');
assert.equal(gs._body.line_items[0].price_data.currency, 'jpy');
assert.equal(gs._body.success_url, 'https://game.music-japan.com/?paid={CHECKOUT_SESSION_ID}');
assert.equal((await hit('shop/checkout', { method: 'POST', body: { id: 'nope', save: 'saveA1234' } })).status, 400);
assert.equal((await hit('shop/claim', { method: 'POST', body: { session: gs.id, save: 'saveA1234' } })).status, 402);
pay(gs.id);
assert.equal((await hit('shop/claim', { method: 'POST', body: { session: gs.id, save: 'someoneElse' } })).status, 409);
r = await hit('shop/claim', { method: 'POST', body: { session: gs.id, save: 'saveA1234' } });
assert.equal(r.status, 200);
assert.equal(r.json.product.id, 'cry330');
assert.equal(r.json.product.grant.cry, 330);
assert.equal(db.intents[db.sessions[gs.id].payment_intent].metadata.claimed, '1');
r = await hit('shop/checkout', { method: 'POST', body: { id: 'cry60', save: 'saveR1234' } });
pay(r.json.id, { refunded: true, amount_refunded: 120 });
assert.equal((await hit('shop/claim', { method: 'POST', body: { session: r.json.id, save: 'saveR1234' } })).status, 410);
console.log('guild: closed without keys, server-side price, paid-only claim, per-save claim, refund refusal passed');

// ---------------------------------------------------------------- 村長、世界まで行くんですか？
env(null);
assert.equal((await hit('mayor/catalog')).json.mode, 'preview');
assert.equal((await hit('mayor/player', { method: 'POST', body: {} })).status, 503);
env('sk_live_fake');
assert.equal((await hit('mayor/catalog')).json.mode, 'live');
env('rk_test_fake');
r = await hit('mayor/catalog');
assert.equal(r.json.mode, 'test');
assert.deepEqual(r.json.products.map((p) => [p.sku, p.amount]), [['supporter', 300], ['golden_seal', 980], ['mayor_mech', 1980]]);

const player = (await hit('mayor/player', { method: 'POST', body: {} })).json;
assert.match(player.token, /^cus_\w+\.[A-Za-z0-9_-]{43}$/);
assert.equal(player.playerId, player.token.split('.')[0]);
assert.equal(JSON.stringify(db.customers[player.playerId]).includes(player.token.split('.')[1]), false, 'secret is never stored');
const auth = { authorization: `Bearer ${player.token}` };
const forged = { authorization: `Bearer ${player.playerId}.${'A'.repeat(43)}` };

assert.equal((await hit('mayor/entitlements', { headers: forged })).status, 401);
assert.equal((await hit('mayor/entitlements', { headers: { authorization: 'Bearer cus_missing.' + 'A'.repeat(43) } })).status, 401);
assert.deepEqual((await hit('mayor/entitlements', { headers: auth })).json, { mode: 'test', entitlements: [] });

assert.equal((await hit('mayor/checkout', { method: 'POST', body: { sku: 'golden_seal' }, headers: forged })).status, 401);
assert.equal((await hit('mayor/checkout', { method: 'POST', body: { sku: 'free_robot' }, headers: auth })).status, 400);
r = await hit('mayor/checkout', { method: 'POST', body: { sku: 'golden_seal', requestId: '8c1f-uuid' }, headers: auth });
assert.equal(r.status, 200);
assert.match(r.json.url, /^https:\/\/checkout\.stripe\.com\//);
const ms = db.sessions[r.json.id];
assert.equal(ms._body.line_items[0].price_data.unit_amount, '980');
assert.equal(ms._body.customer, player.playerId);
assert.equal(ms._body.success_url, 'https://game.music-japan.com/mayor/?checkout=success');
assert.equal(seen.at(-1).idem, `mayor-${player.playerId}-8c1f-uuid`);
assert.deepEqual((await hit('mayor/entitlements', { headers: auth })).json.entitlements, [], 'unpaid checkout grants nothing');
pay(ms.id);
assert.deepEqual((await hit('mayor/entitlements', { headers: auth })).json.entitlements, ['golden_seal']);
r = await hit('mayor/checkout', { method: 'POST', body: { sku: 'golden_seal', requestId: 'again' }, headers: auth });
assert.equal(r.status, 409);
assert.equal(r.json.error, 'already_owned');

r = await hit('mayor/checkout', { method: 'POST', body: { sku: 'mayor_mech', requestId: 'robot' }, headers: auth });
pay(r.json.id, { disputed: true });
assert.deepEqual((await hit('mayor/entitlements', { headers: auth })).json.entitlements, ['golden_seal'], 'disputed payment grants nothing');

r = await hit('mayor/restore', { method: 'POST', body: { recoveryCode: ` ${player.token} ` } });
assert.equal(r.status, 200);
assert.equal(r.json.token, player.token);
assert.deepEqual(r.json.entitlements, ['golden_seal']);
assert.equal((await hit('mayor/restore', { method: 'POST', body: { recoveryCode: forged.authorization.slice(7) } })).status, 401);
console.log('mayor: preview/test/live mode, hashed recovery code, forged code refusal, paid-only and refund/dispute-aware entitlements, duplicate refusal, restore passed');
