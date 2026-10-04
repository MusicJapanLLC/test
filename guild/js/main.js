/* ギルドの灯 — main: 起動・ループ・セーブ・タブの出入り */
'use strict';
(function () {
  let last = performance.now();
  let saveT = 0;
  let trainAcc = 0;
  let started = false;
  let hiddenAt = 0;
  let bgTimer = 0;

  function boot(raw) {
    let st = G.sim.load(raw);
    const isNew = !st;
    if (!st) st = G.sim.fresh();
    G.state = st;
    G.booted = true;
    document.documentElement.classList.toggle('calm', !!st.settings.reduceMotion);
    G.scene.init(G.$('#scene'));
    G.reels.init();
    G.ui.init();
    if (G.notify) G.notify.init();
    const off = isNew ? null : G.sim.offline();
    G.scene.start();
    G.ui.refreshHud(true);
    G.ui.syncSoundBtn();
    requestAnimationFrame(loop);
    G.sim.save(true);

    const splash = G.$('#boot');
    G.$('#bootHint').textContent = isNew ? 'タップしてはじめる' : 'タップしてつづける';
    splash.classList.add('ready');
    if (!isNew && off && off.away > 60) G.$('#bootSub').textContent = `${G.fmtTime(off.away)}ぶりのギルド`;
    else if (!isNew) G.$('#bootSub').textContent = `ギルドランク ${st.rank} ・ ${G.D.RANK_TITLES[st.rank - 1]}`;
    const go = () => {
      if (started) return;
      started = true;
      G.audio.init();
      G.audio.setAmbient(G.state.fac.tavern > 0 ? 1 : 0);
      G.audio.sfx('door');
      splash.classList.add('gone');
      setTimeout(() => splash.remove(), 700);
      setTimeout(() => {
        if (off && off.away > 60 && (off.tavern > 0 || off.resolved > 0 || off.trained > 0)) G.ui.welcomeBack(off);
        if (G.state.flags.tut < 90) G.ui.startTutorial();
        if (G.stars) G.stars.afterBoot();
        G.emit('started');
      }, 650);
    };
    splash.addEventListener('pointerup', go);
    splash.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(); });
    splash.focus();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => G.sim.save(true));
    window.addEventListener('beforeunload', () => { if (!G.resetting) G.sim.save(true); });
    // 開いたまま新しい版に差し替わるときも、先に保存する
    try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => { G.sim.save(true); return {}; }); } catch (e) { /* noop */ }
    // 大事な出来事のたびにすぐ保存する
    ['dispatch', 'resolved', 'hired', 'built', 'upgraded', 'rankup', 'reelsClosed', 'dismissed', 'claimed', 'itemsChanged', 'buildStart'].forEach((ev) => G.on(ev, () => G.sim.save()));
  }

  function onVis() {
    if (document.hidden) {
      hiddenAt = G.now();
      G.sim.save(true);
      G.audio.pause();
      scheduleBackground();
    } else {
      clearTimeout(bgTimer);
      G.audio.resume();
      const away = G.now() - (hiddenAt || G.now());
      last = performance.now();
      if (away > 5) {
        const res = G.sim.offline();
        G.ui.refreshHud(true);
        if (res && away > 90 && (res.tavern > 0 || res.resolved > 0)) G.ui.welcomeBack(res);
      }
      G.sim.save(true);
    }
  }
  // 画面を離れている間も、パーティが帰ってきたら端末に知らせる（許可されている場合）
  function scheduleBackground() {
    clearTimeout(bgTimer);
    const st = G.state;
    if (!st.active.length) return;
    const next = Math.min(...st.active.map((e) => e.endAt));
    const ms = Math.max(1000, (next - G.now()) * 1000 + 300);
    if (ms > 6 * 3600 * 1000) return;
    bgTimer = setTimeout(() => {
      if (!document.hidden) return;
      G.sim.offline();
      G.sim.save(true);
      scheduleBackground();
    }, ms);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    const st = G.state;
    const now = G.now();
    G.sim.advance(now);
    st.lastSeen = now;
    st.stats.playSec += dt;
    // 訓練場：待機中の冒険者は少しずつ経験を積む
    if (st.fac.training > 0) {
      trainAcc += dt;
      if (trainAcc >= 1) {
        trainAcc -= 1;
        st.adv.forEach((a) => {
          if (a.status !== 'idle') return;
          a._tx = (a._tx || 0) + 0.004 * st.fac.training * (1 + a.lv * 0.1);
          if (a._tx >= 1) { const n = Math.floor(a._tx); a._tx -= n; G.sim.gainExp(a, n); }
        });
      }
    }
    if (!G.reels.isOpen()) {
      // 倍速中はギルドの人たちもせかせか動く
      G.scene.update(dt * (G.items.speedMul() > 1 ? 1.5 : 1));
      G.scene.render();
    } else {
      G.reels.update(dt);
      G.reels.render();
    }
    G.ui.tick(dt);
    G.audio.envTick(dt, !G.reels.isOpen());
    if (G.notify) G.notify.tick(dt);
    if (G.missions) G.missions.tick(dt);
    saveT += dt;
    if (saveT > 3) { saveT = 0; G.sim.save(); }
  }

  const ready = () => {
    // フォントとセーブを待ってから（待ちすぎない）
    const fonts = document.fonts && document.fonts.load ? Promise.race([
      Promise.all([document.fonts.load('700 12px "Zen Kaku Gothic New"'), document.fonts.load('800 20px "Shippori Mincho B1"'), document.fonts.load('800 20px "Cinzel"')]),
      new Promise((r) => setTimeout(r, 1200)),
    ]).catch(() => {}) : Promise.resolve();
    const hint = G.$('#bootHint');
    if (hint) hint.textContent = 'セーブデータを読み込み中…';
    Promise.all([fonts, G.save.init().catch(() => null)]).then(([, raw]) => boot(raw));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
