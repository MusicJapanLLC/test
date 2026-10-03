import { isCoarsePointer, isLowPower } from '../lib/motion';

/**
 * Baton トップ（/profile/）の背景。「人と人が、糸でつながっていく」様子を描く。
 *
 *   - 画面じゅうに、ごく淡い点（人）が漂い、近い点どうしが細い糸で結ばれる。
 *     糸の上を小さな光が点から点へ跳ねていく（あちこちで紹介が起きている）
 *   - カーソルを動かすと、まわりの点が少し引き寄せられ、糸がつながる
 *   - 一覧の写真どうしは、垂れた糸でひと続きにつながっている
 *   - その糸の上を、真珠色の光（バトン）が人から人へ順に渡っていく。
 *     届いた瞬間に、写真のまわりへ波紋が広がる（onArrive でカードにも知らせる）
 *   - カードにカーソルを乗せると、その人からほかの全員へ糸が伸びる
 *
 * Canvas 2D だけで描く（ヒーローの WebGL とは別。ヒーローが画面を覆っている間は描かない）。
 * 白地なので、光は「足す」のではなく、灰青〜藤色の細い線と白い芯で表す。
 */

type Point = { x: number; y: number };
type Dot = { x: number; y: number; z: number; vx: number; vy: number; ph: number };
type Ripple = { x: number; y: number; r0: number; born: number; sy: number };
/** 背景の糸を、点から点へ跳ねていく小さな光（あちこちで紹介が起きている様子） */
type Spark = { from: number; to: number; t: number; speed: number; hops: number };

export type HubThreadsOptions = {
  /** 一覧の写真（並び順＝バトンが渡る順） */
  anchors: () => HTMLElement[];
  /** いまカーソルが乗っているカードの番号。なければ -1 */
  hovered: () => number;
  /** バトンが写真に届いたとき */
  onArrive: (index: number) => void;
  /** これが画面を覆っている間は描かない（ヒーロー） */
  cover?: HTMLElement | null;
};

// 色（白×ごく薄いグレーの地に合わせた、灰青と藤色）
const INK = '112,120,136';
const STEEL = '128,146,184';
const LILAC = '168,152,204';

const SEGMENT_TIME = 2.4; // 写真から写真まで、バトンが渡るのにかかる秒数
const HOLD_TIME = 0.9; // 写真に届いてから、次へ渡るまでの間
const RIPPLE_TIME = 1.6;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (v: number, size: number) => ((v % size) + size) % size;

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** 2人のあいだに垂れる糸の、制御点 */
function sagControls(a: Point, b: Point, bend = 1): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sag = Math.min(110, Math.hypot(dx, dy) * 0.24) * bend;
  return [
    { x: a.x + dx * 0.3, y: a.y + dy * 0.3 + sag },
    { x: a.x + dx * 0.7, y: a.y + dy * 0.7 + sag },
  ];
}

export function mountHubThreads(canvas: HTMLCanvasElement, opts: HubThreadsOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const low = isLowPower();
  const touch = isCoarsePointer();
  let w = 0;
  let h = 0;
  let dots: Dot[] = [];

  const seed = () => {
    const count = Math.round(Math.min(low ? 40 : 104, Math.max(26, (w * h) / (low ? 17000 : 13500))));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * (h + 160),
      z: 0.35 + Math.random() * 0.65,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 8,
      ph: Math.random() * Math.PI * 2,
    }));
  };

  const resize = () => {
    const nextW = document.documentElement.clientWidth;
    const nextH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
    canvas.width = Math.round(nextW * dpr);
    canvas.height = Math.round(nextH * dpr);
    canvas.style.width = `${nextW}px`;
    canvas.style.height = `${nextH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // スマホのアドレスバーの出し入れ（高さだけの変化）では、点を撒き直さない
    const reseed = nextW !== w || dots.length === 0;
    w = nextW;
    h = nextH;
    if (reseed) seed();
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // カーソル（タッチ端末では使わない）
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, target: 0 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    if (mouse.x < -999) {
      mouse.x = mouse.tx;
      mouse.y = mouse.ty;
    }
    mouse.target = 1;
  };
  const onLeave = () => {
    mouse.target = 0;
  };
  if (!touch) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  // バトンの進み具合（往復する）
  let leg = 0; // いまの区間（from → to）
  let dir = 1;
  let legStart = -1;
  let arrived = false;
  const ripples: Ripple[] = [];
  const sparks: Spark[] = [];
  let sparkClock = 0;
  let hoverAmt = 0;
  let hoverIndex = -1;

  const centers = (): { pts: Point[]; sizes: number[] } => {
    const els = opts.anchors();
    const pts: Point[] = [];
    const sizes: number[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      pts.push({ x: r.left + r.width / 2, y: r.top + r.height * 0.42 });
      sizes.push(Math.max(r.width, r.height) * 0.5);
    }
    return { pts, sizes };
  };

  const strokeThread = (a: Point, b: Point, c1: Point, c2: Point, alpha: number, width: number, rgb = INK) => {
    ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.stroke();
  };

  /** 真珠色の光（バトン）。白い芯、灰青から藤色へ移る尾 */
  const drawBaton = (path: (t: number) => Point, t: number) => {
    const steps = 22;
    for (let i = steps; i >= 1; i -= 1) {
      const tt = t - i * 0.012;
      if (tt < 0) continue;
      const p = path(tt);
      const k = 1 - i / steps;
      ctx.fillStyle = `rgba(${i % 2 ? STEEL : LILAC},${(k * k * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.8 + k * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const head = path(t);
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 26);
    glow.addColorStop(0, `rgba(${STEEL},0.42)`);
    glow.addColorStop(0.45, `rgba(${LILAC},0.16)`);
    glow.addColorStop(1, `rgba(${LILAC},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${STEEL},0.7)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  let raf = 0;
  let prev = performance.now();
  let clock = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    // ヒーローが画面を覆っている間は描かない（WebGLの演出に任せる）
    if (opts.cover) {
      const r = opts.cover.getBoundingClientRect();
      if (r.bottom >= h - 2) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
    }
    clock += dt;
    ctx.clearRect(0, 0, w, h);

    const scrollY = window.scrollY;
    mouse.on += (mouse.target - mouse.on) * 0.06;
    mouse.x += (mouse.tx - mouse.x) * 0.14;
    mouse.y += (mouse.ty - mouse.y) * 0.14;

    // ── 漂う点と、近い点どうしの糸 ──
    const reach = Math.min(190, Math.max(118, w * 0.125));
    const pull = 200;
    const pos: Point[] = new Array(dots.length);
    for (let i = 0; i < dots.length; i += 1) {
      const d = dots[i];
      d.x = wrap(d.x + d.vx * dt, w + 80);
      d.y = wrap(d.y + d.vy * dt, h + 160);
      let x = d.x - 40 + Math.sin(clock * 0.35 + d.ph) * 8;
      let y = wrap(d.y - scrollY * (0.06 + d.z * 0.18), h + 160) - 80;
      if (mouse.on > 0.01) {
        const mx = mouse.x - x;
        const my = mouse.y - y;
        const md = Math.hypot(mx, my);
        if (md < pull) {
          const f = (1 - md / pull) ** 2 * 0.22 * mouse.on;
          x += mx * f;
          y += my * f;
        }
      }
      pos[i] = { x, y };
    }

    ctx.lineWidth = 0.8;
    for (let i = 0; i < dots.length; i += 1) {
      const a = pos[i];
      for (let j = i + 1; j < dots.length; j += 1) {
        const b = pos[j];
        const dx = a.x - b.x;
        if (dx > reach || dx < -reach) continue;
        const dy = a.y - b.y;
        if (dy > reach || dy < -reach) continue;
        const dd = Math.hypot(dx, dy);
        if (dd >= reach) continue;
        const alpha = (1 - dd / reach) ** 1.6 * 0.42 * ((dots[i].z + dots[j].z) / 2);
        ctx.strokeStyle = `rgba(${INK},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // カーソルから伸びる糸
    if (mouse.on > 0.01) {
      ctx.lineWidth = 0.9;
      for (let i = 0; i < dots.length; i += 1) {
        const p = pos[i];
        const dd = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dd > pull) continue;
        const alpha = (1 - dd / pull) ** 1.5 * 0.42 * mouse.on;
        ctx.strokeStyle = `rgba(${STEEL},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    for (let i = 0; i < dots.length; i += 1) {
      const p = pos[i];
      const z = dots[i].z;
      ctx.fillStyle = `rgba(${INK},${(0.26 + z * 0.34).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.9 + z * 1.5, 0, Math.PI * 2);
      ctx.fill();
      // ところどころの点は、真珠色の輪をまとってゆっくり呼吸する
      if (i % 9 === 0) {
        const breath = 0.5 + 0.5 * Math.sin(clock * 1.1 + dots[i].ph);
        ctx.strokeStyle = `rgba(${i % 2 ? LILAC : STEEL},${(0.18 + breath * 0.22).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + z * 3 + breath * 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 点から点へ、糸を伝って跳ねていく光
    const neighbor = (i: number, not: number): number => {
      const cands: number[] = [];
      for (let j = 0; j < pos.length; j += 1) {
        if (j === i || j === not) continue;
        if (Math.hypot(pos[j].x - pos[i].x, pos[j].y - pos[i].y) < reach * 0.9) cands.push(j);
      }
      return cands.length ? cands[Math.floor(Math.random() * cands.length)] : -1;
    };
    sparkClock += dt;
    if (sparkClock > (low ? 1.1 : 0.55) && sparks.length < (low ? 4 : 9) && pos.length > 2) {
      sparkClock = 0;
      const from = Math.floor(Math.random() * pos.length);
      const to = neighbor(from, -1);
      if (to >= 0) sparks.push({ from, to, t: 0, speed: 0.7 + Math.random() * 0.6, hops: 2 + Math.floor(Math.random() * 4) });
    }
    for (let k = sparks.length - 1; k >= 0; k -= 1) {
      const sp = sparks[k];
      const a = pos[sp.from];
      const b = pos[sp.to];
      if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) > reach * 1.25) {
        sparks.splice(k, 1);
        continue;
      }
      sp.t += dt * sp.speed;
      const e = easeInOut(Math.min(1, sp.t));
      const x = a.x + (b.x - a.x) * e;
      const y = a.y + (b.y - a.y) * e;
      // 通ったところの糸だけ、少し濃くなる
      ctx.strokeStyle = `rgba(${STEEL},0.32)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${LILAC},0.22)`;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = `rgba(${STEEL},0.75)`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (sp.t >= 1) {
        const next = sp.hops > 0 ? neighbor(sp.to, sp.from) : -1;
        if (next >= 0) {
          sp.from = sp.to;
          sp.to = next;
          sp.t = 0;
          sp.hops -= 1;
        } else {
          sparks.splice(k, 1);
        }
      }
    }

    // ── 写真どうしをつなぐ糸と、渡っていくバトン ──
    const { pts, sizes } = centers();
    const n = pts.length;
    if (n >= 2) {
      // 写真のそばの漂う点とも、ゆるく結ぶ
      ctx.lineWidth = 0.7;
      for (let a = 0; a < n; a += 1) {
        const c = pts[a];
        if (c.y < -200 || c.y > h + 200) continue;
        for (let i = 0; i < pos.length; i += 1) {
          const dd = Math.hypot(pos[i].x - c.x, pos[i].y - c.y);
          const lim = sizes[a] + reach;
          if (dd > lim) continue;
          ctx.strokeStyle = `rgba(${INK},${((1 - dd / lim) * 0.2).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(pos[i].x, pos[i].y);
          ctx.stroke();
        }
      }

      // 順につなぐ、垂れた糸（2本どりで、少しずらす）
      const ctrls: [Point, Point][] = [];
      for (let i = 0; i < n - 1; i += 1) {
        const [c1, c2] = sagControls(pts[i], pts[i + 1], i % 2 ? 1 : 0.85);
        ctrls.push([c1, c2]);
        const sway = Math.sin(clock * 0.8 + i) * 6;
        strokeThread(pts[i], pts[i + 1], { x: c1.x, y: c1.y + sway }, { x: c2.x, y: c2.y + sway }, 0.32, 1.1);
        strokeThread(
          pts[i],
          pts[i + 1],
          { x: c1.x, y: c1.y + sway + 9 },
          { x: c2.x, y: c2.y + sway + 9 },
          0.14,
          0.8,
          LILAC,
        );
      }

      // カーソルの乗った人から、ほかの全員へ糸が伸びる
      const hv = opts.hovered();
      if (hv >= 0 && hv < n) hoverIndex = hv;
      hoverAmt += ((hv >= 0 ? 1 : 0) - hoverAmt) * 0.08;
      if (hoverAmt > 0.01 && hoverIndex >= 0 && hoverIndex < n) {
        const from = pts[hoverIndex];
        for (let j = 0; j < n; j += 1) {
          if (j === hoverIndex) continue;
          const to = pts[j];
          const [c1, c2] = sagControls(from, to, -0.6);
          strokeThread(from, to, c1, c2, 0.38 * hoverAmt, 1.2, STEEL);
          // 糸の上を流れる小さな光
          const tt = (clock * 0.5 + j * 0.23) % 1;
          const p = bezier(from, c1, c2, to, tt);
          ctx.fillStyle = `rgba(${LILAC},${(0.7 * hoverAmt).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // バトン: 0→1→…→n-1→…→0 と往復しながら、写真ごとに少し止まる
      if (legStart < 0) legStart = clock;
      if (leg > n - 2) leg = n - 2;
      const elapsed = clock - legStart;
      const to = dir > 0 ? leg + 1 : leg;
      const moving = Math.min(1, elapsed / SEGMENT_TIME);
      const [c1, c2] = ctrls[leg];
      const path = (t: number) => {
        const tt = dir > 0 ? t : 1 - t;
        return bezier(pts[leg], c1, c2, pts[leg + 1], tt);
      };
      if (moving < 1) {
        drawBaton(path, easeInOut(moving));
      } else {
        if (!arrived) {
          arrived = true;
          ripples.push({ x: pts[to].x, y: pts[to].y, r0: sizes[to], born: clock, sy: scrollY });
          opts.onArrive(to);
        }
        // 届いた写真の上で、少しだけ光が留まる
        const p = pts[to];
        const fade = 1 - Math.min(1, (elapsed - SEGMENT_TIME) / HOLD_TIME);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sizes[to] * 1.6);
        g.addColorStop(0, `rgba(${STEEL},${(0.16 * fade).toFixed(3)})`);
        g.addColorStop(1, `rgba(${LILAC},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sizes[to] * 1.6, 0, Math.PI * 2);
        ctx.fill();
        if (elapsed >= SEGMENT_TIME + HOLD_TIME) {
          // 次の区間へ。端まで来たら折り返す
          if (dir > 0 && leg + 1 >= n - 1) dir = -1;
          else if (dir < 0 && leg <= 0) dir = 1;
          else leg += dir;
          legStart = clock;
          arrived = false;
        }
      }
    }

    // 届いた瞬間の波紋（写真の外へ、2重に広がる）
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const rp = ripples[i];
      const age = (clock - rp.born) / RIPPLE_TIME;
      if (age >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      for (let k = 0; k < 2; k += 1) {
        const a = age - k * 0.18;
        if (a <= 0) continue;
        const r = rp.r0 * (1.05 + a * 0.9);
        ctx.strokeStyle = `rgba(${k ? LILAC : STEEL},${((1 - a) * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // 波紋は生まれた位置に固定。スクロールしたぶんだけ一緒に動かす
        ctx.arc(rp.x, rp.y - (scrollY - rp.sy), r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  raf = requestAnimationFrame(frame);
  canvas.classList.add('is-ready');

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
  };
}
