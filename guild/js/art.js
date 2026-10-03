/* ギルドの灯 — art: ポリゴン調の描画（人物・魔物・アイコン・吹き出し）
 * すべて Canvas2D のベクター描画。光源は左上で固定し、面ごとに明暗を付ける。
 */
'use strict';
(function () {
  const art = (G.art = {});
  const TAU = Math.PI * 2;
  let FL = 0; // ヒット時の白フラッシュ量
  art.setFlash = (v) => (FL = v);
  const C = (hex, amt) => {
    let c = amt ? G.shade(hex, G.clamp(amt, -0.95, 0.95)) : hex;
    return FL > 0 ? G.mix(c, '#ffffff', FL) : c;
  };
  art.C = C;

  // ---------- primitives ----------
  function poly(ctx, p, fill) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  art.poly = poly;

  // 多角形をファセット（面）で塗る：中心から扇状に三角形を作り、面の向きで明暗
  function facet(ctx, cx, cy, rx, ry, n, color, rot = 0, str = 0.16, light = -2.4) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    poly(ctx, pts, C(color));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mid = rot + ((i + 0.5) / n) * TAU;
      const l = Math.cos(mid - light);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = C(color, l * str);
      ctx.fill();
    }
  }
  art.facet = facet;

  // 任意多角形を中心からファセット
  function facetPoly(ctx, p, color, str = 0.14, light = -2.4) {
    poly(ctx, p, C(color));
    let cx = 0, cy = 0;
    const n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cy += p[i + 1]; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mx = (p[i * 2] + p[j * 2]) / 2 - cx, my = (p[i * 2 + 1] + p[j * 2 + 1]) / 2 - cy;
      const l = Math.cos(Math.atan2(my, mx) - light);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p[i * 2], p[i * 2 + 1]);
      ctx.lineTo(p[j * 2], p[j * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = C(color, l * str);
      ctx.fill();
    }
  }
  art.facetPoly = facetPoly;

  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  art.ellipse = ellipse;

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  art.rrect = rrect;

  // 手足：肩/腰を軸に回転する四角形
  function limb(ctx, x, y, len, w, ang, color, endColor, endLen, endW) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    poly(ctx, [-w / 2, 0, w / 2, 0, w / 2 * 0.9, len, -w / 2 * 0.9, len], color);
    if (endColor) poly(ctx, [-endW / 2, len - endLen, endW / 2 + 1.2, len - endLen + 0.6, endW / 2 + 1.4, len + 0.6, -endW / 2, len + 0.6], endColor);
    ctx.restore();
    return [x - Math.sin(ang) * len, y + Math.cos(ang) * len];
  }

  // ---------- look generation ----------
  art.randomLook = (cls, seed) => ({
    cls,
    seed: seed || Math.random() * 1000,
    skin: G.pick(G.D.SKINS),
    hair: G.pick(G.D.HAIRS),
    style: G.pick(G.D.HAIR_STYLES),
    outfit: G.shade(G.D.CLASSES[cls].color, G.rand(-0.12, 0.08)),
    pants: G.pick(['#4b3a2e', '#3d3f52', '#5a4632', '#384a3c', '#55433f']),
    blush: Math.random() < 0.6,
  });

  // ---------- 髪 ----------
  const HAIR_CAP = [-6.6, -24.5, -7.0, -29, -5.2, -33, -1.5, -34.9, 2.5, -34.6, 5.6, -32.2, 6.8, -28.8, 5.0, -30.4, 3.6, -29.2, 2.2, -30.6, 0.4, -29.6, -1.8, -30.2, -3.6, -28.0, -4.2, -24.0];
  const HAIR_HI = [-5, -32.5, -1.5, -34.4, 1, -34.2, -2, -32.6, -4.4, -30.8];
  function hairBack(ctx, L, t, sway) {
    const h = L.hair;
    if (L.style === 'long') poly(ctx, [-6.6, -29, -7.6, -19.5, -4.8, -18.6, -3.4, -26], C(h, -0.12));
    if (L.style === 'bob') poly(ctx, [-6.9, -28, -7.3, -22.8, -4.4, -22.4, -4.0, -26], C(h, -0.1));
    if (L.style === 'pony') {
      const s = Math.sin(t * 3 + L.seed) * 0.9 + sway;
      poly(ctx, [-6.2, -31.8, -10.8 + s, -28, -10.2 + s * 1.4, -21.5, -7.2, -27.5], C(h, -0.1));
    }
    if (L.style === 'bun') facet(ctx, -6.2, -32.8, 3.1, 3.1, 6, C(h, -0.05), 0.3, 0.2);
  }
  function hairFront(ctx, L) {
    if (L.style === 'bald') {
      poly(ctx, [-6.6, -24.5, -7.0, -28.5, -5.5, -29.5, -4.4, -24.5], C(L.hair));
      return;
    }
    const h = L.hair;
    poly(ctx, HAIR_CAP, C(h));
    poly(ctx, HAIR_HI, C(h, 0.16));
    if (L.style === 'spiky') {
      poly(ctx, [-5, -32, -7.2, -37, -2.5, -34], C(h, 0.05));
      poly(ctx, [-2, -34.5, -1.2, -39.8, 1.5, -34.8], C(h, 0.1));
      poly(ctx, [1.5, -34.6, 4.6, -38.6, 4.8, -33], C(h, -0.04));
    }
    if (L.style === 'bob') poly(ctx, [5.8, -30, 6.6, -25, 5.2, -24.4, 4.6, -29], C(h, -0.06));
  }

  // ---------- 帽子・兜 ----------
  function headwear(ctx, L, t, sway) {
    const cls = L.role ? null : L.cls;
    if (L.hood) {
      poly(ctx, [-7.4, -22.5, -7.8, -29, -5.6, -34.4, -1, -36.4, 3.6, -35.6, 6.8, -32.6, 7.3, -28.4, 5.6, -30.4, 3.8, -31.2, 1, -31.4, -2.6, -30.6, -4, -27, -4.4, -21.5], C(L.hood));
      poly(ctx, [-5.6, -34.4, -1, -36.4, 3.6, -35.6, 1, -34.4, -3.4, -33], C(L.hood, 0.14));
      return;
    }
    if (cls === 'warrior') {
      const s = '#a3acb6';
      poly(ctx, [-6.9, -27.5, -6.6, -31.5, -4.4, -34.6, 0, -35.9, 4.4, -34.6, 6.6, -31.5, 6.9, -27.5], C(s));
      poly(ctx, [-6.6, -31.5, -4.4, -34.6, 0, -35.9, -0.6, -31, -6.9, -27.5], C(s, 0.18));
      poly(ctx, [0, -35.9, 4.4, -34.6, 6.6, -31.5, 6.9, -27.5, 1.6, -29.4], C(s, -0.12));
      poly(ctx, [-7.1, -27.2, 7.1, -27.2, 7.0, -28.8, -7.0, -28.8], C(s, -0.28));
      poly(ctx, [4.4, -28.4, 5.8, -28.4, 5.6, -24.6, 4.6, -24.6], C(s, -0.2));
      if (L.crest) poly(ctx, [-1.5, -35.6, 1.4, -36.2, -2, -40.5 + Math.sin(t * 4) * 0.4, -6.5, -38], C(L.crest));
    } else if (cls === 'mage') {
      const c = L.outfit;
      const tip = -3.2 + sway * 2.4 + Math.sin(t * 1.7 + L.seed) * 0.8;
      poly(ctx, [-5.9, -31.6, 5.7, -31.6, tip, -46], C(c));
      poly(ctx, [-5.9, -31.6, -0.4, -31.6, tip, -46], C(c, 0.12));
      poly(ctx, [-9.4, -30.3, 9.8, -30.3, 7.2, -32.4, -6.8, -32.4], C(c, -0.18));
      poly(ctx, [-5.7, -32.2, 5.5, -32.2, 5.0, -34.0, -5.2, -34.0], C('#f0c94a'));
      star(ctx, 0.5 + tip * 0.35, -38.5, 1.5, C('#ffe680'));
    } else if (cls === 'thief') {
      const c = G.shade(L.outfit, -0.2);
      poly(ctx, [-7.4, -22.5, -7.8, -29, -5.6, -34.4, -1, -36.4, 3.6, -35.6, 6.8, -32.6, 7.3, -28.4, 5.6, -30.4, 3.8, -31.2, 1, -31.4, -2.6, -30.6, -4, -27, -4.4, -21.5], C(c));
      poly(ctx, [-5.6, -34.4, -1, -36.4, 3.6, -35.6, 1, -34.4, -3.4, -33], C(c, 0.14));
    } else if (cls === 'cleric') {
      const c = '#f4efe2';
      poly(ctx, [-7.4, -22.5, -7.8, -29, -5.6, -34.4, -1, -36.4, 3.6, -35.6, 6.8, -32.6, 7.3, -28.4, 5.6, -30.4, 3.8, -31.2, 1, -31.4, -2.6, -30.6, -4, -27, -4.4, -21.5], C(c));
      poly(ctx, [6.8, -32.6, 7.3, -28.4, 5.6, -30.4, 3.8, -31.2, 1, -31.4, 1.2, -32.6, 4, -32.8], C('#e2b84a'));
      poly(ctx, [-5.6, -34.4, -1, -36.4, 3.6, -35.6, 1, -34.4, -3.4, -33], C(c, 0.1));
    } else if (cls === 'archer') {
      const c = '#4f8a46';
      poly(ctx, [-6.9, -29, -5.4, -33.8, 0, -35.6, 5.4, -33.4, 8.2, -30.4, 2, -31.2], C(c));
      poly(ctx, [-5.4, -33.8, 0, -35.6, 2.6, -34.8, -3.6, -32.6], C(c, 0.15));
      const f = Math.sin(t * 2.4 + L.seed) * 0.6 + sway;
      poly(ctx, [-2.6, -34.6, -11 + f, -40.5, -12 + f, -38.4, -3, -33.2], C('#d4493a'));
      poly(ctx, [-2.6, -34.6, -11 + f, -40.5, -6, -36.4], C('#e86a52'));
    }
  }

  function star(ctx, x, y, r, fill) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      p.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    poly(ctx, p, fill);
  }
  art.star = star;

  // ---------- 顔 ----------
  function face(ctx, L, P) {
    const ink = '#2b1d17';
    const ex = [1.3, 4.3];
    const ey = -27.2;
    const expr = P.expr;
    if (expr === 'sleep') {
      ctx.strokeStyle = C(ink);
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';
      ex.forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 0.9, ey); ctx.quadraticCurveTo(x, ey + 0.8, x + 0.9, ey); ctx.stroke(); });
    } else if (expr === 'happy') {
      ctx.strokeStyle = C(ink);
      ctx.lineWidth = 0.75;
      ctx.lineCap = 'round';
      ex.forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 0.95, ey + 0.4); ctx.lineTo(x, ey - 0.7); ctx.lineTo(x + 0.95, ey + 0.4); ctx.stroke(); });
    } else if (expr === 'hurt') {
      ctx.strokeStyle = C(ink);
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';
      [[ex[0], 1], [ex[1], -1]].forEach(([x, d]) => {
        ctx.beginPath(); ctx.moveTo(x - 0.9 * d, ey - 0.9); ctx.lineTo(x + 0.9 * d, ey); ctx.lineTo(x - 0.9 * d, ey + 0.9); ctx.stroke();
      });
    } else {
      const h = P.blink ? 0.35 : 1.95;
      ex.forEach((x) => {
        ctx.fillStyle = C(ink);
        ctx.fillRect(x - 0.6, ey - h / 2, 1.2, h);
        if (!P.blink) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 0.1, ey - 0.75, 0.45, 0.45); }
      });
    }
    if (L.blush && expr !== 'hurt') {
      ctx.fillStyle = 'rgba(240,110,110,0.28)';
      ctx.beginPath(); ctx.ellipse(5.3, -25.1, 1.2, 0.7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-0.1, -25.1, 1.1, 0.7, 0, 0, TAU); ctx.fill();
    }
    // 口
    ctx.fillStyle = C('#7a3b2e');
    if (P.talk) {
      const o = 0.5 + Math.abs(Math.sin(P.t * 14)) * 0.9;
      ctx.beginPath(); ctx.ellipse(3.3, -24.1, 0.9, o * 0.6, 0, 0, TAU); ctx.fill();
    } else if (expr === 'happy' || expr === 'cheer') {
      ctx.beginPath(); ctx.moveTo(2.2, -24.6); ctx.quadraticCurveTo(3.3, -23, 4.4, -24.6); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(2.7, -24.3, 1.3, 0.5);
    }
    if (L.mustache) poly(ctx, [1.2, -25, 3.3, -25.6, 5.6, -25, 6.3, -23.8, 3.3, -24.4, 0.6, -23.8], C(L.hair, -0.1));
    if (L.beard) {
      poly(ctx, [-1.5, -26, 6.6, -26.2, 6.4, -22, 3.5, -17.5, 0, -19, -2, -22.5], C(L.hair));
      poly(ctx, [1.2, -25.4, 3.3, -26, 5.6, -25.4, 5.8, -24.2, 3.3, -24.8, 1, -24.2], C(L.hair, -0.15));
      poly(ctx, [3.5, -22, 6.4, -22, 3.5, -17.5], C(L.hair, -0.1));
    }
  }

  // ---------- 武器 ----------
  function sword(ctx, x, y, ang, len = 13) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    poly(ctx, [-0.9, 0, 0.9, 0, 0.9, 3.4, -0.9, 3.4], C('#6b4426'));
    poly(ctx, [-3, -0.4, 3, -0.4, 3, 0.8, -3, 0.8], C('#e2b84a'));
    poly(ctx, [-1.3, -0.4, 1.3, -0.4, 1.1, -len, 0, -len - 2.2, -1.1, -len], C('#dfe5ea'));
    poly(ctx, [0, -0.4, 1.3, -0.4, 1.1, -len, 0, -len - 2.2], C('#b9c2ca'));
    ctx.restore();
  }
  art.sword = sword;
  function staff(ctx, x, y, color, orb, t, ring) {
    poly(ctx, [x - 0.7, y + 8, x + 0.7, y + 8, x + 0.7, y - 15, x - 0.7, y - 15], C('#7a5230'));
    poly(ctx, [x - 0.7, y + 8, x, y + 8, x, y - 15, x - 0.7, y - 15], C('#94683e'));
    if (ring) {
      ctx.strokeStyle = C('#e8bd4c');
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(x, y - 18, 3, 0, TAU); ctx.stroke();
      facet(ctx, x, y - 18, 1.2, 1.2, 6, '#fff3c0', t, 0.2);
    } else {
      const p = 0.8 + Math.sin(t * 3) * 0.2;
      ctx.fillStyle = G.rgba(orb, 0.25 * p);
      ctx.beginPath(); ctx.arc(x, y - 17, 5.5 * p, 0, TAU); ctx.fill();
      facet(ctx, x, y - 17, 2.6, 2.6, 6, orb, t * 0.8, 0.28);
    }
  }
  function bow(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = C('#8a5a2e');
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 8, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,235,220,0.8)';
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(Math.cos(-1.2) * 8, Math.sin(-1.2) * 8); ctx.lineTo(Math.cos(1.2) * 8, Math.sin(1.2) * 8); ctx.stroke();
    ctx.restore();
  }
  function mug(ctx, x, y) {
    poly(ctx, [x - 1.8, y - 3.5, x + 1.8, y - 3.5, x + 1.6, y + 1.2, x - 1.6, y + 1.2], C('#b07a44'));
    poly(ctx, [x - 1.8, y - 3.5, x + 1.8, y - 3.5, x + 1.8, y - 4.6, x - 1.8, y - 4.6], C('#fff6dc'));
    ctx.strokeStyle = C('#8a5a2e');
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(x + 2.2, y - 1.2, 1.2, -1.4, 1.4); ctx.stroke();
  }
  art.mug = mug;
  function hammer(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    poly(ctx, [-0.6, 1, 0.6, 1, 0.6, -8, -0.6, -8], C('#7a5230'));
    poly(ctx, [-3, -8, 3, -8, 3, -11.4, -3, -11.4], C('#6c727a'));
    poly(ctx, [-3, -8, 0, -8, 0, -11.4, -3, -11.4], C('#8a9099'));
    ctx.restore();
  }

  // ---------- 人物 ----------
  // L: 見た目, P: ポーズ { t, state, phase, facing, blink, talk, expr, swing, armed }
  art.person = function (ctx, L, P) {
    const f = P.facing || 1;
    const t = P.t;
    const st = P.state || 'stand';
    const sc = L.height || 1;
    ctx.save();
    // 影
    if (st !== 'sleep' && !P.noShadow) ellipse(ctx, 0, 0, 7.5 * (L.wide || 1), 1.9, 'rgba(25,15,8,0.2)');
    let bob = 0;
    let lean = 0;
    let sway = 0;
    if (st === 'walk' || st === 'run') {
      bob = -Math.abs(Math.sin(P.phase)) * (st === 'run' ? 1.8 : 1.1);
      lean = st === 'run' ? 0.12 : 0.03;
      sway = -Math.sin(P.phase) * 0.8;
    } else if (st === 'cheer') bob = -Math.abs(Math.sin(t * 9)) * 3.2;
    else if (st === 'hurt') lean = -0.25;
    else if (st === 'lunge') lean = 0.22;
    else if (st !== 'sit' && st !== 'drink') bob = Math.sin(t * 2.2 + (L.seed || 0)) * 0.35;
    ctx.scale(f, 1);
    ctx.translate(0, bob);
    if (sc !== 1 || L.wide) ctx.scale(L.wide || 1, sc);
    ctx.rotate(lean);
    const sit = st === 'sit' || st === 'drink';
    const hipY = sit ? -7 : -11;
    const lg = (k) => C(L.pants || '#4b3a2e', k);
    const boot = C('#3a2a20');

    // 背中の武器
    const armed = P.armed;
    if (!armed && !L.role) {
      if (L.cls === 'warrior') sword(ctx, -3.4, -13 + (sit ? 4 : 0), 0.55, 12);
      if (L.cls === 'archer') {
        bow(ctx, -3.8, -16 + (sit ? 4 : 0), 0.5);
        poly(ctx, [-5.6, -21, -3.2, -21.6, -2.6, -12, -5, -11.4], C('#7a4f2a'));
        poly(ctx, [-5.6, -21, -3.2, -21.6, -3.6, -23.6, -6, -23], C('#e8e0c8'));
      }
    }
    // 脚
    let a = 0;
    if (st === 'walk' || st === 'run') a = Math.sin(P.phase) * (st === 'run' ? 0.8 : 0.55);
    if (sit) {
      // 座り: 太ももを前へ、すねを下へ
      [[-1, -0.15], [1, 0]].forEach(([dx, k]) => {
        ctx.save();
        ctx.translate(dx * 1.4, hipY);
        poly(ctx, [-1.7, -1.6, 6.5, -1.6, 6.5, 1.8, -1.7, 1.8], lg(k));
        poly(ctx, [4.8, 0, 8.0, 0, 7.6, 6.6, 5.0, 6.6], lg(k - 0.05));
        poly(ctx, [4.6, 5.2, 9.2, 5.6, 9.4, 7.2, 4.6, 7.2], boot);
        ctx.restore();
      });
    } else if (st === 'cheer') {
      limb(ctx, -1.5, hipY, 11, 3.4, 0.18, lg(-0.15), boot, 2.4, 3.6);
      limb(ctx, 1.5, hipY, 11, 3.4, -0.18, lg(0), boot, 2.4, 3.6);
    } else {
      limb(ctx, -0.8, hipY, 11, 3.4, -a, lg(-0.16), boot, 2.4, 3.6);
      limb(ctx, 0.8, hipY, 11, 3.4, a, lg(0), boot, 2.4, 3.6);
    }
    // 後ろの腕
    const torsoTop = sit ? -17 : -21;
    const sh = torsoTop + 1;
    let backA = -a * 0.9;
    let frontA = a * 0.9;
    if (st === 'cheer') { backA = -2.7 + Math.sin(t * 9) * 0.2; frontA = 2.7 - Math.sin(t * 9) * 0.2; frontA = -2.6; backA = 2.6; }
    if (st === 'stand' || st === 'idle') { backA = 0.08 + Math.sin(t * 2.2) * 0.03; frontA = -0.08 - Math.sin(t * 2.2) * 0.03; }
    if (st === 'hurt') { backA = -1.2; frontA = -1.6; }
    if (st === 'swing' || st === 'lunge' || st === 'hammer') {
      const s = P.swing || 0;
      frontA = G.lerp(-2.7, -0.7, G.ease.outCubic(s));
      backA = 0.4;
    }
    if (st === 'cast') { frontA = -1.5 - Math.sin(t * 10) * 0.08; backA = -1.2; }
    if (st === 'drink') {
      const d = (Math.sin(t * 0.9 + (L.seed || 0)) + 1) / 2;
      frontA = G.lerp(-0.6, -2.35, Math.pow(d, 3));
      backA = -0.5;
    }
    if (st === 'sit') { frontA = -0.6; backA = -0.5; }
    if (st === 'write') { frontA = -1.1 + Math.sin(t * 7) * 0.12; backA = -0.9; }
    const skin = L.skin;
    const sleeve = L.role === 'bartender' ? '#f1e9d8' : L.outfit;
    limb(ctx, -1.2, sh, 9.2, 2.9, backA, C(sleeve, -0.18), C(skin, -0.12), 1.9, 2.8);

    // 胴
    const lightL = 0.08 * f, lightR = -0.08 * f;
    const robe = L.robe || L.cls === 'mage' || L.cls === 'cleric';
    const body = L.cls === 'cleric' && !L.role ? '#f2ede0' : L.outfit;
    if (robe && !sit) {
      poly(ctx, [-4.4, hipY - 0.5, 4.4, hipY - 0.5, 5.8, -1.6, -5.8, -1.6], C(body, -0.06));
      poly(ctx, [-4.4, hipY - 0.5, 0, hipY - 0.5, 0, -1.6, -5.8, -1.6], C(body, lightL - 0.02));
      if (L.cls === 'cleric') poly(ctx, [-0.8, hipY, 0.8, hipY, 1, -1.6, -1, -1.6], C('#e2b84a'));
    }
    poly(ctx, [-4.2, hipY + 0.5, 0, hipY + 0.5, 0, torsoTop, -4.6, torsoTop + 0.3], C(body, lightL));
    poly(ctx, [0, hipY + 0.5, 4.2, hipY + 0.5, 4.8, torsoTop + 0.3, 0, torsoTop], C(body, lightR));
    if (L.apron) poly(ctx, [-1, hipY + 4, 4.6, hipY + 4, 4.6, torsoTop + 3, 0.2, torsoTop + 3], C(L.apron));
    if (L.vest) {
      poly(ctx, [-4.2, hipY + 0.5, -1.4, hipY + 0.5, -1.2, torsoTop + 0.3, -4.6, torsoTop + 0.3], C(L.vest));
      poly(ctx, [1.6, hipY + 0.5, 4.2, hipY + 0.5, 4.8, torsoTop + 0.3, 1.8, torsoTop + 0.3], C(L.vest, -0.08));
    }
    // ベルト
    poly(ctx, [-4.3, hipY - 0.6, 4.3, hipY - 0.6, 4.3, hipY + 1, -4.3, hipY + 1], C('#4a3326'));
    poly(ctx, [1.2, hipY - 0.6, 2.8, hipY - 0.6, 2.8, hipY + 1, 1.2, hipY + 1], C('#e2b84a'));
    if (L.cls === 'thief' && !L.role) {
      // マフラー
      const fl = Math.sin(t * 5 + (L.seed || 0)) * 0.8 + sway * 1.6;
      poly(ctx, [-4.6, torsoTop + 1.2, 4.8, torsoTop + 1.2, 4.6, torsoTop - 1.2, -4.6, torsoTop - 1.2], C('#c4553a'));
      poly(ctx, [-4.4, torsoTop - 0.6, -9 + fl, torsoTop + 2.8, -8.6 + fl, torsoTop + 4.6, -3.6, torsoTop + 1.4], C('#c4553a', -0.1));
      sword(ctx, 3.6, hipY + 0.5, 2.5, 5);
    }
    if (L.cls === 'warrior' && !L.role) {
      // 肩当て
      facet(ctx, -0.6, torsoTop + 1, 3.4, 2.4, 6, '#a3acb6', 0, 0.2);
    }
    // 首と頭
    poly(ctx, [-1.3, torsoTop + 0.5, 1.6, torsoTop + 0.5, 1.6, torsoTop - 1.6, -1.3, torsoTop - 1.6], C(skin, -0.1));
    ctx.save();
    ctx.translate(0, torsoTop + 21);
    hairBack(ctx, L, t, sway);
    facet(ctx, 0, -27.6, 6.4, 6.3, 8, skin, 0.4, 0.1);
    face(ctx, L, P);
    if (!(L.cls === 'thief' || L.cls === 'cleric' || L.hood) || L.role) hairFront(ctx, L);
    if (L.cls === 'mage' && !L.role) { /* 魔法使いは帽子の下に髪 */ }
    headwear(ctx, L, t, sway);
    ctx.restore();

    // 前の腕と持ち物
    const hand = limb(ctx, 1.2, sh, 9.2, 3, frontA, C(sleeve, 0.02), C(skin), 1.9, 2.9);
    if (armed && L.cls === 'warrior') sword(ctx, hand[0], hand[1], frontA + Math.PI * 0.95, 13);
    else if (armed && L.cls === 'thief') sword(ctx, hand[0], hand[1], frontA + Math.PI * 0.9, 6);
    else if (armed && L.cls === 'archer') bow(ctx, hand[0] + 1, hand[1], 0);
    if (L.cls === 'mage' && !L.role) staff(ctx, hand[0] + 0.6, hand[1], L.outfit, '#9fd8ff', t);
    if (L.cls === 'cleric' && !L.role) staff(ctx, hand[0] + 0.6, hand[1], '#fff', null, t, true);
    if (P.item === 'mug') mug(ctx, hand[0] + 1, hand[1] - 0.5);
    if (P.item === 'hammer') hammer(ctx, hand[0], hand[1], frontA + Math.PI);
    if (P.item === 'flask') {
      poly(ctx, [hand[0] - 1.2, hand[1] - 1, hand[0] + 1.6, hand[1] - 1, hand[0] + 2.4, hand[1] + 3.2, hand[0] - 2, hand[1] + 3.2], C('#7fe0c0'));
      poly(ctx, [hand[0] - 0.5, hand[1] - 3, hand[0] + 0.9, hand[1] - 3, hand[0] + 0.9, hand[1] - 1, hand[0] - 0.5, hand[1] - 1], C('#e8f4f0'));
    }
    if (P.item === 'paper') poly(ctx, [hand[0], hand[1] - 3, hand[0] + 4, hand[1] - 3.4, hand[0] + 4.2, hand[1] + 1.6, hand[0] + 0.2, hand[1] + 2], C('#f5ead0'));
    ctx.restore();
  };

  // 寝姿（ベッドの上に横たわる）
  art.sleeper = function (ctx, L, t, quilt) {
    ctx.save();
    const br = Math.sin(t * 1.6 + (L.seed || 0)) * 0.4;
    // 頭（枕の上）
    ctx.save();
    ctx.translate(-9, -3);
    ctx.rotate(-1.35);
    ctx.translate(0, 27);
    hairBack(ctx, L, 0, 0);
    facet(ctx, 0, -27.6, 6.2, 6.1, 8, L.skin, 0.4, 0.1);
    face(ctx, L, { expr: 'sleep', t });
    hairFront(ctx, L);
    ctx.restore();
    // 布団
    const q = quilt || L.outfit;
    poly(ctx, [-4, -6 - br, 13, -5.5 - br * 0.6, 14, 1, -4.5, 1], C(q));
    poly(ctx, [-4, -6 - br, 4, -6.2 - br, 4.5, 1, -4.5, 1], C(q, 0.1));
    poly(ctx, [-4.2, -6 - br, 13, -5.5 - br * 0.6, 13, -4.4 - br * 0.6, -4.2, -4.8 - br], C(q, 0.25));
    ctx.restore();
  };

  // ---------- 魔物 ----------
  // 足元が原点。高さはおよそ 40。 s = { t, hit, atk, phase }
  const M = (art.monster = {});
  M.slime = (ctx, s) => {
    const t = s.t;
    const sq = 1 + Math.sin(t * 5) * 0.06 + (s.atk || 0) * 0.25;
    const w = 17 / Math.sqrt(sq), h = 20 * sq;
    const col = s.color || '#58c7a8';
    ellipse(ctx, 0, 0, w * 1.05, 3, 'rgba(0,0,0,0.18)');
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      pts.push(Math.cos(a) * w, Math.sin(a) * h * (i === 0 || i === n ? 0.1 : 1));
    }
    pts.push(w * 0.9, 0, -w * 0.9, 0);
    facetPoly(ctx, pts, col, 0.18);
    poly(ctx, [-w * 0.55, -h * 0.72, -w * 0.25, -h * 0.9, -w * 0.38, -h * 0.55], 'rgba(255,255,255,0.55)');
    // 顔
    ellipse(ctx, -4, -h * 0.42, 1.7, 2.6, C('#1d2a26'));
    ellipse(ctx, 4.5, -h * 0.42, 1.7, 2.6, C('#1d2a26'));
    ellipse(ctx, -3.5, -h * 0.47, 0.6, 0.8, '#fff');
    ellipse(ctx, 5, -h * 0.47, 0.6, 0.8, '#fff');
    ctx.fillStyle = C('#1d2a26');
    ctx.beginPath(); ctx.moveTo(-1.6, -h * 0.25); ctx.quadraticCurveTo(0.5, -h * 0.12, 2.6, -h * 0.25); ctx.fill();
  };
  M.rabbit = (ctx, s) => {
    const t = s.t;
    const hop = Math.abs(Math.sin(t * 3)) * 3 + (s.atk || 0) * 6;
    ellipse(ctx, 0, 0, 12, 2.6, 'rgba(0,0,0,0.18)');
    ctx.save(); ctx.translate(0, -hop);
    const c = s.color || '#e9e2d6';
    poly(ctx, [-3, -16, -6, -36, -2.4, -35, 0.5, -17], C(c, -0.05));
    poly(ctx, [-4.5, -20, -5.4, -33, -3, -32.5, -1.4, -19], C('#f2b8b0'));
    poly(ctx, [2, -16, 4, -35, 7, -33, 5, -16], C(c, 0.06));
    facet(ctx, 0, -10, 13, 10, 8, c, 0.2, 0.14);
    facet(ctx, 6, -16, 7, 6.5, 7, c, 0.5, 0.12);
    poly(ctx, [7, -21.5, 9.5, -31, 10.2, -21], C('#f0c94a'));
    ellipse(ctx, 9, -17, 1.4, 1.9, C('#c43a3a'));
    ellipse(ctx, 4.6, -17, 1.3, 1.8, C('#c43a3a'));
    ellipse(ctx, 11.8, -13.5, 1, 0.8, C('#e88a8a'));
    ctx.restore();
  };
  M.wolf = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#7d8494';
    const br = Math.sin(t * 2.5) * 0.6;
    const at = s.atk || 0;
    ellipse(ctx, 0, 0, 22, 3, 'rgba(0,0,0,0.2)');
    ctx.save(); ctx.translate(at * 6, 0); ctx.rotate(-at * 0.15);
    // 尾
    poly(ctx, [-17, -20, -28, -27 + Math.sin(t * 4) * 2, -26, -22, -16, -15], C(c, -0.1));
    // 脚
    [[-12, -0.1], [-7, 0], [8, -0.1], [13, 0]].forEach(([x, k], i) => {
      const sw = Math.sin(t * 3 + i) * 0.08;
      limb(ctx, x, -14, 14, 4, sw, C(c, k - 0.1), C(c, -0.35), 2, 4.5);
    });
    facetPoly(ctx, [-19, -22, -10, -28 - br, 8, -28 - br, 16, -24, 15, -12, -16, -12], c, 0.15);
    poly(ctx, [-10, -28 - br, 8, -28 - br, 4, -24, -8, -24], C(c, 0.18));
    // 頭
    facetPoly(ctx, [12, -30, 20, -36, 28, -30, 34, -24, 26, -20, 15, -20], c, 0.18);
    poly(ctx, [14, -32, 16, -42, 20, -35], C(c, -0.15));
    poly(ctx, [19, -34.5, 23, -42, 24.5, -33], C(c, -0.05));
    poly(ctx, [28, -25.5, 34, -24, 33, -22, 27, -22.5], C('#2b2b33'));
    poly(ctx, [24, -29, 27, -29.6, 26.6, -27.4], C('#ffd65a'));
    if (at > 0.3) poly(ctx, [27, -22.5, 33, -22, 30, -19], '#fff');
    ctx.restore();
  };
  M.mushroom = (ctx, s) => {
    const t = s.t;
    const w = Math.sin(t * 2.4) * 0.07 + (s.atk || 0) * 0.2;
    ellipse(ctx, 0, 0, 13, 2.6, 'rgba(0,0,0,0.18)');
    ctx.save(); ctx.rotate(w);
    poly(ctx, [-7, 0, 7, 0, 6, -17, -6, -17], C('#efe3c8'));
    poly(ctx, [-7, 0, 0, 0, 0, -17, -6, -17], C('#f8eedb'));
    ellipse(ctx, -2.5, -9, 1.2, 1.8, C('#2b1d17'));
    ellipse(ctx, 2.6, -9, 1.2, 1.8, C('#2b1d17'));
    poly(ctx, [-1.5, -5.5, 1.5, -5.5, 0, -4], C('#2b1d17'));
    const c = s.color || '#d6574a';
    facetPoly(ctx, [-17, -15, -14, -25, -6, -31, 6, -31, 14, -25, 17, -15, 0, -13], c, 0.18);
    [[-9, -22, 2.6], [3, -27, 2.2], [9, -19, 2], [-2, -18, 1.8]].forEach(([x, y, r]) => facet(ctx, x, y, r, r * 0.8, 6, '#fff7ea', 0, 0.1));
    ctx.restore();
  };
  M.bat = (ctx, s) => {
    const t = s.t;
    const fl = Math.sin(t * 14);
    const y = -26 + Math.sin(t * 3) * 3 - (s.atk || 0) * 4;
    ellipse(ctx, 0, 0, 9, 2, 'rgba(0,0,0,0.15)');
    const c = s.color || '#6a4f8f';
    ctx.save(); ctx.translate(0, y);
    [-1, 1].forEach((d) => {
      poly(ctx, [0, -2, d * 9, -10 - fl * 7, d * 20, -5 - fl * 9, d * 17, 1 - fl * 3, d * 12, -1, d * 8, 3, 0, 3], C(c, d < 0 ? 0.08 : -0.1));
    });
    facet(ctx, 0, 0, 6, 6.5, 7, c, 0, 0.18);
    poly(ctx, [-4, -4.5, -5.5, -10, -1.6, -6], C(c, -0.1));
    poly(ctx, [4, -4.5, 5.5, -10, 1.6, -6], C(c, 0.06));
    ellipse(ctx, -2, -1, 1, 1.2, C('#ffe65a'));
    ellipse(ctx, 2.4, -1, 1, 1.2, C('#ffe65a'));
    poly(ctx, [-1, 2.4, 0, 4.2, 0.6, 2.4], '#fff');
    ctx.restore();
  };
  M.golem = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#9a8f7e';
    const at = s.atk || 0;
    ellipse(ctx, 0, 0, 20, 3.4, 'rgba(0,0,0,0.22)');
    ctx.save(); ctx.translate(0, Math.sin(t * 1.5) * 0.6);
    facetPoly(ctx, [-14, 0, -6, 0, -5, -14, -15, -13], c, 0.18);
    facetPoly(ctx, [6, 0, 14, 0, 15, -13, 5, -14], c, 0.18);
    facetPoly(ctx, [-16, -12, 16, -12, 18, -32, 8, -40, -10, -39, -18, -30], c, 0.16);
    poly(ctx, [-10, -39, 8, -40, 4, -36, -8, -35], C('#6f9a52'));
    facetPoly(ctx, [-8, -38, 8, -38, 9, -50, 0, -54, -9, -49], c, 0.2);
    const glow = 0.7 + Math.sin(t * 4) * 0.3;
    ctx.fillStyle = G.rgba('#7fe0ff', 0.3 * glow);
    ctx.beginPath(); ctx.arc(0, -45, 9, 0, TAU); ctx.fill();
    poly(ctx, [-5, -46, -1.5, -46, -2, -44, -5, -44], C('#9ff0ff'));
    poly(ctx, [2, -46, 5.5, -46, 5, -44, 2.4, -44], C('#9ff0ff'));
    // 腕
    const arm = -0.3 - at * 1.6;
    ctx.save(); ctx.translate(16, -30); ctx.rotate(arm);
    facetPoly(ctx, [-3, 0, 6, -1, 7, 18, -2, 19], c, 0.18);
    ctx.restore();
    ctx.save(); ctx.translate(-16, -30); ctx.rotate(0.2);
    facetPoly(ctx, [-6, -1, 3, 0, 2, 19, -7, 18], c, 0.18);
    ctx.restore();
    ctx.restore();
  };
  M.skeleton = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#ece6d6';
    const at = s.atk || 0;
    ellipse(ctx, 0, 0, 10, 2.4, 'rgba(0,0,0,0.2)');
    ctx.save(); ctx.translate(0, Math.sin(t * 6) * 0.5);
    ctx.strokeStyle = C(c);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const ln = (a, b, c2, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); };
    ln(-3, 0, -2, -13); ln(3, 0, 2, -13);
    ln(0, -13, 0, -27);
    for (let i = 0; i < 3; i++) ln(-5 + i * 0.4, -18 - i * 3, 5 - i * 0.4, -18 - i * 3);
    ln(-1, -25, -6, -16);
    const aa = -0.8 - at * 1.4;
    const hx = 1 + Math.sin(-aa) * 10, hy = -25 + Math.cos(aa) * 10;
    ln(1, -25, hx, hy);
    sword(ctx, hx, hy, aa + Math.PI * 1.05, 12);
    facet(ctx, 0.5, -33, 6.2, 6, 7, c, 0.2, 0.14);
    poly(ctx, [-2.6, -34, -0.4, -34, -0.6, -31.5, -2.4, -31.6], C('#3a2c3a'));
    poly(ctx, [1.4, -34, 3.8, -34, 3.6, -31.5, 1.6, -31.6], C('#3a2c3a'));
    ctx.fillStyle = G.rgba('#ff5a5a', 0.6 + Math.sin(t * 5) * 0.3);
    ctx.fillRect(-1.9, -33.2, 0.9, 0.9);
    ctx.fillRect(2.2, -33.2, 0.9, 0.9);
    ctx.restore();
  };
  M.knight = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#5b5f8f';
    const at = s.atk || 0;
    const fl = 0.75 + Math.sin(t * 7) * 0.1;
    ctx.globalAlpha *= fl;
    ellipse(ctx, 0, 0, 16, 3, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = G.rgba('#9a8cff', 0.18);
    ctx.beginPath(); ctx.arc(0, -26, 26, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(at * 8, Math.sin(t * 2) * 1.2);
    facetPoly(ctx, [-9, 0, -3, 0, -2, -18, -10, -18], c, 0.16);
    facetPoly(ctx, [3, 0, 9, 0, 10, -18, 2, -18], c, 0.16);
    facetPoly(ctx, [-13, -16, 13, -16, 15, -38, 0, -42, -15, -38], c, 0.2);
    poly(ctx, [-15, -38, 0, -42, -2, -30, -13, -18], C(c, 0.14));
    facetPoly(ctx, [-7, -40, 7, -40, 8, -52, 0, -56, -8, -52], c, 0.22);
    poly(ctx, [-5, -48, 6, -48, 6, -46.4, -5, -46.4], C('#b8a8ff', 0.2));
    poly(ctx, [-1, -56, 1.2, -56, -3, -66 + Math.sin(t * 4) * 1.5, -6, -63], C('#7a3a8a'));
    // 槍
    ctx.save(); ctx.translate(14, -26); ctx.rotate(-0.25 + at * 1.1);
    poly(ctx, [-1, 14, 1, 14, 1, -26, -1, -26], C('#6b5a4a'));
    poly(ctx, [-2.6, -26, 2.6, -26, 0, -36], C('#d8dce8'));
    ctx.restore();
    ctx.restore();
  };
  M.wyvern = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#4f9a72';
    const fl = Math.sin(t * 6);
    const at = s.atk || 0;
    const y = -30 + Math.sin(t * 3) * 3;
    ellipse(ctx, 0, 0, 18, 3, 'rgba(0,0,0,0.18)');
    ctx.save(); ctx.translate(at * 10, y);
    poly(ctx, [-6, -2, -14, -16 - fl * 12, -32, -24 - fl * 14, -28, -8 - fl * 6, -22, -4, -16, 2], C(c, -0.15));
    poly(ctx, [-12, 4, -26, 10, -34, 6 + Math.sin(t * 3) * 3, -30, 12, -14, 9], C(c, -0.1));
    facetPoly(ctx, [-14, 6, -6, -6, 8, -8, 14, 0, 6, 10, -8, 12], c, 0.18);
    poly(ctx, [-6, 6, 6, 4, 4, 10, -6, 11], C('#e8d08a'));
    facetPoly(ctx, [8, -6, 16, -16, 26, -16, 30, -10, 22, -6, 14, 0], c, 0.2);
    poly(ctx, [16, -16, 14, -24, 20, -17], C(c, -0.2));
    ellipse(ctx, 23, -12.5, 1.2, 1.3, C('#ffe65a'));
    poly(ctx, [-2, -4, 8, -16 - fl * 10, 18, -30 - fl * 12, 16, -12 - fl * 4, 10, -6], C(c, 0.1));
    ctx.restore();
  };
  M.dragon = (ctx, s) => {
    const t = s.t;
    const c = s.color || '#c8402e';
    const fl = Math.sin(t * 2.2);
    const at = s.atk || 0;
    ellipse(ctx, 0, 0, 34, 4, 'rgba(0,0,0,0.25)');
    ctx.save(); ctx.translate(at * 6, 0);
    // 翼（奥）
    poly(ctx, [-6, -40, -20, -70 - fl * 6, -44, -76 - fl * 8, -40, -56, -30, -44], C(c, -0.3));
    // 尾
    poly(ctx, [-20, -14, -40, -8, -56, -18 + Math.sin(t * 2) * 4, -60, -10, -40, 0, -18, -4], C(c, -0.12));
    poly(ctx, [-56, -18 + Math.sin(t * 2) * 4, -66, -26, -60, -10], C('#f0c94a'));
    // 脚
    facetPoly(ctx, [-20, 0, -10, 0, -8, -16, -22, -18], c, 0.16);
    facetPoly(ctx, [10, 0, 20, 0, 22, -18, 8, -16], c, 0.16);
    // 胴
    facetPoly(ctx, [-26, -14, -18, -40, 6, -46, 22, -34, 24, -14, 0, -8], c, 0.18);
    poly(ctx, [-10, -12, 14, -14, 18, -30, 6, -36, -6, -30], C('#f2c766'));
    poly(ctx, [-6, -18, 12, -20, 12, -22, -6, -20], C('#d8a44a'));
    poly(ctx, [-4, -26, 14, -27, 13, -29, -4, -28], C('#d8a44a'));
    // 首と頭
    const hy = -64 + fl * 2 - at * 4;
    facetPoly(ctx, [6, -44, 14, -60, 24, hy + 2, 28, hy + 12, 20, -38], c, 0.18);
    facetPoly(ctx, [18, hy, 32, hy - 6, 44, hy + 2, 46, hy + 9, 30, hy + 14, 20, hy + 10], c, 0.2);
    poly(ctx, [22, hy - 1, 18, hy - 16, 28, hy - 4], C('#f2e2c0'));
    poly(ctx, [28, hy - 4, 30, hy - 17, 34, hy - 5], C('#f2e2c0', -0.1));
    poly(ctx, [33, hy + 1, 37, hy + 0.2, 36, hy + 3], C('#ffe65a'));
    if (at > 0.2) {
      // 炎
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        const fx = 46 + k * 40 * at, fy = hy + 10 + Math.sin(t * 20 + i) * 3;
        facet(ctx, fx, fy, 6 + k * 8, 5 + k * 6, 5, i % 2 ? '#ffb347' : '#ff6a3a', t * 5 + i, 0.25);
      }
    } else {
      const sm = (t * 0.8) % 1;
      ctx.fillStyle = `rgba(80,70,70,${0.3 * (1 - sm)})`;
      ctx.beginPath(); ctx.arc(46 + sm * 8, hy + 6 - sm * 12, 2 + sm * 4, 0, TAU); ctx.fill();
    }
    // 翼（手前）
    poly(ctx, [0, -42, 10, -80 - fl * 8, 40, -92 - fl * 10, 34, -70, 26, -56, 14, -40], C(c, 0.06));
    poly(ctx, [10, -80 - fl * 8, 40, -92 - fl * 10, 34, -70], C(c, 0.18));
    ctx.restore();
  };
  art.monsterHeight = { slime: 22, rabbit: 36, wolf: 42, mushroom: 32, bat: 40, golem: 54, skeleton: 40, knight: 56, wyvern: 50, dragon: 92 };

  // ---------- アイコン ----------
  art.coin = (ctx, x, y, r, t = 0) => {
    const sx = Math.abs(Math.cos(t * 3)) * 0.7 + 0.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
    facet(ctx, 0, 0, r, r, 8, '#f2b632', Math.PI / 8, 0.22);
    facet(ctx, 0, 0, r * 0.62, r * 0.62, 8, '#ffd45a', Math.PI / 8, 0.16);
    poly(ctx, [-r * 0.15, -r * 0.35, r * 0.15, -r * 0.35, r * 0.15, r * 0.35, -r * 0.15, r * 0.35], '#d9952a');
    ctx.restore();
  };
  art.gem = (ctx, x, y, r) => {
    poly(ctx, [x, y - r, x + r * 0.8, y - r * 0.2, x, y + r, x - r * 0.8, y - r * 0.2], '#7d6cf0');
    poly(ctx, [x, y - r, x + r * 0.8, y - r * 0.2, x, y - r * 0.05], '#a99cff');
    poly(ctx, [x, y - r, x - r * 0.8, y - r * 0.2, x, y - r * 0.05], '#c9c0ff');
    poly(ctx, [x - r * 0.8, y - r * 0.2, x, y - r * 0.05, x, y + r], '#6655d8');
  };
  art.fameStar = (ctx, x, y, r) => {
    star(ctx, x, y, r, '#ffcf4a');
    star(ctx, x - r * 0.12, y - r * 0.12, r * 0.55, '#ffe58f');
  };
  art.heart = (ctx, x, y, r, col = '#ff4f6d') => {
    ctx.save(); ctx.translate(x, y); ctx.scale(r / 10, r / 10);
    poly(ctx, [0, 9, -10, -1, -9, -7, -5, -9, 0, -5, 5, -9, 9, -7, 10, -1], col);
    poly(ctx, [0, -5, -5, -9, -9, -7, -10, -1, -4, -3], G.shade(col, 0.2));
    ctx.restore();
  };

  // 宝箱
  art.chest = (ctx, open, tier, t) => {
    const wood = tier === 'legend' ? '#8a4fd8' : tier === 'great' ? '#c48a2e' : '#8a5a2e';
    const band = tier === 'legend' ? '#ffe680' : '#e8bd4c';
    // 開くと、ふたは奥へ倒れて中が光る
    if (open > 0) {
      ctx.save();
      ctx.translate(0, -16 - open * 9);
      ctx.scale(1, 1 - open * 0.55);
      facetPoly(ctx, [-16, 0, 16, 0, 15, -9, 0, -12, -15, -9], C(wood, -0.1), 0.14);
      poly(ctx, [-16, 0, 16, 0, 16, -2, -16, -2], C(band, -0.15));
      ctx.restore();
      poly(ctx, [-15, -16, 15, -16, 13, -19 - open * 2, -13, -19 - open * 2], '#2a160a');
      ctx.fillStyle = `rgba(255,236,170,${0.85 * open})`;
      poly(ctx, [-12, -16.5, 12, -16.5, 10, -18.5 - open * 1.5, -10, -18.5 - open * 1.5], `rgba(255,236,170,${0.9 * open})`);
    }
    facetPoly(ctx, [-16, 0, 16, 0, 16, -16, -16, -16], wood, 0.1);
    poly(ctx, [-16, -16, 16, -16, 16, -13.5, -16, -13.5], C(band, -0.1));
    poly(ctx, [-11, 0, -8, 0, -8, -16, -11, -16], C(band, -0.2));
    poly(ctx, [8, 0, 11, 0, 11, -16, 8, -16], C(band, -0.2));
    poly(ctx, [-2.5, -14, 2.5, -14, 2.5, -7, -2.5, -7], C(band));
    if (open <= 0) {
      ctx.save();
      ctx.translate(0, -16);
      facetPoly(ctx, [-16, 0, 16, 0, 15, -8, 0, -11, -15, -8], wood, 0.14);
      poly(ctx, [-16, 0, 16, 0, 16, -2, -16, -2], C(band));
      poly(ctx, [-2.5, 0, 2.5, 0, 2.5, -5, -2.5, -5], C(band, 0.1));
      ctx.restore();
    }
  };

  // ---------- 吹き出し ----------
  art.bubble = (ctx, x, y, text, alpha = 1, scale = 1) => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = '700 7px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    const w = Math.max(12, ctx.measureText(text).width + 8);
    const h = 11;
    ctx.fillStyle = 'rgba(40,24,14,0.18)';
    rrect(ctx, -w / 2 + 0.6, -h - 4.4, w, h, 4.5);
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    rrect(ctx, -w / 2, -h - 5, w, h, 4.5);
    ctx.fill();
    poly(ctx, [-2.2, -5.4, 2.2, -5.4, 0, -1.6], '#fffaf0');
    ctx.fillStyle = '#3a2a20';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, -h / 2 - 4.6);
    ctx.restore();
  };

  // ---------- 似顔絵（DOM 用） ----------
  const portraitCache = new Map();
  art.portrait = (look, size = 64, key) => {
    const k = (key || JSON.stringify(look)) + size;
    if (portraitCache.has(k)) return portraitCache.get(k);
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const s = size / 26;
    ctx.translate(size / 2 - s * 0.8, size * 1.64);
    ctx.scale(s, s);
    art.person(ctx, look, { t: 0.8, state: 'stand', facing: 1, noShadow: true });
    const url = c.toDataURL();
    portraitCache.set(k, url);
    return url;
  };
})();
