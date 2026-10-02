import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「画面の壁」のシーン（Smartaleck など studio の世界観用）。
 *
 *  phase 0〜1  リール・動画・トーク画面・AIの答えが宙を漂い、ゆるく曲がった壁（放送局のモニター壁）に一枚ずつ収まる（設計する）
 *  phase 1     壁が出そろい、ファインダーの四隅が現れる。画面の中で動画が流れる（撮って、出す）
 *  phase 2     画面が中心へ向かう集中線に並び直し、中心に青い光（ヒーローの一点）が立ち上がる。波紋が広がる（数字を読む）
 *
 * 画面は1つのジオメトリを instancing で並べ、中身（網点・再生ボタン・吹き出し・AIの星）はフラグメントで描く。
 * マウスを近づけると画面が手前に浮き、クリックするとフラッシュが焚かれる。
 */

const COLS = 9;
const ROWS = 5;
/** 画面の種類と大きさ（幅, 高さ）。0=リール 1=動画 2=トーク 3=AIの答え */
const SIZES: [number, number][] = [
  [0.62, 1.08],
  [1.12, 0.64],
  [0.78, 0.98],
  [0.96, 0.74],
];

const CARD_VERT = /* glsl */ `
attribute vec3 aWall;
attribute vec3 aBurst;
attribute vec3 aScatter;
attribute vec4 aInfo; // x: 種類, y: 乱数, z: 収まる順番, w: 乱数
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uAmbient;
uniform vec2 uScatter;
uniform mat4 uRig;
uniform vec2 uMouse;
uniform float uHover;
uniform float uAspect;
uniform float uFlash;
varying vec2 vUv;
varying vec2 vSize;
varying float vKind;
varying float vSeed;
varying float vFront;
varying float vLift;
varying float vFog;
varying float vBurst;

mat3 rotXYZ(vec3 a) {
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

void main() {
  float t = uTime;
  float kind = aInfo.x;
  vec2 size = kind < 0.5 ? vec2(${SIZES[0][0]}, ${SIZES[0][1]}) : kind < 1.5 ? vec2(${SIZES[1][0]}, ${SIZES[1][1]}) : kind < 2.5 ? vec2(${SIZES[2][0]}, ${SIZES[2][1]}) : vec2(${SIZES[3][0]}, ${SIZES[3][1]});

  float e1 = smoothstep(0.0, 1.0, clamp((uPhase - aInfo.z * 0.5) / 0.5, 0.0, 1.0));
  float e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.0 - aInfo.z * 0.35) / 0.65, 0.0, 1.0));

  // 漂う：画面いっぱいに、ゆっくり回りながら
  vec3 sc = vec3(aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.7), aScatter.z * 4.0 - 1.0);
  sc += vec3(sin(t * 0.19 + aInfo.y * 40.0), cos(t * 0.15 + aInfo.w * 30.0), sin(t * 0.11 + aInfo.y * 17.0)) * 0.5;
  mat3 tumble = rotXYZ(vec3(sin(t * 0.35 + aInfo.y * 9.0) * 0.7, sin(t * 0.27 + aInfo.w * 6.0) * 0.9, sin(t * 0.2 + aInfo.y * 4.0) * 0.4));

  // 壁：円柱の内側に並ぶ。中心の軸の方を向く
  float ang = aWall.x;
  vec3 wall = vec3(sin(ang) * 10.0, aWall.y, 10.0 - cos(ang) * 10.0);
  wall.y += sin(t * 0.8 + aInfo.y * 6.28) * 0.025;
  mat3 face = rotXYZ(vec3(0.0, -ang, 0.0));

  // 集中線：中心から外へ放射状。長い辺を中心に向け、速さで細く引き伸ばす
  float phi = aBurst.x;
  float r = aBurst.y + sin(t * 0.9 + aInfo.y * 6.28) * 0.12;
  vec3 burst = vec3(cos(phi) * r, sin(phi) * r, aBurst.z);
  mat3 radial = rotXYZ(vec3(0.0, 0.0, phi + (kind < 0.5 || kind > 1.5 && kind < 2.5 ? 1.5708 : 0.0)));
  vec2 stretch = mix(vec2(1.0), kind < 0.5 || kind > 1.5 && kind < 2.5 ? vec2(0.42, 1.55) : vec2(1.55, 0.42), e2);

  vec3 shape = position * vec3(size * stretch, 0.035) * uIntro;
  vec3 local = mix(wall, burst, e2);
  // 壁の向き（面がこちら）から、集中線の向き（中心を指す）へ。回転は形ごと混ぜて、途中で跳ばないように
  vec3 placed = mix(face * shape, radial * shape, e2);
  vec3 world = (uRig * vec4(local + placed, 1.0)).xyz;
  vec3 air = sc + tumble * shape;
  vec3 p = mix(air, world, e1);
  p = mix(p, air, uAmbient);

  vec3 nWall = normalize(mat3(uRig) * normalize(mix(face * normal, radial * normal, e2)));
  vec3 n = normalize(mix(tumble * normal, nWall, e1 * (1.0 - uAmbient)));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // マウスの近くの画面は、手前に浮く
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dm = ndc - uMouse; dm.x *= uAspect;
  float near = smoothstep(0.32, 0.0, length(dm)) * uHover;
  mv.z += near * 0.9;
  mv.xy += normalize(dm + 1e-4) * near * 0.08;
  gl_Position = projectionMatrix * mv;

  vUv = uv;
  vSize = size * stretch;
  vKind = kind;
  vSeed = aInfo.y;
  vFront = normal.z > 0.5 ? 1.0 : 0.0;
  vLift = near + uFlash * (0.5 + 0.5 * aInfo.w);
  vFog = smoothstep(14.0, 32.0, -mv.z);
  vBurst = e2 * (1.0 - uAmbient);
}
`;

const CARD_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uBlue;
uniform float uTime;
uniform float uAmbient;
varying vec2 vUv;
varying vec2 vSize;
varying float vKind;
varying float vSeed;
varying float vFront;
varying float vLift;
varying float vFog;
varying float vBurst;

float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float fill(float d) { return 1.0 - smoothstep(-0.004, 0.004, d); }
float tri(vec2 p, float s) { p.x += s * 0.25; return max(abs(p.y) * 1.6 + p.x * 0.9 - s * 0.6, -p.x - s * 0.5); }

void main() {
  vec3 paper = vec3(1.0);
  vec3 pale = mix(vec3(1.0), uBlue, 0.12);
  vec2 p = (vUv - 0.5) * vSize; // 画面の中の座標（実寸）
  vec2 h = vSize * 0.5;
  float t = uTime + vSeed * 20.0;
  vec3 col = paper;

  if (vFront < 0.5) {
    // 裏と側面：墨
    gl_FragColor = vec4(mix(uInk, paper, vFog * 0.85), 1.0);
    return;
  }

  if (vKind < 0.5) {
    // リール：青から墨へのグラデーションに網点。右に縦のアイコン、下にキャプションと進捗
    float g = clamp(vUv.y * 1.1 - 0.05, 0.0, 1.0);
    col = mix(uInk, uBlue, g);
    vec2 cell = fract(p * 26.0) - 0.5;
    float dots = step(length(cell), 0.18 + 0.22 * (1.0 - vUv.y));
    col = mix(col, mix(col, paper, 0.18), dots);
    for (int i = 0; i < 3; i++) {
      float y = -0.02 - float(i) * 0.12;
      col = mix(col, paper, fill(length(p - vec2(h.x - 0.09, y)) - 0.035));
    }
    col = mix(col, paper, fill(box(p - vec2(-0.08, -h.y + 0.16), vec2(0.15, 0.018), 0.018)) * 0.9);
    col = mix(col, paper, fill(box(p - vec2(-0.12, -h.y + 0.11), vec2(0.11, 0.014), 0.014)) * 0.6);
    float prog = fract(t * 0.07);
    float bar = fill(box(p - vec2(0.0, -h.y + 0.045), vec2(h.x - 0.06, 0.006), 0.006));
    col = mix(col, mix(vec3(0.75), paper, step(vUv.x, 0.06 + prog * 0.88)), bar);
  } else if (vKind < 1.5) {
    // 動画：墨の画面に斜めの青い帯、大きな文字の帯、白い再生ボタン、下に進捗
    col = uInk;
    float band = smoothstep(0.02, 0.0, abs(p.x * 0.6 + p.y - 0.05 + sin(vSeed * 6.0) * 0.1) - 0.16);
    col = mix(col, uBlue, band * 0.9);
    col = mix(col, paper, fill(box(p - vec2(-h.x + 0.3, h.y - 0.14), vec2(0.22, 0.045), 0.01)));
    col = mix(col, mix(paper, uBlue, 0.0), fill(box(p - vec2(-h.x + 0.24, h.y - 0.25), vec2(0.16, 0.035), 0.01)) * 0.8);
    float btn = fill(length(p - vec2(0.08, -0.02)) - 0.12);
    col = mix(col, paper, btn);
    col = mix(col, uInk, fill(tri(p - vec2(0.09, -0.02), 0.09)) * btn);
    float prog = 0.25 + 0.6 * fract(t * 0.05);
    float bar = fill(box(p - vec2(0.0, -h.y + 0.03), vec2(h.x - 0.04, 0.008), 0.004));
    col = mix(col, mix(vec3(0.55), uBlue, step(vUv.x, prog)), bar);
  } else if (vKind < 2.5) {
    // トーク：淡い青の画面に、左の白い吹き出しと右の青い吹き出し。下にメニュー
    col = pale;
    col = mix(col, uBlue, fill(box(p - vec2(0.0, h.y - 0.06), vec2(h.x, 0.06), 0.0)) * 0.95);
    float b1 = box(p - vec2(-0.12, 0.17), vec2(0.2, 0.06), 0.06);
    col = mix(col, uInk, fill(b1 - 0.008));
    col = mix(col, paper, fill(b1));
    float b2 = box(p - vec2(0.12, 0.0), vec2(0.18, 0.06), 0.06);
    float typing = step(0.35, fract(t * 0.18 + vSeed));
    col = mix(col, uBlue, fill(b2) * typing);
    float b3 = box(p - vec2(-0.14, -0.17), vec2(0.17, 0.05), 0.05);
    col = mix(col, uInk, fill(b3 - 0.008));
    col = mix(col, paper, fill(b3));
    for (int i = 0; i < 3; i++) {
      col = mix(col, mix(uBlue, paper, 0.55), fill(box(p - vec2(-0.24 + float(i) * 0.24, -h.y + 0.07), vec2(0.1, 0.045), 0.012)));
    }
  } else {
    // AIの答え：白い画面に青い星、文字の線、出典のチップ
    col = paper;
    vec2 q = p - vec2(-h.x + 0.14, h.y - 0.14);
    float star = abs(q.x) * abs(q.y) * 60.0 + length(q) * 3.0;
    col = mix(col, uBlue, 1.0 - smoothstep(0.18, 0.24, star));
    for (int i = 0; i < 4; i++) {
      float w = i == 3 ? 0.18 : 0.33 - float(i) * 0.03;
      float shimmer = 0.5 + 0.5 * sin(t * 1.6 - float(i) * 0.7);
      col = mix(col, mix(vec3(0.82), uBlue, shimmer * 0.25), fill(box(p - vec2(-h.x + 0.1 + w, h.y - 0.3 - float(i) * 0.085), vec2(w, 0.016), 0.016)));
    }
    for (int i = 0; i < 3; i++) {
      float c = box(p - vec2(-h.x + 0.17 + float(i) * 0.22, -h.y + 0.09), vec2(0.085, 0.035), 0.035);
      col = mix(col, uBlue, fill(c) - fill(c + 0.012));
    }
  }

  // 墨の太い縁（漫画のコマ）
  float edge = box(p, h, 0.04);
  float rim = smoothstep(-0.03, -0.022, edge);
  col = mix(col, uInk, rim);

  // 浮いた画面とフラッシュは白く光る。集中線になった画面は少し青みを帯びる
  col = mix(col, mix(col, uBlue, 0.35), vBurst * 0.25);
  col = mix(col, paper, clamp(vLift, 0.0, 1.0) * 0.35);
  col = mix(col, paper, vFog * 0.85);
  // 背景用（CTA帯など）は半透明で、ゆっくり漂うだけ
  gl_FragColor = vec4(col, uAmbient > 0.5 ? 0.38 : 1.0);
}
`;

const LINE_VERT = /* glsl */ `
attribute vec3 aT; // x: 線の上の位置(0=外, 1=内), y: 乱数, z: 線の長さの比
uniform float uTime;
uniform float uShow;
varying float vA;
varying float vT;
void main() {
  vT = aT.x;
  float flow = fract(aT.x * 0.6 - uTime * (0.35 + aT.y * 0.4) + aT.y * 7.0);
  vA = uShow * smoothstep(0.0, 0.25, aT.x) * (0.25 + 0.75 * smoothstep(0.75, 1.0, flow)) * (0.35 + aT.z * 0.65);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uCol;
varying float vA;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(uCol, vA);
}
`;

const CORE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** 中心の一点：青い光の玉に、網点の輪 */
const CORE_FRAG = /* glsl */ `
uniform vec3 uBlue;
uniform float uGlow;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float core = 1.0 - smoothstep(0.34, 0.38, r);
  float halo = (1.0 - smoothstep(0.38, 1.0, r)) * 0.55;
  vec2 cell = fract(vUv * 34.0) - 0.5;
  float dots = step(length(cell), 0.32 * (1.0 - smoothstep(0.38, 0.95, r))) * step(0.4, r);
  vec3 col = mix(uBlue, vec3(1.0), smoothstep(0.3, 0.0, r) * (0.55 + 0.25 * sin(uTime * 2.4)));
  float a = max(core, max(halo * uGlow, dots * 0.9)) ;
  gl_FragColor = vec4(mix(uBlue, col, core), a);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

type U = Record<string, { value: unknown }>;

export class FeedScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private cardU: U;
  private lineU: U;
  private coreU: U;
  private core: Mesh;
  private brackets: LineSegments;
  private bracketMat: ShaderMaterial;
  private rings: { mesh: Mesh; u: U; offset: number }[] = [];
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private flash = 0;
  private offset = new Vector3();
  private baseScale = 0.6;
  phase: number;
  private goal = 0;
  private frames = 0;
  private lastAt = 0;
  private stillTimer = 0;

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
    this.camera.position.set(0, 0, 16);

    const ink = new Color(o.ink);
    const blue = new Color(o.brand);
    const ambient = o.mode === 'aurora';

    // ── 画面：壁の位置・集中線の位置・漂う位置 ──
    const n = COLS * ROWS;
    const aWall = new Float32Array(n * 3);
    const aBurst = new Float32Array(n * 3);
    const aScatter = new Float32Array(n * 3);
    const aInfo = new Float32Array(n * 4);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      // 列ごとに種類を変え、同じ列でも少しずらす（モニター壁の不揃いな並び）
      const kind = (c * 3 + r * 2 + (c % 2)) % 4;
      const ang = (c - (COLS - 1) / 2) * 0.135;
      const y = (r - (ROWS - 1) / 2) * 1.2 + (c % 2 ? 0.08 : -0.08);
      aWall.set([ang, y, 0], i * 3);
      const phi = i * golden + Math.random() * 0.2;
      const rad = 2.3 + Math.pow(Math.random(), 0.8) * 4.6;
      aBurst.set([phi, rad, -rad * 0.18], i * 3);
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
      const d = Math.hypot(ang / 0.6, y / 2.6) / Math.SQRT2;
      aInfo.set([kind, Math.random(), Math.min(1, d * 0.7 + Math.random() * 0.3), Math.random()], i * 4);
    }
    const box = new BoxGeometry(1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = box.index;
    geo.setAttribute('position', box.getAttribute('position'));
    geo.setAttribute('normal', box.getAttribute('normal'));
    geo.setAttribute('uv', box.getAttribute('uv'));
    geo.setAttribute('aWall', new InstancedBufferAttribute(aWall, 3));
    geo.setAttribute('aBurst', new InstancedBufferAttribute(aBurst, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.instanceCount = ambient ? Math.round(n * 0.4) : n;

    this.cardU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uAmbient: { value: ambient ? 1 : 0 },
      uScatter: { value: new Vector2(8, 5) },
      uRig: { value: new Matrix4() },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uFlash: { value: 0 },
      uInk: { value: ink },
      uBlue: { value: blue },
    };
    const cards = new Mesh(
      geo,
      new ShaderMaterial({
        uniforms: this.cardU,
        vertexShader: CARD_VERT,
        fragmentShader: CARD_FRAG,
        depthTest: true,
        depthWrite: !ambient,
        transparent: ambient,
      }),
    );
    cards.frustumCulled = false;
    this.scene.add(cards);

    // ── 集中線：中心へ向かう細い線。線の上を光が内へ走る ──
    const LINES = window.matchMedia('(max-width: 767px)').matches ? 90 : 170;
    const lp: number[] = [];
    const lt: number[] = [];
    for (let i = 0; i < LINES; i++) {
      const a = (i / LINES) * Math.PI * 2 + (Math.random() - 0.5) * 0.03;
      const rIn = 1.25 + Math.random() * 0.9;
      const rOut = 6.5 + Math.random() * 4;
      const seed = Math.random();
      const len = Math.random();
      const SEG = 6;
      for (let s = 0; s < SEG; s++) {
        for (const k of [s / SEG, (s + 1) / SEG]) {
          const rr = rOut + (rIn - rOut) * k;
          lp.push(Math.cos(a) * rr, Math.sin(a) * rr, -0.4);
          lt.push(k, seed, len);
        }
      }
    }
    const lgeo = new BufferGeometry();
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(lp), 3));
    lgeo.setAttribute('aT', new BufferAttribute(new Float32Array(lt), 3));
    this.lineU = { uTime: { value: 0 }, uShow: { value: 0 }, uCol: { value: ink } };
    const lines = new LineSegments(
      lgeo,
      new ShaderMaterial({ uniforms: this.lineU, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false }),
    );
    lines.frustumCulled = false;
    this.rig.add(lines);

    // ── ファインダーの四隅：壁がそろった場面（撮って、出す）でだけ出る ──
    const W = 6.4;
    const H = 3.6;
    const L = 0.9;
    const corners = [
      [-W, H, 1, -1],
      [W, H, -1, -1],
      [-W, -H, 1, 1],
      [W, -H, -1, 1],
    ];
    const bp: number[] = [];
    for (const [x, y, dx, dy] of corners) bp.push(x, y, 1.2, x + dx * L, y, 1.2, x, y, 1.2, x, y + dy * L, 1.2);
    const bgeo = new BufferGeometry();
    bgeo.setAttribute('position', new BufferAttribute(new Float32Array(bp), 3));
    this.bracketMat = new ShaderMaterial({
      uniforms: { uCol: { value: ink }, uOpacity: { value: 0 } },
      vertexShader: CORE_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.brackets = new LineSegments(bgeo, this.bracketMat);
    this.rig.add(this.brackets);

    // ── 中心の一点と波紋 ──
    this.coreU = { uBlue: { value: blue }, uGlow: { value: 0 }, uTime: { value: 0 } };
    this.core = new Mesh(
      new CircleGeometry(1.6, 64),
      new ShaderMaterial({ uniforms: this.coreU, vertexShader: CORE_VERT, fragmentShader: CORE_FRAG, transparent: true, depthWrite: false }),
    );
    this.rig.add(this.core);
    for (let i = 0; i < 3; i++) {
      const u = { uCol: { value: blue }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.97, 1, 96),
        new ShaderMaterial({ uniforms: u, vertexShader: CORE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
      );
      this.rig.add(mesh);
      this.rings.push({ mesh, u, offset: i / 3 });
    }
    if (ambient) this.rig.visible = false;
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

  /** クリック：フラッシュを焚く */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    this.flash = 1;
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    (this.cardU.uScatter.value as Vector2).set(halfW * 1.02, halfH * 1.02);
    this.cardU.uAspect.value = this.camera.aspect;
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    if (wide) {
      this.offset.set(halfW * 0.4, 0, 0);
      this.baseScale = Math.min(0.72, (halfW * 0.6) / 6.6, (halfH * 1.5) / 4.2);
    } else if (this.o.layout === 'right') {
      // スマホ：文字は下半分に来るので、壁は上の空いた場所に
      this.offset.set(0, halfH * 0.48, 0);
      this.baseScale = Math.min(0.62, (halfW * 1.75) / 6.6, (halfH * 0.66) / 4.2);
    } else {
      this.offset.set(0, 0, 0);
      this.baseScale = Math.min(0.72, (halfW * 0.92) / 6.6, (halfH * 1.5) / 4.2);
    }
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const burst = sm(1.15, 1.85, ph);
    this.rig.position.copy(this.offset);
    this.rig.scale.setScalar(this.baseScale);
    // 壁は少し左から見る角度。集中線になると正面を向く。マウスで傾く
    const yaw = (-0.32 + Math.sin(t * 0.13) * 0.05) * (1 - burst) + this.mouse.x * 0.22;
    this.rig.rotation.set(-0.06 - this.mouse.y * 0.1, yaw, Math.sin(t * 0.07) * 0.02 + burst * Math.sin(t * 0.2) * 0.05, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.cardU.uRig.value as Matrix4).copy(this.rig.matrixWorld);

    this.cardU.uTime.value = t;
    this.cardU.uPhase.value = this.o.mode === 'aurora' ? 0 : ph;
    this.cardU.uFlash.value = this.flash;
    this.lineU.uTime.value = t;
    this.lineU.uShow.value = burst;
    this.bracketMat.uniforms.uOpacity.value = 0.9 * sm(0.75, 1.0, ph) * (1 - sm(1.1, 1.4, ph));

    this.coreU.uTime.value = t;
    this.coreU.uGlow.value = burst;
    const pulse = 1 + Math.sin(t * 2.4) * 0.04 * burst;
    this.core.scale.setScalar(Math.max(0.001, burst) * pulse);
    this.core.position.set(0, 0, 0.2);
    for (const r of this.rings) {
      const k = (t * 0.3 + r.offset) % 1;
      r.mesh.position.set(0, 0, 0.15);
      r.mesh.scale.setScalar(0.8 + k * 6.2);
      r.u.uOpacity.value = burst * (1 - k) * 0.45;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    (this.cardU.uIntro as { value: number }).value = 1;
    this.flash = 0;
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
    const intro = this.cardU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    this.flash *= 0.9;
    (this.cardU.uMouse.value as Vector2).copy(this.mouse);
    this.cardU.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
