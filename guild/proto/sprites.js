/* キャラクターのドット絵（16×24 を基本に、帽子のぶん上に4段の余白） */
'use strict';
(function () {
  const SP = (window.SP = {});

  // 前向き（こちらを見ている）
  SP.FRONT = [
    '................',
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHLLHHHHK..',
    '..KHHHLHHHHHhK..',
    '.KHHHHHHHHHHHhK.',
    '.KHHHHHHHHHHhhK.',
    '.KhHHSHHHHSHHhK.',
    '.KhSSSSSSSSSShK.',
    '.KSSSKKSSKKSSSK.',
    '.KSSSEWSSWESSSK.',
    '.KsSRESSSSERSsK.',
    '..KSSSSSSSSSSK..',
    '...KKsSMMSsKK...',
    '.....KOAAOK.....',
    '...KKOQAAQOKK...',
    '..KOQOOAAOOooK..',
    '..KQOKOAAOoKoK..',
    '..KSSKOAAOoKSK..',
    '...KKAAaaAAKK...',
    '...KoOOOOOOoK...',
    '...KPPpKKPPpK...',
    '...KBBbK.KBbK...',
    '...KKKK..KKKK...',
  ];
  // 歩き（前向き・片足）
  SP.FRONT_STEP = SP.FRONT.slice(0, 20).concat([
    '...KoOOOOOOoK...',
    '...KPPpKKPPpK...',
    '...KBBbKKPpK....',
    '...KKKK.KBbK....',
  ]);
  // 横向き（左を向く）
  SP.SIDE = [
    '................',
    '......KKKKK.....',
    '....KKHHHHHKK...',
    '...KHHHHLLHHHK..',
    '...KHHHLHHHHHhK.',
    '..KHHHHHHHHHHhK.',
    '..KHHHHHHHHHHhK.',
    '..KSHHHHHHHHhhK.',
    '.KSSSSSHHHHHhhK.',
    '.KSKKSSSSHHHhK..',
    '.KSEWSSSSShHhK..',
    '.KsRESSSSShHK...',
    '..KSSSSSSShK....',
    '..KMSSsssKK.....',
    '...KKKOAAK......',
    '...KOOQAAOK.....',
    '..KOOQOAAOOK....',
    '..KOQKOAAOoK....',
    '..KSSKOAAOoK....',
    '...KKAAaaAK.....',
    '...KoOOOOOoK....',
    '...KPPpKPPpK....',
    '...KBBbKBBbK....',
    '...KKKKKKKKK....',
  ];
  // 後ろ向き
  SP.BACK = [
    '................',
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHLLHHHHK..',
    '..KHHHLHHHHHhK..',
    '.KHHHHHHHHHHHhK.',
    '.KHHHHHHHHHHhhK.',
    '.KHHHHHHHHHHhhK.',
    '.KhHHHHHHHHHhhK.',
    '.KhHHHHHHHHhhhK.',
    '.KhhHHHHHHhhhhK.',
    '.KshhhhhhhhhhsK.',
    '..KSKhhhhhhKSK..',
    '...KKSSSSSSKK...',
    '.....KOOOOK.....',
    '...KKOQQQOOKK...',
    '..KOQOOOOOOooK..',
    '..KQOKOOOOoKoK..',
    '..KSSKOOOOoKSK..',
    '...KKAAAAAAKK...',
    '...KoOOOOOOoK...',
    '...KPPpKKPPpK...',
    '...KBBbK.KBbK...',
    '...KKKK..KKKK...',
  ];

  // 髪型の上書き（[x, y, 行の配列]、y は本体の行番号）
  const HAIR = {
    short: null,
    long: { front: [[1, 8, ['KH', 'KH', 'KH', 'Kh', 'Kh', '.K']], [13, 8, ['hK', 'hK', 'hK', 'hK', 'hK', 'K.']]], side: [[11, 9, ['hhK', 'hhK', 'hhK', 'hK.', 'hK.', 'K..']]] },
    pony: { front: [[12, 3, ['..KK', '.KHhK', '.KhhK', '..KhK', '..KhK', '...K']]], side: [[12, 4, ['KK..', 'HhK.', 'hhhK', '.KhK', '.KhK', '..K.']]] },
    spiky: { front: [[3, -1, ['..K..K...K', '.KHKKHK.KHK']], [2, 1, ['KHHHHHHHHHHK']]], side: [[5, -1, ['.K..K..K', 'KHKKHKKHK']]] },
    bob: { front: [[1, 8, ['KH', 'KH', 'KhK']], [13, 8, ['hK', 'hK', 'KhK']]], side: [[11, 9, ['hhK', 'hhK', 'KK.']]] },
    bald: { front: [[3, 2, ['KKSSSSSSKK']], [2, 3, ['KSSSSLLSSSSK']], [2, 4, ['KSSSLSSSSSsK']], [1, 5, ['KSSSSSSSSSSSsK']], [1, 6, ['KsSSSSSSSSSssK']], [1, 7, ['KsSSSSSSSSSSsK']]], side: [] },
  };

  // 帽子・兜（y はマイナスで本体の上にはみ出せる）
  const HAT = {
    wizard: {
      front: [[2, -4, [
        '.......KK.......',
        '......KXXK......',
        '.....KXXQXK.....',
        '.....KXXXXK.....',
        '....KXXQXXXK....',
        '....KXXXXXXK....',
        '...KAAAAAAAAK...',
        'KKKXXXXXXXXXXKKK',
        'KXXXXXXXXXXXXXXK',
        '.KKKKKKKKKKKKKK.',
      ].map((r) => r)]].map(([x, y, rows]) => [x - 2, y, rows]),
      side: [[0, -4, [
        '..........KK....',
        '.........KXXK...',
        '........KXXQK...',
        '.......KXXXXK...',
        '......KXXQXXK...',
        '.....KXXXXXXK...',
        '....KAAAAAAAAK..',
        '.KKKXXXXXXXXXXKK',
        'KXXXXXXXXXXXXXK.',
        '.KKKKKKKKKKKKK..',
      ]]],
    },
    helm: {
      front: [[1, 0, [
        '....KKKKKK.....',
        '..KKXXXXXXKK...',
        '.KXXQQXXXXXxK..',
        '.KXQXXXXXXXxK..',
        'KXXXXXXXXXXXxK.',
        'KXXXXXXXXXXxxK.',
        'KxKKKKKKKKKKxK.',
        'Kx.........KxK.',
      ]]],
      side: [[2, 0, [
        '....KKKKK....',
        '..KKXXXXXKK..',
        '.KXXQQXXXXxK.',
        '.KXQXXXXXXxK.',
        'KXXXXXXXXXXxK',
        'KXXXXXXXXXxxK',
        'KKKKKXXXXXxxK',
        '....KxxxxxxK.',
      ]]],
    },
    hood: {
      front: [[1, 1, [
        '...KKKKKKKK...',
        '.KKXXXXXXXXKK.',
        'KXXXQQXXXXXXxK',
        'KXXQXXXXXXXXxK',
        'KXXXXXXXXXXXxK',
        'KXXXXXXXXXXxxK',
        'KXxKKKKKKKKxxK',
        'KXK........KxK',
        'KXK........KxK',
        'KxK........KxK',
        'KxK........KxK',
        '.KK........KK.',
      ]]],
      side: [[1, 1, [
        '....KKKKKKK...',
        '..KKXXXXXXXKK.',
        '.KXXQQXXXXXXxK',
        '.KXQXXXXXXXXxK',
        'KXXXXXXXXXXXxK',
        'KXXXXXXXXXXxxK',
        'KKKKKXXXXXXxxK',
        '....KXXXXXXxK.',
        '....KXXXXXxxK.',
        '....KxXXXxxK..',
        '.....KxxxxK...',
      ]]],
    },
    cap: {
      front: [[2, 1, [
        '...KKKKKK...',
        '.KKXXXXXXKK.',
        'KXXQXXXXXXxK',
        'KXXXXXXXXXxK',
        'KKKKKKKKKKKK',
      ]], [11, -2, ['.KK', 'KAK', 'KAK', 'KK.']]],
      side: [[2, 1, [
        '....KKKKK...',
        '..KKXXXXXKK.',
        '.KXXQXXXXXxK',
        'KKKKXXXXXXxK',
        'KXXKKKKKKKKK',
        '.KK.........',
      ]], [11, -1, ['.KK', 'KAK', 'KAK', 'KK.']]],
    },
    kerchief: {
      front: [[2, 2, ['..KKKKKKKK..', '.KXXXXXXXXK.', 'KXXQXXXXXXxK', 'KxxxxxxxxxxK']]],
      side: [[3, 2, ['.KKKKKKK..', 'KXXXXXXXK.', 'KXQXXXXXxK', 'KxxxxxxxxKK', '........KXK', '.........K']]],
    },
  };

  // 色の組み立て
  SP.palette = function (o) {
    const d = (c, k) => PX.mix(c, '#140c10', k);
    const l = (c, k) => PX.mix(c, '#fff4e0', k);
    return {
      K: o.outline || '#24161a',
      H: o.hair, h: d(o.hair, 0.32), L: l(o.hair, 0.35),
      S: o.skin, s: d(o.skin, 0.2), R: PX.mix(o.skin, '#e86a6a', 0.35),
      E: o.eye || '#2a2440', W: '#ffffff', M: d(o.skin, 0.45),
      O: o.outfit, o: d(o.outfit, 0.3), Q: l(o.outfit, 0.25),
      A: o.accent, a: d(o.accent, 0.3),
      P: o.pants, p: d(o.pants, 0.3),
      B: o.boots || '#4a2e22', b: d(o.boots || '#4a2e22', 0.35),
      X: o.hat || '#888', x: d(o.hat || '#888', 0.35), Q2: l(o.hat || '#888', 0.3),
    };
  };

  function stamp(grid, x0, y0, rows, pad) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const y = y0 + j + pad, x = x0 + i;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) continue;
        grid[y][x] = ch;
      }
    });
  }

  // 1体ぶんのキャンバスを作る（キャッシュ）
  const cache = new Map();
  SP.make = function (o, pose = 'front') {
    const key = JSON.stringify(o) + pose;
    if (cache.has(key)) return cache.get(key);
    const pad = 5;
    const base = pose === 'side' ? SP.SIDE : pose === 'back' ? SP.BACK : pose === 'step' ? SP.FRONT_STEP : SP.FRONT;
    const grid = [];
    for (let j = 0; j < pad; j++) grid.push('................'.split(''));
    base.forEach((r) => grid.push(r.split('')));
    const view = pose === 'side' ? 'side' : 'front';
    if (pose !== 'back') {
      const hs = HAIR[o.style || 'short'];
      if (hs && hs[view]) hs[view].forEach(([x, y, rows]) => stamp(grid, x, y, rows, pad));
      const hat = HAT[o.hatType];
      if (hat && hat[view]) hat[view].forEach(([x, y, rows]) => stamp(grid, x, y, rows, pad));
    }
    const pal = SP.palette(o);
    // 帽子のハイライトは Q を帽子色で
    const c = PX.canvas(16, grid.length);
    for (let j = 0; j < grid.length; j++) for (let i = 0; i < 16; i++) {
      let ch = grid[j][i];
      if (ch === '.') continue;
      let col = pal[ch];
      if (ch === 'Q' && j < pad + 8 && o.hatType) col = pal.Q2;
      if (!col) continue;
      c.ctx.fillStyle = col;
      c.ctx.fillRect(i, j, 1, 1);
    }
    // 持ち物
    if (o.item && SP.ITEMS[o.item]) SP.ITEMS[o.item](c.ctx, pose, pad, o);
    cache.set(key, c.cv);
    return c.cv;
  };
  SP.PAD = 5;

  // 持ち物（手の位置に描く）
  SP.ITEMS = {
    staff(c, pose, pad, o) {
      const x = pose === 'side' ? 1 : 13;
      PX.vline(c, x, pad + 9, pad + 23, '#24161a');
      PX.vline(c, x + 1, pad + 9, pad + 23, '#24161a');
      PX.vline(c, x, pad + 10, pad + 22, '#8a5a32');
      PX.p(c, x + 1, pad + 11, '#b07a44');
      PX.rect(c, x - 1, pad + 6, 4, 4, '#24161a');
      PX.rect(c, x, pad + 7, 2, 2, o.orb || '#8fe0ff');
      PX.p(c, x, pad + 7, '#ffffff');
    },
    sword(c, pose, pad) {
      if (pose === 'side') {
        PX.rect(c, 0, pad + 13, 2, 7, '#24161a');
        PX.vline(c, 0, pad + 9, pad + 17, '#24161a');
        PX.vline(c, 1, pad + 8, pad + 17, '#24161a');
        PX.vline(c, 0, pad + 10, pad + 16, '#dfe6ee');
        PX.vline(c, 1, pad + 9, pad + 16, '#a9b4c0');
        PX.rect(c, 0, pad + 17, 3, 1, '#e0b040');
      } else {
        PX.vline(c, 13, pad + 10, pad + 19, '#24161a');
        PX.vline(c, 14, pad + 9, pad + 19, '#24161a');
        PX.vline(c, 13, pad + 11, pad + 18, '#dfe6ee');
        PX.vline(c, 14, pad + 10, pad + 18, '#a9b4c0');
        PX.rect(c, 12, pad + 18, 4, 1, '#e0b040');
        PX.rect(c, 13, pad + 19, 2, 2, '#6a4026');
      }
    },
    bow(c, pose, pad) {
      const x = pose === 'side' ? 0 : 13;
      for (let j = 0; j < 12; j++) {
        const dx = Math.round(Math.sin((j / 11) * Math.PI) * 2) * (pose === 'side' ? -1 : 1);
        PX.p(c, x + dx + (pose === 'side' ? 2 : 0), pad + 9 + j, '#8a5a32');
      }
      PX.vline(c, x + (pose === 'side' ? 2 : 0), pad + 9, pad + 20, '#efe6d0');
    },
    tray(c, pose, pad) {
      PX.rect(c, 10, pad + 16, 6, 1, '#24161a');
      PX.rect(c, 10, pad + 15, 6, 1, '#c8c0b0');
      PX.rect(c, 11, pad + 12, 2, 3, '#e0a040');
      PX.rect(c, 11, pad + 12, 2, 1, '#fff4d0');
    },
    book(c, pose, pad) {
      PX.rect(c, 5, pad + 16, 6, 4, '#24161a');
      PX.rect(c, 6, pad + 17, 4, 2, '#7a2e2e');
      PX.p(c, 8, pad + 17, '#e0b040');
    },
  };

  // ---------------------------------------------------------------- 登場人物
  SP.CAST = {
    hero: { hair: '#5a3424', skin: '#f2c6a0', outfit: '#3a5a9a', accent: '#c8962e', pants: '#4a3a30', boots: '#5a3424', style: 'spiky', item: 'sword', eye: '#2a2a50' },
    rina: { hair: '#9a4a2a', skin: '#f6d0b0', outfit: '#3f7a5e', accent: '#f2ead8', pants: '#3a3448', style: 'pony', eye: '#2a4030' },
    warrior: { hair: '#c8562e', skin: '#e8b48a', outfit: '#a83a2e', accent: '#d8b048', pants: '#4a3426', hatType: 'helm', hat: '#9aa6b4', item: 'sword' },
    mage: { hair: '#e8d090', skin: '#f6d6bc', outfit: '#3a4ea0', accent: '#e8c050', pants: '#2e2a48', style: 'long', hatType: 'wizard', hat: '#34449a', item: 'staff', eye: '#3a3a8a' },
    archer: { hair: '#6a8a3a', skin: '#e8c09a', outfit: '#4a7a3a', accent: '#a07038', pants: '#5a4630', hatType: 'cap', hat: '#3e6a32', item: 'bow' },
    cleric: { hair: '#e8e2d0', skin: '#f2d2b8', outfit: '#ece4d4', accent: '#c8962e', pants: '#9a8a7a', hatType: 'hood', hat: '#a8bce0', item: 'staff', orb: '#ffe680' },
    thief: { hair: '#2a2a3a', skin: '#d8a882', outfit: '#3a3a4a', accent: '#a8342e', pants: '#2a2a34', hatType: 'kerchief', hat: '#a8342e' },
    barkeep: { hair: '#5a3a2a', skin: '#e0a87e', outfit: '#efe4cc', accent: '#7a4a2a', pants: '#3a2e28', style: 'bald' },
    townA: { hair: '#7a5030', skin: '#f0c8a4', outfit: '#9a5a3a', accent: '#e0d0a0', pants: '#4a4a5a', style: 'bob' },
    townB: { hair: '#30283a', skin: '#e8b890', outfit: '#5a6a8a', accent: '#c8b080', pants: '#3a3028', hatType: 'kerchief', hat: '#c8a050' },
    townC: { hair: '#c8a060', skin: '#f6d8bc', outfit: '#8a3a5a', accent: '#f0e0c0', pants: '#4a2e3e', style: 'long' },
    child: { hair: '#e0a040', skin: '#f6d0b0', outfit: '#d8783a', accent: '#f0e8d0', pants: '#5a4a3a', style: 'short' },
  };

  // ---------------------------------------------------------------- 顔グラ（会話用 40×40・形から組み立てて陰影を付ける）
  SP.portrait = function (key) {
    const o = SP.CAST[key];
    const d = (c, k) => PX.mix(c, '#140c10', k);
    const l = (c, k) => PX.mix(c, '#fff4e0', k);
    const ramp = (c) => [d(c, 0.6), d(c, 0.42), d(c, 0.22), c, l(c, 0.22), l(c, 0.42)];
    const out = PX.canvas(40, 40);
    const c = out.ctx;
    const draw = (spr) => c.drawImage(spr, 0, 0);
    const noLine = { outline: null };
    // 後ろ髪とポニーテール
    draw(PX.shaped(40, 40, (m) => {
      PX.ellipse(m, 20, 15, 14, 13, '#fff');
      PX.rect(m, 6, 14, 6, 16, '#fff');
      PX.rect(m, 28, 14, 6, 16, '#fff');
      PX.poly(m, [31, 8, 37, 10, 38, 20, 35, 27, 33, 18], '#fff');
    }, ramp(o.hair), Object.assign({ base: 2 }, noLine)));
    // 服（ベスト）と首
    draw(PX.shaped(40, 40, (m) => { PX.poly(m, [4, 40, 7, 33, 13, 30, 27, 30, 33, 33, 36, 40], '#fff'); }, ramp(o.outfit), Object.assign({ vgrad: 1.2 }, noLine)));
    draw(PX.shaped(40, 40, (m) => { PX.poly(m, [14, 30, 26, 30, 20, 38], '#fff'); }, ramp(o.accent), Object.assign({ base: 4 }, noLine)));
    draw(PX.shaped(40, 40, (m) => { PX.rect(m, 17, 26, 6, 6, '#fff'); PX.poly(m, [16, 30, 24, 30, 20, 34], '#fff'); }, [PX.mix(o.skin, '#140c10', 0.14), PX.mix(o.skin, '#140c10', 0.14), PX.mix(o.skin, '#140c10', 0.07), PX.mix(o.skin, '#140c10', 0.07)], Object.assign({ base: 3 }, noLine)));
    // 顔
    const skinRamp = [d(o.skin, 0.22), d(o.skin, 0.1), o.skin, o.skin, l(o.skin, 0.12), l(o.skin, 0.22)];
    draw(PX.shaped(40, 40, (m) => { PX.ellipse(m, 20, 18, 10, 9, '#fff'); PX.poly(m, [11, 19, 29, 19, 26, 26, 22, 28, 18, 28, 14, 26], '#fff'); }, skinRamp, Object.assign({ base: 3 }, noLine)));
    // 前髪
    draw(PX.shaped(40, 40, (m) => {
      PX.poly(m, [7, 17, 8, 8, 13, 4, 20, 3, 27, 4, 32, 8, 33, 17, 31, 13, 29, 15, 27, 10, 24, 14, 21, 9, 18, 14, 15, 10, 12, 15, 10, 12], '#fff');
      PX.rect(m, 7, 14, 3, 12, '#fff');
      PX.rect(m, 30, 14, 3, 12, '#fff');
    }, ramp(o.hair), Object.assign({ base: 3, rim: true }, noLine)));
    // ハイライト（天使の輪）
    [[12, 7], [13, 7], [14, 6], [15, 6], [16, 6], [24, 6], [25, 6], [26, 7]].forEach(([x, y]) => PX.p(c, x, y, l(o.hair, 0.55)));
    // 目
    const iris = o.eye || '#2a3a30';
    const eye = (x, outer, dir) => {
      PX.hline(c, x - 1, x + 4, 16, '#24161a');
      PX.p(c, outer, 15, '#24161a');
      PX.p(c, outer, 17, '#24161a');
      PX.rect(c, x, 17, 4, 6, d(iris, 0.45));
      PX.rect(c, x, 19, 4, 2, iris);
      PX.rect(c, x, 21, 4, 2, l(iris, 0.12));
      PX.hline(c, x + 1, x + 2, 22, l(iris, 0.35));
      PX.rect(c, x + (dir > 0 ? 0 : 2), 17, 2, 2, '#ffffff');
      PX.p(c, x + (dir > 0 ? 3 : 0), 21, '#ffffff');
      PX.hline(c, x, x + 3, 23, d(o.skin, 0.15));
    };
    eye(12, 11, 1);
    eye(24, 28, 1);
    // 眉・鼻・口・頬
    PX.hline(c, 12, 15, 13, d(o.hair, 0.3));
    PX.hline(c, 24, 27, 13, d(o.hair, 0.3));
    PX.p(c, 20, 24, d(o.skin, 0.16));
    PX.hline(c, 19, 21, 26, '#a04a3a');
    PX.p(c, 18, 25, d(o.skin, 0.25));
    PX.p(c, 22, 25, d(o.skin, 0.25));
    // あごの下の影
    PX.hline(c, 18, 22, 29, d(o.skin, 0.12));
    PX.dither(c, 11, 23, 3, 2, 'rgba(0,0,0,0)', PX.mix(o.skin, '#e86a6a', 0.45), 0.5);
    PX.dither(c, 26, 23, 3, 2, 'rgba(0,0,0,0)', PX.mix(o.skin, '#e86a6a', 0.45), 0.5);
    // ボタンと輪郭
    PX.p(c, 20, 36, '#e0b040');
    PX.p(c, 20, 38, '#e0b040');
    PX.outline(out.cv, '#24161a');
    return out.cv;
  };

  // ---------------------------------------------------------------- 顔グラ（会話用 40×40）
  // 手描きの線画を、色の文字で塗り分ける
  SP.PORTRAIT_RINA = [
    '..............KKKKKKK...................',
    '...........KKKHHHHHHHKKK................',
    '.........KKHHHHHHLLHHHHHKK..............',
    '........KHHHHHHHLLLHHHHHHHK.............',
    '.......KHHHHHHHLLHHHHHHHHHHK............',
    '......KHHHHHHHHHHHHHHHHHHHHhK...........',
    '.....KHHHHHHHHHHHHHHHHHHHHHhhK..........',
    '.....KHHHHHHHHHHHHHHHHHHHHHhhK...KKK....',
    '....KHHHHHHHHHHHHHHHHHHHHHHhhhK.KHHhK...',
    '....KHHHHHhHHHHHHHHHHHhHHHHhhhKKHHhhK...',
    '....KHHHHhSHHHHHHHHHHhSShHHhhhKHHhhhK...',
    '...KHHHHhSSSHHHHHHHHhSSSShHhhhKHhhhK....',
    '...KHHHHhSSSSHHHHHHhSSSSSShhhhKHhhK.....',
    '...KHHHhSSSSSSHHHHhSSSSSSSShhhKhhhK.....',
    '...KHHhSSSSSSSSSSSSSSSSSSSSShhKhhK......',
    '...KHhSSKKKKSSSSSSSSKKKKSSSShhKhK.......',
    '...KhSSKEEEWKSSSSSSKWEEEKSSShhKK........',
    '...KhSSKEEEEKSSSSSSKEEEEKSSSShK.........',
    '...KhSSKEEEEKSSSSSSKEEEEKSSSShK.........',
    '...KHSSSKKKKSSSSSSSSKKKKSSSSShK.........',
    '....KSRRSSSSSSSSSSSSSSSSSRRSSK..........',
    '....KSRRSSSSSSSsSSSSSSSSSRRSSK..........',
    '.....KSSSSSSSSSSSSSSSSSSSSSSK...........',
    '.....KSSSSSSSSSMMMMSSSSSSSSK............',
    '......KSSSSSSSSSMMSSSSSSSsK.............',
    '.......KsSSSSSSSSSSSSSSsKK..............',
    '........KKsSSSSSSSSSssKK................',
    '..........KKKsSSSssKKK..................',
    '............KsSSSsK.....................',
    '..........KKKsSSSsKKK...................',
    '........KKAAAKsSsKAAAKK.................',
    '......KKOOAAAAKKKAAAAOOKK...............',
    '.....KOOOOOAAAAAAAAAOOOOOK..............',
    '....KOOOOOOOAAAAAAAOOOOOOoK.............',
    '...KOOQOOOOOOAAAAAOOOOOOOooK............',
    '...KOQOOOOOOOOAAAOOOOOOOOooK............',
    '..KOOOOOOOOOOOOGOOOOOOOOOoooK...........',
    '..KOOOOOOOOOOOOAOOOOOOOOOoooK...........',
    '..KOOOOOOOOOOOOGOOOOOOOOOoooK...........',
    '..KKKKKKKKKKKKKKKKKKKKKKKKKKK...........',
  ];
})();
