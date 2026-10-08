// Stripe の API を、ライブラリなしで呼ぶ（Node の fetch）
const BASE = 'https://api.stripe.com/v1';
function form(obj, prefix, out = []) {
  Object.entries(obj).forEach(([k, v]) => {
    if (v == null) return;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  });
  return out.join('&');
}
async function call(method, path, body, idem) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  const headers = { Authorization: `Bearer ${key}` };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch(BASE + path, { method, headers, body: body ? form(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || 'stripe_error'), { code: (j.error && j.error.code) || 'stripe_error', status: r.status });
  return j;
}
module.exports = { call, form };
