import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

/**
 * 「集める → つなぐ → 決める」を描くシーン。層は4つ。
 *
 *  1. オーロラ    … 企業色（Emproなら赤・水色・重なりの色）がノイズで流れる背景。マウスの位置が淡く光る
 *  2. ボケ        … 奥行きのある大きな光の円。マウスに合わせて視差で動く
 *  3. ネットワーク … 2つで1組の点（求職者＝点 / 求人＝輪）。phase で状態が変わる
 *                    0 散らばる → 1 球状につながる（線の上を光が走る）→ 2 重なって輪の上に並ぶ（決まる）
 *  4. 粒子        … 細かい光の粒がゆっくり舞う
 *
 * マウスが近づくと点が逃げ、クリック（タップ）すると波紋が広がる。
 * 位置の計算はすべて頂点シェーダー。CPUは時間・phase・マウスを渡すだけ。
 */

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`;

const AURORA_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const AURORA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uPhase;
uniform float uStrength;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uM;
varying vec2 vUv;
${NOISE}
void main() {
  float ar = uRes.x / uRes.y;
  vec2 p = vUv; p.x *= ar;
  float t = uTime * 0.045;
  vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t + 5.2));
  vec2 r = vec2(fbm(p * 1.1 + 3.2 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p * 1.1 + 3.2 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.0 + 2.6 * r);
  float mA = smoothstep(0.52, 0.78, r.x) * smoothstep(0.3, 0.7, f);
  float mB = smoothstep(0.52, 0.78, r.y) * (1.0 - mA);
  float mM = smoothstep(0.62, 0.92, f) * (0.35 + 0.6 * clamp(uPhase - 1.0, 0.0, 1.0)) * (1.0 - max(mA, mB) * 0.6);
  vec2 m = uMouse; m.x *= ar;
  float glow = smoothstep(0.55, 0.0, distance(p, m));
  float wA = mA + glow * 0.35;
  float wB = mB + glow * 0.25;
  float sum = wA + wB + mM + 1e-4;
  vec3 col = (uA * wA + uB * wB + uM * mM) / sum;
  float a = clamp(max(max(wA, wB), mM) * 0.34 * uStrength, 0.0, 0.6);
  gl_FragColor = vec4(col * a, a);
}
`;

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform vec2 uScatter;
uniform vec3 uOffset;
uniform float uScale;
uniform vec2 uMouse;
uniform float uHover;
uniform vec3 uRipple;
uniform float uAspect;
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aC;
attribute vec2 aSeed;
attribute float aKind;
attribute float aAccent;

vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }

vec3 place(out float e1, out float e2) {
  float d = aSeed.x;
  e1 = smoothstep(0.0, 1.0, clamp((uPhase - d * 0.45) / 0.55, 0.0, 1.0));
  e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.0 - d * 0.45) / 0.55, 0.0, 1.0));
  float t = uTime;
  float spread = 1.0 + (1.0 - uIntro) * 1.2;
  vec3 a = vec3(aA.xy * uScatter * spread, aA.z * 3.0);
  a += vec3(sin(t * 0.21 + aSeed.y * 40.0), cos(t * 0.17 + aSeed.y * 31.0), sin(t * 0.13 + aSeed.y * 17.0)) * 0.3;
  vec3 b = rotY(aB * (1.0 + 0.04 * sin(t * 0.8 + aSeed.y * 6.28)), t * 0.09) * uScale + uOffset;
  vec3 c = rotX(rotZ(aC, t * 0.06), -1.08) * uScale + uOffset;
  c.y += sin(t * 1.2 + aSeed.y * 6.28) * 0.04;
  return mix(mix(a, b, e1), c, e2);
}

// マウスから逃げる ＋ クリックの波紋。ビュー空間で押し出す
vec4 interact(vec4 mv, out float energy) {
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse; d.x *= uAspect;
  float r = length(d);
  vec2 dir = r > 0.0001 ? d / r : vec2(0.0);
  float push = smoothstep(0.42, 0.0, r) * uHover;
  float age = uTime - uRipple.z;
  vec2 dr = ndc - uRipple.xy; dr.x *= uAspect;
  float rr = length(dr);
  float wave = exp(-pow((rr - age * 1.1) * 7.0, 2.0)) * exp(-age * 1.4) * step(0.0, age);
  vec2 rdir = rr > 0.0001 ? dr / rr : vec2(0.0);
  float scale = -mv.z * 0.1;
  mv.xy += dir * push * scale * 1.1 + rdir * wave * scale * 1.6;
  energy = push * 0.8 + wave;
  return mv;
}
`;

const POINT_VERT = /* glsl */ `
${COMMON}
uniform float uPixel;
varying float vKind;
varying float vAccent;
varying float vE2;
varying float vAlpha;
varying float vEnergy;
void main() {
  float e1; float e2; float energy;
  vec3 p = place(e1, e2);
  vec4 mv = interact(modelViewMatrix * vec4(p, 1.0), energy);
  gl_Position = projectionMatrix * mv;
  float base = aKind < 0.5 ? 2.6 : 5.6;
  base = mix(base, 6.6 + aAccent * 6.0, e2);
  base *= 1.0 + energy * 0.9;
  gl_PointSize = base * uPixel * (16.0 / -mv.z);
  vKind = aKind;
  vAccent = aAccent;
  vE2 = e2;
  vEnergy = energy;
  vAlpha = uIntro * (0.55 + 0.45 * aSeed.y) * smoothstep(40.0, 9.0, -mv.z);
}
`;

const POINT_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uBrand;
uniform vec3 uRed;
varying float vKind;
varying float vAccent;
varying float vE2;
varying float vAlpha;
varying float vEnergy;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float dotShape = 1.0 - smoothstep(0.40, 0.5, r);
  float ringShape = smoothstep(0.27, 0.33, r) * (1.0 - smoothstep(0.43, 0.5, r));
  float matched = max(ringShape, 1.0 - smoothstep(0.12, 0.18, r));
  float shape = mix(vKind < 0.5 ? dotShape : ringShape, matched, vE2);
  // 求職者（uInk）と求人（uBrand）が重なると、決定の色（uRed）に変わる
  vec3 col = vKind < 0.5 ? uInk : uBrand;
  col = mix(col, uRed, vE2 * (0.55 + 0.45 * vAccent));
  col = mix(col, uRed, clamp(vEnergy, 0.0, 1.0) * 0.5);
  float a = min(shape * vAlpha * (1.0 + vEnergy * 0.5), 1.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

const LINE_VERT = /* glsl */ `
${COMMON}
varying float vAlpha;
varying float vAccent;
varying float vT;
varying float vSeed;
void main() {
  float e1; float e2; float energy;
  vec3 p = place(e1, e2);
  vec4 mv = interact(modelViewMatrix * vec4(p, 1.0), energy);
  gl_Position = projectionMatrix * mv;
  float grow = smoothstep(0.55, 1.0, uPhase) * (1.0 - smoothstep(1.3, 1.85, uPhase));
  vAlpha = grow * uIntro * (0.13 + 0.3 * aAccent + energy * 0.4) * smoothstep(40.0, 9.0, -mv.z);
  vAccent = aAccent;
  vT = aKind;
  vSeed = aSeed.y;
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uBrand;
uniform vec3 uRed;
uniform float uTime;
varying float vAlpha;
varying float vAccent;
varying float vT;
varying float vSeed;
void main() {
  if (vAlpha < 0.004) discard;
  // 線の上を光が行き来する（求職者 ⇄ 求人）
  float head = fract(uTime * (0.25 + vSeed * 0.35) + vSeed * 7.0);
  float pulse = smoothstep(0.12, 0.0, abs(vT - head));
  vec3 col = mix(uBrand, uRed, max(vAccent, pulse * 0.8));
  float a = min(vAlpha * (1.0 + pulse * 5.0), 0.9);
  gl_FragColor = vec4(col * a, a);
}
`;

const BOKEH_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixel;
uniform vec2 uScatter;
uniform vec2 uMouse;
attribute vec3 aPos;
attribute vec3 aInfo; // x: 大きさ, y: 色の番号, z: 乱数
varying float vCol;
varying float vAlpha;
void main() {
  vec3 p = vec3(aPos.xy * uScatter * 1.1, aPos.z);
  float t = uTime;
  p.x += sin(t * 0.07 + aInfo.z * 12.0) * 0.8;
  p.y += cos(t * 0.05 + aInfo.z * 9.0) * 0.6 + sin(t * 0.11) * 0.2;
  // 奥ほど小さく、マウスで視差
  p.xy -= uMouse * (aPos.z + 6.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aInfo.x * uPixel * (16.0 / -mv.z);
  vCol = aInfo.y;
  vAlpha = (0.5 + 0.5 * sin(t * (0.3 + aInfo.z) + aInfo.z * 20.0));
}
`;

const BOKEH_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uM;
uniform float uIntensity;
varying float vCol;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.38, r);
  float rim = smoothstep(0.5, 0.46, r) - smoothstep(0.46, 0.4, r);
  vec3 col = vCol < 0.5 ? uA : (vCol < 1.5 ? uB : uM);
  float a = (disc * 0.12 + rim * 0.1) * (0.4 + 0.6 * vAlpha) * uIntensity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

/** ステージから操作するための共通の形（NetworkScene / LatticeScene） */
export type PhasedScene = { phase: number; target: number };

export type SceneOptions = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  count: number;
  phase: number;
  brand: string;
  ink: string;
  red: string;
  /** 'right' はPCで右寄せ（左に見出しを置くページ用） */
  layout: 'right' | 'center';
  animate: boolean;
  /** 'aurora' はネットワークを出さず、背景の光だけ（CTA帯など） */
  mode?: 'network' | 'aurora';
  /** オーロラの濃さ */
  aurora?: number;
};

function randomUnit(): Vector3 {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new Vector3(s * Math.cos(t), s * Math.sin(t), u);
}

export class NetworkScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private group = new Group();
  private uniforms: Record<string, { value: unknown }>;
  private auroraU: Record<string, { value: unknown }>;
  private bokehU: Record<string, { value: unknown }>;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  phase: number;
  private goal = 0;
  private frames = 0;
  private lastAt = 0;
  private stillTimer = 0;

  /** ステージ（スクロール）から渡される目標の場面。静止モードではここで描き直す */
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
    this.phase = o.phase;
    this.goal = o.phase;

    this.renderer = new WebGLRenderer({
      canvas: o.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // 重い端末では画素を減らす／静止させる（perf.ts）
    onPerfLevel((l) => {
      if (l === 1) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * 0.75);
        this.resize();
      } else if (l === 2) {
        cancelAnimationFrame(this.raf);
        this.still();
      }
    });
    this.camera.position.set(0, 0, 16);

    const cA = new Color(o.ink);
    const cB = new Color(o.brand);
    const cM = new Color(o.red);

    // ── 1. オーロラ ──
    this.auroraU = {
      uTime: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uMouse: { value: new Vector2(0.7, 0.5) },
      uPhase: { value: this.phase },
      uStrength: { value: o.aurora ?? 1 },
      uA: { value: cA },
      uB: { value: cB },
      uM: { value: cM },
    };
    const aurora = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        premultipliedAlpha: true,
        uniforms: this.auroraU,
        vertexShader: AURORA_VERT,
        fragmentShader: AURORA_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    aurora.frustumCulled = false;
    aurora.renderOrder = -2;
    this.scene.add(aurora);

    // ── 2. ボケ ──
    const small = window.matchMedia('(max-width: 767px)').matches;
    const bokehN = small ? 22 : 46;
    const bPos = new Float32Array(bokehN * 3);
    const bInfo = new Float32Array(bokehN * 3);
    for (let i = 0; i < bokehN; i++) {
      bPos.set([Math.random() * 2 - 1, Math.random() * 2 - 1, -Math.random() * 6 + 2], i * 3);
      bInfo.set([30 + Math.random() * 110, Math.floor(Math.random() * 3), Math.random()], i * 3);
    }
    const bGeo = new BufferGeometry();
    bGeo.setAttribute('position', new BufferAttribute(new Float32Array(bokehN * 3), 3));
    bGeo.setAttribute('aPos', new BufferAttribute(bPos, 3));
    bGeo.setAttribute('aInfo', new BufferAttribute(bInfo, 3));
    this.bokehU = {
      uTime: { value: 0 },
      uPixel: { value: this.renderer.getPixelRatio() },
      uScatter: { value: new Vector2(8, 5) },
      uMouse: { value: new Vector2() },
      uA: { value: cA },
      uB: { value: cB },
      uM: { value: cM },
      uIntensity: { value: o.mode === 'aurora' ? 1.4 : 1 },
    };
    const bokeh = new Points(
      bGeo,
      new ShaderMaterial({
        premultipliedAlpha: true,
        uniforms: this.bokehU,
        vertexShader: BOKEH_VERT,
        fragmentShader: BOKEH_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    bokeh.frustumCulled = false;
    bokeh.renderOrder = -1;
    this.scene.add(bokeh);

    // ── 3. ネットワーク ＋ 4. 粒子 ──
    this.uniforms = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uScatter: { value: new Vector2(8, 5) },
      uOffset: { value: new Vector3() },
      uScale: { value: 1 },
      uPixel: { value: this.renderer.getPixelRatio() },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uRipple: { value: new Vector3(0, 0, -100) },
      uAspect: { value: 1 },
      uInk: { value: cA },
      uBrand: { value: cB },
      uRed: { value: cM },
    };

    if (o.mode !== 'aurora' && o.count > 0) {
      this.group.add(...this.buildNetwork(o.count), this.buildDust(small ? 260 : 700));
    }
    this.scene.add(this.group);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(o.host);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.loop();
    });
    this.io.observe(o.host);
    this.resize();

    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      window.addEventListener('pointerdown', this.onDown, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.loop();
      });
      this.loop();
    } else {
      this.render(12);
    }
    o.host.classList.add('is-ready');
  }

  private buildNetwork(count: number) {
    const pairs = Math.max(60, Math.floor(count / 2));
    const n = pairs * 2;
    const aA = new Float32Array(n * 3);
    const aB = new Float32Array(n * 3);
    const aC = new Float32Array(n * 3);
    const aSeed = new Float32Array(n * 2);
    const aKind = new Float32Array(n);
    const aAccent = new Float32Array(n);
    const R = 3.0;

    for (let k = 0; k < pairs; k++) {
      const delay = Math.random();
      const accent = Math.random() < 0.08 ? 1 : 0;
      const pCand = randomUnit().multiplyScalar(R * (0.86 + Math.random() * 0.14));
      const pJob = pCand
        .clone()
        .normalize()
        .add(randomUnit().multiplyScalar(0.62))
        .normalize()
        .multiplyScalar(R * (0.86 + Math.random() * 0.14));
      const theta = (k / pairs) * Math.PI * 2 + (Math.random() - 0.5) * 0.02;
      const rr = 3.5 + (Math.random() - 0.5) * 0.3;
      const ring = new Vector3(Math.cos(theta) * rr, Math.sin(theta) * rr, (Math.random() - 0.5) * 0.2);
      const seed = Math.random();

      for (let s = 0; s < 2; s++) {
        const i = k * 2 + s;
        aA.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
        const b = s === 0 ? pCand : pJob;
        aB.set([b.x, b.y, b.z], i * 3);
        aC.set([ring.x, ring.y, ring.z], i * 3);
        // 組の2点は同じ乱数（線の上を走る光の速さをそろえるため）
        aSeed.set([delay, s === 0 ? seed : seed], i * 2);
        aKind[i] = s;
        aAccent[i] = accent;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aA', new BufferAttribute(aA, 3));
    geo.setAttribute('aB', new BufferAttribute(aB, 3));
    geo.setAttribute('aC', new BufferAttribute(aC, 3));
    geo.setAttribute('aSeed', new BufferAttribute(aSeed, 2));
    geo.setAttribute('aKind', new BufferAttribute(aKind, 1));
    geo.setAttribute('aAccent', new BufferAttribute(aAccent, 1));

    const common = {
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    };
    const lines = new LineSegments(geo, new ShaderMaterial({
        premultipliedAlpha: true, ...common, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG }));
    const points = new Points(geo, new ShaderMaterial({
        premultipliedAlpha: true, ...common, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG }));
    // 位置はシェーダーで決まるので、視錐台カリングは切っておく
    lines.frustumCulled = false;
    points.frustumCulled = false;
    return [lines, points] as const;
  }

  /** 細かい光の粒。ネットワークと同じ uniforms を使い、phase に関係なく漂う */
  private buildDust(n: number) {
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 8 - 5], i * 3);
      seed[i] = Math.random();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aS', new BufferAttribute(seed, 1));
    const mat = new ShaderMaterial({
        premultipliedAlpha: true,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixel;
        uniform vec2 uScatter;
        uniform float uIntro;
        attribute float aS;
        varying float vA;
        varying float vS;
        void main() {
          vec3 p = vec3(position.xy * uScatter * 1.15, position.z);
          // 下から上へゆっくり昇り、上端に着いたら下から出直す
          float h = uScatter.y * 1.15;
          p.y = mod(p.y + h + uTime * (0.05 + aS * 0.12), 2.0 * h) - h;
          p.x += sin(uTime * 0.3 + aS * 30.0) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.4 + aS * 2.4) * uPixel * (16.0 / -mv.z);
          vA = uIntro * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + aS * 2.0) + aS * 40.0)));
          vS = aS;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uInk;
        uniform vec3 uBrand;
        varying float vA;
        varying float vS;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r) * vA * 0.6;
          if (a < 0.01) discard;
          gl_FragColor = vec4((vS < 0.5 ? uInk : uBrand) * a, a);
        }`,
    });
    const dust = new Points(geo, mat);
    dust.frustumCulled = false;
    return dust;
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.mouseTarget.set(x, y);
    this.hoverTarget = Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05 ? 1 : 0;
  };

  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    (this.uniforms.uRipple.value as Vector3).set(x, y, this.uniforms.uTime.value as number);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    (this.uniforms.uScatter.value as Vector2).set(halfW * 1.02, halfH * 1.02);
    (this.bokehU.uScatter.value as Vector2).set(halfW, halfH);
    (this.auroraU.uRes.value as Vector2).set(w, h);
    this.uniforms.uAspect.value = this.camera.aspect;
    this.uniforms.uScale.value = Math.min(1, halfW / 4.6, halfH / 4.4);
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    const offset = this.uniforms.uOffset.value as Vector3;
    if (wide) offset.set(halfW * 0.4, 0, 0);
    else if (this.o.layout === 'right') offset.set(0, halfH * 0.3, 0);
    else offset.set(0, 0, 0);
    if (!this.o.animate) this.render(12);
  }

  private render(time: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uPhase.value = this.phase;
    this.auroraU.uTime.value = time;
    this.auroraU.uPhase.value = this.phase;
    this.bokehU.uTime.value = time;
    this.renderer.render(this.scene, this.camera);
  }

  /** 静止モード：入場の演出を終えた状態で、いまの場面を1回だけ描く */
  private still() {
    (this.uniforms.uIntro as { value: number }).value = 1;
    this.phase = this.goal;
    this.render((performance.now() - this.start) / 1000);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden || !this.o.animate) {
      this.lastAt = 0; // 止まっていた時間は数えない
      return;
    }
    if (perfLevel() === 2) return this.still();
    this.raf = requestAnimationFrame(this.loop);
    this.frames += 1;
    // 軽量モードでは1コマおきに描く
    if (perfLevel() === 1 && this.frames % 2) return;
    const t = (performance.now() - this.start) / 1000;
    const intro = this.uniforms.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.01);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    (this.uniforms.uMouse.value as Vector2).copy(this.mouse);
    this.uniforms.uHover.value = this.hover;
    (this.bokehU.uMouse.value as Vector2).copy(this.mouse);
    (this.auroraU.uMouse.value as Vector2).set(this.mouse.x * 0.5 + 0.5, this.mouse.y * 0.5 + 0.5);
    // スクロールで決定に近づくほど、カメラが少し寄って傾く
    this.camera.position.z = 16 - Math.min(this.phase, 2) * 0.9;
    this.group.rotation.y = this.mouse.x * 0.16;
    this.group.rotation.x = -this.mouse.y * 0.1;
    this.group.rotation.z = Math.sin(t * 0.05) * 0.05 + (this.phase > 1 ? (this.phase - 1) * 0.08 : 0);
    this.render(t);
    // コマの間隔を報告する（最初の数フレームはシェーダーの準備で遅いので測らない）
    const now = performance.now();
    // 軽量モードは1コマおきなので、間隔を半分にして比べる
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
