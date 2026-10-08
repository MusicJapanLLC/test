const CATALOG = require('./_catalog');
// 販売事業者の情報は環境変数から（リポジトリには書かない）
function seller() {
  const e = process.env;
  return { name: e.SELLER_NAME || '', rep: e.SELLER_REP || '', address: e.SELLER_ADDRESS || '', phone: e.SELLER_PHONE || '', email: e.SELLER_EMAIL || '', hours: e.SELLER_HOURS || '' };
}
function readiness() {
  const s = seller();
  const missing = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  ['name', 'rep', 'address', 'phone', 'email'].forEach((k) => { if (!s[k]) missing.push('SELLER_' + k.toUpperCase()); });
  return { enabled: missing.length === 0 && process.env.SHOP_ENABLED !== '0', missing };
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}
// 戻り先：許可したホストだけ
function origin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (/^(game\.music-japan\.com|[a-z0-9-]+\.vercel\.app|localhost(:\d+)?)$/.test(host)) return (host.startsWith('localhost') ? 'http://' : 'https://') + host;
  return 'https://game.music-japan.com';
}
const product = (id) => CATALOG.find((p) => p.id === id) || null;
const pub = (p) => ({ id: p.id, kind: p.kind, name: p.name, price: p.price, desc: p.desc, bonus: p.bonus || '', grant: p.grant, days: p.days || 0, daily: p.daily || null });
module.exports = { CATALOG, seller, readiness, json, readBody, origin, product, pub };
