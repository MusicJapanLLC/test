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
    crest: cls === 'knight' ? G.pick(['#3a5aa0', '#c4553a', '#e2b84a', '#5a9a6a', '#8a4ab0']) : undefined,
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
    } else if (cls === 'knight') {
      // 騎士：面頬つきの兜と羽飾り
      const s2 = '#c4ccd8';
      poly(ctx, [-7.2, -23.5, -7.2, -31, -4.8, -35, 0, -36.6, 4.8, -35, 7.2, -31, 7.2, -23.5], C(s2));
      poly(ctx, [-7.2, -31, -4.8, -35, 0, -36.6, -0.4, -31, -7.2, -27], C(s2, 0.18));
      poly(ctx, [0, -36.6, 4.8, -35, 7.2, -31, 7.2, -23.5, 1.6, -28], C(s2, -0.12));
      poly(ctx, [-6.4, -28.6, 6.6, -28.6, 6.6, -27.4, -6.4, -27.4], C('#1a2030'));
      poly(ctx, [-0.5, -36.4, 0.5, -36.4, 0.5, -23.6, -0.5, -23.6], C(s2, -0.25));
      const fl = Math.sin(t * 3 + L.seed) * 0.8 + sway;
      poly(ctx, [-0.6, -36.4, 1.6, -37.2, -3 + fl, -43.5, -8 + fl, -41.5, -4 + fl, -38.6], C(L.crest || '#3a5aa0'));
      poly(ctx, [-0.6, -36.4, -3 + fl, -43.5, -4 + fl, -38.6], C(L.crest || '#3a5aa0', 0.18));
    } else if (cls === 'bard') {
      // 吟遊詩人：つば広の帽子と長い羽根
      const c = G.shade(L.outfit, -0.15);
      poly(ctx, [-10, -30.2, 10.4, -30.2, 8, -32.2, -7.6, -32.2], C(c, -0.12));
      poly(ctx, [-6, -31.8, 6, -31.8, 5, -37, 0, -38.6, -5, -37], C(c));
      poly(ctx, [-6, -31.8, 0, -31.8, 0, -38.6, -5, -37], C(c, 0.12));
      poly(ctx, [-6, -32.6, 6, -32.6, 6, -33.8, -6, -33.8], C('#f2d36a'));
      const f = Math.sin(t * 2.6 + L.seed) * 1 + sway * 1.2;
      poly(ctx, [3.8, -33.4, 5.2, -34.2, 13 + f, -42, 11.6 + f, -42.6], C('#fff4e0'));
      poly(ctx, [5.2, -34.2, 13 + f, -42, 12.4 + f, -40], C('#ffb8d8'));
    } else if (cls === 'alchemist') {
      // 錬金術師：額にゴーグル
      poly(ctx, [-7, -28.8, 7, -28.8, 7, -27.2, -7, -27.2], C('#4a3326'));
      [[-3, '#8fe0ff'], [3, '#8fe0ff']].forEach(([x, g]) => {
        facet(ctx, x, -29.6, 2.6, 2.4, 8, '#8a6a3a', 0, 0.2);
        facet(ctx, x, -29.6, 1.8, 1.6, 8, g, t * 0.4, 0.3);
        poly(ctx, [x - 1, -30.6, x, -30.6, x - 0.4, -29.4], 'rgba(255,255,255,0.8)');
      });
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
  // 騎士の盾（紋章入り）
  function shield(ctx, x, y, crest, sc = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    poly(ctx, [-4.2, -5.6, 4.2, -5.6, 4.2, 0.6, 0, 6, -4.2, 0.6], C('#b8c4d4'));
    poly(ctx, [-4.2, -5.6, 0, -5.6, 0, 6, -4.2, 0.6], C('#d8e2ee'));
    poly(ctx, [-3.2, -4.6, 3.2, -4.6, 3.2, 0.2, 0, 4.6, -3.2, 0.2], C(crest || '#3a5aa0'));
    poly(ctx, [-0.6, -4.2, 0.6, -4.2, 0.6, 3.6, -0.6, 3.6], C('#f2d36a'));
    poly(ctx, [-2.8, -1.6, 2.8, -1.6, 2.8, -0.4, -2.8, -0.4], C('#f2d36a'));
    ctx.restore();
  }
  // 吟遊詩人のリュート
  function lute(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    facet(ctx, 0, 2.4, 3.6, 4.2, 9, '#b8783a', 0.2, 0.18);
    facet(ctx, 0, 2.8, 1.1, 1.1, 6, '#3a2418', 0, 0.1);
    poly(ctx, [-0.6, -1.6, 0.6, -1.6, 0.5, -9, -0.5, -9], C('#6a4426'));
    poly(ctx, [-1.1, -9, 1.1, -9, 0.8, -11, -0.8, -11], C('#4a2e1a'));
    ctx.strokeStyle = 'rgba(255,245,220,0.7)';
    ctx.lineWidth = 0.18;
    ctx.beginPath(); ctx.moveTo(-0.3, -9); ctx.lineTo(-0.4, 5); ctx.moveTo(0.3, -9); ctx.lineTo(0.4, 5); ctx.stroke();
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
      if (L.cls === 'knight') shield(ctx, -4.6, -15 + (sit ? 4 : 0), L.crest, 0.95);
      if (L.cls === 'bard') lute(ctx, -4.4, -15 + (sit ? 4 : 0), 0.5);
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
    const bh = limb(ctx, -1.2, sh, 9.2, 2.9, backA, C(sleeve, -0.18), C(skin, -0.12), 1.9, 2.8);
    if (armed && L.cls === 'knight' && !L.role) shield(ctx, bh[0] - 1, bh[1] - 1, L.crest, 1.05);

    // 胴
    const lightL = 0.08 * f, lightR = -0.08 * f;
    const robe = L.robe || L.cls === 'mage' || L.cls === 'cleric' || (L.cls === 'alchemist' && !L.role);
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
    if (L.cls === 'knight' && !L.role) {
      // 胸当てと両肩の鎧
      poly(ctx, [-4.0, hipY + 0.2, 4.0, hipY + 0.2, 4.4, torsoTop + 0.8, -4.2, torsoTop + 0.8], C('#c4ccd8', lightL * 0.5));
      poly(ctx, [0, hipY + 0.2, 4.0, hipY + 0.2, 4.4, torsoTop + 0.8, 0, torsoTop + 0.8], C('#c4ccd8', -0.12));
      poly(ctx, [-1.4, torsoTop + 1.5, 1.4, torsoTop + 1.5, 1.2, hipY - 1, -1.2, hipY - 1], C(L.outfit));
      facet(ctx, -2.8, torsoTop + 1.2, 2.8, 2.2, 6, '#d8e0ea', 0, 0.2);
      facet(ctx, 2.8, torsoTop + 1.2, 2.8, 2.2, 6, '#aab4c4', 0, 0.2);
    }
    if (L.cls === 'bard' && !L.role) {
      // 襟とたすき
      poly(ctx, [-4.4, torsoTop + 0.4, 4.6, torsoTop + 0.4, 3, torsoTop + 3, 0, torsoTop + 1.6, -3, torsoTop + 3], C('#fff4e0'));
      poly(ctx, [3.8, torsoTop + 1, 4.8, torsoTop + 2, -3.4, hipY - 0.4, -4.4, hipY - 1.4], C('#6a4426'));
    }
    if (L.cls === 'alchemist' && !L.role) {
      // 前掛けと腰の小瓶
      poly(ctx, [-2.6, hipY + 4, 3.2, hipY + 4, 3.2, torsoTop + 3, -2.2, torsoTop + 3], C('#e8dcc0'));
      [[-3.6, '#ff7ab8'], [3.6, '#7fd0ff']].forEach(([x, c]) => {
        poly(ctx, [x - 0.8, hipY + 0.6, x + 0.8, hipY + 0.6, x + 1.1, hipY + 3.4, x - 1.1, hipY + 3.4], C(c));
        poly(ctx, [x - 0.4, hipY - 0.4, x + 0.4, hipY - 0.4, x + 0.4, hipY + 0.6, x - 0.4, hipY + 0.6], C('#e8f4f0'));
      });
    }
    // 首と頭
    poly(ctx, [-1.3, torsoTop + 0.5, 1.6, torsoTop + 0.5, 1.6, torsoTop - 1.6, -1.3, torsoTop - 1.6], C(skin, -0.1));
    ctx.save();
    ctx.translate(0, torsoTop + 21);
    hairBack(ctx, L, t, sway);
    facet(ctx, 0, -27.6, 6.4, 6.3, 8, skin, 0.4, 0.1);
    face(ctx, L, P);
    if (!(L.cls === 'thief' || L.cls === 'cleric' || L.cls === 'knight' || L.hood) || L.role) hairFront(ctx, L);
    if (L.cls === 'mage' && !L.role) { /* 魔法使いは帽子の下に髪 */ }
    headwear(ctx, L, t, sway);
    ctx.restore();

    // 前の腕と持ち物
    const hand = limb(ctx, 1.2, sh, 9.2, 3, frontA, C(sleeve, 0.02), C(skin), 1.9, 2.9);
    if (armed && L.cls === 'warrior') sword(ctx, hand[0], hand[1], frontA + Math.PI * 0.95, 13);
    else if (armed && L.cls === 'thief') sword(ctx, hand[0], hand[1], frontA + Math.PI * 0.9, 6);
    else if (armed && L.cls === 'archer') bow(ctx, hand[0] + 1, hand[1], 0);
    else if (armed && L.cls === 'knight') sword(ctx, hand[0], hand[1], frontA + Math.PI * 0.95, 14);
    else if (armed && L.cls === 'bard') lute(ctx, hand[0] - 1, hand[1] + 2, -1.1 + Math.sin(t * 9) * 0.06);
    if (L.cls === 'alchemist' && !L.role && (armed || P.item === undefined)) {
      poly(ctx, [hand[0] - 1.4, hand[1] - 0.6, hand[0] + 1.8, hand[1] - 0.6, hand[0] + 2.6, hand[1] + 3.6, hand[0] - 2.2, hand[1] + 3.6], C('#7fe0a0'));
      poly(ctx, [hand[0] - 1.4, hand[1] - 0.6, hand[0] + 0.2, hand[1] - 0.6, hand[0] + 0.2, hand[1] + 3.6, hand[0] - 2.2, hand[1] + 3.6], C('#b8ffd0'));
      poly(ctx, [hand[0] - 0.5, hand[1] - 2.8, hand[0] + 0.9, hand[1] - 2.8, hand[0] + 0.9, hand[1] - 0.6, hand[0] - 0.5, hand[1] - 0.6], C('#e8f4f0'));
    }
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
  // ---- 潮風の港 ----
  M.crab = (ctx, s) => {
    const t = s.t, at = s.atk || 0;
    const c = s.color || '#e0603a';
    ellipse(ctx, 0, 0, 22, 3, 'rgba(0,0,0,0.2)');
    ctx.save(); ctx.translate(at * 5, -Math.abs(Math.sin(t * 5)) * 0.8);
    for (let i = 0; i < 3; i++) {
      const x = -12 + i * 7, sw = Math.sin(t * 6 + i * 1.7) * 1.4;
      poly(ctx, [x, -10, x - 6 + sw, -5, x - 8 + sw, 0, x - 6 + sw, 0, x - 3 + sw, -4, x + 2, -9], C(c, -0.2));
    }
    // 小さいほうのハサミ（奥）
    ctx.save(); ctx.translate(12, -18); ctx.rotate(-0.9 + Math.sin(t * 2.2) * 0.15);
    poly(ctx, [0, -1.5, 6, -2.5, 6.5, 0.5, 0, 1.5], C(c, -0.2));
    facetPoly(ctx, [6, -3, 12, -6, 14, -3, 11, 1, 6, 1.5], C(c, -0.12), 0.12);
    ctx.restore();
    // 甲羅
    facetPoly(ctx, [-19, -9, -15, -20, -5, -25, 8, -25, 18, -19, 21, -9, 10, -5, -10, -5], c, 0.18);
    poly(ctx, [-15, -20, -5, -25, 8, -25, 2, -19.5, -8, -18.5], C(c, 0.22));
    [[-9, -14, 1.6], [-2, -12, 1.2], [6, -15, 1.4], [12, -11, 1]].forEach(([x, y, r]) => facet(ctx, x, y, r, r * 0.8, 6, C(c, 0.32), 0, 0.1));
    poly(ctx, [-12, -7, 14, -7, 10, -5, -9, -5], C(c, -0.3));
    // 目
    const e = Math.sin(t * 2) * 0.8;
    [[3, 0], [9, 0.4]].forEach(([x]) => {
      poly(ctx, [x - 0.7, -24, x + 0.7, -24, x + 1 + e, -31, x - 0.5 + e, -31], C(c, -0.08));
      facet(ctx, x + e * 1.2 + 0.2, -32, 2.1, 2.1, 6, '#ffffff', 0, 0.1);
      facet(ctx, x + e * 1.2 + 0.8, -32, 1.1, 1.1, 6, '#1a1a22', 0, 0.1);
    });
    // 大きなハサミ（手前）：カチカチ
    const snap = Math.max(0, Math.sin(t * 3.2)) * 0.45 + at * 0.7;
    ctx.save(); ctx.translate(18, -12); ctx.rotate(-0.35 - at * 0.6);
    poly(ctx, [0, -2.2, 9, -3.2, 9.6, 0.8, 0, 2.2], C(c, -0.1));
    ctx.translate(9, -1.6);
    facetPoly(ctx, [0, -2.5, 9, -9.5, 16, -7.5, 14, -1.5, 4, 2], c, 0.2);
    poly(ctx, [9, -9.5, 16, -7.5, 13, -6], C(c, 0.3));
    ctx.rotate(snap);
    facetPoly(ctx, [0, 0.5, 13, 1.5, 14, 6, 4, 6], C(c, -0.1), 0.15);
    ctx.restore();
    ctx.restore();
  };
  function tentacle(ctx, x0, y0, len, ang, curl, w, col, tip, t) {
    const L = [], R = [];
    let x = x0, y = y0, a = ang;
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const ww = w * (1 - k * 0.85);
      L.push(x + Math.cos(a - Math.PI / 2) * ww, y + Math.sin(a - Math.PI / 2) * ww);
      R.unshift(x + Math.cos(a + Math.PI / 2) * ww, y + Math.sin(a + Math.PI / 2) * ww);
      a += curl * (0.6 + k) + Math.sin(t * 2 + i * 0.7) * 0.08;
      x += Math.cos(a) * (len / n);
      y += Math.sin(a) * (len / n);
    }
    poly(ctx, L.concat(R), col);
    poly(ctx, L.slice(0, 10).concat(R.slice(-10)), tip);
  }
  M.kraken = (ctx, s) => {
    const t = s.t, at = s.atk || 0;
    const c = s.color || '#8a4ab0';
    ctx.save(); ctx.scale(0.86, 0.86);
    ellipse(ctx, 0, 0, 36, 6, 'rgba(50,120,190,0.45)');
    ellipse(ctx, 0, -1, 28, 4, 'rgba(170,225,255,0.35)');
    ctx.save(); ctx.translate(at * 8, Math.sin(t * 1.4) * 1.2);
    // 奥の触手
    [-1, 1].forEach((d, i) => tentacle(ctx, d * 10, -18, 40, -Math.PI / 2 - d * 0.6, d * 0.16 + Math.sin(t * 1.6 + i) * 0.05, 4.2, C(c, -0.22), C(c, -0.12), t + i));
    // 胴
    facetPoly(ctx, [-17, -12, -19, -36, -11, -58, 0, -67, 11, -58, 19, -36, 17, -12], c, 0.18);
    poly(ctx, [-11, -58, 0, -67, 4, -50, -6, -40], C(c, 0.22));
    [[-9, -46, 1.6], [6, -52, 1.3], [10, -38, 1.5], [-12, -30, 1.2]].forEach(([x, y, r]) => facet(ctx, x, y, r, r, 6, C(c, 0.3), 0, 0.1));
    // 目
    const blink = Math.sin(t * 0.9) > 0.97 ? 0.2 : 1;
    [-7, 7].forEach((x) => {
      facet(ctx, x, -26, 4.6, 4.2 * blink, 8, '#ffe28a', 0, 0.1);
      poly(ctx, [x - 0.9, -26 - 3.4 * blink, x + 0.9, -26 - 3.4 * blink, x + 0.9, -26 + 3.4 * blink, x - 0.9, -26 + 3.4 * blink], '#1a1020');
    });
    // 手前の触手（攻撃で前へ）
    for (let i = 0; i < 4; i++) {
      const d = i < 2 ? -1 : 1;
      const base = -12 + i * 8;
      const ang = (d < 0 ? Math.PI * 0.85 : Math.PI * 0.15) - (i === 3 ? at * 0.9 : 0);
      tentacle(ctx, base, -10, 26 + (i % 2) * 8 + (i === 3 ? at * 18 : 0), ang, -d * (0.12 + Math.sin(t * 2 + i) * 0.05), 4.6, C(c, -0.05), C('#f0b8e0'), t + i * 0.9);
    }
    ctx.restore();
    ctx.restore();
  };
  // ---- 天空城 ----
  M.griffin = (ctx, s) => {
    const t = s.t, at = s.atk || 0;
    const fl = Math.sin(t * 6);
    const y = -36 + Math.sin(t * 2.5) * 4 - at * 6;
    ellipse(ctx, 0, 0, 22, 3, 'rgba(0,0,0,0.15)');
    ctx.save(); ctx.translate(at * 10, y);
    const c = s.color || '#c8a060';
    const W = '#f6f0e4';
    poly(ctx, [-2, -8, -16, -28 - fl * 10, -28, -22 - fl * 8, -24, -12 - fl * 4, -10, -2], C(W, -0.18));
    poly(ctx, [-16, 2, -28, 3, -32, 8, -27, 7, -16, 6], C(c, -0.1));
    facet(ctx, -31, 7.5, 2.4, 2.2, 6, C(c, -0.25), 0, 0.15);
    limb(ctx, -12, 4, 9, 3, 0.3 + Math.sin(t * 3) * 0.1, C(c, -0.12), C(c, -0.3), 2, 3.4);
    facetPoly(ctx, [-18, -4, -10, -10, 8, -10, 14, -4, 12, 6, -16, 6], c, 0.15);
    poly(ctx, [-10, -10, 8, -10, 4, -6, -8, -6], C(c, 0.15));
    limb(ctx, 9, 4, 8, 2.6, -0.4 - at * 0.6, C('#e8c070'), C('#e8c070', -0.2), 2, 3);
    facetPoly(ctx, [7, -8, 13, -18, 21, -23, 28, -19, 26, -11, 16, -3], W, 0.14);
    poly(ctx, [13, -18, 21, -23, 18, -14], C(W, -0.08));
    poly(ctx, [20, -23, 18, -28, 23, -24], C(W, -0.12));
    poly(ctx, [24, -22, 25, -27, 27, -22], C(W, -0.12));
    poly(ctx, [26, -20.5, 34.5, -17.5, 31, -13, 26, -14.5], '#f0b030');
    poly(ctx, [31, -16, 34.5, -17.5, 33.5, -14, 31, -13], '#c88a20');
    facet(ctx, 23, -18.5, 1.5, 1.5, 6, '#1a1a22', 0, 0.1);
    poly(ctx, [22, -20, 25, -20.5, 24.5, -19.6], '#ffffff');
    // 手前の翼
    poly(ctx, [0, -8, -10, -32 - fl * 12, -25, -27 - fl * 10, -20, -15 - fl * 5, -6, -2], W);
    poly(ctx, [-10, -32 - fl * 12, -25, -27 - fl * 10, -17, -24 - fl * 8], C(W, 0.06));
    ctx.strokeStyle = 'rgba(180,160,130,0.6)'; ctx.lineWidth = 0.6;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-3 - k * 2, -6); ctx.lineTo(-14 - k * 4, -26 - fl * 9 + k * 3); ctx.stroke(); }
    ctx.restore();
  };
  M.sentinel = (ctx, s) => {
    const t = s.t, at = s.atk || 0;
    const y = -6 + Math.sin(t * 1.8) * 3;
    const c = s.color || '#e8e4f0';
    ctx.save(); ctx.scale(0.88, 0.88);
    ellipse(ctx, 0, 0, 18, 3, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = 'rgba(255,220,140,0.12)';
    ctx.beginPath(); ctx.arc(0, -40, 34, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(at * 6, y);
    // 翼（石）
    const wf = Math.sin(t * 1.2) * 0.06;
    [[-1, -0.1], [1, 0.05]].forEach(([d, k]) => {
      ctx.save(); ctx.translate(d * 4, -40); ctx.rotate(d * (0.15 + wf));
      facetPoly(ctx, [0, 0, d * 22, -18, d * 30, -10, d * 26, 2, d * 18, 8, d * 8, 6], C(c, k - 0.06), 0.12);
      ctx.strokeStyle = 'rgba(150,140,170,0.6)'; ctx.lineWidth = 0.7;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(d * 3, 2); ctx.lineTo(d * (10 + i * 6), -14 + i * 5); ctx.stroke(); }
      ctx.restore();
    });
    // 衣（足はなく、浮いている）
    facetPoly(ctx, [-9, -42, 9, -42, 13, -6, 6, -2, 0, -6, -6, -2, -13, -6], c, 0.14);
    poly(ctx, [-13, -6, -6, -2, 0, -6, 6, -2, 13, -6, 12, -9, -12, -9], C('#e2b84a'));
    poly(ctx, [-1, -42, 1, -42, 1, -9, -1, -9], C(c, -0.12));
    // 胸の核
    const gl = 0.6 + Math.sin(t * 3) * 0.4;
    ctx.fillStyle = G.rgba('#ffd36a', 0.4 * gl);
    ctx.beginPath(); ctx.arc(0, -32, 5, 0, TAU); ctx.fill();
    facet(ctx, 0, -32, 2.2, 2.6, 6, '#ffe9a0', t, 0.3);
    // 頭と兜
    facetPoly(ctx, [-5.5, -42, 5.5, -42, 6, -52, 0, -56, -6, -52], c, 0.18);
    poly(ctx, [-4.6, -48.6, 4.6, -48.6, 4.6, -47.2, -4.6, -47.2], G.rgba('#ffd36a', 0.6 + gl * 0.4));
    poly(ctx, [-0.7, -51, 0.7, -51, 0.7, -44.5, -0.7, -44.5], G.rgba('#ffd36a', 0.6 + gl * 0.4));
    ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -60, 7, 2, 0, 0, TAU); ctx.stroke();
    // 槍（攻撃で突き出す）
    ctx.save(); ctx.translate(9 + at * 10, -30); ctx.rotate(-1.2 + at * 1.1);
    poly(ctx, [-0.8, 14, 0.8, 14, 0.8, -26, -0.8, -26], C('#c8c0d8'));
    poly(ctx, [-2.4, -26, 2.4, -26, 0, -36], '#ffd36a');
    poly(ctx, [0, -26, 2.4, -26, 0, -36], '#e8a830');
    ctx.restore();
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
  // 素材（青銅のインゴット）
  art.gem = (ctx, x, y, r) => {
    poly(ctx, [x - r, y + r * 0.3, x - r * 0.55, y - r * 0.5, x + r, y - r * 0.5, x + r * 0.55, y + r * 0.3], '#e0a05a');
    poly(ctx, [x - r, y + r * 0.3, x + r * 0.55, y + r * 0.3, x + r * 0.55, y + r * 0.75, x - r, y + r * 0.75], '#b06a32');
    poly(ctx, [x + r * 0.55, y + r * 0.3, x + r, y - r * 0.5, x + r, y, x + r * 0.55, y + r * 0.75], '#8a4e22');
    poly(ctx, [x - r * 0.55, y - r * 0.5, x + r, y - r * 0.5, x + r * 0.8, y - r * 0.28, x - r * 0.4, y - r * 0.28], '#ffd9a0');
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
    ctx.font = G.font(700, 7);
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

  // ---------- 小さなキャンバスのキャッシュ ----------
  // DOM の <img> にも、Canvas の drawImage にも使える。描画は1回だけ。
  const cvCache = new Map();
  art.cached = (key, size, draw) => {
    const k = key + '@' + size;
    let c = cvCache.get(k);
    if (c) return c;
    c = document.createElement('canvas');
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    c.width = c.height = Math.max(1, Math.round(size * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    draw(g, size);
    if (cvCache.size > 500) cvCache.clear();
    cvCache.set(k, c);
    return c;
  };
  art.url = (c) => c._url || (c._url = c.toDataURL());

  // ---------- 似顔絵（DOM 用） ----------
  art.portraitCanvas = (look, size = 64, key) => art.cached('p:' + (key || JSON.stringify(look)), size, (ctx, sz) => {
    const s = sz / 26;
    ctx.translate(sz / 2 - s * 0.8, sz * 1.64);
    ctx.scale(s, s);
    art.person(ctx, look, { t: 0.8, state: 'stand', facing: 1, noShadow: true });
  });
  art.portrait = (look, size = 64, key) => art.url(art.portraitCanvas(look, size, key));

  // ---------- 受付のリナ（表情つきの立ち絵・胸から上） ----------
  //  expr: smile / happy / wink / surprise / worry / proud
  art.RINA_EXPR = ['smile', 'happy', 'wink', 'surprise', 'worry', 'proud'];
  art.rinaCanvas = (size = 96, expr = 'smile', bg = true) => art.cached('rina:' + expr + (bg ? '' : ':n'), size, (ctx, sz) => {
    const u = sz / 100;
    ctx.scale(u, u);
    if (bg) {
      const g = ctx.createLinearGradient(0, 0, 0, 100);
      g.addColorStop(0, '#2c4a7a');
      g.addColorStop(1, '#152444');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 100, 100);
      const rg = ctx.createRadialGradient(50, 40, 4, 50, 40, 60);
      rg.addColorStop(0, 'rgba(255,214,140,0.45)');
      rg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, 100, 100);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,240,200,${0.25 + G.hash(i * 3) * 0.4})`; ctx.fillRect(G.hash(i) * 100, G.hash(i * 7) * 50, 1.2, 1.2); }
    }
    const HAIR = '#8a4a2a', HAIR_D = '#6a3418', HAIR_L = '#b06a3a', SKIN = '#f8dcc2', SKIN_D = '#ecc0a0';
    const VEST = '#3f8f6e', VEST_D = '#2f6f55', BLOUSE = '#fbf6ec';
    // ポニーテール（後ろ）
    poly(ctx, [66, 26, 80, 30, 88, 46, 86, 64, 80, 72, 76, 58, 72, 42], HAIR_D);
    poly(ctx, [70, 28, 82, 34, 86, 50, 82, 62, 78, 50, 74, 38], HAIR);
    // 後ろ髪
    poly(ctx, [26, 34, 28, 22, 40, 13, 56, 11, 70, 18, 76, 32, 76, 58, 70, 66, 30, 66, 24, 56], HAIR_D);
    // 体：ブラウスとベスト
    poly(ctx, [14, 100, 18, 80, 30, 70, 44, 66, 56, 66, 70, 70, 82, 80, 86, 100], VEST);
    poly(ctx, [14, 100, 18, 80, 30, 70, 44, 66, 50, 70, 50, 100], G.shade(VEST, 0.08));
    poly(ctx, [40, 66, 60, 66, 58, 76, 50, 90, 42, 76], BLOUSE);
    poly(ctx, [40, 66, 50, 74, 44, 80, 36, 70], '#ffffff');
    poly(ctx, [60, 66, 50, 74, 56, 80, 64, 70], '#ece6da');
    poly(ctx, [36, 74, 42, 76, 50, 92, 46, 100, 30, 100, 28, 84], VEST_D);
    poly(ctx, [64, 74, 58, 76, 50, 92, 54, 100, 70, 100, 72, 84], VEST_D);
    // リボンタイ
    poly(ctx, [50, 72, 43, 69, 42, 77], '#d4493a');
    poly(ctx, [50, 72, 57, 69, 58, 77], '#b83a2e');
    facet(ctx, 50, 72.5, 2.2, 2.2, 6, '#e85a48', 0, 0.1);
    poly(ctx, [48.5, 74, 51.5, 74, 53, 84, 50, 82, 47, 84], '#c4402f');
    // ギルドの紋章（ランタン）
    facet(ctx, 33, 85, 3.6, 3.6, 8, '#e8bd4c', 0.2, 0.2);
    poly(ctx, [31.6, 83.4, 34.4, 83.4, 34.8, 86.8, 31.2, 86.8], '#fff0b0');
    // 首
    poly(ctx, [44, 58, 56, 58, 56, 68, 50, 70, 44, 68], SKIN_D);
    // 顔
    poly(ctx, [30, 36, 31, 50, 36, 59, 44, 64, 50, 65, 56, 64, 64, 59, 69, 50, 70, 36, 64, 22, 50, 17, 36, 22], SKIN);
    poly(ctx, [50, 65, 56, 64, 64, 59, 69, 50, 70, 36, 66, 46, 60, 56], SKIN_D);
    // ほっぺ
    ctx.fillStyle = expr === 'surprise' || expr === 'worry' ? 'rgba(255,140,150,0.28)' : 'rgba(255,120,130,0.42)';
    ctx.beginPath(); ctx.ellipse(37, 51, 4.6, 2.6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(63, 51, 4.6, 2.6, 0, 0, TAU); ctx.fill();
    // 目
    const eye = (x, kind, flip) => {
      if (kind === 'closed') {
        ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 4.4, 44); ctx.quadraticCurveTo(x, 39.5, x + 4.4, 44); ctx.stroke();
        return;
      }
      if (kind === 'line') {
        ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 4.4, 42.4); ctx.quadraticCurveTo(x, 45.6, x + 4.4, 42.4); ctx.stroke();
        return;
      }
      const big = kind === 'round';
      const h = big ? 6.4 : 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x, 43, 4.2, h, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a3420';
      ctx.beginPath(); ctx.ellipse(x + (flip ? -0.3 : 0.3), 43.6, big ? 2.2 : 3.4, big ? 3 : 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1408';
      ctx.beginPath(); ctx.ellipse(x + (flip ? -0.3 : 0.3), 44.2, big ? 1.2 : 2, big ? 1.8 : 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x - 1.1, 41.2, 1.4, 1.7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 1.4, 46, 0.7, 0.8, 0, 0, TAU); ctx.fill();
      // まつげ
      ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 4.8, 39.6); ctx.quadraticCurveTo(x, 35.8 - (big ? 1 : 0), x + 4.8, 39.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + (flip ? -4.6 : 4.6), 39.6); ctx.lineTo(x + (flip ? -6.2 : 6.2), 38.4); ctx.stroke();
    };
    const L = { smile: ['open', 'open'], happy: ['closed', 'closed'], wink: ['open', 'line'], surprise: ['round', 'round'], worry: ['open', 'open'], proud: ['line', 'line'] }[expr] || ['open', 'open'];
    eye(40.5, L[0], true);
    eye(59.5, L[1], false);
    // 眉
    ctx.strokeStyle = HAIR_D; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    const bw = expr === 'worry' ? [[36, 34, 44, 31.6], [56, 31.6, 64, 34]] : expr === 'surprise' ? [[36, 31, 44, 30], [56, 30, 64, 31]] : [[36, 33.4, 44, 32.6], [56, 32.6, 64, 33.4]];
    bw.forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
    // 口
    ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 1.4;
    if (expr === 'happy') {
      poly(ctx, [45.5, 53, 54.5, 53, 52.6, 57.6, 47.4, 57.6], '#a83a32');
      poly(ctx, [47.6, 56.2, 52.4, 56.2, 51.6, 57.6, 48.4, 57.6], '#f08a8a');
    } else if (expr === 'surprise') {
      ctx.fillStyle = '#a83a32'; ctx.beginPath(); ctx.ellipse(50, 55.4, 2.2, 2.8, 0, 0, TAU); ctx.fill();
    } else if (expr === 'worry') {
      ctx.beginPath(); ctx.moveTo(46.6, 56); ctx.quadraticCurveTo(50, 53.8, 53.4, 56); ctx.stroke();
    } else if (expr === 'proud') {
      ctx.beginPath(); ctx.moveTo(45.6, 54); ctx.quadraticCurveTo(50, 57.4, 54.6, 53.4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(46, 54); ctx.quadraticCurveTo(50, 57.6, 54, 54); ctx.stroke();
    }
    if (expr === 'worry') { ctx.fillStyle = 'rgba(160,210,255,0.85)'; ctx.beginPath(); ctx.moveTo(68, 34); ctx.quadraticCurveTo(71, 39, 68.6, 41); ctx.quadraticCurveTo(66, 39, 68, 34); ctx.fill(); }
    // 前髪
    poly(ctx, [28, 40, 28, 26, 36, 16, 50, 12, 64, 16, 72, 26, 72, 40, 68, 30, 64, 34, 60, 26, 54, 32, 50, 24, 44, 32, 40, 26, 34, 34, 32, 30], HAIR);
    poly(ctx, [36, 16, 50, 12, 58, 14, 50, 18, 42, 22], HAIR_L);
    poly(ctx, [28, 40, 28, 26, 32, 30, 32, 48, 30, 54], HAIR_D);
    poly(ctx, [72, 40, 72, 26, 68, 30, 68, 48, 70, 54], HAIR_D);
    // アホ毛
    ctx.strokeStyle = HAIR; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(50, 12.5); ctx.quadraticCurveTo(54, 4, 60, 7); ctx.stroke();
    // リボン
    poly(ctx, [68, 22, 78, 14, 82, 24, 74, 28], '#d4493a');
    poly(ctx, [68, 22, 70, 32, 62, 34, 64, 26], '#b83a2e');
    facet(ctx, 69, 25, 3, 3, 6, '#e8bd4c', 0.3, 0.2);
    // ウインクの星
    if (expr === 'wink') star(ctx, 68, 40, 2.6, '#ffe28a');
    if (expr === 'happy' || expr === 'proud') { star(ctx, 22, 26, 2.2, '#ffe28a'); star(ctx, 80, 50, 1.6, '#fff4c0'); }
  });
  art.rina = (size = 96, expr = 'smile', bg = true) => art.url(art.rinaCanvas(size, expr, bg));

  // ギルドの猫ミケ
  art.catCanvas = (size) => art.cached('cat', size, (ctx, sz) => {
    const u = sz / 40;
    ctx.scale(u, u);
    ctx.fillStyle = '#2a3550';
    ctx.fillRect(0, 0, 40, 40);
    poly(ctx, [8, 30, 6, 10, 15, 17], '#f2a65a');
    poly(ctx, [32, 30, 34, 10, 25, 17], '#3a2a22');
    poly(ctx, [9, 25, 8.5, 13, 13.5, 17.5], '#f6c8c0');
    facet(ctx, 20, 26, 14, 11.5, 9, '#fff4e6', 0.2, 0.08);
    poly(ctx, [6, 26, 12, 16, 20, 15, 18, 26, 10, 34], '#f2a65a');
    poly(ctx, [34, 26, 28, 16, 22, 16, 23, 25, 30, 34], '#3a2a22');
    ellipse(ctx, 15, 25, 1.6, 2.2, '#2b1d17');
    ellipse(ctx, 25, 25, 1.6, 2.2, '#2b1d17');
    ellipse(ctx, 15.5, 24.2, 0.5, 0.6, '#fff');
    ellipse(ctx, 25.5, 24.2, 0.5, 0.6, '#fff');
    poly(ctx, [19, 28, 21, 28, 20, 29.4], '#e88a8a');
    ctx.strokeStyle = '#2b1d17';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(20, 29.4); ctx.quadraticCurveTo(18.5, 31.4, 17, 30.4); ctx.moveTo(20, 29.4); ctx.quadraticCurveTo(21.5, 31.4, 23, 30.4); ctx.stroke();
  });

  // 名前の頭文字（旅人など）
  art.letterCanvas = (name, size) => art.cached('l:' + name, size, (ctx, sz) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360;
    const g = ctx.createLinearGradient(0, 0, 0, sz);
    g.addColorStop(0, `hsl(${hue},38%,46%)`);
    g.addColorStop(1, `hsl(${(hue + 30) % 360},42%,28%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sz, sz);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = G.font(800, sz * 0.46, 'head');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.replace(/^.*の/, '').slice(0, 1), sz / 2, sz / 2 + sz * 0.03);
  });

  // ギルドの紋章（マスター＝あなた）
  art.crestCanvas = (size) => art.cached('crest', size, (ctx, sz) => {
    const u = sz / 40;
    ctx.scale(u, u);
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, '#22345e');
    g.addColorStop(1, '#0f1a33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    poly(ctx, [20, 5, 32, 9, 31, 22, 20, 34, 9, 22, 8, 9], '#e8bd4c');
    poly(ctx, [20, 7.5, 29.6, 10.6, 28.8, 21.2, 20, 31, 11.2, 21.2, 10.4, 10.6], '#1a2a4e');
    poly(ctx, [17, 13, 23, 13, 24.5, 16, 24.5, 24, 15.5, 24, 15.5, 16], '#ffd36a');
    poly(ctx, [18, 15.5, 22, 15.5, 22.6, 17, 22.6, 22.4, 17.4, 22.4, 17.4, 17], '#fff4c8');
    poly(ctx, [16.5, 11.6, 23.5, 11.6, 23, 13, 17, 13], '#c8901e');
    poly(ctx, [15, 24, 25, 24, 24, 25.6, 16, 25.6], '#c8901e');
  });

  // 閃き（電球）
  art.bulb = (ctx, x, y, r, glow = 1, t = 0) => {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.2, r * 3.2);
    g.addColorStop(0, `rgba(255,248,190,${0.75 * glow})`);
    g.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 3.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 0.6;
      const r1 = r * 1.5, r2 = r * (2.1 + 0.25 * Math.sin(t * 9 + i));
      ctx.strokeStyle = `rgba(255,236,140,${0.9 * glow})`;
      ctx.lineWidth = r * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - r * 0.2); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 - r * 0.2); ctx.stroke();
    }
    facet(ctx, 0, -r * 0.25, r, r * 1.05, 10, '#fff2a0', 0.3, 0.16);
    poly(ctx, [-r * 0.42, r * 0.62, r * 0.42, r * 0.62, r * 0.36, r * 1.15, -r * 0.36, r * 1.15], '#9aa2b0');
    poly(ctx, [-r * 0.36, r * 0.8, r * 0.36, r * 0.8, r * 0.36, r * 0.9, -r * 0.36, r * 0.9], '#6c7480');
    poly(ctx, [-r * 0.45, -r * 0.7, -r * 0.1, -r * 0.95, -r * 0.3, -r * 0.4], 'rgba(255,255,255,0.8)');
    ctx.restore();
  };

  // ---------- レア度の色 ----------
  art.RARITY_COL = [
    { metal: '#cfd3da', dark: '#7a808a', accent: '#b08a5a', glow: '#f2ead8', name: 'N' },
    { metal: '#dcefff', dark: '#5a8ac0', accent: '#4f8de0', glow: '#9fd0ff', name: 'R' },
    { metal: '#f2e4ff', dark: '#8858c8', accent: '#c27cff', glow: '#d8a8ff', name: 'SR' },
    { metal: '#fff4c8', dark: '#c48c1c', accent: '#ffc83a', glow: '#ffe27a', name: 'SSR' },
    { metal: '#ffffff', dark: '#b878c8', accent: '#ff7ab8', glow: '#ffffff', name: 'UR' },
  ];
  const rainbow = (t, i = 0, l = 66) => `hsl(${(t * 140 + i * 47) % 360},92%,${l}%)`;
  art.rainbow = rainbow;
  const rc = (rank, key, t) => (rank === 4 && key === 'accent' ? rainbow(t) : art.RARITY_COL[rank][key]);

  // ---------- 装備・秘宝のアイコン（中心 0,0 ・ 大きさ s） ----------
  art.itemIcon = (ctx, item, s, t = 0) => {
    if (item.kind === 'cons') { art.consIcon(ctx, item.id, s, t); return; }
    const u = s / 2;
    const r = item.rarity || 0;
    const metal = rc(r, 'metal', t), dark = rc(r, 'dark', t), acc = rc(r, 'accent', t);
    ctx.save();
    ctx.scale(u, u);
    const wood = '#8a5a32', leather = '#5a3a26';
    const id = item.kind === 'relic' ? 'relic:' + item.rid : (G.items && G.items.EQUIP[item.tid] ? G.items.EQUIP[item.tid].icon : 'sword');
    switch (id) {
      case 'sword':
        ctx.rotate(Math.PI / 4);
        poly(ctx, [-0.09, 0.3, 0.09, 0.3, 0.1, -0.78, 0, -0.98, -0.1, -0.78], metal);
        poly(ctx, [0, 0.3, 0.09, 0.3, 0.1, -0.78, 0, -0.98], dark);
        poly(ctx, [-0.012, 0.22, 0.012, 0.22, 0.012, -0.8, -0.012, -0.8], 'rgba(255,255,255,0.7)');
        poly(ctx, [-0.34, 0.26, 0.34, 0.26, 0.38, 0.36, -0.38, 0.36], acc);
        poly(ctx, [-0.06, 0.36, 0.06, 0.36, 0.06, 0.72, -0.06, 0.72], leather);
        facet(ctx, 0, 0.78, 0.1, 0.1, 6, acc, 0, 0.25);
        break;
      case 'dagger':
        ctx.rotate(Math.PI / 4);
        poly(ctx, [-0.12, 0.12, 0.12, 0.12, 0.08, -0.5, -0.02, -0.8, -0.1, -0.45], metal);
        poly(ctx, [0, 0.12, 0.12, 0.12, 0.08, -0.5, -0.02, -0.8], dark);
        poly(ctx, [-0.3, 0.1, 0.3, 0.1, 0.24, 0.2, -0.24, 0.2], acc);
        poly(ctx, [-0.06, 0.2, 0.06, 0.2, 0.06, 0.55, -0.06, 0.55], leather);
        facet(ctx, 0, 0.6, 0.09, 0.09, 6, acc, 0, 0.25);
        break;
      case 'staff':
        ctx.rotate(Math.PI / 4);
        poly(ctx, [-0.05, 0.95, 0.05, 0.95, 0.05, -0.5, -0.05, -0.5], wood);
        poly(ctx, [0, 0.95, 0.05, 0.95, 0.05, -0.5, 0, -0.5], G.shade(wood, -0.2));
        poly(ctx, [-0.22, -0.48, -0.06, -0.5, -0.1, -0.86, -0.26, -0.72], dark);
        poly(ctx, [0.22, -0.48, 0.06, -0.5, 0.1, -0.86, 0.26, -0.72], dark);
        ctx.fillStyle = G.rgba(r === 4 ? '#ffffff' : acc.startsWith('#') ? acc : '#ffffff', 0.3);
        ctx.beginPath(); ctx.arc(0, -0.7, 0.3, 0, TAU); ctx.fill();
        facet(ctx, 0, -0.7, 0.17, 0.17, 6, acc.startsWith('#') ? acc : '#ffd0f0', t, 0.28);
        break;
      case 'mace':
        ctx.rotate(Math.PI / 4);
        poly(ctx, [-0.05, 0.9, 0.05, 0.9, 0.05, -0.3, -0.05, -0.3], wood);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          poly(ctx, [Math.cos(a - 0.3) * 0.2, -0.55 + Math.sin(a - 0.3) * 0.2, Math.cos(a) * 0.38, -0.55 + Math.sin(a) * 0.38, Math.cos(a + 0.3) * 0.2, -0.55 + Math.sin(a + 0.3) * 0.2], dark);
        }
        facet(ctx, 0, -0.55, 0.24, 0.24, 8, metal, 0.2, 0.25);
        facet(ctx, 0, -0.55, 0.08, 0.08, 6, acc.startsWith('#') ? acc : '#ffd0f0', t, 0.2);
        poly(ctx, [-0.12, 0.92, 0.12, 0.92, 0.1, 1, -0.1, 1], acc.startsWith('#') ? acc : '#fff');
        break;
      case 'bow':
        ctx.rotate(-Math.PI / 4);
        ctx.strokeStyle = wood; ctx.lineWidth = 0.13; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-0.35, 0, 0.82, -1.15, 1.15); ctx.stroke();
        ctx.strokeStyle = acc.startsWith('#') ? acc : rainbow(t); ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.arc(-0.35, 0, 0.82, -0.25, 0.25); ctx.stroke();
        ctx.strokeStyle = 'rgba(245,240,225,0.9)'; ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.moveTo(-0.35 + Math.cos(-1.15) * 0.82, Math.sin(-1.15) * 0.82); ctx.lineTo(-0.35 + Math.cos(1.15) * 0.82, Math.sin(1.15) * 0.82); ctx.stroke();
        poly(ctx, [-0.05, -0.02, 0.62, -0.02, 0.62, 0.02, -0.05, 0.02], '#d8c8a8');
        poly(ctx, [0.6, -0.08, 0.82, 0, 0.6, 0.08], metal);
        break;
      case 'lance':
        ctx.rotate(Math.PI / 4);
        poly(ctx, [-0.05, 0.95, 0.05, 0.95, 0.05, -0.3, -0.05, -0.3], wood);
        poly(ctx, [-0.12, -0.3, 0.12, -0.3, 0.04, -0.98, -0.04, -0.98], metal);
        poly(ctx, [0, -0.3, 0.12, -0.3, 0.04, -0.98, 0, -0.98], dark);
        poly(ctx, [-0.26, 0.3, 0.26, 0.3, 0.12, -0.3, -0.12, -0.3], metal);
        poly(ctx, [0, 0.3, 0.26, 0.3, 0.12, -0.3, 0, -0.3], dark);
        poly(ctx, [0.05, -0.24, 0.42, -0.1, 0.38, 0.06, 0.05, -0.04], acc.startsWith('#') ? acc : rainbow(t));
        break;
      case 'lute':
        ctx.rotate(-Math.PI / 5);
        facet(ctx, 0, 0.32, 0.48, 0.52, 10, wood, 0.2, 0.18);
        facet(ctx, 0, 0.36, 0.14, 0.14, 6, '#3a2418', 0, 0.1);
        poly(ctx, [-0.08, -0.16, 0.08, -0.16, 0.07, -0.86, -0.07, -0.86], G.shade(wood, -0.2));
        poly(ctx, [-0.14, -0.86, 0.14, -0.86, 0.1, -1, -0.1, -1], dark);
        ctx.strokeStyle = acc.startsWith('#') ? acc : rainbow(t); ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.moveTo(-0.04, -0.86); ctx.lineTo(-0.05, 0.7); ctx.moveTo(0.04, -0.86); ctx.lineTo(0.05, 0.7); ctx.stroke();
        poly(ctx, [-0.2, 0.62, 0.2, 0.62, 0.16, 0.7, -0.16, 0.7], metal);
        break;
      case 'flask':
        poly(ctx, [-0.16, -0.5, 0.16, -0.5, 0.16, -0.18, 0.56, 0.62, -0.56, 0.62, -0.16, -0.18], 'rgba(220,240,255,0.35)');
        poly(ctx, [-0.3, 0.12, 0.3, 0.12, 0.5, 0.56, -0.5, 0.56], acc.startsWith('#') ? acc : rainbow(t));
        poly(ctx, [-0.3, 0.12, 0, 0.12, 0, 0.56, -0.5, 0.56], 'rgba(255,255,255,0.3)');
        poly(ctx, [-0.2, -0.62, 0.2, -0.62, 0.2, -0.5, -0.2, -0.5], metal);
        poly(ctx, [-0.12, -0.78, 0.12, -0.78, 0.12, -0.62, -0.12, -0.62], wood);
        facet(ctx, 0.18, 0.32, 0.06, 0.06, 6, '#ffffff', 0, 0.1);
        facet(ctx, -0.14, 0.26, 0.04, 0.04, 6, '#ffffff', 0, 0.1);
        break;
      case 'armor':
        facetPoly(ctx, [-0.62, -0.5, -0.24, -0.66, 0, -0.5, 0.24, -0.66, 0.62, -0.5, 0.52, 0.1, 0.4, 0.72, 0, 0.86, -0.4, 0.72, -0.52, 0.1], metal, 0.18);
        poly(ctx, [-0.24, -0.66, 0, -0.5, 0.24, -0.66, 0.14, -0.38, -0.14, -0.38], dark);
        poly(ctx, [-0.04, -0.36, 0.04, -0.36, 0.04, 0.8, -0.04, 0.8], dark);
        facet(ctx, -0.62, -0.42, 0.24, 0.2, 6, dark, 0, 0.2);
        facet(ctx, 0.62, -0.42, 0.24, 0.2, 6, dark, 0, 0.2);
        facet(ctx, 0, 0.05, 0.14, 0.14, 6, acc.startsWith('#') ? acc : '#ffd0f0', t, 0.25);
        break;
      case 'robe':
        facetPoly(ctx, [-0.32, -0.78, 0.32, -0.78, 0.5, -0.4, 0.62, 0.86, 0.12, 0.92, 0, 0.6, -0.12, 0.92, -0.62, 0.86, -0.5, -0.4], dark, 0.16);
        poly(ctx, [-0.18, -0.78, 0.18, -0.78, 0.08, -0.2, -0.08, -0.2], metal);
        poly(ctx, [-0.5, -0.4, -0.8, 0.2, -0.62, 0.3, -0.42, -0.1], dark);
        poly(ctx, [0.5, -0.4, 0.8, 0.2, 0.62, 0.3, 0.42, -0.1], G.shade(dark.startsWith('#') ? dark : '#888888', -0.15));
        poly(ctx, [-0.56, 0.7, 0.56, 0.7, 0.6, 0.86, -0.6, 0.86], acc.startsWith('#') ? acc : rainbow(t));
        facet(ctx, 0, -0.1, 0.1, 0.1, 6, acc.startsWith('#') ? acc : '#ffd0f0', t, 0.25);
        break;
      case 'ring':
        ctx.strokeStyle = metal; ctx.lineWidth = 0.2;
        ctx.beginPath(); ctx.ellipse(0, 0.22, 0.5, 0.42, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.ellipse(0, 0.22, 0.5, 0.42, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        poly(ctx, [-0.22, -0.2, 0.22, -0.2, 0.16, -0.38, -0.16, -0.38], dark);
        facet(ctx, 0, -0.5, 0.26, 0.24, 6, acc.startsWith('#') ? acc : rainbow(t), Math.PI / 6, 0.32);
        poly(ctx, [-0.1, -0.6, 0.02, -0.66, -0.04, -0.5], 'rgba(255,255,255,0.8)');
        break;
      case 'charm':
        ctx.strokeStyle = metal; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(-0.5, -0.8); ctx.quadraticCurveTo(0, 0.1, 0.5, -0.8); ctx.stroke();
        facet(ctx, 0, 0.25, 0.42, 0.5, 6, dark, Math.PI / 2, 0.15);
        facet(ctx, 0, 0.25, 0.3, 0.38, 6, acc.startsWith('#') ? acc : rainbow(t), Math.PI / 2, 0.3);
        poly(ctx, [-0.12, 0.05, 0.02, -0.02, -0.06, 0.18], 'rgba(255,255,255,0.75)');
        break;
      case 'relic:map':
        facetPoly(ctx, [-0.8, -0.55, 0.75, -0.62, 0.8, 0.58, -0.76, 0.64], '#ecd9a8', 0.08);
        ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.08]);
        ctx.beginPath(); ctx.moveTo(-0.55, 0.35); ctx.quadraticCurveTo(-0.1, -0.4, 0.4, 0.05); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#c4553a'; ctx.lineWidth = 0.09;
        ctx.beginPath(); ctx.moveTo(0.3, -0.05); ctx.lineTo(0.5, 0.15); ctx.moveTo(0.5, -0.05); ctx.lineTo(0.3, 0.15); ctx.stroke();
        break;
      case 'relic:bell':
        poly(ctx, [-0.08, -0.85, 0.08, -0.85, 0.08, -0.65, -0.08, -0.65], '#9aa2b0');
        facetPoly(ctx, [0, -0.7, 0.36, -0.5, 0.46, 0.2, 0.66, 0.5, -0.66, 0.5, -0.46, 0.2, -0.36, -0.5], '#dfe5ee', 0.2);
        facet(ctx, 0, 0.62, 0.14, 0.14, 6, '#9aa2b0', 0, 0.2);
        break;
      case 'relic:mug':
        facetPoly(ctx, [-0.5, -0.5, 0.42, -0.5, 0.38, 0.75, -0.46, 0.75], '#f2b632', 0.18);
        poly(ctx, [-0.56, -0.66, 0.48, -0.66, 0.42, -0.42, -0.5, -0.42], '#fff6dc');
        ctx.strokeStyle = '#c8901e'; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(0.52, 0.1, 0.24, -1.4, 1.4); ctx.stroke();
        break;
      case 'relic:harp':
        ctx.strokeStyle = '#e8bd4c'; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-0.5, 0.75); ctx.quadraticCurveTo(-0.7, -0.6, 0, -0.8); ctx.quadraticCurveTo(0.6, -0.6, 0.5, 0.75); ctx.lineTo(-0.5, 0.75); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.025;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.16, -0.55 + Math.abs(i) * 0.06); ctx.lineTo(i * 0.16, 0.7); ctx.stroke(); }
        break;
      case 'relic:grail':
        facetPoly(ctx, [-0.6, -0.65, 0.6, -0.65, 0.42, -0.05, 0.1, 0.12, -0.1, 0.12, -0.42, -0.05], '#ffd45a', 0.2);
        poly(ctx, [-0.08, 0.1, 0.08, 0.1, 0.1, 0.6, -0.1, 0.6], '#e0a32a');
        poly(ctx, [-0.42, 0.6, 0.42, 0.6, 0.34, 0.8, -0.34, 0.8], '#ffd45a');
        facet(ctx, 0, -0.35, 0.12, 0.12, 6, '#ff5a5a', 0, 0.2);
        ctx.fillStyle = 'rgba(255,240,180,0.45)';
        ctx.beginPath(); ctx.ellipse(0, -0.68, 0.55, 0.1, 0, 0, TAU); ctx.fill();
        break;
      case 'relic:scale':
        facetPoly(ctx, [0, -0.85, 0.6, -0.1, 0.3, 0.75, -0.3, 0.75, -0.6, -0.1], '#d8452e', 0.24);
        poly(ctx, [0, -0.85, 0.2, -0.1, 0, 0.75, -0.2, -0.1], '#ff7a5a');
        break;
      case 'relic:lantern':
        ctx.fillStyle = 'rgba(255,200,100,0.35)';
        ctx.beginPath(); ctx.arc(0, 0.1, 0.8, 0, TAU); ctx.fill();
        poly(ctx, [-0.06, -0.95, 0.06, -0.95, 0.06, -0.72, -0.06, -0.72], '#5a3a26');
        poly(ctx, [-0.44, -0.72, 0.44, -0.72, 0.36, -0.56, -0.36, -0.56], '#5a3a26');
        poly(ctx, [-0.34, -0.56, 0.34, -0.56, 0.4, 0.62, -0.4, 0.62], '#ffd36a');
        poly(ctx, [-0.2, -0.4, 0.2, -0.4, 0.24, 0.48, -0.24, 0.48], '#fff4c8');
        poly(ctx, [-0.5, 0.62, 0.5, 0.62, 0.44, 0.8, -0.44, 0.8], '#5a3a26');
        break;
      default:
        facet(ctx, 0, 0, 0.6, 0.6, 6, acc.startsWith('#') ? acc : '#fff', 0, 0.2);
    }
    ctx.restore();
  };

  // ---------- 持ち物のアイコン（中心 0,0 ・ 大きさ s） ----------
  art.consIcon = (ctx, id, s, t = 0) => {
    const def = G.items && G.items.CONS[id];
    if (def) id = def.icon;
    ctx.save();
    ctx.scale(s / 2, s / 2);
    switch (id) {
      case 'hourglass':
      case 'hourglass3': {
        const sand = id === 'hourglass3' ? '#ffd36a' : '#7fd0ff';
        poly(ctx, [-0.56, -0.86, 0.56, -0.86, 0.5, -0.72, -0.5, -0.72], '#8a5a32');
        poly(ctx, [-0.56, 0.86, 0.56, 0.86, 0.5, 0.72, -0.5, 0.72], '#8a5a32');
        poly(ctx, [-0.42, -0.72, 0.42, -0.72, 0.08, 0, 0.42, 0.72, -0.42, 0.72, -0.08, 0], 'rgba(220,240,255,0.35)');
        poly(ctx, [-0.3, -0.56, 0.3, -0.56, 0.06, -0.06, -0.06, -0.06], sand);
        poly(ctx, [-0.34, 0.72, 0.34, 0.72, 0.1, 0.32, -0.1, 0.32], sand);
        poly(ctx, [-0.02, -0.06, 0.02, -0.06, 0.02, 0.4, -0.02, 0.4], sand);
        poly(ctx, [-0.62, -0.72, -0.5, -0.72, -0.5, 0.72, -0.62, 0.72], '#c8a060');
        poly(ctx, [0.5, -0.72, 0.62, -0.72, 0.62, 0.72, 0.5, 0.72], '#a07a40');
        if (id === 'hourglass3') star(ctx, 0.56, -0.62, 0.22, '#fff6c0');
        break;
      }
      case 'scroll':
        poly(ctx, [-0.6, -0.5, 0.6, -0.5, 0.6, 0.5, -0.6, 0.5], '#f0e0b8');
        ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 0.05;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-0.4, i * 0.22); ctx.lineTo(0.4, i * 0.22); ctx.stroke(); }
        facet(ctx, -0.66, 0, 0.16, 0.56, 6, '#a0703c', 0, 0.2);
        facet(ctx, 0.66, 0, 0.16, 0.56, 6, '#a0703c', 0, 0.2);
        poly(ctx, [0.05, 0.3, 0.35, 0.3, 0.2, 0.62], '#d4493a');
        break;
      case 'coinbag':
        facetPoly(ctx, [-0.5, 0.82, 0.5, 0.82, 0.66, 0.2, 0.3, -0.36, -0.3, -0.36, -0.66, 0.2], '#c48a3a', 0.18);
        poly(ctx, [-0.3, -0.36, 0.3, -0.36, 0.42, -0.62, -0.42, -0.62], '#a06a2a');
        poly(ctx, [-0.34, -0.42, 0.34, -0.42, 0.34, -0.32, -0.34, -0.32], '#ffd45a');
        art.coin(ctx, 0, 0.3, 0.3, 0);
        break;
      case 'clover':
        [0, 1, 2, 3].forEach((i) => { const a = i * Math.PI / 2 + Math.PI / 4; facet(ctx, Math.cos(a) * 0.3, Math.sin(a) * 0.3 - 0.1, 0.28, 0.28, 7, i % 2 ? '#5cc06a' : '#4aa85a', a, 0.2); });
        ctx.strokeStyle = '#3a8a4a'; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.moveTo(0, -0.1); ctx.quadraticCurveTo(0.1, 0.5, 0.35, 0.85); ctx.stroke();
        break;
      case 'horn':
        ctx.strokeStyle = '#c8901e'; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.moveTo(-0.62, 0.3); ctx.quadraticCurveTo(-0.2, 0.78, 0.4, 0.42); ctx.stroke();
        facetPoly(ctx, [-0.78, 0.18, -0.5, 0.02, 0.1, -0.2, 0.52, -0.62, 0.78, -0.38, 0.44, 0.06, -0.1, 0.34, -0.56, 0.46], '#f2e2c0', 0.18);
        poly(ctx, [0.52, -0.62, 0.86, -0.74, 0.92, -0.34, 0.78, -0.38], '#e8bd4c');
        poly(ctx, [-0.86, 0.12, -0.72, 0.06, -0.62, 0.48, -0.78, 0.5], '#e8bd4c');
        [[-0.3, 0.12], [0.1, -0.06], [0.42, -0.3]].forEach(([x, y]) => poly(ctx, [x - 0.05, y - 0.12, x + 0.05, y - 0.16, x + 0.09, y + 0.12, x - 0.01, y + 0.16], '#c8901e'));
        break;
      case 'key':
        ctx.strokeStyle = '#e8bd4c'; ctx.lineWidth = 0.16;
        ctx.beginPath(); ctx.arc(-0.36, -0.36, 0.28, 0, TAU); ctx.stroke();
        poly(ctx, [-0.2, -0.28, -0.08, -0.4, 0.78, 0.46, 0.66, 0.58], '#e8bd4c');
        poly(ctx, [0.38, 0.3, 0.5, 0.18, 0.66, 0.34, 0.54, 0.46], '#c8901e');
        poly(ctx, [0.58, 0.5, 0.7, 0.38, 0.86, 0.54, 0.74, 0.66], '#c8901e');
        facet(ctx, -0.36, -0.36, 0.1, 0.1, 6, '#ff6a5a', 0, 0.2);
        break;
      case 'stone':
        facetPoly(ctx, [-0.2, -0.78, 0.46, -0.5, 0.7, 0.2, 0.26, 0.76, -0.5, 0.62, -0.72, -0.06], '#7f8ca8', 0.24);
        poly(ctx, [-0.2, -0.78, 0.46, -0.5, 0.1, -0.2, -0.36, -0.3], '#b8c4dc');
        ctx.strokeStyle = '#9ff0ff'; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(-0.3, 0.1); ctx.lineTo(0.05, -0.05); ctx.lineTo(0.3, 0.35); ctx.stroke();
        break;
      case 'book':
      case 'book2': {
        const cv = id === 'book' ? '#6a3fa0' : '#2f6f55';
        facetPoly(ctx, [-0.62, -0.74, 0.5, -0.74, 0.62, -0.62, 0.62, 0.8, -0.5, 0.8, -0.62, 0.68], cv, 0.14);
        poly(ctx, [-0.5, 0.68, 0.62, 0.68, 0.62, 0.8, -0.5, 0.8], '#f2e6c8');
        poly(ctx, [-0.62, -0.74, -0.46, -0.74, -0.46, 0.68, -0.62, 0.68], G.shade(cv, -0.3));
        if (id === 'book') art.bulb(ctx, 0.08, -0.06, 0.24, 0.6, t);
        else star(ctx, 0.08, -0.04, 0.32, '#ffd36a');
        break;
      }
      case 'shard': {
        // 虹の欠片：面ごとに色の違う、細長い水晶
        const pts = [[0, -0.92], [0.42, -0.36], [0.3, 0.62], [0, 0.9], [-0.34, 0.5], [-0.44, -0.3]];
        const hue = (i) => `hsl(${(t * 80 + i * 55) % 360},90%,${64 + (i % 2) * 10}%)`;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          poly(ctx, [0, -0.05, a[0], a[1], b[0], b[1]], hue(i));
        }
        poly(ctx, [0, -0.92, 0.42, -0.36, 0, -0.05], 'rgba(255,255,255,0.55)');
        poly(ctx, [-0.08, 0.1, 0.06, 0.08, 0, 0.7], 'rgba(255,255,255,0.35)');
        star(ctx, 0.5, -0.66, 0.2, '#ffffff');
        break;
      }
      case 'cry':
        poly(ctx, [0, -0.86, 0.6, -0.3, 0.32, 0.86, -0.32, 0.86, -0.6, -0.3], '#6f7cf0');
        poly(ctx, [0, -0.86, 0.6, -0.3, 0, -0.14], '#b9c2ff');
        poly(ctx, [0, -0.86, -0.6, -0.3, 0, -0.14], '#dfe4ff');
        poly(ctx, [-0.6, -0.3, 0, -0.14, -0.32, 0.86], '#5a66d8');
        poly(ctx, [0, -0.14, 0.32, 0.86, -0.32, 0.86], '#7f8cff');
        break;
      default:
        facet(ctx, 0, 0, 0.6, 0.6, 6, '#cccccc', 0, 0.2);
    }
    ctx.restore();
  };

  // ---------- レア度つきの宝箱 ----------
  // rank: 0=N 1=R 2=SR 3=SSR 4=UR  ・ open: 0..1
  art.chestR = (ctx, open, rank, t = 0) => {
    const P = [
      { wood: '#8a5a2e', band: '#a8946e', lock: '#d8c08a' },
      { wood: '#2f5f9a', band: '#d4e2f2', lock: '#9fd0ff' },
      { wood: '#5a2f92', band: '#e8bd4c', lock: '#ead2ff' },
      { wood: '#d39a2a', band: '#fff2c0', lock: '#ff6a5a' },
      { wood: '#7a5ae0', band: '#ffffff', lock: '#ffffff' },
    ][G.clamp(rank | 0, 0, 4)];
    const wood = rank === 4 ? `hsl(${(t * 90) % 360},62%,58%)` : P.wood;
    const C2 = (c, a) => (c.startsWith('hsl') ? c : C(c, a));
    if (open > 0) {
      ctx.save();
      ctx.translate(0, -16 - open * 9);
      ctx.scale(1, 1 - open * 0.55);
      poly(ctx, [-16, 0, 16, 0, 15, -9, 0, -12, -15, -9], C2(wood, -0.15));
      poly(ctx, [-16, 0, 16, 0, 16, -2, -16, -2], C(P.band, -0.15));
      ctx.restore();
      poly(ctx, [-15, -16, 15, -16, 13, -19 - open * 2, -13, -19 - open * 2], '#1a0e08');
      const gl = rank === 4 ? rainbow(t, 0, 80) : art.RARITY_COL[rank].glow;
      poly(ctx, [-12, -16.5, 12, -16.5, 10, -18.5 - open * 1.5, -10, -18.5 - open * 1.5], G.rgba(gl.startsWith('#') ? gl : '#fff0d0', 0.95 * open));
    }
    // 胴
    poly(ctx, [-16, 0, 16, 0, 16, -16, -16, -16], C2(wood));
    poly(ctx, [-16, 0, 0, 0, 0, -16, -16, -16], C2(wood, 0.08));
    poly(ctx, [-16, -16, 16, -16, 16, -13.5, -16, -13.5], C(P.band, -0.1));
    poly(ctx, [-16, -1.6, 16, -1.6, 16, 0, -16, 0], C(P.band, -0.25));
    poly(ctx, [-11, 0, -8, 0, -8, -16, -11, -16], C(P.band, -0.15));
    poly(ctx, [8, 0, 11, 0, 11, -16, 8, -16], C(P.band, -0.22));
    // 鋲
    [-12.8, 12.8].forEach((x) => [-4, -10].forEach((y) => ellipse(ctx, x, y, 0.8, 0.8, C(P.band, 0.2))));
    // 錠前
    poly(ctx, [-3, -14, 3, -14, 3, -6.5, 0, -5, -3, -6.5], C(P.band));
    facet(ctx, 0, -10.2, 1.6, 1.8, 6, rank === 4 ? rainbow(t + 0.5) : P.lock, t, 0.25);
    if (rank >= 3) poly(ctx, [-14, -12, -9, -12, -11.5, -6], 'rgba(255,255,255,0.18)');
    if (open <= 0) {
      ctx.save();
      ctx.translate(0, -16);
      poly(ctx, [-16, 0, 16, 0, 15, -8, 0, -11, -15, -8], C2(wood, 0.04));
      poly(ctx, [-16, 0, 0, 0, 0, -11, -15, -8], C2(wood, 0.14));
      poly(ctx, [-16, 0, 16, 0, 16, -2, -16, -2], C(P.band));
      poly(ctx, [-11, 0, -8, 0, -8, -9.2, -11, -8.4], C(P.band, -0.1));
      poly(ctx, [8, 0, 11, 0, 11, -8.4, 8, -9.2], C(P.band, -0.18));
      poly(ctx, [-2.5, 0, 2.5, 0, 2.5, -5, -2.5, -5], C(P.band, 0.1));
      if (rank >= 2) facet(ctx, 0, -7.5, 2, 1.6, 6, rank === 4 ? rainbow(t) : P.lock, 0, 0.25);
      ctx.restore();
    }
  };

})();
