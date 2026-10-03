/* ギルドの灯 — reels: 冒険譚（縦スワイプのショート動画）
 * 依頼の結果は「冒険譚」として届き、見ると報酬を受け取れる。
 *  - 上スワイプで次へ／下スワイプで前へ／ダブルタップで応援（いいね）
 *  - 結果は再生されるまで分からない（変動報酬）
 *  - 連続で見るほどボーナス、最後のカードから次の派遣へ戻れる
 */
'use strict';
(function () {
  const R = (G.reels = {});
  const D = G.D;
  const art = G.art;

  // ---------------------------------------------------------------- data
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  R.rng = mulberry;

  function fill(tpl, ctx) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : '');
  }

  let seq = 1;
  R.make = function ({ q, party, tier, gold, mat, fame, levelUps, extra, endAt }) {
    const st = G.state;
    const area = D.AREA_BY_ID[q.area];
    const md = D.MONSTERS[q.monster];
    const leader = party[0];
    const ctx = { area: area.short, monster: md.name, verb: md.verb, leader: leader ? leader.name : '', cls: leader ? D.CLASSES[leader.cls].name : '' };
    const caption = q.boss ? '紅蓮竜王、ついに討伐。ギルドの名が王国中に響く' : fill(G.pick(D.CAPTIONS[tier]), ctx);
    const tags = D.TAGS[tier].slice().sort(() => Math.random() - 0.5).slice(0, 3).map((t) => fill(t, ctx));
    const viewsBase = { fail: [300, 1600], ok: [900, 4200], great: [12000, 58000], legend: [120000, 520000] }[tier];
    const views = Math.round(G.rand(viewsBase[0], viewsBase[1]));
    // コメント欄：ギルドの仲間・町の人
    const others = st.adv.filter((a) => !party.includes(a));
    const pool = others.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    const comments = pool.map((a) => ({
      name: a.name, look: a.look,
      text: Math.random() < 0.35 && D.TRAIT_COMMENT[a.trait] ? D.TRAIT_COMMENT[a.trait] : G.pick(D.COMMENTS[tier]),
    }));
    comments.push({ name: '受付のリナ', look: null, rina: true, text: tier === 'fail' ? '無事に帰ってきてくれて、よかった…' : G.pick(['おつかれさまでした！', '報告書、受け取りました♪', 'さすがです！']) });
    if (st.fac.tavern > 0 && Math.random() < 0.6) comments.push({ name: '酒場の常連', look: null, text: G.pick(['酒場で話題になってるよ', '一杯おごらせて！', 'ファンになりました']) });
    let recruit = null;
    if (extra === 'recruit') {
      const cls = G.pick(G.sim.unlockedClasses(st));
      recruit = G.sim.makeAdv(cls, Math.max(1, Math.round((leader ? leader.lv : 1) * G.rand(0.5, 0.9))));
    }
    return {
      id: 'r' + Date.now().toString(36) + (seq++),
      ts: endAt,
      quest: q.name,
      area: q.area,
      monster: q.monster,
      count: q.count || 1,
      boss: !!q.boss,
      party: party.map((a) => ({ id: a.id, name: a.name, cls: a.cls, lv: a.lv, look: a.look, trait: a.trait })),
      tier, gold, mat, fame,
      levelUps: levelUps || [],
      extra, recruit,
      caption, tags, comments,
      views, likes: Math.round(views * G.rand(0.05, 0.12)),
      song: G.pick(D.SONGS),
      liked: false,
      claimed: false,
      seed: Math.floor(Math.random() * 1e9),
    };
  };
  R.makeDigest = function (sum) {
    return {
      id: 'd' + Date.now().toString(36), ts: G.now(), digest: true, n: sum.n,
      quest: '留守中の冒険まとめ', area: 'meadow', monster: null, party: [], tier: 'ok',
      gold: sum.gold, mat: sum.mat, fame: sum.fame, levelUps: [], caption: `留守の間に ${sum.n} 件の依頼をこなしました`,
      tags: ['#留守番', '#まとめ'], comments: [{ name: '受付のリナ', rina: true, text: 'ぜんぶ記録しておきました！' }],
      views: 999, likes: 99, song: D.SONGS[0], liked: false, claimed: false, seed: 7,
    };
  };

  // 戦闘の段取り（seed から決定的に作る）
  function plan(reel) {
    const rnd = mulberry(reel.seed);
    const beats = [];
    const n = reel.party.length || 1;
    const fail = reel.tier === 'fail';
    const times = [1.85, 2.35, 2.85, 3.35];
    times.forEach((t, i) => {
      if (fail && i >= 2) beats.push({ t, kind: 'mon', target: Math.floor(rnd() * n), big: i === 3 });
      else if (!fail && i === 2 && rnd() < 0.45) beats.push({ t, kind: 'mon', target: Math.floor(rnd() * n), big: false });
      else beats.push({ t, kind: 'hit', who: i % n, dmg: Math.round(G.lerp(8, 40, rnd()) * (1 + (reel.party[i % n] ? reel.party[i % n].lv : 1) * 0.6)), crit: rnd() < (reel.tier === 'great' || reel.tier === 'legend' ? 0.5 : 0.15) });
    });
    return beats;
  }

  // ---------------------------------------------------------------- player state
  let root, cv, ctx, dpr = 1, W = 0, H = 0, k = 1, Hd = 640, ox = 0, safeB = 0;
  let items = []; // reel or {end:true}
  let pos = 0, target = 0, anim = null;
  let rt = 0; // current reel time
  let paused = false, holdTimer = null;
  let parts = [];
  let lastTapT = 0, lastTapX = 0, lastTapY = 0;
  let drag = null;
  let sessionGold = 0, sessionCount = 0, cheer = 0;
  let firedFor = null, fired = {};
  let open = false;
  let rewatch = false;
  let banner = null; // ランクアップなど
  let hintShown = false;
  let rankedInFeed = 0;
  R.isOpen = () => open;

  R.init = function () {
    root = G.$('#reels');
    cv = G.$('#reelCanvas');
    ctx = cv.getContext('2d');
    window.addEventListener('resize', () => { if (open) resize(); });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    G.$('#reelClose').addEventListener('click', () => R.close());
    G.$('#reelAll').addEventListener('click', () => claimAll());
    G.$('#reelLike').addEventListener('click', (e) => { e.stopPropagation(); like(null); });
    G.$('#reelComments').addEventListener('click', (e) => { e.stopPropagation(); openComments(); });
    G.$('#commentsClose').addEventListener('click', () => closeComments());
    G.$('#commentsBackdrop').addEventListener('click', () => closeComments());
    G.$('#endQuests').addEventListener('click', () => { R.close(); setTimeout(() => G.ui.openSheet('quests'), 260); });
    G.$('#endBack').addEventListener('click', () => R.close());
    G.$('#endHistory').addEventListener('click', () => startRewatch());
    G.on('rankup', () => {
      if (open) {
        banner = { text: `ギルドランク ${G.state.rank} に上がった！`, t: 0 };
        rankedInFeed++;
        for (let i = 0; i < 40; i++) addPart(confettiP(G.rand(0, 360), -10));
        G.audio.sfx('rankup');
      }
    });
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = root.clientWidth;
    H = root.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    k = Math.min(W / 360, H / 600);
    ox = (W - 360 * k) / 2;
    Hd = H / k;
    const probe = G.$('#safeProbe');
    safeB = probe ? probe.offsetHeight / k : 0;
    placeHitAreas();
  }

  R.unseen = () => G.state.reels.filter((r) => !r.claimed);
  R.pendingGold = () => R.unseen().reduce((x, r) => x + r.gold, 0);

  R.open = function () {
    if (open) return;
    const unseen = R.unseen().sort((a, b) => (a.digest ? -1 : b.digest ? 1 : a.ts - b.ts));
    // 一番いい結果は少しだけ後ろに置く（期待を溜める）
    if (unseen.length >= 3) {
      const rankT = { fail: 0, ok: 1, great: 2, legend: 3 };
      let bi = 0;
      unseen.forEach((r, i) => { if (rankT[r.tier] > rankT[unseen[bi].tier]) bi = i; });
      if (bi === 0 && rankT[unseen[0].tier] >= 2 && !unseen[0].digest) {
        const best = unseen.splice(0, 1)[0];
        unseen.splice(2, 0, best);
      }
    }
    items = unseen.concat([{ end: true }]);
    rewatch = false;
    pos = target = 0;
    anim = null;
    rt = 0;
    parts = [];
    sessionGold = 0;
    sessionCount = 0;
    rankedInFeed = 0;
    cheer = 0;
    fired = {};
    firedFor = null;
    paused = false;
    open = true;
    G.state.streak = 0;
    root.hidden = false;
    root.classList.remove('closing');
    requestAnimationFrame(() => root.classList.add('shown'));
    resize();
    G.audio.playTrack('reels');
    G.audio.sfx('open');
    updateDom();
    hintShown = G.state.stats.reels > 2;
    G.$('#reelHint').hidden = hintShown || items.length < 2;
    G.emit('reelsOpen');
  };

  R.close = function () {
    if (!open) return;
    // 見ていた冒険譚は受け取り済みにする
    const cur = items[Math.round(pos)];
    if (cur && !cur.end && !cur.claimed && rt > 0.6) claim(cur, true);
    open = false;
    closeComments();
    root.classList.remove('shown');
    root.classList.add('closing');
    setTimeout(() => { if (!open) root.hidden = true; }, 320);
    G.audio.playTrack('guild');
    G.audio.sfx('close');
    G.sim.save();
    G.emit('reelsClosed', { count: sessionCount, gold: sessionGold, ranked: rankedInFeed });
  };

  function startRewatch() {
    const past = G.state.reels.filter((r) => r.claimed && !r.digest).slice(-12);
    if (!past.length) { G.ui.toast('まだ冒険譚がありません'); return; }
    items = past.concat([{ end: true }]);
    rewatch = true;
    pos = target = 0;
    rt = 0;
    fired = {};
    updateDom();
  }

  // ---------------------------------------------------------------- claim
  function claim(reel, quick) {
    if (rewatch || reel.claimed) return;
    const st = G.state;
    const bonus = Math.min(0.3, st.streak * 0.05) + cheer * 0.01;
    const res = G.sim.claimReel(reel, bonus);
    if (!res) return;
    st.streak++;
    sessionCount++;
    sessionGold += res.gold;
    const from = rewardScreenPos();
    if (res.gold > 0) G.ui.flyCoins(from[0], from[1], res.gold, false, G.$('#reelGold'));
    G.ui.refreshHud();
    updateDom();
    if (quick) G.audio.sfx('coins');
  }
  function claimAll() {
    const left = items.filter((r) => !r.end && !r.claimed);
    if (!left.length) return;
    let gold = 0;
    left.forEach((r) => {
      const res = G.sim.claimReel(r, 0);
      if (res) { gold += res.gold; sessionGold += res.gold; sessionCount++; }
    });
    G.ui.flyCoins(W / 2, H / 2, gold, false, G.$('#reelGold'));
    G.audio.sfx('coins');
    G.ui.toast(`${left.length}本ぶん まとめて受け取りました（+${G.fmt(gold)}G）`);
    // 最後のカードへ
    goTo(items.length - 1);
    G.ui.refreshHud();
    updateDom();
  }
  function rewardScreenPos() {
    return [ox + 180 * k, (Hd * 0.42) * k];
  }

  // ---------------------------------------------------------------- input
  function onDown(e) {
    G.audio.init();
    cv.setPointerCapture(e.pointerId);
    drag = { y0: e.clientY, x0: e.clientX, y: e.clientY, t0: performance.now(), lastY: e.clientY, lastT: performance.now(), v: 0, moved: false, pos0: pos };
    anim = null;
    holdTimer = setTimeout(() => {
      if (drag && !drag.moved) { paused = true; drag.hold = true; G.$('#reelPause').hidden = false; }
    }, 380);
  }
  function onMove(e) {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 8) { drag.moved = true; clearTimeout(holdTimer); }
    if (!drag.moved) return;
    let p = drag.pos0 - dy / H;
    // 端はゴムのように
    if (p < 0) p = -Math.pow(-p, 0.7) * 0.3;
    if (p > items.length - 1) p = items.length - 1 + Math.pow(p - (items.length - 1), 0.7) * 0.3;
    pos = p;
    const now = performance.now();
    drag.v = G.lerp(drag.v, (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT), 0.5);
    drag.lastY = e.clientY;
    drag.lastT = now;
  }
  function onUp(e) {
    if (!drag) return;
    clearTimeout(holdTimer);
    const d = drag;
    drag = null;
    if (d.hold) { paused = false; G.$('#reelPause').hidden = true; return; }
    if (d.moved) {
      const base = Math.round(d.pos0);
      let to = base;
      const moved = pos - d.pos0;
      if (moved > 0.16 || d.v < -0.45) to = base + 1;
      else if (moved < -0.16 || d.v > 0.45) to = base - 1;
      goTo(G.clamp(to, 0, items.length - 1));
      return;
    }
    // タップ
    const now = performance.now();
    const x = e.clientX, y = e.clientY;
    if (now - lastTapT < 300 && Math.hypot(x - lastTapX, y - lastTapY) < 40) {
      like([x, y]);
      lastTapT = 0;
    } else {
      lastTapT = now; lastTapX = x; lastTapY = y;
      tapCheer(x, y);
    }
  }

  function goTo(i) {
    const cur = Math.round(pos);
    if (i !== cur) {
      const leaving = items[cur];
      // 結果を見る前にスワイプしても、報酬はちゃんと受け取る
      if (leaving && !leaving.end && !leaving.claimed) claim(leaving, true);
      G.audio.sfx('swipe');
      G.haptic(5);
      if (!hintShown) { hintShown = true; G.$('#reelHint').hidden = true; }
    }
    anim = { from: pos, to: i, t: 0, dur: i === cur ? 0.22 : 0.3 };
    target = i;
  }

  function tapCheer(x, y) {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end) return;
    if (rt > 1.6 && rt < 4.2 && !cur.claimed) {
      if (cheer < 10) cheer++;
      for (let i = 0; i < 6; i++) addPart(sparkP((x - ox) / k, y / k, '#ffe27a'));
      addPart({ type: 'text', x: (x - ox) / k, y: y / k - 10, vx: 0, vy: -40, life: 0, max: 0.8, text: '応援！', col: '#fff3b0' });
      G.audio.sfx('cheer');
      G.haptic(4);
    }
  }

  function like(at) {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end) return;
    const p = at ? [(at[0] - ox) / k, at[1] / k] : [326, Hd - 250 - safeB];
    for (let i = 0; i < (at ? 5 : 3); i++) {
      addPart({ type: 'heart', x: p[0] + G.rand(-12, 12), y: p[1] + G.rand(-6, 6), vx: G.rand(-30, 30), vy: G.rand(-120, -60), life: 0, max: G.rand(0.8, 1.2), size: G.rand(16, 30), rot: G.rand(-0.4, 0.4) });
    }
    G.audio.sfx('heart');
    G.haptic(10);
    if (!cur.liked) {
      cur.liked = true;
      cur.likes++;
      if (!rewatch) {
        G.state.stats.likes++;
        // 冒険者の絆が深まる
        cur.party.forEach((pa) => {
          const a = G.state.adv.find((x) => x.id === pa.id);
          if (a && a.bond < 10) a.bond = Math.min(10, a.bond + (a.trait === 'drinker' || a.trait === 'singer' ? 1 : 0.5));
        });
        if (cur.party.length) addPart({ type: 'text', x: 180, y: Hd * 0.3, vx: 0, vy: -24, life: 0, max: 1.4, text: '絆が深まった ♥', col: '#ffb3c6' });
      }
      updateDom();
    }
  }

  // ---------------------------------------------------------------- comments
  function openComments() {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end) return;
    paused = true;
    const list = G.$('#commentsList');
    list.innerHTML = '';
    cur.comments.forEach((c, i) => {
      const row = G.el('div', 'c-row');
      const img = c.look ? `<img alt="" src="${art.portrait(c.look, 40)}">` : `<span class="c-ava ${c.rina ? 'rina' : ''}">${c.rina ? '受' : '町'}</span>`;
      row.innerHTML = `${img}<div class="c-body"><b>${G.esc(c.name)}</b><p>${G.esc(c.text)}</p></div><span class="c-like">♡ ${G.randi(1, 40)}</span>`;
      row.style.animationDelay = i * 60 + 'ms';
      list.appendChild(row);
    });
    G.$('#commentsCount').textContent = `コメント ${cur.comments.length}件`;
    G.$('#comments').hidden = false;
    requestAnimationFrame(() => G.$('#comments').classList.add('shown'));
    G.audio.sfx('open');
  }
  function closeComments() {
    const el = G.$('#comments');
    if (!el || el.hidden) return;
    el.classList.remove('shown');
    setTimeout(() => { el.hidden = true; }, 260);
    paused = false;
  }

  // ---------------------------------------------------------------- DOM
  function placeHitAreas() {
    const set = (id, x, y, w, h) => {
      const el = G.$(id);
      el.style.left = (ox + (x - w / 2) * k) + 'px';
      el.style.top = ((y - h / 2) * k) + 'px';
      el.style.width = w * k + 'px';
      el.style.height = h * k + 'px';
    };
    set('#reelLike', 326, Hd - 250 - safeB, 52, 60);
    set('#reelComments', 326, Hd - 185 - safeB, 52, 60);
  }
  function updateDom() {
    const st = G.state;
    const idx = Math.round(target);
    const reelCount = items.length - 1;
    const cur = items[idx];
    G.$('#reelTitle').textContent = rewatch ? '過去の冒険譚' : cur && cur.end ? '冒険譚' : `冒険譚 ${idx + 1}/${reelCount}`;
    G.$('#reelGold').querySelector('b').textContent = G.fmt(st.gold);
    const left = items.filter((r) => !r.end && !r.claimed).length;
    G.$('#reelAll').hidden = rewatch || left < 2;
    G.$('#reelAll').textContent = `まとめて受け取る（${left}）`;
    const streak = Math.min(0.3, st.streak * 0.05);
    const sc = G.$('#reelStreak');
    sc.hidden = rewatch || streak <= 0 || (cur && cur.end) || !items.some((r) => !r.end && !r.claimed);
    sc.textContent = `連続視聴ボーナス +${Math.round(streak * 100)}%`;
    const showHit = cur && !cur.end;
    G.$('#reelLike').hidden = !showHit;
    G.$('#reelComments').hidden = !showHit;
    // 最後のカード
    const end = G.$('#reelEnd');
    if (cur && cur.end) fillEnd();
    end.dataset.active = cur && cur.end ? '1' : '0';
  }

  function fillEnd() {
    const st = G.state;
    const box = G.$('#endActive');
    box.innerHTML = '';
    const now = G.now();
    const act = st.active.slice().sort((a, b) => a.endAt - b.endAt);
    G.$('#endTitle').textContent = rewatch ? 'ここまでが最近の冒険譚です' : sessionCount ? 'すべての冒険譚を見ました' : '新しい冒険譚はまだありません';
    G.$('#endSummary').textContent = sessionCount ? `${sessionCount}本 視聴 ・ +${G.fmt(sessionGold)}G` : '';
    if (act.length) {
      const next = act[0];
      G.$('#endNext').innerHTML = `次の冒険譚まで <b data-countdown="${next.endAt}">${G.fmtClock(next.endAt - now)}</b>`;
      act.forEach((ex) => {
        const adv = st.adv.find((a) => a.id === ex.party[0]);
        const row = G.el('div', 'end-row');
        const k2 = G.clamp((now - ex.startAt) / (ex.endAt - ex.startAt), 0, 1);
        row.innerHTML = `${adv ? `<img alt="" src="${art.portrait(adv.look, 36)}">` : ''}<div><b>${G.esc(ex.q.name)}</b><div class="bar"><i style="width:${k2 * 100}%" data-progress="${ex.startAt},${ex.endAt}"></i></div></div><span data-countdown="${ex.endAt}">${G.fmtClock(ex.endAt - now)}</span>`;
        box.appendChild(row);
      });
    } else {
      G.$('#endNext').textContent = '遠征中のパーティはいません';
    }
    const idle = st.adv.filter((a) => a.status === 'idle').length;
    const free = G.sim.slots() - st.active.length;
    const btn = G.$('#endQuests');
    btn.classList.toggle('pulse', idle > 0 && free > 0);
    btn.textContent = idle > 0 && free > 0 ? `依頼を出す（待機中 ${idle}人）` : '依頼を見る';
    G.$('#endHistory').hidden = rewatch || !st.reels.some((r) => r.claimed && !r.digest);
  }

  // ---------------------------------------------------------------- update
  R.update = function (dt) {
    if (!open) return;
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      pos = G.lerp(anim.from, anim.to, G.ease.outCubic(anim.t));
      if (anim.t >= 1) {
        pos = anim.to;
        anim = null;
        if (firedFor !== items[pos]) { rt = 0; fired = {}; cheer = 0; parts = []; }
        updateDom();
      }
    }
    const idx = Math.round(pos);
    const cur = items[idx];
    const settled = !anim && !drag;
    if (cur && !cur.end && settled && !paused) {
      if (firedFor !== cur) { firedFor = cur; rt = 0; fired = {}; cheer = 0; }
      // 伝説級はとどめの瞬間だけスローモーション
      const slow = cur.tier === 'legend' && rt > 3.75 && rt < 4.4 ? 0.35 : 1;
      rt += dt * slow;
      events(cur);
      const autoAt = cur.tier === 'legend' ? 9.2 : cur.digest ? 4.5 : 7.4;
      if (G.state.settings.autoplay && rt > autoAt && !G.$('#comments').classList.contains('shown')) goTo(Math.min(items.length - 1, idx + 1));
    }
    // パーティクル
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
    // カウントダウン
    G.$$('#reelEnd [data-countdown]').forEach((el) => { el.textContent = G.fmtClock(+el.dataset.countdown - G.now()); });
    G.$$('#reelEnd [data-progress]').forEach((el) => {
      const [a, b] = el.dataset.progress.split(',').map(Number);
      el.style.width = G.clamp((G.now() - a) / (b - a), 0, 1) * 100 + '%';
    });
    const end = G.$('#reelEnd');
    const endIdx = items.length - 1;
    end.style.transform = `translateY(${(endIdx - pos) * H}px)`;
    end.style.visibility = Math.abs(endIdx - pos) < 1.01 ? 'visible' : 'hidden';
    // ボタンは今の動画と一緒に動く
    const off = (idx - pos) * H;
    G.$('#reelLike').style.transform = G.$('#reelComments').style.transform = `translateY(${off}px)`;
  };

  function once(key, at) {
    if (rt >= at && !fired[key]) { fired[key] = true; return true; }
    return false;
  }

  function events(reel) {
    if (reel.digest) {
      if (once('roll', 0.5)) G.audio.sfx('roll');
      if (once('rev', 1.2)) {
        G.audio.sfx('reveal', 'great');
        for (let i = 0; i < 40; i++) addPart(confettiP(180 + G.rand(-60, 60), Hd * 0.45));
      }
      if (once('claim', 1.5)) claim(reel);
      return;
    }
    const beats = reel._plan || (reel._plan = plan(reel));
    const L = layout(reel);
    if (once('whoosh', 1.1)) G.audio.sfx('whoosh');
    beats.forEach((b, i) => {
      if (once('b' + i, b.t + 0.18)) {
        if (b.kind === 'hit') {
          const who = reel.party[b.who];
          G.audio.sfx(who && (who.cls === 'mage' || who.cls === 'cleric') ? 'magic' : 'hit');
          if (who && who.cls === 'warrior') G.audio.sfx('slash');
          for (let j = 0; j < (b.crit ? 14 : 8); j++) addPart(shardP(L.mx - 6, L.gy - L.mh * 0.5, D.MONSTERS[reel.monster].color));
          addPart({ type: 'dmg', x: L.mx + G.rand(-10, 10), y: L.gy - L.mh - 10, vx: G.rand(-10, 10), vy: -70, g: 120, life: 0, max: 0.9, text: String(b.dmg), crit: b.crit });
          G.haptic(b.crit ? 14 : 6);
        } else {
          G.audio.sfx('hit');
          const px = L.px[b.target] || L.px[0];
          for (let j = 0; j < 6; j++) addPart(sparkP(px, L.gy - 40, '#ffffff'));
          addPart({ type: 'dmg', x: px, y: L.gy - 90, vx: 0, vy: -60, g: 120, life: 0, max: 0.9, text: b.big ? 'ぐはっ' : 'いてっ', crit: false, hurt: true });
        }
      }
    });
    const fail = reel.tier === 'fail';
    if (!fail && once('pop', 3.9)) {
      G.audio.sfx('pop');
      const col = D.MONSTERS[reel.monster].color;
      for (let i = 0; i < 46; i++) addPart(shardP(L.mx, L.gy - L.mh * 0.5, col, true));
      if (reel.tier === 'legend' || reel.tier === 'great') G.haptic(22);
    }
    if (fail && once('flee', 3.9)) G.audio.sfx('whoosh');
    if (!fail && once('drop', 4.25)) G.audio.sfx('bounce');
    if (!fail && once('drop2', 4.55)) G.audio.sfx('bounce');
    if (once('roll', 4.62)) G.audio.sfx('roll');
    if (once('reveal', 5.25)) {
      G.audio.sfx('chest');
      G.audio.sfx('reveal', reel.tier);
      const n = { fail: 0, ok: 16, great: 60, legend: 120 }[reel.tier];
      for (let i = 0; i < n; i++) addPart(confettiP(180 + G.rand(-40, 40), L.gy - 20));
      if (reel.tier === 'legend') { flashT = 0.6; G.haptic(40); }
    }
    ['g', 'm', 'f'].forEach((key, i) => { if (once('tick' + key, 5.45 + i * 0.18)) G.audio.sfx('tick'); });
    if (once('claim', 5.6)) claim(reel);
    if (reel.levelUps.length && once('lv', 5.95)) {
      G.audio.sfx('levelup');
      reel.levelUps.forEach((lu) => {
        const i = reel.party.findIndex((p) => p.id === lu.id);
        const x = L.px[i] != null ? L.px[i] : 180;
        for (let j = 0; j < 12; j++) addPart(sparkP(x, L.gy - 60, '#9fe8ff'));
      });
    }
    if (reel.extra === 'recruit' && once('recruit', 6.2)) G.audio.sfx('door');
  }
  let flashT = 0;

  // ---------------------------------------------------------------- particles
  function addPart(p) { if (parts.length < 500) parts.push(p); }
  function sparkP(x, y, col) {
    return { type: 'spark', x, y, vx: G.rand(-90, 90), vy: G.rand(-140, -30), g: 200, life: 0, max: G.rand(0.4, 0.8), col, size: G.rand(2, 4.5), rot: G.rand(0, 6) };
  }
  function confettiP(x, y) {
    return { type: 'tri', x, y, vx: G.rand(-160, 160), vy: G.rand(-380, -120), g: 420, life: 0, max: G.rand(1.6, 2.6), col: G.pick(['#ffcf4a', '#ff7a6a', '#6ad0ff', '#8fe08a', '#c79bff', '#ffffff']), size: G.rand(4, 7.5), rot: G.rand(0, 6), vr: G.rand(-9, 9) };
  }
  function shardP(x, y, col, big) {
    const a = G.rand(0, Math.PI * 2), sp = G.rand(60, big ? 320 : 160);
    return { type: 'tri', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 380, life: 0, max: G.rand(0.6, 1.2), col: G.shade(col, G.rand(-0.25, 0.25)), size: G.rand(3, big ? 9 : 5), rot: G.rand(0, 6), vr: G.rand(-12, 12) };
  }

  // ---------------------------------------------------------------- render
  function layout(reel) {
    const gy = Hd * 0.6;
    const n = reel.party.length || 1;
    const px = [];
    const sp = n >= 4 ? 38 : 46;
    for (let i = 0; i < n; i++) px.push(150 - i * sp);
    const mh = (art.monsterHeight[reel.monster] || 40);
    const ms = reel.monster === 'dragon' ? 1.55 : reel.monster === 'slime' ? 2.4 : mh > 50 ? 1.7 : 2.1;
    return { gy, px, mx: 268, mh: mh * ms, ms };
  }

  R.render = function () {
    if (!open) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d0a10';
    ctx.fillRect(0, 0, W, H);
    const i0 = Math.floor(pos), i1 = Math.ceil(pos);
    [i0, i1].forEach((i, n) => {
      if (n === 1 && i1 === i0) return;
      const it = items[i];
      if (!it || it.end) return;
      const off = (i - pos) * H;
      ctx.save();
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * off);
      ctx.beginPath();
      ctx.rect(0, 0, 360, Hd);
      ctx.clip();
      const cur = i === Math.round(pos);
      const t = cur ? rt : (it.claimed ? 6 : 0.4);
      drawReel(it, t, cur);
      ctx.restore();
    });
    // パーティクル（現在の動画の上）
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * (Math.round(pos) - pos) * H);
    drawParts();
    if (flashT > 0) {
      flashT -= 1 / 60;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, flashT)})`;
      ctx.fillRect(0, 0, 360, Hd);
    }
    if (banner) drawBanner();
  };

  function drawReel(reel, t, cur) {
    if (reel.digest) { drawDigest(reel, t); drawOverlay(reel, t, cur); return; }
    const area = D.AREA_BY_ID[reel.area];
    const L = layout(reel);
    const beats = reel._plan || (reel._plan = plan(reel));
    const fail = reel.tier === 'fail';
    // 画面の揺れ
    let shx = 0, shy = 0;
    beats.forEach((b) => {
      const d = t - (b.t + 0.18);
      if (d > 0 && d < 0.3) {
        const a = (1 - d / 0.3) * (b.crit || b.big ? 7 : 3.5);
        shx += Math.sin(d * 90) * a;
        shy += Math.cos(d * 70) * a * 0.6;
      }
    });
    if (!fail && t > 3.9 && t < 4.2) { const a = (1 - (t - 3.9) / 0.3) * 8; shx += Math.sin(t * 100) * a; }
    ctx.save();
    ctx.translate(shx, shy);
    // 背景のスクロール（歩いている間だけ進む）
    const walkK = G.clamp(t / 1.1, 0, 1);
    const scroll = G.ease.outCubic(walkK) * 120 + (fail && t > 3.9 ? -(t - 3.9) * 200 : 0);
    drawBg(area, scroll, t, L.gy);
    // 魔物
    const mIn = G.ease.outBack(G.seg(t, 1.1, 1.55));
    const mDead = !fail && t > 3.9;
    if (!mDead && t > 1.0) {
      let atk = 0, hit = 0, kx = 0;
      beats.forEach((b) => {
        if (b.kind === 'mon') {
          const d = t - b.t;
          if (d > 0 && d < 0.45) atk = G.bump(d / 0.45);
        } else {
          const d = t - (b.t + 0.18);
          if (d > 0 && d < 0.25) { hit = 1 - d / 0.25; kx = G.bump(d / 0.25) * 10; }
        }
      });
      const mx = L.mx + (1 - mIn) * 170 + kx;
      const count = Math.min(3, reel.count || 1);
      for (let c = count - 1; c >= 0; c--) {
        ctx.save();
        const sc = L.ms * (c ? 0.78 : 1);
        ctx.translate(mx + c * 34, L.gy - c * 6);
        ctx.scale(-sc, sc);
        art.setFlash(c === 0 ? hit * 0.85 : 0);
        art.monster[reel.monster](ctx, { t: t + c * 0.7, atk: c === 0 ? atk : 0, color: D.MONSTERS[reel.monster].color });
        art.setFlash(0);
        ctx.restore();
      }
      if (reel.boss) {
        ctx.fillStyle = 'rgba(255,80,40,0.12)';
        ctx.beginPath(); ctx.arc(mx, L.gy - 70, 110, 0, Math.PI * 2); ctx.fill();
      }
    }
    // パーティ
    reel.party.forEach((p, i) => {
      let x = L.px[i] - (1 - G.ease.outCubic(walkK)) * 200;
      let state = walkK < 1 ? 'walk' : 'stand';
      let facing = 1, swing = 0, armed = true, expr = null;
      let y = L.gy;
      const phase = t * 9 + i;
      beats.forEach((b) => {
        if (b.kind === 'hit' && b.who === i) {
          const d = t - b.t;
          const melee = p.cls === 'warrior' || p.cls === 'thief';
          if (d > 0 && d < 0.5) {
            if (melee) {
              const go = G.seg(d, 0, 0.18), back = G.seg(d, 0.22, 0.48);
              x = G.lerp(L.px[i], L.mx - 42, G.ease.outCubic(go) * (1 - G.ease.inOut(back)));
              state = 'lunge';
              swing = G.seg(d, 0.1, 0.24);
            } else {
              state = 'cast';
              if (p.cls === 'archer') { state = 'swing'; swing = G.seg(d, 0, 0.18); }
            }
          }
        }
        if (b.kind === 'mon' && b.target === i) {
          const d = t - (b.t + 0.18);
          if (d > 0 && d < 0.5) { state = 'hurt'; expr = 'hurt'; x -= G.bump(d / 0.5) * 16; }
        }
      });
      // 結末
      if (fail && t > 3.9) {
        state = 'run'; facing = -1; armed = false; expr = 'hurt';
        x -= (t - 3.9) * 260 + i * 10;
      } else if (!fail && t > 5.25) {
        state = 'cheer'; expr = 'happy';
      } else if (t > 1.15 && t < 1.7 && walkK >= 1) {
        expr = null;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.35, 2.35);
      art.person(ctx, p.look, { t: t + i, state, phase, facing, swing, armed, expr, blink: Math.sin(t * 3 + i * 2) > 0.97 });
      ctx.restore();
      // 驚きマーク
      if (t > 1.15 && t < 1.75) {
        const a = G.ease.outBack(G.seg(t, 1.15, 1.3));
        drawMark(x, y - 102, '!', a);
      }
      // 汗
      if (fail && t > 3.9 && t < 5) {
        art.poly(ctx, [x + 14, y - 92, x + 18, y - 84, x + 14, y - 82, x + 11, y - 86], '#9fd8ff');
      }
      // 投射物
      beats.forEach((b) => {
        if (b.kind !== 'hit' || b.who !== i) return;
        if (p.cls === 'warrior' || p.cls === 'thief') return;
        const d = t - b.t;
        if (d > 0 && d < 0.18) {
          const kk = d / 0.18;
          const fx = G.lerp(x + 20, L.mx - 10, kk), fy = G.lerp(y - 60, L.gy - L.mh * 0.5, kk) - Math.sin(kk * Math.PI) * 20;
          if (p.cls === 'archer') {
            ctx.save(); ctx.translate(fx, fy); ctx.rotate(-0.2 + kk * 0.4);
            art.poly(ctx, [-14, -1, 8, -1, 8, 1, -14, 1], '#7a5230');
            art.poly(ctx, [8, -3, 14, 0, 8, 3], '#d8dce8');
            ctx.restore();
          } else {
            const col = p.cls === 'cleric' ? '#fff3b0' : '#9fd8ff';
            ctx.fillStyle = G.rgba(col, 0.35);
            ctx.beginPath(); ctx.arc(fx, fy, 16, 0, Math.PI * 2); ctx.fill();
            art.facet(ctx, fx, fy, 8, 8, 6, col, t * 20, 0.3);
          }
        }
      });
      // レベルアップ
      const lu = reel.levelUps.find((l) => l.id === p.id);
      if (lu && t > 5.95) {
        const a = G.seg(t, 5.95, 6.2);
        const yy = y - 120 - G.ease.outCubic(G.seg(t, 5.95, 6.6)) * 18;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '900 15px "Dela Gothic One", "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1b3550';
        ctx.strokeText('LEVEL UP!', x, yy);
        ctx.fillStyle = '#9fe8ff';
        ctx.fillText('LEVEL UP!', x, yy);
        ctx.font = '800 11px "M PLUS Rounded 1c", sans-serif';
        ctx.strokeText(`Lv${lu.to}`, x, yy + 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Lv${lu.to}`, x, yy + 14);
        ctx.restore();
      }
    });
    // 宝箱
    if (!fail && t > 4.0) {
      const dropT = G.seg(t, 4.0, 4.6);
      const by = dropT < 1 ? -Math.abs(Math.cos(dropT * Math.PI * 2.2)) * (1 - dropT) * 160 : 0;
      const open = G.ease.outBack(G.seg(t, 5.25, 5.55));
      const shakeC = t > 4.62 && t < 5.25 ? Math.sin(t * 60) * (t - 4.62) * 3 : 0;
      const cx = 222;
      // 光
      if (t > 5.25) drawRays(cx, L.gy - 40, reel.tier, t);
      ctx.save();
      ctx.translate(cx + shakeC, L.gy + by);
      ctx.scale(2.2, 2.2);
      art.ellipse(ctx, 0, 0, 18, 3, 'rgba(0,0,0,0.25)');
      art.chest(ctx, open, reel.tier, t);
      ctx.restore();
    }
    // 失敗：小袋
    if (fail && t > 4.3) {
      ctx.save();
      ctx.translate(196, L.gy);
      ctx.scale(2, 2);
      art.ellipse(ctx, 0, 0, 8, 2, 'rgba(0,0,0,0.25)');
      art.facetPoly(ctx, [-7, 0, 7, 0, 8, -7, 3, -12, -3, -12, -8, -7], '#a08060', 0.15);
      art.poly(ctx, [-3, -12, 3, -12, 4, -14, -4, -14], '#7a5a40');
      ctx.restore();
    }
    // 仲間候補が駆け寄ってくる
    if (reel.extra === 'recruit' && reel.recruit && t > 6.2) {
      const kk = G.ease.outCubic(G.seg(t, 6.2, 7));
      ctx.save();
      ctx.translate(390 - kk * 90, L.gy);
      ctx.scale(2.2, 2.2);
      art.person(ctx, reel.recruit.look, { t, state: kk < 1 ? 'walk' : 'stand', phase: t * 9, facing: -1 });
      ctx.restore();
      if (kk >= 1) drawSpeech(300, L.gy - 104, '仲間にしてください！');
    }
    ctx.restore();

    // タイトルカード
    const tIn = G.ease.outBack(G.seg(t, 0.1, 0.5)) * (1 - G.seg(t, 2.4, 2.8));
    if (tIn > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tIn);
      ctx.translate(180, 168 - (1 - tIn) * 30);
      ctx.textAlign = 'center';
      ctx.font = '800 11px "M PLUS Rounded 1c", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(area.name, 0, -18);
      ctx.font = '400 21px "Dela Gothic One", "M PLUS Rounded 1c", sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(20,12,8,0.55)';
      ctx.strokeText(reel.quest, 0, 6);
      ctx.fillStyle = '#fffaf0';
      ctx.fillText(reel.quest, 0, 6);
      ctx.restore();
    }
    // 結果
    if (t > 5.25) drawResult(reel, t, L);
    drawOverlay(reel, t, cur);
  }

  function drawMark(x, y, ch, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(a, a);
    art.poly(ctx, [-9, -14, 9, -14, 7, 8, -7, 8], '#ffcf4a');
    ctx.font = '900 18px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a2410';
    ctx.fillText(ch, 0, 4);
    ctx.restore();
  }
  function drawSpeech(x, y, text) {
    ctx.save();
    ctx.font = '800 12px "M PLUS Rounded 1c", sans-serif';
    const w = ctx.measureText(text).width + 18;
    art.rrect(ctx, x - w / 2, y - 26, w, 26, 12);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    art.poly(ctx, [x + 10, y - 1, x + 22, y - 1, x + 26, y + 8], '#fffaf0');
    ctx.fillStyle = '#3a2a20';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 9);
    ctx.restore();
  }

  function drawRays(x, y, tier, t) {
    const a = G.seg(t, 5.25, 5.6);
    const n = tier === 'legend' ? 16 : 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (tier === 'legend' ? 0.8 : 0.35));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      let col;
      if (tier === 'legend') col = `hsla(${(i * 360) / n + t * 120},90%,70%,${0.32 * a})`;
      else if (tier === 'great') col = `rgba(255,214,90,${0.32 * a})`;
      else col = `rgba(255,248,220,${0.22 * a})`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.09) * 320, Math.sin(ang - 0.09) * 320);
      ctx.lineTo(Math.cos(ang + 0.09) * 320, Math.sin(ang + 0.09) * 320);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, `rgba(255,240,190,${0.6 * a})`);
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, y - 90, 180, 180);
  }

  function drawResult(reel, t, L) {
    const a = G.ease.outBack(G.seg(t, 5.25, 5.5));
    // バナー
    const label = reel.boss ? '竜王討伐！！' : D.TIER_LABEL[reel.tier];
    ctx.save();
    ctx.translate(180, Hd * 0.2);
    const stamp = 1 + (1 - G.seg(t, 5.25, 5.4)) * 1.4;
    ctx.scale(stamp * a, stamp * a);
    ctx.rotate(-0.06);
    ctx.textAlign = 'center';
    ctx.font = `400 ${reel.tier === 'legend' ? 40 : 34}px "Dela Gothic One", "M PLUS Rounded 1c", sans-serif`;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = reel.tier === 'fail' ? '#2a2a34' : '#3a1e08';
    ctx.strokeText(label, 0, 0);
    if (reel.tier === 'legend') {
      const g = ctx.createLinearGradient(-120, 0, 120, 0);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60 + t * 160},95%,68%)`);
      ctx.fillStyle = g;
    } else ctx.fillStyle = reel.tier === 'great' ? '#ffd65a' : reel.tier === 'fail' ? '#b8bcc8' : '#fff6dc';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    // 報酬カード
    const cy = Hd * 0.2 + 52;
    const items2 = [];
    items2.push({ icon: 'coin', v: reel.gold, label: 'G' });
    if (reel.mat) items2.push({ icon: 'gem', v: reel.mat, label: '素材' });
    if (reel.fame) items2.push({ icon: 'star', v: reel.fame, label: '名声' });
    const w = items2.length * 92;
    ctx.save();
    ctx.globalAlpha = G.seg(t, 5.3, 5.5);
    art.rrect(ctx, 180 - w / 2 - 6, cy - 22, w + 12, 44, 22);
    ctx.fillStyle = 'rgba(20,14,10,0.62)';
    ctx.fill();
    ctx.restore();
    items2.forEach((it, i) => {
      const kk = G.ease.outBack(G.seg(t, 5.45 + i * 0.18, 5.7 + i * 0.18));
      if (kk <= 0) return;
      const x = 180 - w / 2 + 46 + i * 92;
      ctx.save();
      ctx.translate(x, cy);
      ctx.scale(kk, kk);
      if (it.icon === 'coin') art.coin(ctx, -26, 0, 9, t);
      else if (it.icon === 'gem') art.gem(ctx, -26, 0, 10);
      else art.fameStar(ctx, -26, 0, 10);
      // 数字はカウントアップ
      const cnt = Math.round(it.v * G.ease.outCubic(G.seg(t, 5.45 + i * 0.18, 6.0 + i * 0.18)));
      ctx.font = '900 16px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fffaf0';
      ctx.fillText('+' + G.fmt(cnt), -12, 6);
      ctx.restore();
    });
    // ボーナス表示
    const st = G.state;
    const bonus = Math.min(0.3, Math.max(0, st.streak - 1) * 0.05) + cheer * 0.01;
    if (!rewatch && t > 5.7 && (cheer > 0 || bonus > 0)) {
      ctx.save();
      ctx.globalAlpha = G.seg(t, 5.7, 5.9);
      ctx.font = '800 10.5px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe27a';
      const parts2 = [];
      if (cheer > 0) parts2.push(`応援 ×${cheer}`);
      ctx.fillText(parts2.join(' ・ ') + (parts2.length ? '  ' : '') + 'ボーナス込み', 180, cy + 36);
      ctx.restore();
    }
    if (reel.extra === 'cache' && t > 5.8) {
      ctx.save();
      ctx.globalAlpha = G.seg(t, 5.8, 6);
      ctx.font = '800 11px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9c0ff';
      ctx.fillText('隠し財宝を見つけた！ 素材ボーナス', 180, cy + 52);
      ctx.restore();
    }
  }

  // 下部のキャプション・右のボタン（動画と一緒に流れる）
  function drawOverlay(reel, t, cur) {
    const bottom = Hd - safeB;
    // 下のグラデーション
    const g = ctx.createLinearGradient(0, bottom - 200, 0, Hd);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bottom - 200, 360, 200 + safeB);
    const tg = ctx.createLinearGradient(0, 0, 0, 120);
    tg.addColorStop(0, 'rgba(0,0,0,0.45)');
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, 360, 120);

    ctx.textAlign = 'left';
    const lead = reel.party[0];
    const handle = reel.digest ? '@受付のリナ' : `@${lead ? lead.name : '???'}${reel.party.length > 1 ? ` ほか${reel.party.length - 1}名` : ''}`;
    ctx.font = '800 14px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(handle, 16, bottom - 104);
    if (lead) {
      ctx.font = '700 10px "M PLUS Rounded 1c", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const w = ctx.measureText(handle).width;
      ctx.font = '800 14px "M PLUS Rounded 1c", sans-serif';
      const hw = ctx.measureText(handle).width;
      ctx.font = '700 10px "M PLUS Rounded 1c", sans-serif';
      ctx.fillText(`${D.CLASSES[lead.cls].name} Lv${lead.lv}`, 22 + hw, bottom - 104);
      void w;
    }
    // キャプション（2行まで）
    ctx.font = '700 13px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = '#fffaf0';
    const lines = wrap(reel.caption, 262);
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 16, bottom - 82 + i * 18));
    ctx.font = '800 12px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText(reel.tags.join(' '), 16, bottom - 82 + Math.min(2, lines.length) * 18);
    // 音楽のマーキー
    ctx.save();
    ctx.beginPath();
    ctx.rect(34, bottom - 46, 200, 18);
    ctx.clip();
    ctx.font = '700 11px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const sw = ctx.measureText(reel.song).width + 40;
    const mx = 34 - ((t * 28) % sw);
    ctx.fillText(reel.song, mx, bottom - 33);
    ctx.fillText(reel.song, mx + sw, bottom - 33);
    ctx.restore();
    ctx.font = '700 12px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('♪', 18, bottom - 33);

    // 右の列
    const rx = 326;
    // 似顔絵
    if (lead) {
      const ay = bottom - 316;
      ctx.save();
      ctx.beginPath(); ctx.arc(rx, ay, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf0'; ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ay, 20, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = D.CLASSES[lead.cls].color;
      ctx.fillRect(rx - 22, ay - 22, 44, 44);
      ctx.translate(rx - 2, ay + 46);
      ctx.scale(1.55, 1.55);
      art.person(ctx, lead.look, { t: 0.5, state: 'stand', facing: 1, noShadow: true });
      ctx.restore();
      art.ellipse(ctx, rx, ay + 22, 8, 8, '#ff4f6d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx - 4, ay + 21, 8, 2);
      ctx.fillRect(rx - 1, ay + 18, 2, 8);
    }
    // いいね
    const ly = bottom - 250;
    const pulse = reel.liked && cur ? 1 + Math.max(0, 1 - (performance.now() % 100000) / 100000) * 0 : 1;
    art.heart(ctx, rx, ly - 4, 17 * pulse, reel.liked ? '#ff4f6d' : '#f4f0f0');
    ctx.font = '800 11px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(G.fmt(reel.likes), rx, ly + 24);
    // コメント
    const cy = bottom - 185;
    art.rrect(ctx, rx - 15, cy - 16, 30, 24, 10);
    ctx.fillStyle = '#f4f0f0';
    ctx.fill();
    art.poly(ctx, [rx - 6, cy + 7, rx + 2, cy + 7, rx - 8, cy + 14], '#f4f0f0');
    ctx.fillStyle = '#5a4a4a';
    [-7, 0, 7].forEach((d) => { ctx.beginPath(); ctx.arc(rx + d, cy - 4, 2, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#fff';
    ctx.fillText(String(reel.comments.length), rx, cy + 28);
    // 再生数
    ctx.font = '700 10px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`▶ ${G.fmt(reel.views)}`, rx, bottom - 128);
    // 回るレコード
    const ry = bottom - 38;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(t * 1.8);
    art.facet(ctx, 0, 0, 17, 17, 12, '#2a2228', 0, 0.12);
    art.facet(ctx, 0, 0, 7, 7, 8, '#3f7a5e', 0, 0.2);
    art.star(ctx, 0, 0, 4, '#f0c94a');
    ctx.restore();

    // 進行バー
    const total = reel.digest ? 4.5 : reel.tier === 'legend' ? 9.2 : 7.4;
    const kk = G.clamp(t / total, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, Hd - 3, 360, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, Hd - 3, 360 * kk, 3);
    // 伝説級の虹枠
    if (reel.tier === 'legend' && t > 5.25) {
      ctx.save();
      ctx.lineWidth = 5;
      const g2 = ctx.createLinearGradient(0, 0, 360, Hd);
      for (let i = 0; i <= 6; i++) g2.addColorStop(i / 6, `hsla(${i * 60 + t * 120},95%,65%,0.85)`);
      ctx.strokeStyle = g2;
      ctx.strokeRect(2.5, 2.5, 355, Hd - 5);
      ctx.restore();
    }
  }

  const wrapCache = new Map();
  function wrap(text, maxW) {
    const key = text + '|' + maxW;
    if (wrapCache.has(key)) return wrapCache.get(key);
    const out = [];
    let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = ch; } else line = test;
    }
    if (line) out.push(line);
    wrapCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- backgrounds
  function drawBg(area, scroll, t, gy) {
    const p = area.pal;
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, p.sky1);
    g.addColorStop(1, p.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 360, gy + 2);
    const id = area.id;
    // 遠景
    const layer = (col, amp, base, n, par, seed, jag) => {
      const off = -(scroll * par) % (360 / n * 2);
      const pts = [-40, gy + 2];
      for (let i = 0; i <= n + 3; i++) {
        const x = -40 + off + i * (400 / n);
        const h = G.hash(seed + Math.floor(i - (scroll * par) / (400 / n))) * amp;
        pts.push(x, base - h - (jag && i % 2 ? amp * 0.3 : 0));
      }
      pts.push(420, gy + 2);
      art.facetPoly(ctx, pts, col, 0.06);
    };
    if (id === 'meadow') {
      art.facet(ctx, 290, 90, 24, 24, 10, '#fff2b0', t * 0.1, 0.1);
      cloudR(60 - (t * 6 + scroll * 0.1) % 420 + 400, 120, 50);
      cloudR(240 - (t * 4 + scroll * 0.1) % 460 + 200, 70, 36);
      layer(p.far, 60, gy - 70, 6, 0.15, 11, false);
      layer(p.mid, 40, gy - 24, 8, 0.4, 23, false);
      treesR(p, scroll, gy, 'round', t);
    } else if (id === 'forest') {
      layer(p.far, 70, gy - 80, 7, 0.15, 31, true);
      treesR(p, scroll * 0.5, gy - 30, 'pine-far', t);
      layer(p.mid, 20, gy - 10, 8, 0.4, 41, false);
      treesR(p, scroll, gy, 'pine', t);
    } else if (id === 'cave') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, 360, gy);
      // 鍾乳石
      for (let i = 0; i < 9; i++) {
        const x = ((i * 52 - scroll * 0.5) % 470 + 470) % 470 - 50;
        const h = 30 + G.hash(i * 3) * 60;
        art.facetPoly(ctx, [x - 14, 0, x + 14, 0, x, h], p.mid, 0.12);
      }
      layer(p.far, 50, gy - 40, 7, 0.3, 51, true);
      // 光る結晶
      for (let i = 0; i < 6; i++) {
        const x = ((i * 77 - scroll * 0.8) % 480 + 480) % 480 - 60;
        const gl = 0.6 + Math.sin(t * 2 + i) * 0.3;
        ctx.fillStyle = G.rgba('#7fe0ff', 0.2 * gl);
        ctx.beginPath(); ctx.arc(x, gy - 10, 22, 0, Math.PI * 2); ctx.fill();
        art.poly(ctx, [x - 5, gy, x, gy - 26, x + 5, gy], '#7fe0ff');
        art.poly(ctx, [x, gy - 26, x + 5, gy, x + 1, gy], '#bff4ff');
      }
    } else if (id === 'castle') {
      art.facet(ctx, 80, 80, 20, 20, 10, '#f2eedc', 0, 0.1);
      layer(p.far, 40, gy - 60, 6, 0.12, 61, false);
      // 城
      const cx = 220 - scroll * 0.25;
      art.poly(ctx, [cx - 60, gy - 30, cx + 60, gy - 30, cx + 60, gy - 120, cx - 60, gy - 120], p.mid);
      [-60, -20, 20, 60].forEach((d, i) => {
        const h = i % 2 ? 150 : 170;
        art.poly(ctx, [cx + d - 12, gy - 30, cx + d + 12, gy - 30, cx + d + 12, gy - h, cx + d - 12, gy - h], G.shade(p.mid, 0.05));
        art.poly(ctx, [cx + d - 15, gy - h, cx + d + 15, gy - h, cx + d, gy - h - 26], p.near);
        ctx.fillStyle = 'rgba(255,200,120,0.6)';
        ctx.fillRect(cx + d - 2, gy - h + 18, 4, 8);
      });
      layer(p.near, 18, gy - 6, 8, 0.6, 71, false);
      // 霧
      for (let i = 0; i < 4; i++) {
        const x = ((t * 10 + i * 120) % 520) - 80;
        ctx.fillStyle = 'rgba(230,220,240,0.12)';
        ctx.beginPath(); ctx.ellipse(x, gy - 10 - i * 8, 90, 14, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'peak') {
      art.facet(ctx, 270, 110, 34, 34, 10, '#ffe2a0', 0, 0.08);
      layer(p.far, 140, gy - 50, 5, 0.1, 81, true);
      // 雪
      layer(p.mid, 60, gy - 20, 7, 0.35, 91, true);
      for (let i = 0; i < 20; i++) {
        const x = (G.hash(i) * 380 + t * 8) % 380 - 10;
        const y = (G.hash(i * 7) * gy + t * (20 + G.hash(i) * 30)) % gy;
        ctx.fillStyle = 'rgba(255,190,120,0.6)';
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    // 地面
    art.poly(ctx, [0, gy - 2, 360, gy - 2, 360, Hd, 0, Hd], p.ground);
    art.poly(ctx, [0, gy - 2, 360, gy - 2, 360, gy + 3, 0, gy + 3], G.shade(p.ground, 0.12));
    for (let i = 0; i < 16; i++) {
      const x = ((i * 31 - scroll) % 400 + 400) % 400 - 20;
      const y = gy + 14 + G.hash(i * 5) * (Hd - gy - 40);
      art.facet(ctx, x, y, 4 + G.hash(i) * 5, 2 + G.hash(i) * 2, 5, G.shade(p.ground, -0.12), i, 0.14);
    }
    // 環境の粒
    if (id === 'meadow') {
      for (let i = 0; i < 3; i++) {
        const x = (t * 20 + i * 140) % 400 - 20, y = gy - 70 - Math.sin(t * 2 + i) * 20;
        const fl = Math.sin(t * 16 + i) * 4;
        art.poly(ctx, [x, y, x - 5, y - 4 - fl, x - 5, y + 3], '#ffe08a');
        art.poly(ctx, [x, y, x + 5, y - 4 - fl, x + 5, y + 3], '#ffd060');
      }
    } else if (id === 'forest') {
      for (let i = 0; i < 6; i++) {
        const x = (G.hash(i) * 400 + t * 14) % 400 - 20, y = (t * 30 + G.hash(i * 3) * 300) % (gy + 20);
        ctx.save(); ctx.translate(x + Math.sin(t * 2 + i) * 8, y); ctx.rotate(t * 2 + i);
        art.poly(ctx, [-3, 0, 0, -2, 3, 0, 0, 2], '#a8c860');
        ctx.restore();
      }
    } else if (id === 'cave') {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.8 + i * 0.33) % 1);
        ctx.fillStyle = 'rgba(159,232,255,0.7)';
        ctx.fillRect(60 + i * 110, k * gy, 1.5, 4);
      }
    }
  }
  function cloudR(x, y, w) {
    art.poly(ctx, [x - w, y, x - w * 0.6, y - w * 0.4, x - w * 0.1, y - w * 0.55, x + w * 0.5, y - w * 0.35, x + w, y], 'rgba(255,255,255,0.85)');
  }
  function treesR(p, scroll, gy, kind, t) {
    for (let i = 0; i < 7; i++) {
      const span = 460;
      const x = ((i * 70 - scroll * (kind === 'pine-far' ? 0.5 : 0.8)) % span + span) % span - 50;
      const s = 0.8 + G.hash(i * 13) * 0.5;
      const sway = Math.sin(t * 1.2 + i) * 1.2;
      if (kind === 'round') {
        art.poly(ctx, [x - 3, gy, x + 3, gy, x + 2, gy - 30 * s, x - 2, gy - 30 * s], '#7a5230');
        art.facet(ctx, x + sway, gy - 40 * s, 20 * s, 18 * s, 7, p.near, i, 0.16);
      } else {
        const h = (kind === 'pine-far' ? 70 : 100) * s;
        const col = kind === 'pine-far' ? p.mid : p.near;
        art.poly(ctx, [x - 3, gy, x + 3, gy, x + 3, gy - 12, x - 3, gy - 12], '#4a3020');
        for (let j = 0; j < 3; j++) {
          const y0 = gy - 10 - j * h * 0.26;
          const w = (24 - j * 6) * s;
          art.poly(ctx, [x - w, y0, x + w, y0, x + sway * (j + 1) * 0.4, y0 - h * 0.42], G.shade(col, j * 0.04));
          art.poly(ctx, [x - w, y0, x + sway * (j + 1) * 0.4, y0 - h * 0.42, x, y0], G.shade(col, 0.1 + j * 0.04));
        }
      }
    }
  }

  function drawDigest(reel, t) {
    const g = ctx.createLinearGradient(0, 0, 0, Hd);
    g.addColorStop(0, '#2a2240');
    g.addColorStop(1, '#5a3a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 360, Hd);
    const gy = Hd * 0.6;
    ctx.save();
    ctx.translate(180, Hd * 0.2);
    ctx.textAlign = 'center';
    ctx.font = '400 24px "Dela Gothic One", "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = '#fffaf0';
    ctx.fillText('留守中の冒険まとめ', 0, 0);
    ctx.font = '800 13px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${reel.n} 件の依頼をこなしました`, 0, 26);
    ctx.restore();
    if (t > 1.2) drawRays(180, gy - 18, 'great', t + 4.05);
    ctx.save();
    ctx.translate(180, gy);
    ctx.scale(2.6, 2.6);
    art.chest(ctx, G.ease.outBack(G.seg(t, 1.2, 1.5)), 'great', t);
    ctx.restore();
    if (t > 1.2) {
      const fake = { tier: 'ok', gold: reel.gold, mat: reel.mat, fame: reel.fame };
      ctx.save();
      ctx.translate(0, Hd * 0.05);
      drawResultSimple(fake, t);
      ctx.restore();
    }
  }
  function drawResultSimple(r, t) {
    const items2 = [['coin', r.gold], ['gem', r.mat], ['star', r.fame]].filter((x) => x[1] > 0);
    items2.forEach(([ic, v], i) => {
      const kk = G.ease.outBack(G.seg(t, 1.3 + i * 0.15, 1.6 + i * 0.15));
      const y = Hd * 0.3 + i * 30;
      ctx.save();
      ctx.translate(150, y);
      ctx.scale(kk, kk);
      if (ic === 'coin') art.coin(ctx, 0, 0, 9, t);
      else if (ic === 'gem') art.gem(ctx, 0, 0, 10);
      else art.fameStar(ctx, 0, 0, 10);
      ctx.font = '900 16px "M PLUS Rounded 1c", sans-serif';
      ctx.fillStyle = '#fffaf0';
      ctx.textAlign = 'left';
      ctx.fillText('+' + G.fmt(v), 16, 6);
      ctx.restore();
    });
  }

  function drawParts() {
    parts.forEach((p) => {
      const kk = p.life / p.max;
      const a = 1 - kk;
      if (p.type === 'spark') {
        ctx.fillStyle = G.rgba(p.col, a);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.life * 6);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === 'tri') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        art.poly(ctx, [-p.size, p.size * 0.6, p.size, p.size * 0.6, 0, -p.size], G.rgba(p.col, Math.min(1, a * 2.5)));
        ctx.restore();
      } else if (p.type === 'heart') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const sc = G.ease.outBack(Math.min(1, p.life / 0.2));
        art.heart(ctx, 0, 0, p.size * sc, '#ff4f6d');
        ctx.restore();
      } else if (p.type === 'text' || p.type === 'dmg') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2.5);
        const sc = p.type === 'dmg' ? G.ease.outBack(Math.min(1, p.life / 0.15)) * (p.crit ? 1.5 : 1) : 1;
        ctx.translate(p.x, p.y);
        ctx.scale(sc, sc);
        ctx.font = p.type === 'dmg' ? '900 18px "M PLUS Rounded 1c", sans-serif' : '800 13px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(40,20,10,0.85)';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.type === 'dmg' ? (p.hurt ? '#ff9a8a' : p.crit ? '#ffd65a' : '#ffffff') : p.col;
        ctx.fillText(p.text, 0, 0);
        if (p.crit) {
          ctx.font = '900 9px "M PLUS Rounded 1c", sans-serif';
          ctx.strokeText('会心！', 0, -16);
          ctx.fillStyle = '#ff7a4a';
          ctx.fillText('会心！', 0, -16);
        }
        ctx.restore();
      }
    });
  }
  function drawBanner() {
    const a = Math.min(1, banner.t / 0.25) * (banner.t > 2.2 ? (2.6 - banner.t) / 0.4 : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.globalAlpha = a;
    const y = 70 + (1 - Math.min(1, banner.t / 0.25)) * -30;
    ctx.font = '400 18px "Dela Gothic One", "M PLUS Rounded 1c", sans-serif';
    const w = ctx.measureText(banner.text).width + 40;
    art.rrect(ctx, W / 2 - w / 2, y, w, 40, 20);
    ctx.fillStyle = '#f0c94a';
    ctx.fill();
    ctx.fillStyle = '#3a1e08';
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, W / 2, y + 27);
    ctx.restore();
  }
})();
