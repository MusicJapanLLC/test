/* ギルドの灯 — events: 日付で決まる期間限定イベント（サーバー不要）
 *  端末の日付で開催中のイベントを決める。全員が同じ暦なので、みんな同じ時期に同じお祭り。
 *  - かぼちゃ灯籠祭（10月）：かぼちゃ飴を集めて限定の装飾品と交換。ギルドが飾られ、かぼちゃおばけが出る
 *  - そのほかの季節：小さなボーナスとお知らせ
 *  - 週末：ゴールド +20%
 */
'use strict';
(function () {
  const E = (G.events = {});
  E.CAL = [
    { id: 'newyear', name: '新春の灯', from: [1, 1], to: [1, 7], desc: 'ログインボーナスの魔晶石が2倍', bonus: { loginCry: 2 } },
    { id: 'sakura', name: '花灯りの宴', from: [4, 1], to: [4, 14], desc: '依頼のゴールド +20%', bonus: { gold: 0.2 } },
    { id: 'summer', name: '潮風の夏祭り', from: [7, 20], to: [8, 20], desc: '素材 +30%', bonus: { mat: 0.3 } },
    { id: 'halloween', name: 'かぼちゃ灯籠祭', from: [10, 1], to: [10, 31], desc: 'かぼちゃ飴を集めて、限定の装飾品と交換しよう', theme: 'pumpkin', currency: 'candy', bonus: {} },
    { id: 'meteor', name: '流星の夜', from: [11, 10], to: [11, 20], desc: '伝説級が出やすい', bonus: { legend: 0.01 } },
    { id: 'winter', name: '星降る冬至祭', from: [12, 18], to: [12, 31], desc: '経験値 +30%', bonus: { exp: 0.3 } },
  ];
  const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
  const now = () => new Date(G.now() * 1000);
  E.active = function () {
    const d = now();
    const k = md(d);
    return E.CAL.find((e) => k >= e.from[0] * 100 + e.from[1] && k <= e.to[0] * 100 + e.to[1]) || null;
  };
  E.endsAt = function (ev) {
    const d = now();
    return new Date(d.getFullYear(), ev.to[0] - 1, ev.to[1] + 1).getTime() / 1000;
  };
  E.weekend = () => { const w = now().getDay(); return w === 0 || w === 6; };
  E.bonus = function (k) {
    const ev = E.active();
    let v = ev && ev.bonus[k] ? ev.bonus[k] : 0;
    if (k === 'gold' && E.weekend()) v += 0.2;
    return v;
  };
  E.theme = () => { const ev = E.active(); return ev && ev.theme ? ev.theme : null; };
  // その年のイベント記録（限定交換の回数など）
  E.state = function () {
    const st = G.state;
    const ev = E.active();
    if (!ev) return null;
    const key = ev.id + ':' + now().getFullYear();
    st.event = st.event && st.event.key === key ? st.event : { key, got: 0, bought: {} };
    return st.event;
  };
  // 依頼の成功で手に入るかぼちゃ飴
  E.dropFor = function (tier, areaIdx, rnd = Math.random) {
    const ev = E.active();
    if (!ev || !ev.currency || tier === 'fail') return 0;
    const base = { ok: 1, great: 3, legend: 8 }[tier] || 0;
    return base + Math.floor(rnd() * (2 + (areaIdx || 0) * 0.6));
  };

  // 交換所
  E.SHOP = [
    { id: 'jack4', name: '灯籠祭の大王冠（UR・限定）', cost: 300, max: 1, give: { equip: 'jack', rarity: 4 } },
    { id: 'jack3', name: '月夜のジャック（SSR・限定）', cost: 120, max: 2, give: { equip: 'jack', rarity: 3 } },
    { id: 'book', name: '閃きの書', cost: 80, max: 1, give: { cons: 'book', n: 1 } },
    { id: 'hg3', name: '神速の砂時計', cost: 60, max: 2, give: { cons: 'hg3', n: 1 } },
    { id: 'key', name: '宝箱の鍵', cost: 30, max: 5, give: { cons: 'key', n: 1 } },
    { id: 'cry', name: '魔晶石 ×50', cost: 40, max: 5, give: { cons: 'cry', n: 50 } },
    { id: 'stone', name: '強化石 ×15', cost: 15, max: 10, give: { cons: 'stone', n: 15 } },
  ];
  E.buy = function (id) {
    const es = E.state();
    const it = E.SHOP.find((x) => x.id === id);
    if (!es || !it) return { ok: false, why: 'none' };
    if ((es.bought[id] || 0) >= it.max) return { ok: false, why: 'max' };
    if (G.items.cons('candy') < it.cost) return { ok: false, why: 'candy' };
    G.items.addCons('candy', -it.cost);
    es.bought[id] = (es.bought[id] || 0) + 1;
    let item = null;
    if (it.give.equip) {
      item = G.items.make(Math.random, it.give.rarity, { noRelic: true, tid: it.give.equip, ilv: Math.max(40, G.items.ilvFor(Math.random, G.items.maxArea()) + 10) });
      G.items.add(item);
    } else G.items.addCons(it.give.cons, it.give.n);
    G.emit('itemsChanged');
    return { ok: true, item, it };
  };

  // HUD の小さなお祭りの札
  E.renderChip = function () {
    const el = G.$('#eventChip');
    if (!el) return;
    const ev = E.active();
    const wk = E.weekend();
    if (!ev && !wk) { el.hidden = true; return; }
    el.hidden = false;
    const left = ev ? Math.max(0, Math.ceil((E.endsAt(ev) - G.now()) / 86400)) : 0;
    const key = (ev ? ev.id + left : '') + (wk ? 'w' : '') + (ev && ev.currency ? G.items.cons('candy') : '');
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    el.className = 'ev-chip ' + (ev ? ev.id : 'weekend');
    el.innerHTML = ev ? `<i class="ev-ic"></i><b>${ev.name}</b><small>あと${left}日${wk ? '・週末G+20%' : ''}</small>${ev.currency ? `<span class="ev-cur"><img alt="" src="${G.ui.itemThumb({ kind: 'cons', id: 'candy', rarity: 3, name: '' }, 18)}">${G.items.cons('candy')}</span>` : ''}` : '<i class="ev-ic"></i><b>週末の大入り</b><small>ゴールド +20%</small>';
  };
  E.open = function () {
    const ev = E.active();
    G.audio.init();
    G.audio.sfx('open');
    if (!ev) { G.ui.toast('週末は依頼のゴールド +20%！', 'good'); return; }
    const es = E.state();
    const left = Math.max(0, Math.ceil((E.endsAt(ev) - G.now()) / 86400));
    const shop = ev.currency ? `<div class="ev-shop">${E.SHOP.map((x) => {
      const n = es.bought[x.id] || 0;
      const soldout = n >= x.max;
      const thumb = x.give.equip ? G.ui.itemThumb({ kind: 'equip', tid: x.give.equip, rarity: x.give.rarity }, 40) : G.ui.itemThumb({ kind: 'cons', id: x.give.cons, rarity: 2, name: '' }, 40);
      return `<div class="card ev-item ${soldout ? 'got' : ''}"><img alt="" src="${thumb}"><div class="grow"><b>${x.name}</b><small>のこり ${x.max - n}/${x.max}</small></div>${soldout ? '<span class="stamp">交換済</span>' : `<button class="btn sm ${G.items.cons('candy') >= x.cost ? 'go' : 'cant'}" data-evbuy="${x.id}"><img alt="" src="${G.ui.itemThumb({ kind: 'cons', id: 'candy', rarity: 3, name: '' }, 16)}"><span>${x.cost}</span></button>`}</div>`;
    }).join('')}</div>` : '';
    const html = `<div class="event-panel ${ev.id}"><div class="ev-hero"><img class="rina-face" alt="" src="${G.art.rina(144, 'wink')}"></div><small>期間限定イベント ・ あと${left}日</small><h2>${ev.name}</h2><p>${ev.desc}</p>
      ${ev.currency ? `<p class="ev-have">手持ちの かぼちゃ飴 <b>${G.items.cons('candy')}</b> 個 <small>（依頼の成功・大成功で手に入る。かぼちゃおばけからは多め）</small></p>` : ''}${shop}</div>`;
    G.ui.modal(html, [{ text: '閉じる', cls: 'primary' }], {
      cls: 'wide',
      onShow: (card) => G.$$('[data-evbuy]', card).forEach((b) => b.addEventListener('click', () => {
        const r = E.buy(b.dataset.evbuy);
        if (!r.ok) { G.audio.sfx('error'); G.ui.toast(r.why === 'candy' ? 'かぼちゃ飴が足りません' : '交換できません', 'bad'); return; }
        G.audio.sfx(r.item ? 'rarity' : 'coins', r.item ? r.item.rarity : 0);
        if (r.item) G.ui.fx.confetti();
        G.ui.toast(r.item ? `限定の《${r.item.name}》を手に入れた！ 宝物庫へ` : `${r.it.name} と交換しました`, r.item ? 'rare' + r.item.rarity : 'good');
        G.sim.save();
        G.ui.refreshHud();
        G.ui.closeModal();
        setTimeout(E.open, 260);
      })),
    });
  };
})();
