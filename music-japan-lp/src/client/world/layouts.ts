/**
 * WebGL の「かたち」。同じ点の群れが、スクロールにあわせて次のかたちへ移る。
 *
 *   0 DUST       離れている点（会社・人）
 *   1 NETWORK    線が生まれる（Music Japan を中心に、5つのサービス）
 *   2 PAGES      ページが形成される（1社5ページ、奥へ展開）
 *   3 SEARCH     検索結果が積み上がる
 *   4 BUILDLINE  8つの工程が横に並ぶ（横スクロールと同期）
 *   5 PROJECTS   2社の世界（エボルグの赤と水色、Central AX の白と青）
 *   6 WAVE       声の波形（SECOND TAKE）
 *   7 LOG        活動の記録（タイムライン）
 *   8 MARK       Music Japan のレコード
 *   9 CONNECT    2つの点が、人の手でつながる
 *
 * 1点 = vec4(x, y, z, w)。w = 種類 + 16 × グループ（ハイライト用。ハブ番号・ページ番号など）
 * 種類: 0 塵 / 1 明るい点 / 2 赤 / 3 水色 / 4 青 / 5 淡い構造 / 6 波（赤・動く） / 7 見えない / 8 手前でぼける大きな光
 */
export const L = { DUST: 0, NETWORK: 1, PAGES: 2, SEARCH: 3, BUILDLINE: 4, PROJECTS: 5, WAVE: 6, LOG: 7, MARK: 8, CONNECT: 9 } as const;
export const LAYOUT_COUNT = 10;

export type LineSpec = { a: number; b: number; layout: number; order: number; color: 0 | 1 | 2 | 3; ga: number; gb: number };
export type Built = {
  data: Float32Array; // N*4 per layout, concatenated by layout
  lines: LineSpec[];
  anchors: Record<number, [number, number, number][]>; // DOMラベル用の基準点（レイアウト空間）
  refSize: number[]; // DOM要素に合わせるときの基準の大きさ（レイアウト空間の単位）
};

const W = (cat: number, group = 0) => cat + 16 * group;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 各レイアウトの書き込み口。take() で構造用の点を順に取り、残りは塵にする */
class Writer {
  private used = 0;
  readonly perm: Int32Array;
  constructor(
    readonly n: number,
    readonly out: Float32Array,
    readonly base: number,
    readonly r: () => number,
  ) {
    this.perm = new Int32Array(n);
    for (let i = 0; i < n; i++) this.perm[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = this.perm[i];
      this.perm[i] = this.perm[j];
      this.perm[j] = t;
    }
  }
  get left() {
    return this.n - this.used;
  }
  /** 点をひとつ置き、その点の番号を返す */
  put(x: number, y: number, z: number, w: number): number {
    if (this.used >= this.n) return -1;
    const idx = this.perm[this.used++];
    const o = this.base + idx * 4;
    this.out[o] = x;
    this.out[o + 1] = y;
    this.out[o + 2] = z;
    this.out[o + 3] = w;
    return idx;
  }
  /** 残りを塵で埋める */
  fill(fn: (r: () => number) => [number, number, number, number]) {
    while (this.used < this.n) {
      const [x, y, z, w] = fn(this.r);
      this.put(x, y, z, w);
    }
  }
}

const dustBox = (sx: number, sy: number, z0: number, z1: number, cat = 0) => (r: () => number): [number, number, number, number] => [
  (r() * 2 - 1) * sx,
  (r() * 2 - 1) * sy,
  z0 + r() * (z1 - z0),
  W(cat),
];

/** 長方形の枠（点を等間隔に） */
function rectOutline(w: Writer, cx: number, cy: number, cz: number, rw: number, rh: number, step: number, cat: number, group: number) {
  const ids: number[] = [];
  const nx = Math.max(2, Math.round(rw / step));
  const ny = Math.max(2, Math.round(rh / step));
  for (let i = 0; i <= nx; i++) {
    const x = cx - rw / 2 + (rw * i) / nx;
    ids.push(w.put(x, cy + rh / 2, cz, W(cat, group)));
    ids.push(w.put(x, cy - rh / 2, cz, W(cat, group)));
  }
  for (let j = 1; j < ny; j++) {
    const y = cy - rh / 2 + (rh * j) / ny;
    ids.push(w.put(cx - rw / 2, y, cz, W(cat, group)));
    ids.push(w.put(cx + rw / 2, y, cz, W(cat, group)));
  }
  return ids;
}

/** 長方形の面（ざらっとした点描） */
function rectFill(w: Writer, cx: number, cy: number, cz: number, rw: number, rh: number, count: number, cat: number, group: number) {
  for (let i = 0; i < count; i++) w.put(cx + (w.r() - 0.5) * rw, cy + (w.r() - 0.5) * rh, cz + (w.r() - 0.5) * 0.04, W(cat, group));
}

/** 文字の行（点の列） */
function textLine(w: Writer, x0: number, y: number, z: number, len: number, step: number, cat: number, group: number) {
  for (let x = 0; x <= len; x += step) w.put(x0 + x, y + (w.r() - 0.5) * 0.015, z, W(cat, group));
}

/** 角の4点（線を張るため） */
function corners(w: Writer, cx: number, cy: number, cz: number, rw: number, rh: number, cat: number, group: number) {
  return [
    w.put(cx - rw / 2, cy + rh / 2, cz, W(cat, group)),
    w.put(cx + rw / 2, cy + rh / 2, cz, W(cat, group)),
    w.put(cx + rw / 2, cy - rh / 2, cz, W(cat, group)),
    w.put(cx - rw / 2, cy - rh / 2, cz, W(cat, group)),
  ];
}

function loop(lines: LineSpec[], ids: number[], layout: number, color: 0 | 1 | 2, order = 0, ga = -1) {
  for (let i = 0; i < ids.length; i++) lines.push({ a: ids[i], b: ids[(i + 1) % ids.length], layout, order, color, ga, gb: ga });
}

/** エコシステムの位置（DOMの代替表示と同じ並び：上・右上・右下・左下・左上） */
export const HUBS: { id: string; angle: number }[] = [
  { id: 'mj', angle: NaN },
  { id: 'partners', angle: 90 },
  { id: 'baton', angle: 18 },
  { id: 'secondtake', angle: -54 },
  { id: 'search', angle: -126 },
  { id: 'intro', angle: 162 },
];
export const HUB_EDGES: [string, string, boolean][] = [
  ['partners', 'search', false],
  ['baton', 'search', false],
  ['secondtake', 'search', false],
  ['secondtake', 'baton', false],
  ['partners', 'baton', false],
  ['partners', 'mj', true],
  ['baton', 'mj', true],
  ['mj', 'intro', true],
];

export function buildLayouts(n: number, mobile: boolean): Built {
  const data = new Float32Array(n * 4 * LAYOUT_COUNT);
  const lines: LineSpec[] = [];
  const anchors: Built['anchors'] = {};
  const refSize = new Array(LAYOUT_COUNT).fill(1);
  const scale = n / 9000; // 点の数に応じて構造の密度を調整

  /* 0 DUST ─ 離れている点（会社・人）。ときどき2つの点のあいだに赤い線が引かれ、消える（どこかで紹介が起きている） */
  {
    const w = new Writer(n, data, n * 4 * L.DUST, rng(11));
    const nodes: [number, number, number, number][] = [];
    const count = Math.round(300 * Math.max(0.55, scale));
    for (let i = 0; i < count; i++) {
      // 見出しのある左より、右に少し多く
      const u = w.r();
      const x = mobile ? (u * 2 - 1) * 4.4 : (Math.pow(u, 0.72) * 2 - 1) * 9.6;
      const y = (w.r() * 2 - 1) * (mobile ? 6.4 : 5.1);
      const z = -5 + w.r() * 6.2;
      const red = i % 13 === 0;
      const id = w.put(x, y, z, W(red ? 2 : 1, 1));
      nodes.push([x, y, z, id]);
    }
    // 紹介の線：離れた2点を結ぶ（線ごとに、引かれる時刻がずれる）。見出しと重ならないよう、大きな画面では右寄りの点どうし
    for (let t = 0, made = 0; t < 8000 && made < (mobile ? 12 : 22); t++) {
      const A = nodes[Math.floor(w.r() * nodes.length)];
      const B = nodes[Math.floor(w.r() * nodes.length)];
      if (A === B || Math.abs(A[2] - B[2]) > 1.6) continue;
      if (!mobile && (A[0] < -1.5 || B[0] < -1.5)) continue;
      const d = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (d < (mobile ? 1.6 : 2.2) || d > (mobile ? 4.2 : 6)) continue;
      lines.push({ a: A[3], b: B[3], layout: L.DUST, order: 0, color: 3, ga: -1, gb: -1 });
      made++;
    }
    // 手前を横切る、ぼけた大きな光（カメラに映る範囲の中に置く）
    for (let i = 0; i < (mobile ? 9 : 18); i++) {
      const z = 2.5 + w.r() * 4;
      const hh = (12 - z) * 0.344 * 0.85;
      const hw = hh * (mobile ? 0.5 : 1.6);
      w.put((w.r() * 2 - 1) * hw, (w.r() * 2 - 1) * hh, z, W(8));
    }
    // 近い点どうしに、カーソルが近づくと見える線
    for (let i = 0; i < nodes.length; i++) {
      const d: [number, number][] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        d.push([dx * dx + dy * dy + dz * dz, j]);
      }
      d.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 3; k++) {
        const j = d[k][1];
        if (j > i && d[k][0] < 6.2) lines.push({ a: nodes[i][3], b: nodes[j][3], layout: L.DUST, order: 0, color: 2, ga: -1, gb: -1 });
      }
    }
    w.fill((r) => {
      const [x, y, z] = dustBox(15, 9, -22, 3)(r);
      return [x, y, z, W(r() < 0.08 ? 5 : 0)];
    });
  }

  /* 1 NETWORK ─ ハブと、ハブをつなぐ束 */
  {
    const w = new Writer(n, data, n * 4 * L.NETWORK, rng(23));
    const R = 3.1;
    const centers: [number, number, number][] = HUBS.map((h, i) => {
      if (Number.isNaN(h.angle)) return [0, 0, 0];
      const a = (h.angle * Math.PI) / 180;
      return [Math.cos(a) * R, Math.sin(a) * R, i % 2 ? 0.55 : -0.55];
    });
    anchors[L.NETWORK] = centers;
    refSize[L.NETWORK] = 2 * R + 2.4;
    const members: number[][] = centers.map(() => []);
    centers.forEach(([cx, cy, cz], h) => {
      const core = Math.round((h === 0 ? 300 : 190) * scale);
      const cat = h === 0 ? 2 : 1;
      for (let i = 0; i < core; i++) {
        const rr = Math.abs(gauss(w.r)) * (h === 0 ? 0.32 : 0.24);
        const th = w.r() * Math.PI * 2;
        const ph = Math.acos(2 * w.r() - 1);
        const id = w.put(cx + rr * Math.sin(ph) * Math.cos(th), cy + rr * Math.sin(ph) * Math.sin(th), cz + rr * Math.cos(ph), W(i % 9 === 0 ? 1 : cat, h));
        members[h].push(id);
      }
      // 環（衛星の軌道）
      const ring = Math.round((h === 0 ? 140 : 90) * scale);
      const rad = h === 0 ? 0.95 : 0.66;
      const tilt = 0.5 + h * 0.37;
      const ringIds: number[] = [];
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad * Math.cos(tilt);
        const z = Math.sin(a) * rad * Math.sin(tilt);
        ringIds.push(w.put(cx + x, cy + y, cz + z, W(5, h)));
      }
      loop(lines, ringIds.filter((_, k) => k % 3 === 0), L.NETWORK, h === 0 ? 1 : 0, 0, h);
    });
    // ハブをつなぐ束（順番に生えてくる）
    HUB_EDGES.forEach(([fa, fb, human], e) => {
      const ha = HUBS.findIndex((h) => h.id === fa);
      const hb = HUBS.findIndex((h) => h.id === fb);
      const bundle = Math.max(10, Math.round(26 * scale));
      for (let k = 0; k < bundle; k++) {
        const a = members[ha][Math.floor(w.r() * members[ha].length)];
        const b = members[hb][Math.floor(w.r() * members[hb].length)];
        lines.push({ a, b, layout: L.NETWORK, order: (e + w.r() * 0.6) / HUB_EDGES.length, color: human ? 1 : 0, ga: ha, gb: hb });
      }
    });
    // 銀河の円盤のような塵
    w.fill((r) => {
      const a = r() * Math.PI * 2;
      const rr = 2 + Math.pow(r(), 0.6) * 8.5;
      return [Math.cos(a) * rr, Math.sin(a) * rr * 0.62, -2.6 + gauss(r) * 0.6, W(r() < 0.06 ? 5 : 0)];
    });
  }

  /* 2 PAGES ─ 1社5ページ。奥へ広げた紙の束 */
  {
    const w = new Writer(n, data, n * 4 * L.PAGES, rng(37));
    const pw = 2.3;
    const ph = 3.05;
    const centers: [number, number, number][] = [];
    for (let k = 0; k < 5; k++) {
      const cx = -1.5 + k * 0.78;
      const cy = 0.55 - k * 0.32;
      const cz = 1.6 - k * 1.25;
      centers.push([cx, cy, cz]);
      const d = Math.max(0.5, scale);
      const out = rectOutline(w, cx, cy, cz, pw, ph, 0.075 / Math.sqrt(d), 1, k);
      void out;
      const c = corners(w, cx, cy, cz, pw, ph, 1, k);
      loop(lines, c, L.PAGES, 0, 0, k);
      // ヘッダー
      textLine(w, cx - pw / 2 + 0.16, cy + ph / 2 - 0.2, cz, 0.42, 0.05, 1, k);
      textLine(w, cx + pw / 2 - 0.9, cy + ph / 2 - 0.2, cz, 0.74, 0.12, 5, k);
      // ページごとの中身
      if (k === 0) {
        rectFill(w, cx, cy + 0.52, cz, pw - 0.32, 1.05, Math.round(420 * d), 2, k); // トップ：世界観の大きな面
        for (let t = 0; t < 3; t++) textLine(w, cx - pw / 2 + 0.16, cy - 0.32 - t * 0.2, cz, 1.6 - t * 0.35, 0.045, 5, k);
        rectFill(w, cx - pw / 2 + 0.5, cy - 1.14, cz, 0.68, 0.17, Math.round(60 * d), 2, k);
      } else if (k === 1) {
        rectFill(w, cx - 0.52, cy + 0.42, cz, 0.9, 1.15, Math.round(220 * d), 5, k); // 代表者の写真
        for (let t = 0; t < 5; t++) textLine(w, cx + 0.06, cy + 0.9 - t * 0.2, cz, 0.85, 0.05, 5, k);
        for (let t = 0; t < 4; t++) textLine(w, cx - pw / 2 + 0.16, cy - 0.5 - t * 0.2, cz, 1.9, 0.05, 5, k);
      } else if (k === 2) {
        textLine(w, cx - pw / 2 + 0.16, cy + 1.05, cz, 1.6, 0.04, 1, k); // 記事の見出し
        textLine(w, cx - pw / 2 + 0.16, cy + 0.86, cz, 1.1, 0.04, 1, k);
        for (let t = 0; t < 10; t++) textLine(w, cx - pw / 2 + 0.16, cy + 0.55 - t * 0.17, cz, t % 4 === 3 ? 1.1 : 1.9, 0.055, 5, k);
      } else if (k === 3) {
        for (let b = 0; b < 3; b++) rectFill(w, cx - 0.66 + b * 0.66, cy + 0.42, cz, 0.56, 0.8, Math.round(70 * d), b === 0 ? 1 : 5, k);
        for (let t = 0; t < 5; t++) textLine(w, cx - pw / 2 + 0.16, cy - 0.35 - t * 0.19, cz, 1.9, 0.05, 5, k);
      } else {
        for (let f = 0; f < 4; f++) rectOutline(w, cx, cy + 0.85 - f * 0.42, cz, pw - 0.36, 0.26, 0.1, 5, k); // アンケート
        rectFill(w, cx, cy - 1.1, cz, pw - 0.36, 0.3, Math.round(90 * d), 2, k); // 話してみる
      }
    }
    anchors[L.PAGES] = centers;
    refSize[L.PAGES] = 6.2;
    // 束の角をつなぐ線
    w.fill(dustBox(12, 8, -16, 2));
  }

  /* 3 SEARCH ─ 検索窓と、積み上がる結果 */
  {
    const w = new Writer(n, data, n * 4 * L.SEARCH, rng(41));
    const bw = 4.6;
    const top = 2.25;
    const box = rectOutline(w, 0, top, 0.4, bw, 0.46, 0.06, 1, 0);
    void box;
    textLine(w, -bw / 2 + 0.3, top, 0.4, 1.1, 0.05, 1, 0);
    for (let i = 0; i < 12; i++) w.put(-bw / 2 + 1.5, top - 0.15 + i * 0.027, 0.4, W(2, 0)); // カーソル
    for (let k = 0; k < 6; k++) {
      const cy = 1.45 - k * 0.66;
      const cz = 0.2 - k * 0.32;
      const first = k === 0;
      const c = corners(w, 0, cy, cz, bw, 0.5, first ? 2 : 1, k + 1);
      loop(lines, c, L.SEARCH, first ? 1 : 0, 0, k + 1);
      textLine(w, -bw / 2 + 0.18, cy + 0.12, cz, first ? 2.4 : 1.9, 0.04, first ? 2 : 1, k + 1);
      textLine(w, -bw / 2 + 0.18, cy - 0.04, cz, 3.6, 0.07, 5, k + 1);
      textLine(w, -bw / 2 + 0.18, cy - 0.16, cz, 2.6, 0.07, 5, k + 1);
      if (first) rectFill(w, 0, cy, cz - 0.05, bw, 0.5, Math.round(160 * Math.max(0.5, scale)), 2, k + 1);
    }
    refSize[L.SEARCH] = 6;
    w.fill((r) => {
      // 下から湧き上がるように
      const x = (r() * 2 - 1) * 9;
      const y = -6 + Math.pow(r(), 1.6) * 12;
      return [x, y, -10 + r() * 9, W(0)];
    });
  }

  /* 4 BUILDLINE ─ 8つの工程が横一列に */
  {
    const w = new Writer(n, data, n * 4 * L.BUILDLINE, rng(53));
    const sp = 3.6;
    const xs = Array.from({ length: 8 }, (_, i) => (i - 3.5) * sp);
    anchors[L.BUILDLINE] = xs.map((x) => [x, 0, 0]);
    const d = Math.max(0.5, scale);
    // 0 調べる：散らばった点と、走査の線
    for (let i = 0; i < 160 * d; i++) w.put(xs[0] + (w.r() - 0.5) * 2.2, (w.r() - 0.5) * 1.8, (w.r() - 0.5) * 0.8, W(i % 11 === 0 ? 2 : 1, 0));
    textLine(w, xs[0] - 1.1, 0.2, 0.2, 2.2, 0.04, 2, 0);
    // 1 つかむ：重なる3つの円
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + Math.PI / 2;
      for (let i = 0; i < 70 * d; i++) {
        const t = (i / (70 * d)) * Math.PI * 2;
        w.put(xs[1] + Math.cos(a) * 0.38 + Math.cos(t) * 0.62, Math.sin(a) * 0.38 + Math.sin(t) * 0.62, 0, W(c === 1 ? 2 : 1, 1));
      }
    }
    // 2 世界観：4色
    [2, 3, 1, 4].forEach((cat, c) => {
      for (let i = 0; i < 60 * d; i++) w.put(xs[2] - 0.9 + c * 0.6 + gauss(w.r) * 0.12, gauss(w.r) * 0.5, gauss(w.r) * 0.12, W(cat, 2));
    });
    // 3 つくる：小さなページの束
    for (let k = 0; k < 5; k++) {
      const c = corners(w, xs[3] - 0.5 + k * 0.25, 0.4 - k * 0.2, -k * 0.4, 1.1, 1.45, k === 0 ? 2 : 1, 3);
      loop(lines, c, L.BUILDLINE, k === 0 ? 1 : 0, 0, 3);
      rectFill(w, xs[3] - 0.5 + k * 0.25, 0.65 - k * 0.2, -k * 0.4, 0.9, 0.4, 24 * d, k === 0 ? 2 : 5, 3);
    }
    // 4 検索に備える：3本の結果
    for (let k = 0; k < 3; k++) {
      const c = corners(w, xs[4], 0.6 - k * 0.55, 0, 2.0, 0.36, k === 0 ? 2 : 1, 4);
      loop(lines, c, L.BUILDLINE, k === 0 ? 1 : 0, 0, 4);
      textLine(w, xs[4] - 0.85, 0.6 - k * 0.55, 0, 1.4, 0.05, k === 0 ? 2 : 5, 4);
    }
    // 5 公開：放射状の光
    for (let i = 0; i < 220 * d; i++) {
      const a = w.r() * Math.PI * 2;
      const rr = Math.pow(w.r(), 0.5) * 1.15;
      w.put(xs[5] + Math.cos(a) * rr, Math.sin(a) * rr, (w.r() - 0.5) * 0.3, W(rr < 0.25 ? 2 : 1, 5));
    }
    // 6 育てる：伸びる棒
    for (let b = 0; b < 5; b++) {
      const h = 0.4 + b * 0.36;
      for (let i = 0; i < 26 * d; i++) w.put(xs[6] - 0.9 + b * 0.45 + (w.r() - 0.5) * 0.16, -0.9 + w.r() * h, 0, W(b === 4 ? 2 : 1, 6));
    }
    // 7 つなぐ：2つの点と赤い線
    for (let i = 0; i < 90 * d; i++) w.put(xs[7] - 1 + gauss(w.r) * 0.1, gauss(w.r) * 0.1, gauss(w.r) * 0.1, W(1, 7));
    for (let i = 0; i < 90 * d; i++) w.put(xs[7] + 1 + gauss(w.r) * 0.1, gauss(w.r) * 0.1, gauss(w.r) * 0.1, W(2, 7));
    textLine(w, xs[7] - 0.9, 0, 0, 1.8, 0.03, 2, 7);
    // 工程をつなぐレール
    textLine(w, xs[0] - 1.4, -1.6, 0, xs[7] - xs[0] + 2.8, 0.035, 5, 8);
    refSize[L.BUILDLINE] = 1;
    w.fill(dustBox(22, 8, -16, 2));
  }

  /* 5 PROJECTS ─ 2社の色の渦 */
  {
    const w = new Writer(n, data, n * 4 * L.PROJECTS, rng(67));
    const spiral = (cx: number, cy: number, catA: number, catB: number, group: number, count: number, dir: number) => {
      for (let i = 0; i < count; i++) {
        const arm = i % 3;
        const t = Math.pow(w.r(), 0.7);
        const a = dir * (t * 5.2 + (arm * Math.PI * 2) / 3) + gauss(w.r) * 0.18;
        const rr = 0.15 + t * 3.2;
        w.put(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.55, -1.5 + gauss(w.r) * 0.25 - t * 1.2, W(w.r() < 0.5 ? catA : catB, group));
      }
    };
    const c = Math.round(1500 * Math.max(0.4, scale));
    spiral(mobile ? 0 : -5.2, mobile ? 3.2 : 1.2, 2, 3, 0, c, 1);
    spiral(mobile ? 0 : 5.2, mobile ? -3.2 : -1.6, 1, 4, 1, c, -1);
    w.fill(dustBox(15, 9, -20, 2));
  }

  /* 6 WAVE ─ 声の波形の輪と、レコードの溝 */
  {
    const w = new Writer(n, data, n * 4 * L.WAVE, rng(79));
    const ring = Math.round(1400 * Math.max(0.45, scale));
    const ids: number[] = [];
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      ids.push(w.put(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0, W(6, 0)));
    }
    loop(lines, ids.filter((_, k) => k % 2 === 0), L.WAVE, 1, 0, 0);
    // 溝
    for (let g = 0; g < 7; g++) {
      const rad = 0.75 + g * 0.2;
      const cnt = Math.round((90 + g * 22) * Math.max(0.5, scale));
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2;
        w.put(Math.cos(a) * rad, Math.sin(a) * rad, 0, W(a > Math.PI / 2 && a < (3 * Math.PI) / 2 ? 1 : 5, 1));
      }
    }
    // 中心のラベル
    for (let i = 0; i < 120 * Math.max(0.5, scale); i++) {
      const a = w.r() * Math.PI * 2;
      const rr = Math.sqrt(w.r()) * 0.5;
      w.put(Math.cos(a) * rr, Math.sin(a) * rr, 0, W(2, 2));
    }
    anchors[L.WAVE] = [[0, 0, 0]];
    refSize[L.WAVE] = 6.6;
    w.fill((r) => {
      const a = r() * Math.PI * 2;
      const rr = 3 + Math.pow(r(), 0.7) * 10;
      return [Math.cos(a) * rr, Math.sin(a) * rr, -4 + gauss(r) * 3, W(0)];
    });
  }

  /* 7 LOG ─ 活動のタイムライン */
  {
    const w = new Writer(n, data, n * 4 * L.LOG, rng(83));
    const span = mobile ? 7 : 16;
    textLine(w, -span / 2, -0.4, 0, span, 0.03, 5, 0);
    const events = 11;
    for (let e = 0; e < events; e++) {
      const x = -span / 2 + ((e + 0.5) / events) * span;
      const h = 0.5 + ((e * 37) % 10) / 10 * 1.9;
      for (let i = 0; i < 40; i++) w.put(x + gauss(w.r) * 0.035, -0.4 + (i / 40) * h, 0, W(e === events - 1 ? 2 : 1, e));
      for (let i = 0; i < 30; i++) w.put(x + gauss(w.r) * 0.06, -0.4 + h + gauss(w.r) * 0.06, gauss(w.r) * 0.06, W(e % 4 === 0 ? 2 : 1, e));
    }
    refSize[L.LOG] = 1;
    w.fill((r) => {
      const x = (r() * 2 - 1) * 14;
      return [x, -0.4 + gauss(r) * 1.4, -6 + r() * 7, W(r() < 0.1 ? 5 : 0)];
    });
  }

  /* 8 MARK ─ Music Japan のレコード（公式シンボル） */
  {
    const w = new Writer(n, data, n * 4 * L.MARK, rng(97));
    const s = 0.105; // シンボルの64単位 → 約6.7
    const P = (x: number, y: number): [number, number] => [(x - 32) * s, -(y - 32) * s];
    const RINGS = [27, 23.6, 20.2, 16.8, 13.4, 10];
    RINGS.forEach((r, g) => {
      const cnt = Math.round((220 - g * 18) * Math.max(0.5, scale));
      const ringIds: number[] = [];
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2;
        const left = Math.cos(a) < 0;
        const [x, y] = P(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
        ringIds.push(w.put(x, y, 0, W(left ? 1 : 5, g)));
      }
      loop(lines, ringIds.filter((_, k) => k % 4 === 0), L.MARK, 0, 0, g);
    });
    // 赤い弧と点
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = Math.PI + (Math.PI / 2) * t;
      const [x, y] = P(32 + Math.cos(a) * 7.6 + 0.2, 32 + Math.sin(a) * 7.6 - 0.6);
      w.put(x, y, 0.05, W(2, 7));
    }
    for (let i = 0; i < 60; i++) {
      const [x, y] = P(34.6 + gauss(w.r) * 0.5, 24.4 + gauss(w.r) * 0.5);
      w.put(x, y, 0.05, W(2, 7));
    }
    // 赤い周波数の線（ベジェ曲線をなぞる）
    const bez = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
      const u = 1 - t;
      return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
    };
    const segs = [
      [[5, 35.6], [13, 31.4], [20, 38.6], [29.5, 34.4]],
      [[29.5, 34.4], [38, 30.6], [45, 37.4], [60.5, 32.6]],
    ];
    const waveIds: number[] = [];
    for (const sg of segs) {
      for (let i = 0; i <= 90; i++) {
        const [bx, by] = bez(sg[0], sg[1], sg[2], sg[3], i / 90);
        const [x, y] = P(bx, by);
        waveIds.push(w.put(x, y, 0.1, W(2, 7)));
      }
    }
    for (let i = 0; i + 3 < waveIds.length; i += 3) lines.push({ a: waveIds[i], b: waveIds[i + 3], layout: L.MARK, order: 0, color: 1, ga: 7, gb: 7 });
    refSize[L.MARK] = 6.8;
    w.fill((r) => {
      const a = r() * Math.PI * 2;
      const rr = 3.6 + Math.pow(r(), 0.8) * 9;
      return [Math.cos(a) * rr, Math.sin(a) * rr, -3 + gauss(r) * 2.5, W(0)];
    });
  }

  /* 9 CONNECT ─ 2つの点。あいだに赤い線（ビームは別のメッシュ） */
  {
    const w = new Writer(n, data, n * 4 * L.CONNECT, rng(101));
    // 左が「あなたの会社」、右が「Music Japan」。画面では、見出しと本文のあいだの帯（data-talk-link）に横たわる
    const ax = -3.4;
    const ay = 0;
    const bx = 3.4;
    const by = 0;
    anchors[L.CONNECT] = [
      [ax, ay, 0],
      [bx, by, 0],
    ];
    const blob = (cx: number, cy: number, cat: number, group: number) => {
      for (let i = 0; i < 380 * Math.max(0.45, scale); i++) {
        const rr = Math.abs(gauss(w.r)) * 0.28;
        const th = w.r() * Math.PI * 2;
        const ph = Math.acos(2 * w.r() - 1);
        w.put(cx + rr * Math.sin(ph) * Math.cos(th), cy + rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph), W(cat, group));
      }
      for (let i = 0; i < 160 * Math.max(0.45, scale); i++) {
        const a = (i / 160) * Math.PI * 2;
        w.put(cx + Math.cos(a) * 0.72, cy + Math.sin(a) * 0.72, 0, W(5, group));
      }
    };
    blob(ax, ay, 1, 0);
    blob(bx, by, 2, 1);
    refSize[L.CONNECT] = 8.4;
    w.fill((r) => {
      const a = r() * Math.PI * 2;
      const rr = 1.6 + Math.pow(r(), 0.9) * 11;
      return [Math.cos(a) * rr, Math.sin(a) * rr * 0.7, -8 + r() * 8, W(0)];
    });
  }

  return { data, lines, anchors, refSize };
}
