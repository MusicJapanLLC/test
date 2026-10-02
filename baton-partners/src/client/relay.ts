import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「リレー」のシーン（Music Japan など relay の世界観用）。
 * ロゴの「赤い輪」と「赤い点」を、陸上のトラックとバトンに見立てている。
 *
 *  phase 0〜1  散らばった光の点（検索してきた人）が弧を描いてトラックに降り、レーンの線が一周ぶん描かれていく（見つかる）
 *  phase 1     トラックが日の丸の赤で塗られ、レーンを光の走者が走り出す（読まれる）
 *  phase 2     ホームストレートでバトンが白い走者から赤い走者へ渡り、赤い輪が地面に広がる。光がトラックを一周する（つながる）
 *
 * 走者の位置はすべて頂点シェーダーでトラックの式から計算する。CPUは時間・phase・マウスを渡すだけ。
 * マウスで少し傾き、クリック（タップ）すると号砲が鳴ったように走者が一斉に加速する。
 */

/** トラックの形：直線の長さ、いちばん内側のレーンの半径、レーン数と幅 */
const L = 6.4;
const R0 = 2.5;
const LANES = 6;
const LW = 0.34;
const ROUT = R0 + LANES * LW;
/** バトンゾーン（テイクオーバーゾーン）：ホームストレートの途中 */
const ZONE: [number, number] = [0.07, 0.12];

const OVAL_GLSL = /* glsl */ `
uniform float uL;
vec3 oval(float s, float r) {
  float T = 2.0 * uL + 6.2831853 * r;
  float d = fract(s) * T;
  if (d < uL) return vec3(-uL * 0.5 + d, 0.0, r);
  d -= uL;
  float c = 3.14159265 * r;
  if (d < c) { float a = d / r; return vec3(uL * 0.5 + r * sin(a), 0.0, r * cos(a)); }
  d -= c;
  if (d < uL) return vec3(uL * 0.5 - d, 0.0, -r);
  d -= uL;
  float a = d / r;
  return vec3(-uL * 0.5 - r * sin(a), 0.0, -r * cos(a));
}
`;

/** CPU側でも同じ式（トラックの面・バトンの受け渡し） */
function oval(s: number, r: number, out = new Vector3()): Vector3 {
  const T = 2 * L + 2 * Math.PI * r;
  let d = (((s % 1) + 1) % 1) * T;
  if (d < L) return out.set(-L / 2 + d, 0, r);
  d -= L;
  const c = Math.PI * r;
  if (d < c) {
    const a = d / r;
    return out.set(L / 2 + r * Math.sin(a), 0, r * Math.cos(a));
  }
  d -= c;
  if (d < L) return out.set(L / 2 - d, 0, -r);
  d -= L;
  const a = d / r;
  return out.set(-L / 2 - r * Math.sin(a), 0, -r * Math.cos(a));
}

const HASH = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
`;

/* ── トラックの面：赤いタータン、白いレーン線、スタートライン、バトンゾーン ── */
const TRACK_VERT = /* glsl */ `
varying vec2 vUv;
varying vec2 vP;
void main() {
  vUv = uv;
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const TRACK_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uTrack;
uniform float uDraw;
uniform float uFill;
uniform float uRise;
uniform float uSweep;
uniform float uOpacity;
uniform vec2 uZone;
varying vec2 vUv;
varying vec2 vP;
${HASH}
void main() {
  float s = vUv.x;
  float v = vUv.y;
  // 描かれていく：先端は少しぼかす
  float shown = 1.0 - smoothstep(uDraw - 0.015, uDraw, s);
  if (shown <= 0.001) discard;

  float lv = v * ${LANES.toFixed(1)};
  float f = abs(fract(lv + 0.5) - 0.5);
  float aa = fwidth(lv);
  float line = 1.0 - smoothstep(0.035, 0.035 + aa * 1.5, f);
  // いちばん内側と外側は太く
  float edge = 1.0 - smoothstep(0.0, 0.02 + fwidth(v) * 1.5, min(v, 1.0 - v));

  float ds = fwidth(s);
  float start = 1.0 - smoothstep(0.0018, 0.0018 + ds * 1.5, abs(s - 0.002));
  float z1 = 1.0 - smoothstep(0.0012, 0.0012 + ds * 1.5, abs(s - uZone.x));
  float z2 = 1.0 - smoothstep(0.0012, 0.0012 + ds * 1.5, abs(s - uZone.y));
  // バトンゾーンの三角（各レーンの中央に、進む向きの印）
  float inZone = step(uZone.x, s) * step(s, uZone.y);
  float lane = fract(lv);
  float tri = step(abs(lane - 0.5) * 2.0, 1.0 - fract((s - uZone.x) / (uZone.y - uZone.x) * 3.0)) * inZone * 0.55 * uFill;

  float grain = hash(floor(vP * 70.0)) * 0.07 + hash(floor(vP * 17.0)) * 0.05;
  vec3 surf = uTrack * (0.86 + grain);
  surf *= mix(1.0, 0.82, inZone * uFill);
  // 光がトラックを一周する（つながる場面）
  float sw = exp(-pow((fract(s - uSweep + 0.5) - 0.5) * 16.0, 2.0)) * uRise;
  surf = mix(surf, vec3(1.0, 0.86, 0.86), sw * 0.45);

  float lines = clamp(max(max(line, edge), max(start, max(z1, z2))) + tri, 0.0, 1.0);
  vec3 lineCol = mix(uInk, vec3(1.0), uFill);
  vec3 col = mix(surf, lineCol, lines);
  float a = mix(lines * 0.8, 1.0, uFill) * uOpacity * shown;
  gl_FragColor = vec4(col, a);
}
`;

/* ── 内側の輪（ロゴの赤い輪）と中心の点 ── */
const RING_VERT = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uDraw;
uniform float uOpacity;
varying float vT;
void main() {
  if (vT > uDraw) discard;
  gl_FragColor = vec4(uCol, uOpacity);
}
`;

/* ── 光の点（検索してきた人）：散らばる → 弧を描いてトラックに降りる ── */
const DOT_VERT = /* glsl */ `
attribute vec3 aScatter;
attribute vec3 aTarget;
attribute vec4 aSeed;
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uFill;
uniform float uPx;
uniform float uBurst;
varying float vA;
varying float vRed;
void main() {
  float land = smoothstep(aSeed.x * 0.55, aSeed.x * 0.55 + 0.45, uPhase);
  vec3 drift = vec3(sin(uTime * 0.31 + aSeed.y * 30.0), cos(uTime * 0.23 + aSeed.z * 20.0) * 0.6, sin(uTime * 0.19 + aSeed.w * 10.0)) * 0.45;
  vec3 sc = aScatter * (1.0 + (1.0 - uIntro) * 0.6) + drift;
  vec3 p = mix(sc, aTarget, land);
  p.y += sin(land * 3.14159) * (1.2 + aSeed.y * 2.2);
  // 号砲：降りた点が跳ねる
  float age = uTime - uBurst;
  p.y += land * exp(-age * 3.0) * step(0.0, age) * (0.3 + aSeed.w * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (0.6 + aSeed.w * 1.1) * (14.0 / -mv.z);
  vA = (1.0 - uFill * land * 0.92) * uIntro * (0.3 + aSeed.z * 0.45);
  vRed = step(0.8, aSeed.y);
}
`;
const DOT_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uRed;
varying float vA;
varying float vRed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = (1.0 - smoothstep(0.32, 0.5, d)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uInk, uRed, vRed), a);
}
`;

/* ── 走者：レーンを走る光の点と、その残像 ── */
const RUNNER_VERT = /* glsl */ `
attribute vec4 aRun; // x: レーン, y: スタート位置, z: 速さ, w: 乱数
attribute float aK;  // 残像の何番目か（0 が先頭）
uniform float uClock;
uniform float uVis;
uniform float uPx;
uniform float uTrail;
uniform float uR0;
uniform float uLW;
varying float vA;
${OVAL_GLSL}
void main() {
  float r = uR0 + (aRun.x + 0.5) * uLW;
  float s = aRun.y + uClock * aRun.z - aK * uTrail * aRun.z;
  vec3 p = oval(s, r) + vec3(0.0, 0.06, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (14.0 / -mv.z);
  vA = uVis * pow(1.0 - aK / 24.0, 1.6);
}
`;
const RUNNER_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = 1.0 - smoothstep(0.18, 0.26, d);
  float halo = (1.0 - smoothstep(0.1, 0.5, d)) * 0.5;
  float a = max(core, halo) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0), a);
}
`;
const TRAIL_FRAG = /* glsl */ `
varying float vA;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0), vA * 0.8);
}
`;

export class RelayScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.1, 200);
  private rig = new Group();
  private trackU: Record<string, { value: unknown }>;
  private ringU: Record<string, { value: unknown }>;
  private dotU: Record<string, { value: unknown }>;
  private runU: Record<string, { value: unknown }>;
  private trailU: Record<string, { value: unknown }>;
  private hub: Mesh;
  private runnerA: Mesh;
  private runnerB: Mesh;
  private baton: Mesh;
  private batonGlow: Mesh;
  private pulses: { mesh: Mesh; mat: MeshBasicMaterial; at: number }[] = [];
  private lastHandoff = -1;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private last = performance.now();
  private clock = 0;
  private burstAt = -100;
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private baseScale = 0.5;
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  phase: number;
  private goal = 0;
  private frames = 0;
  private lastAt = 0;
  private stillTimer = 0;
  private ambient: boolean;

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
    this.ambient = o.mode === 'aurora';
    // CTA帯は、スタート前のトラック（塗られて、走者が走っている）
    // 動きを減らす設定では、スクロールで進まないので、完成形（赤いトラックとロゴの輪）を静止画で見せる
    this.phase = this.ambient ? 1.35 : o.animate ? o.phase : Math.max(o.phase, 1.45);
    this.goal = this.phase;
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

    const ink = new Color(o.ink);
    const red = new Color(o.brand);
    const hi = new Color(o.red);

    // ── トラックの面（s=周回の位置, v=内側→外側） ──
    const SEG = 480;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      for (const v of [0, 1]) {
        oval(s, R0 + v * LANES * LW, this.tmp);
        pos.push(this.tmp.x, 0, this.tmp.z);
        uv.push(s, v);
      }
      if (i < SEG) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const tgeo = new BufferGeometry();
    tgeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    tgeo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    tgeo.setIndex(idx);
    this.trackU = {
      uInk: { value: ink },
      uTrack: { value: red },
      uDraw: { value: 0 },
      uFill: { value: 0 },
      uRise: { value: 0 },
      uSweep: { value: 0 },
      uOpacity: { value: 1 },
      uZone: { value: new Vector2(ZONE[0], ZONE[1]) },
    };
    const track = new Mesh(
      tgeo,
      new ShaderMaterial({ uniforms: this.trackU, vertexShader: TRACK_VERT, fragmentShader: TRACK_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    this.rig.add(track);

    // ── 内側の赤い輪（ロゴの輪）と中心の赤い点 ──
    const RING_SEG = 240;
    const rpos: number[] = [];
    const rt: number[] = [];
    const rr = R0 * 0.78;
    for (let i = 0; i < RING_SEG; i++) {
      for (const k of [i, i + 1]) {
        const a = (k / RING_SEG) * Math.PI * 2 - Math.PI / 2;
        rpos.push(Math.cos(a) * rr, 0.005, Math.sin(a) * rr);
        rt.push(k / RING_SEG);
      }
    }
    const rgeo = new BufferGeometry();
    rgeo.setAttribute('position', new BufferAttribute(new Float32Array(rpos), 3));
    rgeo.setAttribute('aT', new BufferAttribute(new Float32Array(rt), 1));
    this.ringU = { uCol: { value: red }, uDraw: { value: 0 }, uOpacity: { value: 0.9 } };
    this.rig.add(new LineSegments(rgeo, new ShaderMaterial({ uniforms: this.ringU, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false })));
    this.hub = new Mesh(new SphereGeometry(0.16, 24, 16), new MeshBasicMaterial({ color: red }));
    this.hub.position.set(0, 0.16, 0);
    this.rig.add(this.hub);

    // ── 光の点（検索してきた人） ──
    const n = this.ambient ? 0 : Math.max(160, Math.min(Math.round(o.count * 0.4), 1100));
    if (n) {
      const aScatter = new Float32Array(n * 3);
      const aTarget = new Float32Array(n * 3);
      const aSeed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        aScatter.set([(Math.random() * 2 - 1) * 16, Math.random() * 7 - 1, (Math.random() * 2 - 1) * 11], i * 3);
        oval(Math.random(), R0 + Math.random() * LANES * LW, this.tmp);
        aTarget.set([this.tmp.x, 0.02, this.tmp.z], i * 3);
        aSeed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      }
      const dgeo = new BufferGeometry();
      dgeo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
      dgeo.setAttribute('aScatter', new BufferAttribute(aScatter, 3));
      dgeo.setAttribute('aTarget', new BufferAttribute(aTarget, 3));
      dgeo.setAttribute('aSeed', new BufferAttribute(aSeed, 4));
      this.dotU = {
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uIntro: { value: o.animate ? 0 : 1 },
        uFill: { value: 0 },
        uPx: { value: 3 },
        uBurst: { value: -100 },
        uInk: { value: ink },
        uRed: { value: red },
      };
      const dots = new Points(dgeo, new ShaderMaterial({ uniforms: this.dotU, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false }));
      dots.frustumCulled = false;
      this.rig.add(dots);
    } else {
      this.dotU = { uTime: { value: 0 }, uPhase: { value: 0 }, uIntro: { value: 1 }, uFill: { value: 0 }, uPx: { value: 3 }, uBurst: { value: -100 } };
    }

    // ── 走者と残像（レーンごとに3人） ──
    const PER = 3;
    const TRAIL = 24;
    const runs: number[] = [];
    for (let lane = 0; lane < LANES; lane++) {
      for (let k = 0; k < PER; k++) runs.push(lane, k / PER + Math.random() * 0.12, 0.055 + Math.random() * 0.035, Math.random());
    }
    const rn = runs.length / 4;
    const rgeoP = new BufferGeometry();
    rgeoP.setAttribute('position', new BufferAttribute(new Float32Array(rn * 3), 3));
    rgeoP.setAttribute('aRun', new BufferAttribute(new Float32Array(runs), 4));
    rgeoP.setAttribute('aK', new BufferAttribute(new Float32Array(rn), 1));
    const common = () => ({
      uClock: { value: 0 },
      uVis: { value: 0 },
      uPx: { value: 9 },
      uTrail: { value: 0.0026 },
      uR0: { value: R0 },
      uLW: { value: LW },
      uL: { value: L },
    });
    this.runU = common();
    const runners = new Points(rgeoP, new ShaderMaterial({ uniforms: this.runU, vertexShader: RUNNER_VERT, fragmentShader: RUNNER_FRAG, transparent: true, depthWrite: false }));
    runners.frustumCulled = false;
    this.rig.add(runners);
    // 残像：1人につき24本の短い線
    const tRun: number[] = [];
    const tK: number[] = [];
    for (let i = 0; i < rn; i++) {
      for (let k = 0; k < TRAIL; k++) {
        for (const kk of [k, k + 1]) {
          tRun.push(runs[i * 4], runs[i * 4 + 1], runs[i * 4 + 2], runs[i * 4 + 3]);
          tK.push(kk);
        }
      }
    }
    const tgeoL = new BufferGeometry();
    tgeoL.setAttribute('position', new BufferAttribute(new Float32Array(tK.length * 3), 3));
    tgeoL.setAttribute('aRun', new BufferAttribute(new Float32Array(tRun), 4));
    tgeoL.setAttribute('aK', new BufferAttribute(new Float32Array(tK), 1));
    this.trailU = common();
    const trails = new LineSegments(tgeoL, new ShaderMaterial({ uniforms: this.trailU, vertexShader: RUNNER_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false }));
    trails.frustumCulled = false;
    this.rig.add(trails);

    // ── バトンの受け渡し（白い走者 → 赤い走者） ──
    this.runnerA = new Mesh(new SphereGeometry(0.19, 20, 14), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    this.runnerB = new Mesh(new SphereGeometry(0.19, 20, 14), new MeshBasicMaterial({ color: hi, transparent: true }));
    this.baton = new Mesh(new CylinderGeometry(0.075, 0.075, 0.62, 18), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    this.baton.rotation.z = Math.PI / 2;
    this.batonGlow = new Mesh(
      new SphereGeometry(0.34, 20, 14),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.rig.add(this.runnerA, this.runnerB, this.baton, this.batonGlow);
    for (let i = 0; i < 2; i++) {
      const mat = new MeshBasicMaterial({ color: red, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
      const mesh = new Mesh(new RingGeometry(0.96, 1, 96), mat);
      mesh.rotation.x = -Math.PI / 2;
      this.rig.add(mesh);
      this.pulses.push({ mesh, mat, at: -100 });
    }

    this.scene.add(this.rig);

    new ResizeObserver(() => this.resize()).observe(o.host);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.loop();
    }).observe(o.host);
    this.resize();

    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      window.addEventListener('pointerdown', this.onDown, { passive: true });
      document.addEventListener('visibilitychange', () => !document.hidden && this.loop());
      this.loop();
    } else {
      this.clock = 3;
      this.render(6);
    }
    o.host.classList.add('is-ready');
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
    this.mouseTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };

  /** クリック：号砲。走者が一斉に加速し、スタートラインから赤い輪が広がる */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    const t = (performance.now() - this.start) / 1000;
    this.burstAt = t;
    this.dotU.uBurst.value = t;
    const p = this.pulses[1];
    p.at = t;
    oval(0.002, R0 + (LANES * LW) / 2, this.tmp);
    p.mesh.position.set(this.tmp.x, 0.02, this.tmp.z);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    // 見出しの反対側にトラックを置く：投影の中心をずらす（PCは右、スマホは上）
    if (this.ambient) this.camera.setViewOffset(w, h, -w * (this.camera.aspect > 1.15 ? 0.3 : 0), this.camera.aspect > 1.15 ? h * 0.04 : h * 0.18, w, h);
    else if (wide) this.camera.setViewOffset(w, h, -w * 0.22, -h * 0.02, w, h);
    else if (this.o.layout === 'right') this.camera.setViewOffset(w, h, 0, h * 0.24, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();

    const dist = 15;
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * dist;
    const halfW = halfH * this.camera.aspect;
    const ext = L / 2 + ROUT;
    if (this.ambient) this.baseScale = this.camera.aspect > 1.15 ? Math.min((halfW * 0.42) / ext, (halfH * 1.3) / ROUT) : Math.min((halfW * 0.9) / ext, (halfH * 0.7) / ROUT);
    else if (wide) this.baseScale = Math.min((halfW * 0.44) / ext, (halfH * 0.95) / ROUT);
    else if (this.o.layout === 'right') this.baseScale = Math.min((halfW * 0.92) / ext, (halfH * 0.6) / ROUT);
    else this.baseScale = Math.min((halfW * 0.78) / ext, (halfH * 1.0) / ROUT);
    // 点の大きさは画面の高さに合わせる
    const px = Math.max(2, Math.min(4, h / 260)) * Math.min(window.devicePixelRatio || 1, 2);
    this.dotU.uPx.value = px;
    this.runU.uPx.value = px * 4;
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    // カメラ：斜め上から。ゆっくり回り、マウスで傾く。CTA帯は低い位置から
    const elev = this.ambient ? 0.42 : 0.62 - sm(1, 2, ph) * 0.08;
    const yaw = Math.sin(t * 0.07) * 0.22 + this.mouse.x * 0.25 + (this.ambient ? -0.35 : -0.18);
    const dist = 15;
    this.camera.position.set(Math.sin(yaw) * Math.cos(elev) * dist, Math.sin(elev + this.mouse.y * 0.08) * dist, Math.cos(yaw) * Math.cos(elev) * dist);
    this.camera.lookAt(0, 0, 0);
    this.rig.scale.setScalar(this.baseScale);

    const draw = this.ambient ? 1 : sm(0.05, 0.9, ph) * 1.02;
    const fill = this.ambient ? 1 : sm(0.75, 1.15, ph);
    const rise = this.ambient ? 0.35 : sm(1.2, 1.9, ph);
    this.trackU.uDraw.value = draw;
    this.trackU.uFill.value = fill;
    this.trackU.uRise.value = rise;
    this.trackU.uSweep.value = (t * 0.11) % 1;
    this.ringU.uDraw.value = sm(0.35, 1.1, ph);
    this.ringU.uOpacity.value = 0.9 - fill * 0.35;
    this.hub.scale.setScalar(Math.max(0.001, sm(0.9, 1.2, ph)) * (1 + rise * 0.25 + Math.sin(t * 2.2) * 0.06 * rise));

    this.dotU.uTime.value = t;
    this.dotU.uPhase.value = Math.min(1, ph);
    this.dotU.uFill.value = fill;
    const vis = this.ambient ? 0.8 : sm(0.85, 1.2, ph);
    for (const u of [this.runU, this.trailU]) {
      u.uClock.value = this.clock;
      u.uVis.value = vis;
    }

    this.handoff(t, rise);
    for (const p of this.pulses) {
      const age = t - p.at;
      const k = Math.min(1, Math.max(0, age / 1.6));
      p.mat.opacity = age >= 0 && age < 1.6 ? (1 - k) * 0.85 : 0;
      p.mesh.scale.setScalar(0.3 + k * (p === this.pulses[1] ? 4.5 : 2.6));
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** ホームストレートのバトンゾーンで、白い走者から赤い走者へバトンが渡る（4.6秒ごと） */
  private handoff(t: number, rise: number) {
    const show = rise > 0.01;
    this.runnerA.visible = this.runnerB.visible = this.baton.visible = this.batonGlow.visible = show;
    if (!show) return;
    const T = 4.6;
    const cycle = Math.floor(t / T);
    const u = (t % T) / T;
    const lane = 2;
    const r = R0 + (lane + 0.5) * LW;
    const sH = (ZONE[0] + ZONE[1]) / 2;
    const uH = 0.55;
    // 白い走者：全力で走ってきて、渡したら減速して消える
    const sA = u < uH ? sH - (uH - u) * 0.16 : sH + (1 - Math.exp(-(u - uH) * 7)) * 0.012;
    // 赤い走者：待って、走り出し、受け取ってから一気に加速
    const go = 0.36;
    const sB = u < go ? sH - 0.008 : sH - 0.008 + Math.pow(u - go, 2) * 0.62 + (u > uH ? (u - uH) * 0.12 : 0);
    oval(sA, r, this.tmp);
    this.runnerA.position.set(this.tmp.x, 0.19, this.tmp.z);
    oval(sB, r, this.tmp2);
    this.runnerB.position.set(this.tmp2.x, 0.19 + (u < go ? Math.abs(Math.sin(t * 6)) * 0.03 : 0), this.tmp2.z);
    const fadeA = u < uH ? Math.min(1, u * 8) : Math.max(0, 1 - (u - uH) * 4);
    const fadeB = u < 0.92 ? Math.min(1, u * 6) : Math.max(0, 1 - (u - 0.92) * 12);
    (this.runnerA.material as MeshBasicMaterial).opacity = fadeA * rise;
    (this.runnerB.material as MeshBasicMaterial).opacity = fadeB * rise;
    // バトン：白い走者の手元 → 受け渡し → 赤い走者の手元
    const k = Math.min(1, Math.max(0, (u - (uH - 0.035)) / 0.07));
    const e = k * k * (3 - 2 * k);
    this.baton.position.copy(this.runnerA.position).lerp(this.runnerB.position, e);
    this.baton.position.y += 0.1 + Math.sin(e * Math.PI) * 0.18;
    const ahead = oval(sB + 0.004, r, new Vector3()).sub(this.tmp2);
    this.baton.rotation.set(0, Math.atan2(-ahead.z, ahead.x), Math.PI / 2);
    (this.baton.material as MeshBasicMaterial).opacity = Math.max(fadeA * (1 - e), fadeB * e) * rise;
    this.batonGlow.position.copy(this.baton.position);
    const near = Math.exp(-Math.pow((u - uH) * 18, 2));
    (this.batonGlow.material as MeshBasicMaterial).opacity = near * 0.55 * rise;
    this.batonGlow.scale.setScalar(0.6 + near * 0.8);
    // 受け渡しの瞬間に、赤い輪が地面に広がる
    if (u >= uH && this.lastHandoff !== cycle) {
      this.lastHandoff = cycle;
      const p = this.pulses[0];
      p.at = t;
      p.mesh.position.set(this.baton.position.x, 0.02, this.baton.position.z);
    }
  }

  private still() {
    (this.dotU.uIntro as { value: number }).value = 1;
    this.phase = this.goal;
    this.clock = 3;
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
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.start) / 1000;
    const intro = this.dotU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.06);
    // 走る速さ：トラックが塗られてから走り出す。号砲のあとは一時的に速く
    const run = this.ambient ? 0.7 : Math.min(1, Math.max(0, (this.phase - 0.85) / 0.35));
    const burst = Math.exp(-Math.max(0, t - this.burstAt) * 1.4) * 3;
    this.clock += dt * (run + burst);
    this.render(t);
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
