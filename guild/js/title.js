// タイトル画面の「世界」：ギルドのある土地のパノラマ
//   空（太陽・月・星・雲・鳥・天空城）→ 山並み（竜の背嶺）→ 海と灯台（潮風の港）→ 丘と森と古城
//   → 町とギルドの塔 → 街道を歩く冒険者 → 手前の草原。カメラはゆっくり流れ、タップで灯りが弾けてギルドへ飛びこむ。
(function () {
  const T = (G.title = {});
  const TAU = Math.PI * 2;
  const DAY_LEN = 720; // scene.js と同じ（12分で1日）
  const WORLD_W = 1400;
  const HORIZON = 470;
  const BASE_Z = 1.08;
  const GUILD_X = 720;
  let cv = null, ctx = null, W = 0, H = 0, dpr = 1, k = 1;
  let raf = 0, last = 0, time = 0, running = false;
  let goT = -1, goDone = null, goFocus = null;
  let phase = 0, night = 0, dusk = 0;
  const art = () => G.art;

  // ---------------------------------------------------------------- 乱数（毎回同じ世界）
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(20251004);
  const STARS = Array.from({ length: 90 }, () => [R() * WORLD_W, R() * 380, 0.5 + R() * 1.4, R() * TAU]);
  const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: R() * 1800, y: 60 + R() * 220, w: 70 + R() * 110, sp: 4 + R() * 7, layer: i % 3 }));
  const FAR_PEAKS = Array.from({ length: 13 }, (_, i) => [i * 120 - 60 + R() * 40, 250 + R() * 70]);
  const NEAR_PEAKS = Array.from({ length: 11 }, (_, i) => [i * 150 - 80 + R() * 50, 330 + R() * 50]);
  const TREES = Array.from({ length: 70 }, () => [620 + R() * 820, R(), 0.7 + R() * 0.6]);
  const HOUSES = Array.from({ length: 12 }, (_, i) => {
    const x = 520 + i * 44 + (R() - 0.5) * 20;
    return { x: x < GUILD_X - 30 || x > GUILD_X + 40 ? x : x + 90, w: 26 + R() * 12, h: 18 + R() * 12, roof: ['#b0503a', '#8a4a6a', '#4a6a9a', '#a0703c'][Math.floor(R() * 4)], smoke: R() < 0.5, lit: R() };
  });
  const FLOWERS = Array.from({ length: 46 }, () => [R() * WORLD_W, 690 + R() * 110, ['#ffd0e0', '#fff3a0', '#c8e0ff', '#ffb080'][Math.floor(R() * 4)], R() * TAU]);
  const GRASS = Array.from({ length: 120 }, () => [R() * WORLD_W, 700 + R() * 110, 8 + R() * 14, R() * TAU]);
  const TRAVELERS = Array.from({ length: 6 }, (_, i) => ({ s: i / 6 + R() * 0.05, sp: 0.018 + R() * 0.012, col: ['#c4553a', '#5468d8', '#3c9a6a', '#e2c870', '#a0703c', '#c8609a'][i], big: R() < 0.3 }));
  const FIREFLY = Array.from({ length: 26 }, () => [R() * WORLD_W, 560 + R() * 220, R() * TAU, 0.5 + R()]);

  // ---------------------------------------------------------------- 時刻
  function updateTime() {
    phase = (Date.now() / 1000 % DAY_LEN) / DAY_LEN;
    const p = phase;
    if (p < 0.04) night = G.lerp(0.7, 0, p / 0.04);
    else if (p < 0.58) night = 0;
    else if (p < 0.68) night = G.ease.inOut((p - 0.58) / 0.1);
    else if (p < 0.9) night = 1;
    else night = G.lerp(1, 0.7, (p - 0.9) / 0.1);
    dusk = p > 0.55 && p < 0.72 ? G.bump((p - 0.55) / 0.17) : p > 0.88 || p < 0.06 ? G.bump(((p + 0.12) % 1) / 0.18) * 0.7 : 0;
  }
  const col = (day, nightC, duskC) => {
    let c = G.mix(day, nightC, night);
    if (duskC && dusk > 0.01) c = G.mix(c, duskC, dusk * 0.55);
    return c;
  };

  // ---------------------------------------------------------------- カメラ
  // 世界の単位：画面の高さ = 800。cx は世界の中心 x。parallax p で奥ほどゆっくり動く
  let cx = 640, camY = 0;
  function sx(wx, p) { return W / 2 + (wx - cx * p - WORLD_W * 0.5 * (1 - p)) * k; }
  function sy(wy) { return (wy + camY) * k; }

  // ---------------------------------------------------------------- 描画パーツ
  function poly(pts, fill) { art().poly(ctx, pts, fill); }
  function fpoly(pts, fill, str) { art().facetPoly(ctx, pts, fill, str || 0.14); }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, sy(HORIZON + 40));
    g.addColorStop(0, col('#5aa8e0', '#0a1028', '#3e4a8a'));
    g.addColorStop(0.65, col('#a8dcf6', '#1c2858', '#e88a6a'));
    g.addColorStop(1, col('#e6f6ff', '#2c3a70', '#ffc890'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 星
    if (night > 0.15) {
      STARS.forEach(([x, y, r, ph]) => {
        const px = ((sx(x, 0.05) % W) + W) % W;
        const tw = 0.45 + 0.55 * Math.sin(time * 1.6 + ph);
        ctx.fillStyle = `rgba(255,250,225,${(0.25 + tw * 0.6) * night})`;
        ctx.fillRect(px, sy(y), r * k * 1.1, r * k * 1.1);
      });
      // オーロラ
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 2; b++) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const x = (i / 24) * W;
          const y = sy(90 + b * 40 + Math.sin(i * 0.5 + time * 0.25 + b) * 22);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let i = 24; i >= 0; i--) ctx.lineTo((i / 24) * W, sy(150 + b * 46 + Math.sin(i * 0.4 + time * 0.2 + b * 2) * 26));
        ctx.closePath();
        ctx.fillStyle = b ? `rgba(170,110,255,${0.07 * night})` : `rgba(90,255,190,${0.08 * night})`;
        ctx.fill();
      }
      ctx.restore();
    }
    // 太陽／月：空をゆっくり渡り、光の筋がまわる
    const dayK = G.clamp((phase - 0.02) / 0.62, 0, 1);
    const nightK = phase >= 0.6 ? (phase - 0.6) / 0.42 : (phase + 0.4) / 0.42;
    const body = night < 0.5 ? { k: dayK, moon: false } : { k: G.clamp(nightK, 0, 1), moon: true };
    const bx = W * (0.12 + body.k * 0.76);
    const by = sy(330 - Math.sin(body.k * Math.PI) * 250);
    const r = 26 * k;
    ctx.save();
    ctx.translate(bx, by);
    const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 5);
    glow.addColorStop(0, body.moon ? 'rgba(220,230,255,0.45)' : dusk > 0.3 ? 'rgba(255,170,90,0.55)' : 'rgba(255,245,200,0.6)');
    glow.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 5, 0, TAU); ctx.fill();
    ctx.rotate(time * (body.moon ? 0.03 : 0.08));
    ctx.fillStyle = body.moon ? 'rgba(210,225,255,0.08)' : 'rgba(255,240,180,0.13)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath(); ctx.moveTo(-r * 0.25, 0); ctx.lineTo(0, -r * (i % 2 ? 4.2 : 6)); ctx.lineTo(r * 0.25, 0); ctx.fill();
    }
    ctx.restore();
    if (body.moon) {
      ctx.fillStyle = '#f2f0dc';
      ctx.beginPath(); ctx.arc(bx, by, r * 0.8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(180,180,160,0.45)';
      [[-0.25, -0.2, 0.18], [0.22, 0.1, 0.13], [-0.05, 0.32, 0.1]].forEach(([x, y, rr]) => { ctx.beginPath(); ctx.arc(bx + x * r, by + y * r, rr * r, 0, TAU); ctx.fill(); });
    } else {
      ctx.fillStyle = dusk > 0.3 ? '#ffb070' : '#fff6d0';
      ctx.beginPath(); ctx.arc(bx, by, r * 0.85, 0, TAU); ctx.fill();
    }
  }

  function cloud(x, y, w, a) {
    ctx.fillStyle = G.rgba(col('#ffffff', '#3a4878', '#ffd2b0'), a);
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, TAU);
    ctx.ellipse(x - w * 0.18, y - w * 0.08, w * 0.2, w * 0.15, 0, 0, TAU);
    ctx.ellipse(x + w * 0.08, y - w * 0.14, w * 0.24, w * 0.19, 0, 0, TAU);
    ctx.ellipse(x + w * 0.3, y - w * 0.04, w * 0.16, w * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  function drawClouds(layer) {
    CLOUDS.forEach((c) => {
      if (c.layer !== layer) return;
      const p = 0.1 + layer * 0.12;
      const span = 1800;
      const wx = ((c.x + time * c.sp) % span) - 200;
      cloud(sx(wx, p), sy(c.y), c.w * k * (0.8 + layer * 0.2), 0.75 - layer * 0.12);
    });
  }

  // 天空城：遠くの空に浮かぶ島
  function drawSkyCastle() {
    const x = sx(800, 0.12), y = sy(128 + Math.sin(time * 0.5) * 6);
    const s = k * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.62 - night * 0.2;
    ctx.translate(x, y);
    ctx.scale(s, s);
    const rock = col('#8a8ab0', '#2a2c4a', '#9a7a9a');
    fpoly([-70, 0, 70, 0, 40, 30, 10, 62, -20, 36, -50, 20], rock, 0.2);
    poly([-70, 0, 70, 0, 66, -6, -66, -6], col('#8ccf7a', '#2c4a40', '#b0a070'));
    const wall = col('#eef0ff', '#5a6090', '#ffd8c0');
    poly([-34, -6, -34, -46, -24, -46, -24, -6], wall);
    poly([24, -6, 24, -52, 34, -52, 34, -6], wall);
    poly([-14, -6, -14, -70, 14, -70, 14, -6], wall);
    poly([-18, -70, 18, -70, 0, -96], col('#5a7ad8', '#2a3470', '#c06a8a'));
    poly([-38, -46, -20, -46, -29, -62], col('#5a7ad8', '#2a3470', '#c06a8a'));
    poly([20, -52, 38, -52, 29, -70], col('#5a7ad8', '#2a3470', '#c06a8a'));
    // 滝
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
    ctx.fillRect(48, 4, 3, 40 + Math.sin(time * 3) * 3);
    ctx.restore();
    // 小島
    [[742, 160, 0.3], [868, 150, 0.36]].forEach(([wx, wy, sc], i) => {
      const ix = sx(wx, 0.12), iy = sy(wy + Math.sin(time * 0.6 + i * 2) * 5);
      ctx.save();
      ctx.globalAlpha = 0.5 - night * 0.15;
      ctx.translate(ix, iy); ctx.scale(k * sc, k * sc);
      fpoly([-40, 0, 40, 0, 16, 26, -8, 34, -26, 14], rock, 0.2);
      poly([-40, 0, 40, 0, 36, -6, -36, -6], col('#8ccf7a', '#2c4a40', '#b0a070'));
      ctx.restore();
    });
  }

  function drawMountains() {
    // 遠い山並み（雪をかぶる）
    const far = col('#8aa6cc', '#1c2648', '#a87a98');
    const snow = col('#f4f8ff', '#6a76a8', '#ffd8c8');
    FAR_PEAKS.forEach(([x, top], i) => {
      const L = sx(x - 110, 0.2), C = sx(x, 0.2), Rr = sx(x + 110, 0.2);
      const b = sy(HORIZON), t = sy(top);
      fpoly([L, b, C, t, Rr, b], G.mix(far, '#ffffff', (i % 3) * 0.04), 0.16);
      poly([C, t, C + (Rr - C) * 0.22, t + (b - t) * 0.22, C + (Rr - C) * 0.08, t + (b - t) * 0.17, C - (C - L) * 0.1, t + (b - t) * 0.24, C - (C - L) * 0.22, t + (b - t) * 0.2], snow);
    });
    // 竜が山の向こうを渡る
    const dk = (time % 24) / 24;
    if (dk < 0.5) {
      const x = sx(-100 + dk * 2 * 1600, 0.2), y = sy(230 + Math.sin(dk * 30) * 10);
      const fl = Math.sin(time * 6) * 0.6;
      ctx.save();
      ctx.translate(x, y); ctx.scale(k * 0.6, k * 0.6);
      ctx.fillStyle = col('#3a2a3a', '#0a0a18', '#4a2030');
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, -6, 24, -2); ctx.lineTo(32, -6); ctx.lineTo(26, 2); ctx.quadraticCurveTo(0, 6, -26, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-14, -26 * (0.4 + fl)); ctx.lineTo(10, -3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-40, 6); ctx.lineTo(-30, -2); ctx.fill();
      ctx.restore();
    }
    // 近い山並み
    const near = col('#6c9a8a', '#16243a', '#8a6a70');
    NEAR_PEAKS.forEach(([x, top], i) => {
      const L = sx(x - 140, 0.35), C = sx(x, 0.35), Rr = sx(x + 150, 0.35);
      fpoly([L, sy(HORIZON + 10), C, sy(top), Rr, sy(HORIZON + 10)], G.mix(near, '#000000', (i % 2) * 0.05), 0.15);
    });
  }

  // 海：画面の左手。白い波頭がゆれ、帆船が行き交い、灯台がまわる
  function drawSea() {
    // 奥の平野（山すそと丘のすき間を埋める）
    ctx.fillStyle = col('#9ccf86', '#1e3c34', '#b0a068');
    ctx.fillRect(0, sy(HORIZON + 4), W, H - sy(HORIZON + 4));
    const x0 = sx(100, 0.5), x1 = sx(610, 0.5);
    const top = sy(HORIZON), bot = sy(600);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, col('#7cc4ea', '#1a2a58', '#e8a080'));
    g.addColorStop(1, col('#2a7ab8', '#0a1634', '#5a4a80'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, top); ctx.lineTo(x1, top); ctx.lineTo(x1 - 60 * k, bot); ctx.lineTo(x0, bot); ctx.closePath();
    ctx.fill();
    // 陽の照り返し
    ctx.fillStyle = night > 0.5 ? 'rgba(220,230,255,0.25)' : dusk > 0.3 ? 'rgba(255,190,120,0.4)' : 'rgba(255,255,230,0.45)';
    for (let i = 0; i < 14; i++) {
      const yy = top + (i / 14) * (bot - top);
      const ww = (6 + i * 1.6) * k * (0.6 + 0.4 * Math.sin(time * 2 + i));
      ctx.fillRect(x0 + (x1 - x0) * 0.5 - ww / 2 + Math.sin(time + i) * 6 * k, yy, ww, 1.2 * k);
    }
    // 波頭（風のタクトのような白い弧）
    ctx.strokeStyle = G.rgba(col('#ffffff', '#8090c0', '#fff0e0'), 0.85);
    ctx.lineWidth = 1.6 * k;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const row = i % 3;
      const yy = top + (0.25 + row * 0.25) * (bot - top) + Math.sin(time * 1.5 + i) * 2 * k;
      const xx = x0 + ((i * 97 + time * (14 + row * 6)) % (x1 - x0 + 80 * k)) - 40 * k;
      const w = (10 + row * 6) * k;
      ctx.beginPath();
      ctx.moveTo(xx - w, yy + w * 0.25);
      ctx.quadraticCurveTo(xx - w * 0.2, yy - w * 0.4, xx + w * 0.4, yy);
      ctx.quadraticCurveTo(xx + w * 0.55, yy + w * 0.2, xx + w * 0.3, yy + w * 0.22);
      ctx.stroke();
    }
    // 帆船
    [[0, 0.012, 0.55], [0.5, 0.009, 0.75]].forEach(([o, sp, sc], i) => {
      const u = (o + time * sp) % 1;
      const xx = x0 + u * (x1 - x0), yy = top + (0.18 + i * 0.3) * (bot - top) + Math.sin(time * 1.2 + i) * 1.5 * k;
      ctx.save(); ctx.translate(xx, yy); ctx.scale(k * sc, k * sc); ctx.rotate(Math.sin(time * 1.2 + i) * 0.05);
      poly([-22, 0, 22, 0, 16, 9, -16, 9], col('#7a4a2a', '#1a1420', '#6a3a2a'));
      poly([-1, 0, 1, 0, 1, -40, -1, -40], '#4a3020');
      poly([2, -38, 2, -4, 22, -6], col('#fff8ea', '#7a80a0', '#ffe0c0'));
      poly([-2, -34, -2, -6, -18, -8], col('#f0e8d8', '#6a7090', '#ffd8b8'));
      poly([1, -40, 12, -37, 1, -34], '#d4493a');
      ctx.restore();
    });
    // 岬と灯台
    const cx0 = sx(545, 0.55), cy0 = sy(HORIZON + 4);
    ctx.save(); ctx.translate(cx0, cy0); ctx.scale(k, k);
    fpoly([-70, 30, -40, -10, 10, -22, 50, 0, 70, 30], col('#7a8a6a', '#1e2a2a', '#8a7060'), 0.18);
    poly([-6, -22, 6, -22, 4, -70, -4, -70], col('#f4f0e8', '#6a7090', '#ffe0d0'));
    poly([-6, -40, 6, -40, 5.6, -48, -5.4, -48], '#d4493a');
    poly([-7, -70, 7, -70, 0, -82], '#d4493a');
    const lit = night > 0.25 || dusk > 0.4;
    ctx.fillStyle = lit ? '#fff2a0' : '#d8e8f0';
    ctx.fillRect(-3, -76, 6, 5);
    if (lit) {
      const a = time * 1.1;
      ctx.globalCompositeOperation = 'lighter';
      const s = Math.cos(a);
      const g2 = ctx.createLinearGradient(0, -73, 160 * s, -73);
      g2.addColorStop(0, 'rgba(255,240,170,0.45)');
      g2.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.moveTo(0, -74); ctx.lineTo(170 * s, -95); ctx.lineTo(170 * s, -52); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function tree(x, y, s, dark) {
    const c1 = col(dark ? '#3e8a5a' : '#58a868', '#14302a', '#7a7a50');
    poly([x - 9 * s, y, x, y - 28 * s, x + 9 * s, y], c1);
    poly([x, y - 28 * s, x + 9 * s, y, x + 2 * s, y], G.mix(c1, '#000000', 0.15));
    poly([x - 1.2 * s, y, x + 1.2 * s, y, x + 1.2 * s, y + 4 * s, x - 1.2 * s, y + 4 * s], col('#6a4a2a', '#1a1418', '#5a3a2a'));
  }
  function drawHills() {
    const g1 = col('#86c47a', '#1c3a32', '#a09060');
    const g2 = col('#6eb06a', '#18322c', '#8a7a50');
    // 奥の丘
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(sx(600, 0.55), sy(HORIZON + 30));
    for (let x = 600; x <= WORLD_W + 200; x += 40) ctx.lineTo(sx(x, 0.55), sy(HORIZON - 10 - Math.sin(x * 0.006) * 40 - Math.sin(x * 0.017) * 12));
    ctx.lineTo(sx(WORLD_W + 200, 0.55), sy(620)); ctx.lineTo(sx(600, 0.55), sy(620));
    ctx.closePath(); ctx.fill();
    // 古城の廃墟（丘の上）
    const qx = sx(830, 0.55), qy = sy(HORIZON - 10 - Math.sin(830 * 0.006) * 40 - Math.sin(830 * 0.017) * 12 - 8);
    ctx.save(); ctx.translate(qx, qy); ctx.scale(k * 0.8, k * 0.8);
    const stone = col('#8a8494', '#22223a', '#9a7a7a');
    fpoly([-40, 10, -40, -30, -30, -30, -30, -24, -22, -24, -22, -30, -12, -30, -12, 10], stone, 0.2);
    fpoly([-12, 10, -12, -50, 12, -50, 12, 10], G.mix(stone, '#ffffff', 0.06), 0.2);
    poly([-14, -50, 14, -50, 0, -66], col('#5a4a6a', '#1a1428', '#6a3a4a'));
    fpoly([12, 10, 12, -20, 30, -26, 36, 10], stone, 0.2);
    ctx.fillStyle = night > 0.4 ? '#ffcf70' : '#2a2430';
    ctx.fillRect(-3, -40, 6, 8);
    ctx.restore();
    // 森
    TREES.forEach(([x, r, s]) => {
      if (x > 790 && x < 880) return;
      const yy = HORIZON - 8 - Math.sin(x * 0.006) * 40 - Math.sin(x * 0.017) * 12 + r * 60;
      tree(sx(x, 0.58), sy(yy), s * k, r > 0.5);
    });
    // 手前の丘
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(sx(-300, 0.75), sy(640));
    for (let x = -300; x <= WORLD_W + 400; x += 50) ctx.lineTo(sx(x, 0.75), sy(560 - Math.sin(x * 0.004 + 1) * 26 - Math.sin(x * 0.013) * 8));
    ctx.lineTo(sx(WORLD_W + 400, 0.75), sy(820)); ctx.lineTo(sx(-300, 0.75), sy(820));
    ctx.closePath(); ctx.fill();
  }

  // ギルドの塔：町の真ん中。てっぺんの大きなランタンが、ロゴの灯りとつながる
  function guildPos() { return [sx(GUILD_X, 0.85), sy(548)]; }
  function drawTown() {
    const p = 0.85;
    const lit = Math.max(night, dusk * 0.8);
    // 家並み
    HOUSES.forEach((h, i) => {
      const x = sx(h.x, p), y = sy(560 - Math.sin(h.x * 0.004 + 1) * 10);
      const w = h.w * k, hh = h.h * k;
      fpoly([x - w / 2, y, x - w / 2, y - hh, x + w / 2, y - hh, x + w / 2, y], col('#efe2c8', '#3a3a58', '#f0c8a8'), 0.12);
      poly([x - w / 2 - 3 * k, y - hh, x, y - hh - w * 0.45, x + w / 2 + 3 * k, y - hh], col(h.roof, G.mix(h.roof, '#101020', 0.7), G.mix(h.roof, '#ff9a60', 0.2)));
      ctx.fillStyle = h.lit < lit + 0.15 && lit > 0.2 ? '#ffd27a' : col('#6a7a90', '#20243a');
      ctx.fillRect(x - w * 0.25, y - hh * 0.62, w * 0.18, hh * 0.28);
      ctx.fillRect(x + w * 0.08, y - hh * 0.62, w * 0.18, hh * 0.28);
      poly([x - w * 0.08, y, x - w * 0.08, y - hh * 0.4, x + w * 0.08, y - hh * 0.4, x + w * 0.08, y], col('#7a4a2a', '#1a1418'));
      if (h.smoke) {
        const chx = x + w * 0.28, chy = y - hh - w * 0.2;
        poly([chx - 2.5 * k, chy + 6 * k, chx - 2.5 * k, chy - 4 * k, chx + 2.5 * k, chy - 4 * k, chx + 2.5 * k, chy + 6 * k], '#8a5a3a');
        for (let j = 0; j < 4; j++) {
          const u = ((time * 0.35 + j / 4 + i * 0.13) % 1);
          ctx.fillStyle = G.rgba(col('#ffffff', '#8890b0'), 0.45 * (1 - u));
          ctx.beginPath(); ctx.arc(chx + u * 14 * k + Math.sin(u * 6 + i) * 3 * k, chy - 6 * k - u * 34 * k, (2 + u * 5) * k, 0, TAU); ctx.fill();
        }
      }
    });
    // 風車
    const wx = sx(980, p), wy = sy(548);
    ctx.save(); ctx.translate(wx, wy); ctx.scale(k, k);
    fpoly([-9, 0, -6, -40, 6, -40, 9, 0], col('#e8dcc0', '#3a3a58', '#f0c8a8'), 0.15);
    poly([-8, -40, 8, -40, 0, -50], '#a0503a');
    ctx.translate(0, -40);
    ctx.rotate(time * 0.7);
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); poly([-1.5, 0, 1.5, 0, 4, -30, -2, -30], col('#f4ecd8', '#5a6080', '#ffe0c0')); }
    ctx.restore();
    // ギルドの塔
    const [gx, gy] = guildPos();
    ctx.save(); ctx.translate(gx, gy); ctx.scale(k, k);
    const wall = col('#d8c4a0', '#3a3654', '#e8b890');
    const wood = col('#8a5a3a', '#241a24', '#7a4a32');
    fpoly([-30, 0, -30, -46, 30, -46, 30, 0], wall, 0.12);
    fpoly([-24, -46, -24, -92, 24, -92, 24, -46], G.mix(wall, '#ffffff', 0.05), 0.12);
    fpoly([-18, -92, -18, -126, 18, -126, 18, -92], wall, 0.12);
    poly([-36, -46, 36, -46, 30, -52, -30, -52], wood);
    poly([-30, -92, 30, -92, 24, -98, -24, -98], wood);
    poly([-24, -126, 24, -126, 0, -156], col('#3a5a9a', '#141c3a', '#6a4a7a'));
    // 窓と扉
    const wl = lit > 0.2 ? '#ffd27a' : col('#5a6a80', '#20243a');
    [[-18, -30], [10, -30], [-14, -76], [6, -76], [-5, -116]].forEach(([x, y]) => { ctx.fillStyle = wl; ctx.fillRect(x, y, 8, 10); });
    poly([-7, 0, -7, -16, 0, -21, 7, -16, 7, 0], wood);
    ctx.fillStyle = 'rgba(255,210,120,0.8)';
    ctx.fillRect(-1, -12, 2, 2);
    // 旗
    const fw = Math.sin(time * 3) * 3;
    poly([0, -156, 1.5, -156, 1.5, -176, 0, -176], '#5a3a26');
    poly([1.5, -176, 20 + fw, -172, 1.5, -166], '#d4493a');
    poly([-30, -46, -30, -30, -38 + fw * 0.4, -26, -38 + fw * 0.4, -42], '#c8901e');
    poly([30, -46, 30, -30, 38 - fw * 0.4, -26, 38 - fw * 0.4, -42], '#c8901e');
    // てっぺんのランタン（いつも灯っている）
    const fl = 0.85 + 0.15 * Math.sin(time * 7) * Math.sin(time * 3.1);
    const lg = ctx.createRadialGradient(0, -138, 2, 0, -138, 60);
    lg.addColorStop(0, `rgba(255,220,140,${0.55 * fl})`);
    lg.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(0, -138, 60, 0, TAU); ctx.fill();
    poly([-5, -132, 5, -132, 6, -142, 0, -147, -6, -142], `rgba(255,${200 + 30 * fl | 0},120,1)`);
    ctx.restore();
  }

  // 街道：手前からギルドへ。小さな冒険者たちが歩いていく
  function roadPt(u) {
    // u=0 手前の左下, u=1 ギルドの扉
    const x = G.lerp(380, GUILD_X, u) + Math.sin(u * 5) * 60 * (1 - u);
    const y = G.lerp(840, 556, Math.pow(u, 0.8));
    return [x, y];
  }
  function drawRoad() {
    const pR = 1;
    ctx.fillStyle = col('#d8c08a', '#3a3448', '#e0a878');
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = roadPt(i / 20); const w = G.lerp(70, 6, i / 20); const px = sx(x - w, G.lerp(1.1, 0.85, i / 20)); if (i === 0) ctx.moveTo(px, sy(y)); else ctx.lineTo(px, sy(y)); }
    for (let i = 20; i >= 0; i--) { const [x, y] = roadPt(i / 20); const w = G.lerp(70, 6, i / 20); ctx.lineTo(sx(x + w, G.lerp(1.1, 0.85, i / 20)), sy(y)); }
    ctx.closePath(); ctx.fill();
    TRAVELERS.forEach((tr, i) => {
      const u = (tr.s + time * tr.sp) % 1;
      if (u > 0.96) return;
      const [x, y] = roadPt(u);
      const s = G.lerp(1.5, 0.35, u) * k * (tr.big ? 1.1 : 1);
      const px = sx(x + (i % 2 ? 10 : -10) * (1 - u), G.lerp(1.1, 0.85, u)), py = sy(y);
      const bob = Math.abs(Math.sin(time * 6 + i)) * 1.6 * s;
      ctx.save(); ctx.translate(px, py - bob); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(0, bob / s, 6, 2, 0, 0, TAU); ctx.fill();
      poly([-4, 0, 4, 0, 3.5, -12, -3.5, -12], tr.col);
      ctx.fillStyle = '#f2c6a0';
      ctx.beginPath(); ctx.arc(0, -15, 3.6, 0, TAU); ctx.fill();
      poly([-4, -16, 4, -16, 0, -22], G.mix(tr.col, '#000000', 0.25));
      if (tr.big) poly([4, -2, 6, -2, 6, -18, 4, -18], '#c8c8d0');
      ctx.restore();
    });
  }

  function drawForeground() {
    const p = 1.25;
    // 草原
    const g = ctx.createLinearGradient(0, sy(660), 0, H);
    g.addColorStop(0, col('#7cc070', '#1a3a2e', '#9a9a58'));
    g.addColorStop(1, col('#5aa058', '#10261e', '#7a7a48'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i <= 16; i++) { const x = (i / 16) * W; ctx.lineTo(x, sy(690 + Math.sin(i * 0.9 + cx * 0.004) * 14)); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // 草が風にゆれる
    const wind = Math.sin(time * 1.3) * 0.5 + 0.5;
    ctx.strokeStyle = col('#9ad884', '#2a5040', '#b0b070');
    ctx.lineWidth = 1.4 * k;
    ctx.beginPath();
    GRASS.forEach(([x, y, h, ph]) => {
      const px = ((sx(x, p) % (W + 40)) + W + 40) % (W + 40) - 20, py = sy(y);
      const sw = (Math.sin(time * 2 + ph + x * 0.01) * 0.4 + wind * 0.8) * h * 0.5 * k;
      ctx.moveTo(px, py); ctx.quadraticCurveTo(px + sw * 0.3, py - h * 0.5 * k, px + sw, py - h * k);
    });
    ctx.stroke();
    FLOWERS.forEach(([x, y, c, ph]) => {
      const px = ((sx(x, p) % (W + 40)) + W + 40) % (W + 40) - 20, py = sy(y) + Math.sin(time * 2 + ph) * k;
      ctx.fillStyle = c;
      for (let j = 0; j < 4; j++) { const a = j * TAU / 4 + ph; ctx.beginPath(); ctx.arc(px + Math.cos(a) * 2.2 * k, py + Math.sin(a) * 2.2 * k, 1.8 * k, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath(); ctx.arc(px, py, 1.3 * k, 0, TAU); ctx.fill();
    });
    // 左手前の大きな木（画面の額縁）
    const tx = sx(80, 1.3), ty = sy(800);
    ctx.save(); ctx.translate(tx, ty); ctx.scale(k * 1.6, k * 1.6);
    poly([-10, 0, 10, 0, 6, -90, -6, -90], col('#5a3a24', '#140e14', '#4a2a1a'));
    const leaf = col('#3e8a4e', '#0e2420', '#6a6a3a');
    const sway = Math.sin(time * 0.9) * 3;
    [[0, -110, 60], [-40, -90, 42], [38, -94, 46], [-10, -140, 40], [30, -128, 34]].forEach(([x, y, r], i) => {
      fpoly([x - r + sway, y, x - r * 0.5 + sway, y - r * 0.8, x + r * 0.5 + sway, y - r * 0.85, x + r + sway, y - r * 0.05, x + r * 0.6 + sway, y + r * 0.6, x - r * 0.6 + sway, y + r * 0.55], G.mix(leaf, '#ffffff', (i % 2) * 0.06), 0.18);
    });
    ctx.restore();
    // 夜の蛍／昼の花びら
    if (night > 0.3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      FIREFLY.forEach(([x, y, ph, s]) => {
        const px = ((sx(x + Math.sin(time * 0.4 + ph) * 30, 1.1) % W) + W) % W, py = sy(y + Math.cos(time * 0.5 + ph) * 18);
        const a = (0.4 + 0.6 * Math.max(0, Math.sin(time * 2 * s + ph))) * night;
        const gg = ctx.createRadialGradient(px, py, 0, px, py, 7 * k);
        gg.addColorStop(0, `rgba(230,255,150,${a})`); gg.addColorStop(1, 'rgba(230,255,150,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, 7 * k, 0, TAU); ctx.fill();
      });
      ctx.restore();
    } else {
      for (let i = 0; i < 14; i++) {
        const u = ((time * 0.06 + i / 14) % 1);
        const px = W * (1.05 - u * 1.2) + Math.sin(time * 1.5 + i) * 20 * k, py = sy(200 + i * 40 + Math.sin(u * 8 + i) * 30);
        ctx.save(); ctx.translate(px, py); ctx.rotate(time * 2 + i);
        ctx.fillStyle = i % 3 ? 'rgba(255,210,225,0.85)' : 'rgba(255,240,200,0.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, 3 * k, 1.6 * k, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  // 鳥の群れ・風の渦
  function drawBirds() {
    if (night > 0.7) return;
    const u = (time % 18) / 18;
    const bx = W * (1.15 - u * 1.4), by = sy(190 + Math.sin(u * 6) * 20);
    ctx.strokeStyle = col('#3a3a4a', '#a0a8c8', '#4a2a2a');
    ctx.lineWidth = 1.5 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ox = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14 * k * 0.6 + i * 6 * k, oy = Math.ceil(i / 2) * 9 * k;
      const fl = Math.sin(time * 9 + i) * 3 * k;
      const x = bx + ox, y = by + oy;
      ctx.moveTo(x - 5 * k, y - fl); ctx.quadraticCurveTo(x - 2 * k, y - 2 * k, x, y); ctx.quadraticCurveTo(x + 2 * k, y - 2 * k, x + 5 * k, y - fl);
    }
    ctx.stroke();
  }
  function drawWind() {
    ctx.strokeStyle = G.rgba(col('#ffffff', '#b0c0f0', '#fff0e0'), 0.7);
    ctx.lineWidth = 1.8 * k;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const per = 7 + i * 2.3;
      const u = ((time + i * 2.9) % per) / per;
      if (u > 0.55) continue;
      const v = u / 0.55;
      const y = sy(300 + i * 120);
      const x = W * (1.1 - v * 1.3);
      const len = 70 * k;
      const a = Math.sin(v * Math.PI);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x + len, y);
      ctx.bezierCurveTo(x + len * 0.6, y - 4 * k, x + len * 0.3, y + 6 * k, x, y);
      // 先端がくるりと巻く
      const r = 8 * k;
      ctx.arc(x - r * 0.2, y - r, r, Math.PI * 0.5, Math.PI * 0.5 + TAU * 0.85 * Math.min(1, v * 2), false);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- 1コマ
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 入場：空から地上へゆっくり見下ろす
    const intro = G.ease.inOut(G.clamp(time / 3.2, 0, 1));
    camY = -(1 - intro) * 260;
    cx = 640 + Math.sin(time * 0.045) * 170;
    // タップ後：引いて、ギルドへ飛びこむ
    let z = BASE_Z, fx = W / 2, fy = H * 0.55, panX = 0, panY = 0, white = 0;
    if (goT >= 0) {
      const a = G.seg(goT, 0, 0.32), b = G.seg(goT, 0.32, 1.05);
      if (!goFocus) goFocus = guildPos();
      const [gx, gy] = goFocus;
      z = goT < 0.32 ? BASE_Z - G.ease.outCubic(a) * (BASE_Z - 1) : 1 + Math.pow(b, 2.4) * 7;
      fx = G.lerp(W / 2, gx, G.ease.inOut(b)); fy = G.lerp(H * 0.55, gy - 16 * k, G.ease.inOut(b));
      panX = (W / 2 - fx) * G.ease.inOut(b);
      panY = (H * 0.5 - fy) * G.ease.inOut(b);
      white = G.seg(goT, 0.6, 1.05);
    }
    ctx.save();
    if (z !== 1 || panX || panY) {
      // 引いたときに世界の外が見えないよう、空で下塗り
      ctx.fillStyle = col('#a8dcf6', '#1c2858', '#e88a6a');
      ctx.fillRect(0, 0, W, H);
      ctx.translate(fx + panX, fy + panY);
      ctx.scale(z, z);
      ctx.translate(-fx, -fy);
    }
    drawSky();
    drawClouds(0);
    drawSkyCastle();
    drawBirds();
    drawMountains();
    drawClouds(1);
    drawSea();
    drawHills();
    drawTown();
    drawRoad();
    drawClouds(2);
    drawForeground();
    drawWind();
    ctx.restore();
    // ロゴの下を少し暗くして読みやすく
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(6,10,22,0.42)');
    vg.addColorStop(0.42, 'rgba(6,10,22,0.08)');
    vg.addColorStop(0.75, 'rgba(6,10,22,0)');
    vg.addColorStop(1, 'rgba(6,10,22,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // 灯りが弾ける（ふぁああーん）
    if (goT >= 0) {
      const [gx, gy] = goFocus || guildPos();
      const lx = gx + (W / 2 - gx) * G.ease.inOut(G.seg(goT, 0.32, 1.05)), ly = gy - 138 * k;
      const fk = G.seg(goT, 0, 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = (40 + fk * 520) * k;
      const gg = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
      gg.addColorStop(0, `rgba(255,250,230,${0.95 * (1 - fk * 0.4)})`);
      gg.addColorStop(0.35, `rgba(255,210,130,${0.55 * (1 - fk * 0.5)})`);
      gg.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(lx, ly, rr, 0, TAU); ctx.fill();
      // 光の輪
      for (let j = 0; j < 3; j++) {
        const u = G.seg(goT, j * 0.09, 0.55 + j * 0.09);
        if (u <= 0 || u >= 1) continue;
        ctx.strokeStyle = `rgba(255,236,180,${(1 - u) * 0.85})`;
        ctx.lineWidth = (6 - j * 1.5) * k * (1 - u * 0.6);
        ctx.beginPath(); ctx.arc(lx, ly, (20 + u * 380) * k, 0, TAU); ctx.stroke();
      }
      // 光の筋（集中線）
      const sk = G.seg(goT, 0.3, 1.0);
      if (sk > 0) {
        ctx.fillStyle = `rgba(255,245,220,${0.35 * G.bump(sk)})`;
        for (let i = 0; i < 28; i++) {
          const a = i * TAU / 28 + i * 0.37;
          const r0 = (60 + (i % 5) * 20) * k * (1 - sk * 0.5), r1 = Math.max(W, H);
          ctx.beginPath();
          ctx.moveTo(lx + Math.cos(a - 0.012) * r0, ly + Math.sin(a - 0.012) * r0);
          ctx.lineTo(lx + Math.cos(a) * r1, ly + Math.sin(a) * r1);
          ctx.lineTo(lx + Math.cos(a + 0.012) * r0, ly + Math.sin(a + 0.012) * r0);
          ctx.fill();
        }
      }
      ctx.restore();
      if (white > 0) { ctx.fillStyle = `rgba(255,248,232,${white})`; ctx.fillRect(0, 0, W, H); }
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    if (goT >= 0) {
      goT += dt;
      if (goT > 1.05 && goDone) { const f = goDone; goDone = null; f(); }
    }
    updateTime();
    render();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    k = H / 800;
    // 横長の画面では、世界が足りなくならないように少し寄せる
    if (W / k > 760) k = W / 760;
  }

  T.start = function () {
    const boot = document.getElementById('boot');
    if (!boot || cv) return;
    cv = document.createElement('canvas');
    cv.className = 'title-world';
    cv.setAttribute('aria-hidden', 'true');
    boot.prepend(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    running = true;
    last = 0;
    updateTime();
    raf = requestAnimationFrame(frame);
  };
  // タップ：灯りが弾けて、引いてからギルドへ飛びこむ。終わったら done()
  T.go = function (done) {
    if (!running) { if (done) done(); return; }
    goT = 0;
    goFocus = null;
    goDone = done || null;
  };
  T.stop = function () {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    cv = null; ctx = null;
  };
  T.isNight = () => night > 0.5;
})();
