/* ギルドの灯 — missions: デイリー任務・週間任務
 *  - 毎日 5つ（日付で決まる・その日できるものから選ぶ）。全部受け取ると「達成ボーナス」
 *  - 毎週 4つ（大きめのごほうび）
 *  - 進み具合は統計（依頼の回数・見届けた冒険譚など）の、その日（週）の始めからの増えた分
 */
'use strict';
(function () {
  const M = (G.missions = {});
  const IT = () => G.items;

  const POOL = [
    { id: 'dispatch', text: '依頼を{n}回出す', stat: 'quests', n: [4, 6, 8], rw: { cry: 10, auto30: 1 } },
    { id: 'watch', text: '冒険譚を{n}本 見届ける', stat: 'witnessed', n: [3, 5], rw: { cry: 15 } },
    { id: 'great', text: '大成功を{n}回出す', stat: 'great', n: [1, 2], rw: { stone: 6 } },
    { id: 'chest', text: '黄金の宝箱を{n}回開ける', stat: 'chests', n: [1], rw: { cry: 10 } },
    { id: 'enhance', text: '装備を{n}回強化する', stat: 'enhance', n: [1, 2], rw: { stone: 8 }, need: (st) => (st.items || []).length > 0 },
    { id: 'like', text: '冒険譚で{n}回応援する', stat: 'likes', n: [3, 5], rw: { cry: 10 } },
    { id: 'post', text: 'マスターとして{n}回コメントする', stat: 'posts', n: [1, 2], rw: { cry: 15 } },
    { id: 'build', text: '施設を{n}回 建てる・強化する', stat: 'upgrades', n: [1, 2], rw: { finish: 1 } },
    { id: 'tips', text: '酒場のチップを{n}回受け取る', stat: 'tips', n: [6, 10], rw: { cry: 10 }, need: (st) => st.fac.tavern > 0 && st.fac.tavern < 4 },
    { id: 'use', text: '持ち物を{n}個使う', stat: 'itemsUsed', n: [1, 2], rw: { cry: 10 } },
    { id: 'fish', text: '裏の桟橋で魚を{n}匹釣る', stat: 'fish', n: [2, 3], rw: { cry: 10, stone: 3 }, need: (st) => st.flags.tut >= 90 },
    { id: 'mat', text: '素材を{n}個集める', stat: 'matGot', n: [5, 10, 15], rw: { stone: 5 } },
    { id: 'abyss', text: '深淵の迷宮に{n}回挑む', stat: 'abyssRuns', n: [1, 2], rw: { cry: 20 }, need: (st) => !!(st.abyss && st.abyss.open) },
  ];
  const WEEKLY = [
    { id: 'w_dispatch', text: '依頼を40回出す', stat: 'quests', n: 40, rw: { cry: 60, auto180: 1 } },
    { id: 'w_watch', text: '冒険譚を25本 見届ける', stat: 'witnessed', n: 25, rw: { hg2: 2 } },
    { id: 'w_great', text: '大成功を8回出す', stat: 'great', n: 8, rw: { book: 1 } },
    { id: 'w_daily', text: 'デイリー任務を5日クリアする', stat: 'dailyClears', n: 5, rw: { cry: 100, horn: 1 } },
  ];
  const ALL_CLEAR = { cry: 40, key: 1 };
  M.POOL = POOL;

  const rwText = (rw) => Object.entries(rw).map(([k, n]) => (k === 'cry' ? `魔晶石×${n}` : `${IT().CONS[k].name}×${n}`)).join('・');
  const statOf = (st, k) => {
    const s = st.stats || {};
    if (k === 'great') return (s.great || 0) + (s.legend || 0); // 伝説も大成功に数える
    return s[k] || 0;
  };

  // その日の任務を用意する（日付が変わったら入れ替え）
  function ensure() {
    const st = G.state;
    const today = G.treasury.today();
    const wk = G.treasury.week();
    st.missions = st.missions || {};
    const m = st.missions;
    if (m.day !== today) {
      m.day = today;
      m.base = {};
      POOL.forEach((p) => { m.base[p.stat] = statOf(st, p.stat); });
      m.claimed = {};
      m.bonus = false;
      m.notified = {};
      // 日付から決まる並び（できるものだけ）
      let h = 0;
      for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const avail = POOL.filter((p) => !p.need || p.need(st));
      const picks = [];
      let k = 0;
      while (picks.length < 5 && avail.length) {
        const i = Math.floor(G.hash(h + k * 7919) * avail.length);
        const p = avail.splice(i, 1)[0];
        picks.push({ id: p.id, n: p.n[Math.floor(G.hash(h + k * 104729 + 3) * p.n.length)] });
        k++;
      }
      // 「見届ける」は毎日入れる（このゲームの楽しみの中心なので）
      if (!picks.some((x) => x.id === 'watch')) picks[picks.length - 1] = { id: 'watch', n: 3 };
      m.picks = picks;
    }
    if (m.week !== wk) {
      m.week = wk;
      m.wbase = {};
      WEEKLY.forEach((p) => { m.wbase[p.stat] = statOf(st, p.stat); });
      m.wclaimed = {};
    }
    return m;
  }
  function dailyList() {
    const st = G.state;
    const m = ensure();
    return m.picks.map((pk) => {
      const p = POOL.find((x) => x.id === pk.id);
      const cur = Math.max(0, statOf(st, p.stat) - (m.base[p.stat] || 0));
      return { key: pk.id, text: p.text.replace('{n}', pk.n), n: pk.n, cur: Math.min(pk.n, cur), done: cur >= pk.n, claimed: !!m.claimed[pk.id], rw: p.rw };
    });
  }
  function weeklyList() {
    const st = G.state;
    const m = ensure();
    return WEEKLY.map((p) => {
      const cur = Math.max(0, statOf(st, p.stat) - (m.wbase[p.stat] || 0));
      return { key: p.id, text: p.text, n: p.n, cur: Math.min(p.n, cur), done: cur >= p.n, claimed: !!m.wclaimed[p.id], rw: p.rw, weekly: true };
    });
  }
  M.claimable = function () {
    if (!G.state) return 0;
    const m = ensure();
    const d = dailyList().filter((x) => x.done && !x.claimed).length;
    const w = weeklyList().filter((x) => x.done && !x.claimed).length;
    const allClaimed = dailyList().every((x) => x.claimed);
    return d + w + (allClaimed && !m.bonus ? 1 : 0);
  };
  M.sig = () => { const m = ensure(); return [m.day, m.week, JSON.stringify(m.claimed), JSON.stringify(m.wclaimed), m.bonus, dailyList().map((x) => x.cur).join(), weeklyList().map((x) => x.cur).join()].join('|'); };

  function give(rw) {
    Object.entries(rw).forEach(([k, n]) => IT().addCons(k, n));
  }
  function claim(key, weekly) {
    const m = ensure();
    const list = weekly ? weeklyList() : dailyList();
    const it = list.find((x) => x.key === key);
    if (!it || !it.done || it.claimed) return;
    (weekly ? m.wclaimed : m.claimed)[key] = true;
    give(it.rw);
    G.audio.sfx('claim');
    G.haptic(12);
    G.ui.toast(`任務達成！ ${rwText(it.rw)}`, 'good');
    G.sim.save();
    G.ui.refreshHud();
    G.ui.renderSheet();
  }
  function claimBonus() {
    const st = G.state;
    const m = ensure();
    if (m.bonus || !dailyList().every((x) => x.claimed)) return;
    m.bonus = true;
    st.stats.dailyClears = (st.stats.dailyClears || 0) + 1;
    give(ALL_CLEAR);
    G.audio.sfx('rarity', 3);
    G.haptic(24);
    G.ui.fx.confetti();
    G.ui.toast(`今日の任務をすべて達成！ ${rwText(ALL_CLEAR)}`, 'rare3');
    G.sim.save();
    G.ui.refreshHud();
    G.ui.renderSheet();
  }

  // 1秒ごと：達成したらお知らせ・日付が変わったら入れ替え
  let acc = 0;
  M.tick = function (dt) {
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    const m = ensure();
    m.notified = m.notified || {};
    dailyList().concat(weeklyList()).forEach((x) => {
      if (x.done && !x.claimed && !m.notified[x.key]) {
        m.notified[x.key] = true;
        G.ui.toast(`任務「${x.text}」を達成しました。任務から受け取れます`, 'good', 'mission');
        G.audio.sfx('claim');
      }
    });
    const n = M.claimable();
    const b = G.$('#missionBtn .nb');
    if (b) { b.hidden = !n; b.textContent = n; }
    const btn = G.$('#missionBtn');
    if (btn) btn.classList.toggle('ready', n > 0);
  };

  // ---------------------------------------------------------------- 画面
  const ICON = {
    dispatch: 'scroll', watch: 'book', great: 'clover', chest: 'key', enhance: 'stone', like: 'book2', post: 'book2', build: 'hourglass', tips: 'coinbag', use: 'hourglass', mat: 'stone', abyss: 'horn',
    w_dispatch: 'scroll', w_watch: 'book', w_great: 'clover', w_daily: 'horn',
  };
  M.render = function (body) {
    const m = ensure();
    const d = dailyList(), w = weeklyList();
    const now = new Date(G.now() * 1000);
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000;
    const allClaimed = d.every((x) => x.claimed);
    const row = (x) => {
      const icon = ICON[x.key] || (x.weekly ? 'horn' : 'scroll');
      const pct = Math.round((x.cur / x.n) * 100);
      return `<div class="card mis ${x.claimed ? 'got' : x.done ? 'done' : ''}"><img alt="" src="${G.ui.itemThumb({ kind: 'cons', id: icon, rarity: x.weekly ? 3 : 1, name: '' }, 40)}"><div class="grow"><b>${G.esc(x.text)}</b><div class="bar"><i style="width:${pct}%"></i></div><small>${x.cur}/${x.n} ・ ${rwText(x.rw)}</small></div>${x.claimed ? '<span class="stamp">達成</span>' : `<button class="btn sm ${x.done ? 'go' : ''}" data-mis="${x.key}" data-weekly="${x.weekly ? 1 : 0}" ${x.done ? '' : 'disabled'}>${x.done ? '受け取る' : `あと${x.n - x.cur}`}</button>`}</div>`;
    };
    let h = `<div class="sec"><h3>今日の任務 <small>${d.filter((x) => x.claimed).length}/${d.length}</small><span class="h-right">入れ替えまで <b data-countdown="${next}">${G.fmtClock(next - G.now())}</b></span></h3>${d.map(row).join('')}
      <div class="card mis-bonus ${m.bonus ? 'got' : allClaimed ? 'done' : ''}"><img alt="" src="${G.ui.itemThumb({ kind: 'cons', id: 'key', rarity: 3, name: '' }, 44)}"><div class="grow"><b>ぜんぶ達成ボーナス</b><small>今日の任務を5つ受け取ると ・ ${rwText(ALL_CLEAR)}</small></div>${m.bonus ? '<span class="stamp">達成</span>' : `<button class="btn sm ${allClaimed ? 'go pulse' : ''}" id="misBonus" ${allClaimed ? '' : 'disabled'}>${allClaimed ? '受け取る' : 'あと' + d.filter((x) => !x.claimed).length}</button>`}</div></div>`;
    h += `<div class="sec"><h3>今週の任務 <small>${w.filter((x) => x.claimed).length}/${w.length}</small><span class="h-right">月曜に入れ替え</span></h3>${w.map(row).join('')}</div>`;
    body.innerHTML = h;
    G.$$('[data-mis]', body).forEach((b) => b.addEventListener('click', () => claim(b.dataset.mis, b.dataset.weekly === '1')));
    const bb = G.$('#misBonus', body);
    if (bb) bb.addEventListener('click', claimBonus);
  };
})();
