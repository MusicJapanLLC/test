/* ギルドの灯 — ui: HUD・タブ・ボトムシート・モーダル・トースト・コイン演出・チュートリアル */
'use strict';
(function () {
  const U = (G.ui = {});
  const D = G.D;
  const S = G.sim;
  const art = G.art;

  // ---------------------------------------------------------------- icons (polygon SVG)
  const IC = {
    coin: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 16.4,3.6 19,10 16.4,16.4 10,19 3.6,16.4 1,10 3.6,3.6" fill="#f2b632"/><polygon points="10,1 16.4,3.6 10,10" fill="#ffd45a"/><polygon points="3.6,3.6 10,1 10,10 1,10" fill="#ffe08a"/><polygon points="10,5 13.5,6.5 15,10 13.5,13.5 10,15 6.5,13.5 5,10 6.5,6.5" fill="#ffd45a"/><rect x="9" y="7" width="2" height="6" fill="#d9952a"/></svg>',
    gem: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="2,13 6,7 18,7 14,13" fill="#e0a05a"/><polygon points="2,13 14,13 14,17 2,17" fill="#b06a32"/><polygon points="14,13 18,7 18,11 14,17" fill="#8a4e22"/><polygon points="6,7 18,7 16,9 7,9" fill="#ffd9a0"/></svg>',
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 12.6,7 19,7.4 14,11.6 15.6,18.6 10,15 4.4,18.6 6,11.6 1,7.4 7.4,7" fill="#ffcf4a"/><polygon points="10,1 12.6,7 10,10 7.4,7" fill="#ffe58f"/></svg>',
    quests: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5,3 17,3 19,6 19,21 7,21 5,18" fill="currentColor" opacity=".25"/><polygon points="5,3 17,3 17,18 5,18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 8h6M8.5 11.5h6M8.5 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polygon points="17,18 19,21 7,21 5,18" fill="currentColor"/></svg>',
    roster: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 19,6 19,13 12,22 5,13 5,6" fill="currentColor" opacity=".25"/><polygon points="12,2 19,6 19,13 12,22 5,13 5,6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 10.5h7M12 7v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    build: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="3,11 12,3 21,11 21,21 3,21" fill="currentColor" opacity=".25"/><polygon points="3,11 12,3 21,11 21,21 3,21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><polygon points="10,21 10,14 14,14 14,21" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,4 11,6 11,20 4,18" fill="currentColor" opacity=".25"/><polygon points="20,4 13,6 13,20 20,18" fill="currentColor" opacity=".25"/><polygon points="4,4 11,6 11,20 4,18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><polygon points="20,4 13,6 13,20 20,18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19" fill="currentColor"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 8,9 13,5 13,19 8,15 4,15" fill="currentColor"/><path d="M16 9c1.2 1.6 1.2 4.4 0 6M18.6 6.5c2.5 3 2.5 8 0 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 8,9 13,5 13,19 8,15 4,15" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,2 15.7,4.3 18,10 15.7,15.7 10,18 4.3,15.7 2,10 4.3,4.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4.5l3 2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    sword: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="14,2 18,2 18,6 9,15 5,11" fill="currentColor"/><polygon points="3,13 7,17 5,19 1,15" fill="currentColor"/></svg>',
    people: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="7,3 10,5 10,8 7,10 4,8 4,5" fill="currentColor"/><polygon points="1,18 3,12 11,12 13,18" fill="currentColor"/><polygon points="14,5 16.5,6.5 16.5,9 14,10.5 11.5,9 11.5,6.5" fill="currentColor" opacity=".7"/><polygon points="13,18 13.5,13 17,13 19,18" fill="currentColor" opacity=".7"/></svg>',
    heart: '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,18 1.5,9.5 2.5,4 6,2.5 10,6 14,2.5 17.5,4 18.5,9.5" fill="currentColor"/></svg>',
    treasure: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="3,11 21,11 21,21 3,21" fill="currentColor" opacity=".25"/><path d="M3 11h18v10H3zM3.5 11c0-4.5 3.5-7 8.5-7s8.5 2.5 8.5 7M3 15h7M14 15h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><polygon points="10,12 14,12 14,17 12,18.5 10,17" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 14.2,5.2 18,4.6 18.6,8.4 21.8,10.6 20,14 21.8,17.4 18.6,19.6 18,23.4 14.2,22.8 12,26 9.8,22.8 6,23.4 5.4,19.6 2.2,17.4 4,14 2.2,10.6 5.4,8.4 6,4.6 9.8,5.2" transform="scale(.92) translate(1,-1.4)" fill="currentColor" opacity=".9"/><circle cx="12" cy="12" r="3.6" fill="#0b1330"/></svg>',
  };
  U.IC = IC;

  // ---------------------------------------------------------------- init
  let sheetTab = null;
  let subView = null; // { kind:'dispatch', questId, picked:[] }
  const disp = { gold: 0, mat: 0 };
  let heldGold = 0;
  let hudTimer = 0;

  U.init = function () {
    G.$('#tab-quests .ti').innerHTML = IC.quests;
    G.$('#tab-roster .ti').innerHTML = IC.roster;
    G.$('#tab-reels .ti').innerHTML = IC.play;
    G.$('#tab-build .ti').innerHTML = IC.build;
    G.$('#tab-treasury .ti').innerHTML = IC.treasure;
    G.$('#menuBtn').innerHTML = IC.menu;
    G.$('#goldPill .ic').innerHTML = IC.coin;
    G.$('#matPill .ic').innerHTML = IC.gem;
    G.$('#reelGold .ic').innerHTML = IC.coin;
    G.$('#sheetClose').innerHTML = IC.close;
    G.$('#reelClose').innerHTML = IC.close;
    G.$('#commentsClose').innerHTML = IC.close;

    G.$$('#tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
      G.audio.init();
      const t = b.dataset.tab;
      G.haptic(6);
      if (t === 'reels') { U.closeSheet(true); G.reels.open(); return; }
      if (sheetTab === t && !subView) U.closeSheet();
      else U.openSheet(t);
    }));
    G.$('#sheetClose').addEventListener('click', () => U.closeSheet());
    G.$('#objChip').addEventListener('click', onObjective);
    G.$('#rankBtn').addEventListener('click', showRankInfo);
    G.$('#cryPill .ic').innerHTML = G.treasury.CRY;
    G.$('#cryPill').addEventListener('click', () => { G.audio.init(); G.treasury.open('shop'); });
    G.$('#boostChip').addEventListener('click', () => { G.audio.init(); G.treasury.open('bag'); });
    G.on('boost', () => { boostKey = ''; U.refreshHud(); });
    G.on('started', () => { if (G.state.flags.tut >= 90) setTimeout(() => G.treasury.checkDaily(), 900); });
    G.$('#missionBtn').addEventListener('click', () => { G.audio.init(); G.haptic(6); if (sheetTab === 'missions') U.closeSheet(); else U.openSheet('missions'); });
    G.$('#menuBtn').addEventListener('click', () => { G.audio.init(); G.haptic(6); if (sheetTab === 'records') U.closeSheet(); else U.openSheet('records'); });
    G.$('#expStrip').addEventListener('click', () => U.openSheet('quests'));
    setupSheetDrag();
    window.addEventListener('resize', layoutPads);
    setTimeout(layoutPads, 50);
    U.fx.init();

    disp.gold = G.state.gold;
    disp.mat = G.state.mat;

    G.on('dispatch', () => { if (sheetTab) renderSheet(); });
    G.on('resolved', () => {
      if (!G.scene.ready) return;
      bumpTab('reels');
      if (sheetTab) renderSheet();
    });
    G.on('hired', (a) => {
      U.toast(`${a.name}（${D.CLASSES[a.cls].name}）が仲間になった！`, 'good');
      G.audio.sfx('claim');
      if (sheetTab) renderSheet();
    });
    G.on('built', (id) => {
      G.audio.sfx('built');
      G.haptic(30);
      if (id === 'tavern') setTimeout(() => U.toast('お客さんが飲み終わると、テーブルにチップが置かれます', 'info'), 1800);
      if (sheetTab) renderSheet();
    });
    G.on('upgraded', () => { if (sheetTab) renderSheet(); });
    G.on('abyssOpen', () => {
      U.whenFree(() => U.modal(`<div class="skill-get abyss-open"><div class="ao-gate"></div><small>ランク${D.ABYSS.rank}の特典</small><h2>深淵の迷宮</h2><p>ギルドの地下に、古い扉が見つかりました。<br>B1F〜B100F。10階ごとに守護者が待ち、深いほど強い装備が眠っています。</p><p class="hint">依頼の画面から挑めます（派遣枠とは別に、1組まで）</p></div>`, [{ text: 'のぞいてみる', cls: 'primary big', fn: () => U.openSheet('quests') }], { cls: 'celebrate' }), 1200);
    });
    G.on('rankup', (r) => {
      if (G.reels.isOpen()) pendingRank = Math.max(pendingRank, r);
      else showRankUp(r);
    });
    G.on('reelsClosed', () => {
      if (pendingRank) { const r = pendingRank; pendingRank = 0; setTimeout(() => showRankUp(r), 380); }
      if (sheetTab) renderSheet();
    });
    U.refreshHud(true);
  };
  let pendingRank = 0;
  // ほかの窓（ランクアップ・冒険譚・チュートリアル）が閉じてから出す
  U.whenFree = function (fn, delay = 600) {
    const go = () => {
      const busy = !G.$('#modal').hidden || G.reels.isOpen() || pendingRank || (G.state.flags.tut < 99 && G.state.flags.tut > 0 && G.$('#tut') && !G.$('#tut').hidden);
      if (busy) { setTimeout(go, 700); return; }
      fn();
    };
    setTimeout(go, delay);
  };

  function layoutPads() {
    const hud = G.$('#hud').getBoundingClientRect();
    const tabs = G.$('#tabs').getBoundingClientRect();
    G.scene.setPads(hud.bottom + 4, window.innerHeight - tabs.top + 6);
    G.$('#toasts').style.top = hud.bottom + 10 + 'px';
  }

  // ---------------------------------------------------------------- HUD
  U.refreshHud = function (instant) {
    const st = G.state;
    if (instant) { disp.gold = st.gold - heldGold; disp.mat = st.mat; }
    G.$('#rankNum').textContent = st.rank;
    G.$('#rankTitle').textContent = D.RANK_TITLES[st.rank - 1];
    const lo = D.RANK_FAME[st.rank - 1], hi = D.RANK_FAME[st.rank];
    const fk = hi ? G.clamp((st.fame - lo) / (hi - lo), 0, 1) : 1;
    G.$('#fameFill').style.width = fk * 100 + '%';
    G.$('#fameText').textContent = hi ? `名声 ${G.fmt(st.fame)} / ${G.fmt(hi)}` : `名声 ${G.fmt(st.fame)}`;
    // 目標
    const ob = S.objective();
    const chip = G.$('#objChip');
    if (ob) {
      chip.hidden = false;
      G.$('#objText').textContent = ob.o.text;
      G.$('#objCount').textContent = ob.done ? '受け取る' : `${G.fmt(ob.cur)}/${G.fmt(ob.goal)}`;
      G.$('#objFill').style.width = (ob.cur / ob.goal) * 100 + '%';
      chip.classList.toggle('done', ob.done);
    } else chip.hidden = true;
    // 遠征ストリップ
    const had = G.$('#expStrip').children.length;
    renderExpStrip();
    if (had !== G.$('#expStrip').children.length) layoutPads();
    // タブのバッジ
    const unseen = G.reels.unseen();
    const rb = G.$('#tab-reels .badge');
    rb.hidden = !unseen.length;
    rb.textContent = unseen.length > 99 ? '99+' : unseen.length;
    const pg = G.reels.pendingGold();
    const sub = G.$('#reelSub');
    sub.textContent = unseen.length ? `+${G.fmt(pg)}G` : '冒険譚';
    G.$('#tab-reels').classList.toggle('has', unseen.length > 0);
    const idle = st.adv.filter((a) => a.status === 'idle').length;
    const free = S.slots() - S.busy();
    setDot('quests', idle > 0 && free > 0 && st.board.length > 0);
    setDot('roster', st.cands.some((c) => c.free) || (st.adv.length < S.beds() && st.cands.some((c) => st.gold >= (c.free ? 0 : S.hireCost(c.lv)))));
    setDot('treasury', G.treasury.hasNews());
    setDot('build', D.FACILITIES.some((f) => {
      const s2 = S.facState(f.id);
      return (s2 === 'buildable' || s2 === 'upgradable') && S.canAfford(S.facCost(f.id));
    }));
  };
  function setDot(tab, on) {
    G.$(`#tab-${tab} .dot`).hidden = !on;
  }
  function bumpTab(tab) {
    const el = G.$(`#tab-${tab}`);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function renderExpStrip() {
    const st = G.state;
    const box = G.$('#expStrip');
    const now = G.now();
    const key = st.active.map((e) => e.q.id).join(',');
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.innerHTML = '';
      st.active.slice().sort((a, b) => a.endAt - b.endAt).forEach((ex) => {
        const adv = st.adv.find((a) => a.id === ex.party[0]);
        const el = G.el('div', 'exp');
        el.dataset.id = ex.q.id;
        el.innerHTML = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="track"/><circle cx="18" cy="18" r="16" class="ring" pathLength="100"/></svg>${adv ? `<img alt="" src="${art.portrait(adv.look, 32)}">` : ''}<span class="t"></span>`;
        box.appendChild(el);
      });
    }
    G.$$('.exp', box).forEach((el) => {
      const ex = st.active.find((e) => e.q.id === el.dataset.id);
      if (!ex) return;
      const k = G.clamp((now - ex.startAt) / (ex.endAt - ex.startAt), 0, 1);
      el.querySelector('.ring').style.strokeDasharray = `${k * 100} 100`;
      el.querySelector('.t').textContent = G.fmtClock(ex.endAt - now);
    });
  }

  U.tick = function (dt) {
    const st = G.state;
    // 数字のアニメ
    const tg = st.gold - heldGold;
    const dg = tg - disp.gold;
    disp.gold = Math.abs(dg) < 1 ? tg : disp.gold + dg * Math.min(1, dt * 9);
    disp.mat = st.mat;
    G.$('#goldVal').textContent = G.fmt(disp.gold);
    G.$('#matVal').textContent = G.fmt(disp.mat);
    G.$('#cryVal').textContent = G.fmt(st.crystals || 0);
    tickBoosts();
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.25;
      U.refreshHud();
      if (sheetTab) tickSheet();
    }
    U.fx.update(dt);
    tutTick(dt);
    if (popAgent) positionPop();
  };

  // ブースト（倍速など）の残り時間
  let boostKey = '';
  function tickBoosts() {
    const chip = G.$('#boostChip');
    const act = ['speed', 'gold', 'luck'].map((k) => [k, G.items.boost(k)]).filter((x) => x[1]);
    const key = act.map((x) => x[0] + x[1].mult).join();
    if (key !== boostKey) {
      boostKey = key;
      chip.hidden = !act.length;
      chip.innerHTML = act.map(([k, b]) => `<span class="bc ${k}"><i>${k === 'speed' ? `${b.mult}倍速` : k === 'gold' ? 'G×2' : '幸運'}</i><b data-bt="${k}"></b></span>`).join('');
      document.documentElement.classList.toggle('fast', act.some((x) => x[0] === 'speed'));
      if (sheetTab) layoutPads();
      setTimeout(layoutPads, 30);
    }
    act.forEach(([k, b]) => { const el = chip.querySelector(`[data-bt="${k}"]`); if (el) el.textContent = G.fmtClock(b.until - G.now()); });
  }

  function onObjective() {
    G.audio.init();
    const ob = S.objective();
    if (!ob) return;
    if (!ob.done) {
      G.audio.sfx('soft');
      U.toast(`目標：${ob.o.text}（${G.fmt(ob.cur)}/${G.fmt(ob.goal)}）`, 'info');
      return;
    }
    const r = S.claimObjective();
    const rect = G.$('#objChip').getBoundingClientRect();
    if (r.gold) U.flyCoins(rect.left + rect.width / 2, rect.top + rect.height / 2, r.gold, true);
    if (r.mat) U.flyGems(rect.left + rect.width / 2, rect.top + rect.height / 2, r.mat);
    G.audio.sfx('claim');
    G.haptic(16);
    const chip = G.$('#objChip');
    chip.classList.remove('pop');
    void chip.offsetWidth;
    chip.classList.add('pop');
    U.toast(`目標達成！ ${r.gold ? '+' + G.fmt(r.gold) + 'G ' : ''}${r.mat ? '+' + r.mat + '素材' : ''}`, 'good');
    U.refreshHud();
  }

  function toggleSound() {
    G.audio.init();
    const st = G.state.settings;
    if (st.bgm > 0 || st.sfx > 0) {
      st._bgm = st.bgm; st._sfx = st.sfx;
      st.bgm = 0; st.sfx = 0;
    } else {
      st.bgm = st._bgm || 0.6; st.sfx = st._sfx || 0.8;
    }
    G.audio.applyVolumes();
    G.audio.setAmbient(G.state.fac.tavern > 0 ? 1 : 0);
    syncSoundBtn();
  }
  function syncSoundBtn() {
    const b = G.$('#muteBtn');
    if (!b) return;
    const st = G.state.settings;
    const on = st.bgm > 0 || st.sfx > 0;
    b.innerHTML = (on ? IC.sound : IC.mute) + `<span>${on ? '音を消す' : '音を出す'}</span>`;
  }
  U.toggleSound = toggleSound;
  U.syncSoundBtn = syncSoundBtn;

  // ---------------------------------------------------------------- sheet
  U.sheetOpen = () => !!sheetTab;
  U.openSheet = function (tab, opts = {}) {
    const sh = G.$('#sheet');
    const was = sheetTab;
    sheetTab = tab;
    subView = null;
    G.$$('#tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    renderSheet();
    if (!was) {
      sh.hidden = false;
      requestAnimationFrame(() => sh.classList.add('shown'));
      G.audio.sfx('open');
      G.audio.setMuffle(true);
    } else G.audio.sfx('soft');
    G.$('#sheetBody').scrollTop = 0;
    if (opts.focus) setTimeout(() => {
      const el = G.$(`[data-fac="${opts.focus}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); }
    }, 60);
    hidePop();
    G.emit('sheet', tab);
  };
  U.closeSheet = function (silent) {
    if (!sheetTab) return;
    sheetTab = null;
    subView = null;
    const sh = G.$('#sheet');
    sh.classList.remove('shown');
    sh.style.transform = '';
    setTimeout(() => { if (!sheetTab) sh.hidden = true; }, 340);
    G.$$('#tabs [data-tab]').forEach((b) => b.classList.remove('active'));
    if (!silent) G.audio.sfx('close');
    G.audio.setMuffle(false);
    G.emit('sheet', null);
  };
  U.sheetTab = () => sheetTab;
  U.subView = () => subView;

  function setupSheetDrag() {
    const sh = G.$('#sheet');
    const grab = G.$('#sheetHead');
    let d = null;
    grab.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      d = { y: e.clientY, dy: 0 };
      grab.setPointerCapture(e.pointerId);
      sh.style.transition = 'none';
    });
    grab.addEventListener('pointermove', (e) => {
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y);
      sh.style.transform = `translateY(${d.dy}px)`;
    });
    const end = () => {
      if (!d) return;
      sh.style.transition = '';
      if (d.dy > 90) U.closeSheet();
      else sh.style.transform = '';
      d = null;
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  function renderSheet() {
    const body = G.$('#sheetBody');
    const title = G.$('#sheetTitle');
    const back = G.$('#sheetBack');
    back.hidden = !subView;
    back.onclick = () => { subView = null; G.audio.sfx('soft'); renderSheet(); };
    back.innerHTML = IC.back;
    if (subView && subView.kind === 'dispatch') { title.textContent = '派遣するメンバー'; renderDispatch(body); return; }
    const titles = { quests: '依頼', roster: '冒険者', build: '施設', records: '記録と設定', treasury: '宝物庫', inbox: 'お知らせ', missions: '任務' };
    title.textContent = titles[sheetTab] || '';
    if (sheetTab === 'treasury') { G.treasury.render(body); U._sig = sheetSig(); return; }
    if (sheetTab === 'inbox') { G.notify.render(body); U._sig = sheetSig(); return; }
    if (sheetTab === 'missions') { G.missions.render(body); U._sig = sheetSig(); return; }
    if (sheetTab === 'quests') renderQuests(body);
    else if (sheetTab === 'roster') renderRoster(body);
    else if (sheetTab === 'build') renderBuild(body);
    else if (sheetTab === 'records') renderRecords(body);
  }
  U.renderSheet = () => { if (sheetTab) renderSheet(); };

  // 1秒ごとの軽い更新（タイマー・進捗）
  function tickSheet() {
    const now = G.now();
    G.$$('#sheetBody [data-countdown]').forEach((el) => { el.textContent = G.fmtClock(+el.dataset.countdown - now); });
    G.$$('#sheetBody [data-progress]').forEach((el) => {
      const [a, b] = el.dataset.progress.split(',').map(Number);
      el.style.width = G.clamp((now - a) / (b - a), 0, 1) * 100 + '%';
    });
    // 状態が変わったら描き直す
    const sig = sheetSig();
    if (!subView && U._sig !== sig) renderSheet();
    else refreshAfford();
  }
  // シートの中身が変わる出来事だけを拾う（お金の増減では描き直さない）
  function sheetSig() {
    const st = G.state;
    return [sheetTab, sheetTab === 'treasury' ? G.treasury.sig() : sheetTab === 'inbox' ? G.notify.sig() : sheetTab === 'missions' ? G.missions.sig() : '', st.rank, st.board.map((q) => q.id).join(), st.active.length, st.abyss ? st.abyss.floor + ':' + st.abyss.best : '', st.adv.map((a) => a.id + a.status + a.lv).join(), st.cands.map((c) => c.id).join(), st.building ? st.building.id : '', JSON.stringify(st.fac), st.refreshAt > G.now() ? 1 : 0, st.flags.autoDispatch].join('|');
  }
  function refreshAfford() {
    const st = G.state;
    G.$$('#sheetBody [data-cost-gold]').forEach((b) => {
      const ok = st.gold >= +b.dataset.costGold && st.mat >= +(b.dataset.costMat || 0);
      b.classList.toggle('cant', !ok);
    });
  }

  // ---------------------------------------------------------------- quests
  function rewardRow(q) {
    return `<span class="rw">${IC.coin}<b>${G.fmt(q.gold)}</b></span>${q.mat ? `<span class="rw">${IC.gem}<b>${q.mat}</b></span>` : ''}<span class="rw">${IC.star}<b>${q.fame}</b></span>`;
  }
  function stars(n) {
    return '<span class="stars">' + '★'.repeat(Math.min(5, n)) + '<i>' + '★'.repeat(Math.max(0, 5 - n)) + '</i></span>';
  }
  function renderQuests(body) {
    const st = G.state;
    const now = G.now();
    const slots = S.slots();
    let h = '';
    if (st.rank >= 5) {
      h += `<label class="auto ${st.flags.autoDispatch ? 'on' : ''}"><span><b>受付嬢におまかせ</b><small>待機中の冒険者を、リナが自動で派遣します</small></span><input type="checkbox" id="autoToggle" ${st.flags.autoDispatch ? 'checked' : ''}><i class="sw"></i></label>`;
    }
    const busy = S.busy();
    h += `<div class="sec"><h3>遠征中 <small>${busy}/${slots}</small></h3>`;
    if (!busy) h += `<p class="empty">いまは誰も出かけていません</p>`;
    st.active.filter((e) => !e.abyss).sort((a, b) => a.endAt - b.endAt).forEach((ex) => {
      const party = ex.party.map((id) => st.adv.find((a) => a.id === id)).filter(Boolean);
      const area = D.AREA_BY_ID[ex.q.area];
      h += `<div class="card act" style="--area:${area.pal.mid}"><div class="faces">${party.map((a) => `<img alt="" src="${art.portrait(a.look, 40)}">`).join('')}</div><div class="grow"><b>${G.esc(ex.q.name)}</b><div class="bar"><i data-progress="${ex.startAt},${ex.endAt}"></i></div><small>成功率 ${Math.round(ex.p * 100)}% ・ 結果は冒険譚で</small></div><span class="time" data-countdown="${ex.endAt}">${G.fmtClock(ex.endAt - now)}</span></div>`;
    });
    for (let i = busy; i < slots; i++) h += `<div class="card slot">空き枠</div>`;
    if (slots < D.FAC.hall.maxLv) h += `<button class="link" data-goto-fac="hall">受付ホールを強化すると、同時派遣が増えます</button>`;
    h += `</div>`;
    h += abyssSection(st, now);
    const nextAt = st.boardAt + S.BOARD_INTERVAL;
    const full = st.board.length >= S.boardSize();
    h += `<div class="sec"><h3>依頼掲示板 <small>${st.board.length}/${S.boardSize()}</small><span class="h-right">${full ? '' : `次の依頼 <b data-countdown="${nextAt}">${G.fmtClock(nextAt - now)}</b>`}</span></h3>`;
    const idle = st.adv.filter((a) => a.status === 'idle');
    st.board.forEach((q, qi) => {
      const area = D.AREA_BY_ID[q.area];
      const pick = S.bestParty(q, idle, 'max');
      const info = pick.length ? S.partyInfo(q, pick) : null;
      const p = info ? info.p : 0;
      const pc = p >= 0.8 ? 'good' : p >= 0.5 ? 'mid' : 'bad';
      let btn;
      if (busy >= slots) btn = `<button class="btn sm" disabled>枠なし</button>`;
      else if (!idle.length) btn = `<button class="btn sm" disabled>全員外出中</button>`;
      else btn = `<button class="btn sm go" data-dispatch="${q.id}">派遣</button>`;
      h += `<div class="card quest ${q.boss ? 'boss' : ''}" style="--area:${area.pal.mid}" data-qi="${qi}">
        <img class="mon" alt="" src="${U.monsterThumb(q.monster, 52)}">
        <div class="grow">
          <div class="q-top"><span class="area">${area.short}</span>${stars(q.stars)}</div>
          <b class="q-name">${G.esc(q.name)}</b>
          <div class="q-meta"><span>${IC.sword}必要戦力 ${G.fmt(q.req)}</span><span>${IC.people}${q.size}人まで</span><span>${IC.clock}${G.fmtTime(q.dur)}</span></div>
          <div class="q-rw">${rewardRow(q)}</div>
        </div>
        <div class="q-go"><span class="pct ${pc}">${info ? Math.round(p * 100) + '%' : '—'}</span>${btn}</div>
      </div>`;
    });
    if (!st.board.length) h += `<p class="empty">新しい依頼が届くのを待っています…</p>`;
    const cd = st.refreshAt - now;
    if (st.flags.tut < 10) h += '';
    else h += `<button class="btn ghost wide" id="refreshBoard" ${cd > 0 ? 'disabled' : ''}>${cd > 0 ? `入れ替えまで <span data-countdown="${st.refreshAt}">${G.fmtClock(cd)}</span>` : '依頼を入れ替える'}</button>`;
    h += `</div>`;
    body.innerHTML = h;
    G.$$('[data-dispatch]', body).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      openDispatch(b.dataset.dispatch);
    }));
    G.$$('.card.quest', body).forEach((c) => c.addEventListener('click', () => {
      const b = c.querySelector('[data-dispatch]');
      if (b) openDispatch(b.dataset.dispatch);
    }));
    G.$$('[data-abyss]', body).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openDispatch(b.dataset.abyss); }));
    bindGotoFac(body);
    const rb = G.$('#refreshBoard', body);
    if (rb) rb.addEventListener('click', () => {
      if (st.refreshAt > G.now()) return;
      st.board = st.board.filter((q) => q.boss);
      while (st.board.length < S.boardSize()) st.board.push(S.genQuest());
      st.refreshAt = G.now() + 90;
      G.audio.sfx('whoosh');
      renderSheet();
    });
    const at = G.$('#autoToggle', body);
    if (at) at.addEventListener('change', () => {
      st.flags.autoDispatch = at.checked;
      G.audio.sfx(at.checked ? 'claim' : 'soft');
      if (at.checked) { const n = S.autoDispatch(G.now()); if (n) U.toast(`リナが ${n} 組を派遣しました`, 'good'); }
      renderSheet();
    });
    U._sig = sheetSig();
  }

  // 深淵の迷宮：掲示板の下に、次の階と最深記録
  function abyssSection(st, now) {
    const ab = S.abyss();
    if (!ab.open) {
      if (st.rank < 4) return '';
      return `<div class="sec"><h3>深淵の迷宮</h3><div class="card abyss locked"><div class="ab-depth"><small>封印</small><b>?</b></div><div class="grow"><b>ランク${D.ABYSS.rank}で扉が開きます</b><small>B1F〜B100F。深いほど強い装備が眠る、終わりのない迷宮</small></div></div></div>`;
    }
    const act = S.abyssActive();
    let h = `<div class="sec"><h3>深淵の迷宮 <small>最深 B${ab.best}F</small><span class="h-right">${ab.floor > S.ABYSS_MAX ? '踏破！' : `守護者まで あと${10 - ((ab.floor - 1) % 10)}階`}</span></h3>`;
    if (act) {
      const party = act.party.map((id) => st.adv.find((a) => a.id === id)).filter(Boolean);
      h += `<div class="card act abyss-act" style="--area:#5a3a9a"><div class="faces">${party.map((a) => `<img alt="" src="${art.portrait(a.look, 40)}">`).join('')}</div><div class="grow"><b>${G.esc(act.q.name)}</b><div class="bar"><i data-progress="${act.startAt},${act.endAt}"></i></div><small>成功率 ${Math.round(act.p * 100)}% ・ 迷宮枠（派遣枠とは別）</small></div><span class="time" data-countdown="${act.endAt}">${G.fmtClock(act.endAt - now)}</span></div>`;
    } else {
      const q = S.abyssNext(false);
      const idle = st.adv.filter((a) => a.status === 'idle');
      const pick = S.bestParty(q, idle, 'max');
      const p = pick.length ? S.partyInfo(q, pick).p : 0;
      const pc = p >= 0.8 ? 'good' : p >= 0.5 ? 'mid' : 'bad';
      h += `<div class="card abyss ${q.guardian ? 'guard' : ''}" data-abyss="abyss">
        <div class="ab-depth"><small>${q.farm ? '最深' : '次の階'}</small><b>B${q.abyss}F</b>${q.guardian ? '<i>守護者</i>' : ''}</div>
        <div class="grow"><b class="q-name">${G.esc(q.name)}</b>
          <div class="q-meta"><span>${IC.sword}必要戦力 ${G.fmt(q.req)}</span><span>${IC.clock}${G.fmtTime(q.dur)}</span></div>
          <div class="q-rw">${rewardRow(q)}<span class="rw ilv">装備Lv${S.abyssIlv(q.abyss)}</span>${q.guardian ? '<span class="rw shard">虹の欠片</span>' : ''}</div></div>
        <div class="q-go"><span class="pct ${pc}">${pick.length ? Math.round(p * 100) + '%' : '—'}</span><button class="btn sm go" data-abyss="abyss" ${idle.length ? '' : 'disabled'}>挑む</button></div></div>`;
      if (ab.best >= 1 && ab.floor <= S.ABYSS_MAX) h += `<button class="link" data-abyss="abyss-farm">B${Math.min(ab.best, S.ABYSS_MAX)}F で稼ぐ（記録は進まないが、装備集めに）</button>`;
    }
    return h + '</div>';
  }
  const questOf = (qid) => (qid === 'abyss' ? S.abyssNext(false) : qid === 'abyss-farm' ? S.abyssNext(true) : G.state.board.find((x) => x.id === qid));
  function openDispatch(qid) {
    const st = G.state;
    const q = questOf(qid);
    if (!q) return;
    const idle = st.adv.filter((a) => a.status === 'idle');
    subView = { kind: 'dispatch', questId: qid, picked: S.bestParty(q, idle, 'max').map((a) => a.id) };
    G.audio.sfx('tap');
    renderSheet();
    G.$('#sheetBody').scrollTop = 0;
    G.emit('dispatchOpen');
  }
  function renderDispatch(body) {
    const st = G.state;
    const q = questOf(subView.questId);
    const isAbyss = !!(q && q.abyss);
    if (isAbyss && S.abyssActive()) { subView = null; renderSheet(); return; }
    if (!q) { subView = null; renderSheet(); return; }
    const area = D.AREA_BY_ID[q.area];
    const picked = subView.picked.map((id) => st.adv.find((a) => a.id === id)).filter((a) => a && a.status === 'idle');
    subView.picked = picked.map((a) => a.id);
    const info = S.partyInfo(q, picked);
    const p = picked.length ? info.p : 0;
    const pc = p >= 0.8 ? 'good' : p >= 0.5 ? 'mid' : 'bad';
    const idle = st.adv.filter((a) => a.status === 'idle').sort((a, b) => S.power(b) - S.power(a));
    const perks = [];
    if (picked.some((a) => a.cls === 'cleric')) perks.push('僧侶 成功率+8%');
    if (picked.some((a) => a.cls === 'thief')) perks.push('盗賊 ゴールド+15%');
    if (picked.some((a) => a.cls === 'archer')) perks.push('弓使い 時間-10%');
    if (picked.some((a) => a.cls === 'warrior')) perks.push('戦士 失敗でも半分');
    let h = `<div class="dp-head" style="--area:${area.pal.mid}">
      <img class="mon big" alt="" src="${U.monsterThumb(q.monster, 84)}">
      <div class="grow"><span class="area">${area.name}</span><b class="q-name">${G.esc(q.name)}</b><div class="q-meta"><span>${IC.sword}必要戦力 ${G.fmt(q.req)}</span><span>${IC.people}${q.size}人まで</span></div><div class="q-rw">${rewardRow(q)}</div></div>
    </div>
    <div class="meter ${pc}">
      <div class="m-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="track"/><circle cx="40" cy="40" r="34" class="ring" pathLength="100" style="stroke-dasharray:${p * 100} 100"/></svg><span><b>${Math.round(p * 100)}</b>%</span></div>
      <div class="grow"><b>${p >= 0.9 ? 'まず大丈夫！' : p >= 0.7 ? 'いけそう' : p >= 0.45 ? '五分五分…' : picked.length ? 'かなり危険' : 'メンバーを選んでください'}</b>
        <small>パーティ戦力 ${G.fmt(info.pow)} ／ 必要 ${G.fmt(q.req)}</small>
        <small>${IC.clock} かかる時間 ${G.fmtTime(info.dur)}</small>
        ${perks.length ? `<div class="perks">${perks.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="slots">`;
    for (let i = 0; i < q.size; i++) {
      const a = picked[i];
      h += a ? `<button class="pslot on" data-unpick="${a.id}"><img alt="" src="${art.portrait(a.look, 48)}"><small>${G.esc(a.name)}</small></button>` : `<div class="pslot">空き</div>`;
    }
    h += `</div><h3 class="mini">待機中の冒険者 <small>タップで編成</small></h3><div class="pick-list">`;
    idle.forEach((a) => {
      const on = subView.picked.includes(a.id);
      h += `<button class="pick ${on ? 'on' : ''}" data-pick="${a.id}"><img alt="" src="${art.portrait(a.look, 40)}"><span><b>${G.esc(a.name)}</b><small>${D.CLASSES[a.cls].name} Lv${a.lv} ・ ${D.TRAITS[a.trait].name}</small></span><em>${G.fmt(S.power(a))}</em></button>`;
    });
    if (!idle.length) h += `<p class="empty">待機中の冒険者がいません</p>`;
    h += `</div><div class="dp-actions"><button class="btn ghost" id="dpAuto">おまかせ</button><button class="btn primary big" id="dpGo" ${picked.length ? '' : 'disabled'}>出発！</button></div>`;
    body.innerHTML = h;
    G.$$('[data-pick]', body).forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.pick;
      const i = subView.picked.indexOf(id);
      if (i >= 0) subView.picked.splice(i, 1);
      else {
        if (subView.picked.length >= q.size) subView.picked.shift();
        subView.picked.push(id);
      }
      G.audio.sfx('tap');
      G.haptic(5);
      renderSheet();
    }));
    G.$$('[data-unpick]', body).forEach((b) => b.addEventListener('click', () => {
      subView.picked = subView.picked.filter((x) => x !== +b.dataset.unpick);
      G.audio.sfx('soft');
      renderSheet();
    }));
    G.$('#dpAuto', body).addEventListener('click', () => {
      subView.picked = S.bestParty(q, st.adv.filter((a) => a.status === 'idle'), 'max').map((a) => a.id);
      G.audio.sfx('tap');
      renderSheet();
    });
    G.$('#dpGo', body).addEventListener('click', () => {
      const ex = isAbyss ? S.dispatchAbyss(subView.picked, q.farm) : S.dispatch(q.id, subView.picked);
      if (!ex) { G.audio.sfx('error'); return; }
      G.audio.sfx('depart');
      G.haptic(14);
      U.toast(`「${q.name}」へ出発！ 帰還まで ${G.fmtTime(ex.endAt - ex.startAt)}`, 'go');
      subView = null;
      // 次の派遣ができなければ閉じてギルドを眺めてもらう
      const canMore = S.busy() < S.slots() && st.adv.some((a) => a.status === 'idle') && st.board.length;
      if (canMore) renderSheet();
      else U.closeSheet(true);
    });
  }

  // ---------------------------------------------------------------- roster
  function renderRoster(body) {
    const st = G.state;
    const now = G.now();
    const beds = S.beds();
    let h = `<div class="sec"><h3>ギルドの仲間 <small>ベッド ${st.adv.length}/${beds}</small>${st.adv.length >= beds && st.fac.bunks < D.FAC.bunks.maxLv ? '<button class="link inline" data-goto-fac="bunks">宿舎を強化</button>' : ''}</h3>`;
    st.adv.slice().sort((a, b) => b.lv - a.lv).forEach((a) => {
      const need = S.expNeed(a.lv);
      const ex = st.active.find((e) => e.party.includes(a.id));
      const status = ex ? `<span class="st away">遠征中 <b data-countdown="${ex.endAt}">${G.fmtClock(ex.endAt - now)}</b></span>` : `<span class="st idle">待機中</span>`;
      const hearts = Math.floor(a.bond);
      h += `<div class="card adv" data-adv="${a.id}">
        <img class="face" alt="" src="${art.portrait(a.look, 56)}" style="--cls:${D.CLASSES[a.cls].color}">
        <div class="grow">
          <div class="a-top"><b>${G.esc(a.name)}</b><span class="cls" style="--cls:${D.CLASSES[a.cls].color}">${D.CLASSES[a.cls].name}</span><span class="lv">Lv${a.lv}</span></div>
          <div class="bar exp"><i style="width:${(a.exp / need) * 100}%"></i></div>
          <div class="a-meta"><span>${IC.sword}${G.fmt(S.power(a))}</span><span class="trait">${D.TRAITS[a.trait].name}</span>${G.items.equipped(a).map((it) => `<img class="eq-mini" alt="" src="${U.itemThumb(it, 18)}">`).join('')}${(a.skillSet || []).length ? `<span class="sk">技${a.skillSet.length}</span>` : ''}<span class="bond" title="絆">${'♥'.repeat(Math.min(5, Math.ceil(hearts / 2)))}<i>${'♥'.repeat(Math.max(0, 5 - Math.ceil(hearts / 2)))}</i></span></div>
        </div>
        ${status}
      </div>`;
    });
    h += `</div>`;
    const nextC = st.candAt + S.CAND_INTERVAL;
    h += `<div class="sec"><h3>求職者 <span class="h-right">入れ替わりまで <b data-countdown="${nextC}">${G.fmtClock(nextC - now)}</b></span></h3>`;
    st.cands.forEach((c) => {
      const price = c.free ? 0 : S.hireCost(c.lv);
      const bedsFull = st.adv.length >= beds;
      h += `<div class="card cand ${c.free ? 'free' : ''}">
        <img class="face" alt="" src="${art.portrait(c.look, 56)}" style="--cls:${D.CLASSES[c.cls].color}">
        <div class="grow">
          <div class="a-top"><b>${G.esc(c.name)}</b><span class="cls" style="--cls:${D.CLASSES[c.cls].color}">${D.CLASSES[c.cls].name}</span><span class="lv">Lv${c.lv}</span></div>
          <div class="a-meta"><span>${IC.sword}${G.fmt(S.power(c))}</span><span class="trait">${D.TRAITS[c.trait].name}</span></div>
          <small class="perk">${D.CLASSES[c.cls].perk} ／ ${D.TRAITS[c.trait].desc}</small>
        </div>
        <button class="btn sm hire ${bedsFull ? '' : st.gold < price ? 'cant' : ''}" data-hire="${c.id}" data-cost-gold="${price}" ${bedsFull ? 'disabled' : ''}>${bedsFull ? 'ベッド不足' : c.free ? '仲間にする' : `雇う<span>${IC.coin}${G.fmt(price)}</span>`}</button>
      </div>`;
    });
    h += `</div>`;
    body.innerHTML = h;
    G.$$('[data-hire]', body).forEach((b) => b.addEventListener('click', () => {
      const r = S.hire(+b.dataset.hire);
      if (!r.ok) {
        G.audio.sfx('error');
        U.toast(r.why === 'gold' ? 'ゴールドが足りません' : r.why === 'beds' ? 'ベッドが足りません。宿舎を強化しましょう' : '雇えませんでした', 'bad');
        return;
      }
      G.haptic(14);
      renderSheet();
    }));
    G.$$('[data-adv]', body).forEach((c) => c.addEventListener('click', () => showAdvDetail(+c.dataset.adv)));
    bindGotoFac(body);
    U._sig = sheetSig();
  }

  function showAdvDetail(id) { G.treasury.advDetail(id); }
  U.showAdvDetail = showAdvDetail;
  U.confirmDismiss = (a) => confirmDismiss(a);
  function confirmDismiss(a) {
    U.modal(`<div class="confirm"><h2>${G.esc(a.name)}を解雇しますか？</h2><p>この操作は取り消せません。</p></div>`, [
      { text: 'やめる', cls: 'ghost' },
      { text: '解雇する', cls: 'danger', fn: () => { S.dismiss(a.id); U.toast(`${a.name}はギルドを去りました`, 'info'); U.renderSheet(); } },
    ]);
  }

  // ---------------------------------------------------------------- build
  function renderBuild(body) {
    const st = G.state;
    let h = '<div class="sec">';
    let shownLocked = 0;
    D.FACILITIES.forEach((f) => {
      const lv = st.fac[f.id];
      const state = S.facState(f.id);
      if (lv === 0 && state === 'locked') {
        shownLocked++;
        if (shownLocked > 1) { h += `<div class="card fac locked mystery"><b>？？？</b><small>ランク${f.rank}で解放</small></div>`; return; }
      }
      const c = lv < f.maxLv ? f.cost(lv) : null;
      const afford = c && S.canAfford(c);
      let btn = '';
      if (state === 'max') btn = `<span class="maxed">最大レベル</span>`;
      else if (state === 'building') btn = `<span class="maxed">建設中 <b data-countdown="${st.building.endAt}">${G.fmtClock(st.building.endAt - G.now())}</b></span>`;
      else if (state === 'locked') btn = `<span class="maxed">ランク${f.rank}で解放</span>`;
      else if (state === 'busy') btn = `<span class="maxed">ほかの建設中</span>`;
      else btn = `<button class="btn sm ${state === 'buildable' ? 'primary' : ''} ${afford ? '' : 'cant'}" data-up="${f.id}" data-cost-gold="${c.gold}" data-cost-mat="${c.mat}">${state === 'buildable' ? '建てる' : '強化'}<span>${IC.coin}${G.fmt(c.gold)}${c.mat ? ` ${IC.gem}${c.mat}` : ''}</span></button>`;
      const now = lv > 0 ? f.effect(lv) : '未建設';
      const next = lv < f.maxLv ? f.effect(Math.max(1, lv + (lv === 0 ? 1 : 1))) : null;
      h += `<div class="card fac ${state}" data-fac="${f.id}">
        <div class="f-ic" style="--c:${['#9a6c48', '#86624a', '#b0603a', '#6c6560', '#8a7250', '#6a4f9a', '#61707f'][f.floor]}">${f.floor + 1}F</div>
        <div class="grow"><div class="a-top"><b>${f.name}</b>${lv > 0 ? `<span class="lv">Lv${lv}${f.maxLv ? '/' + f.maxLv : ''}</span>` : ''}</div>
          <small class="desc">${f.desc}</small>
          <div class="eff"><span>${now}</span>${next && lv > 0 ? `<i>→</i><span class="nx">${next}</span>` : ''}${lv === 0 ? `<i>→</i><span class="nx">${f.effect(1)}</span>` : ''}</div>
          ${state === 'buildable' && f.buildTime ? `<small class="bt">${IC.clock} 建設 ${G.fmtTime(f.buildTime)}</small>` : ''}
        </div>
        <div class="f-go">${btn}</div>
      </div>`;
    });
    h += '</div>';
    body.innerHTML = h;
    G.$$('[data-up]', body).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.up;
      const r = S.upgrade(id);
      if (!r.ok) {
        G.audio.sfx('error');
        const c = S.facCost(id);
        U.toast(r.why === 'cost' ? `${st.gold < c.gold ? 'ゴールド' : '素材'}が足りません` : '今は強化できません', 'bad');
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        return;
      }
      const rect = b.getBoundingClientRect();
      U.fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      G.audio.sfx(S.facState(id) === 'building' ? 'build' : 'upgrade');
      G.haptic(20);
      G.scene.focusFloor(D.FAC[id].floor);
      if (S.facState(id) !== 'building') U.toast(`${D.FAC[id].name}を Lv${st.fac[id]} に強化しました`, 'good');
      if (id === 'tavern') G.audio.setAmbient(1);
      renderSheet();
    }));
    G.$$('[data-fac]', body).forEach((c) => c.addEventListener('click', () => {
      const f = D.FAC[c.dataset.fac];
      if (f) G.scene.focusFloor(f.floor);
    }));
    U._sig = sheetSig();
  }
  U.openFacility = function (id) {
    U.openSheet('build', { focus: id });
    G.scene.focusFloor(D.FAC[id].floor);
  };
  function bindGotoFac(body) {
    G.$$('[data-goto-fac]', body).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); U.openFacility(b.dataset.gotoFac); }));
  }

  // ---------------------------------------------------------------- records
  function renderRecords(body) {
    const st = G.state;
    const ss = st.stats;
    const s = st.settings;
    let h = `<div class="sec"><h3>ギルドの記録</h3><div class="stats">
      <div><small>依頼の数</small><b>${G.fmt(ss.quests)}</b></div>
      <div><small>成功</small><b>${G.fmt(ss.success)}</b></div>
      <div><small>大成功</small><b>${G.fmt(ss.great)}</b></div>
      <div><small>伝説級</small><b>${G.fmt(ss.legend)}</b></div>
      <div><small>稼いだG</small><b>${G.fmt(ss.goldEarned)}</b></div>
      <div><small>応援した回数</small><b>${G.fmt(ss.likes)}</b></div>
      <div><small>見た冒険譚</small><b>${G.fmt(ss.reels)}</b></div>
      <div><small>遊んだ時間</small><b>${G.fmtTime(ss.playSec)}</b></div>
    </div></div>`;
    const seen = D.MONSTER_ORDER.filter((m) => st.seenMonsters[m]).length;
    h += `<div class="sec"><h3>魔物図鑑 <small>${seen}/${D.MONSTER_ORDER.length}</small></h3><div class="dex">`;
    D.MONSTER_ORDER.forEach((m) => {
      const lvl = st.seenMonsters[m] || 0;
      h += `<div class="dx ${lvl ? '' : 'unknown'}"><img alt="" src="${U.monsterThumb(m, 64, !lvl)}"><small>${lvl ? D.MONSTERS[m].name : '？？？'}</small>${lvl >= 2 ? `<i class="crown ${lvl >= 3 ? 'legend' : ''}">${lvl >= 3 ? '伝' : '★'}</i>` : ''}</div>`;
    });
    h += `</div><p class="hint">大成功で ★、伝説級で「伝」の印がつきます</p></div>`;
    h += `<div class="sec settings"><h3>設定</h3>
      <button class="row mute" id="muteBtn"></button>
      <label class="row"><span>BGM</span><input type="range" id="setBgm" min="0" max="1" step="0.05" value="${s.bgm}"></label>
      <label class="row"><span>効果音</span><input type="range" id="setSfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
      <label class="row"><span>環境音 <small>海・風・鳥・虫</small></span><input type="range" id="setEnv" min="0" max="1" step="0.05" value="${s.env == null ? 0.7 : s.env}"></label>
      <label class="row tog"><span>振動</span><input type="checkbox" id="setHaptics" ${s.haptics ? 'checked' : ''}><i class="sw"></i></label>
      <label class="row tog"><span>冒険譚を自動で次へ</span><input type="checkbox" id="setAuto" ${s.autoplay ? 'checked' : ''}><i class="sw"></i></label>
      <label class="row tog"><span>流れるコメント</span><input type="checkbox" id="setDanmaku" ${s.danmaku !== false ? 'checked' : ''}><i class="sw"></i></label>
      <label class="row tog"><span>お知らせ（端末への通知も）</span><input type="checkbox" id="setNotify" ${s.notify ? 'checked' : ''}><i class="sw"></i></label>
      <label class="row tog"><span>動きをひかえめに</span><input type="checkbox" id="setMotion" ${s.reduceMotion ? 'checked' : ''}><i class="sw"></i></label>
      <button class="btn ghost danger wide" id="resetBtn">最初からやり直す</button>
      <p class="hint">セーブ：${G.save.where()}に自動で保存（数秒ごと・操作のたび）。版 ${G.VERSION}</p>
    </div>`;
    body.innerHTML = h;
    const bind = (id, fn) => G.$(id, body).addEventListener('input', fn);
    bind('#setBgm', (e) => { s.bgm = +e.target.value; G.audio.applyVolumes(); syncSoundBtn(); });
    bind('#setSfx', (e) => { s.sfx = +e.target.value; G.audio.applyVolumes(); G.audio.setAmbient(st.fac.tavern > 0 ? 1 : 0); syncSoundBtn(); G.audio.sfx('coin', 3); });
    bind('#setEnv', (e) => { s.env = +e.target.value; });
    bind('#setHaptics', (e) => { s.haptics = e.target.checked; G.haptic(12); });
    bind('#setAuto', (e) => { s.autoplay = e.target.checked; });
    bind('#setDanmaku', (e) => { s.danmaku = e.target.checked; });
    bind('#setNotify', async (e) => {
      s.notify = e.target.checked;
      if (s.notify && G.notify.permission() === 'default') {
        const r = await G.notify.request();
        if (r !== 'granted') U.toast(r === 'unsupported' ? 'この環境では端末通知が使えません。ギルドの中のお知らせは届きます' : '端末への通知は許可されませんでした。ギルドの中のお知らせは届きます', 'info');
      }
    });
    G.$('#muteBtn', body).addEventListener('click', () => { toggleSound(); renderSheet(); });
    syncSoundBtn();
    bind('#setMotion', (e) => { s.reduceMotion = e.target.checked; document.documentElement.classList.toggle('calm', s.reduceMotion); });
    G.$('#resetBtn', body).addEventListener('click', () => {
      U.modal('<div class="confirm"><h2>最初からやり直しますか？</h2><p>ギルドも冒険者もすべて消えます。取り消せません。</p></div>', [
        { text: 'やめる', cls: 'ghost' },
        { text: 'やり直す', cls: 'danger', fn: () => { G.resetting = true; const go = () => location.reload(); Promise.race([S.reset(), new Promise((r) => setTimeout(r, 2500))]).then(go, go); } },
      ]);
    });
    U._sig = sheetSig();
  }

  // 魔物のサムネイル
  const thumbCache = new Map();
  U.monsterThumb = function (m, size, silhouette) {
    const key = m + size + (silhouette ? 's' : '');
    if (thumbCache.has(key)) return thumbCache.get(key);
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const h = art.monsterHeight[m] || 40;
    const w = m === 'dragon' ? 130 : m === 'wolf' ? 70 : m === 'wyvern' ? 80 : 50;
    const sc = Math.min((size * 0.82) / h, (size * 0.86) / w);
    ctx.translate(size / 2 + (m === 'wolf' ? -size * 0.08 : m === 'dragon' ? size * 0.05 : 0), size * 0.9);
    ctx.scale(-sc, sc);
    if (silhouette) art.setFlash(0);
    art.monster[m](ctx, { t: 0.6, color: D.MONSTERS[m].color });
    if (silhouette) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = 'rgba(255,236,200,0.14)';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const url = c.toDataURL();
    thumbCache.set(key, url);
    return url;
  };

  // 装備・秘宝のサムネイル（レア度の枠つき）
  U.itemThumb = function (item, size) {
    const key = 'it:' + (item.kind === 'relic' ? 'r-' + item.rid : item.kind === 'cons' ? 'c-' + item.id : item.tid) + ':' + item.rarity;
    return art.url(art.cached(key, size, (ctx, sz) => {
      const rc = art.RARITY_COL[item.rarity];
      const g = ctx.createLinearGradient(0, 0, 0, sz);
      g.addColorStop(0, G.shade(rc.dark, -0.25));
      g.addColorStop(1, '#0a1022');
      art.rrect(ctx, 0.5, 0.5, sz - 1, sz - 1, sz * 0.18);
      ctx.fillStyle = g;
      ctx.fill();
      const rg = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz * 0.5);
      rg.addColorStop(0, G.rgba(rc.glow, 0.45));
      rg.addColorStop(1, G.rgba(rc.glow, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, sz, sz);
      ctx.lineWidth = Math.max(1, sz * 0.04);
      if (item.rarity === 4) {
        const lg = ctx.createLinearGradient(0, 0, sz, sz);
        for (let i = 0; i <= 6; i++) lg.addColorStop(i / 6, `hsl(${i * 60},90%,68%)`);
        ctx.strokeStyle = lg;
      } else ctx.strokeStyle = rc.accent;
      art.rrect(ctx, 1, 1, sz - 2, sz - 2, sz * 0.18);
      ctx.stroke();
      ctx.save();
      ctx.translate(sz / 2, sz / 2);
      art.itemIcon(ctx, item, sz * 0.66, 0.6);
      ctx.restore();
    }));
  };

  // ---------------------------------------------------------------- modal / toast
  let modalQueue = [];
  U.modal = function (html, buttons = [{ text: 'OK', cls: 'primary' }], opts = {}) {
    const m = G.$('#modal');
    if (!m.hidden && !opts.replace) { modalQueue.push([html, buttons, opts]); return; }
    const card = G.$('#modalCard');
    card.className = 'modal-card ' + (opts.cls || '');
    card.innerHTML = html + `<div class="m-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-mi="${i}">${b.text}</button>`).join('')}</div>`;
    G.$$('[data-mi]', card).forEach((b) => b.addEventListener('click', () => {
      const bt = buttons[+b.dataset.mi];
      G.audio.sfx('tap');
      closeModal();
      if (bt.fn) bt.fn();
    }));
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('shown'));
    G.audio.setMuffle(true);
    if (opts.onShow) opts.onShow(card);
  };
  U.closeModal = () => closeModal();
  function closeModal() {
    const m = G.$('#modal');
    m.classList.remove('shown');
    setTimeout(() => {
      m.hidden = true;
      if (!sheetTab) G.audio.setMuffle(false);
      const next = modalQueue.shift();
      if (next) U.modal(next[0], next[1], next[2]);
    }, 220);
  }
  U.modalOpen = () => !G.$('#modal').hidden;

  // key を渡すと、表示中の同じ種類のお知らせを書き換える（連続で出ても積み上がらない）
  const toastKeys = {};
  U.toast = function (text, kind = 'info', key) {
    const box = G.$('#toasts');
    const prev = key && toastKeys[key];
    if (prev && prev.el.isConnected && !prev.el.classList.contains('out')) {
      prev.el.textContent = text;
      prev.el.classList.remove('bump'); void prev.el.offsetWidth; prev.el.classList.add('bump');
      clearTimeout(prev.t1); clearTimeout(prev.t2);
      prev.t1 = setTimeout(() => { prev.el.classList.remove('in'); prev.el.classList.add('out'); }, 2600);
      prev.t2 = setTimeout(() => prev.el.remove(), 3000);
      return;
    }
    const el = G.el('div', 'toast ' + kind, G.esc(text));
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    const rec = { el };
    rec.t1 = setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 2600);
    rec.t2 = setTimeout(() => el.remove(), 3000);
    if (key) toastKeys[key] = rec;
  };

  function showRankUp(r) {
    G.audio.sfx('rankup');
    G.haptic(40);
    const unlocks = D.RANK_UNLOCKS[r] || [];
    const nx = D.RANK_UNLOCKS[r + 1];
    U.modal(`<div class="rankup"><div class="ru-crest"><span>${r}</span></div><small>ギルドランク アップ</small><h2>${D.RANK_TITLES[r - 1]}</h2>
      ${unlocks.length ? `<ul>${unlocks.map((u) => `<li>${u}</li>`).join('')}</ul>` : ''}
      ${nx ? `<p class="next">次のランクで：${nx.join('、')}</p>` : ''}</div>`, [{ text: 'やったね！', cls: 'primary big' }], { cls: 'celebrate', onShow: () => { U.fx.confetti(); } });
    // 新しい依頼を混ぜる
    const st = G.state;
    if (st.board.length >= S.boardSize()) st.board.pop();
    st.board.push(S.genQuest());
    S.rollCandidates(st);
  }

  function showRankInfo() {
    G.audio.init();
    G.audio.sfx('tap');
    const st = G.state;
    const hi = D.RANK_FAME[st.rank];
    const nx = D.RANK_UNLOCKS[st.rank + 1];
    U.modal(`<div class="rankup info"><div class="ru-crest"><span>${st.rank}</span></div><small>ギルドランク</small><h2>${D.RANK_TITLES[st.rank - 1]}</h2>
      ${hi ? `<p>次のランクまで 名声 <b>${G.fmt(hi - st.fame)}</b></p><div class="bar big"><i style="width:${G.clamp((st.fame - D.RANK_FAME[st.rank - 1]) / (hi - D.RANK_FAME[st.rank - 1]), 0, 1) * 100}%"></i></div>` : '<p>最高ランクです！</p>'}
      ${nx ? `<p class="next">次のランクで：${nx.join('、')}</p>` : ''}
      <p class="hint">名声は依頼を成功させると手に入ります</p></div>`, [{ text: '閉じる', cls: 'primary' }]);
  }

  U.welcomeBack = function (res) {
    if (!res) return;
    const lines = [];
    if (res.tavern > 0) lines.push(`<li>${IC.coin}<span>酒場の売上</span><b data-count="${res.tavern}">0</b></li>`);
    if (res.trained > 0) lines.push(`<li>${IC.sword}<span>訓練で得た経験値</span><b>${G.fmt(res.trained)}</b></li>`);
    if (res.resolved > 0) lines.push(`<li>${IC.play}<span>帰ってきたパーティ</span><b>${res.resolved}組</b></li>`);
    if (res.built) lines.push(`<li>${IC.build}<span>完成した施設</span><b>${D.FAC[res.built].name}</b></li>`);
    const unseen = G.reels.unseen().length;
    const html = `<div class="welcome"><small>留守にしていた時間 ${G.fmtTime(res.away)}${res.capped ? `（上限 ${G.fmtTime(res.cap)}）` : ''}</small><h2>おかえりなさい、マスター！</h2>
      ${lines.length ? `<ul>${lines.join('')}</ul>` : '<p>ギルドは静かでした。</p>'}
      ${unseen ? `<p class="reels-wait">冒険譚が <b>${unseen}本</b> 届いています</p>` : ''}
      ${res.capped ? '<p class="hint">見張り塔を建てると、留守番できる時間が延びます</p>' : ''}</div>`;
    const btns = unseen ? [{ text: 'あとで', cls: 'ghost' }, { text: '冒険譚を見る', cls: 'primary big', fn: () => G.reels.open() }] : [{ text: 'ギルドへ', cls: 'primary big' }];
    U.modal(html, btns, {
      cls: 'welcome-card',
      onShow: (card) => {
        G.$$('[data-count]', card).forEach((el) => {
          const v = +el.dataset.count;
          const t0 = performance.now();
          const step = () => {
            const k = Math.min(1, (performance.now() - t0) / 1100);
            el.textContent = '+' + G.fmt(v * G.ease.outCubic(k)) + 'G';
            if (k < 1) requestAnimationFrame(step);
            else G.audio.sfx('coins');
          };
          step();
        });
      },
    });
  };

  // ---------------------------------------------------------------- adventurer popover
  let popAgent = null, popTimer = null;
  U.showAdvPop = function (adv, agent) {
    const el = G.$('#advPop');
    const cls = D.CLASSES[adv.cls];
    el.innerHTML = `<b>${G.esc(adv.name)}</b><span class="cls" style="--cls:${cls.color}">${cls.name}</span><span class="lv">Lv${adv.lv}</span><small>${D.TRAITS[adv.trait].name} ・ 戦力 ${G.fmt(S.power(adv))}</small>`;
    el.hidden = false;
    el.classList.remove('in');
    void el.offsetWidth;
    el.classList.add('in');
    popAgent = agent;
    positionPop();
    clearTimeout(popTimer);
    popTimer = setTimeout(hidePop, 2600);
  };
  function positionPop() {
    if (!popAgent) return;
    const [x, y] = G.scene.agentScreen(popAgent);
    const el = G.$('#advPop');
    const w = el.offsetWidth;
    el.style.left = G.clamp(x - w / 2, 8, window.innerWidth - w - 8) + 'px';
    el.style.top = Math.max(60, y - 120) + 'px';
  }
  function hidePop() {
    popAgent = null;
    const el = G.$('#advPop');
    el.classList.remove('in');
    setTimeout(() => { if (!popAgent) el.hidden = true; }, 180);
  }

  // ---------------------------------------------------------------- coin flights (fx canvas)
  U.fx = (function () {
    let cv, ctx, dpr = 1;
    const flies = [];
    const bits = [];
    let combo = 0, comboT = 0;
    return {
      init() {
        cv = G.$('#fx');
        ctx = cv.getContext('2d');
        const rs = () => {
          dpr = Math.min(2, window.devicePixelRatio || 1);
          cv.width = window.innerWidth * dpr;
          cv.height = window.innerHeight * dpr;
          cv.style.width = window.innerWidth + 'px';
          cv.style.height = window.innerHeight + 'px';
        };
        rs();
        window.addEventListener('resize', rs);
      },
      add(f) { flies.push(f); },
      burst(x, y) {
        for (let i = 0; i < 18; i++) bits.push({ x, y, vx: G.rand(-180, 180), vy: G.rand(-260, -60), life: 0, max: G.rand(0.6, 1), col: G.pick(['#ffcf4a', '#fff2b0', '#ff9a6a', '#8fe0c0']), size: G.rand(4, 7), rot: G.rand(0, 6) });
      },
      confetti() {
        const w = window.innerWidth;
        for (let i = 0; i < 90; i++) bits.push({ x: G.rand(0, w), y: G.rand(-40, -10), vx: G.rand(-60, 60), vy: G.rand(60, 220), g: 120, life: 0, max: G.rand(2, 3.4), col: G.pick(['#ffcf4a', '#ff7a6a', '#6ad0ff', '#8fe08a', '#c79bff', '#fff']), size: G.rand(5, 9), rot: G.rand(0, 6), vr: G.rand(-6, 6) });
      },
      update(dt) {
        comboT -= dt;
        if (comboT <= 0) combo = 0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (let i = flies.length - 1; i >= 0; i--) {
          const f = flies[i];
          f.t += dt;
          if (f.t < 0) continue;
          const k = Math.min(1, f.t / f.dur);
          const tgt = f.target.getBoundingClientRect();
          const tx = tgt.left + 14, ty = tgt.top + tgt.height / 2;
          // 弧を描いて飛ぶ
          const e = G.ease.inCubic(k);
          const x = G.lerp(f.x + f.sx * (1 - e) * 40 * Math.sin(k * Math.PI), tx, e);
          const y = G.lerp(f.y, ty, e) - Math.sin(k * Math.PI) * f.arc;
          ctx.save();
          ctx.translate(x, y);
          const sc = 1 + Math.sin(k * Math.PI) * 0.4;
          ctx.scale(sc, sc);
          if (f.kind === 'gem') art.gem(ctx, 0, 0, 8);
          else art.coin(ctx, 0, 0, 7, f.t * 3 + i);
          ctx.restore();
          if (k >= 1) {
            flies.splice(i, 1);
            if (f.kind === 'coin') {
              heldGold = Math.max(0, heldGold - f.v);
              combo++;
              comboT = 0.5;
              G.audio.sfx('coin', Math.min(12, combo));
              bumpEl(f.target);
              if (f.tap) G.haptic(4);
            } else {
              bumpEl(f.target);
              G.audio.sfx('tick');
            }
          }
        }
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i];
          b.life += dt;
          if (b.life > b.max) { bits.splice(i, 1); continue; }
          b.vy += (b.g != null ? b.g : 520) * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += (b.vr || 4) * dt;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.rot);
          ctx.globalAlpha = Math.min(1, (1 - b.life / b.max) * 2);
          art.poly(ctx, [-b.size, b.size * 0.6, b.size, b.size * 0.6, 0, -b.size], b.col);
          ctx.restore();
        }
      },
    };
  })();
  function bumpEl(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  // amount を数枚のコインに分けて HUD へ飛ばす
  U.flyCoins = function (x, y, amount, tap, target) {
    if (amount <= 0) return;
    const n = Math.max(1, Math.min(12, Math.round(Math.log2(amount + 1) * 1.3)));
    const tg = target || G.$('#goldPill');
    if (!target) heldGold += amount;
    let left = amount;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(amount / n);
      left -= v;
      U.fx.add({ kind: 'coin', x: x + G.rand(-8, 8), y: y + G.rand(-8, 8), sx: G.rand(-1, 1), arc: G.rand(30, 90), t: -i * 0.045, dur: G.rand(0.5, 0.7), v: target ? 0 : v, target: tg, tap });
    }
  };
  U.flyGems = function (x, y, n) {
    const tg = G.$('#matPill');
    for (let i = 0; i < Math.min(8, n); i++) U.fx.add({ kind: 'gem', x, y, sx: G.rand(-1, 1), arc: G.rand(30, 80), t: -i * 0.06, dur: 0.6, v: 0, target: tg });
  };

  // ---------------------------------------------------------------- tutorial
  const tutQuestBtn = () => G.$(`[data-dispatch="${G.state.flags.tutQ}"]`) || G.$('.card.quest .go');
  const TUT = [
    { text: 'ようこそ、新しいギルドマスター！ 受付のリナです。…見てのとおりボロボロですけど、今日からここがあなたのギルドです！', tap: true },
    { text: 'さっそく依頼を受けてみましょう。下の「依頼」をタップしてください。', target: '#tab-quests', done: () => sheetTab === 'quests' && !subView },
    { text: '「草原のスライム退治」がガルドさんにぴったりです。「派遣」を押してください。', targetEl: tutQuestBtn, need: () => sheetTab === 'quests', back: 1, done: () => subView && subView.kind === 'dispatch' },
    { text: '成功率が高いですね！「出発！」で送り出しましょう。', target: '#dpGo', need: () => subView && subView.kind === 'dispatch', back: 2, event: 'dispatch' },
    {
      text: 'いってらっしゃい！ …あ、受付に相談料が届いています。光っているコインをタップして受け取りましょう。',
      enter: () => { U.closeSheet(true); if (G.state.deskCoins <= 0) G.state.deskCoins = 6; G.scene.focusBottom(); },
      targetFn: () => G.scene.deskCoinScreen(), event: 'deskCollected',
    },
    { text: 'ガルドさんが帰ってくるまで少し待ちましょう。帰ってくると「冒険譚」が届きます。', target: '#expStrip', done: () => G.reels.unseen().length > 0, stuck: () => !G.state.active.length && !G.reels.unseen().length, skipTo: 8 },
    { text: '冒険譚が届きました！ 真ん中のボタンで見てみましょう。戦いの様子とコメントが流れてきますよ。', target: '#tab-reels', event: 'reelsOpen', stuck: () => !G.reels.unseen().length && !G.reels.isOpen(), skipTo: 8 },
    { text: '', hidden: true, event: 'reelsClosed' },
    {
      text: '報酬が入りましたね！ 次は仲間を増やしましょう。「冒険者」を開いてください。',
      enter: () => {
        // 最初の1人はリナのつてで無料（お金が足りなくて止まらないように）
        const st = G.state;
        if (st.adv.length < 2 && st.cands.length && !st.cands.some((c) => c.free)) { st.cands[0].free = true; st.cands[0].price = 0; }
      },
      target: '#tab-roster', done: () => sheetTab === 'roster' || G.state.adv.length >= 2,
    },
    { text: '最初の1人は、わたしの知り合いなので無料です！「仲間にする」をタップしてください。', targetEl: () => G.$('.card.cand.free .hire') || G.$('.card.cand .hire'), need: () => sheetTab === 'roster' || G.state.adv.length >= 2, back: 8, done: () => G.state.adv.length >= 2 },
    { text: 'これでパーティが組めます！ 画面上の「目標」をこなすと報酬がもらえますよ。宝物庫の黄金の宝箱も、ぜひ開けてみてくださいね！', target: '#objChip', tap: true, enter: () => U.closeSheet(true) },
  ];
  let tutStep = -1, tutTyped = 0, tutFired = false, tutTick0 = 0;
  U.startTutorial = function () {
    const st = G.state;
    if (st.flags.tut >= TUT.length) return;
    G.$('#tutFace').src = art.portrait({ cls: 'warrior', role: 'rina', seed: 3, skin: '#f6d3b3', hair: '#8a4a2a', style: 'pony', outfit: '#3f8f6e', vest: '#2f6f55', pants: '#3d3f52', blush: true }, 56);
    G.$('#tutBox').addEventListener('click', tutTap);
    G.$('#tutSkip').addEventListener('click', (e) => { e.stopPropagation(); endTutorial(); });
    TUT.forEach((s, i) => {
      if (s.event) G.on(s.event, () => { if (tutStep === i) setStep(i + 1); });
    });
    setStep(st.flags.tut);
  };
  function setStep(i) {
    const st = G.state;
    tutStep = i;
    st.flags.tut = i;
    if (i >= TUT.length) { endTutorial(); return; }
    const s = TUT[i];
    tutTyped = 0;
    tutTick0 = 0;
    tutFired = false;
    if (s.enter) s.enter();
    G.$('#tut').hidden = !!s.hidden;
    G.$('#tutText').textContent = '';
    G.$('#tutNext').hidden = !s.tap;
  }
  function endTutorial() {
    const was = tutStep >= 0;
    tutStep = -1;
    G.state.flags.tut = 99;
    if (was) setTimeout(() => G.treasury.checkDaily(), 1200);
    G.$('#tut').hidden = true;
    document.body.classList.remove('tut-top');
    G.sim.save();
  }
  function tutTap() {
    const s = TUT[tutStep];
    if (!s) return;
    if (tutTyped < s.text.length) { tutTyped = s.text.length; return; }
    if (s.tap) { G.audio.sfx('tap'); setStep(tutStep + 1); }
  }
  U.tutorialActive = () => tutStep >= 0;
  function tutTick(dt) {
    if (tutStep < 0) return;
    const s = TUT[tutStep];
    if (!s) return;
    const el = G.$('#tut');
    if (G.reels.isOpen() || U.modalOpen()) { el.hidden = true; return; }
    if (s.hidden) { el.hidden = true; return; }
    el.hidden = false;
    if (s.need && !s.need()) { setStep(s.back); return; }
    if (s.done && s.done()) { setStep(tutStep + 1); return; }
    if (s.stuck && s.stuck()) { setStep(s.skipTo); return; }
    // 文字送り（3文字ごとに小さな音）
    if (tutTyped < s.text.length) {
      tutTyped = Math.min(s.text.length, tutTyped + dt * 38);
      const n = Math.floor(tutTyped);
      G.$('#tutText').textContent = s.text.slice(0, n);
      if (n - tutTick0 >= 3) { tutTick0 = n; G.audio.sfx('tick'); }
    }
    // 指差し
    let rect = null;
    if (s.target || s.targetEl) {
      const t = s.targetEl ? s.targetEl() : G.$(s.target);
      if (t && t.offsetParent !== null) {
        rect = t.getBoundingClientRect();
        // シートの中で見えていなければスクロールして見せる
        const body = G.$('#sheetBody');
        if (body.contains(t)) {
          const br = body.getBoundingClientRect();
          if (rect.bottom > br.bottom - 8 || rect.top < br.top + 8) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }
      }
    } else if (s.targetFn) {
      const p = s.targetFn();
      if (p) rect = { left: p[0] - 18, top: p[1] - 18, width: 36, height: 36 };
    }
    const ring = G.$('#tutRing'), hand = G.$('#tutHand');
    if (rect) {
      ring.hidden = hand.hidden = false;
      ring.style.left = rect.left - 6 + 'px';
      ring.style.top = rect.top - 6 + 'px';
      ring.style.width = rect.width + 12 + 'px';
      ring.style.height = rect.height + 12 + 'px';
      hand.style.left = rect.left + rect.width / 2 + 'px';
      hand.style.top = rect.top + rect.height / 2 + 'px';
      // 説明の箱は指差しと被らない側へ
      const box = G.$('#tutBox');
      const low = rect.top > window.innerHeight * 0.55;
      box.classList.toggle('top', low);
    } else {
      ring.hidden = hand.hidden = true;
      G.$('#tutBox').classList.add('top');
    }
    document.body.classList.toggle('tut-top', G.$('#tutBox').classList.contains('top'));
  }
})();
