/* ギルドの灯 — treasury: 宝物庫（宝箱・装備・持ち物・ショップ）とログインボーナス
 *  - 宝箱：黄金の宝箱（魔晶石・無料・鍵）。10連は SR 以上が1つ確定。30回以内に SSR 以上
 *  - 装備：絞り込み・並べ替え・おまかせ装備・まとめて分解・強化・鍵
 *  - 持ち物：砂時計（倍速）・時短の巻物・黄金の祝福・四つ葉・鍵・閃きの書・経験の書
 *  - ショップ：魔晶石やゴールドで持ち物を買う。魔晶石の販売はアプリ版で（いまは購入できない）
 */
'use strict';
(function () {
  const T = (G.treasury = {});
  const IT = G.items;
  const art = G.art;
  const D = G.D;

  const CRY = '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 16,6 13,19 7,19 4,6" fill="#6f7cf0"/><polygon points="10,1 16,6 10,8" fill="#b9c2ff"/><polygon points="10,1 4,6 10,8" fill="#dfe4ff"/><polygon points="4,6 10,8 7,19" fill="#5a66d8"/><polygon points="16,6 10,8 13,19" fill="#4a52b8"/><polygon points="10,8 13,19 7,19" fill="#7f8cff"/></svg>';
  const LOCK = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="1.5" fill="currentColor"/><path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  T.CRY = CRY;
  const thumb = (it, s) => G.ui.itemThumb(it, s);
  const consThumb = (id, s) => G.ui.itemThumb({ kind: 'cons', id, rarity: IT.CONS[id] ? IT.CONS[id].rarity : 2, name: id }, s);
  const stars = (r) => '★'.repeat(r + 1);
  const pct = (v) => '+' + IT.fmtV(v) + '%';
  let tab = 'chest';
  let gearSlot = 'all', gearSort = 'rarity';

  T.sig = function () {
    const st = G.state;
    return [tab, gearSlot, gearSort, (st.items || []).length, st.crystals || 0, IT.canFree() ? 1 : 0, Object.keys(st.relics || {}).length, st.adv.map((a) => JSON.stringify(a.eq || {})).join(), st.pity || 0, JSON.stringify(st.bag || {}), Object.keys(st.boosts || {}).filter((k) => IT.boost(k)).join()].join('|');
  };
  T.hasNews = () => IT.canFree() || (G.state.itemsNew || 0) > 0;
  T.open = function (t) { tab = t || tab; G.ui.openSheet('treasury'); };

  // ---------------------------------------------------------------- シート
  T.render = function (body) {
    const st = G.state;
    st.itemsNew = 0;
    const tabs = [['chest', '宝箱'], ['gear', '装備'], ['bag', '持ち物'], ['shop', 'ショップ']];
    let h = `<div class="seg">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-ttab="${k}">${n}${k === 'chest' && IT.canFree() ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>`;
    h += boostBar();
    if (tab === 'chest') h += chestTab();
    else if (tab === 'gear') h += gearTab();
    else if (tab === 'bag') h += bagTab();
    else h += shopTab();
    body.innerHTML = h;
    G.$$('[data-ttab]', body).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.ttab; G.audio.sfx('soft'); G.ui.renderSheet(); body.scrollTop = 0; }));
    bind(body);
  };

  function boostBar() {
    const act = ['speed', 'gold', 'luck', 'feast'].map((k) => [k, IT.boost(k)]).filter((x) => x[1]);
    if (!act.length) return '';
    return `<div class="boosts">${act.map(([k, b]) => `<span class="boost ${k}">${k === 'speed' ? `${b.mult}倍速` : k === 'gold' ? 'ゴールド×2' : k === 'feast' ? '宴 名声+25%' : '大成功+10%'}<b data-countdown="${b.until}">${G.fmtClock(b.until - G.now())}</b></span>`).join('')}</div>`;
  }

  // ---- 宝箱
  function chestTab() {
    const st = G.state;
    const now = G.now();
    const free = IT.canFree();
    const freeAt = (st.freeChestAt || 0) + IT.FREE_INTERVAL;
    const pityLeft = Math.max(1, IT.PITY - (st.pity || 0));
    const cry = st.crystals || 0;
    const keys = IT.cons('key');
    let h = `<div class="tr-gacha">
      <div class="tr-top"><span class="tr-cry">${CRY}<b>${G.fmt(cry)}</b><small>魔晶石</small></span><button class="link" id="trRates">提供割合</button></div>
      <div class="tr-stage"><img alt="" src="${chestImg(3, 132)}"></div>
      <h3>黄金の宝箱</h3>
      <p>装備品・秘宝・持ち物が出る。あと <b>${pityLeft}回</b> で SSR 以上が必ず出る</p>
      <div class="tr-btns">
        <button class="btn ${free ? 'go pulse' : 'ghost'}" id="trFree" ${free ? '' : 'disabled'}>${free ? '無料で開ける' : `無料まで<span data-countdown="${freeAt}">${G.fmtClock(freeAt - now)}</span>`}</button>
        <button class="btn primary ${cry < IT.CHEST_COST ? 'cant' : ''}" id="trOne">1回<span>${CRY}${IT.CHEST_COST}</span></button>
        <button class="btn primary ${cry < IT.CHEST10_COST ? 'cant' : ''}" id="trTen">10連<span>${CRY}${IT.CHEST10_COST}</span></button>
      </div>
      ${keys ? `<button class="btn wide key-btn" id="trKey">宝箱の鍵で開ける<span>のこり ${keys}本</span></button>` : ''}
      <small class="tr-how">10連は SR 以上が1つ確定 ・ 魔晶石は大成功の冒険譚、ランクアップ、目標、ログインボーナスで手に入ります</small>
    </div>`;
    const owned = IT.RELICS.filter((r) => st.relics && st.relics[r.id]);
    h += `<div class="sec"><h3>秘宝 <small>${owned.length}/${IT.RELICS.length}</small><span class="h-right">ギルド全体に効く</span></h3><div class="relics">`;
    IT.RELICS.forEach((r) => {
      const own = st.relics && st.relics[r.id];
      const it = { kind: 'relic', rid: r.id, rarity: r.r, name: r.name };
      h += `<div class="relic ${own ? 'own' : 'unknown'} r${r.r}"><img alt="" src="${thumb(it, 48)}"><span><b>${own ? r.name : '？？？'}</b><small>${own ? r.desc : IT.RARITY[r.r].id + ' ・ どこかの宝箱に'}</small></span></div>`;
    });
    h += `</div></div>`;
    return h;
  }

  // ---- 装備
  function gearTab() {
    const st = G.state;
    let items = (st.items || []).slice();
    if (gearSlot !== 'all') items = items.filter((x) => x.slot === gearSlot);
    const by = { rarity: (a, b) => b.rarity - a.rarity || b.ilv - a.ilv, level: (a, b) => b.ilv - a.ilv || b.rarity - a.rarity, plus: (a, b) => (b.plus || 0) - (a.plus || 0) || b.rarity - a.rarity, new: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.rarity - a.rarity };
    items.sort(by[gearSort]);
    const dex = Object.keys(st.dex || {}).length;
    let h = `<div class="gear-tools">
      <div class="chips">${[['all', 'すべて'], ['weapon', '武器'], ['armor', '防具'], ['acc', '装飾品']].map(([k, n]) => `<button class="chip ${gearSlot === k ? 'on' : ''}" data-gslot="${k}">${n}</button>`).join('')}</div>
      <label class="sort"><span class="sr-only">並べ替え</span><select id="gearSort">${[['rarity', 'レア度順'], ['level', 'Lv順'], ['plus', '強化値順'], ['new', '新しい順']].map(([k, n]) => `<option value="${k}" ${gearSort === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="gear-actions"><button class="btn sm primary" id="gAuto">おまかせ装備</button><button class="btn sm go" id="gEnh">まとめて強化</button><button class="btn sm ghost" id="gBulk">まとめて分解</button><span class="stone-count">${consIcon('stone')}<b>${G.fmt(IT.cons('stone'))}</b></span></div>
    <label class="auto auto-enh ${st.settings.autoEnh ? 'on' : ''}"><span><b>自動で強化</b><small>1分ごとに、余ったゴールドの2割までで装備中の品を強化（施設の費用は残します）</small></span><input type="checkbox" id="autoEnh" ${st.settings.autoEnh ? 'checked' : ''}><i class="sw"></i></label>`;
    h += `<div class="sec"><h3>装備品 <small>${(st.items || []).length}/150</small><span class="h-right">図鑑 ${dex}/${IT.EQUIP_IDS.length * 5}</span></h3>`;
    if (!items.length) h += `<p class="empty">${gearSlot === 'all' ? 'まだ装備品がありません。冒険譚の宝箱や宝物庫の黄金の宝箱で手に入ります。' : 'この種類の装備はまだありません。'}</p>`;
    else {
      h += `<div class="gear">`;
      items.forEach((it) => {
        const who = IT.equippedBy(it.uid);
        h += `<button class="gi r${it.rarity}" data-item="${it.uid}" aria-label="${G.esc(it.name)}"><img alt="" src="${thumb(it, 60)}">${it.plus ? `<i class="gi-plus">+${it.plus}</i>` : ''}${it.lb ? `<i class="gi-lb">${'★'.repeat(it.lb)}</i>` : ''}<i class="gi-lv">Lv${it.ilv}</i>${who ? `<img class="gi-who" alt="" src="${art.portrait(who.look, 22)}">` : ''}${it.lock ? `<i class="gi-lock">${LOCK}</i>` : ''}${it.isNew ? '<i class="gi-new"></i>' : ''}<small>${G.esc(it.name)}</small></button>`;
      });
      h += `</div>`;
    }
    h += `</div>`;
    return h;
  }

  // ---- 持ち物
  function bagTab() {
    let h = '<div class="sec bag">';
    const any = IT.CONS_ORDER.some((id) => IT.cons(id) > 0);
    if (!any) h += '<p class="empty">持ち物はありません。冒険譚のおまけ、宝箱、ショップ、ログインボーナスで手に入ります。</p>';
    IT.CONS_ORDER.forEach((id) => {
      const n = IT.cons(id);
      if (!n) return;
      const c = IT.CONS[id];
      const usable = id !== 'stone';
      h += `<div class="card cons r${c.rarity}"><img alt="" src="${consThumb(id, 48)}"><div class="grow"><b>${c.name} <em>×${n}</em></b><small>${c.desc}</small></div>${usable ? `<button class="btn sm ${c.boost ? 'primary' : ''}" data-use="${id}">${id === 'key' ? '開ける' : '使う'}</button>` : ''}</div>`;
    });
    h += '</div>';
    return h;
  }

  // ---- ショップ（魔晶石だけで買う。品ごとに1日・1週の上限）
  const SHOP = [
    { id: 'auto30', n: 1, cost: 30, per: 'day', max: 4 },
    { id: 'auto180', n: 1, cost: 120, per: 'day', max: 1 },
    { id: 'hg2', n: 1, cost: 80, per: 'day', max: 3 },
    { id: 'hg3', n: 1, cost: 200, per: 'day', max: 1 },
    { id: 'horn', n: 1, cost: 150, per: 'week', max: 2 },
    { id: 'finish', n: 1, cost: 40, per: 'day', max: 5 },
    { id: 'goldx2', n: 1, cost: 60, per: 'day', max: 2 },
    { id: 'luck', n: 1, cost: 60, per: 'day', max: 2 },
    { id: 'stone', n: 10, cost: 50, per: 'day', max: 5 },
    { id: 'expbook', n: 3, cost: 60, per: 'day', max: 3 },
    { id: 'book', n: 1, cost: 300, per: 'week', max: 1 },
    { id: 'shard', n: 1, cost: 250, per: 'week', max: 2 },
  ];
  const BUNDLES = [
    { key: 'b_start', name: 'はじめての冒険パック', desc: '神速の砂時計・帰還の角笛・閃きの書', items: [['hg3', 1], ['horn', 1], ['book', 1]], cost: 300, per: 'once', max: 1, icon: 'book', tag: '1回だけ' },
    { key: 'b_week', name: '冒険者応援パック', desc: '疾風の砂時計×2・時短の巻物×3・おまかせ札（3時間）×1・強化石×20', items: [['hg2', 2], ['finish', 3], ['auto180', 1], ['stone', 20]], cost: 250, per: 'week', max: 1, icon: 'hg2', tag: '毎週' },
  ];
  const EX_COST = [20, 40, 80];
  T.exGold = () => Math.round((600 * Math.pow(1.95, G.state.rank - 1)) / 100) * 100;
  T.week = () => { const d = new Date(G.now() * 1000); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 3) / 7); };
  function shopState() {
    const st = G.state;
    const today = T.today(), wk = T.week();
    st.shop = st.shop || { day: today, week: wk, d: {}, w: {}, once: {} };
    if (st.shop.day !== today) { st.shop.day = today; st.shop.d = {}; }
    if (st.shop.week !== wk) { st.shop.week = wk; st.shop.w = {}; }
    st.shop.once = st.shop.once || {};
    return st.shop;
  }
  const bought = (key, per) => { const sh = shopState(); return (per === 'day' ? sh.d : per === 'week' ? sh.w : sh.once)[key] || 0; };
  const addBought = (key, per) => { const sh = shopState(); const m = per === 'day' ? sh.d : per === 'week' ? sh.w : sh.once; m[key] = (m[key] || 0) + 1; };
  const perName = { day: '今日', week: '今週', once: '' };
  T.PACKS = [{ id: 'cry_60', n: 60, label: '魔晶石 60' }, { id: 'cry_330', n: 330, label: '魔晶石 330', bonus: '+10%' }, { id: 'cry_1100', n: 1100, label: '魔晶石 1100', bonus: '+25%' }];
  // ---- ゴールドの市：行商人ペトラの荷車。6品はどれも1つずつ、3時間ごとに入れ替わる
  const GS_ROT = 3 * 3600;
  const MERCHANT = { cls: 'thief', role: 'npc', seed: 41, skin: '#f0c49a', hair: '#7a3a22', style: 'long', outfit: '#3f7a5a', vest: '#c8a060', pants: '#4a3a2a', blush: true };
  T.gBase = () => Math.round((600 * Math.pow(1.95, G.state.rank - 1)) / 10) * 10;
  T.gshopRot = () => Math.floor(G.now() / GS_ROT);
  const GS_POOL = [
    { id: 'stone', n: 10, k: 0.5 }, { id: 'stone', n: 30, k: 1.3 }, { id: 'expbook', n: 2, k: 0.8 }, { id: 'finish', n: 2, k: 0.6 },
    { id: 'auto30', n: 1, k: 0.5 }, { id: 'auto180', n: 1, k: 2 }, { id: 'hg2', n: 1, k: 1.2 }, { id: 'goldx2', n: 1, k: 1 }, { id: 'luck', n: 1, k: 1 },
    { id: 'key', n: 1, k: 2.5, w: 0.6 }, { id: 'hg3', n: 1, k: 3, w: 0.4 }, { id: 'horn', n: 1, k: 2.5, w: 0.4 }, { id: 'book', n: 1, k: 6, w: 0.25 }, { id: 'shard', n: 1, k: 8, w: 0.25, rank: 8 },
  ];
  function rollGshop() {
    const st = G.state;
    const rnd = Math.random;
    const B = T.gBase();
    const area = IT.maxArea();
    const out = [];
    // 装備2つ（ランクが上がるほど良い品）
    for (let i = 0; i < 2; i++) {
      const w = [0, 50, 34, 10 + st.rank * 1.5, st.rank >= 8 ? (st.rank - 7) * 1.5 : 0];
      let x = rnd() * w.reduce((a, v) => a + v, 0), r = 1;
      for (let j = 0; j < w.length; j++) { x -= w[j]; if (x <= 0) { r = j; break; } }
      const item = IT.make(rnd, r, { noRelic: true, area, ilv: IT.ilvFor(() => 0.55 + rnd() * 0.45, area) });
      out.push({ kind: 'equip', item, price: Math.round(B * [0.6, 1.5, 4, 12, 40][r] * (0.85 + rnd() * 0.3)) });
    }
    // 持ち物4つ（同じ品は並ばない）
    const pool = GS_POOL.filter((p) => !p.rank || st.rank >= p.rank).slice();
    for (let i = 0; i < 4 && pool.length; i++) {
      let x = rnd() * pool.reduce((a, p) => a + (p.w || 1), 0), k = 0;
      for (; k < pool.length - 1; k++) { x -= pool[k].w || 1; if (x <= 0) break; }
      const p = pool.splice(k, 1)[0];
      out.push({ kind: 'cons', id: p.id, n: p.n, price: Math.round(B * p.k * (0.9 + rnd() * 0.2)) });
    }
    // ときどき掘り出し物（3割引）
    if (rnd() < 0.6) { const d = out[Math.floor(rnd() * out.length)]; d.price = Math.round(d.price * 0.7); d.sale = true; }
    out.forEach((o) => { o.price = Math.max(10, Math.round(o.price / 10) * 10); });
    return out;
  }
  function gshop() {
    const st = G.state;
    const rot = T.gshopRot();
    if (!st.gshop || st.gshop.rot !== rot || !Array.isArray(st.gshop.items)) st.gshop = { rot, refresh: 0, items: rollGshop() };
    return st.gshop;
  }
  T.gshopRefreshCost = () => Math.round((T.gBase() * 0.5 * Math.pow(2, gshop().refresh)) / 10) * 10;
  // ゴールド → 魔晶石（割高。1日5回まで、回を重ねるほど高く）
  const G2C = [1, 1.5, 2.2, 3, 4];
  T.g2cCost = (i) => Math.round((T.gBase() * 1.2 * G2C[Math.min(i, G2C.length - 1)]) / 10) * 10;
  function gshopHtml() {
    const sh = gshop();
    const gold = G.state.gold;
    const next = (sh.rot + 1) * GS_ROT;
    const cards = sh.items.map((o, i) => {
      const it = o.kind === 'equip' ? o.item : null;
      const name = it ? it.name : IT.CONS[o.id].name + (o.n > 1 ? ` ×${o.n}` : '');
      const r = it ? it.rarity : IT.CONS[o.id].rarity;
      const img = it ? thumb(it, 52) : consThumb(o.id, 52);
      const sub = it ? `${IT.SLOT_NAME[it.slot]} ・ Lv${it.ilv}` : '持ち物';
      return `<button class="gs-item r${r} ${o.sold ? 'sold' : ''} ${o.sale ? 'sale' : ''} ${!o.sold && gold < o.price ? 'cant' : ''}" data-gs="${i}" data-rot="${sh.rot}" ${o.sold ? 'disabled' : ''}>${o.sale && !o.sold ? '<em class="gs-tag">掘り出し物</em>' : ''}<img alt="" src="${img}"><b>${G.esc(name)}</b><small>${sub}</small><span class="gs-price">${o.sold ? '売り切れ' : `${G.ui.IC.coin}${G.fmt(o.price)}`}</span></button>`;
    }).join('');
    return `<div class="sec gshop"><div class="gs-head"><img class="gs-face" alt="" src="${art.portrait(MERCHANT, 56, 'merchant')}"><div class="grow"><h3>ゴールドの市</h3><small>行商人ペトラ「どれも1つきり！ 荷は <b data-countdown="${next}">${G.fmtClock(next - G.now())}</b> で入れ替えるよ」</small></div></div>
      <div class="gs-grid">${cards}</div>
      <button class="btn ghost wide" id="gsRefresh">${G.ui.IC.coin}${G.fmt(T.gshopRefreshCost())}G で品ぞろえを替えてもらう</button></div>`;
  }
  function buyGshop(i) {
    const st = G.state;
    const sh = gshop();
    const o = sh.items[i];
    if (!o || o.sold) return;
    const it = o.kind === 'equip' ? o.item : null;
    const name = it ? it.name : IT.CONS[o.id].name + (o.n > 1 ? ` ×${o.n}` : '');
    let info = '';
    if (it) {
      const main = IT.MAIN[it.slot];
      info = `<div class="stats-box"><div class="main"><span>${IT.STAT[main.k].name}</span><b>${pct(IT.mainVal(it))}</b></div>${(it.affixes || []).length ? `<ul>${it.affixes.map((a) => `<li><span>${IT.STAT[a.k].name}</span><b>+${IT.fmtV(a.v)}%</b></li>`).join('')}</ul>` : ''}</div>`;
    } else info = `<p>${IT.CONS[o.id].desc}</p>`;
    G.ui.modal(`<div class="gs-confirm r${it ? it.rarity : IT.CONS[o.id].rarity}"><img alt="" src="${it ? thumb(it, 88) : consThumb(o.id, 88)}"><h2>${G.esc(name)}</h2>${it ? `<p class="sub">${R_NAME(it.rarity)} ・ ${IT.SLOT_NAME[it.slot]} ・ Lv${it.ilv}</p>` : ''}${info}<p class="gs-pay">${G.ui.IC.coin}<b>${G.fmt(o.price)}</b>G${o.sale ? ' <em>3割引</em>' : ''}</p></div>`, [
      { text: '戻る', cls: 'ghost' },
      { text: '買う', cls: 'primary', fn: () => {
        if (st.gold < o.price) { G.audio.sfx('error'); G.ui.toast(`ゴールドが足りません（あと ${G.fmt(o.price - st.gold)}G）`, 'bad'); return; }
        st.gold -= o.price;
        o.sold = true;
        if (it) IT.add(Object.assign({}, it, { isNew: true }));
        else IT.addCons(o.id, o.n);
        st.stats.goldShop = (st.stats.goldShop || 0) + 1;
        G.audio.sfx('coins');
        G.audio.sfx('gift');
        G.ui.toast(`ペトラ「まいど！」 ${name} を手に入れた`, it ? 'rare' + it.rarity : 'good');
        G.emit('itemsChanged');
        G.sim.save();
        G.ui.refreshHud();
        G.ui.renderSheet();
      } },
    ], { cls: 'gs-modal' });
  }
  const R_NAME = (r) => IT.RARITY[r].id;
  function shopTab() {
    const st = G.state;
    const today = T.today();
    const freeCry = st.dailyCry !== today;
    const cry = st.crystals || 0;
    let h = `<div class="shop-head"><span class="tr-cry">${CRY}<b>${G.fmt(cry)}</b><small>魔晶石</small></span><span class="tr-cry gold">${G.ui.IC.coin}<b>${G.fmt(st.gold)}</b><small>ゴールド</small></span></div>`;
    h += gshopHtml();
    h += `<div class="sec"><h3>魔晶石</h3>
      <div class="card shop-free ${freeCry ? '' : 'done'}"><img alt="" src="${consThumb('cry', 44)}"><div class="grow"><b>今日の魔晶石 ×10</b><small>1日1回、無料でもらえます</small></div><button class="btn sm ${freeCry ? 'go' : ''}" id="shFree" ${freeCry ? '' : 'disabled'}>${freeCry ? '受け取る' : '受け取り済み'}</button></div>
      <div class="packs">${T.PACKS.map((p) => `<button class="pack" data-pack="${p.id}"><img alt="" src="${consThumb('cry', 40)}"><b>${p.label}</b>${p.bonus ? `<i>${p.bonus}</i>` : ''}<small>アプリ版で</small></button>`).join('')}</div>
      <p class="hint">魔晶石の購入はアプリ版で対応します。いまは遊んで集めた魔晶石で楽しめます。</p></div>`;
    // 両替所
    const exN = bought('ex', 'day');
    const exLeft = EX_COST.length - exN;
    const exCost = EX_COST[Math.min(exN, EX_COST.length - 1)];
    h += `<div class="sec"><h3>両替所</h3><div class="card exch ${exLeft ? '' : 'soldout'}"><img alt="" src="${consThumb('cry', 40)}"><i class="arrow">→</i><span class="coinbig">${G.ui.IC.coin}</span><div class="grow"><b>${G.fmt(T.exGold())}G</b><small>${exLeft ? `今日あと ${exLeft}回（回を重ねるほど魔晶石が多く要ります）` : '今日の両替は終わりました。明日また使えます'}</small></div><button class="btn sm ${exLeft && cry >= exCost ? 'primary' : 'cant'}" data-buy="ex" ${exLeft ? '' : 'disabled'}>${CRY}<span>${exCost}</span></button></div>`;
    const g2n = bought('g2c', 'day');
    const g2left = G2C.length - g2n;
    const g2cost = T.g2cCost(g2n);
    h += `<div class="card exch ${g2left ? '' : 'soldout'}"><span class="coinbig">${G.ui.IC.coin}</span><i class="arrow">→</i><img alt="" src="${consThumb('cry', 40)}"><div class="grow"><b>魔晶石 ×10</b><small>${g2left ? `今日あと ${g2left}回（割高・回を重ねるほど高く）` : '今日の分は終わりました。明日また使えます'}</small></div><button class="btn sm ${g2left && st.gold >= g2cost ? 'primary' : 'cant'}" data-buy="g2c" ${g2left ? '' : 'disabled'}>${G.ui.IC.coin}<span>${G.fmt(g2cost)}</span></button></div><p class="hint">両替の額は、ギルドランクが上がるほど大きくなります</p></div>`;
    // お得パック
    h += `<div class="sec"><h3>お得パック</h3>${BUNDLES.map((b) => {
      const left = b.max - bought(b.key, b.per);
      return `<div class="card shop bundle ${left > 0 ? '' : 'soldout'}"><img alt="" src="${consThumb(b.icon, 44)}"><div class="grow"><b>${b.name}<em class="per">${b.tag}</em></b><small>${b.desc}</small></div><button class="btn sm ${left > 0 && cry >= b.cost ? 'primary' : 'cant'}" data-buy="bundle:${b.key}" ${left > 0 ? '' : 'disabled'}>${left > 0 ? `${CRY}<span>${G.fmt(b.cost)}</span>` : '<span>購入済み</span>'}</button></div>`;
    }).join('')}</div>`;
    h += `<div class="sec"><h3>魔晶石で買う</h3>${SHOP.map((it) => shopRow(it)).join('')}</div>`;
    return h;
  }
  function shopRow(it) {
    const c = IT.CONS[it.id];
    const st = G.state;
    const left = it.max - bought(it.id, it.per);
    const ok = left > 0 && (st.crystals || 0) >= it.cost;
    return `<div class="card shop r${c.rarity} ${left > 0 ? '' : 'soldout'}"><img alt="" src="${consThumb(it.id, 40)}"><div class="grow"><b>${c.name}${it.n > 1 ? ` ×${it.n}` : ''}</b><small>${c.desc}</small><small class="lim">${left > 0 ? `${perName[it.per]}あと ${left}/${it.max}` : `${perName[it.per]}の分は売り切れ（${it.per === 'day' ? '明日' : '来週'}また入荷）`}</small></div><button class="btn sm ${ok ? 'primary' : 'cant'}" data-buy="item:${it.id}" ${left > 0 ? '' : 'disabled'}>${left > 0 ? `${CRY}<span>${G.fmt(it.cost)}</span>` : '<span>売り切れ</span>'}</button></div>`;
  }
  function consIcon(id) { return `<img class="ci" alt="" src="${consThumb(id, 18)}">`; }

  function bind(body) {
    const on = (sel, fn) => { const el = G.$(sel, body); if (el) el.addEventListener('click', fn); };
    on('#trFree', () => openChest('free'));
    on('#trOne', () => openChest('one'));
    on('#trTen', () => openChest('ten'));
    on('#trKey', () => openChest('key'));
    on('#trRates', showRates);
    G.$$('[data-item]', body).forEach((b) => b.addEventListener('click', () => T.showItem(b.dataset.item)));
    G.$$('[data-gslot]', body).forEach((b) => b.addEventListener('click', () => { gearSlot = b.dataset.gslot; G.audio.sfx('soft'); G.ui.renderSheet(); }));
    const so = G.$('#gearSort', body);
    if (so) so.addEventListener('change', () => { gearSort = so.value; G.ui.renderSheet(); });
    on('#gAuto', () => {
      const n = IT.autoEquip();
      G.audio.sfx(n ? 'upgrade' : 'soft');
      G.ui.toast(n ? `${n}か所の装備を、いちばん強いものに替えました` : 'いまの装備がいちばん強い組み合わせです', n ? 'good' : 'info');
      G.ui.renderSheet();
    });
    on('#gBulk', bulkDismantle);
    on('#gEnh', () => T.enhanceMenu());
    const ae = G.$('#autoEnh', body);
    if (ae) ae.addEventListener('change', () => { G.state.settings.autoEnh = ae.checked; G.audio.sfx(ae.checked ? 'claim' : 'soft'); G.sim.save(); G.ui.renderSheet(); });
    G.$$('[data-use]', body).forEach((b) => b.addEventListener('click', () => useCons(b.dataset.use)));
    G.$$('[data-buy]', body).forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    G.$$('[data-gs]', body).forEach((b) => b.addEventListener('click', () => {
      if (+b.dataset.rot !== T.gshopRot()) { G.ui.toast('ペトラ「ちょうど荷を入れ替えたところだよ！」', 'info'); G.ui.renderSheet(); return; }
      G.audio.sfx('tap');
      buyGshop(+b.dataset.gs);
    }));
    on('#gsRefresh', () => {
      const st = G.state;
      const cost = T.gshopRefreshCost();
      G.ui.modal(`<div class="confirm"><h2>品ぞろえを替えてもらう</h2><p>${G.fmt(cost)}G で、ペトラが別の6品を並べてくれます。<br><small>（替えるたびに値段が上がります。${G.fmtClock((gshop().rot + 1) * GS_ROT - G.now())} 後には無料で入れ替わります）</small></p></div>`, [
        { text: '戻る', cls: 'ghost' },
        { text: '替えてもらう', cls: 'primary', fn: () => {
          if (st.gold < cost) { G.audio.sfx('error'); G.ui.toast(`ゴールドが足りません（あと ${G.fmt(cost - st.gold)}G）`, 'bad'); return; }
          st.gold -= cost;
          const sh = gshop();
          sh.refresh++;
          sh.items = rollGshop();
          G.audio.sfx('whoosh');
          G.ui.toast('ペトラ「とっておきを出してきたよ！」', 'good');
          G.sim.save();
          G.ui.refreshHud();
          G.ui.renderSheet();
        } },
      ]);
    });
    on('#shFree', () => {
      const st = G.state;
      if (st.dailyCry === T.today()) return;
      st.dailyCry = T.today();
      st.crystals = (st.crystals || 0) + 10;
      G.audio.sfx('gift');
      G.ui.toast('魔晶石を 10 受け取りました', 'good');
      G.sim.save();
      G.ui.renderSheet();
    });
    G.$$('[data-pack]', body).forEach((b) => b.addEventListener('click', () => {
      G.audio.sfx('soft');
      G.store.purchase(b.dataset.pack).then((r) => { if (!r.ok) G.ui.toast('魔晶石の購入はアプリ版で対応します', 'info'); });
    }));
  }

  // ---------------------------------------------------------------- 宝箱を開ける
  function chestImg(rank, size) {
    return art.url(art.cached('chestimg' + rank, size, (ctx, sz) => {
      const g = ctx.createRadialGradient(sz / 2, sz * 0.6, 0, sz / 2, sz * 0.6, sz * 0.5);
      g.addColorStop(0, 'rgba(255,214,110,0.45)');
      g.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, sz, sz);
      ctx.translate(sz / 2, sz * 0.8);
      ctx.scale(sz / 44, sz / 44);
      art.ellipse(ctx, 0, 0, 17, 3, 'rgba(0,0,0,0.3)');
      art.chestR(ctx, 0, rank, 0.4);
    }));
  }
  function showRates() {
    G.audio.sfx('tap');
    const row = (k) => IT.RARITY.map((r, i) => `<li class="r${i}"><b>${r.id}</b><span>${r.name}</span><em>${k[i]}%</em></li>`).join('');
    G.ui.modal(`<div class="rates"><h2>提供割合</h2><h3 class="mini">魔晶石・鍵の宝箱</h3><ul>${row([40, 35, 18, 6, 1])}</ul><h3 class="mini">無料の宝箱</h3><ul>${row([62, 30, 7, 1, 0])}</ul><p class="hint">装備品のほか、秘宝や持ち物が出ることがあります。10連は SR 以上が1つ確定。30回以内に SSR 以上が必ず出ます。持っている秘宝が出たときは魔晶石になります。</p></div>`, [{ text: '閉じる', cls: 'primary' }]);
  }
  function openChest(kind) {
    G.audio.init();
    const st = G.state;
    const cost = kind === 'ten' ? IT.CHEST10_COST : kind === 'one' ? IT.CHEST_COST : 0;
    if ((kind === 'one' || kind === 'ten') && (st.crystals || 0) < cost) {
      G.audio.sfx('error');
      G.ui.toast(`魔晶石が足りません（あと ${cost - (st.crystals || 0)}）。ショップで毎日10個もらえます`, 'bad');
      return;
    }
    const got = IT.openChest(kind);
    if (!got) { G.audio.sfx('error'); return; }
    const res = got.map((item) => {
      const isNew = item.kind === 'relic' ? !(st.relics && st.relics[item.rid]) : item.kind === 'cons' ? false : !(st.dex && st.dex[item.tid + ':' + item.rarity]);
      const r = IT.add(item);
      return { item, isNew, dup: r.dup, crystals: r.crystals || 0 };
    });
    G.sim.save();
    G.audio.sfx('open');
    T.chestShow(res, () => G.ui.renderSheet());
  }

  // ---------------------------------------------------------------- 装備の詳細・強化
  T.showItem = function (u, replace) {
    const st = G.state;
    const it = IT.get(u);
    if (!it) return;
    if (!replace) G.audio.sfx('tap');
    it.isNew = false;
    const e = IT.EQUIP[it.tid];
    const R = IT.RARITY[it.rarity];
    const who = IT.equippedBy(u);
    const main = IT.MAIN[it.slot];
    const fitName = e.cls ? D.CLASSES[e.cls].name : null;
    const c = IT.enhanceCost(it);
    const maxP = IT.maxPlus(it);
    const maxed = (it.plus || 0) >= maxP;
    const canEnh = !maxed && st.gold >= c.gold && IT.cons('stone') >= c.stone;
    const rc = IT.rerollCost(it);
    const aff = (it.affixes || []).map((a, i) => `<li><span>${IT.STAT[a.k].name}</span><i class="q" style="--q:${Math.round(G.clamp(a.q, 0.1, 1) * 100)}%"></i><b>${pct(a.v * (1 + 0.04 * (it.plus || 0)))}</b><button class="rr" data-rr="${i}" aria-label="付け直す">${CRY}<span>${rc}</span></button></li>`).join('');
    const lbHtml = it.rarity >= 4 ? `<div class="lb"><div class="lb-stars">${Array.from({ length: IT.MAX_LB }, (_, i) => `<i class="${i < (it.lb || 0) ? 'on' : ''}">★</i>`).join('')}</div>${IT.canLimitBreak(it) ? `<span class="lb-txt">限界突破 ★${(it.lb || 0) + 1}：主能力 +10%・強化上限 +2</span><button class="btn sm ${IT.cons('shard') >= IT.lbCost(it) ? 'primary' : 'cant'}" id="lbBtn">${consIcon('shard')}${IT.lbCost(it)}<small>（${IT.cons('shard')}）</small></button>` : '<span class="lb-txt">限界突破は最大です</span>'}</div>` : '';
    const advs = st.adv.slice().sort((a, b) => (IT.fits(it, b) - IT.fits(it, a)) || G.sim.power(b) - G.sim.power(a));
    const list = advs.map((a) => {
      const cur = a.eq && a.eq[it.slot] ? IT.get(a.eq[it.slot]) : null;
      const fit = IT.fits(it, a);
      const diff = cur && cur !== it ? IT.score(it, a) - IT.score(cur, a) : null;
      return `<button class="pick ${a === who ? 'on' : ''}" data-eq="${a.id}"><img alt="" src="${art.portrait(a.look, 40)}"><span><b>${G.esc(a.name)}</b><small>${D.CLASSES[a.cls].name} Lv${a.lv} ・ ${cur ? (cur === it ? '装備中' : 'いま：' + G.esc(cur.name)) : '空き'}</small></span>${diff != null ? `<em class="cmp ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'}</em>` : ''}${it.slot === 'weapon' ? `<em class="fit ${fit ? 'ok' : 'half'}">${fit ? '適性◎' : '効果半分'}</em>` : ''}</button>`;
    }).join('');
    const html = `<div class="item-detail r${it.rarity}"><div class="id-img"><img alt="" src="${thumb(it, 104)}">${it.plus ? `<i class="id-plus">+${it.plus}</i>` : ''}</div><small class="rar">${R.id} ${stars(it.rarity)}</small><h2>${G.esc(it.name)}${it.plus ? ` <span class="plus">+${it.plus}</span>` : ''}</h2>
      <p class="sub">${IT.SLOT_NAME[it.slot]} ・ Lv${it.ilv}${fitName ? ` ・ ${fitName}向け` : ''}</p>
      <div class="stats-box"><div class="main"><span>${IT.STAT[main.k].name}</span><b>${pct(IT.mainVal(it))}</b></div>${aff ? `<ul>${aff}</ul><p class="rr-hint">魔晶石で、追加能力を1つずつ付け直せます</p>` : '<p class="hint">追加能力なし（R 以上で付きます）</p>'}</div>
      ${lbHtml}
      <div class="enh">${maxed ? `<b class="maxed-t">強化は最大です（+${maxP}）${it.rarity >= 4 && IT.canLimitBreak(it) ? '・限界突破で上限が上がります' : ''}</b>` : `<div class="enh-row"><span>強化 <b>+${it.plus || 0}</b> → <b class="nx">+${(it.plus || 0) + 1}</b></span><span class="rate">成功率 ${Math.round(IT.enhanceRate(it) * 100)}%</span></div><div class="enh-row cost"><span>${G.ui.IC.coin}${G.fmt(c.gold)}</span><span>${consIcon('stone')}${c.stone}<small>（所持 ${IT.cons('stone')}）</small></span><button class="btn sm ${canEnh ? 'primary' : 'cant'}" id="enhBtn">強化する</button></div>`}</div>
      ${who ? `<p class="eq-now">いまは <b>${G.esc(who.name)}</b> が装備しています</p>` : ''}
      <h3 class="mini">装備させる冒険者</h3><div class="pick-list">${list}</div>
      <div class="id-tools"><button class="btn sm ghost ${it.lock ? 'on' : ''}" id="lockBtn">${LOCK}${it.lock ? '鍵をはずす' : '鍵をかける'}</button>${!who && !it.lock ? `<button class="btn sm ghost" id="disBtn">分解（強化石 +${IT.dismantleValue(it)}）</button><button class="btn sm ghost" id="sellBtn">売る</button>` : ''}</div></div>`;
    const btns = [];
    if (who) btns.push({ text: '外す', cls: 'ghost', fn: () => { IT.equip(who.id, null, it.slot); G.ui.toast(`${who.name}は《${it.name}》を外した`, 'info'); G.ui.renderSheet(); } });
    btns.push({ text: '閉じる', cls: 'primary', fn: () => G.ui.renderSheet() });
    G.ui.modal(html, btns, {
      cls: 'wide', replace: !!replace,
      onShow: (card) => {
        G.$$('[data-eq]', card).forEach((b) => b.addEventListener('click', () => {
          const a = st.adv.find((x) => x.id === +b.dataset.eq);
          if (!a) return;
          IT.equip(a.id, u);
          G.audio.sfx('upgrade');
          G.haptic(14);
          G.ui.toast(`${a.name}が《${it.name}》を装備した！${it.slot === 'weapon' && !IT.fits(it, a) ? '（職業が合わないので効果半分）' : ''}`, 'rare' + it.rarity);
          G.ui.closeModal();
          G.ui.renderSheet();
        }));
        const enh = G.$('#enhBtn', card);
        if (enh) enh.addEventListener('click', () => doEnhance(u, card));
        G.$$('[data-rr]', card).forEach((b) => b.addEventListener('click', () => doReroll(u, +b.dataset.rr)));
        const lb = G.$('#lbBtn', card);
        if (lb) lb.addEventListener('click', () => doLimitBreak(u, card));
        G.$('#lockBtn', card).addEventListener('click', () => { it.lock = !it.lock; G.audio.sfx('tap'); G.emit('itemsChanged'); T.showItem(u, true); });
        const dis = G.$('#disBtn', card);
        if (dis) dis.addEventListener('click', () => {
          if (it.rarity >= 2) { confirmBox(`《${G.esc(it.name)}》を分解しますか？`, `強化石が ${IT.dismantleValue(it)} 個手に入ります。取り消せません。`, '分解する', () => { const n = IT.dismantle(u); G.audio.sfx('shatter'); G.ui.toast(`分解して強化石を ${n} 個手に入れました`, 'good'); G.ui.renderSheet(); }, () => T.showItem(u)); return; }
          const n = IT.dismantle(u);
          G.audio.sfx('shatter');
          G.ui.toast(`分解して強化石を ${n} 個手に入れました`, 'good');
          G.ui.closeModal();
          G.ui.renderSheet();
        });
        const sell = G.$('#sellBtn', card);
        if (sell) sell.addEventListener('click', () => confirmBox(`《${G.esc(it.name)}》を売りますか？`, '取り消せません。', '売る', () => { const g = IT.sell(u); if (g) { G.audio.sfx('coins'); G.ui.toast(`${G.fmt(g)}G で売りました`, 'good'); G.ui.refreshHud(); G.ui.renderSheet(); } }, () => T.showItem(u)));
      },
    });
  };
  function confirmBox(title, text, ok, fn, back) {
    G.ui.closeModal();
    setTimeout(() => G.ui.modal(`<div class="confirm"><h2>${title}</h2><p>${text}</p></div>`, [{ text: '戻る', cls: 'ghost', fn: back ? () => setTimeout(back, 240) : null }, { text: ok, cls: 'danger', fn }]), 240);
  }
  function doEnhance(u, card) {
    const it = IT.get(u);
    const r = IT.enhance(u);
    if (!r.ok) {
      G.audio.sfx('error');
      G.ui.toast(r.why === 'gold' ? 'ゴールドが足りません' : r.why === 'stone' ? '強化石が足りません。いらない装備を分解すると手に入ります' : 'これ以上は強化できません', 'bad');
      return;
    }
    const img = G.$('.id-img', card);
    img.classList.remove('hit', 'ok', 'ng'); void img.offsetWidth; img.classList.add('hit');
    G.audio.sfx('clank');
    G.audio.sfx('build');
    G.haptic(10);
    setTimeout(() => {
      img.classList.add(r.success ? 'ok' : 'ng');
      if (r.success) {
        G.audio.sfx(it.plus >= 8 ? 'rarity' : 'upgrade', 3);
        G.haptic(24);
        G.ui.toast(`強化成功！《${it.name}》+${it.plus}`, 'rare' + Math.min(4, it.rarity + (it.plus >= 7 ? 1 : 0)));
      } else {
        G.audio.sfx('error');
        G.ui.toast('強化失敗…（装備はそのまま残っています）', 'bad');
      }
      setTimeout(() => T.showItem(u, true), 520);
      G.ui.refreshHud();
    }, 380);
  }
  // 追加能力の付け直し：結果を並べて、どちらにするか選ぶ
  function doReroll(u, idx) {
    const it = IT.get(u);
    if (!it) return;
    const r = IT.reroll(u, idx);
    if (!r.ok) {
      G.audio.sfx('error');
      G.ui.toast(r.why === 'cry' ? `魔晶石が足りません（${IT.rerollCost(it)}必要）` : '付け直せません', 'bad');
      return;
    }
    G.audio.init();
    G.audio.sfx('cast');
    G.haptic(12);
    G.ui.refreshHud();
    const row = (a, tag) => `<div class="rr-card ${tag}"><small>${tag === 'old' ? 'いまの能力' : '新しい能力'}</small><b>${IT.STAT[a.k].name}</b><em>${pct(a.v * (1 + 0.04 * (it.plus || 0)))}</em><i class="q" style="--q:${Math.round(G.clamp(a.q, 0.1, 1) * 100)}%"></i></div>`;
    const better = r.nu.q >= r.old.q;
    setTimeout(() => G.audio.sfx(better ? 'rarity' : 'soft', better ? 2 : 0), 220);
    G.ui.modal(`<div class="reroll"><h2>付け直しの結果</h2><div class="rr-pair">${row(r.old, 'old')}<span class="rr-arrow">→</span>${row(r.nu, 'nu' + (better ? ' good' : ''))}</div><p class="hint">どちらを残しますか？（魔晶石は戻りません）</p></div>`, [
      { text: '元に戻す', cls: 'ghost', fn: () => { IT.revertReroll(u, idx, r.old); G.sim.save(); setTimeout(() => T.showItem(u), 240); } },
      { text: '新しい能力にする', cls: 'primary', fn: () => { G.sim.save(); G.ui.toast(`《${it.name}》の能力が変わった！`, 'rare' + it.rarity); setTimeout(() => T.showItem(u), 240); } },
    ], { cls: 'wide', replace: true });
  }
  function doLimitBreak(u, card) {
    const it = IT.get(u);
    const r = IT.limitBreak(u);
    if (!r.ok) {
      G.audio.sfx('error');
      G.ui.toast(r.why === 'shard' ? '虹の欠片が足りません。深淵の迷宮の守護者や、URの分解で手に入ります' : 'これ以上は限界突破できません', 'bad');
      return;
    }
    const img = G.$('.id-img', card);
    img.classList.remove('hit', 'ok', 'ng', 'lbfx'); void img.offsetWidth; img.classList.add('lbfx');
    G.audio.sfx('flash');
    G.audio.sfx('rarity', 4);
    G.haptic(30);
    G.ui.fx.confetti();
    G.ui.toast(`限界突破！《${it.name}》★${r.lb}（強化の上限 +${IT.maxPlus(it)}）`, 'rare4');
    G.sim.save();
    setTimeout(() => T.showItem(u, true), 900);
  }
  // まとめて強化：使うゴールドを選ぶ → 結果を一覧で
  T.enhanceMenu = function (who) {
    const st = G.state;
    G.audio.init();
    G.audio.sfx('tap');
    const eq = (who ? [who] : st.adv).reduce((n, a) => n + IT.equipped(a).length, 0);
    if (!eq) { G.ui.toast('装備している品がありません。「おまかせ装備」で装備させましょう', 'info'); return; }
    const opt = (k, label) => ({ text: `${label}（${G.fmt(Math.floor(st.gold * k))}G）`, cls: k >= 1 ? 'danger' : 'ghost', fn: () => setTimeout(() => runEnhance(Math.floor(st.gold * k), who), 220) });
    G.ui.modal(`<div class="confirm"><h2>まとめて強化</h2><p>${who ? `${G.esc(who.name)}の` : 'みんなの'}装備中の品を、安い順に強化します。<br>+6 からは失敗することがあります（壊れません）。</p><p class="hint">強化石 ${G.fmt(IT.cons('stone'))}個 ・ 所持 ${G.fmt(st.gold)}G</p></div>`, [opt(0.3, '3割まで'), opt(0.6, '6割まで'), opt(1, 'ぜんぶ使う')], { cls: 'wide' });
  };
  function runEnhance(budget, who) {
    const r = IT.autoEnhance(budget, who);
    if (!r.tries) {
      G.audio.sfx('error');
      G.ui.toast(r.why === 'stone' ? '強化石が足りません。いらない装備を分解すると手に入ります' : r.why === 'max' ? '装備中の品はすべて最大まで強化されています' : 'ゴールドが足りません', 'bad');
      return;
    }
    G.audio.sfx('clank');
    G.audio.sfx(r.ok ? 'upgrade' : 'error', 3);
    G.haptic(20);
    const rows = Object.values(r.items).filter((x) => x.to !== x.from || true).map((x) => `<li class="r${x.rarity}"><span>${G.esc(x.name)}</span><b>+${x.from} → <em>+${x.to}</em></b></li>`).join('');
    G.ui.modal(`<div class="enh-sum"><h2>まとめて強化 完了</h2><p><b>${r.tries}</b>回（成功 <b class="ok">${r.ok}</b>・失敗 ${r.ng}） ・ ${G.fmt(r.spent)}G ・ 強化石 ${r.stones}</p><ul>${rows}</ul>${r.why === 'stone' ? '<p class="hint">強化石が尽きました。いらない装備を分解すると手に入ります</p>' : ''}</div>`, [{ text: 'OK', cls: 'primary', fn: () => G.ui.renderSheet() }], { cls: 'wide', onShow: () => { if (r.ok >= 3) G.ui.fx.confetti(); } });
    G.sim.save();
    G.ui.refreshHud();
  }
  // 自動強化（1分ごと）：施設の次の費用を残し、余りの2割まで
  let autoT = 0;
  T.autoTick = function (dt) {
    const st = G.state;
    if (!st || !st.settings.autoEnh) return;
    autoT += dt;
    if (autoT < 60) return;
    autoT = 0;
    let reserve = 0;
    G.D.FACILITIES.forEach((f) => { const s2 = G.sim.facState(f.id); if (s2 === 'buildable' || s2 === 'upgradable') { const c = G.sim.facCost(f.id); if (!reserve || c.gold < reserve) reserve = c.gold; } });
    const budget = Math.floor(Math.max(0, st.gold - reserve) * 0.2);
    if (budget <= 0) return;
    const r = IT.autoEnhance(budget);
    if (r.ok) {
      const best = Object.values(r.items).sort((a, b) => b.to - a.to)[0];
      G.ui.toast(`自動強化：${r.ok}回成功（${best ? `《${best.name}》+${best.to}` : ''}）`, 'good', 'autoenh');
      G.ui.refreshHud();
    }
  };
  // まとめて分解：①どこまで分解するか選ぶ → ②分解する品を確かめる（タップで外せる）。どちらからも戻れる
  function bulkDismantle() {
    G.audio.sfx('tap');
    const st = G.state;
    const cnt = (r) => (st.items || []).filter((x) => x.rarity <= r && !x.lock && !IT.equippedBy(x.uid)).length;
    G.ui.modal(`<div class="confirm"><h2>まとめて分解</h2><p>装備していない・鍵をかけていない装備を、強化石にします。<br>次の画面で、分解する品を確かめられます。</p></div>`, [
      { text: `N（${cnt(0)}）`, cls: 'ghost', fn: () => bulkPick(0) },
      { text: `R以下（${cnt(1)}）`, cls: 'ghost', fn: () => bulkPick(1) },
      { text: `SR以下（${cnt(2)}）`, cls: 'ghost', fn: () => bulkPick(2) },
      { text: '戻る', cls: 'primary back' },
    ], { cls: 'bulk-pick' });
  }
  function bulkPick(r) {
    const st = G.state;
    const list = (st.items || []).filter((x) => x.rarity <= r && !x.lock && !IT.equippedBy(x.uid)).sort((a, b) => b.rarity - a.rarity || b.ilv - a.ilv);
    if (!list.length) { G.ui.toast('分解できる装備はありません', 'info'); setTimeout(bulkDismantle, 260); return; }
    const off = new Set();
    const sum = () => list.filter((x) => !off.has(x.uid)).reduce((n, x) => n + IT.dismantleValue(x), 0);
    const left = () => list.length - off.size;
    const grid = list.map((x) => `<button class="bp-item r${x.rarity}" data-bp="${x.uid}" title="${G.esc(x.name)}"><img alt="" src="${thumb(x, 44)}">${x.plus ? `<i>+${x.plus}</i>` : ''}<b>Lv${x.ilv}</b></button>`).join('');
    const html = `<div class="bulk-confirm"><h2>分解する品</h2><p class="hint">残しておきたい品はタップで外せます</p><div class="bp-grid">${grid}</div><p class="bp-sum"><span id="bpN">${left()}</span>個 → ${consIcon('stone')}<b id="bpS">${sum()}</b></p></div>`;
    G.ui.modal(html, [
      { text: '戻る', cls: 'ghost', fn: () => setTimeout(bulkDismantle, 240) },
      { text: '分解する', cls: 'danger', fn: () => {
        let n = 0, c = 0;
        list.forEach((x) => { if (!off.has(x.uid)) { n += IT.dismantle(x.uid, true); c++; } });
        G.emit('itemsChanged');
        if (!c) { G.ui.toast('分解する品が選ばれていません', 'info'); return; }
        G.audio.sfx('shatter');
        G.ui.toast(`${c}個を分解して、強化石を ${n} 個手に入れました`, 'good');
        G.ui.renderSheet();
      } },
    ], {
      cls: 'wide',
      onShow: (card) => {
        G.$$('[data-bp]', card).forEach((b) => b.addEventListener('click', () => {
          const u = b.dataset.bp;
          if (off.has(u)) off.delete(u); else off.add(u);
          b.classList.toggle('off', off.has(u));
          G.audio.sfx('tap');
          G.$('#bpN', card).textContent = left();
          G.$('#bpS', card).textContent = sum();
        }));
      },
    });
  }

  // ---------------------------------------------------------------- 持ち物を使う
  function useCons(id) {
    const st = G.state;
    const c = IT.CONS[id];
    G.audio.init();
    if (c.boost) {
      if (!IT.useBoost(id)) return;
      G.audio.sfx('rarity', 3);
      G.haptic(20);
      G.ui.fx.burst(window.innerWidth / 2, window.innerHeight * 0.4);
      G.ui.toast(`${c.name}を使った！ ${c.boost.k === 'speed' ? `30分間 ${c.boost.mult}倍速` : c.boost.k === 'gold' ? '30分間 ゴールド2倍' : '30分間 大成功率 +10%'}`, 'rare3');
      G.ui.refreshHud();
      G.ui.renderSheet();
      return;
    }
    if (id === 'key') { openChest('key'); return; }
    if (id === 'horn') {
      if (!st.active.length) { G.ui.toast('遠征中のパーティがいません', 'info'); return; }
      const n = IT.finishAll();
      if (!n) return;
      G.audio.sfx('rankup');
      G.haptic(30);
      G.ui.fx.burst(window.innerWidth / 2, window.innerHeight * 0.4);
      G.sim.advance(G.now());
      G.ui.toast(`帰還の角笛を吹いた！ ${n}組のパーティが帰ってきました`, 'rare3');
      G.ui.renderSheet();
      return;
    }
    if (id === 'finish') {
      if (!st.active.length) { G.ui.toast('遠征中のパーティがいません', 'info'); return; }
      const list = st.active.slice().sort((a, b) => b.endAt - a.endAt).map((ex) => {
        const adv = st.adv.find((a) => a.id === ex.party[0]);
        return `<button class="pick" data-ex="${ex.q.id}">${adv ? `<img alt="" src="${art.portrait(adv.look, 40)}">` : ''}<span><b>${G.esc(ex.q.name)}</b><small>帰還まで ${G.fmtClock(ex.endAt - G.now())}</small></span></button>`;
      }).join('');
      G.ui.modal(`<div class="item-pick"><h2>どのパーティを帰還させますか？</h2><div class="pick-list">${list}</div></div>`, [{ text: 'やめる', cls: 'ghost' }], {
        cls: 'wide',
        onShow: (card) => G.$$('[data-ex]', card).forEach((b) => b.addEventListener('click', () => {
          const ex = IT.finishOne(b.dataset.ex);
          G.ui.closeModal();
          if (!ex) return;
          G.audio.sfx('flash');
          G.sim.advance(G.now());
          G.ui.toast('時短の巻物を使った！ パーティが帰ってきました', 'rare1');
          G.ui.renderSheet();
        })),
      });
      return;
    }
    if (id === 'book' || id === 'expbook') {
      const list = st.adv.slice().sort((a, b) => b.lv - a.lv).map((a) => {
        const unk = IT.unknownSkills(a).length;
        return `<button class="pick" data-adv="${a.id}"><img alt="" src="${art.portrait(a.look, 40)}"><span><b>${G.esc(a.name)}</b><small>${D.CLASSES[a.cls].name} Lv${a.lv}${id === 'book' ? ` ・ 覚えていない技 ${unk}` : ''}</small></span></button>`;
      }).join('');
      G.ui.modal(`<div class="item-pick"><h2>${c.name}を誰に使いますか？</h2><div class="pick-list">${list}</div></div>`, [{ text: 'やめる', cls: 'ghost' }], {
        cls: 'wide',
        onShow: (card) => G.$$('[data-adv]', card).forEach((b) => b.addEventListener('click', () => {
          const a = st.adv.find((x) => x.id === +b.dataset.adv);
          G.ui.closeModal();
          if (!a || IT.cons(id) <= 0) return;
          IT.addCons(id, -1);
          if (id === 'book') {
            const unk = IT.unknownSkills(a);
            const known = Object.keys(a.sk || {}).filter((n) => a.sk[n] < 5);
            const name = unk.length ? G.pick(unk) : known.length ? G.pick(known) : null;
            if (!name) { IT.addCons(id, 1); G.ui.toast(`${a.name}はすべての技を極めています`, 'info'); return; }
            const r = IT.learnSkill(a, name);
            IT.used();
            G.audio.sfx('flash');
            setTimeout(() => G.ui.modal(`<div class="skill-get"><div class="sg-bulb"></div><small>${G.esc(a.name)}、閃いた！</small><h2>${G.esc(name)}${r.up ? ` <span>Lv${r.lv}</span>` : ''}</h2><p>${IT.skillDesc(a.cls, name, r.lv)}</p>${a.skillSet.includes(name) ? '<p class="hint">技をセットしました</p>' : '<p class="hint">冒険者の詳細から技をセットできます</p>'}</div>`, [{ text: 'やったね！', cls: 'primary big' }], { cls: 'celebrate', onShow: () => G.ui.fx.confetti() }), 260);
          } else {
            const before = a.lv;
            IT.used();
            G.sim.gainExp(a, Math.round(G.sim.expNeed(a.lv) * 1.6));
            G.audio.sfx('levelup');
            G.ui.toast(`${a.name}に経験値！ ${a.lv > before ? `Lv${before} → Lv${a.lv}` : ''}`, 'good');
          }
          G.ui.renderSheet();
        })),
      });
    }
  }

  function buy(spec) {
    const st = G.state;
    const pay = (cost) => {
      if ((st.crystals || 0) < cost) { G.audio.sfx('error'); G.ui.toast(`魔晶石が足りません（あと ${cost - (st.crystals || 0)}）`, 'bad'); return false; }
      st.crystals -= cost;
      return true;
    };
    if (spec === 'g2c') {
      const n = bought('g2c', 'day');
      if (n >= G2C.length) return;
      const cost = T.g2cCost(n);
      if (st.gold < cost) { G.audio.sfx('error'); G.ui.toast(`ゴールドが足りません（あと ${G.fmt(cost - st.gold)}G）`, 'bad'); return; }
      st.gold -= cost;
      addBought('g2c', 'day');
      st.crystals = (st.crystals || 0) + 10;
      G.audio.sfx('rarity', 2);
      G.ui.toast(`${G.fmt(cost)}G を魔晶石 ×10 に替えました`, 'good');
    } else if (spec === 'ex') {
      const n = bought('ex', 'day');
      if (n >= EX_COST.length) return;
      if (!pay(EX_COST[n])) return;
      addBought('ex', 'day');
      const g = T.exGold();
      st.gold += g;
      G.audio.sfx('coins');
      const b = G.$('[data-buy="ex"]');
      if (b) { const r = b.getBoundingClientRect(); G.ui.flyCoins(r.left + r.width / 2, r.top, g, true); }
      G.ui.toast(`魔晶石を両替して ${G.fmt(g)}G 手に入れました`, 'good');
    } else if (spec.startsWith('bundle:')) {
      const b = BUNDLES.find((x) => x.key === spec.slice(7));
      if (!b || bought(b.key, b.per) >= b.max) return;
      if (!pay(b.cost)) return;
      addBought(b.key, b.per);
      b.items.forEach(([id, n]) => IT.addCons(id, n));
      G.audio.sfx('gift');
      G.ui.toast(`${b.name}を買いました`, 'rare3');
    } else {
      const it = SHOP.find((x) => x.id === spec.slice(5));
      if (!it || bought(it.id, it.per) >= it.max) return;
      if (!pay(it.cost)) return;
      addBought(it.id, it.per);
      IT.addCons(it.id, it.n);
      G.audio.sfx('coins');
      G.ui.toast(`${IT.CONS[it.id].name}${it.n > 1 ? ` ×${it.n}` : ''} を買いました`, 'good');
    }
    G.sim.save();
    G.ui.refreshHud();
    G.ui.renderSheet();
  }

  // ---------------------------------------------------------------- 冒険者の詳細（装備3枠・技）
  // 技をセットした瞬間：選ばれた技が光って弾ける
  let skFxNext = null;
  function skillFx(card, set) {
    const rows = G.$$('.skill-row[data-skill]', card).filter((r) => set.includes(r.dataset.skill));
    rows.forEach((r, i) => {
      r.classList.remove('sk-pop');
      void r.offsetWidth;
      r.style.setProperty('--d', i * 0.12 + 's');
      r.classList.add('sk-pop');
      const sp = document.createElement('span');
      sp.className = 'sk-spark';
      sp.innerHTML = Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45 + Math.random() * 20}deg;--r:${(26 + Math.random() * 22).toFixed(0)}px"></i>`).join('');
      r.appendChild(sp);
      setTimeout(() => sp.remove(), 1400);
    });
    if (rows.length) setTimeout(() => G.audio.sfx('rarity', 2), 160);
  }
  T.skillFx = skillFx;
  T.advDetail = function (id, replace) {
    const st = G.state;
    const a = st.adv.find((x) => x.id === id);
    if (!a) return;
    if (!replace) G.audio.sfx('tap');
    const cls = D.CLASSES[a.cls];
    const sAll = IT.advStats(a);
    const slots = IT.SLOTS.map((slot) => {
      const it = a.eq && a.eq[slot] ? IT.get(a.eq[slot]) : null;
      return `<button class="eq-slot ${it ? 'r' + it.rarity : 'none'}" data-slot="${slot}">${it ? `<img alt="" src="${thumb(it, 46)}">${it.plus ? `<i>+${it.plus}</i>` : ''}` : `<span class="es-empty">${IT.SLOT_NAME[slot]}</span>`}<small>${it ? G.esc(it.name) : '空き'}</small></button>`;
    }).join('');
    const known = Object.keys(a.sk || {});
    const nSlots = IT.skillSlots(a);
    const skills = known.length ? known.map((n) => {
      const on = (a.skillSet || []).includes(n);
      return `<button class="skill-row ${on ? 'on' : ''}" data-skill="${G.esc(n)}"><b>${G.esc(n)}</b><em>Lv${a.sk[n]}</em><small>${IT.skillDesc(a.cls, n, a.sk[n])}</small><i>${on ? 'セット中' : 'セット'}</i></button>`;
    }).join('') : '<p class="hint">まだ技を覚えていません。冒険譚で「閃く」か、閃きの書で覚えます。</p>';
    const statList = IT.STAT_IDS.filter((k) => sAll[k]).map((k) => `<span>${IT.STAT[k].name}<b>${pct(sAll[k])}</b></span>`).join('') || '<span class="none">装備や技で能力が上がります</span>';
    const sb = IT.setBonus(a);
    const setHtml = sb ? `<div class="set-bonus t${sb.tier}"><b>${sb.name}</b><span>${sb.desc}</span></div>` : '<div class="set-bonus none"><span>3枠を SR 以上でそろえると「そろいボーナス」</span></div>';
    // 熟練（職業ごとの★）
    const S = G.sim;
    const mast = S.unlockedClasses().map((c) => {
      const n = S.mastStars(a, c);
      const nx = S.mastNext(a, c);
      return `<span class="ms ${c === a.cls ? 'cur' : ''} ${n >= 5 ? 'max' : ''}" style="--cls:${D.CLASSES[c].color}" title="${D.CLASSES[c].name}"><b>${D.CLASSES[c].name}</b><i>${'★'.repeat(n)}<u>${'★'.repeat(5 - n)}</u></i>${c === a.cls && nx.next ? `<small>${nx.q}/${nx.next}</small>` : ''}</span>`;
    }).join('');
    const mt = S.mastTotal(a);
    const growing = S.isGrowing(a);
    const crossOpts = S.crossOptions(a);
    const cross = a.cross && a.cross.cls !== a.cls ? a.cross : null;
    const crossHtml = crossOpts.length || cross ? `<button class="skill-row cross ${cross ? 'on' : ''}" id="crossBtn"><b>継承スキル</b><em>${cross ? D.CLASSES[cross.cls].name : '空き'}</em><small>${cross ? `${G.esc(cross.name)}：${IT.skillDesc(cross.cls, cross.name, ((a.skBy || {})[cross.cls] || {})[cross.name] || 1)}` : '熟練★3 の職業の技を、1つ使える'}</small><i>${cross ? '変える' : 'えらぶ'}</i></button>` : '';
    const html = `<div class="adv-detail"><img alt="" src="${art.portrait(a.look, 120)}" style="--cls:${cls.color}"><h2>${G.esc(a.name)}</h2><p class="sub">${cls.name} ・ Lv${a.lv} ・ 戦力 ${G.fmt(G.sim.power(a))}${growing ? ' ・ <span class="grow-tag">伸び盛り 経験値×2.5</span>' : ''}</p>
      <div class="mastery"><div class="ms-head"><b>熟練</b><small>★の合計 ${mt} ・ 戦力 +${mt * 2}%</small></div><div class="ms-list">${mast}</div><small class="ms-hint">★3：その職業の技を継承スキルに ・ ★5：その職業の特技を、転職しても持ち続ける</small></div>
      <div class="adv-actions"><button class="btn sm ghost" id="advChange">転職する${a.lv < S.CHANGE_LV ? `<span>Lv${S.CHANGE_LV}から</span>` : ''}</button><button class="btn sm ghost" id="advInherit">後継者に託す${a.lv < S.INHERIT_LV ? `<span>Lv${S.INHERIT_LV}から</span>` : ''}</button></div>
      <div class="eq-slots">${slots}</div>
      ${IT.equipped(a).length ? `<button class="link" id="advEnh">この冒険者の装備をまとめて強化</button>` : ''}
      ${setHtml}
      <div class="adv-stats">${statList}</div>
      <h3 class="mini">技 <small>セット ${(a.skillSet || []).length}/${nSlots}${a.lv < 20 ? '（Lv20で3枠）' : ''}</small>${known.length > 1 ? '<button class="link inline" id="skAuto">おまかせセット</button>' : ''}</h3><div class="skills">${skills}${crossHtml}</div>
      <dl><dt>職業の特技</dt><dd>${cls.perk}</dd><dt>性格「${D.TRAITS[a.trait].name}」</dt><dd>${D.TRAITS[a.trait].desc}</dd><dt>絆</dt><dd>${a.bond.toFixed(1)} / 10（冒険譚で応援すると深まり、戦力が少し上がる）</dd><dt>次のレベルまで</dt><dd>経験値 ${a.exp} / ${G.sim.expNeed(a.lv)}</dd></dl></div>`;
    G.ui.modal(html, [
      st.adv.length > 1 && a.status === 'idle' ? { text: '解雇する', cls: 'ghost danger', fn: () => G.ui.confirmDismiss(a) } : null,
      { text: '閉じる', cls: 'primary', fn: () => G.ui.renderSheet() },
    ].filter(Boolean), {
      cls: 'wide', replace: !!replace,
      onShow: (card) => {
        G.$$('[data-slot]', card).forEach((b) => b.addEventListener('click', () => pickFor(a, b.dataset.slot)));
        if (skFxNext) { const set = skFxNext; skFxNext = null; skillFx(card, set); }
        const ska = G.$('#skAuto', card);
        if (ska) ska.addEventListener('click', () => {
          const r = IT.autoSkills(a);
          if (!r.changed) { skillFx(card, r.set); G.audio.sfx('soft'); G.ui.toast('いまのセットがいちばん強い組み合わせです', 'info'); return; }
          G.audio.sfx('flash');
          G.haptic(14);
          G.ui.toast(`技をセット：${r.set.join('・')}`, 'good');
          skFxNext = r.set;
          T.advDetail(a.id, true);
        });
        const ae = G.$('#advEnh', card);
        if (ae) ae.addEventListener('click', () => { G.ui.closeModal(); setTimeout(() => T.enhanceMenu(a), 240); });
        G.$('#advChange', card).addEventListener('click', () => changeMenu(a));
        G.$('#advInherit', card).addEventListener('click', () => inheritMenu(a));
        const cb = G.$('#crossBtn', card);
        if (cb) cb.addEventListener('click', () => crossMenu(a));
        G.$$('[data-skill]', card).forEach((b) => b.addEventListener('click', () => {
          if (!IT.toggleSkill(a, b.dataset.skill)) { G.audio.sfx('error'); G.ui.toast(`技は ${nSlots} つまでセットできます。どれかを外してください`, 'bad'); return; }
          G.audio.sfx('tap');
          T.advDetail(a.id, true);
        }));
      },
    });
  };
  // ---------------------------------------------------------------- 転職
  function changeMenu(a) {
    const S = G.sim;
    G.audio.sfx('tap');
    if (a.lv < S.CHANGE_LV) { G.ui.toast(`転職は Lv${S.CHANGE_LV} からできます（いま Lv${a.lv}）`, 'info'); return; }
    if (a.status !== 'idle') { G.ui.toast('遠征から帰ってきたら転職できます', 'info'); return; }
    const cost = S.changeCost(a);
    const w = a.eq && a.eq.weapon ? IT.get(a.eq.weapon) : null;
    const list = S.unlockedClasses().map((c) => {
      const C = D.CLASSES[c];
      const n = S.mastStars(a, c);
      const has = Object.keys((a.skBy || {})[c] || (c === a.cls ? a.sk : {}) || {}).length;
      const look = Object.assign({}, a.look, { cls: c, outfit: G.shade(C.color, 0), crest: a.look.crest || (c === 'knight' ? '#3a5aa0' : undefined) });
      return `<button class="pick ${c === a.cls ? 'on' : ''}" data-cls="${c}" ${c === a.cls ? 'disabled' : ''}><img alt="" src="${art.portrait(look, 44)}"><span><b>${C.name}${c === a.cls ? '（いま）' : ''} <i class="mstar">${'★'.repeat(n)}</i></b><small>${C.perk}${has ? ` ・ 覚えた技 ${has}` : ''}</small></span></button>`;
    }).join('');
    G.ui.modal(`<div class="item-pick"><h2>${G.esc(a.name)}の転職</h2><p class="hint">レベル（Lv${a.lv}）はそのまま。熟練と覚えた技は職業ごとに残り、いつでも戻れます。費用 ${G.ui.IC.coin}${G.fmt(cost)}${w ? '・合わない武器ははずれます' : ''}</p><div class="pick-list">${list}</div></div>`, [{ text: 'やめる', cls: 'ghost', fn: () => setTimeout(() => T.advDetail(a.id), 240) }], {
      cls: 'wide', replace: true,
      onShow: (card) => G.$$('[data-cls]', card).forEach((b) => b.addEventListener('click', () => {
        const r = S.changeClass(a, b.dataset.cls);
        if (!r.ok) { G.audio.sfx('error'); G.ui.toast(r.why === 'gold' ? `ゴールドが足りません（${G.fmt(cost)}G）` : '転職できません', 'bad'); return; }
        G.audio.sfx('rankup');
        G.haptic(24);
        G.ui.fx.confetti();
        G.ui.toast(`${a.name}は${D.CLASSES[a.cls].name}に転職した！`, 'rare3');
        G.sim.save();
        G.ui.refreshHud();
        G.ui.closeModal();
        setTimeout(() => T.advDetail(a.id), 260);
      })),
    });
  }
  // 継承スキルをえらぶ
  function crossMenu(a) {
    const S = G.sim;
    const opts = S.crossOptions(a);
    G.audio.sfx('tap');
    if (!opts.length) { G.ui.toast('熟練★3 の職業で覚えた技が、継承スキルとして使えます', 'info'); return; }
    const list = opts.map((o) => `<button class="pick ${a.cross && a.cross.cls === o.cls && a.cross.name === o.name ? 'on' : ''}" data-xc="${o.cls}" data-xn="${G.esc(o.name)}"><span><b>${G.esc(o.name)} <em>Lv${o.lv}</em></b><small>${D.CLASSES[o.cls].name}の技${o.gift ? '（託された技）' : ''} ・ ${IT.skillDesc(o.cls, o.name, o.lv)}</small></span></button>`).join('');
    G.ui.modal(`<div class="item-pick"><h2>継承スキル</h2><p class="hint">ほかの職業の技を1つだけ、いまの職業でも使えます</p><div class="pick-list">${list}</div></div>`, [
      a.cross ? { text: 'はずす', cls: 'ghost', fn: () => { S.setCross(a, null); setTimeout(() => T.advDetail(a.id), 240); } } : null,
      { text: '戻る', cls: 'primary', fn: () => setTimeout(() => T.advDetail(a.id), 240) },
    ].filter(Boolean), {
      cls: 'wide', replace: true,
      onShow: (card) => G.$$('[data-xc]', card).forEach((b) => b.addEventListener('click', () => {
        S.setCross(a, b.dataset.xc, b.dataset.xn);
        G.audio.sfx('flash');
        G.ui.toast(`継承スキル「${b.dataset.xn}」をセットしました`, 'good');
        G.ui.closeModal();
        setTimeout(() => T.advDetail(a.id), 240);
      })),
    });
  }
  // ---------------------------------------------------------------- 継承（後継者に託す）
  function inheritMenu(a) {
    const S = G.sim;
    const st = G.state;
    G.audio.sfx('tap');
    if (a.lv < S.INHERIT_LV) { G.ui.toast(`後継者に託せるのは Lv${S.INHERIT_LV} からです`, 'info'); return; }
    if (a.status !== 'idle') { G.ui.toast('遠征から帰ってきたら託せます', 'info'); return; }
    const others = st.adv.filter((b) => b !== a && b.status === 'idle').sort((x, y) => x.lv - y.lv);
    if (!others.length) { G.ui.toast('託せる相手（待機中の冒険者）がいません', 'info'); return; }
    const best = Object.entries(a.sk || {}).sort((x, y) => y[1] - x[1])[0];
    const list = others.map((b) => `<button class="pick" data-to="${b.id}"><img alt="" src="${art.portrait(b.look, 40)}"><span><b>${G.esc(b.name)}</b><small>${D.CLASSES[b.cls].name} ・ Lv${b.lv} → <em class="up">Lv${S.inheritPreview(a, b)}</em></small></span></button>`).join('');
    G.ui.modal(`<div class="item-pick"><h2>${G.esc(a.name)}が後輩に託す</h2><p class="hint">${G.esc(a.name)}は引退して殿堂入りします（ギルド全体の戦力 +1%・最大+10%）。<br>経験の6割・熟練の半分${best ? `・技「${G.esc(best[0])}」` : ''}が、選んだ冒険者に受け継がれます。装備は倉庫に戻ります。</p><div class="pick-list">${list}</div></div>`, [{ text: 'やめる', cls: 'ghost', fn: () => setTimeout(() => T.advDetail(a.id), 240) }], {
      cls: 'wide', replace: true,
      onShow: (card) => G.$$('[data-to]', card).forEach((b) => b.addEventListener('click', () => {
        const B = st.adv.find((x) => x.id === +b.dataset.to);
        G.ui.closeModal();
        setTimeout(() => G.ui.modal(`<div class="confirm"><h2>${G.esc(a.name)} → ${G.esc(B.name)}</h2><p>${G.esc(a.name)}は引退します。取り消せません。</p></div>`, [
          { text: 'やめる', cls: 'ghost' },
          { text: '託す', cls: 'danger', fn: () => {
            const r = S.inherit(a.id, B.id);
            if (!r.ok) { G.audio.sfx('error'); return; }
            G.audio.sfx('levelup');
            G.audio.sfx('rarity', 3);
            G.ui.fx.confetti();
            G.ui.toast(`${B.name}が想いを受け継いだ！ Lv${r.from} → Lv${r.to}${r.skill ? `・技「${r.skill}」` : ''}`, 'rare4');
            G.sim.save();
            setTimeout(() => T.advDetail(B.id), 300);
          } },
        ]), 240);
      })),
    });
  }
  function pickFor(a, slot) {
    const st = G.state;
    const items = (st.items || []).filter((x) => x.slot === slot).sort((x, y) => IT.score(y, a) - IT.score(x, a));
    const cur = a.eq && a.eq[slot] ? IT.get(a.eq[slot]) : null;
    if (!items.length) { G.ui.toast(`${IT.SLOT_NAME[slot]}を持っていません。宝箱から手に入ります`, 'info'); return; }
    const list = items.map((it) => {
      const who = IT.equippedBy(it.uid);
      const diff = cur && cur !== it ? IT.score(it, a) - IT.score(cur, a) : null;
      const main = IT.MAIN[slot];
      return `<button class="pick ${who === a ? 'on' : ''}" data-it="${it.uid}"><img alt="" src="${thumb(it, 40)}"><span><b>${G.esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</b><small>${IT.RARITY[it.rarity].id} ・ Lv${it.ilv} ・ ${IT.STAT[main.k].name} ${pct(IT.mainVal(it, a))}${who && who !== a ? ` ・ ${G.esc(who.name)}が装備中` : ''}</small></span>${diff != null ? `<em class="cmp ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'}</em>` : ''}</button>`;
    }).join('');
    G.ui.modal(`<div class="item-pick"><h2>${G.esc(a.name)}の${IT.SLOT_NAME[slot]}</h2><div class="pick-list">${list}</div></div>`, [
      cur ? { text: '外す', cls: 'ghost', fn: () => { IT.equip(a.id, null, slot); setTimeout(() => T.advDetail(a.id), 240); } } : null,
      { text: '戻る', cls: 'primary', fn: () => setTimeout(() => T.advDetail(a.id), 240) },
    ].filter(Boolean), {
      cls: 'wide', replace: true,
      onShow: (card) => G.$$('[data-it]', card).forEach((b) => b.addEventListener('click', () => {
        const it = IT.get(b.dataset.it);
        IT.equip(a.id, b.dataset.it);
        G.audio.sfx('upgrade');
        G.ui.toast(`${a.name}が《${it.name}》を装備した！`, 'rare' + it.rarity);
        T.advDetail(a.id, true);
      })),
    });
  }

  // ---------------------------------------------------------------- ログインボーナス
  T.today = () => { const d = new Date(G.now() * 1000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const DAILY = [{ cry: 20, auto30: 1 }, { stone: 10 }, { finish: 2, auto30: 1 }, { cry: 30 }, { hg2: 1, auto30: 1 }, { key: 2 }, { cry: 100, book: 1, auto180: 1 }];
  const rewardText = (r) => Object.entries(r).map(([k, n]) => (k === 'cry' ? `魔晶石 ×${n}` : `${IT.CONS[k].name} ×${n}`)).join('・');
  T.checkDaily = function () {
    const st = G.state;
    st.login = st.login || { n: 0, last: '' };
    const today = T.today();
    if (st.login.last === today) return false;
    st.login.last = today;
    st.login.n++;
    const day = ((st.login.n - 1) % 7);
    const r = Object.assign({}, DAILY[day]);
    const lc = G.events ? G.events.bonus('loginCry') : 0;
    if (lc && r.cry) r.cry *= lc;
    Object.entries(r).forEach(([k, n]) => IT.addCons(k, n));
    G.sim.save(true);
    const cells = DAILY.map((d, i) => {
      const firstK = Object.keys(d)[0];
      const state = i < day ? 'got' : i === day ? 'today' : '';
      return `<div class="dl ${state}"><small>${i + 1}日目</small><img alt="" src="${consThumb(firstK, 34)}"><b>${firstK === 'cry' ? '×' + d.cry : '×' + d[firstK]}</b>${Object.keys(d).length > 1 ? `<em title="${rewardText(d)}">+${Object.keys(d).length - 1}</em>` : ''}${state === 'got' ? '<i>受取済</i>' : ''}</div>`;
    }).join('');
    G.ui.modal(`<div class="daily"><img class="rina-face" alt="" src="${G.art.rina(144, day === 6 ? 'happy' : 'wink')}"><small>ログインボーナス ・ 通算 ${st.login.n}日目</small><h2>今日のおくりもの</h2><div class="dl-grid">${cells}</div><p class="dl-got">${rewardText(r)} を受け取りました</p><p class="hint">毎日ギルドに顔を出すと、7日目に豪華なおくりもの</p></div>`, [{ text: '受け取る', cls: 'primary big', fn: () => { G.audio.sfx('gift'); G.ui.refreshHud(); } }], { cls: 'celebrate', onShow: () => { G.audio.sfx('rarity', 2); } });
    if (G.notify) G.notify.push({ kind: 'daily', silent: true, action: 'treasury', title: 'ログインボーナス', body: rewardText(r) });
    return true;
  };

  // ---------------------------------------------------------------- 宝箱を開ける演出
  let fx = null, cv = null, ctx = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  T.chestShow = function (list, onDone) {
    const el = G.$('#chestFx');
    cv = G.$('#chestCanvas');
    ctx = cv.getContext('2d');
    el.hidden = false;
    const ui = el.querySelector('.cf-ui');
    ui.innerHTML = list.length > 1 ? '<button class="cf-skip" id="cfSkip">まとめて見る ››</button>' : '';
    resize();
    fx = { list, i: 0, t: 0, done: onDone, parts: [], fired: {} };
    const sk = G.$('#cfSkip');
    if (sk) sk.addEventListener('click', (e) => { e.stopPropagation(); if (fx && !fx.summary) { G.audio.sfx('tap'); const best = Math.max(...fx.list.map((r) => r.item.rarity)); if (best >= 2) G.audio.sfx('rarity', best); summary(); } });
    prep();
    requestAnimationFrame(() => el.classList.add('shown'));
    el.onclick = tap;
    G.audio.setMuffle(true);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  function resize() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  function prep() {
    const it = fx.list[fx.i].item;
    const rank = it.rarity;
    let s0 = rank;
    if (rank >= 2) s0 = Math.max(0, rank - (Math.random() < 0.5 ? 1 : 2));
    if (rank >= 3 && Math.random() < 0.35) s0 = 0;
    fx.steps = [];
    for (let r = s0; r <= rank; r++) fx.steps.push(r);
    fx.stepT = fx.steps.map((_, i) => (i === 0 ? 0 : 0.95 + i * 0.45));
    fx.reveal = 1.35 + (fx.steps.length - 1) * 0.45;
    fx.t = 0;
    fx.fired = {};
    fx.parts = [];
  }
  function tap() {
    if (!fx || fx.summary) return;
    if (fx.t < fx.reveal) { fx.t = fx.reveal; return; }
    if (fx.t < fx.reveal + 0.35) return;
    G.audio.sfx('tap');
    if (fx.i < fx.list.length - 1) { fx.i++; prep(); return; }
    if (fx.list.length > 1) summary();
    else finish();
  }
  function summary() {
    fx.summary = true;
    const box = G.$('#chestFx .cf-ui');
    box.innerHTML = `<div class="cf-sum"><h2>手に入れたもの</h2><div class="cf-grid${fx.list.length > 6 ? ' many' : ''}">${fx.list.map((r) => `<div class="cf-it r${r.item.rarity}"><img alt="" src="${thumb(r.item, 64)}">${r.isNew ? '<i>NEW</i>' : ''}<small>${G.esc(r.item.name)}</small>${r.dup ? `<em>${CRY}+${r.crystals}</em>` : ''}</div>`).join('')}</div><button class="btn primary big" id="cfClose">宝物庫へ</button></div>`;
    G.$('#cfClose').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
  }
  function finish() {
    const el = G.$('#chestFx');
    el.classList.remove('shown');
    setTimeout(() => { el.hidden = true; cancelAnimationFrame(raf); }, 300);
    if (!G.ui.modalOpen()) G.audio.setMuffle(!!G.ui.sheetTab());
    const done = fx && fx.done;
    fx = null;
    if (done) done();
  }
  function once(k, at) { if (fx.t >= at && !fx.fired[k]) { fx.fired[k] = true; return true; } return false; }
  function loop(now) {
    if (!fx) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!fx.summary) fx.t += dt;
    const r = fx.list[fx.i];
    const it = r.item;
    const s = Math.min(W / 360, H / 640);
    const cx = W / 2, cy = H * 0.56;
    if (once('drop', 0.32)) G.audio.sfx('bounce');
    if (once('roll', 0.62)) G.audio.sfx('roll');
    fx.steps.forEach((rk, i) => { if (i > 0 && once('st' + i, fx.stepT[i])) { G.audio.sfx('rarity', rk); G.haptic(12 + rk * 4); fx.flash = 0.35; fx.flashCol = art.RARITY_COL[rk].glow; } });
    if (once('rev', fx.reveal)) {
      G.audio.sfx('chest');
      G.audio.sfx('reveal', it.rarity >= 3 ? 'legend' : it.rarity >= 1 ? 'great' : 'ok');
      if (it.rarity >= 2) G.audio.sfx('rarity', it.rarity);
      for (let i = 0; i < [16, 30, 60, 100, 160][it.rarity]; i++) {
        fx.parts.push({ x: cx, y: cy - 40 * s, vx: G.rand(-260, 260) * s, vy: G.rand(-520, -160) * s, life: 0, max: G.rand(1.4, 2.4), col: G.pick(['#ffcf4a', '#ff7a6a', '#6ad0ff', '#8fe08a', '#c79bff', '#ffffff']), size: G.rand(4, 8) * s, rot: G.rand(0, 6), vr: G.rand(-9, 9) });
      }
      if (it.rarity >= 3) { fx.flash = 0.8; fx.flashCol = it.rarity >= 4 ? '#ffffff' : '#fff0b0'; G.haptic(40); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(cx, cy - 60 * s, 0, cx, cy, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#1e2e5c');
    bg.addColorStop(1, '#04070f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    let si = 0;
    fx.stepT.forEach((st, i) => { if (fx.t >= st) si = i; });
    const rank = fx.steps[si];
    const t = fx.t;
    if (t > fx.reveal) {
      const a = G.seg(t, fx.reveal, fx.reveal + 0.35);
      ctx.save();
      ctx.translate(cx, cy - 40 * s);
      ctx.rotate(t * 0.5);
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        ctx.fillStyle = it.rarity >= 4 ? `hsla(${(i * 360) / n + t * 120},90%,70%,${0.3 * a})` : G.rgba(art.RARITY_COL[it.rarity].glow, 0.28 * a);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang - 0.08) * 900, Math.sin(ang - 0.08) * 900);
        ctx.lineTo(Math.cos(ang + 0.08) * 900, Math.sin(ang + 0.08) * 900);
        ctx.fill();
      }
      ctx.restore();
    } else if (t > 0.5) {
      const col = rank === 4 ? art.rainbow(t, 0, 70) : art.RARITY_COL[rank].glow;
      const rr = (70 + (t - 0.5) * 30) * s;
      const g = ctx.createRadialGradient(cx, cy - 30 * s, 0, cx, cy - 30 * s, rr);
      g.addColorStop(0, G.rgba(col.startsWith('#') ? col : '#ffffff', rank >= 1 ? 0.55 : 0.25));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - 30 * s - rr, rr * 2, rr * 2);
    }
    const dropK = G.seg(t, 0, 0.55);
    const by = dropK < 1 ? -Math.abs(Math.cos(dropK * Math.PI * 2.2)) * (1 - dropK) * 300 * s : 0;
    const shaking = t > 0.6 && t < fx.reveal;
    const sh = shaking ? Math.sin(t * 60) * (1.5 + (t - 0.6) * 3) * s : 0;
    const op = G.ease.outBack(G.seg(t, fx.reveal, fx.reveal + 0.3));
    ctx.save();
    ctx.translate(cx + sh, cy + by);
    ctx.scale(3.4 * s, 3.4 * s);
    art.ellipse(ctx, 0, 0, 18, 3, 'rgba(0,0,0,0.35)');
    art.chestR(ctx, op, rank, t);
    ctx.restore();
    if (t > fx.reveal + 0.1) {
      const k2 = G.ease.outBack(G.seg(t, fx.reveal + 0.1, fx.reveal + 0.5));
      const iy = G.lerp(cy - 40 * s, cy - 210 * s, k2);
      ctx.save();
      ctx.translate(cx, iy);
      ctx.scale(k2, k2);
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 70 * s);
      gl.addColorStop(0, G.rgba(art.RARITY_COL[it.rarity].glow, 0.6));
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-70 * s, -70 * s, 140 * s, 140 * s);
      art.itemIcon(ctx, it, 92 * s, t);
      ctx.restore();
      const a = G.seg(t, fx.reveal + 0.3, fx.reveal + 0.55);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      const R = IT.RARITY[it.rarity];
      ctx.font = G.font(900, 30 * s, 'num');
      ctx.lineWidth = 6 * s;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0a0612';
      ctx.strokeText(R.id, cx, cy - 118 * s);
      if (it.rarity >= 4) {
        const ug = ctx.createLinearGradient(cx - 60 * s, 0, cx + 60 * s, 0);
        for (let i = 0; i <= 6; i++) ug.addColorStop(i / 6, `hsl(${i * 60 + t * 160},95%,70%)`);
        ctx.fillStyle = ug;
      } else ctx.fillStyle = art.RARITY_COL[it.rarity].accent;
      ctx.fillText(R.id, cx, cy - 118 * s);
      ctx.font = G.font(700, 13 * s);
      ctx.fillStyle = '#ffe39a';
      ctx.fillText(stars(it.rarity), cx, cy - 98 * s);
      ctx.font = G.font(800, (it.name.length > 10 ? 18 : 22) * s, 'head');
      ctx.lineWidth = 5 * s;
      ctx.strokeText(it.name, cx, cy + 62 * s);
      ctx.fillStyle = '#fbf3de';
      ctx.fillText(it.name, cx, cy + 62 * s);
      ctx.font = G.font(700, 12 * s);
      ctx.fillStyle = 'rgba(246,236,210,0.8)';
      let sub;
      if (it.kind === 'relic') sub = r.dup ? `持っている秘宝 → 魔晶石 +${r.crystals}` : '秘宝 ・ ' + IT.RELIC[it.rid].desc;
      else if (it.kind === 'cons') sub = '持ち物 ・ ' + IT.CONS[it.id].desc;
      else {
        const m = IT.MAIN[it.slot];
        sub = `${IT.SLOT_NAME[it.slot]} ・ Lv${it.ilv} ・ ${IT.STAT[m.k].name} ${pct(IT.mainVal(it))}`;
      }
      ctx.fillText(sub, cx, cy + 84 * s);
      if (it.kind === 'equip' && it.affixes && it.affixes.length) {
        ctx.font = G.font(700, 11 * s);
        ctx.fillStyle = '#a8dcff';
        ctx.fillText(it.affixes.map((x) => `${IT.STAT[x.k].name}${pct(x.v)}`).join('  '), cx, cy + 102 * s);
      }
      if (r.isNew) {
        ctx.font = G.font(900, 13 * s, 'num');
        ctx.fillStyle = '#ff7a6a';
        ctx.fillText('NEW!', cx + 70 * s, cy - 150 * s);
      }
      ctx.restore();
    }
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i];
      p.life += dt;
      if (p.life > p.max) { fx.parts.splice(i, 1); continue; }
      p.vy += 520 * s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, (1 - p.life / p.max) * 2);
      art.poly(ctx, [-p.size, p.size * 0.6, p.size, p.size * 0.6, 0, -p.size], p.col);
      ctx.restore();
    }
    if (fx.flash > 0) {
      fx.flash = Math.max(0, fx.flash - dt * 2);
      ctx.fillStyle = G.rgba(fx.flashCol || '#ffffff', fx.flash);
      ctx.fillRect(0, 0, W, H);
    }
    if (!fx.summary) {
      ctx.textAlign = 'center';
      ctx.font = G.font(700, 12);
      ctx.fillStyle = `rgba(246,236,210,${0.5 + 0.3 * Math.sin(now / 300)})`;
      const msg = t < fx.reveal ? 'タップでとばす' : fx.i < fx.list.length - 1 ? `タップで次へ（${fx.i + 1}/${fx.list.length}）` : 'タップで閉じる';
      ctx.fillText(msg, cx, H - 40);
    }
  }

  // ---------------------------------------------------------------- 課金のつなぎ口（アプリ版で差し替える）
  G.store = G.store || {
    available: false,
    products: T.PACKS,
    purchase: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
  };
})();
