/* ギルドの灯 — main: 起動・ループ・セーブ・タブの出入り */
'use strict';
(function () {
  let last = performance.now();
  let saveT = 0;
  let trainAcc = 0;
  let started = false;
  let hiddenAt = 0;

  function boot() {
    let st = G.sim.load();
    const isNew = !st;
    if (!st) st = G.sim.fresh();
    G.state = st;
    document.documentElement.classList.toggle('calm', !!st.settings.reduceMotion);
    G.scene.init(G.$('#scene'));
    G.reels.init();
    G.ui.init();
    const off = isNew ? null : G.sim.offline();
    G.scene.start();
    G.ui.refreshHud(true);
    G.ui.syncSoundBtn();
    requestAnimationFrame(loop);

    const splash = G.$('#boot');
    G.$('#bootHint').textContent = isNew ? 'タップしてはじめる' : 'タップしてつづける';
    if (!isNew && off && off.away > 60) G.$('#bootSub').textContent = `${G.fmtTime(off.away)}ぶりのギルド`;
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
      }, 650);
    };
    splash.addEventListener('pointerup', go);
    splash.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(); });
    splash.focus();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => G.sim.save());
    window.addEventListener('beforeunload', () => { if (!G.resetting) G.sim.save(); });
    // 開いている画面を壊さずに差し替えるためのフック（Artifact 上で使われる）
    try { if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => { G.sim.save(); return {}; }); } catch (e) { /* noop */ }
  }

  function onVis() {
    if (document.hidden) {
      hiddenAt = G.now();
      G.sim.save();
      G.audio.pause();
    } else {
      G.audio.resume();
      const away = G.now() - (hiddenAt || G.now());
      last = performance.now();
      if (away > 5) {
        const res = G.sim.offline();
        G.ui.refreshHud(true);
        if (res && away > 90 && (res.tavern > 0 || res.resolved > 0)) G.ui.welcomeBack(res);
      }
    }
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
      G.scene.update(dt);
      G.scene.render();
    } else {
      G.reels.update(dt);
      G.reels.render();
    }
    G.ui.tick(dt);
    saveT += dt;
    if (saveT > 5) { saveT = 0; G.sim.save(); }
  }

  const ready = () => {
    // フォントを待ってから（待ちすぎない）
    const fonts = document.fonts && document.fonts.load ? Promise.race([
      Promise.all([document.fonts.load('800 12px "M PLUS Rounded 1c"'), document.fonts.load('400 20px "Dela Gothic One"')]),
      new Promise((r) => setTimeout(r, 1200)),
    ]) : Promise.resolve();
    fonts.catch(() => {}).then(boot);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
