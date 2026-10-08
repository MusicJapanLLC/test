// 返金・異議申し立てのあった支払いか（payment_intent に latest_charge を展開して渡す）
exports.refused = function (pi) {
  if (!pi) return false;
  if (pi.status && pi.status !== 'succeeded') return true;
  const ch = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  if (!ch) return false;
  return !!(ch.refunded || ch.amount_refunded > 0 || ch.disputed);
};
