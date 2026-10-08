// 課金：魔晶石と特別なパックを、Stripe の決済ページで買う
//   値段と中身はサーバー（/api/shop）が正本。ゲームは品の id とセーブの id を送るだけ。
//   決済が済むと /?paid=<セッション> に戻ってくるので、サーバーで支払いを確かめてから受け取る。
//   ・有償の魔晶石は無償と分けて数える（使うときは無償から）
//   ・年齢に応じた月の上限（15歳以下 5,000円・16〜19歳 10,000円）
//   ・同じ支払いは、1つのセーブで1回だけ受け取る
(function () {
  const P = (G.pay = {});
  const LIMIT = { u16: 5000, u20: 10000, adult: Infinity };
  const AGE_NAME = { u16: '15歳以下', u20: '16〜19歳', adult: '20歳以上' };
  const WEB = /(^|\.)music-japan\.com$|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  const SITE = 'https://game.music-japan.com/';
  const PEND = 'guild-pay-pending';
  let cfg = null, cfgAt = 0, loading = null;

  function data() {
    const st = G.state;
    st.pay = st.pay || {};
    const p = st.pay;
    p.sid = p.sid || 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    p.hist = p.hist || [];
    p.done = p.done || [];
    p.once = p.once || {};
    p.run = p.run || {};
    p.perm = p.perm || {};
    p.pass = p.pass || { until: 0, last: '' };
    const ym = new Date().toISOString().slice(0, 7);
    if (!p.month || p.month.ym !== ym) p.month = { ym, yen: 0 };
    return p;
  }
  P.data = data;
  P.web = WEB;
  P.ready = () => !!(cfg && cfg.enabled);
  P.products = () => (cfg ? cfg.products : []);
  P.product = (id) => P.products().find((x) => x.id === id) || null;
  P.perm = (id) => !!(G.state && G.state.pay && G.state.pay.perm && G.state.pay.perm[id]);
  P.passActive = () => !!(G.state && G.state.pay && G.state.pay.pass && G.state.pay.pass.until > G.now());
  P.passDays = () => (P.passActive() ? Math.ceil((G.state.pay.pass.until - G.now()) / 86400) : 0);
  // 買えるかどうか（1回だけの品など）
  P.available = function (p) {
    const d = data();
    if (p.kind === 'once' || p.kind === 'perm') return !d.once[p.id] && !d.perm[p.id];
    if (p.kind === 'run') return !d.run[G.sim.run().n];
    if (p.kind === 'pass') return P.passDays() <= 30;
    return true;
  };

  // ---------------------------------------------------------------- 売り場の情報
  P.load = function (force) {
    if (!WEB) return Promise.resolve(null);
    if (cfg && !force && Date.now() - cfgAt < 5 * 60e3) return Promise.resolve(cfg);
    if (loading) return loading;
    if (!cfg && !force && Date.now() - cfgAt < 60e3) return Promise.resolve(null); // 失敗直後は1分待つ
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 6000);
    loading = fetch('/api/shop/config', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { cfg = j && Array.isArray(j.products) ? j : null; cfgAt = Date.now(); return cfg; })
      .catch(() => null)
      .finally(() => { clearTimeout(tm); loading = null; });
    return loading;
  };

  // ---------------------------------------------------------------- 買う
  P.buy = function (id) {
    G.audio.init();
    if (!WEB) {
      G.ui.modal(`<div class="confirm"><h2>ブラウザ版で購入できます</h2><p>魔晶石やパックの購入は、ブラウザ版のギルドの灯（game.music-japan.com）で受け付けています。</p><p class="hint">いまのセーブは「記録と設定 → セーブを書き出す」で控えをとり、ブラウザ版で読み込むと引っ越せます。</p></div>`, [
        { text: '戻る', cls: 'ghost' },
        { text: 'ブラウザ版を開く', cls: 'primary', fn: () => window.open(SITE, '_blank', 'noopener') },
      ]);
      return;
    }
    if (!cfg) { P.load(true).then((c) => { if (c && c.enabled) P.buy(id); else G.ui.toast('ただいま購入の準備中です。もうしばらくお待ちください', 'info'); }); return; }
    if (!P.ready()) { G.ui.toast('ただいま購入の準備中です。もうしばらくお待ちください', 'info'); return; }
    const p = P.product(id);
    if (!p) return;
    if (!P.available(p)) { G.ui.toast('この品はもう買えません', 'info'); return; }
    const d = data();
    if (!d.age) { askAge(() => P.buy(id)); return; }
    const lim = LIMIT[d.age];
    if (d.month.yen + p.price > lim) {
      G.ui.modal(`<div class="confirm"><h2>今月の購入の上限です</h2><p>${AGE_NAME[d.age]}の方は、1か月に ${G.fmt(lim)}円 までご購入いただけます。<br>今月はあと ${G.fmt(Math.max(0, lim - d.month.yen))}円 です。</p></div>`, [{ text: '戻る', cls: 'primary' }]);
      return;
    }
    confirmBuy(p);
  };
  function grantText(g) {
    return Object.entries(g).map(([k, n]) => (k === 'cry' ? `魔晶石 ×${G.fmt(n)}` : `${G.items.CONS[k] ? G.items.CONS[k].name : k} ×${n}`)).join('・');
  }
  P.grantText = grantText;
  function confirmBuy(p) {
    const d = data();
    const minor = d.age !== 'adult';
    G.ui.modal(`<div class="pay-confirm"><small>ご購入の確認</small><h2>${G.esc(p.name)}</h2><p class="pc-price">¥${G.fmt(p.price)}<small>（税込）</small></p>
      <div class="pc-box"><b>受け取れるもの</b><p>${G.esc(p.desc)}</p>${p.kind === 'cry' ? '' : `<p class="pc-items">${grantText(p.grant)}${p.daily ? ` ／ 毎日：${grantText(p.daily)}（${p.days}日間）` : ''}</p>`}</div>
      ${minor ? '<p class="pc-warn">未成年の方は、保護者の方の同意を得てからご購入ください。</p>' : ''}
      <ul class="pc-notes"><li>お支払いは Stripe の安全な決済ページ（カード・Apple Pay・Google Pay）で行います。</li><li>購入した魔晶石は「有償の魔晶石」として、このゲームの中だけで使えます。有効期限はありません。</li><li>デジタルの品のため、購入後の返品・返金はお受けできません（法令で認められる場合を除きます）。</li><li>セーブはこの端末のブラウザに保存されます。機種変更の前には「セーブを書き出す」で控えをとってください。</li></ul>
      <p class="pc-legal"><a href="legal/tokushoho.html" target="_blank" rel="noopener">特定商取引法に基づく表記</a><a href="legal/shikin.html" target="_blank" rel="noopener">資金決済法に基づく表示</a><a href="legal/terms.html" target="_blank" rel="noopener">利用規約</a></p></div>`, [
      { text: '戻る', cls: 'ghost' },
      { text: `購入へ進む（¥${G.fmt(p.price)}）`, cls: 'primary', fn: () => checkout(p) },
    ], { cls: 'wide' });
  }
  function askAge(next) {
    G.ui.modal(`<div class="confirm"><h2>年齢を教えてください</h2><p>はじめてのご購入の前に、年齢をお選びください。年齢に応じて、1か月にご購入いただける金額の上限が決まります。</p><ul class="pc-notes"><li>15歳以下：1か月 5,000円まで</li><li>16〜19歳：1か月 10,000円まで</li><li>20歳以上：上限なし</li></ul></div>`, [
      { text: '15歳以下', cls: 'ghost', fn: () => setAge('u16', next) },
      { text: '16〜19歳', cls: 'ghost', fn: () => setAge('u20', next) },
      { text: '20歳以上', cls: 'ghost', fn: () => setAge('adult', next) },
      { text: '戻る', cls: 'primary back' },
    ], { cls: 'bulk-pick' });
  }
  function setAge(a, next) {
    const d = data();
    d.age = a;
    d.ageAt = G.now();
    G.sim.save(true);
    setTimeout(next, 260);
  }
  async function checkout(p) {
    const d = data();
    G.ui.toast('決済ページを開いています…', 'info', 'pay');
    // 戻ってきたときのために、先にしっかり保存
    G.sim.save(true);
    try { if (G.save.saveNow) await G.save.saveNow(G.sim.serialize()); } catch (e) { /* noop */ }
    try {
      const r = await fetch('/api/shop/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, save: d.sid }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || 'checkout');
      try { localStorage.setItem(PEND, JSON.stringify({ id: j.id, product: p.id, at: Date.now() })); } catch (e) { /* noop */ }
      G.resetting = false;
      location.href = j.url;
    } catch (e) {
      G.audio.sfx('error');
      G.ui.toast('決済ページを開けませんでした。少し時間をおいてもう一度お試しください', 'bad');
    }
  }

  // ---------------------------------------------------------------- 決済から戻ってきたとき
  P.afterBoot = function () {
    if (!WEB) return;
    data();
    P.load();
    const q = new URLSearchParams(location.search);
    const paid = q.get('paid');
    if (paid) {
      q.delete('paid');
      const rest = q.toString();
      try { history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch (e) { /* noop */ }
    }
    if (paid === 'cancel') { setTimeout(() => G.ui.toast('購入をキャンセルしました', 'info'), 1600); clearPending(); }
    else if (paid && /^cs_/.test(paid)) claim(paid);
    else {
      // 戻る前に閉じてしまったとき：しばらくのあいだ、受け取りを試す
      let pend = null;
      try { pend = JSON.parse(localStorage.getItem(PEND) || 'null'); } catch (e) { /* noop */ }
      if (pend && pend.id && Date.now() - pend.at < 3 * 86400e3) claim(pend.id, true);
    }
    setTimeout(P.daily, 2400);
  };
  function clearPending() { try { localStorage.removeItem(PEND); } catch (e) { /* noop */ } }
  async function claim(session, quiet) {
    const d = data();
    if (d.done.includes(session)) { clearPending(); return; }
    try {
      const r = await fetch('/api/shop/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session, save: d.sid }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 402) { if (!quiet) G.ui.toast('お支払いの確認がまだです。少し時間をおいて開き直してください', 'info'); return; }
      if (!r.ok || !j.ok) { if (!quiet) G.ui.toast('購入の受け取りに失敗しました。開き直すと、もう一度受け取りを試します', 'bad'); if (r.status === 409) clearPending(); return; }
      if (d.done.includes(session)) return;
      grant(j.product, session, j.amount);
      clearPending();
    } catch (e) {
      if (!quiet) G.ui.toast('通信できませんでした。開き直すと、もう一度受け取りを試します', 'bad');
    }
  }
  function grant(p, session, amount) {
    const st = G.state, d = data();
    d.done.push(session);
    d.hist.push({ id: p.id, name: p.name, price: amount != null ? amount : p.price, at: G.now(), session });
    d.month.yen += amount != null ? amount : p.price;
    give(p.grant);
    if (p.kind === 'once') d.once[p.id] = 1;
    if (p.kind === 'perm') { d.perm[p.id] = 1; d.once[p.id] = 1; }
    if (p.kind === 'run') d.run[G.sim.run().n] = 1;
    if (p.kind === 'pass') {
      const now = G.now();
      d.pass.until = Math.max(now, d.pass.until || 0) + (p.days || 30) * 86400;
      d.pass.daily = p.daily;
      d.pass.last = '';
    }
    st.stats.purchases = (st.stats.purchases || 0) + 1;
    G.sim.save(true);
    G.ui.refreshHud();
    G.audio.sfx('rarity', 4);
    G.ui.whenFree(() => G.ui.modal(`<div class="skill-get pay-thanks"><div class="pt-gem"></div><small>ご購入ありがとうございます</small><h2>${G.esc(p.name)}</h2><p class="pc-items">${grantText(p.grant)}</p>${p.kind === 'pass' ? `<p class="hint">これから${p.days}日間、毎日ギルドに顔を出すと ${grantText(p.daily)} が届きます</p>` : ''}${p.id === 'starbook' ? '<p class="hint">これからは、再建で手に入る灯火の星が +20% になります</p>' : ''}</div>`, [{ text: '受け取る', cls: 'primary big', fn: () => P.daily() }], { cls: 'celebrate', onShow: () => G.ui.fx.confetti() }), 900);
  }
  function give(g) {
    Object.entries(g || {}).forEach(([k, n]) => { if (k === 'cry') G.items.addPaidCry(n); else G.items.addCons(k, n); });
    G.emit('itemsChanged');
  }
  // 定期便：その日の分（1日1回、ゲームを開いたときに）
  P.daily = function () {
    if (!G.state || !G.state.pay || !P.passActive()) return;
    const d = data();
    const today = G.treasury.today();
    if (d.pass.last === today) return;
    d.pass.last = today;
    const g = d.pass.daily || { cry: 40, auto30: 1 };
    give(g);
    G.sim.save();
    G.ui.refreshHud();
    G.audio.sfx('gift');
    G.ui.toast(`灯火の定期便が届きました：${grantText(g)}（のこり${P.passDays()}日）`, 'rare3', 'pass');
  };
  let dayAcc = 0;
  P.tick = function (dt) { dayAcc += dt; if (dayAcc > 60) { dayAcc = 0; P.daily(); } };

  // ---------------------------------------------------------------- 購入履歴
  P.history = function () {
    const d = data();
    const rows = d.hist.slice().reverse().map((h) => `<li><span>${new Date(h.at * 1000).toLocaleDateString('ja-JP')}</span><b>${G.esc(h.name)}</b><em>¥${G.fmt(h.price)}</em></li>`).join('') || '<li class="none">まだ購入はありません</li>';
    G.ui.modal(`<div class="pay-hist"><h2>購入履歴</h2><p class="sub">今月 ¥${G.fmt(d.month.yen)}${d.age ? ` ・ ${AGE_NAME[d.age]}${isFinite(LIMIT[d.age]) ? `（上限 ¥${G.fmt(LIMIT[d.age])}）` : ''}` : ''} ・ 有償の魔晶石 ${G.fmt(G.items.cryPaid())}</p><ul>${rows}</ul><p class="hint">お問い合わせのときは、購入日と品名をお知らせください</p></div>`, [{ text: '閉じる', cls: 'primary' }], { cls: 'wide' });
  };
})();
