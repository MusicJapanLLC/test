/* 方向性を決めるための5枚の絵（すべてコードで描くドット絵）
 * 画面は 240×426 ドット。4倍に拡大し、文字は高解像度のドットフォントで重ねる。
 */
'use strict';
(function () {
  const SC = (window.SCENES = {});
  const W = 240, H = 426, Z = 4;
  SC.W = W; SC.H = H; SC.Z = Z;

  // ---------------------------------------------------------------- palette
  const C = {
    ink: '#120c14',
    stone: ['#1c1a24', '#2a2734', '#3a3646', '#4c4859', '#625e70', '#7c788a', '#9c98a8'],
    cob: ['#221e28', '#332e3a', '#433d4a', '#564f5c', '#6a6270', '#807684'],
    wood: ['#1e120c', '#33201a', '#4c2e20', '#6a4028', '#8a5632', '#a8703e', '#c89058'],
    plaster: ['#6a5a4a', '#8e7c66', '#b09c80', '#cdb998', '#e2d2b2', '#f0e4c8'],
    roof: ['#121a30', '#1c2846', '#26365c', '#324874', '#425c8c', '#5874a4'],
    leaf: ['#0c1a16', '#132a22', '#1c3c2c', '#285236', '#386a40', '#4e864a', '#6aa056'],
    grass: ['#16261a', '#203822', '#2c4a2a', '#3c6032', '#4e763c'],
    warm: ['#5a2a10', '#9a4a18', '#d8782a', '#f8a840', '#ffd46a', '#fff2c0'],
    banner: ['#0e1430', '#18224e', '#24347a', '#3448a0', '#4a62c0'],
    gold: ['#4a3010', '#7a5418', '#b08028', '#e0b040', '#f8dc78', '#fff4c0'],
    red: ['#3a1218', '#601c22', '#8a2a2a', '#b43c34', '#d85a44'],
    cream: ['#8a7a60', '#b8a888', '#ddd0b0', '#f2e8d0'],
  };
  SC.C = C;
  const R = (ramp, i) => ramp[Math.max(0, Math.min(ramp.length - 1, i))];

  // ---------------------------------------------------------------- helpers
  function cobbles(c, x0, y0, w, h, seed, ramp = C.cob, opt = {}) {
    const rnd = PX.rng(seed);
    PX.rect(c, x0, y0, w, h, ramp[0]);
    let y = y0;
    let row = 0;
    while (y < y0 + h) {
      const sh = 4 + Math.floor(rnd() * 2) + (opt.persp ? Math.floor(((y - y0) / h) * 2) : 0);
      let x = x0 - Math.floor(rnd() * 6) - (row % 2) * 3;
      while (x < x0 + w) {
        const sw = 5 + Math.floor(rnd() * 5);
        const base = 2 + Math.floor(rnd() * 2.4);
        const cx0 = Math.max(x0, x + 1), cx1 = Math.min(x0 + w - 1, x + sw - 1);
        const cy0 = y + 1, cy1 = Math.min(y0 + h - 1, y + sh - 1);
        if (cx1 > cx0 && cy1 > cy0) {
          PX.rect(c, cx0, cy0, cx1 - cx0 + 1, cy1 - cy0 + 1, R(ramp, base));
          PX.hline(c, cx0 + 1, cx1 - 1, cy0, R(ramp, base + 1));
          PX.hline(c, cx0, cx1, cy1, R(ramp, base - 1));
          PX.p(c, cx0, cy0, ramp[0]);
          PX.p(c, cx1, cy0, ramp[0]);
          if (rnd() < 0.18) PX.p(c, cx0 + 1 + Math.floor(rnd() * (cx1 - cx0 - 1)), cy0 + 1, R(ramp, base + 2));
          if (opt.moss && rnd() < 0.08) PX.p(c, cx0, cy1, C.grass[2]);
        }
        x += sw;
      }
      y += sh;
      row++;
    }
  }

  function bricks(c, x0, y0, w, h, ramp, seed, bw = 8, bh = 4) {
    const rnd = PX.rng(seed);
    PX.rect(c, x0, y0, w, h, ramp[0]);
    for (let j = 0, y = y0; y < y0 + h; j++, y += bh) {
      for (let x = x0 - (j % 2) * (bw / 2); x < x0 + w; x += bw) {
        const a = Math.max(x0, x + 1), b = Math.min(x0 + w - 1, x + bw - 1);
        const t = Math.min(y0 + h - 1, y + bh - 1);
        if (b <= a) continue;
        const lv = 2 + Math.floor(rnd() * 2);
        PX.rect(c, a, y + 1, b - a + 1, t - y, R(ramp, lv));
        PX.hline(c, a, b, y + 1, R(ramp, lv + 1));
      }
    }
  }

  function planksV(c, x0, y0, w, h, ramp, seed, pw = 4) {
    const rnd = PX.rng(seed);
    for (let x = x0, i = 0; x < x0 + w; x += pw, i++) {
      const lv = 2 + Math.floor(rnd() * 2);
      PX.rect(c, x, y0, Math.min(pw, x0 + w - x), h, R(ramp, lv));
      PX.vline(c, x, y0, y0 + h - 1, R(ramp, 1));
      for (let k = 0; k < 3; k++) PX.vline(c, x + 1 + Math.floor(rnd() * (pw - 1)), y0 + Math.floor(rnd() * h), y0 + Math.floor(rnd() * h), R(ramp, lv - 1));
    }
  }
  function planksH(c, x0, y0, w, h, ramp, seed, ph = 3) {
    const rnd = PX.rng(seed);
    for (let y = y0; y < y0 + h; y += ph) {
      let x = x0 - Math.floor(rnd() * 12);
      while (x < x0 + w) {
        const len = 14 + Math.floor(rnd() * 16);
        const lv = 2 + Math.floor(rnd() * 2);
        const a = Math.max(x0, x), b = Math.min(x0 + w - 1, x + len - 1);
        PX.rect(c, a, y, b - a + 1, Math.min(ph, y0 + h - y), R(ramp, lv));
        PX.hline(c, a, b, y, R(ramp, lv + 1));
        PX.vline(c, b, y, y + ph - 1, R(ramp, 1));
        x += len;
      }
      PX.hline(c, x0, x0 + w - 1, y + ph - 1, R(ramp, 1));
    }
  }

  function shingles(c, x0, y0, w, h, ramp, seed) {
    const rnd = PX.rng(seed);
    PX.rect(c, x0, y0, w, h, ramp[1]);
    for (let j = 0, y = y0; y < y0 + h; j++, y += 3) {
      for (let x = x0 - (j % 2) * 3; x < x0 + w; x += 6) {
        const a = Math.max(x0, x), b = Math.min(x0 + w - 1, x + 5);
        if (b < a) continue;
        const lv = 2 + Math.floor(rnd() * 2.3) + (j < 2 ? 1 : 0);
        PX.rect(c, a, y, b - a + 1, 3, R(ramp, lv));
        PX.hline(c, a, b, y + 2, R(ramp, lv - 1));
        PX.p(c, b, y + 2, ramp[0]);
        if (rnd() < 0.12) PX.p(c, a + 1, y, R(ramp, lv + 2));
      }
    }
  }

  // 窓（ガラスは後で光らせるので emissive リストに積む）
  function windowFrame(c, x, y, w, h, em, opt = {}) {
    PX.rect(c, x - 1, y - 1, w + 2, h + 2, C.wood[1]);
    PX.rect(c, x, y, w, h, '#1a1420');
    em.push(() => {
      PX.gradV(c, x, y, w, h, ['#ffe9a0', '#ffc860', '#e08a30']);
      if (opt.curtain) {
        PX.rect(c, x, y, 2, h, C.red[3]);
        PX.rect(c, x + w - 2, y, 2, h, C.red[3]);
        PX.vline(c, x + 1, y, y + h - 1, C.red[2]);
      }
      PX.vline(c, x + Math.floor(w / 2), y, y + h - 1, C.wood[1]);
      PX.hline(c, x, x + w - 1, y + Math.floor(h / 2), C.wood[1]);
      if (opt.silhouette) PX.rect(c, x + 2, y + h - 4, 3, 4, '#5a3020');
    });
    if (opt.box) {
      PX.rect(c, x - 2, y + h + 1, w + 4, 3, C.wood[3]);
      PX.hline(c, x - 2, x + w + 1, y + h + 1, C.wood[4]);
      for (let i = 0; i < w + 2; i += 2) {
        PX.p(c, x - 1 + i, y + h, i % 4 ? C.red[4] : '#e8c050');
        PX.p(c, x + i, y + h - 1 + (i % 3 === 0 ? 0 : 1), C.leaf[4]);
      }
    }
  }

  function lanternPost(c, x, y, em, lights, h = 26) {
    // 足元の台
    PX.rect(c, x - 3, y - 2, 7, 3, C.stone[2]);
    PX.hline(c, x - 3, x + 3, y - 2, C.stone[4]);
    PX.rect(c, x - 1, y - h, 3, h - 2, '#1e1a22');
    PX.vline(c, x, y - h, y - 3, '#3a3440');
    // 灯具
    PX.rect(c, x - 3, y - h - 2, 7, 1, '#1e1a22');
    PX.rect(c, x - 2, y - h - 9, 5, 7, '#1e1a22');
    PX.rect(c, x - 3, y - h - 10, 7, 1, '#1e1a22');
    PX.p(c, x, y - h - 11, '#1e1a22');
    em.push(() => {
      PX.rect(c, x - 1, y - h - 8, 3, 5, '#ffd46a');
      PX.p(c, x, y - h - 6, '#fff6d0');
      PX.p(c, x, y - h - 5, '#fff6d0');
    });
    lights.push({ x, y: y - h - 5, r: 46, i: 0.95 });
    lights.push({ x, y: y - 2, r: 28, i: 0.35 });
  }

  function barrel(c, x, y) {
    const spr = PX.shaped(10, 13, (m) => { m.fillStyle = '#fff'; m.fillRect(1, 0, 8, 13); m.fillRect(0, 2, 10, 9); }, C.wood, { vgrad: 1.5 });
    c.drawImage(spr, x, y - 13);
    PX.hline(c, x + 1, x + 8, y - 10, '#3a3440');
    PX.hline(c, x + 1, x + 8, y - 4, '#3a3440');
    PX.hline(c, x + 2, x + 7, y - 13, C.wood[5]);
  }
  function crate(c, x, y, w = 11, h = 10) {
    PX.rect(c, x, y - h, w, h, C.wood[1]);
    PX.rect(c, x + 1, y - h + 1, w - 2, h - 2, C.wood[4]);
    PX.hline(c, x + 1, x + w - 2, y - h + 1, C.wood[5]);
    PX.line(c, x + 1, y - 2, x + w - 2, y - h + 1, C.wood[2]);
    PX.rect(c, x, y - h - 3, w, 3, C.wood[5]);
    PX.hline(c, x, x + w - 1, y - h - 3, C.wood[6]);
  }

  function tree(c, x, y, r, seed, ramp = C.leaf) {
    const rnd = PX.rng(seed);
    PX.rect(c, x - 2, y - r, 4, r, C.wood[2]);
    PX.vline(c, x - 2, y - r, y - 1, C.wood[3]);
    PX.p(c, x - 3, y - 1, C.wood[2]); PX.p(c, x + 2, y - 1, C.wood[1]);
    const S = Math.ceil(r * 3);
    const blobs = [];
    for (let i = 0; i < 8; i++) blobs.push([S / 2 + (rnd() - 0.5) * r * 1.3, S * 0.55 + (rnd() - 0.5) * r * 0.9, r * (0.42 + rnd() * 0.3)]);
    const spr = PX.shaped(S, S, (m) => {
      blobs.forEach(([bx, by, br]) => PX.ellipse(m, bx, by, br, br * 0.85, '#fff'));
    }, ramp, { vgrad: 2.2, base: ramp.length - 2, rim: true });
    c.drawImage(spr, Math.round(x - S / 2), Math.round(y - r * 0.8 - S * 0.85));
  }
  function bush(c, x, y, w, h, seed) {
    const rnd = PX.rng(seed);
    const spr = PX.shaped(w + 2, h + 2, (m) => {
      for (let i = 0; i < 6; i++) PX.ellipse(m, 1 + w * (0.15 + rnd() * 0.7), 1 + h * (0.35 + rnd() * 0.4), w * 0.28, h * 0.42, '#fff');
    }, C.leaf, { vgrad: 1.5, rim: true });
    c.drawImage(spr, x, y - h);
    // 花
    for (let i = 0; i < 4; i++) PX.p(c, x + 2 + Math.floor(rnd() * (w - 3)), y - h + 2 + Math.floor(rnd() * (h - 3)), rnd() < 0.5 ? '#e86a7a' : '#f2e2a0');
  }

  function person(c, key, x, y, pose = 'front', flip = false, over = {}) {
    const o = Object.assign({}, SP.CAST[key], over);
    const s = SP.make(o, pose);
    // 影
    PX.rect(c, x - 5, y, 10, 1, 'rgba(10,6,12,0.45)');
    PX.rect(c, x - 4, y + 1, 8, 1, 'rgba(10,6,12,0.3)');
    if (flip) {
      c.save();
      c.translate(Math.round(x) + 8, 0);
      c.scale(-1, 1);
      c.drawImage(s, 0, Math.round(y - s.height + 1));
      c.restore();
    } else c.drawImage(s, Math.round(x - 8), Math.round(y - s.height + 1));
  }
  SC.person = person;

  function bannerHang(c, x, y, w, h, emblem = true) {
    PX.rect(c, x - 1, y - 1, w + 2, 2, C.wood[2]);
    PX.rect(c, x, y, w, h, C.banner[2]);
    PX.vline(c, x, y, y + h - 1, C.banner[3]);
    PX.vline(c, x + w - 1, y, y + h - 1, C.banner[1]);
    PX.rect(c, x + 1, y + 1, w - 2, 1, C.gold[3]);
    // 燕尾
    for (let i = 0; i < Math.ceil(w / 2); i++) {
      PX.vline(c, x + i, y + h, y + h + Math.floor(i * 0.8), C.banner[2]);
      PX.vline(c, x + w - 1 - i, y + h, y + h + Math.floor(i * 0.8), C.banner[1]);
    }
    if (emblem) lanternIcon(c, x + Math.floor(w / 2) - 3, y + Math.floor(h / 2) - 4);
  }
  // ギルドの紋章：ランタン
  function lanternIcon(c, x, y, col = C.gold) {
    PX.rect(c, x + 2, y, 3, 1, col[3]);
    PX.rect(c, x + 1, y + 1, 5, 1, col[3]);
    PX.rect(c, x + 1, y + 2, 1, 5, col[3]);
    PX.rect(c, x + 5, y + 2, 1, 5, col[2]);
    PX.rect(c, x + 2, y + 2, 3, 5, col[4]);
    PX.p(c, x + 3, y + 4, col[5]);
    PX.rect(c, x, y + 7, 7, 1, col[3]);
  }
  SC.lanternIcon = lanternIcon;

  function stars(c, x0, y0, w, h, n, seed) {
    const rnd = PX.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.floor(rnd() * w), y = y0 + Math.floor(rnd() * h);
      const r = rnd();
      if (r < 0.06) {
        PX.p(c, x, y, '#fff8e0');
        PX.p(c, x - 1, y, '#9aa4d8'); PX.p(c, x + 1, y, '#9aa4d8'); PX.p(c, x, y - 1, '#9aa4d8'); PX.p(c, x, y + 1, '#9aa4d8');
      } else PX.p(c, x, y, r < 0.4 ? '#dfe4ff' : r < 0.7 ? '#8a92c8' : '#5a6098');
    }
  }

  // ---------------------------------------------------------------- UI（ドットの窓）
  const UI = (SC.UI = {});
  // スーファミ風の青い窓
  UI.blue = function (c, x, y, w, h) {
    PX.rect(c, x + 1, y, w - 2, h, '#e8ecfa');
    PX.rect(c, x, y + 1, w, h - 2, '#e8ecfa');
    PX.rect(c, x + 1, y + 1, w - 2, h - 2, '#5a6488');
    PX.gradV(c, x + 2, y + 2, w - 4, h - 4, ['#4a5cc8', '#2e3c9c', '#1c2468', '#121848']);
    PX.hline(c, x + 2, x + w - 3, y + 2, '#7a8ae0');
  };
  // 羊皮紙と木の枠
  UI.parch = function (c, x, y, w, h) {
    PX.rect(c, x + 1, y, w - 2, h, C.wood[1]);
    PX.rect(c, x, y + 1, w, h - 2, C.wood[1]);
    PX.rect(c, x + 1, y + 1, w - 2, h - 2, C.wood[4]);
    PX.hline(c, x + 1, x + w - 2, y + 1, C.wood[5]);
    PX.rect(c, x + 3, y + 3, w - 6, h - 6, C.wood[1]);
    PX.gradV(c, x + 4, y + 4, w - 8, h - 8, ['#f2e4c0', '#e6d2a6', '#d4bc8a']);
    [[x, y], [x + w - 4, y], [x, y + h - 4], [x + w - 4, y + h - 4]].forEach(([cx, cy]) => {
      PX.rect(c, cx, cy, 4, 4, C.gold[2]);
      PX.p(c, cx + 1, cy + 1, C.gold[4]);
    });
  };
  // 黒と金の飾り枠
  UI.gothic = function (c, x, y, w, h) {
    PX.rect(c, x, y, w, h, '#0a080e');
    PX.rect(c, x + 1, y + 1, w - 2, h - 2, C.gold[2]);
    PX.rect(c, x + 2, y + 2, w - 4, h - 4, '#0a080e');
    PX.gradV(c, x + 3, y + 3, w - 6, h - 6, ['#24182a', '#18101e', '#100a14']);
    PX.hline(c, x + 2, x + w - 3, y + 1, C.gold[4]);
    [[x - 1, y - 1], [x + w - 4, y - 1], [x - 1, y + h - 4], [x + w - 4, y + h - 4]].forEach(([cx, cy]) => {
      PX.rect(c, cx, cy, 5, 5, '#0a080e');
      PX.rect(c, cx + 1, cy + 1, 3, 3, C.gold[3]);
      PX.p(c, cx + 2, cy + 2, C.gold[5]);
    });
  };

  // ---------------------------------------------------------------- 文字（拡大後の画面に描く）
  const TX = (SC.TX = {});
  TX.font = (px, fam = 'DotGothic16') => `${px}px "${fam}", "Hiragino Kaku Gothic ProN", monospace`;
  TX.draw = function (c, text, x, y, o = {}) {
    const size = (o.size || 8) * Z;
    c.font = o.font || TX.font(size, o.fam);
    c.textAlign = o.align || 'left';
    c.textBaseline = 'alphabetic';
    if (o.letter) c.letterSpacing = o.letter + 'px';
    const X = x * Z, Y = y * Z;
    if (o.outline) {
      c.lineJoin = 'round';
      c.lineWidth = o.outlineW || Z * 1.5;
      c.strokeStyle = o.outline;
      c.strokeText(text, X, Y);
    }
    if (o.shadow !== false) {
      c.fillStyle = o.shadowCol || 'rgba(8,6,20,0.85)';
      c.fillText(text, X + Z * 0.5, Y + Z * 0.5);
    }
    c.fillStyle = o.color || '#f4f2ff';
    c.fillText(text, X, Y);
    if (o.letter) c.letterSpacing = '0px';
  };

  // 1枚を組み立てる：art（光を当てる）→ ui → 拡大 → 文字
  SC.compose = function (drawArt, drawUI, drawText, opts = {}) {
    const art = PX.canvas(W, H);
    const em = [];
    const lights = [];
    drawArt(art.ctx, em, lights);
    if (opts.light) PX.light(art.ctx, W, H, lights, opts.light);
    em.forEach((f) => f());
    if (opts.glow) opts.glow(art.ctx, lights);
    const ui = PX.canvas(W, H);
    if (drawUI) drawUI(ui.ctx);
    const out = PX.canvas(W * Z, H * Z);
    out.ctx.imageSmoothingEnabled = false;
    out.ctx.drawImage(art.cv, 0, 0, W * Z, H * Z);
    out.ctx.drawImage(ui.cv, 0, 0, W * Z, H * Z);
    if (drawText) drawText(out.ctx);
    return out.cv;
  };

  // =================================================================== 2. 広場
  SC.plaza = function () {
    return SC.compose((c, em, L) => {
      // 地面
      cobbles(c, 0, 150, W, H - 150, 11, C.cob, { moss: true });
      // 奥の空（建物の上にわずかに）
      PX.gradV(c, 0, 0, W, 30, ['#0c1028', '#1a1e44', '#2a2a58']);
      stars(c, 0, 0, W, 26, 30, 3);
      // 両脇の家
      sideHouse(c, -6, 110, 40, em, L, 7);
      sideHouse(c, 206, 110, 40, em, L, 9, true);
      // ギルドの建物
      guildFacade(c, 26, 8, 188, em, L);
      // 階段
      for (let i = 0; i < 4; i++) {
        const y = 150 + i * 4, w = 54 + i * 6;
        PX.rect(c, 120 - w / 2, y, w, 4, C.stone[4]);
        PX.hline(c, 120 - w / 2, 120 + w / 2 - 1, y, C.stone[5]);
        PX.hline(c, 120 - w / 2, 120 + w / 2 - 1, y + 3, C.stone[2]);
      }
      // 階段から記念碑、手前へ続く大きな敷石の道
      flagstones(c, 92, 166, 56, 90, 61);
      flagstones(c, 98, 286, 44, 60, 62);
      // 水たまり（雨上がり）
      puddle(c, 60, 232, 14, 4, em, 70);
      puddle(c, 176, 318, 18, 4, em, 218);
      puddle(c, 150, 182, 10, 3, em, 170);
      // 広場の円形の石畳と記念碑
      const mx = 120, my = 262;
      PX.ellipse(c, mx, my, 44, 22, C.cob[1]);
      for (let k = 0; k < 3; k++) {
        const rr = 40 - k * 12;
        for (let a = 0; a < 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const px = mx + Math.cos(t) * rr, py = my + Math.sin(t) * rr * 0.5;
          PX.rect(c, px - 2, py - 1, 4, 2, a % 2 ? C.cob[3] : C.cob[4]);
          PX.p(c, px - 2, py - 1, C.cob[5]);
        }
      }
      monument(c, mx, my, em, L);
      // 街灯
      lanternPost(c, 70, 176, em, L);
      lanternPost(c, 170, 176, em, L);
      lanternPost(c, 22, 300, em, L);
      lanternPost(c, 218, 300, em, L);
      // 市場の屋台
      stall(c, 4, 214, em, L);
      // 樽と木箱
      barrel(c, 196, 214); barrel(c, 206, 216); crate(c, 214, 222); crate(c, 190, 226, 12, 9);
      // 植え込みと木
      bush(c, 58, 196, 22, 12, 4);
      bush(c, 162, 196, 22, 12, 5);
      tree(c, 10, 404, 16, 21);
      tree(c, 232, 398, 15, 22);
      bush(c, 30, 412, 26, 14, 8);
      bush(c, 186, 416, 30, 14, 9);
      // 人々
      em.push(() => person(c, 'rina', 112, 146, 'front'));
      person(c, 'warrior', 92, 186, 'front');
      person(c, 'mage', 104, 192, 'side', true);
      person(c, 'archer', 148, 214, 'front');
      person(c, 'cleric', 160, 216, 'side');
      person(c, 'hero', 120, 314, 'back');
      person(c, 'townA', 38, 252, 'front');
      person(c, 'townB', 54, 250, 'side');
      person(c, 'child', 82, 300, 'step');
      person(c, 'townC', 182, 288, 'side');
      person(c, 'thief', 204, 252, 'front');
      cat(c, 150, 330);
      // 入口わきの鉢植えと、外の掲示板
      pot(c, 92, 148); pot(c, 144, 148);
      noticeBoard(c, 40, 176);
      // 灯りのまわりを舞う光の粒
      const fr = PX.rng(5);
      for (let i = 0; i < 40; i++) {
        const lx = [70, 170, 22, 218, 120][i % 5], ly = [150, 150, 274, 274, 214][i % 5];
        const x = lx + (fr() - 0.5) * 30, y = ly + (fr() - 0.5) * 24;
        em.push(() => PX.p(c, x, y, fr() < 0.5 ? '#ffe8a0' : '#ffc060'));
      }
      // 地面にこぼれる扉の光
      L.push({ x: 120, y: 150, r: 70, i: 1.2 });
      L.push({ x: 120, y: 172, r: 54, i: 0.6 });
      L.push({ x: 120, y: 250, r: 40, i: 0.7 });
    }, (u) => {
      // 場所の名前
      UI.blue(u, 6, 6, 104, 26);
      // 時刻
      UI.blue(u, 178, 6, 56, 26);
      // 会話ウィンドウ
      UI.blue(u, 4, 336, 232, 84);
      // 顔グラ枠
      PX.rect(u, 11, 345, 44, 44, '#e8ecfa');
      PX.rect(u, 12, 346, 42, 42, '#121848');
      u.drawImage(SP.portrait('rina'), 13, 347);
      // 送りの三角
      PX.poly(u, [222, 408, 230, 408, 226, 413], '#e8ecfa');
    }, (t) => {
      TX.draw(t, '灯の街 リュミエ', 12, 17, { size: 9 });
      TX.draw(t, '冒険者ギルド前', 12, 28, { size: 6.5, color: '#b8c4ff' });
      TX.draw(t, '夜 20:43', 206, 17, { size: 8, align: 'center' });
      TX.draw(t, '1日目', 206, 28, { size: 6.5, align: 'center', color: '#b8c4ff' });
      TX.draw(t, '受付のリナ', 62, 352, { size: 7, color: '#ffe08a' });
      TX.draw(t, 'おかえりなさい、マスター。', 62, 366, { size: 8 });
      TX.draw(t, '今夜も依頼が三つ届いています。', 62, 379, { size: 8 });
      TX.draw(t, '…北の古城の件、少し気になりますね。', 62, 392, { size: 8 });
      // 看板の文字
      TX.draw(t, 'GUILD', 120, 74.5, { size: 5.5, align: 'center', fam: 'Cinzel', color: '#f8dc78', shadow: false, font: `700 ${5.5 * Z}px "Cinzel", serif` });
    }, {
      light: { ambient: 0.16, steps: 6 },
      glow: (c, lights) => {
        lights.filter((l) => l.r >= 40).forEach((l) => PX.glow(c, l.x, l.y, 12, '#ffb050', 0.55));
        vignette(c);
      },
    });
  };

  function vignette(c) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const d = dx * dx * 0.9 + dy * dy * 0.7;
      if (d < 0.55) continue;
      if (PX.BAYER[y & 3][x & 3] < (d - 0.55) * 0.9) { c.fillStyle = 'rgba(6,4,14,0.45)'; c.fillRect(x, y, 1, 1); }
    }
  }
  SC.vignette = vignette;

  function flagstones(c, x0, y0, w, h, seed) {
    const rnd = PX.rng(seed);
    PX.rect(c, x0, y0, w, h, C.stone[1]);
    for (let y = y0, j = 0; y < y0 + h; y += 7, j++) {
      for (let x = x0 - (j % 2) * 6; x < x0 + w; x += 12) {
        const a = Math.max(x0, x + 1), b = Math.min(x0 + w - 1, x + 11);
        if (b <= a) continue;
        const lv = 3 + Math.floor(rnd() * 2);
        PX.rect(c, a, y + 1, b - a + 1, 6, C.stone[lv]);
        PX.hline(c, a, b, y + 1, C.stone[lv + 1]);
        PX.hline(c, a, b, y + 6, C.stone[lv - 1]);
        if (rnd() < 0.2) PX.p(c, a + 2 + Math.floor(rnd() * 6), y + 3, C.stone[lv - 1]);
      }
    }
    // 縁石
    PX.vline(c, x0 - 1, y0, y0 + h - 1, C.stone[5]);
    PX.vline(c, x0 + w, y0, y0 + h - 1, C.stone[2]);
  }
  function puddle(c, x, y, rx, ry, em, lightX) {
    PX.ellipse(c, x, y, rx, ry, '#141a30');
    em.push(() => {
      PX.ellipse(c, x, y, rx - 1, ry - 1, '#1c2444');
      // 灯りの映り込み
      const off = Math.max(-rx + 3, Math.min(rx - 3, (lightX - x) * 0.3));
      for (let k = -ry + 1; k < ry; k++) PX.hline(c, x + off - 1 + (k % 2), x + off + (k % 2), y + k, k % 2 ? '#e8a050' : '#ffd070');
      PX.hline(c, x - rx + 3, x - rx + 6, y - ry + 1, '#3a4a7a');
    });
  }
  function pot(c, x, y) {
    PX.rect(c, x - 3, y - 5, 7, 5, '#8a4a2e');
    PX.hline(c, x - 4, x + 4, y - 6, '#a85e38');
    PX.hline(c, x - 3, x + 3, y - 1, '#5a2e1e');
    PX.ellipse(c, x, y - 9, 4, 3, C.leaf[3]);
    PX.p(c, x - 2, y - 11, '#e86a7a'); PX.p(c, x + 1, y - 10, '#f2e2a0'); PX.p(c, x + 2, y - 12, '#e86a7a');
  }
  function noticeBoard(c, x, y) {
    PX.rect(c, x - 1, y - 18, 2, 18, C.wood[2]);
    PX.rect(c, x + 19, y - 18, 2, 18, C.wood[2]);
    PX.rect(c, x - 2, y - 26, 24, 14, C.wood[1]);
    PX.rect(c, x - 1, y - 25, 22, 12, C.wood[4]);
    PX.poly(c, [x - 4, y - 26, x + 24, y - 26, x + 20, y - 30, x, y - 30], C.roof[3]);
    [[1, -23, 5, 6], [8, -24, 5, 7], [15, -23, 4, 5]].forEach(([dx, dy, w, hh]) => {
      PX.rect(c, x + dx, y + dy, w, hh, '#efe2c4');
      PX.hline(c, x + dx + 1, x + dx + w - 2, y + dy + 2, '#8a7050');
      PX.p(c, x + dx + 2, y + dy, '#c83a2e');
    });
  }

  function guildFacade(c, x, y, w, em, L) {
    const roofH = 64;
    // 屋根（見下ろし）
    shingles(c, x - 6, y, w + 12, roofH, C.roof, 31);
    // 屋根の両端の破風
    PX.rect(c, x - 6, y, w + 12, 2, C.roof[0]);
    PX.hline(c, x - 6, x + w + 5, y + roofH - 1, C.roof[5]);
    // 屋根窓
    [x + 30, x + w - 50].forEach((dx) => {
      PX.poly(c, [dx, y + 34, dx + 20, y + 34, dx + 10, y + 20], C.roof[0]);
      PX.poly(c, [dx + 1, y + 34, dx + 19, y + 34, dx + 10, y + 21], C.roof[2]);
      PX.rect(c, dx + 3, y + 34, 14, 14, C.plaster[3]);
      windowFrame(c, dx + 6, y + 36, 8, 9, em);
    });
    // 煙突
    PX.rect(c, x + w - 30, y - 8, 12, 24, C.red[1]);
    bricks(c, x + w - 29, y - 7, 10, 22, C.red, 5, 5, 3);
    PX.rect(c, x + w - 31, y - 10, 14, 3, C.stone[3]);
    // 軒下の影
    PX.rect(c, x - 6, y + roofH, w + 12, 3, '#0e0a10');
    const fy = y + roofH + 3, fh = 150 - fy;
    // 壁：漆喰と木組み
    PX.rect(c, x, fy, w, fh, C.plaster[3]);
    PX.dither(c, x, fy, w, fh, C.plaster[3], C.plaster[2], (i, j) => (j / fh) * 0.6);
    // 石の腰壁
    bricks(c, x, fy + fh - 22, w, 22, C.stone, 13, 10, 5);
    // 木組み
    const beam = C.wood[1], beamL = C.wood[3];
    PX.rect(c, x, fy, w, 3, beam);
    PX.rect(c, x, fy + 30, w, 3, beam);
    PX.hline(c, x, x + w - 1, fy + 30, beamL);
    for (let bx = x; bx <= x + w; bx += 24) {
      PX.rect(c, bx, fy, 3, fh - 22, beam);
      PX.vline(c, bx, fy, fy + fh - 23, beamL);
    }
    for (let bx = x; bx < x + w - 10; bx += 48) {
      PX.line(c, bx + 3, fy + 3, bx + 24, fy + 29, beam);
      PX.line(c, bx + 4, fy + 3, bx + 25, fy + 29, beam);
      PX.line(c, bx + 48, fy + 3, bx + 27, fy + 29, beam);
      PX.line(c, bx + 47, fy + 3, bx + 26, fy + 29, beam);
    }
    // 窓
    [x + 8, x + 32, x + w - 46, x + w - 22].forEach((wx, i) => {
      windowFrame(c, wx + 2, fy + 8, 10, 16, em, { curtain: i % 2 === 0 });
      windowFrame(c, wx + 2, fy + 38, 10, 14, em, { box: true, silhouette: i === 1 });
      L.push({ x: wx + 7, y: fy + 46, r: 30, i: 0.55 });
      L.push({ x: wx + 7, y: fy + 16, r: 22, i: 0.35 });
    });
    // 入口
    const dx = x + w / 2 - 14, dy = fy + 20;
    PX.rect(c, dx - 4, dy - 4, 36, 4, C.stone[4]);
    PX.poly(c, [dx - 4, dy - 4, dx + 32, dy - 4, dx + 28, dy - 10, dx, dy - 10], C.stone[3]);
    PX.rect(c, dx - 3, dy, 34, fh - 20, C.stone[1]);
    PX.rect(c, dx, dy, 28, fh - 20, '#1a1016');
    em.push(() => {
      PX.gradV(c, dx + 2, dy + 2, 24, fh - 22, ['#ffd27a', '#f8a848', '#c86a2a']);
      // 中の人影と掲示板
      PX.rect(c, dx + 4, dy + 6, 8, 6, '#a8703e');
      PX.rect(c, dx + 5, dy + 7, 2, 2, '#f2e4c0'); PX.rect(c, dx + 8, dy + 7, 3, 3, '#f2e4c0');
      PX.rect(c, dx + 18, dy + 10, 4, 9, '#7a3a20');
      PX.rect(c, dx + 18, dy + 8, 4, 3, '#5a2a18');
    });
    // 開いた扉
    PX.rect(c, dx - 2, dy + 1, 3, fh - 21, C.wood[3]);
    PX.rect(c, dx + 27, dy + 1, 3, fh - 21, C.wood[3]);
    // 看板
    PX.rect(c, x + w / 2 - 17, fy + 2, 34, 9, C.wood[1]);
    PX.rect(c, x + w / 2 - 16, fy + 3, 32, 7, C.wood[3]);
    PX.hline(c, x + w / 2 - 16, x + w / 2 + 15, fy + 3, C.wood[4]);
    // 旗
    bannerHang(c, x + 54, fy + 4, 12, 22);
    bannerHang(c, x + w - 66, fy + 4, 12, 22);
    // 入口の左右のランタン
    [dx - 8, dx + 36].forEach((lx) => {
      PX.rect(c, lx - 1, dy + 4, 3, 6, '#1e1a22');
      em.push(() => { PX.rect(c, lx, dy + 5, 1, 4, '#ffd46a'); });
      L.push({ x: lx, y: dy + 7, r: 34, i: 0.8 });
    });
    L.push({ x: x + w / 2, y: dy + 20, r: 64, i: 0.9 });
  }

  function sideHouse(c, x, y, w, em, L, seed, right) {
    shingles(c, x, y - 40, w, 26, C.red, seed);
    PX.rect(c, x, y - 14, w, 2, '#0e0a10');
    PX.rect(c, x, y - 12, w, 72, C.plaster[2]);
    PX.rect(c, x, y - 12, w, 2, C.wood[1]);
    PX.rect(c, right ? x : x + w - 3, y - 12, 3, 72, C.wood[1]);
    bricks(c, x, y + 44, w, 16, C.stone, seed, 8, 4);
    windowFrame(c, x + (right ? 14 : 12), y - 4, 10, 14, em, { box: true });
    L.push({ x: x + 18, y: y + 4, r: 28, i: 0.5 });
    windowFrame(c, x + (right ? 14 : 12), y + 22, 10, 14, em, { curtain: true });
    L.push({ x: x + 18, y: y + 30, r: 26, i: 0.4 });
  }

  function monument(c, x, y, em, L) {
    // 台座
    PX.ellipse(c, x, y + 2, 14, 6, C.stone[1]);
    PX.rect(c, x - 10, y - 10, 20, 12, C.stone[3]);
    PX.hline(c, x - 10, x + 9, y - 10, C.stone[5]);
    PX.rect(c, x - 10, y - 1, 20, 3, C.stone[2]);
    PX.rect(c, x - 6, y - 30, 12, 20, C.stone[4]);
    PX.vline(c, x - 6, y - 30, y - 11, C.stone[5]);
    PX.vline(c, x + 5, y - 30, y - 11, C.stone[2]);
    PX.rect(c, x - 8, y - 32, 16, 3, C.stone[5]);
    // 大きなランタン
    PX.rect(c, x - 6, y - 48, 12, 16, '#1e1a22');
    PX.rect(c, x - 8, y - 50, 16, 3, '#2a2430');
    PX.poly(c, [x - 7, y - 50, x + 7, y - 50, x, y - 58], '#2a2430');
    PX.p(c, x, y - 60, C.gold[3]);
    em.push(() => {
      PX.gradV(c, x - 4, y - 46, 8, 12, ['#fff6d0', '#ffd46a', '#f8a040']);
      PX.vline(c, x, y - 46, y - 35, '#1e1a22');
    });
    L.push({ x, y: y - 40, r: 70, i: 1.1 });
    // 銘板
    PX.rect(c, x - 4, y - 22, 8, 5, C.gold[2]);
    PX.hline(c, x - 3, x + 2, y - 21, C.gold[4]);
  }

  function stall(c, x, y, em, L) {
    // 屋台の台
    PX.rect(c, x, y - 12, 44, 12, C.wood[3]);
    PX.hline(c, x, x + 43, y - 12, C.wood[5]);
    planksV(c, x, y - 10, 44, 10, C.wood, 3, 5);
    // 品物
    for (let i = 0; i < 6; i++) {
      const col = ['#d84a3a', '#e8b040', '#6aa04a', '#d84a3a', '#e8c070', '#9a5ac8'][i];
      PX.ellipse(c, x + 5 + i * 7, y - 14, 2, 1, col);
      PX.p(c, x + 4 + i * 7, y - 15, '#fff4d0');
    }
    // 柱と縞の日よけ
    PX.rect(c, x + 1, y - 34, 2, 22, C.wood[2]);
    PX.rect(c, x + 41, y - 34, 2, 22, C.wood[2]);
    for (let i = 0; i < 48; i++) {
      const col = Math.floor(i / 6) % 2 ? '#e8dcc0' : C.red[3];
      PX.vline(c, x - 2 + i, y - 40, y - 33 + (i % 6 === 2 || i % 6 === 3 ? 1 : 0), col);
    }
    PX.hline(c, x - 2, x + 45, y - 40, C.red[1]);
    // 吊りランタン
    PX.vline(c, x + 22, y - 32, y - 29, '#1e1a22');
    PX.rect(c, x + 20, y - 29, 5, 5, '#1e1a22');
    em.push(() => PX.rect(c, x + 21, y - 28, 3, 3, '#ffd46a'));
    L.push({ x: x + 22, y: y - 26, r: 40, i: 0.85 });
  }

  function cat(c, x, y) {
    const k = '#1a1418', b = '#3a3038';
    PX.rect(c, x, y - 4, 7, 4, k);
    PX.rect(c, x + 1, y - 3, 5, 2, b);
    PX.rect(c, x + 5, y - 7, 4, 4, k);
    PX.rect(c, x + 6, y - 6, 2, 2, b);
    PX.p(c, x + 5, y - 8, k); PX.p(c, x + 8, y - 8, k);
    PX.p(c, x + 6, y - 6, '#f0d050'); PX.p(c, x + 8, y - 6, '#f0d050');
    PX.line(c, x, y - 3, x - 3, y - 7, k);
    PX.rect(c, x - 1, y, 9, 1, 'rgba(10,6,12,0.4)');
  }

  SC.helpers = { cobbles, bricks, planksV, planksH, shingles, windowFrame, lanternPost, barrel, crate, tree, bush, person, bannerHang, stars, monument, stall, cat, sideHouse };
})();
