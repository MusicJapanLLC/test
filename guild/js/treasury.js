/* ギルドの灯 — treasury: 宝物庫（装備品・秘宝・黄金の宝箱）
 *  - 黄金の宝箱は魔晶石で開ける。4時間ごとに1回は無料。30回以内に SSR 以上が必ず出る
 *  - 魔晶石は遊んで集める（大成功・伝説級の冒険譚、ランクアップ、目標、重複した秘宝）
 *  - 装備は冒険者1人に1つ。職業に合う武器は効果が満額、合わない武器は半分
 */
'use strict';
(function () {
  const T = (G.treasury = {});
  const IT = G.items;
  const art = G.art;
  const D = G.D;

  const CRY = '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 16,6 13,19 7,19 4,6" fill="#6f7cf0"/><polygon points="10,1 16,6 10,8" fill="#b9c2ff"/><polygon points="10,1 4,6 10,8" fill="#dfe4ff"/><polygon points="4,6 10,8 7,19" fill="#5a66d8"/><polygon points="16,6 10,8 13,19" fill="#4a52b8"/><polygon points="10,8 13,19 7,19" fill="#7f8cff"/></svg>';
  T.CRY = CRY;
  const TYPE_NAME = { weapon: '武器', armor: '防具', charm: '装飾品' };
  const thumb = (it, s) => G.ui.itemThumb(it, s);
  const stars = (r) => '★'.repeat(r + 1);

  T.sig = function () {
    const st = G.state;
    return [(st.items || []).length, st.crystals || 0, IT.canFree() ? 1 : 0, Object.keys(st.relics || {}).length, st.adv.map((a) => a.equip || '').join(), st.pity || 0].join('|');
  };
  T.hasNews = () => IT.canFree() || (G.state.itemsNew || 0) > 0;

  // ---------------------------------------------------------------- シート
  T.render = function (body) {
    const st = G.state;
    st.itemsNew = 0;
    const now = G.now();
    const free = IT.canFree();
    const freeAt = (st.freeChestAt || 0) + IT.FREE_INTERVAL;
    const pityLeft = Math.max(1, IT.PITY - (st.pity || 0));
    const cry = st.crystals || 0;
    let h = `<div class="tr-gacha">
      <div class="tr-top"><span class="tr-cry">${CRY}<b>${G.fmt(cry)}</b><small>魔晶石</small></span><button class="link" id="trRates">提供割合</button></div>
      <div class="tr-stage"><img alt="" src="${chestImg(3, 132)}"></div>
      <h3>黄金の宝箱</h3>
      <p>装備品や秘宝が手に入ります。あと <b>${pityLeft}回</b> で SSR 以上が必ず出る</p>
      <div class="tr-btns">
        <button class="btn ${free ? 'go pulse' : 'ghost'}" id="trFree" ${free ? '' : 'disabled'}>${free ? '無料で開ける' : `無料まで<span data-countdown="${freeAt}">${G.fmtClock(freeAt - now)}</span>`}</button>
        <button class="btn primary ${cry < IT.CHEST_COST ? 'cant' : ''}" id="trOne">1回<span>${CRY}${IT.CHEST_COST}</span></button>
        <button class="btn primary ${cry < IT.CHEST5_COST ? 'cant' : ''}" id="trFive">5回<span>${CRY}${IT.CHEST5_COST}</span></button>
      </div>
      <small class="tr-how">魔晶石は大成功・伝説級の冒険譚、ランクアップ、目標の達成で手に入ります</small>
    </div>`;
    // 秘宝
    const owned = IT.RELICS.filter((r) => st.relics && st.relics[r.id]);
    h += `<div class="sec"><h3>秘宝 <small>${owned.length}/${IT.RELICS.length}</small><span class="h-right">ギルド全体に効く</span></h3><div class="relics">`;
    IT.RELICS.forEach((r) => {
      const own = st.relics && st.relics[r.id];
      const it = { kind: 'relic', rid: r.id, rarity: r.r, name: r.name };
      h += `<div class="relic ${own ? 'own' : 'unknown'} r${r.r}"><img alt="" src="${thumb(it, 48)}"><span><b>${own ? r.name : '？？？'}</b><small>${own ? r.desc : IT.RARITY[r.r].id + ' ・ どこかの宝箱に'}</small></span></div>`;
    });
    h += `</div></div>`;
    // 装備品
    const items = (st.items || []).slice().sort((a, b) => b.rarity - a.rarity || a.tid.localeCompare(b.tid));
    const dex = Object.keys(st.dex || {}).length;
    h += `<div class="sec"><h3>装備品 <small>${items.length}個</small><span class="h-right">図鑑 ${dex}/${IT.EQUIP_IDS.length * 5}</span></h3>`;
    if (!items.length) h += `<p class="empty">まだ装備品がありません。冒険譚の宝箱や、町の人からの贈り物で手に入ります。</p>`;
    else {
      h += `<div class="gear">`;
      items.forEach((it) => {
        const who = IT.equippedBy(it.uid);
        h += `<button class="gi r${it.rarity}" data-item="${it.uid}" aria-label="${G.esc(it.name)}"><img alt="" src="${thumb(it, 60)}">${who ? `<img class="gi-who" alt="" src="${art.portrait(who.look, 22)}">` : ''}<small>${G.esc(it.name)}</small></button>`;
      });
      h += `</div>`;
    }
    h += `</div>`;
    body.innerHTML = h;
    G.$('#trFree', body).addEventListener('click', () => open('free'));
    G.$('#trOne', body).addEventListener('click', () => open('one'));
    G.$('#trFive', body).addEventListener('click', () => open('five'));
    G.$('#trRates', body).addEventListener('click', showRates);
    G.$$('[data-item]', body).forEach((b) => b.addEventListener('click', () => T.showItem(b.dataset.item)));
  };

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
    G.ui.modal(`<div class="rates"><h2>提供割合</h2><h3 class="mini">魔晶石の宝箱</h3><ul>${row([40, 35, 18, 6, 1])}</ul><h3 class="mini">無料の宝箱</h3><ul>${row([62, 30, 7, 1, 0])}</ul><p class="hint">秘宝が出ることもあります。持っている秘宝が出たときは魔晶石になります。</p></div>`, [{ text: '閉じる', cls: 'primary' }]);
  }

  function open(kind) {
    G.audio.init();
    const st = G.state;
    const cost = kind === 'five' ? IT.CHEST5_COST : kind === 'one' ? IT.CHEST_COST : 0;
    if (kind !== 'free' && (st.crystals || 0) < cost) {
      G.audio.sfx('error');
      G.ui.toast(`魔晶石が足りません（あと ${cost - (st.crystals || 0)}）`, 'bad');
      return;
    }
    const got = IT.openChest(kind);
    if (!got) { G.audio.sfx('error'); return; }
    const res = got.map((item) => {
      const key = item.tid + ':' + item.rarity;
      const isNew = item.kind === 'relic' ? !(st.relics && st.relics[item.rid]) : !(st.dex && st.dex[key]);
      const r = IT.add(item);
      return { item, isNew, dup: r.dup, crystals: r.crystals || 0 };
    });
    G.sim.save();
    G.audio.sfx('open');
    T.chestShow(res, () => G.ui.renderSheet());
  }

  // ---------------------------------------------------------------- 装備品の詳細
  T.showItem = function (uid) {
    const st = G.state;
    const it = IT.get(uid);
    if (!it) return;
    G.audio.sfx('tap');
    const e = IT.EQUIP[it.tid];
    const R = IT.RARITY[it.rarity];
    const who = IT.equippedBy(uid);
    const fitName = e.cls ? D.CLASSES[e.cls].name : null;
    const advs = st.adv.slice().sort((a, b) => (fits(e, b) - fits(e, a)) || G.sim.power(b) - G.sim.power(a));
    const list = advs.map((a) => {
      const cur = a.equip ? IT.get(a.equip) : null;
      const fit = fits(e, a);
      return `<button class="pick ${a === who ? 'on' : ''}" data-eq="${a.id}"><img alt="" src="${art.portrait(a.look, 40)}"><span><b>${G.esc(a.name)}</b><small>${D.CLASSES[a.cls].name} Lv${a.lv} ・ ${cur ? '装備中：' + G.esc(cur.name) : '装備なし'}</small></span><em class="fit ${fit ? 'ok' : 'half'}">${fit ? '適性◎' : '効果半分'}</em></button>`;
    }).join('');
    const html = `<div class="item-detail r${it.rarity}"><div class="id-img"><img alt="" src="${thumb(it, 104)}"></div><small class="rar">${R.id} ${stars(it.rarity)}</small><h2>${G.esc(it.name)}</h2>
      <p class="sub">${TYPE_NAME[e.type]}${fitName ? ` ・ ${fitName}向け` : ' ・ だれでも'} ・ 戦力 +${Math.round(R.bonus * 100)}%</p>
      ${who ? `<p class="eq-now">いまは <b>${G.esc(who.name)}</b> が装備しています</p>` : ''}
      <h3 class="mini">装備させる冒険者</h3><div class="pick-list">${list}</div></div>`;
    const btns = [];
    if (!who) btns.push({ text: `売る（+${G.fmt(R.sell)}G）`, cls: 'ghost', fn: () => confirmSell(it) });
    else btns.push({ text: '外す', cls: 'ghost', fn: () => { IT.equip(who.id, null); G.ui.toast(`${who.name}は《${it.name}》を外した`, 'info'); G.ui.renderSheet(); } });
    btns.push({ text: '閉じる', cls: 'primary' });
    G.ui.modal(html, btns, {
      cls: 'wide',
      onShow: (card) => {
        G.$$('[data-eq]', card).forEach((b) => b.addEventListener('click', () => {
          const a = st.adv.find((x) => x.id === +b.dataset.eq);
          if (!a) return;
          IT.equip(a.id, uid);
          G.audio.sfx('upgrade');
          G.haptic(14);
          G.ui.toast(`${a.name}が《${it.name}》を装備した！${fits(e, a) ? '' : '（職業が合わないので効果半分）'}`, 'rare' + it.rarity);
          G.ui.closeModal();
          G.ui.renderSheet();
        }));
      },
    });
  };
  const fits = (e, a) => (!e.cls || e.cls === a.cls ? 1 : 0);

  function confirmSell(it) {
    G.ui.modal(`<div class="confirm"><h2>《${G.esc(it.name)}》を売りますか？</h2><p>${G.fmt(IT.RARITY[it.rarity].sell)}G になります。取り消せません。</p></div>`, [
      { text: 'やめる', cls: 'ghost' },
      { text: '売る', cls: 'danger', fn: () => { const g = IT.sell(it.uid); if (g) { G.audio.sfx('coins'); G.ui.toast(`《${it.name}》を ${G.fmt(g)}G で売りました`, 'good'); G.ui.refreshHud(); G.ui.renderSheet(); } } },
    ]);
  }

  // 冒険者の詳細から：装備を選ぶ
  T.pickFor = function (advId) {
    const st = G.state;
    const a = st.adv.find((x) => x.id === advId);
    if (!a) return;
    const items = (st.items || []).slice().sort((x, y) => {
      const fx = fits(IT.EQUIP[x.tid], a), fy = fits(IT.EQUIP[y.tid], a);
      return (fy - fx) || y.rarity - x.rarity;
    });
    if (!items.length) { G.ui.toast('装備品がありません。冒険譚の宝箱を開けてみましょう', 'info'); return; }
    const list = items.map((it) => {
      const who = IT.equippedBy(it.uid);
      const fit = fits(IT.EQUIP[it.tid], a);
      return `<button class="pick ${who === a ? 'on' : ''}" data-it="${it.uid}"><img alt="" src="${thumb(it, 40)}"><span><b>${G.esc(it.name)}</b><small>${IT.RARITY[it.rarity].id} ・ 戦力 +${Math.round(IT.RARITY[it.rarity].bonus * (fit ? 100 : 50))}%${who && who !== a ? ` ・ ${G.esc(who.name)}が装備中` : ''}</small></span><em class="fit ${fit ? 'ok' : 'half'}">${fit ? '◎' : '△'}</em></button>`;
    }).join('');
    G.ui.modal(`<div class="item-pick"><h2>${G.esc(a.name)}の装備</h2><div class="pick-list">${list}</div></div>`, [
      a.equip ? { text: '外す', cls: 'ghost', fn: () => { IT.equip(a.id, null); G.ui.renderSheet(); } } : null,
      { text: '閉じる', cls: 'primary' },
    ].filter(Boolean), {
      cls: 'wide',
      onShow: (card) => {
        G.$$('[data-it]', card).forEach((b) => b.addEventListener('click', () => {
          const it = IT.get(b.dataset.it);
          IT.equip(a.id, b.dataset.it);
          G.audio.sfx('upgrade');
          G.ui.toast(`${a.name}が《${it.name}》を装備した！`, 'rare' + it.rarity);
          G.ui.closeModal();
          G.ui.renderSheet();
        }));
      },
    });
  };

  // ---------------------------------------------------------------- 宝箱を開ける演出
  let fx = null, cv = null, ctx = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  T.chestShow = function (list, onDone) {
    const el = G.$('#chestFx');
    cv = G.$('#chestCanvas');
    ctx = cv.getContext('2d');
    el.hidden = false;
    el.querySelector('.cf-ui').innerHTML = '';
    resize();
    fx = { list, i: 0, t: 0, done: onDone, parts: [], fired: {} };
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
    box.innerHTML = `<div class="cf-sum"><h2>手に入れたもの</h2><div class="cf-grid">${fx.list.map((r) => `<div class="cf-it r${r.item.rarity}"><img alt="" src="${thumb(r.item, 64)}">${r.isNew ? '<i>NEW</i>' : ''}<small>${G.esc(r.item.name)}</small>${r.dup ? `<em>${CRY}+${r.crystals}</em>` : ''}</div>`).join('')}</div><button class="btn primary big" id="cfClose">宝物庫へ</button></div>`;
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
    // 音と粒
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
    // 光
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
    // 宝箱
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
    // 中身
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
      ctx.font = G.font(800, 22 * s, 'head');
      ctx.lineWidth = 5 * s;
      ctx.strokeText(it.name, cx, cy + 62 * s);
      ctx.fillStyle = '#fbf3de';
      ctx.fillText(it.name, cx, cy + 62 * s);
      ctx.font = G.font(700, 12 * s);
      ctx.fillStyle = 'rgba(246,236,210,0.8)';
      const sub = it.kind === 'relic' ? (r.dup ? `持っている秘宝 → 魔晶石 +${r.crystals}` : '秘宝 ・ ' + IT.RELIC[it.rid].desc) : `${TYPE_NAME[IT.EQUIP[it.tid].type]} ・ 戦力 +${Math.round(R.bonus * 100)}%`;
      ctx.fillText(sub, cx, cy + 84 * s);
      if (r.isNew) {
        ctx.font = G.font(900, 13 * s, 'num');
        ctx.fillStyle = '#ff7a6a';
        ctx.fillText('NEW!', cx + 70 * s, cy - 150 * s);
      }
      ctx.restore();
    }
    // 粒
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
    // 案内
    if (!fx.summary) {
      ctx.textAlign = 'center';
      ctx.font = G.font(700, 12);
      ctx.fillStyle = `rgba(246,236,210,${0.5 + 0.3 * Math.sin(now / 300)})`;
      const msg = t < fx.reveal ? 'タップでとばす' : fx.i < fx.list.length - 1 ? `タップで次へ（${fx.i + 1}/${fx.list.length}）` : 'タップで閉じる';
      ctx.fillText(msg, cx, H - 40);
    }
  }
})();
