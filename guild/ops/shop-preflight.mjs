// 公開中のサイトで、売り場が開いているかを確かめる（Stripe には触らない・何も買わない）
//   node guild/ops/shop-preflight.mjs [https://game.music-japan.com]
const base = (process.argv[2] || 'https://game.music-japan.com').replace(/\/$/, '');
const rows = [];
const row = (ok, name, note = '') => rows.push(`${ok ? 'OK  ' : 'NG  '} ${name}${note ? ' … ' + note : ''}`);
async function get(path) {
  try { const r = await fetch(base + path, { cache: 'no-store' }); return { status: r.status, text: await r.text() }; } catch (e) { return { status: 0, text: String(e) }; }
}
const parse = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };

const shop = parse((await get('/api/shop/config')).text);
row(!!(shop && shop.enabled), 'ギルドの灯 /api/shop/config', shop ? (shop.enabled ? `${shop.products.length}品` : `未設定: ${shop.missing.join(', ')}`) : '応答なし');
const mayor = parse((await get('/mayor/pay/api/catalog')).text);
row(!!(mayor && mayor.mode === 'live'), '村長 /mayor/pay/api/catalog', mayor ? `mode=${mayor.mode}` : '応答なし（未デプロイ）');
for (const p of ['/legal/tokushoho.html', '/legal/shikin.html', '/legal/terms.html', '/legal/privacy.html']) {
  const r = await get(p);
  row(r.status === 200, p, String(r.status));
}
const mp = await get('/mayor/');
row(mp.status === 200 && /<meta name="chief-payment-api" content="[^"]+">/.test(mp.text), '/mayor/ の決済API設定');
console.log(`${base}\n` + rows.join('\n'));
process.exitCode = rows.some((r) => r.startsWith('NG')) ? 1 : 0;
