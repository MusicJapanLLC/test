// 村長、世界まで行くんですか？（/mayor/）の買い切り品。値段と中身の正本はサーバー側
//   購入用IDは Stripe の Customer。復元コード = 「cus_xxx.秘密」。秘密そのものは保存せず、ハッシュだけを Customer に残す
//   買ったもの = その Customer の支払い済み Checkout（返金・異議申し立てのあったものは除く）
const crypto = require('crypto');
const { readiness } = require('./_common');
const { call } = require('./_stripe');
const { refused } = require('./_refund');

const GAME = 'mayor';
const TITLE = '村長、世界まで行くんですか？';
const CATALOG = [
  { sku: 'supporter', name: '村長への差し入れ', amount: 300, description: '王冠と「太っ腹村長」の称号　攻撃力は増えません' },
  { sku: 'golden_seal', name: '黄金の決裁印', amount: 980, description: '村長の攻撃4倍＋黄金の衝撃波　承認が物理になる' },
  { sku: 'mayor_mech', name: '村長ロボ', amount: 1980, description: '15秒間、攻撃6倍とダメージ80%軽減　45秒ごとに出動' },
];
const item = (sku) => CATALOG.find((p) => p.sku === sku) || null;

// preview = 売り場が閉じている / test・live = 鍵の種類
function mode() {
  if (!readiness().enabled) return 'preview';
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '') ? 'live' : 'test';
}

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function newPlayer() {
  const secret = crypto.randomBytes(32).toString('base64url');
  const c = await call('POST', '/customers', { description: `${TITLE} 購入用ID`, metadata: { mj_game: GAME, mj_token_hash: hash(secret) } });
  return { token: `${c.id}.${secret}`, playerId: c.id };
}
// 復元コードを確かめて Customer の id を返す。違えば null
async function verify(token) {
  const m = /^(cus_[A-Za-z0-9]+)\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
  if (!m) return null;
  let c;
  try { c = await call('GET', `/customers/${m[1]}`); } catch (e) { if (e.status === 404) return null; throw e; }
  const want = c && !c.deleted && c.metadata && c.metadata.mj_game === GAME ? String(c.metadata.mj_token_hash || '') : '';
  const got = hash(m[2]);
  if (want.length !== got.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got))) return null;
  return c.id;
}
const bearer = (req) => (/^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || '')) || [])[1] || '';

async function owned(customer) {
  const r = await call('GET', `/checkout/sessions?limit=100&status=complete&customer=${encodeURIComponent(customer)}&expand[]=data.payment_intent.latest_charge`);
  const out = new Set();
  for (const s of r.data || []) {
    const md = s.metadata || {};
    if (s.payment_status !== 'paid' || md.mj_game !== GAME || !item(md.sku)) continue;
    const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
    if (refused(pi)) continue;
    out.add(md.sku);
  }
  return [...out];
}

module.exports = { GAME, TITLE, CATALOG, item, mode, newPlayer, verify, bearer, owned };
