import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「重なる三角」のシーン（エボルグ / Empro など match の世界観用）。
 * Empro のロゴは、赤い三角（右向き）と水色の三角（左向き）が重なり、重なった所がワイン色になる形。
 *
 *  phase 0      赤い三角（求職者）と水色の三角（求人）が散らばって漂う。灰色の三角（眠っている人）が、ときどき目を覚ます
 *  phase 0.8    左右の表に整列する（集める）
 *  phase 1.0    赤と水色が1本ずつの線でつながる（つなぐ）
 *  phase 2.0    2つが重なって小さな印になり、全体で大きな Empro の印を形づくる。波紋が広がる（決める）
 *
 * 三角は1枚の四角を instancing で並べ、形はフラグメントの距離関数で描く（角の丸い三角）。
 * 重なりの菱形は、2つの三角の距離関数の共通部分（max）で、そのつど正確に描く。
 * 描く順番は 赤 → 水色 → 重なり（深度は使わない）。
 */

const TRI = /* glsl */ `
// 右向きの三角（局所座標 -1..1）。角を r だけ丸める
float sdTri(vec2 p) {
  vec2 a = vec2(-0.8, 0.85), b = vec2(-0.8, -0.85), c = vec2(0.85, 0.0);
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  vec2 v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
`;

const VERT = /* glsl */ `
attribute vec3 aScatter;
attribute vec3 aGrid;
attribute vec3 aFinal;
attribute vec4 aInfo; // x: 種類(0 赤 / 1 水色 / 2 重なり), y: 乱数, z: 動き出す順番, w: 乱数（眠っているか）
attribute float aZone; // 大きな印の中で、0 左の三角 / 1 右の三角 / 2 重なり
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uAmbient;
uniform float uSleep;
uniform vec2 uScatter;
uniform vec2 uScatterC;
uniform mat4 uRig;
uniform float uRigScale;
uniform vec2 uMouse;
uniform float uHover;
uniform float uAspect;
uniform float uSize;
uniform float uGridSize;
uniform float uFinalSize;
uniform vec3 uRed;
uniform vec3 uCyan;
uniform vec3 uPlum;
uniform vec3 uGray;
varying vec2 vP;
varying vec3 vCol;
varying float vAlpha;
varying float vKind;
varying float vD;

void main() {
  float t = uTime;
  float kind = aInfo.x;
  float seed = aInfo.y;

  // 段階ごとの進み具合（少しずつ順番をずらす）
  float e1 = smoothstep(0.0, 1.0, clamp((uPhase - 0.56 - aInfo.z * 0.1) / 0.2, 0.0, 1.0));
  float e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.12 - aInfo.z * 0.3) / 0.45, 0.0, 1.0));
  // 重なり具合：近づいてから、最後にぐっと重なる
  float close = smoothstep(0.0, 1.0, clamp((uPhase - 1.62 - aInfo.z * 0.1) / 0.28, 0.0, 1.0));

  // 漂う：文字のない側に寄せる。ゆっくり回りながら
  vec3 sc = vec3(uScatterC + aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.6), aScatter.z * 3.0 - 1.0);
  sc += vec3(sin(t * 0.21 + seed * 40.0), cos(t * 0.17 + aInfo.w * 30.0), 0.0) * 0.45;
  float spin = sin(t * 0.3 + seed * 12.0) * 1.4 + seed * 6.28;

  // 表（集める）と、大きな印（決める）は rig の中の座標
  float side = kind < 0.5 ? -1.0 : kind < 1.5 ? 1.0 : 0.0;
  // 決める：小さな印の中で、赤は左・水色は右にずれる（ずれ幅は三角の大きさの単位で）
  float apart = mix(1.25, 0.55, close);
  vec3 fin = aFinal + vec3(side * apart * uFinalSize, 0.0, 0.0);
  vec3 grid = aGrid;
  vec3 local = mix(grid, fin, e2);
  vec3 world = (uRig * vec4(local, 1.0)).xyz;

  float k = mix(0.0, 1.0, e1);
  vec3 center = mix(sc, world, k);
  center = mix(center, sc, uAmbient);

  // 大きさ：漂うときはまちまち、表では揃える、印ではすき間なく
  float sScatter = uSize * (0.55 + seed * 0.9);
  float sz = mix(sScatter, 2.0 * uGridSize * uRigScale, e1);
  sz = mix(sz, 2.0 * uFinalSize * uRigScale, e2) * uIntro;
  float rot = mix(spin, 0.0, e1);

  // マウスの近くは、ふくらんで少し逃げる
  vec4 cc = projectionMatrix * modelViewMatrix * vec4(center, 1.0);
  vec2 ndc = cc.xy / cc.w;
  vec2 dm = ndc - uMouse; dm.x *= uAspect;
  float near = smoothstep(0.28, 0.0, length(dm)) * uHover;
  center.xy += normalize(dm + 1e-4) * near * 0.35 * (1.0 - e2 * 0.7);
  sz *= 1.0 + near * 0.6;

  // 眠っている三角（灰色）：漂っている間だけ。ときどき目を覚ます
  float sleeper = step(aInfo.w, uSleep) * step(kind, 1.5) * (1.0 - e1);
  float wake = smoothstep(0.75, 1.0, sin(t * 0.45 + seed * 23.0));
  float asleep = sleeper * (1.0 - wake);
  sz *= 1.0 + sleeper * wake * 0.35;

  vec2 q = position.xy;
  float cr = cos(rot), sr = sin(rot);
  // 漂う間は、少し傾いて見えるように横を縮める
  float tilt = mix(0.55 + 0.45 * abs(cos(t * 0.4 + seed * 8.0)), 1.0, e1);
  vec2 off = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr) * sz * vec2(tilt, 1.0);
  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  mv.xy += off;
  gl_Position = projectionMatrix * mv;

  vP = position.xy * 2.0;
  vKind = kind;
  vD = apart;

  // 色：赤・水色・重なりのワイン。大きな印では、場所（左・右・真ん中）の色に寄せる
  vec3 base = kind < 0.5 ? uRed : kind < 1.5 ? uCyan : uPlum;
  vec3 zoneCol = aZone < 0.5 ? uRed : aZone < 1.5 ? uCyan : uPlum;
  vec3 zoneDeep = kind > 1.5 ? mix(zoneCol, aZone > 1.5 ? vec3(0.35, 0.06, 0.16) : uPlum, 0.55) : zoneCol;
  vec3 col = mix(base, zoneDeep, close * 0.85);
  col = mix(col, uGray, asleep);
  vCol = col;
  float a = kind > 1.5 ? close : 1.0;
  a *= mix(0.92, 1.0, e1) * (1.0 - asleep * 0.35);
  a *= mix(1.0, 0.32, uAmbient);
  a *= 1.0 - smoothstep(6.0, 16.0, -mv.z) * 0.5;
  vAlpha = a;
}
`;

const FRAG = /* glsl */ `
varying vec2 vP;
varying vec3 vCol;
varying float vAlpha;
varying float vKind;
varying float vD;
${TRI}
void main() {
  float d;
  if (vKind < 0.5) d = sdTri(vP);
  else if (vKind < 1.5) d = sdTri(vec2(-vP.x, vP.y));
  else {
    // 重なり：左にずれた赤と、右にずれた水色の共通部分
    float a = sdTri((vP + vec2(vD, 0.0)));
    float b = sdTri(vec2(-(vP.x - vD), vP.y));
    d = max(a, b);
  }
  d -= 0.08;
  float aa = fwidth(d) * 1.2;
  float m = 1.0 - smoothstep(-aa, aa, d);
  if (m * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vCol, m * vAlpha);
}
`;

const LINE_VERT = /* glsl */ `
attribute vec3 aT; // x: 線の上の位置(0..1), y: 乱数, z: 動き出す順番
uniform float uTime;
uniform float uShow;
uniform vec3 uRed;
uniform vec3 uCyan;
varying float vA;
varying vec3 vCol;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float run = fract(uTime * 0.35 + aT.y);
  float pulse = smoothstep(0.18, 0.0, abs(aT.x - run));
  float show = smoothstep(aT.z * 0.5, aT.z * 0.5 + 0.5, uShow);
  vA = show * (0.16 + pulse * 0.7);
  vCol = mix(uRed, uCyan, aT.x);
}
`;

const LINE_FRAG = /* glsl */ `
varying float vA;
varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol, vA); }
`;

const RING_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

/** 大きな印：左の三角（右向き）と右の三角（左向き）。rig の中の単位 */
const BIG = { w: 3.3, h: 2.4, tip: 1.2 };
function inLeft(x: number, y: number): boolean {
  if (x < -BIG.w || x > BIG.tip) return false;
  const half = (BIG.h * (BIG.tip - x)) / (BIG.tip + BIG.w);
  return Math.abs(y) <= half;
}
const inRight = (x: number, y: number) => inLeft(-x, y);

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class PairScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(40, 1, 0.1, 100);
  private rig = new Group();
  private u: Record<string, { value: unknown }>;
  private lineU: Record<string, { value: unknown }>;
  private rings: { mesh: Mesh; u: { uCol: { value: Color }; uOpacity: { value: number } }; offset: number }[] = [];
  private offset = new Vector2();
  private baseScale = 1;
  private mouse = new Vector2(9, 9);
  private mouseTarget = new Vector2(9, 9);
  private hover = 0;
  private hoverTarget = 0;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private frames = 0;
  private lastAt = 0;
  private stillTimer = 0;
  private goal: number;
  phase: number;

  get target(): number {
    return this.goal;
  }
  set target(v: number) {
    this.goal = v;
    if (perfLevel() === 2 && this.o.animate) {
      window.clearTimeout(this.stillTimer);
      this.stillTimer = window.setTimeout(() => this.still(), 120);
    }
  }

  constructor(private o: SceneOptions) {
    // 記事の見出しの横は、途中の動きではなく、できあがった印を静かに見せる
    const settled = o.host.classList.contains('scene-article') ? 2 : o.phase;
    this.phase = settled;
    this.goal = settled;
    this.renderer = new WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    onPerfLevel((l) => {
      if (l === 1) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * 0.75);
        this.resize();
      } else if (l === 2) {
        cancelAnimationFrame(this.raf);
        this.still();
      }
    });
    this.camera.position.set(0, 0, 14);

    const red = new Color(o.ink);
    const cyan = new Color(o.brand);
    const plum = new Color(o.red);
    const ambient = o.mode === 'aurora';
    const sleepy = o.host.dataset.sleep === '1';

    // ── ペアの数：ステージは多め、下のほうのシーンは少なめ ──
    const P = Math.max(ambient ? 40 : 70, Math.min(300, Math.round(o.count / 12)));

    // 表（集める）：左右2つのブロック。左に赤、右に水色
    const bw = 2.9;
    const bh = 4.6;
    const cols = Math.ceil(Math.sqrt((P * bw) / bh));
    const rows = Math.ceil(P / cols);
    const gs = Math.min(bw / cols, bh / rows);
    const cell = (i: number, sideX: number): [number, number] => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = sideX * (0.55 + (c + 0.5) * gs);
      const y = (rows / 2 - r - 0.5) * gs;
      return [x, y];
    };
    // 赤 i と組む水色は、ばらばらの位置にいる（線が交差して、マッチングらしく）
    const partner = shuffle(Array.from({ length: P }, (_, i) => i));

    // 大きな印（決める）：印の中に格子状に点を置く
    const area = 2 * (0.5 * (2 * BIG.h) * (BIG.w + BIG.tip)) - 0.5 * (2 * BIG.tip) * ((2 * BIG.h * BIG.tip) / (BIG.tip + BIG.w));
    // 行の間隔は横の 0.62 倍。点の数がペアの数にちょうど届く間隔を探す（多すぎると間引きで穴があく）
    let sp = Math.sqrt(area / (P * 0.62)) * 1.06;
    let pts: [number, number, number][] = [];
    for (let tries = 0; tries < 40; tries++) {
      pts = [];
      for (let y = -BIG.h + sp / 2; y < BIG.h; y += sp * 0.62) {
        const row = Math.round((y + BIG.h) / (sp * 0.62));
        for (let x = -BIG.w + sp / 2 + (row % 2 ? sp / 2 : 0); x < BIG.w; x += sp) {
          const l = inLeft(x, y);
          const r = inRight(x, y);
          if (l || r) pts.push([x, y, l && r ? 2 : l ? 0 : 1]);
        }
      }
      if (pts.length >= P) break;
      sp *= 0.985;
    }
    pts = shuffle(pts).slice(0, P);
    // 中心に近いものから先に動く
    const finalSize = sp * 0.37;

    const n = P * 3;
    const aScatter = new Float32Array(n * 3);
    const aGrid = new Float32Array(n * 3);
    const aFinal = new Float32Array(n * 3);
    const aInfo = new Float32Array(n * 4);
    const aZone = new Float32Array(n);
    const lp: number[] = [];
    const lt: number[] = [];
    for (let i = 0; i < P; i++) {
      const [fx, fy, zone] = pts[i] ?? [0, 0, 2];
      const order = Math.min(1, Math.hypot(fx / BIG.w, fy / BIG.h) * 0.7 + Math.random() * 0.3);
      const sleep = Math.random();
      const j = partner[i];
      const [rx, ry] = cell(i, -1);
      const [cx, cy] = cell(j, 1);
      for (let k = 0; k < 3; k++) {
        const idx = k * P + i;
        aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()], idx * 3);
        if (k === 0) aGrid.set([rx, ry, 0], idx * 3);
        else if (k === 1) aGrid.set([cx, cy, 0], idx * 3);
        else aGrid.set([(rx + cx) / 2, (ry + cy) / 2, 0], idx * 3);
        aFinal.set([fx, fy, 0], idx * 3);
        aInfo.set([k, Math.random(), order, sleep], idx * 4);
        aZone[idx] = zone;
      }
      // つなぐ：赤 i と水色 partner(i) を、細かく分けた線で
      const SEG = 8;
      const seed = Math.random();
      for (let s = 0; s < SEG; s++) {
        for (const kk of [s / SEG, (s + 1) / SEG]) {
          const x = rx + (cx - rx) * kk;
          const y = ry + (cy - ry) * kk + Math.sin(kk * Math.PI) * (cy - ry) * 0.08;
          lp.push(x, y, -0.05);
          lt.push(kk, seed, order);
        }
      }
    }

    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aGrid', new InstancedBufferAttribute(aGrid, 3));
    geo.setAttribute('aFinal', new InstancedBufferAttribute(aFinal, 3));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.setAttribute('aZone', new InstancedBufferAttribute(aZone, 1));
    geo.instanceCount = n;

    this.u = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uAmbient: { value: ambient ? 1 : 0 },
      uSleep: { value: sleepy ? 0.62 : 0.2 },
      uScatter: { value: new Vector2(8, 5) },
      uScatterC: { value: new Vector2(0, 0) },
      uRig: { value: new Matrix4() },
      uRigScale: { value: 1 },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uSize: { value: 0.2 },
      uGridSize: { value: gs * 0.42 },
      uFinalSize: { value: finalSize },
      uRed: { value: red },
      uCyan: { value: cyan },
      uPlum: { value: plum },
      uGray: { value: new Color('#c3c8d0') },
    };

    // 線を先に描き、三角はその上に
    const lgeo = new BufferGeometry();
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(lp), 3));
    lgeo.setAttribute('aT', new BufferAttribute(new Float32Array(lt), 3));
    this.lineU = { uTime: { value: 0 }, uShow: { value: 0 }, uRed: { value: red }, uCyan: { value: cyan } };
    const lines = new LineSegments(
      lgeo,
      new ShaderMaterial({ uniforms: this.lineU, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, depthTest: false }),
    );
    lines.frustumCulled = false;
    lines.renderOrder = 0;
    this.rig.add(lines);

    // 波紋：大きな印ができたときに、ワイン色の輪が広がる
    for (let i = 0; i < 3; i++) {
      const u = { uCol: { value: plum }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.985, 1, 128),
        new ShaderMaterial({ uniforms: u, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide }),
      );
      mesh.renderOrder = 0;
      this.rig.add(mesh);
      this.rings.push({ mesh, u, offset: i / 3 });
    }
    if (ambient) this.rig.visible = false;
    this.scene.add(this.rig);

    const tris = new Mesh(
      geo,
      new ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false }),
    );
    tris.frustumCulled = false;
    tris.renderOrder = 1;
    this.scene.add(tris);

    new ResizeObserver(() => this.resize()).observe(o.host);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.loop();
    }).observe(o.host);
    this.resize();

    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      document.addEventListener('visibilitychange', () => !document.hidden && this.loop());
      this.loop();
    } else {
      this.render(6);
    }
    o.host.classList.add('is-ready');
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.mouseTarget.set(x, y);
    this.hoverTarget = Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05 ? 1 : 0;
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    this.u.uAspect.value = this.camera.aspect;
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    const sc = this.u.uScatter.value as Vector2;
    const scc = this.u.uScatterC.value as Vector2;
    if (wide) {
      sc.set(halfW * 0.6, halfH * 0.98);
      scc.set(halfW * 0.4, 0);
      this.offset.set(halfW * 0.45, 0);
      this.baseScale = Math.min(0.95, (halfW * 0.48) / BIG.w, (halfH * 0.8) / BIG.h);
    } else if (this.o.layout === 'right') {
      // スマホ：文字は下半分に来るので、上の空いた場所に
      sc.set(halfW * 1.02, halfH * 0.34);
      scc.set(0, halfH * 0.6);
      this.offset.set(0, halfH * 0.5);
      this.baseScale = Math.min(0.9, (halfW * 0.86) / BIG.w, (halfH * 0.4) / BIG.h);
    } else {
      sc.set(halfW * 1.02, halfH * 1.02);
      scc.set(0, 0);
      this.offset.set(0, 0);
      this.baseScale = Math.min(0.95, (halfW * 0.8) / BIG.w, (halfH * 0.78) / BIG.h);
    }
    // 漂う三角は、画面の上で20px前後に見える大きさにする（縦に長い画面でも大きくなりすぎない）
    const px = h / (2 * halfH);
    this.u.uSize.value = Math.max(0.07, Math.min(0.26, 21 / px));
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.o.mode === 'aurora' ? 0 : this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const done = sm(1.7, 2.0, ph);
    this.rig.position.set(this.offset.x, this.offset.y, 0);
    this.rig.scale.setScalar(this.baseScale);
    // 表と印は、マウスで少しだけ傾く
    this.rig.rotation.set(-this.mouse.y * 0.08 * this.hover, this.mouse.x * 0.12 * this.hover + Math.sin(t * 0.2) * 0.03, 0, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.u.uRig.value as Matrix4).copy(this.rig.matrixWorld);
    this.u.uRigScale.value = this.baseScale;
    this.u.uTime.value = t;
    this.u.uPhase.value = ph;
    this.lineU.uTime.value = t;
    // 線は「つなぐ」の間だけ
    this.lineU.uShow.value = sm(0.82, 1.0, ph) * (1 - sm(1.2, 1.5, ph));
    for (const r of this.rings) {
      const k = (t * 0.22 + r.offset) % 1;
      r.mesh.scale.setScalar(BIG.w * (0.9 + k * 0.9));
      r.u.uOpacity.value = done * (1 - k) * 0.35;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    (this.u.uIntro as { value: number }).value = 1;
    this.phase = this.goal;
    this.render(6);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden || !this.o.animate) {
      this.lastAt = 0;
      return;
    }
    if (perfLevel() === 2) return this.still();
    this.raf = requestAnimationFrame(this.loop);
    this.frames += 1;
    if (perfLevel() === 1 && this.frames % 2) return;
    const t = (performance.now() - this.start) / 1000;
    const intro = this.u.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.014);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    (this.u.uMouse.value as Vector2).copy(this.mouse);
    this.u.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
