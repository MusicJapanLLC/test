/* 残りの4枚：タイトル／ギルドの断面／ワールドマップ／冒険譚（戦闘） */
'use strict';
(function () {
  const SC = window.SCENES;
  const { W, H, Z, C, UI, TX } = SC;
  const h = SC.helpers;

  // =================================================================== 1. タイトル
  SC.title = function () {
    return SC.compose((c, em, L) => {
      // 夕焼けの名残りがある夜空
      PX.gradV(c, 0, 0, W, 250, ['#060818', '#0c1030', '#1a1c48', '#2e2a60', '#4a3468', '#7a4468', '#b8586a', '#e47e62', '#f6a868']);
      h.stars(c, 0, 0, W, 150, 120, 17);
      // 月
      PX.glow(c, 176, 64, 34, '#8090d0', 0.45);
      PX.ellipse(c, 176, 64, 15, 15, '#e8e4d0');
      PX.ellipse(c, 176, 64, 14, 14, '#f8f4e2');
      PX.ellipse(c, 171, 60, 3, 3, '#dcd6c0');
      PX.ellipse(c, 181, 69, 4, 3, '#dcd6c0');
      PX.ellipse(c, 179, 57, 2, 2, '#e4dec8');
      PX.dither(c, 182, 52, 10, 26, 'rgba(0,0,0,0)', '#dcd6c0', (i, j) => i / 16);
      // 薄い雲（夕焼けに染まる）
      [[20, 170, 70], [120, 186, 90], [60, 204, 60], [170, 214, 70]].forEach(([x, y, w], k) => {
        PX.rect(c, x, y, w, 2, k % 2 ? '#c86a72' : '#a85a72');
        PX.rect(c, x + 8, y - 2, w - 22, 2, k % 2 ? '#e0887a' : '#c06e7a');
        PX.hline(c, x + 14, x + w - 20, y - 2, '#f4a888');
      });
      // 遠い山脈
      const mtn = (y0, amp, col, seed, step) => {
        const rnd = PX.rng(seed);
        const pts = [0, H];
        for (let x = 0; x <= W; x += step) pts.push(x, y0 - rnd() * amp);
        pts.push(W, H);
        PX.poly(c, pts, col);
      };
      mtn(236, 34, '#3e3460', 5, 14);
      mtn(250, 24, '#2c2648', 9, 10);
      // 遠くの城
      const cx = 46, cy = 226;
      PX.rect(c, cx - 10, cy - 10, 20, 12, '#1e1a36');
      [[cx - 12, 18], [cx - 2, 26], [cx + 8, 16]].forEach(([x, hh]) => {
        PX.rect(c, x, cy - hh, 5, hh, '#1e1a36');
        PX.poly(c, [x - 1, cy - hh, x + 6, cy - hh, x + 2.5, cy - hh - 6], '#1e1a36');
      });
      em.push(() => { PX.p(c, cx, cy - 18, '#ffd46a'); PX.p(c, cx - 10, cy - 10, '#ffd46a'); PX.p(c, cx + 10, cy - 8, '#ffb050'); });
      // 町の屋根並み
      const rnd = PX.rng(44);
      for (let x = -4; x < W; ) {
        const w = 12 + Math.floor(rnd() * 14), hh = 14 + Math.floor(rnd() * 16);
        const y = 276 - Math.floor(rnd() * 6);
        PX.rect(c, x, y - hh, w, hh + 40, '#18142c');
        PX.poly(c, [x - 2, y - hh, x + w + 2, y - hh, x + w / 2, y - hh - w * 0.55], '#120f22');
        for (let k = 0; k < 3; k++) {
          if (rnd() < 0.55) {
            const wx = x + 3 + Math.floor(rnd() * (w - 5)), wy = y - hh + 4 + Math.floor(rnd() * (hh - 6));
            em.push(() => { PX.rect(c, wx, wy, 2, 2, rnd() < 0.5 ? '#ffd46a' : '#f8a848'); });
          }
        }
        x += w + 1;
      }
      // 教会の尖塔
      PX.rect(c, 192, 230, 8, 46, '#18142c');
      PX.poly(c, [190, 230, 202, 230, 196, 210], '#120f22');
      em.push(() => PX.rect(c, 195, 240, 2, 3, '#ffd46a'));
      // 手前の丘
      PX.poly(c, [0, 300, 60, 288, 130, 292, 200, 284, W, 290, W, H, 0, H], '#141e1c');
      PX.poly(c, [0, 330, 80, 318, 160, 324, W, 314, W, H, 0, H], '#101814');
      // ギルド（丘の上）
      const gx = 120, gy = 300;
      PX.rect(c, gx - 30, gy - 34, 60, 34, '#2a2030');
      PX.poly(c, [gx - 36, gy - 34, gx + 36, gy - 34, gx + 22, gy - 56, gx - 22, gy - 56], '#1a2440');
      h.shingles(c, gx - 30, gy - 54, 60, 18, C.roof, 3);
      PX.poly(c, [gx - 36, gy - 34, gx - 22, gy - 56, gx - 30, gy - 56, gx - 38, gy - 34], '#121a30');
      PX.rect(c, gx + 12, gy - 64, 6, 12, '#3a1a1e');
      [[gx - 24, gy - 28], [gx - 12, gy - 28], [gx + 8, gy - 28], [gx + 20, gy - 28], [gx - 24, gy - 16], [gx + 20, gy - 16]].forEach(([wx, wy]) => {
        em.push(() => { PX.rect(c, wx - 2, wy, 5, 6, '#ffc860'); PX.p(c, wx, wy + 1, '#fff2c0'); });
      });
      em.push(() => { PX.gradV(c, gx - 5, gy - 18, 10, 18, ['#fff2c0', '#ffc050', '#e07a30']); });
      // 旗
      PX.vline(c, gx, gy - 74, gy - 56, '#2a2030');
      PX.rect(c, gx + 1, gy - 74, 8, 5, C.banner[3]);
      PX.p(c, gx + 4, gy - 72, C.gold[3]);
      // 道とランタン
      PX.poly(c, [gx - 6, gy, gx + 6, gy, 150, H, 90, H], '#2a2a2c');
      PX.poly(c, [gx - 4, gy, gx + 4, gy, 140, H, 100, H], '#343236');
      [[104, 322], [138, 322], [96, 352], [146, 352], [86, 392], [158, 392]].forEach(([x, y], i) => {
        const s = 0.5 + (y - 300) / 120;
        PX.vline(c, x, y - Math.round(10 * s), y, '#0c0a10');
        em.push(() => { PX.rect(c, x - 1, y - Math.round(12 * s) - 2, 3, 3, '#ffd46a'); });
        L.push({ x, y: y - 12 * s, r: 18 + 16 * s, i: 0.8 });
      });
      // 手前の木（シルエット）
      const silTree = (x, y, r, seed) => {
        const rr = PX.rng(seed);
        for (let i = 0; i < 9; i++) PX.ellipse(c, x + (rr() - 0.5) * r * 1.6, y - rr() * r * 2.4, r * (0.5 + rr() * 0.4), r * (0.4 + rr() * 0.3), '#080c0c');
        PX.rect(c, x - 2, y - r, 5, r + 60, '#080c0c');
      };
      silTree(6, 330, 30, 3);
      silTree(236, 316, 28, 7);
      // 背中を向けて町を見る二人
      const hero = SP.make(SP.CAST.hero, 'back');
      const mage = SP.make(SP.CAST.mage, 'back');
      c.drawImage(hero, 108, 408 - hero.height);
      c.drawImage(mage, 120, 409 - mage.height);
      // ホタル
      const fr = PX.rng(91);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(fr() * W), y = 290 + Math.floor(fr() * 130);
        em.push(() => { PX.p(c, x, y, '#e8ff9a'); if (fr() < 0.4) PX.glow(c, x, y, 4, '#a8ff60', 0.6); });
      }
    }, (u) => {
      // ロゴ下の飾り線
      PX.hline(u, 50, 104, 156, C.gold[3]);
      PX.hline(u, 136, 190, 156, C.gold[3]);
      PX.hline(u, 56, 104, 157, C.gold[1]);
      PX.hline(u, 136, 184, 157, C.gold[1]);
      SC.lanternIcon(u, 116, 151);
    }, (t) => {
      // ロゴ
      t.save();
      t.textAlign = 'center';
      t.font = `800 ${36 * Z}px "Shippori Mincho B1", serif`;
      const X = 120 * Z, Y = 138 * Z;
      t.shadowColor = 'rgba(255,170,80,0.55)';
      t.shadowBlur = 60;
      t.lineJoin = 'round';
      t.lineWidth = 9 * Z / 2;
      t.strokeStyle = '#1a0c06';
      t.strokeText('ギルドの灯', X, Y);
      t.shadowBlur = 0;
      const g = t.createLinearGradient(0, Y - 30 * Z, 0, Y + 4 * Z);
      g.addColorStop(0, '#fff8d8');
      g.addColorStop(0.45, '#f8d270');
      g.addColorStop(0.55, '#d89a38');
      g.addColorStop(1, '#a8601e');
      t.fillStyle = g;
      t.fillText('ギルドの灯', X, Y);
      t.restore();
      TX.draw(t, 'GUILD OF LANTERNS', 120, 172, { size: 7, align: 'center', font: `800 ${7 * Z}px "Cinzel", serif`, color: '#ffe6a0', letter: 6, shadowCol: 'rgba(40,10,20,0.9)' });
      TX.draw(t, '― タップしてはじめる ―', 120, 372, { size: 8, align: 'center', color: '#fff4dc' });
      TX.draw(t, 'はじめから　　つづきから', 120, 386, { size: 7, align: 'center', color: '#c8b8d8' });
    }, {
      light: { ambientY: (y) => (y < 280 ? 1 : 0.32), night: [0.5, 0.52, 0.78], steps: 5 },
      glow: (c) => {},
    });
  };

  // =================================================================== 3. ギルドの断面（箱庭）
  SC.house = function () {
    return SC.compose((c, em, L) => {
      // 雪の夜空
      PX.gradV(c, 0, 0, W, 330, ['#0a0e24', '#141a3a', '#202a52', '#2e3a66']);
      h.stars(c, 0, 0, W, 120, 60, 5);
      PX.ellipse(c, 34, 46, 9, 9, '#f2eedc');
      PX.ellipse(c, 37, 44, 8, 8, '#141a3a');
      // 遠い町並み
      const rnd = PX.rng(8);
      for (let x = -2; x < W; ) {
        const w = 10 + Math.floor(rnd() * 12), hh = 18 + Math.floor(rnd() * 22);
        PX.rect(c, x, 300 - hh, w, hh, '#1a1e38');
        PX.poly(c, [x - 1, 300 - hh, x + w + 1, 300 - hh, x + w / 2, 300 - hh - 7], '#151830');
        if (rnd() < 0.6) { const wx = x + 3, wy = 304 - hh; em.push(() => PX.rect(c, wx, wy, 2, 2, '#e8a850')); }
        x += w + 2;
      }
      // 雪の地面
      PX.rect(c, 0, 318, W, H - 318, '#c8d2e8');
      PX.dither(c, 0, 318, W, 6, '#e8eef8', '#c8d2e8', 0.5);
      PX.rect(c, 0, 324, W, H - 324, '#aab6d0');
      const x0 = 18, x1 = 222;
      // 屋根（屋根裏が見える）
      const roofY = 30;
      PX.poly(c, [x0 - 10, 104, x1 + 10, 104, 120, roofY], C.roof[1]);
      PX.poly(c, [x0 + 2, 100, x1 - 2, 100, 120, roofY + 10], '#2a1e1a');
      // 屋根裏の梁と荷物
      PX.line(c, 120, roofY + 12, 120, 100, C.wood[2]);
      PX.rect(c, x0 + 30, 96, x1 - x0 - 60, 3, C.wood[2]);
      h.crate(c, 70, 96, 12, 10); h.crate(c, 84, 96, 9, 8); h.barrel(c, 150, 96);
      PX.rect(c, 162, 88, 16, 8, '#7a3a2e'); PX.rect(c, 163, 89, 14, 2, '#a85a3a'); // 宝箱
      PX.rect(c, 168, 90, 4, 3, C.gold[3]);
      // 屋根裏で眠る猫
      PX.rect(c, 104, 92, 9, 4, '#e8a040'); PX.rect(c, 110, 90, 4, 3, '#e8a040'); PX.p(c, 110, 89, '#e8a040'); PX.p(c, 113, 89, '#e8a040');
      PX.hline(c, 104, 112, 95, '#b87028');
      // 屋根の外側（雪が積もる）
      h.shingles(c, x0 - 10, roofY, 6, 6, C.roof, 1);
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        for (let k = 0; k < 11; k++) {
          const t = k / 10;
          const px = 120 + side * (8 + t * (x1 - 112)), py = roofY + 2 + t * 72;
          PX.rect(c, px - 4, py - 2, 9, 5, C.roof[2 + (k % 2)]);
          PX.rect(c, px - 4, py - 3, 9, 2, '#e8eef8');
        }
      }
      PX.rect(c, 150, 26, 12, 34, C.red[1]);
      h.bricks(c, 151, 27, 10, 33, C.red, 4, 5, 3);
      PX.rect(c, 148, 22, 16, 5, '#e8eef8');
      // 煙
      [[156, 14, 4], [160, 6, 5], [154, -2, 6]].forEach(([x, y, r]) => PX.ellipse(c, x, y, r, r - 1, '#4a5274'));
      // 各階
      const floors = [
        { y: 104, h: 70, kind: 'bunks' },
        { y: 174, h: 72, kind: 'hall' },
        { y: 246, h: 72, kind: 'tavern' },
      ];
      floors.forEach((f) => room(c, x0, f.y, x1 - x0, f.h, f.kind, em, L));
      // 外壁（断面）
      [x0 - 4, x1].forEach((wx) => {
        PX.rect(c, wx, 104, 4, 214, C.wood[1]);
        PX.vline(c, wx + 1, 104, 317, C.wood[3]);
      });
      floors.forEach((f) => {
        PX.rect(c, x0 - 6, f.y + f.h - 2, x1 - x0 + 12, 4, C.wood[1]);
        PX.hline(c, x0 - 6, x1 + 5, f.y + f.h - 2, C.wood[4]);
      });
      // 階段
      for (let f = 0; f < 2; f++) {
        const y0 = floors[f + 1].y + floors[f + 1].h - 3, y1 = floors[f].y + floors[f].h - 3;
        for (let k = 0; k < 9; k++) {
          const sx = 200 - k * 3, sy = y0 - k * ((y0 - y1) / 9);
          PX.rect(c, sx, sy - 2, 8, 2, C.wood[4]);
          PX.hline(c, sx, sx + 7, sy - 2, C.wood[5]);
        }
      }
      // 外の街灯
      h.lanternPost(c, 8, 318, em, L, 30);
      h.lanternPost(c, 232, 318, em, L, 30);
      // 雪だるま
      PX.ellipse(c, 228, 334, 6, 5, '#f2f6ff'); PX.ellipse(c, 228, 326, 4, 4, '#f2f6ff');
      PX.p(c, 227, 325, '#1a1420'); PX.p(c, 229, 325, '#1a1420'); PX.p(c, 228, 327, '#e8803a');
      // 手前の道を行く人
      SC.person(c, 'townB', 40, 338, 'side', true);
      SC.person(c, 'child', 54, 340, 'side', true);
      L.push({ x: 120, y: 320, r: 80, i: 0.5 });
    }, (u) => {
      // 上の資源バー（木札）
      UI.parch(u, 4, 4, 232, 24);
      // 下のタブ
      UI.parch(u, 2, 386, 236, 38);
      for (let i = 1; i < 5; i++) PX.vline(u, 2 + i * 47, 392, 418, '#b09068');
      tabIcons(u);
      // 今夜のできごと
      UI.parch(u, 8, 344, 224, 38);
      // 吹き出し
      bubble(u, 64, 150, 30, 12);
      bubble(u, 158, 222, 34, 12);
      bubble(u, 92, 292, 36, 12);
    }, (t) => {
      const dk = '#3a2414';
      TX.draw(t, '★3 小さなギルド', 12, 19, { size: 7.5, color: dk, shadow: false });
      TX.draw(t, '1,240G', 142, 19, { size: 7.5, color: dk, shadow: false, align: 'right' });
      TX.draw(t, '素材 18', 184, 19, { size: 7.5, color: dk, shadow: false, align: 'right' });
      TX.draw(t, '22:10', 228, 19, { size: 6.5, color: '#7a5a3a', shadow: false, align: 'right' });
      ['ギルド', '依頼', '冒険譚', '仲間', '施設'].forEach((s, i) => TX.draw(t, s, 25.5 + i * 47, 418, { size: 6.5, color: i === 0 ? '#8a2e1e' : dk, shadow: false, align: 'center' }));
      TX.draw(t, '今夜のできごと', 16, 355, { size: 6.5, color: '#8a5a2a', shadow: false });
      TX.draw(t, 'ミラが酒場で歌っている。客がふえた。', 16, 368, { size: 7.5, color: dk, shadow: false });
      TX.draw(t, '酒場 Lv3 ・ チップ +12G', 16, 378, { size: 6, color: '#7a5a3a', shadow: false });
      TX.draw(t, 'Zzz…', 79, 159, { size: 6.5, color: dk, shadow: false, align: 'center' });
      TX.draw(t, '依頼です', 175, 231, { size: 6.5, color: dk, shadow: false, align: 'center' });
      TX.draw(t, '♪〜♪', 110, 301, { size: 6.5, color: dk, shadow: false, align: 'center' });
    }, {
      light: { ambient: 0.22, steps: 6, night: [0.42, 0.46, 0.72] },
      glow: (c, lights) => lights.filter((l) => l.r >= 44).forEach((l) => PX.glow(c, l.x, l.y, 10, '#ffb050', 0.5)),
    });
  };

  function room(c, x, y, w, hh, kind, em, L) {
    const top = y, bot = y + hh - 2;
    if (kind === 'bunks') {
      h.planksV(c, x, top, w, hh, C.wood, 21, 6);
      PX.rect(c, x, bot - 12, w, 12, C.wood[2]);
      PX.hline(c, x, x + w - 1, bot - 12, C.wood[4]);
      // 二段ベッド
      [x + 14, x + 60].forEach((bx, i) => {
        PX.rect(c, bx, bot - 46, 3, 46, C.wood[2]);
        PX.rect(c, bx + 38, bot - 46, 3, 46, C.wood[2]);
        [bot - 10, bot - 32].forEach((by, j) => {
          PX.rect(c, bx + 2, by, 37, 3, C.wood[3]);
          PX.rect(c, bx + 3, by - 4, 35, 4, '#e8e2d4');
          PX.rect(c, bx + 3, by - 6, 8, 3, '#fffaf0');
          // 布団
          const quilt = [['#c8584a', '#3a6ab0'], ['#5a9a5a', '#d8a040']][i][j];
          PX.rect(c, bx + 12, by - 5, 26, 4, quilt);
          PX.hline(c, bx + 12, bx + 37, by - 5, PX.mix(quilt, '#ffffff', 0.3));
        });
      });
      // 寝ている冒険者（頭）
      PX.rect(c, x + 19, bot - 41, 6, 5, '#f2c6a0'); PX.rect(c, x + 18, bot - 43, 8, 3, '#c8562e');
      PX.rect(c, x + 65, bot - 19, 6, 5, '#f6d6bc'); PX.rect(c, x + 64, bot - 21, 8, 3, '#e8d090');
      // 窓とランタン
      h.windowFrame(c, x + 120, top + 14, 16, 18, em, { curtain: true });
      em.push(() => {
        // 窓の外の雪
        PX.gradV(c, x + 120, top + 14, 16, 18, ['#2a3460', '#3a4878']);
        for (let i = 0; i < 6; i++) PX.p(c, x + 121 + ((i * 5) % 14), top + 15 + ((i * 7) % 16), '#e8eef8');
        PX.vline(c, x + 128, top + 14, top + 31, C.wood[1]);
        PX.hline(c, x + 120, x + 135, top + 23, C.wood[1]);
      });
      PX.rect(c, x + 150, bot - 30, 30, 30, C.wood[3]);
      PX.rect(c, x + 151, bot - 29, 13, 28, C.wood[4]);
      PX.rect(c, x + 165, bot - 29, 14, 28, C.wood[4]);
      PX.p(c, x + 162, bot - 15, C.gold[3]); PX.p(c, x + 167, bot - 15, C.gold[3]);
      PX.vline(c, x + 104, top, top + 10, '#1e1a22');
      PX.rect(c, x + 101, top + 10, 7, 7, '#1e1a22');
      em.push(() => PX.rect(c, x + 102, top + 11, 5, 5, '#ffd46a'));
      L.push({ x: x + 104, y: top + 14, r: 56, i: 0.9 });
      SC.person(c, 'mage', x + 110, bot, 'front', false, { hatType: null, style: 'long', item: 'book' });
    } else if (kind === 'hall') {
      h.planksV(c, x, top, w, hh, ['#1a120e', '#2c1e16', '#3e2a1e', '#523828', '#684834', '#7e5a40', '#946e4e'], 33, 8);
      PX.rect(c, x, bot - 14, w, 14, C.wood[1]);
      PX.hline(c, x, x + w - 1, bot - 14, C.wood[3]);
      // 掲示板
      PX.rect(c, x + 14, top + 12, 44, 30, C.wood[1]);
      PX.rect(c, x + 15, top + 13, 42, 28, '#a07a50');
      [[17, 15, '#f2e4c0'], [28, 14, '#efe0b8'], [40, 16, '#f6ead0'], [19, 27, '#ecdcb0'], [33, 28, '#f2e4c0'], [45, 26, '#efe0b8']].forEach(([dx, dy, col]) => {
        PX.rect(c, x + dx, top + dy, 9, 11, col);
        PX.hline(c, x + dx + 1, x + dx + 7, top + dy + 3, '#8a7050');
        PX.hline(c, x + dx + 1, x + dx + 5, top + dy + 5, '#8a7050');
        PX.p(c, x + dx + 4, top + dy, '#c83a2e');
      });
      // 旗と剥製
      h.bannerHang(c, x + 74, top + 6, 12, 22);
      PX.rect(c, x + 100, top + 14, 14, 10, C.wood[2]);
      PX.rect(c, x + 102, top + 10, 10, 8, '#c8c0b0');
      PX.p(c, x + 103, top + 8, '#e8d8a0'); PX.p(c, x + 110, top + 8, '#e8d8a0');
      // 受付カウンター
      PX.rect(c, x + 130, bot - 20, 52, 20, C.wood[3]);
      PX.rect(c, x + 128, bot - 23, 56, 4, C.wood[5]);
      PX.hline(c, x + 128, x + 183, bot - 23, C.wood[6]);
      for (let i = 0; i < 3; i++) PX.rect(c, x + 134 + i * 16, bot - 16, 12, 12, C.wood[2]);
      SC.person(c, 'rina', x + 160, bot - 9, 'front');
      PX.rect(c, x + 128, bot - 20, 56, 20, 'rgba(0,0,0,0)');
      // カウンターを描き直して人の手前に
      PX.rect(c, x + 130, bot - 14, 52, 14, C.wood[3]);
      PX.rect(c, x + 128, bot - 17, 56, 4, C.wood[5]);
      PX.hline(c, x + 128, x + 183, bot - 17, C.wood[6]);
      for (let i = 0; i < 3; i++) PX.rect(c, x + 134 + i * 16, bot - 12, 12, 9, C.wood[2]);
      PX.rect(c, x + 170, bot - 22, 3, 5, '#f2e4c0');
      em.push(() => PX.p(c, x + 171, bot - 23, '#ffd46a'));
      L.push({ x: x + 171, y: bot - 22, r: 30, i: 0.7 });
      // シャンデリア
      PX.vline(c, x + 100, top, top + 8, '#1e1a22');
      PX.rect(c, x + 90, top + 8, 21, 2, '#3a2a20');
      [92, 100, 108].forEach((dx) => { em.push(() => { PX.p(c, x + dx, top + 6, '#ffd46a'); PX.p(c, x + dx, top + 7, '#fff2c0'); }); });
      L.push({ x: x + 100, y: top + 10, r: 70, i: 0.95 });
      SC.person(c, 'warrior', x + 36, bot, 'back');
      SC.person(c, 'archer', x + 116, bot, 'side');
      SC.person(c, 'hero', x + 98, bot, 'front');
    } else if (kind === 'tavern') {
      PX.rect(c, x, top, w, hh, '#3a2218');
      h.bricks(c, x, top, w, hh - 30, ['#24140e', '#3a2016', '#4e2c1e', '#623a26', '#784a30'], 51, 10, 5);
      h.planksV(c, x, bot - 30, w, 30, C.wood, 52, 6);
      PX.hline(c, x, x + w - 1, bot - 30, C.wood[5]);
      // 暖炉
      PX.rect(c, x + 4, bot - 40, 34, 40, C.stone[3]);
      h.bricks(c, x + 5, bot - 39, 32, 38, C.stone, 3, 8, 4);
      PX.rect(c, x + 10, bot - 22, 22, 22, '#120806');
      em.push(() => {
        for (let i = 0; i < 6; i++) PX.poly(c, [x + 12 + i * 3, bot - 2, x + 16 + i * 3, bot - 2, x + 14 + i * 3, bot - 10 - (i % 3) * 3], i % 2 ? '#f8a040' : '#ffd46a');
        PX.rect(c, x + 12, bot - 3, 18, 2, '#ff7a2a');
      });
      L.push({ x: x + 21, y: bot - 10, r: 70, i: 1.15 });
      // 酒棚とカウンター
      PX.rect(c, x + 150, top + 12, 50, 2, C.wood[2]);
      PX.rect(c, x + 150, top + 26, 50, 2, C.wood[2]);
      for (let i = 0; i < 12; i++) {
        const bx = x + 152 + (i % 6) * 8, by = i < 6 ? top + 12 : top + 26;
        const col = ['#4a8a5a', '#8a3a4a', '#c8a03a', '#3a5a8a'][i % 4];
        PX.rect(c, bx, by - 6, 3, 6, col); PX.p(c, bx + 1, by - 7, col); PX.p(c, bx, by - 5, '#ffffff');
      }
      SC.person(c, 'barkeep', x + 176, bot - 6, 'front', false, { item: 'tray' });
      PX.rect(c, x + 146, bot - 16, 56, 16, C.wood[3]);
      PX.rect(c, x + 144, bot - 19, 60, 4, C.wood[5]);
      PX.hline(c, x + 144, x + 203, bot - 19, C.gold[3]);
      // テーブル
      [[x + 66, 'warrior'], [x + 112, 'cleric']].forEach(([tx, who], i) => {
        SC.person(c, i ? 'townA' : who, tx - 12, bot - 2, 'side', true);
        SC.person(c, i ? 'townC' : 'thief', tx + 12, bot - 2, 'side');
        PX.rect(c, tx - 9, bot - 12, 18, 3, C.wood[4]);
        PX.hline(c, tx - 9, tx + 8, bot - 12, C.wood[5]);
        PX.rect(c, tx - 1, bot - 9, 2, 9, C.wood[2]);
        PX.rect(c, tx - 4, bot - 15, 3, 3, '#e8b040'); PX.rect(c, tx + 2, bot - 15, 3, 3, '#e8b040');
        PX.hline(c, tx - 4, tx - 2, bot - 15, '#fff4d0'); PX.hline(c, tx + 2, tx + 4, bot - 15, '#fff4d0');
        PX.vline(c, tx, top, top + 14, '#1e1a22');
        PX.rect(c, tx - 2, top + 14, 5, 5, '#1e1a22');
        em.push(() => PX.rect(c, tx - 1, top + 15, 3, 3, '#ffd46a'));
        L.push({ x: tx, y: top + 17, r: 48, i: 0.8 });
      });
      // 歌うミラ
      SC.person(c, 'townC', x + 92, bot - 2, 'front', false, { outfit: '#c8584a', style: 'pony', hair: '#e8a040' });
    }
  }

  function tabIcons(u) {
    const ic = (x, rows, col) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') PX.p(u, x + i, 393 + j, col); });
    const house = ['....##....', '...####...', '..######..', '.########.', '..#....#..', '..#.##.#..', '..#.##.#..', '..######..'];
    const scroll = ['.########.', '#........#', '.#.####.#.', '.#......#.', '.#.###..#.', '.#......#.', '#........#', '.########.'];
    const play = ['..#.......', '..###.....', '..#####...', '..#######.', '..#######.', '..#####...', '..###.....', '..#.......'];
    const people = ['..##..##..', '.####.###.', '..##..##..', '.####.###.', '########..', '######.##.', '.###..###.', '..........'];
    const hammer = ['.######...', '.######...', '...##.....', '...##.....', '...##.....', '...##.....', '...##.....', '..####....'];
    [house, scroll, play, people, hammer].forEach((rows, i) => ic(21 + i * 47, rows, i === 0 ? '#8a2e1e' : '#5a3a20'));
  }
  function bubble(u, x, y, w, hh) {
    PX.rect(u, x + 1, y, w - 2, hh, '#24161a');
    PX.rect(u, x, y + 1, w, hh - 2, '#24161a');
    PX.rect(u, x + 1, y + 1, w - 2, hh - 2, '#fff8e8');
    PX.poly(u, [x + 6, y + hh - 1, x + 12, y + hh - 1, x + 7, y + hh + 4], '#24161a');
    PX.poly(u, [x + 7, y + hh - 2, x + 11, y + hh - 2, x + 8, y + hh + 2], '#fff8e8');
  }

  // =================================================================== 4. ワールドマップ
  SC.world = function () {
    return SC.compose((c, em, L) => {
      // 海
      PX.rect(c, 0, 0, W, H, '#1e3a6a');
      const sea = PX.rng(3);
      for (let i = 0; i < 260; i++) PX.hline(c, Math.floor(sea() * W), Math.floor(sea() * W) % W + 3, Math.floor(sea() * H), sea() < 0.5 ? '#2a4a80' : '#264476');
      // 陸の形
      const land = PX.canvas(W, H);
      const lc = land.ctx;
      PX.poly(lc, [10, 40, 80, 20, 170, 30, 230, 60, 236, 160, 210, 230, 228, 300, 200, 380, 120, 410, 40, 390, 20, 320, 30, 250, 8, 180], '#fff');
      PX.ellipse(lc, 60, 330, 30, 20, '#fff');
      const ld = lc.getImageData(0, 0, W, H).data;
      const isLand = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ld[(y * W + x) * 4 + 3] > 0;
      // 浅瀬と砂浜
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (isLand(x, y)) continue;
        let near = false;
        for (let k = -3; k <= 3 && !near; k++) for (let m = -3; m <= 3; m++) if (isLand(x + k, y + m)) { near = true; break; }
        if (near) PX.p(c, x, y, PX.BAYER[y & 3][x & 3] < 0.5 ? '#3a6aa0' : '#34609a');
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!isLand(x, y)) continue;
        const edge = !isLand(x - 2, y) || !isLand(x + 2, y) || !isLand(x, y - 2) || !isLand(x, y + 2);
        if (edge) { PX.p(c, x, y, '#d8c88a'); continue; }
        const n = valueNoise(x * 0.06, y * 0.06) * 0.7 + valueNoise(x * 0.18, y * 0.18) * 0.3;
        const snow = y < 110 ? (110 - y) / 50 : 0;
        const lv = n + (PX.BAYER[y & 3][x & 3] - 0.5) * 0.25;
        let col = lv < 0.35 ? '#4e7e38' : lv < 0.5 ? '#5a8a3e' : lv < 0.66 ? '#669a44' : '#78aa4e';
        if (snow > 0 && PX.BAYER[y & 3][x & 3] < snow) col = lv < 0.5 ? '#c8d0e0' : '#e8eef8';
        PX.p(c, x, y, col);
      }
      // 川
      const river = [[150, 30], [140, 80], [120, 120], [126, 170], [100, 220], [110, 270], [80, 320], [60, 390]];
      for (let i = 0; i < river.length - 1; i++) {
        const [ax, ay] = river[i], [bx, by] = river[i + 1];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const x = ax + (bx - ax) * t + Math.sin(t * 6 + i) * 2, y = ay + (by - ay) * t;
          PX.rect(c, x - 2, y - 1, 4, 3, '#3a6aa0');
          PX.p(c, x - 1, y, '#5a8ac0');
        }
      }
      // 森
      const forest = (cx, cy, rx, ry, n, seed) => {
        const r = PX.rng(seed);
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r());
          pts.push([Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d)]);
        }
        pts.sort((p, q) => p[1] - q[1]).forEach(([x, y]) => {
          if (!isLand(x, y)) return;
          PX.poly(c, [x - 4, y + 3, x + 4, y + 3, x, y - 7], '#163a26');
          PX.poly(c, [x - 3, y + 2, x + 3, y + 2, x, y - 5], '#24542e');
          PX.poly(c, [x - 3, y + 2, x, y + 2, x, y - 5], '#2e6a36');
          PX.p(c, x, y + 4, '#4a3020');
        });
      };
      forest(60, 120, 36, 30, 70, 5);
      forest(180, 250, 30, 40, 60, 9);
      forest(90, 290, 22, 18, 30, 13);
      // 山脈
      const mount = (x, y, s) => {
        PX.poly(c, [x - 9 * s, y, x + 9 * s, y, x, y - 13 * s], '#5a5466');
        PX.poly(c, [x - 9 * s, y, x, y, x, y - 13 * s], '#7a7488');
        PX.poly(c, [x - 3 * s, y - 9 * s, x + 3 * s, y - 9 * s, x, y - 13 * s], '#f2f2fa');
        PX.hline(c, x - 9 * s, x + 9 * s, y, '#3a3444');
      };
      [[160, 70, 1.2], [178, 76, 1], [196, 70, 1.3], [210, 92, 1], [150, 92, 0.9], [188, 98, 1.1], [40, 220, 1], [54, 232, 0.8]].forEach(([x, y, s]) => mount(x, y, s));
      // 道（点線）
      const road = [[118, 212], [100, 180], [70, 160], [62, 120], [90, 80], [150, 60], [176, 50]];
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, ay] = road[i], [bx, by] = road[i + 1];
        const n = Math.round(Math.hypot(bx - ax, by - ay) / 4);
        for (let k = 0; k < n; k++) if (k % 2 === 0) PX.rect(c, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, 2, 2, '#f2e4c0');
      }
      const road2 = [[118, 212], [150, 240], [176, 280], [196, 318]];
      for (let i = 0; i < road2.length - 1; i++) {
        const [ax, ay] = road2[i], [bx, by] = road2[i + 1];
        const n = Math.round(Math.hypot(bx - ax, by - ay) / 4);
        for (let k = 0; k < n; k++) if (k % 2 === 0) PX.rect(c, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, 2, 2, '#e8d8b0');
      }
      // 町・城・洞窟のアイコン
      const town = (x, y) => {
        PX.rect(c, x - 7, y - 4, 14, 7, '#e8dcc0');
        PX.poly(c, [x - 8, y - 4, x, y - 10, x + 8, y - 4], '#a8443a');
        PX.rect(c, x - 2, y - 1, 3, 4, '#5a3a2a');
        PX.rect(c, x + 4, y - 12, 3, 8, '#e8dcc0');
        PX.poly(c, [x + 3, y - 12, x + 8, y - 12, x + 5, y - 16], '#3a4a8a');
      };
      town(118, 212);
      const castle = (x, y) => {
        PX.rect(c, x - 9, y - 8, 18, 10, '#6a6478');
        [-9, -2, 5].forEach((d, i) => { PX.rect(c, x + d, y - 14 - (i === 1 ? 4 : 0), 4, 8 + (i === 1 ? 4 : 0), '#7a748a'); PX.poly(c, [x + d - 1, y - 14 - (i === 1 ? 4 : 0), x + d + 5, y - 14 - (i === 1 ? 4 : 0), x + d + 2, y - 19 - (i === 1 ? 4 : 0)], '#3a3448'); });
        PX.rect(c, x - 2, y - 4, 4, 6, '#2a2430');
      };
      castle(176, 50);
      PX.ellipse(c, 196, 318, 8, 6, '#5a5466'); PX.ellipse(c, 196, 320, 4, 3, '#100c14');
      PX.hline(c, 189, 203, 323, '#3a3444');
      // 雲の影
      [[60, 76, 22, 6], [190, 186, 26, 7]].forEach(([x, y, rx, ry]) => {
        for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
          if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 1) continue;
          if (PX.BAYER[(y + j) & 3][(x + i) & 3] < 0.4) PX.p(c, x + i, y + j, 'rgba(10,20,40,0.28)');
        }
      });
      // うわさの印
      const mark = (x, y) => {
        PX.rect(c, x - 3, y - 14, 7, 9, '#120c14');
        PX.rect(c, x - 2, y - 13, 5, 7, '#f8dc78');
        PX.rect(c, x, y - 12, 1, 3, '#7a2a1a');
        PX.p(c, x, y - 8, '#7a2a1a');
        PX.poly(c, [x - 1, y - 5, x + 2, y - 5, x, y - 2], '#120c14');
      };
      mark(176, 34); mark(196, 306); mark(180, 240);
      // パーティ
      const p = SP.make(SP.CAST.hero, 'front');
      c.drawImage(p, 92, 190 - p.height + 6);
    }, (u) => {
      UI.gothic(u, 6, 6, 228, 30);
      UI.gothic(u, 6, 334, 228, 86);
      // 選択カーソル
      PX.poly(u, [16, 371, 22, 375, 16, 379], C.gold[4]);
    }, (t) => {
      TX.draw(t, 'ワールドマップ', 16, 19, { size: 8, color: '#f8dc78' });
      TX.draw(t, '北方辺境ノルデン', 16, 31, { size: 6.5, color: '#c8b8a0' });
      TX.draw(t, '3日目 ・ 雪どけの月', 226, 25, { size: 6.5, color: '#c8b8a0', align: 'right' });
      TX.draw(t, '【うわさ】 酒場で聞いた話', 16, 349, { size: 7, color: '#f8dc78' });
      TX.draw(t, '北の古城で、夜ごと鐘が鳴るらしい。', 16, 363, { size: 7.5 });
      TX.draw(t, '調べに行く（必要戦力 120 ・ 2時間）', 26, 378, { size: 7.5, color: '#fff4c0' });
      TX.draw(t, '酒場でもう少し話を聞く', 26, 392, { size: 7.5, color: '#b8aac8' });
      TX.draw(t, 'ほかのうわさ 2件：南の洞窟／森の青い灯', 16, 410, { size: 6.5, color: '#9a8aa8' });
      TX.draw(t, '灯の街', 118, 224, { size: 6, align: 'center', color: '#fff', outline: '#120c14', outlineW: 6, shadow: false });
      TX.draw(t, '北の古城', 176, 62, { size: 6, align: 'center', color: '#fff', outline: '#120c14', outlineW: 6, shadow: false });
      TX.draw(t, '南の洞窟', 196, 332, { size: 6, align: 'center', color: '#fff', outline: '#120c14', outlineW: 6, shadow: false });
      TX.draw(t, '迷いの森', 180, 272, { size: 6, align: 'center', color: '#fff', outline: '#120c14', outlineW: 6, shadow: false });
    }, {});
  };

  function valueNoise(x, y) {
    const hsh = (i, j) => { let n = i * 374761393 + j * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; };
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hsh(xi, yi), b = hsh(xi + 1, yi), c2 = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  }

  // =================================================================== 5. 冒険譚（戦闘）— 縦動画
  SC.battle = function () {
    // 戦闘は寄りの画面：160×284 で描いて 6 倍
    const BW = 160, BH = 284, BZ = 6;
    const art = PX.canvas(BW, BH);
    const c = art.ctx;
    const em = [], L = [];
    // 夕暮れの森
    PX.gradV(c, 0, 0, BW, 130, ['#2a1e48', '#4a2a5a', '#8a3e5e', '#d0625a', '#f29a5e', '#f8c878']);
    PX.ellipse(c, 112, 112, 16, 16, '#ffe8a0');
    PX.glow(c, 112, 112, 40, '#ff9a50', 0.5);
    const hill = (y0, amp, col, seed, step) => {
      const r = PX.rng(seed);
      const pts = [0, BH];
      for (let x = 0; x <= BW; x += step) pts.push(x, y0 - r() * amp);
      pts.push(BW, BH);
      PX.poly(c, pts, col);
    };
    hill(118, 16, '#6a3a5a', 3, 12);
    hill(128, 12, '#4a2a4a', 5, 8);
    // 木々のシルエット
    const pine = (x, y, s, col) => {
      for (let k = 0; k < 4; k++) PX.poly(c, [x - (9 - k * 2) * s, y - k * 7 * s, x + (9 - k * 2) * s, y - k * 7 * s, x, y - (k * 7 + 12) * s], col);
      PX.rect(c, x - 1, y, 2, 6, col);
    };
    const r1 = PX.rng(7);
    for (let i = 0; i < 12; i++) pine(i * 15 + r1() * 8, 142, 0.9 + r1() * 0.4, '#2e1a34');
    for (let i = 0; i < 8; i++) pine(i * 22 + r1() * 10, 156, 1.2 + r1() * 0.4, '#1e1228');
    // 木漏れの光の筋
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 38;
      PX.dither(c, 0, 0, 1, 1, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 0);
      PX.poly(c, [x, 0, x + 10, 0, x + 40, 200, x + 26, 200], 'rgba(255,200,140,0.07)');
    }
    // 地面
    PX.rect(c, 0, 158, BW, BH - 158, '#3a3a2a');
    PX.gradV(c, 0, 158, BW, 60, ['#5a5a32', '#4a4a2e', '#3a3a28']);
    const gr = PX.rng(11);
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(gr() * BW), y = 160 + Math.floor(gr() * 120);
      PX.vline(c, x, y - 2, y, gr() < 0.5 ? '#6a7a3a' : '#7a8a42');
    }
    for (let i = 0; i < 14; i++) PX.ellipse(c, gr() * BW, 170 + gr() * 100, 3, 1, '#2e2e22');
    // 魔物：森の主（大きな猪）
    const boar = PX.shaped(64, 46, (m) => {
      PX.ellipse(m, 34, 24, 26, 16, '#fff');
      PX.ellipse(m, 14, 26, 12, 11, '#fff');
      PX.poly(m, [4, 24, 0, 30, 8, 34], '#fff');
      PX.rect(m, 18, 34, 6, 12, '#fff'); PX.rect(m, 28, 34, 6, 11, '#fff');
      PX.rect(m, 44, 34, 6, 12, '#fff'); PX.rect(m, 52, 33, 6, 11, '#fff');
      PX.poly(m, [20, 8, 28, 4, 44, 6, 56, 12, 30, 14], '#fff');
    }, ['#1a1012', '#2e1c1c', '#46282a', '#5e3634', '#784640', '#94584c'], { vgrad: 2, rim: true });
    c.drawImage(boar, 6, 168);
    // 牙・目・たてがみ
    PX.poly(c, [12, 196, 8, 188, 14, 194], '#f2ead8');
    PX.poly(c, [20, 198, 18, 190, 23, 196], '#e8dcc0');
    em.push(() => { PX.rect(c, 17, 185, 3, 2, '#ff4a2a'); PX.p(c, 18, 185, '#ffd46a'); });
    for (let i = 0; i < 10; i++) PX.vline(c, 26 + i * 3, 174 + (i % 2), 180, '#1a1012');
    // パーティ（右側、左を向く）
    const party = [['hero', 106, 210], ['warrior', 126, 196], ['mage', 130, 230], ['cleric', 150, 212]];
    party.forEach(([k, x, y]) => {
      PX.ellipse(c, x, y + 1, 6, 2, 'rgba(10,6,12,0.45)');
      const s = SP.make(SP.CAST[k], 'side');
      c.drawImage(s, x - 8, y - s.height + 1);
    });
    // 斬撃のエフェクト
    em.push(() => {
      for (let k = 0; k < 18; k++) {
        const t = k / 17;
        const x = 30 + Math.cos(-1.9 + t * 2.4) * 26, y = 192 + Math.sin(-1.9 + t * 2.4) * 22;
        PX.rect(c, x, y, 2 + (k > 4 && k < 13 ? 1 : 0), 2, k % 3 ? '#ffffff' : '#ffe8a0');
      }
      // 飛び散る火花
      [[40, 176], [48, 186], [26, 170], [52, 198]].forEach(([x, y]) => { PX.p(c, x, y, '#fff6c0'); PX.p(c, x + 1, y + 1, '#ffd46a'); });
    });
    L.push({ x: 112, y: 112, r: 140, i: 0.8 });
    L.push({ x: 34, y: 190, r: 40, i: 0.7 });
    PX.light(c, BW, BH, L, { ambient: 0.62, steps: 6, night: [0.62, 0.52, 0.72], warm: [1.1, 0.95, 0.82] });
    em.forEach((f) => f());
    // 閃きの電球
    const bx = 126, by = 168;
    PX.rect(c, bx - 2, by - 6, 5, 5, '#120c14');
    PX.rect(c, bx - 1, by - 5, 3, 3, '#fff2a0');
    PX.p(c, bx, by - 1, '#120c14'); PX.p(c, bx, by, '#8a8a8a');
    PX.glow(c, bx, by - 4, 9, '#ffe060', 0.8);
    // UI（ドット）
    const ui = PX.canvas(BW, BH);
    const u = ui.ctx;
    // 上の帯：冒険譚の見出し
    // HP の窓
    const win = (x, y, w, hh) => {
      PX.rect(u, x + 1, y, w - 2, hh, '#e8ecfa');
      PX.rect(u, x, y + 1, w, hh - 2, '#e8ecfa');
      PX.rect(u, x + 1, y + 1, w - 2, hh - 2, '#5a6488');
      PX.gradV(u, x + 2, y + 2, w - 4, hh - 4, ['#3a4cb8', '#24308a', '#161e5a']);
    };
    win(3, 238, 154, 42);
    // 閃きのお知らせ窓
    win(14, 57, 132, 14);
    // HP バー
    [0, 1, 2, 3].forEach((i) => {
      const y = 244 + i * 9;
      const k = [0.82, 0.55, 0.9, 1][i];
      PX.rect(u, 66, y + 3, 52, 3, '#0e1236');
      PX.rect(u, 66, y + 3, Math.round(52 * k), 3, k < 0.6 ? '#f0c040' : '#60e0a0');
      PX.hline(u, 66, 66 + Math.round(52 * k) - 1, y + 3, k < 0.6 ? '#fff0a0' : '#b0ffd8');
    });
    // 右の縦動画ボタン
    const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    heart.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') PX.p(u, 146 + i, 120 + j, '#ff6a8a'); });
    PX.rect(u, 145, 140, 9, 7, '#f2f2fa'); PX.p(u, 146, 147, '#f2f2fa'); PX.p(u, 147, 148, '#f2f2fa');
    PX.p(u, 147, 143, '#5a4a5a'); PX.p(u, 149, 143, '#5a4a5a'); PX.p(u, 151, 143, '#5a4a5a');
    // 進捗バー
    PX.rect(u, 0, BH - 1, BW, 1, 'rgba(255,255,255,0.25)');
    PX.rect(u, 0, BH - 1, 64, 1, '#ffffff');
    const out = PX.canvas(BW * BZ, BH * BZ);
    out.ctx.imageSmoothingEnabled = false;
    out.ctx.drawImage(art.cv, 0, 0, BW * BZ, BH * BZ);
    // 上下を少し暗く（縦動画の文字を読みやすく）
    const g = out.ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, 'rgba(10,6,20,0.55)'); g.addColorStop(1, 'rgba(10,6,20,0)');
    out.ctx.fillStyle = g; out.ctx.fillRect(0, 0, BW * BZ, 260);
    out.ctx.drawImage(ui.cv, 0, 0, BW * BZ, BH * BZ);
    // 文字（ここは 6 倍スケールなので専用に）
    const t = out.ctx;
    const tx = (s, x, y, o = {}) => {
      t.font = o.font || `${(o.size || 6) * BZ}px "DotGothic16", monospace`;
      t.textAlign = o.align || 'left';
      if (o.outline) { t.lineJoin = 'round'; t.lineWidth = o.outline; t.strokeStyle = '#120c14'; t.strokeText(s, x * BZ, y * BZ); }
      if (o.shadow !== false) { t.fillStyle = 'rgba(8,6,20,0.85)'; t.fillText(s, x * BZ + 3, y * BZ + 3); }
      t.fillStyle = o.color || '#f4f2ff';
      t.fillText(s, x * BZ, y * BZ);
    };
    tx('冒険譚 2/5', 80, 12, { align: 'center', size: 6 });
    tx('ささやきの森', 80, 30, { align: 'center', size: 5.5, color: '#ffd8b0' });
    tx('森の主 討伐', 80, 44, { align: 'center', font: `800 ${11 * BZ}px "Shippori Mincho B1", serif`, outline: 18, color: '#fff4dc' });
    tx('128', 40, 160, { size: 12, color: '#ffffff', outline: 16, shadow: false });
    tx('会心', 32, 146, { size: 6, color: '#ffb040', outline: 10, shadow: false });
    tx('閃き！', 126, 156, { size: 6, align: 'center', color: '#fff2a0', outline: 10, shadow: false });
    tx('剣士ガルドが「双竜斬り」を閃いた！', 80, 66, { align: 'center', size: 5.2, color: '#fff2a0', outline: 10 });
    tx('1.2万', 150, 135, { align: 'center', size: 4.2 });
    tx('8', 150, 155, { align: 'center', size: 4.2 });
    [['ガルド', '剣士', 98], ['トマ', '戦士', 64], ['ミーナ', '魔法', 112], ['セナ', '僧侶', 86]].forEach(([n, cl, hp], i) => {
      tx(n, 8, 249 + i * 9, { size: 5.5 });
      tx(cl, 42, 249 + i * 9, { size: 4.5, color: '#b8c4ff' });
      tx(String(hp), 150, 249 + i * 9, { size: 5, align: 'right' });
    });
    tx('@ガルド ほか3名', 6, 220, { size: 5.2, color: '#ffffff', outline: 10 });
    tx('ついに森の主を…！ #大成功 #閃き', 6, 230, { size: 4.6, color: '#f2ead8', outline: 10 });
    return out.cv;
  };
})();
