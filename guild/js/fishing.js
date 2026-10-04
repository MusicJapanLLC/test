// 裏の桟橋で釣り：みんなが出かけているあいだの、ギルドマスターのひまつぶし
//   長押しで力をため、離して投げる → ウキが沈んだ瞬間にタップ → 長押しで巻く（糸の張りを保つ）
//   時間帯と飛距離で釣れる魚が変わる。魚図鑑を埋めるとごほうび。
(function () {
  const F = (G.fishing = {});
  const TAU = Math.PI * 2;
  const DAY_LEN = 720;
  // shape: 体つき（L 長さ・H 高さ・tail 尾・fea 特徴）
  F.FISH = [
    { id: 'funa', name: 'ひだまりブナ', r: 0, size: [12, 28], c: ['#d0b878', '#8a7040'], L: 1, H: 0.5, tail: 'fan', t: null, d: 0, desc: 'どこにでもいる、ギルドの朝ごはん。' },
    { id: 'ayu', name: '清流アユ', r: 0, size: [15, 26], c: ['#c0d0a8', '#e0c060'], L: 1.2, H: 0.32, tail: 'fork', t: 'day', d: 0, desc: '昼の光が好き。塩焼きにするとリナが喜ぶ。' },
    { id: 'medaka', name: '灯りメダカ', r: 0, size: [3, 6], c: ['#fff0b0', '#d8b860'], L: 0.9, H: 0.35, tail: 'fan', t: 'night', d: 0, glow: true, desc: '夜になると、おしりがぽっと灯る。' },
    { id: 'kani', name: 'いたずらガニ', r: 0, size: [6, 14], c: ['#e8704a', '#a0402a'], crab: true, t: null, d: 0, desc: '魚じゃない。エサだけ取っていくこともある。' },
    { id: 'boot', name: 'だれかの長ぐつ', r: 0, size: [24, 28], c: ['#5a4a3a', '#3a2e24'], junk: 'boot', t: null, d: 0, desc: '持ち主はたぶん、酒場の常連ゴードン。' },
    { id: 'masu', name: 'ギルドマス', r: 1, size: [25, 50], c: ['#a8bcd0', '#d8808a'], L: 1.15, H: 0.42, tail: 'fork', t: null, d: 0.25, stripe: true, desc: 'ギルドの紋章みたいな模様がある。縁起もの。' },
    { id: 'iwashi', name: '星くずイワシ', r: 1, size: [10, 18], c: ['#d0e0f8', '#6070a8'], L: 1.25, H: 0.3, tail: 'fork', t: 'night', d: 0.15, dots: true, desc: '背中に星座が浮かぶ。群れで夜空を映す。' },
    { id: 'namazu', name: 'ヒゲナマズ', r: 1, size: [30, 70], c: ['#7a6a58', '#3a3028'], L: 1.3, H: 0.38, tail: 'round', t: 'dusk', d: 0.2, whisker: true, desc: '夕暮れに起きてくる。ヒゲで天気を占う。' },
    { id: 'fugu', name: 'ぷくぷくフグ', r: 1, size: [10, 25], c: ['#ece0a8', '#8a8a50'], L: 0.85, H: 0.75, tail: 'fan', t: null, d: 0.3, spikes: true, desc: '釣り上げるとふくらむ。触ると怒る。' },
    { id: 'koi', name: '錦ゴイ', r: 2, size: [40, 80], c: ['#fff4e8', '#e04a3a'], L: 1.2, H: 0.45, tail: 'fan', t: 'day', d: 0.4, patch: true, whisker: true, desc: '紅白のまだら模様。町の庭師が欲しがる。' },
    { id: 'tai', name: '夕焼けダイ', r: 2, size: [30, 60], c: ['#ffa080', '#e05a5a'], L: 1, H: 0.6, tail: 'fork', t: 'dusk', d: 0.45, desc: '夕日を飲みこんだような色。お祝いの席に。' },
    { id: 'unagi', name: '月光ウナギ', r: 2, size: [50, 110], c: ['#3a4a70', '#a8c0ff'], L: 2.2, H: 0.2, tail: 'eel', t: 'night', d: 0.5, glow: true, desc: '月の光を背中にためて、ゆらゆら泳ぐ。' },
    { id: 'bottle', name: '手紙入りのびん', r: 2, size: [20, 22], c: ['#a8e0d0', '#5a8a80'], junk: 'bottle', t: null, d: 0.35, desc: '遠くの町のだれかからの手紙。魔晶石が同封されていた。' },
    { id: 'yamame', name: '宝石ヤマメ', r: 3, size: [20, 35], c: ['#a8f0d8', '#ff80c0'], L: 1.1, H: 0.38, tail: 'fork', t: 'day', d: 0.6, dots: true, sparkle: true, desc: 'うろこが宝石。鍛冶のボルグが目を輝かせる。' },
    { id: 'ankou', name: '夜灯アンコウ', r: 3, size: [40, 90], c: ['#4a3a5a', '#2a2034'], L: 1, H: 0.7, tail: 'round', t: 'night', d: 0.65, lantern: true, desc: '頭のちょうちんで、迷子の魚を家まで送る。' },
    { id: 'ryugoi', name: '竜鱗ゴイ', r: 3, size: [70, 120], c: ['#e0a848', '#7a4020'], L: 1.25, H: 0.48, tail: 'fan', t: null, d: 0.7, scales: true, whisker: true, desc: '滝を登りきると竜になるらしい。' },
    { id: 'pumpkin', name: 'かぼちゃハゼ', r: 2, size: [12, 24], c: ['#ff9a3a', '#7a3a10'], L: 1, H: 0.55, tail: 'round', t: null, d: 0.2, event: 'halloween', jack: true, desc: 'かぼちゃ灯籠祭の季節にだけ現れる。顔がある。' },
    { id: 'nushi', name: '黄金のヌシ', r: 4, size: [120, 200], c: ['#ffe48a', '#c8901e'], L: 1.4, H: 0.42, tail: 'round', t: 'dusk', d: 0.85, whisker: true, sparkle: true, desc: '桟橋の主。釣った者には幸運が訪れるという。' },
    { id: 'kodai', name: '深淵の古代魚', r: 4, size: [100, 180], c: ['#3a2a5a', '#a07aff'], L: 1.5, H: 0.5, tail: 'fan', t: 'night', d: 0.9, scales: true, glow: true, desc: '深淵の迷宮の水脈から迷いこんだ、生きた化石。' },
    { id: 'kujira', name: '迷子のちびクジラ', r: 4, size: [180, 300], c: ['#7aa8d8', '#e8f0ff'], L: 1.6, H: 0.6, tail: 'whale', t: 'day', d: 0.9, whale: true, desc: '海から川をさかのぼってきた。すぐ海へ帰してあげた。' },
  ];
  F.BY_ID = {};
  F.FISH.forEach((f) => (F.BY_ID[f.id] = f));
  const RCOL = ['#c8c8c8', '#7fc0ff', '#c79bff', '#ffd36a', '#ff9ad8'];
  const RNAME = ['ふつう', 'ちょっとめずらしい', 'めずらしい', 'とてもめずらしい', '幻'];
  const DEX_GOALS = [
    { n: 5, rw: { cry: 30 }, text: '魔晶石 ×30' },
    { n: 10, rw: { cry: 30, auto180: 1 }, text: '魔晶石 ×30・おまかせ札（3時間）' },
    { n: 15, rw: { book: 1, cry: 50 }, text: '閃きの書・魔晶石 ×50' },
    { n: 19, rw: { cry: 200, shard: 1 }, text: '魔晶石 ×200・虹の欠片（釣り名人）' },
  ];
  F.DEX_GOALS = DEX_GOALS;

  // ---------------------------------------------------------------- セーブ
  function data() {
    const st = G.state;
    st.fish = st.fish || { dex: {}, total: 0, day: '', today: 0, goals: {} };
    const today = G.treasury ? G.treasury.today() : '';
    if (st.fish.day !== today) { st.fish.day = today; st.fish.today = 0; }
    st.fish.goals = st.fish.goals || {};
    return st.fish;
  }
  F.dexCount = () => Object.keys(data().dex).length;
  F.dexTotal = () => F.FISH.filter((f) => !f.event || data().dex[f.id] || eventOn(f.event)).length;
  function timeOfDay() {
    const p = (Date.now() / 1000 % DAY_LEN) / DAY_LEN;
    if (p < 0.04 || p > 0.92) return 'dusk';
    if (p < 0.56) return 'day';
    if (p < 0.68) return 'dusk';
    return 'night';
  }
  F.timeOfDay = timeOfDay;
  function eventOn(ev) { return ev === 'halloween' ? !!(G.events && G.events.theme && G.events.theme() === 'pumpkin') : false; }

  // 投げた距離と時間帯から、かかる魚を決める
  function pickFish(power) {
    const tod = timeOfDay();
    const W = [50, 24, 9, 3, 0.9];
    const pool = F.FISH.filter((f) => (!f.t || f.t === tod) && f.d <= power + 0.08 && (!f.event || eventOn(f.event)));
    const w = pool.map((f) => W[f.r] * (1 + power * f.r * 0.6) * (f.event ? 3 : 1) * (f.junk === 'boot' ? 0.5 : 1));
    let x = Math.random() * w.reduce((a, v) => a + v, 0);
    for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
    return pool[0];
  }

  // ---------------------------------------------------------------- 魚の絵
  function drawFish(ctx, f, s, t, flip) {
    const poly = G.art.poly;
    ctx.save();
    ctx.scale(flip ? -s : s, s);
    if (f.junk === 'boot') {
      poly(ctx, [-10, -22, 6, -22, 6, -2, 20, 2, 22, 12, -10, 12], f.c[0]);
      poly(ctx, [-10, 8, 22, 8, 22, 12, -10, 12], f.c[1]);
      poly(ctx, [-12, -24, 8, -24, 8, -19, -12, -19], '#7a6a58');
      ctx.restore();
      return;
    }
    if (f.junk === 'bottle') {
      ctx.globalAlpha = 0.9;
      poly(ctx, [-16, -8, 8, -8, 14, -4, 22, -4, 22, 4, 14, 4, 8, 8, -16, 8], 'rgba(170,230,215,0.75)');
      poly(ctx, [22, -3, 27, -3, 27, 3, 22, 3], '#a0703c');
      poly(ctx, [-12, -4, 4, -4, 4, 4, -12, 4], '#f0e0b8');
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    if (f.crab) {
      poly(ctx, [-14, 0, -8, -9, 8, -9, 14, 0, 8, 7, -8, 7], f.c[0]);
      poly(ctx, [-14, -2, -24, -12, -20, -16, -12, -8], f.c[0]);
      poly(ctx, [14, -2, 24, -12, 20, -16, 12, -8], f.c[0]);
      poly(ctx, [-24, -12, -28, -20, -22, -22, -20, -16], f.c[1]);
      poly(ctx, [24, -12, 28, -20, 22, -22, 20, -16], f.c[1]);
      for (let i = 0; i < 3; i++) { poly(ctx, [-10 + i * 4, 6, -8 + i * 4, 6, -14 + i * 3, 14, -16 + i * 3, 13], f.c[1]); poly(ctx, [10 - i * 4, 6, 8 - i * 4, 6, 14 - i * 3, 14, 16 - i * 3, 13], f.c[1]); }
      ctx.fillStyle = '#1a1010';
      ctx.fillRect(-5, -13, 2.4, 4); ctx.fillRect(3, -13, 2.4, 4);
      ctx.restore();
      return;
    }
    const L = 26 * f.L, H = 26 * f.H;
    const wig = Math.sin(t * 10) * 0.12;
    // 尾
    const tx = -L * 0.95;
    ctx.save();
    ctx.translate(-L * 0.75, 0);
    ctx.rotate(wig);
    const tc = G.mix(f.c[1], '#000000', 0.08);
    if (f.tail === 'fork') poly(ctx, [0, 0, -L * 0.42, -H * 0.85, -L * 0.25, 0, -L * 0.42, H * 0.85], tc);
    else if (f.tail === 'eel') poly(ctx, [0, -H * 0.3, -L * 0.3, -H * 0.1, -L * 0.3, H * 0.1, 0, H * 0.3], tc);
    else if (f.tail === 'whale') { poly(ctx, [0, 0, -L * 0.3, -H * 0.8, -L * 0.18, 0], tc); poly(ctx, [0, 0, -L * 0.3, H * 0.8, -L * 0.18, 0], tc); }
    else if (f.tail === 'round') { ctx.fillStyle = tc; ctx.beginPath(); ctx.ellipse(-L * 0.18, 0, L * 0.22, H * 0.55, 0, 0, TAU); ctx.fill(); }
    else poly(ctx, [0, 0, -L * 0.36, -H * 0.75, -L * 0.3, 0, -L * 0.36, H * 0.75], tc);
    ctx.restore();
    void tx;
    // 胴
    const top = f.c[1], belly = f.c[0];
    G.art.facetPoly(ctx, [L, 0, L * 0.6, -H * 0.82, -L * 0.1, -H, -L * 0.8, -H * 0.35, -L * 0.8, H * 0.35, -L * 0.1, H * 0.92, L * 0.6, H * 0.7], belly, 0.12);
    poly(ctx, [L, 0, L * 0.6, -H * 0.82, -L * 0.1, -H, -L * 0.8, -H * 0.35, -L * 0.3, -H * 0.1, L * 0.5, -H * 0.1], top);
    // 背びれ
    poly(ctx, [L * 0.25, -H * 0.9, -L * 0.1, -H * 1.45, -L * 0.45, -H * 0.7], G.mix(top, '#000000', 0.15));
    // 胸びれ
    poly(ctx, [L * 0.35, H * 0.2, L * 0.1, H * 0.75 + wig * 10, L * 0.0, H * 0.25], G.mix(belly, '#000000', 0.1));
    if (f.stripe) { ctx.fillStyle = G.rgba('#ff9aa0', 0.6); ctx.fillRect(-L * 0.6, -H * 0.12, L * 1.3, H * 0.22); }
    if (f.patch) { ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.ellipse(L * 0.25, -H * 0.4, L * 0.2, H * 0.32, 0.3, 0, TAU); ctx.ellipse(-L * 0.35, -H * 0.2, L * 0.16, H * 0.3, -0.2, 0, TAU); ctx.fill(); }
    if (f.dots) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-L * 0.55 + i * L * 0.18, -H * (0.35 + 0.25 * Math.sin(i * 2.3)), 1.2 + (i % 2), 0, TAU); ctx.fill(); } }
    if (f.scales) { ctx.strokeStyle = G.rgba(G.mix(top, '#ffffff', 0.5), 0.55); ctx.lineWidth = 1; for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(-L * 0.45 + i * L * 0.22, -H * 0.35 + j * H * 0.5, H * 0.2, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); } }
    if (f.spikes) { ctx.fillStyle = G.mix(top, '#000000', 0.2); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * L * 0.7, Math.sin(a) * H * 0.9); ctx.lineTo(Math.cos(a) * L * 0.88, Math.sin(a) * H * 1.15); ctx.lineTo(Math.cos(a + 0.2) * L * 0.7, Math.sin(a + 0.2) * H * 0.9); ctx.fill(); } }
    if (f.whale) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-L * 0.4, H * 0.3, L * 1.1, H * 0.12); }
    if (f.jack) { ctx.fillStyle = '#3a1a08'; poly(ctx, [L * 0.4, -H * 0.35, L * 0.55, -H * 0.1, L * 0.3, -H * 0.1], '#3a1a08'); poly(ctx, [L * 0.1, -H * 0.35, L * 0.25, -H * 0.1, 0, -H * 0.1], '#3a1a08'); poly(ctx, [-L * 0.05, H * 0.2, L * 0.55, H * 0.2, L * 0.4, H * 0.4, L * 0.25, H * 0.3, L * 0.1, H * 0.4], '#3a1a08'); }
    // 目
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(L * 0.62, -H * 0.25, Math.max(2, H * 0.16), 0, TAU); ctx.fill();
    ctx.fillStyle = '#141018';
    ctx.beginPath(); ctx.arc(L * 0.65, -H * 0.25, Math.max(1.2, H * 0.09), 0, TAU); ctx.fill();
    if (f.whisker) {
      ctx.strokeStyle = G.mix(top, '#000000', 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L * 0.9, H * 0.05); ctx.quadraticCurveTo(L * 1.15, H * 0.2 + wig * 8, L * 1.3, H * 0.5); ctx.moveTo(L * 0.85, H * 0.12); ctx.quadraticCurveTo(L * 1.05, H * 0.4, L * 1.12, H * 0.75 + wig * 6); ctx.stroke();
    }
    if (f.lantern) {
      ctx.strokeStyle = '#2a2034'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(L * 0.5, -H * 0.8); ctx.quadraticCurveTo(L * 0.9, -H * 1.8, L * 1.25, -H * 1.2); ctx.stroke();
      const g = ctx.createRadialGradient(L * 1.25, -H * 1.2, 0, L * 1.25, -H * 1.2, H * 0.9);
      g.addColorStop(0, 'rgba(255,230,140,0.95)'); g.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L * 1.25, -H * 1.2, H * 0.9, 0, TAU); ctx.fill();
    }
    if (f.glow || f.sparkle) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 1.3);
      g.addColorStop(0, G.rgba(f.c[1], 0.35)); g.addColorStop(1, G.rgba(f.c[1], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, L * 1.3, 0, TAU); ctx.fill();
      if (f.sparkle) { ctx.fillStyle = 'rgba(255,255,240,0.9)'; for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; G.art.star(ctx, Math.cos(a) * L * 0.9, Math.sin(a * 1.3) * H * 1.2, 2.4 + Math.sin(t * 6 + i) * 1.2, 'rgba(255,255,240,0.9)'); } }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  F.drawFish = drawFish;
  // 図鑑・結果用の絵（キャッシュ）
  const thumbs = new Map();
  F.thumb = function (id, px, silhouette) {
    const key = id + ':' + px + (silhouette ? ':s' : '');
    if (thumbs.has(key)) return thumbs.get(key);
    const f = F.BY_ID[id];
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = c.height = px * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(px / 2, px / 2 + (f.lantern ? px * 0.08 : 0));
    const span = f.crab ? 60 : f.junk ? 56 : 26 * f.L * 2.3 + 12;
    drawFish(g, f, (px * 0.86) / span, 0.3, false);
    if (silhouette) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#1a2240'; g.fillRect(-px, -px, px * 2, px * 2); }
    const url = c.toDataURL();
    thumbs.set(key, url);
    return url;
  };

  // ---------------------------------------------------------------- ミニゲーム
  let root = null, cv = null, ctx = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0;
  let S = null; // 状態
  const ui = {};
  function reset() {
    S = { mode: 'idle', power: 0, pdir: 1, bx: 0, by: 0, tx: 0, fly: 0, wait: 0, nib: 0, bite: 0, fish: null, dist: 1, ten: 0.3, slack: 0, rage: 0, rageT: 0, msg: '', msgT: 0, jump: 0, splash: [], held: false, size: 0 };
    hint('長押しで力をためて、はなして投げる');
  }
  function hint(t) { if (ui.hint) ui.hint.textContent = t; }
  function say(t, cls) {
    if (!ui.msg) return;
    ui.msg.textContent = t;
    ui.msg.className = 'fs-msg show ' + (cls || '');
    clearTimeout(say._t);
    say._t = setTimeout(() => { if (ui.msg) ui.msg.className = 'fs-msg'; }, 1400);
  }
  const waterY = () => H * 0.47;
  const rodTip = () => [W * 0.2, H * 0.6];

  function down(e) {
    if (e.target.closest('button') || !S) return;
    e.preventDefault();
    S.held = true;
    G.audio.init();
    if (S.mode === 'idle') { S.mode = 'charge'; S.power = 0; S.pdir = 1; hint('はなすと投げる！'); }
    else if (S.mode === 'wait') {
      // 早すぎた
      S.mode = 'reelback'; S.fly = 0;
      say('はやすぎた…魚が逃げた', 'bad');
      G.audio.sfx('miss');
    } else if (S.mode === 'bite') {
      S.mode = 'fight';
      S.dist = 1; S.ten = 0.35; S.slack = 0; S.rage = 0; S.rageT = 1 + Math.random() * 1.5;
      say('かかった！ 長押しで巻け！', 'good');
      G.audio.sfx('crit');
      G.haptic(30);
      hint('長押しで巻く ・ ゲージが赤くなったらはなす');
    }
  }
  function up() {
    if (!S) return;
    S.held = false;
    if (S.mode === 'charge') {
      S.mode = 'fly';
      S.fly = 0;
      const p = 0.12 + S.power * 0.88;
      S.cast = p;
      S.tx = W * (0.32 + p * 0.58);
      S.ty = waterY() + H * (0.24 - p * 0.18);
      G.audio.sfx('swish');
      hint('ウキが沈んだらタップ！');
    }
  }
  function update(dt) {
    time += dt;
    if (!S) return;
    if (S.mode === 'charge') {
      S.power += S.pdir * dt * 1.15;
      if (S.power >= 1) { S.power = 1; S.pdir = -1; }
      if (S.power <= 0) { S.power = 0; S.pdir = 1; }
    } else if (S.mode === 'fly') {
      S.fly += dt / 0.65;
      const [rx, ry] = rodTip();
      const k = Math.min(1, S.fly);
      S.bx = G.lerp(rx, S.tx, k);
      S.by = G.lerp(ry, S.ty, k) - Math.sin(k * Math.PI) * H * 0.22;
      if (S.fly >= 1) {
        S.mode = 'wait';
        S.fish = pickFish(S.cast);
        S.wait = 1.6 + Math.random() * 3.6;
        S.nib = 0.6 + Math.random() * 0.8;
        addSplash(S.bx, S.by, 1);
        G.audio.sfx('splash');
      }
    } else if (S.mode === 'wait') {
      S.wait -= dt;
      S.nib -= dt;
      if (S.nib <= 0) { S.nib = 0.7 + Math.random() * 1.2; S.twitch = 0.25; if (Math.random() < 0.6) G.audio.sfx('tick'); }
      if (S.twitch > 0) S.twitch -= dt;
      if (S.wait <= 0) {
        S.mode = 'bite';
        S.bite = S.fish.r >= 3 ? 0.62 : 0.8;
        addSplash(S.bx, S.by, 1.4);
        G.audio.sfx('bite');
        G.haptic(25);
      }
    } else if (S.mode === 'bite') {
      S.bite -= dt;
      if (S.bite <= 0) { S.mode = 'reelback'; S.fly = 0; say('逃げられた…', 'bad'); G.audio.sfx('miss'); }
    } else if (S.mode === 'fight') {
      const f = S.fish;
      const pow = f.junk ? 0.25 : 0.55 + f.r * 0.22 + (f.crab ? 0.1 : 0);
      S.rageT -= dt;
      if (S.rageT <= 0) {
        S.rage = S.rage > 0 ? 0 : 0.7 + Math.random() * 0.8;
        S.rageT = S.rage > 0 ? S.rage : 0.9 + Math.random() * 1.6;
        if (S.rage > 0 && !f.junk) { addSplash(S.bx, S.by, 1.2); G.haptic(12); }
      }
      const raging = S.rage > 0 && !f.junk;
      if (S.held) {
        S.ten += dt * (0.42 + (raging ? pow * 0.9 : pow * 0.25));
        S.dist -= dt * (raging ? 0.07 : 0.32) / (0.7 + f.r * 0.15);
        S.reelT = (S.reelT || 0) - dt;
        if (S.reelT <= 0) { S.reelT = 0.1; G.audio.sfx('reel'); }
      } else {
        S.ten -= dt * 0.55;
        if (raging) S.dist = Math.min(1, S.dist + dt * 0.06 * pow);
      }
      S.ten = G.clamp(S.ten, 0, 1.05);
      if (S.ten < 0.08) S.slack += dt; else S.slack = 0;
      // ウキ（魚）が近づいてくる
      const [rx] = rodTip();
      S.bx = G.lerp(rx + W * 0.08, S.tx, S.dist) + (raging ? Math.sin(time * 18) * 6 : Math.sin(time * 3) * 3);
      S.by = G.lerp(waterY() + H * 0.2, S.ty, S.dist) + (raging ? Math.cos(time * 15) * 3 : 0);
      if (S.ten >= 1) { S.mode = 'reelback'; S.fly = 0; say('糸が切れた！', 'bad'); G.audio.sfx('shatter'); G.haptic(40); }
      else if (S.slack > 1.6) { S.mode = 'reelback'; S.fly = 0; say('糸がゆるんで逃げられた…', 'bad'); G.audio.sfx('miss'); }
      else if (S.dist <= 0) catchIt();
    } else if (S.mode === 'reelback') {
      S.fly += dt / 0.5;
      const [rx, ry] = rodTip();
      S.bx = G.lerp(S.bx, rx, Math.min(1, S.fly));
      S.by = G.lerp(S.by, ry, Math.min(1, S.fly));
      if (S.fly >= 1) reset();
    } else if (S.mode === 'caught') {
      S.jump += dt;
    }
    S.splash = S.splash.filter((p) => (p.t += dt) < p.max);
  }
  function addSplash(x, y, k) {
    for (let i = 0; i < 10 * k; i++) S.splash.push({ x, y, vx: (Math.random() - 0.5) * 90 * k, vy: -60 - Math.random() * 90 * k, t: 0, max: 0.5 + Math.random() * 0.3, ring: i === 0 });
  }

  // ---------------------------------------------------------------- 釣れた！
  function catchIt() {
    const f = S.fish;
    const d = data();
    S.mode = 'caught';
    S.jump = 0;
    addSplash(S.bx, S.by, 2);
    const sz = Math.round(G.lerp(f.size[0], f.size[1], Math.pow(Math.random(), 1.6)) * 10) / 10;
    const rec = d.dex[f.id];
    const isNew = !rec;
    const best = !rec || sz > rec.best;
    d.dex[f.id] = { n: (rec ? rec.n : 0) + 1, best: Math.max(sz, rec ? rec.best : 0) };
    d.total++;
    d.today++;
    const st = G.state;
    st.stats.fish = (st.stats.fish || 0) + 1;
    // ごほうび（たくさん釣った日は、魚が警戒して少なめ）
    const tired = d.today > 30 ? 0.3 : 1;
    const B = G.treasury ? G.treasury.gBase() : 600;
    const sizeK = 0.8 + 0.6 * ((sz - f.size[0]) / Math.max(1, f.size[1] - f.size[0]));
    let gold = f.junk === 'boot' ? 1 : Math.round(B * [0.03, 0.08, 0.25, 0.8, 3][f.r] * sizeK * tired);
    let cry = Math.round([0, 0, 2, 5, 20][f.r] * tired) + (isNew ? [3, 5, 10, 20, 50][f.r] : 0);
    const extra = [];
    if (f.junk === 'bottle') { cry += 10; const it = ['auto30', 'finish', 'stone', 'key'][Math.floor(Math.random() * 4)]; const n = it === 'stone' ? 5 : 1; G.items.addCons(it, n); extra.push(`${G.items.CONS[it].name} ×${n}`); }
    if (f.id === 'nushi') { G.items.addCons('luck', 1); extra.push('幸運の四つ葉'); }
    if (f.id === 'kani' && Math.random() < 0.3) { G.items.addCons('stone', 2); extra.push('強化石 ×2（ハサミにはさまっていた）'); }
    st.gold += gold;
    st.stats.goldEarned = (st.stats.goldEarned || 0) + gold;
    if (cry) st.crystals = (st.crystals || 0) + cry;
    G.audio.sfx('catch');
    G.audio.sfx('rarity', Math.max(1, f.r));
    G.haptic(f.r >= 3 ? 50 : 20);
    if (f.r >= 3) G.ui.fx.confetti();
    // 図鑑の節目
    const nDex = Object.keys(d.dex).length;
    const goal = DEX_GOALS.find((g) => nDex >= g.n && !d.goals[g.n]);
    if (goal) { d.goals[goal.n] = 1; Object.entries(goal.rw).forEach(([k, n]) => G.items.addCons(k, n)); }
    G.sim.save();
    G.ui.refreshHud();
    const ft = document.getElementById('fsToday'), fd = document.getElementById('fsDex');
    if (ft) ft.textContent = d.today;
    if (fd) fd.textContent = nDex;
    showCatch(f, sz, { isNew, best: best && !isNew, gold, cry, extra, goal, tired: tired < 1 });
  }
  function showCatch(f, sz, r) {
    const card = ui.card;
    card.innerHTML = `<div class="fc-in r${f.r}">${r.isNew ? '<em class="fc-new">NEW!</em>' : r.best ? '<em class="fc-new rec">自己ベスト！</em>' : ''}
      <small class="fc-r" style="color:${RCOL[f.r]}">${'★'.repeat(f.r + 1)} ${RNAME[f.r]}</small>
      <img alt="" src="${F.thumb(f.id, 150)}"><h2>${f.name}</h2><p class="fc-size"><b>${sz}</b> cm</p><p class="fc-desc">${f.desc}</p>
      <p class="fc-rw">${r.gold > 1 ? `<span>${G.ui.IC.coin}${G.fmt(r.gold)}</span>` : ''}${r.cry ? `<span class="cry">魔晶石 +${r.cry}</span>` : ''}${r.extra.map((x) => `<span>${x}</span>`).join('')}</p>
      ${r.goal ? `<p class="fc-goal">図鑑 ${r.goal.n}種 達成！ ${r.goal.text}</p>` : ''}
      ${r.tired ? '<p class="fc-hint">今日はたくさん釣ったので、魚が警戒している…（ごほうび少なめ）</p>' : ''}
      <div class="fc-btns"><button class="btn ghost" data-fc="dex">図鑑</button><button class="btn primary" data-fc="again">もう一回</button></div></div>`;
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('show'));
    G.$('[data-fc="again"]', card).addEventListener('click', () => { G.audio.sfx('tap'); hideCard(); reset(); });
    G.$('[data-fc="dex"]', card).addEventListener('click', () => { G.audio.sfx('tap'); hideCard(); reset(); F.dex(); });
  }
  function hideCard() { ui.card.classList.remove('show'); ui.card.hidden = true; }

  // ---------------------------------------------------------------- 描画
  function sky() {
    const tod = timeOfDay();
    const pal = { day: ['#7cc0ec', '#d8f0ff', '#5aa0c8', '#2a6a98'], dusk: ['#4a4a8a', '#ffb07a', '#8a6a8a', '#3a3a6a'], night: ['#0c1430', '#2a3a70', '#18244a', '#0a1028'] }[tod];
    const wy = waterY();
    let g = ctx.createLinearGradient(0, 0, 0, wy);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wy);
    if (tod === 'night') {
      for (let i = 0; i < 50; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (wy * 0.8); ctx.fillStyle = `rgba(255,250,220,${0.3 + 0.5 * Math.abs(Math.sin(time + i))})`; ctx.fillRect(x, y, 1.5, 1.5); }
      ctx.fillStyle = '#f2f0dc'; ctx.beginPath(); ctx.arc(W * 0.78, wy * 0.25, 18, 0, TAU); ctx.fill();
    } else {
      const sx = tod === 'day' ? W * 0.75 : W * 0.85, sy = tod === 'day' ? wy * 0.22 : wy * 0.8;
      const gg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      gg.addColorStop(0, tod === 'day' ? 'rgba(255,250,220,0.95)' : 'rgba(255,190,120,0.95)'); gg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill();
    }
    // 雲
    ctx.fillStyle = tod === 'night' ? 'rgba(80,90,140,0.5)' : tod === 'dusk' ? 'rgba(255,210,190,0.7)' : 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) { const x = ((i * 160 + time * (6 + i * 2)) % (W + 200)) - 100, y = 40 + i * 34; ctx.beginPath(); ctx.ellipse(x, y, 50, 12, 0, 0, TAU); ctx.ellipse(x + 20, y - 8, 26, 12, 0, 0, TAU); ctx.fill(); }
    // 遠くの山並み（雪をかぶる）
    const mt = tod === 'night' ? '#1c2648' : tod === 'dusk' ? '#8a6a8a' : '#8aa8cc';
    for (let i = 0; i < 6; i++) {
      const cx = (i / 5) * W * 1.1 - W * 0.05, top = wy - 120 - (i % 3) * 34;
      G.art.facetPoly(ctx, [cx - 110, wy - 10, cx, top, cx + 110, wy - 10], G.mix(mt, '#ffffff', (i % 2) * 0.05), 0.15);
      G.art.poly(ctx, [cx, top, cx + 24, top + 26, cx + 8, top + 20, cx - 10, top + 28, cx - 22, top + 22], tod === 'night' ? '#6a76a8' : '#f4f8ff');
    }
    // 鳥の群れ
    if (tod !== 'night') {
      const u = (time % 16) / 16;
      ctx.strokeStyle = 'rgba(40,40,60,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = W * (1.1 - u * 1.3) + i * 14, y = wy * 0.35 + Math.abs(i - 2) * 8 + Math.sin(u * 8) * 6, fl = Math.sin(time * 9 + i) * 3;
        ctx.moveTo(x - 5, y - fl); ctx.quadraticCurveTo(x - 2, y - 2, x, y); ctx.quadraticCurveTo(x + 2, y - 2, x + 5, y - fl);
      }
      ctx.stroke();
    }
    // 対岸：丘と森とギルドの塔
    const far = tod === 'night' ? '#16243a' : tod === 'dusk' ? '#7a5a6a' : '#6aa070';
    ctx.fillStyle = far;
    ctx.beginPath(); ctx.moveTo(0, wy);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wy - 22 - Math.sin(x * 0.02) * 10 - Math.sin(x * 0.05) * 4);
    ctx.lineTo(W, wy); ctx.fill();
    for (let i = 0; i < 18; i++) { const x = (i * 41) % W + 10, y = wy - 20 - Math.sin(x * 0.02) * 10; G.art.poly(ctx, [x - 7, y + 4, x, y - 18 - (i % 3) * 4, x + 7, y + 4], G.mix(far, '#000000', 0.15)); }
    const gx = W * 0.62, gy = wy - 26;
    G.art.poly(ctx, [gx - 9, gy, gx - 9, gy - 34, gx + 9, gy - 34, gx + 9, gy], tod === 'night' ? '#2a2a48' : '#c8b490');
    G.art.poly(ctx, [gx - 11, gy - 34, gx + 11, gy - 34, gx, gy - 48], tod === 'night' ? '#141c3a' : '#3a5a9a');
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(gx - 2, gy - 44, 4, 4);
    if (tod !== 'day') { ctx.fillRect(gx - 5, gy - 26, 3, 4); ctx.fillRect(gx + 2, gy - 16, 3, 4); }
    // 水
    g = ctx.createLinearGradient(0, wy, 0, H);
    g.addColorStop(0, pal[2]); g.addColorStop(1, pal[3]);
    ctx.fillStyle = g; ctx.fillRect(0, wy, W, H - wy);
    ctx.strokeStyle = tod === 'night' ? 'rgba(180,200,255,0.25)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const y = wy + 6 + i * i * 1.9;
      const x = ((i * 73 + time * (8 + i)) % (W + 60)) - 30;
      const w = 12 + i * 2.5;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - 2, x + w, y); ctx.stroke();
    }
    // 遠くで魚がはねる
    const jk = (time % 7) / 7;
    if (jk < 0.12) {
      const x = W * (0.3 + ((Math.floor(time / 7) * 0.37) % 0.6)), y = wy + 30;
      const u = jk / 0.12;
      ctx.save(); ctx.translate(x + u * 24, y - Math.sin(u * Math.PI) * 26); ctx.rotate(-0.8 + u * 1.6);
      drawFish(ctx, F.FISH[0], 0.5, time, false);
      ctx.restore();
    }
    // 夜の蛍・昼のトンボ
    for (let i = 0; i < 8; i++) {
      const x = (i * 83 + Math.sin(time * 0.7 + i) * 40 + W) % W, y = wy - 40 + Math.cos(time * 0.9 + i * 2) * 26;
      if (tod === 'night') { ctx.fillStyle = `rgba(220,255,150,${0.4 + 0.6 * Math.max(0, Math.sin(time * 3 + i))})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
      else if (i < 3) { ctx.fillStyle = '#4a7ab8'; ctx.fillRect(x - 6, y, 12, 1.6); ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.fillRect(x - 3, y - 3 + Math.sin(time * 40) * 1.5, 6, 2); }
    }
  }
  function pads() {
    const wy = waterY();
    // 蓮の葉（ときどきカエル）
    [[0.55, 0.16], [0.7, 0.3], [0.86, 0.12], [0.45, 0.4]].forEach(([kx, ky], i) => {
      const x = W * kx + Math.sin(time * 0.6 + i) * 3, y = wy + (H - wy) * ky;
      ctx.fillStyle = '#4a9a5a';
      ctx.beginPath(); ctx.ellipse(x, y, 16, 5, 0, 0.3, TAU - 0.1); ctx.lineTo(x, y); ctx.fill();
      ctx.fillStyle = '#62b86e'; ctx.beginPath(); ctx.ellipse(x - 2, y - 1, 10, 3, 0, 0, TAU); ctx.fill();
      if (i === 1) { ctx.fillStyle = '#ffb0d0'; ctx.beginPath(); ctx.arc(x + 6, y - 3, 3, 0, TAU); ctx.fill(); }
      if (i === 2 && Math.sin(time * 0.4) > -0.3) {
        const hop = Math.max(0, Math.sin(time * 3)) * (Math.sin(time * 0.4) > 0.8 ? 6 : 0);
        G.art.poly(ctx, [x - 6, y - 2 - hop, x + 6, y - 2 - hop, x + 4, y - 9 - hop, x - 4, y - 9 - hop], '#5ab05a');
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 10 - hop, 2, 0, TAU); ctx.arc(x + 3, y - 10 - hop, 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(x - 3.5, y - 10.5 - hop, 1.2, 1.2); ctx.fillRect(x + 2.5, y - 10.5 - hop, 1.2, 1.2);
      }
    });
  }
  function reeds() {
    // 手前右の葦（風にゆれる）
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = W - 8 - i * 7 - (i % 3) * 4, base = H + 6, h = H * (0.16 + (i % 4) * 0.03);
      const sw = Math.sin(time * 1.4 + i * 0.7) * 10;
      ctx.strokeStyle = i % 2 ? '#4a7a3a' : '#5a8a42'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + sw * 0.3, base - h * 0.5, x + sw, base - h); ctx.stroke();
      if (i % 3 === 0) { ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(x + sw, base - h - 8, 3, 9, sw * 0.02, 0, TAU); ctx.fill(); }
    }
  }
  function dock() {
    const wy = waterY();
    // 桟橋
    const plank = '#8a5a3a', dark = '#5a3a24';
    G.art.poly(ctx, [0, H * 0.66, W * 0.34, H * 0.7, W * 0.34, H * 0.74, 0, H * 0.72], dark);
    G.art.poly(ctx, [0, H * 0.62, W * 0.36, H * 0.66, W * 0.34, H * 0.7, 0, H * 0.68], plank);
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const x = i * W * 0.06; ctx.beginPath(); ctx.moveTo(x, H * 0.62 + i * 0.4); ctx.lineTo(x - 2, H * 0.68 + i * 0.4); ctx.stroke(); }
    [0.05, 0.18, 0.31].forEach((k) => { G.art.poly(ctx, [W * k - 4, H * 0.7, W * k + 4, H * 0.7, W * k + 4, H, W * k - 4, H], dark); });
    // 釣り人（ギルドマスター）
    const px = W * 0.12, py = H * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px, py + 2, 16, 4, 0, 0, TAU); ctx.fill();
    G.art.poly(ctx, [px - 10, py, px + 10, py, px + 8, py - 26, px - 8, py - 26], '#3a4a6a');
    G.art.poly(ctx, [px - 12, py - 22, px + 12, py - 22, px + 9, py - 30, px - 9, py - 30], '#c8901e');
    ctx.fillStyle = '#f2c6a0'; ctx.beginPath(); ctx.arc(px, py - 36, 8, 0, TAU); ctx.fill();
    G.art.poly(ctx, [px - 13, py - 40, px + 13, py - 40, px + 6, py - 46, px - 6, py - 46], '#d8b878');
    G.art.poly(ctx, [px - 6, py - 46, px + 6, py - 46, px, py - 54], '#d8b878');
    // 竿
    const [rx, ry] = rodTip();
    const bend = S && S.mode === 'fight' ? S.ten * 26 : S && S.mode === 'bite' ? 10 : 0;
    ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px + 6, py - 20); ctx.quadraticCurveTo((px + rx) / 2, ry - 30 + bend * 0.5, rx, ry + bend); ctx.stroke();
    return [rx, ry + bend];
  }
  function line(tip) {
    if (!S) return;
    const [rx, ry] = tip;
    if (S.mode === 'idle' || S.mode === 'charge') {
      const bx = rx, by = ry + 26 + Math.sin(time * 2) * 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(bx, by); ctx.stroke();
      bobber(bx, by, 0);
      return;
    }
    const sag = S.mode === 'fight' ? (1 - S.ten) * 40 : 30;
    ctx.strokeStyle = S.mode === 'fight' && S.ten > 0.8 ? 'rgba(255,170,150,0.95)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = S.mode === 'fight' ? 1.4 : 1;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo((rx + S.bx) / 2, Math.max(ry, S.by) + sag, S.bx, S.by); ctx.stroke();
    if (S.mode === 'fight') {
      // 水の下の魚の影
      ctx.fillStyle = 'rgba(10,20,40,0.35)';
      ctx.beginPath(); ctx.ellipse(S.bx + 14, S.by + 8, 14 + S.fish.r * 3, 5, Math.sin(time * 6) * 0.2, 0, TAU); ctx.fill();
      if (S.rage > 0 && !S.fish.junk && Math.random() < 0.3) addSplash(S.bx, S.by, 0.4);
    } else if (S.mode !== 'caught') {
      let dip = 0;
      if (S.mode === 'wait' && S.twitch > 0) dip = Math.sin(S.twitch * 40) * 3;
      if (S.mode === 'bite') dip = 9 + Math.sin(time * 30) * 2;
      bobber(S.bx, S.by + dip + (S.mode === 'wait' ? Math.sin(time * 2.2) * 1.5 : 0), S.mode === 'bite' ? 1 : 0);
      if (S.mode === 'bite') {
        const bx = S.bx, by = S.by - 40, pop = 1 + Math.sin(time * 20) * 0.06;
        ctx.save(); ctx.translate(bx, by); ctx.scale(pop, pop);
        ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#7a2a10'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.moveTo(-4, 13); ctx.lineTo(0, 22); ctx.lineTo(5, 13); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e03a2a'; ctx.font = G.font(900, 22, 'num'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
        ctx.restore(); ctx.textBaseline = 'alphabetic';
      }
    }
  }
  function bobber(x, y, alert) {
    if (y > waterY()) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 10 + Math.sin(time * 3) * 2, 3, 0, 0, TAU); ctx.stroke();
    }
    G.art.poly(ctx, [x - 4, y, x + 4, y, x + 3, y + 5, x - 3, y + 5], '#ffffff');
    G.art.poly(ctx, [x - 4, y, x + 4, y, x + 2, y - 6, x - 2, y - 6], alert ? '#ff3a2a' : '#e04a3a');
    G.art.poly(ctx, [x - 0.8, y - 6, x + 0.8, y - 6, x + 0.8, y - 12, x - 0.8, y - 12], '#3a3a3a');
  }
  function hud() {
    if (!S) return;
    if (S.mode === 'charge') {
      // 力のゲージ（竿の上）
      const x = W * 0.08, y = H * 0.36, w = 16, h = H * 0.2;
      ctx.fillStyle = 'rgba(6,10,22,0.6)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      const g = ctx.createLinearGradient(0, y + h, 0, y);
      g.addColorStop(0, '#7fd0ff'); g.addColorStop(0.6, '#ffd36a'); g.addColorStop(1, '#ff7a59');
      ctx.fillStyle = g; ctx.fillRect(x, y + h * (1 - S.power), w, h * S.power);
      ctx.fillStyle = '#fff'; ctx.font = G.font(800, 11, 'ui'); ctx.textAlign = 'center';
      ctx.fillText('遠く', x + w / 2, y - 8);
    }
    if (S.mode === 'fight') {
      // 糸の張りゲージ
      const x = W * 0.12, y = H * 0.86, w = W * 0.76, h = 14;
      ctx.fillStyle = 'rgba(6,10,22,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = 'rgba(120,220,160,0.3)'; ctx.fillRect(x + w * 0.15, y, w * 0.62, h);
      ctx.fillStyle = 'rgba(255,90,70,0.35)'; ctx.fillRect(x + w * 0.85, y, w * 0.15, h);
      const k = Math.min(1, S.ten);
      ctx.fillStyle = k > 0.85 ? '#ff5a3a' : k < 0.15 ? '#7fa8ff' : '#7fe0a8';
      ctx.fillRect(x, y + 3, w * k, h - 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + w * k - 1.5, y - 4, 3, h + 8);
      ctx.font = G.font(800, 11, 'ui'); ctx.textAlign = 'left'; ctx.fillStyle = '#e8f0ff';
      ctx.fillText('糸の張り', x, y - 8);
      ctx.textAlign = 'right'; ctx.fillText(`のこり ${Math.max(0, Math.round(S.dist * 100))}%`, x + w, y - 8);
      if (S.rage > 0 && !S.fish.junk) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffb08a'; ctx.font = G.font(900, 15, 'head'); ctx.fillText('あばれている！', W / 2, y - 26); }
    }
    // しぶき
    S.splash.forEach((p) => {
      const k = p.t / p.max;
      if (p.ring) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 8 + k * 30, 3 + k * 8, 0, 0, TAU); ctx.stroke(); return; }
      ctx.fillStyle = `rgba(235,248,255,${1 - k})`;
      ctx.beginPath(); ctx.arc(p.x + p.vx * p.t, p.y + p.vy * p.t + 200 * p.t * p.t, 2.2 * (1 - k * 0.5), 0, TAU); ctx.fill();
    });
    // 釣れた魚がはねる
    if (S.mode === 'caught' && S.fish) {
      const u = Math.min(1, S.jump / 0.7);
      ctx.save();
      ctx.translate(G.lerp(S.bx, W / 2, u), G.lerp(S.by, H * 0.32, G.ease.outCubic(u)) - Math.sin(u * Math.PI) * 40);
      ctx.rotate((1 - u) * -0.8 + Math.sin(time * 8) * 0.1);
      drawFish(ctx, S.fish, 1.6 + u * 0.6, time, false);
      ctx.restore();
    }
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky();
    pads();
    const tip = dock();
    line(tip);
    reeds();
    hud();
  }
  function frame(now) {
    if (!root) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }

  F.open = function () {
    if (root) return;
    G.audio.init();
    G.audio.sfx('door');
    data();
    root = document.createElement('div');
    root.id = 'fishFx';
    root.innerHTML = `<canvas></canvas>
      <div class="fs-top"><button class="fs-close" aria-label="ギルドへ戻る">✕</button><div class="fs-title"><b>裏の桟橋</b><small>今日 <span id="fsToday">${data().today}</span>匹 ・ 図鑑 <span id="fsDex">${F.dexCount()}</span>/${F.dexTotal()}</small></div><button class="fs-dex btn sm ghost">図鑑</button></div>
      <div class="fs-msg"></div><div class="fs-hint"></div><div class="fs-card" hidden></div>`;
    document.getElementById('app').appendChild(root);
    cv = root.querySelector('canvas');
    ctx = cv.getContext('2d');
    ui.hint = root.querySelector('.fs-hint');
    ui.msg = root.querySelector('.fs-msg');
    ui.card = root.querySelector('.fs-card');
    resize();
    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    root.querySelector('.fs-close').addEventListener('click', F.close);
    root.querySelector('.fs-dex').addEventListener('click', () => { G.audio.sfx('tap'); F.dex(); });
    reset();
    last = 0;
    requestAnimationFrame(() => root && root.classList.add('shown'));
    raf = requestAnimationFrame(frame);
    G.emit('fishOpen');
  };
  F.close = function () {
    if (!root) return;
    G.audio.sfx('close');
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', up);
    const r = root;
    root = null; cv = null; ctx = null; S = null;
    r.classList.remove('shown');
    setTimeout(() => r.remove(), 300);
    G.ui.refreshHud();
    G.emit('fishClose');
  };
  F.isOpen = () => !!root;
  // テスト用：いまの状態
  F._state = () => S && { mode: S.mode, fish: S.fish && S.fish.id, dist: S.dist, ten: S.ten };
  F._force = (id) => { if (S) { S.fish = F.BY_ID[id]; } };
  F._skipWait = () => { if (S && S.mode === 'wait') S.wait = 0.01; };

  // ---------------------------------------------------------------- 図鑑
  F.dex = function () {
    const d = data();
    const list = F.FISH.filter((f) => !f.event || d.dex[f.id] || eventOn(f.event));
    const n = Object.keys(d.dex).length;
    const cells = list.map((f) => {
      const rec = d.dex[f.id];
      const tl = { day: '昼', dusk: '夕方', night: '夜' }[f.t] || 'いつでも';
      return `<div class="fd-cell r${f.r} ${rec ? 'got' : ''}"><img alt="" src="${F.thumb(f.id, 64, !rec)}"><b>${rec ? f.name : '？？？'}</b><small>${rec ? `最大 ${rec.best}cm ・ ${rec.n}匹` : `${tl}${f.d >= 0.5 ? '・遠く' : ''}${f.event ? '・季節限定' : ''}`}</small></div>`;
    }).join('');
    const goals = DEX_GOALS.map((g) => `<li class="${d.goals[g.n] ? 'done' : n >= g.n ? 'ready' : ''}"><b>${g.n}種</b><span>${g.text}</span>${d.goals[g.n] ? '<i>受取済</i>' : ''}</li>`).join('');
    const html = `<div class="fish-dex"><h2>魚図鑑</h2><p class="sub">${n} / ${list.length}種 ・ これまでに ${d.total}匹</p><ul class="fd-goals">${goals}</ul><div class="fd-grid">${cells}</div><p class="hint">時間帯（昼・夕方・夜）と、どれだけ遠くへ投げるかで、かかる魚が変わります</p></div>`;
    G.ui.modal(html, [{ text: '戻る', cls: 'primary' }], { cls: 'wide' });
  };
  F.data = data;
})();
