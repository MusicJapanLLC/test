import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
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
 * 「移す → 守る → 戻す」を、サーバーの引越しで描くシーン（DPパートナーズなど console の世界観用）。
 *
 *  phase 0〜1  左の古いサーバー（ラック）から、右の新しいサーバーへ、Webサイトの板（ブレード）が弧を描いて移る。
 *              移っている途中の板は青く光り、あいだを小さなデータの粒が流れる（移す）
 *  phase 1     移し終えると、新しいサーバーの足もとでレーダーが回り、鼓動の輪が広がる。前面のランプが緑に灯る。
 *              データの粒は、奥にある別の保管庫（S3のバケツ）へ流れ始める（守る：見張りと、別の場所への控え）
 *  phase 2     数秒おきに、サイトの一部が赤く点滅して崩れ落ちる。すぐに保管庫から控えが飛んできて、
 *              緑に光りながら元の場所に収まる（戻す：壊れても、別の場所の控えから戻る）。クリックでも起こせる
 *
 * 板は1つのジオメトリを instancing で並べ、面は白・辺は紺をフラグメントで描く（線画の設計図に見える）。
 *
 * 2026-10 の追加（サイト引越し屋さんのロゴから）：
 *   ・足もとの道を、オレンジのトラックが DP の箱（ロゴの立方体）を積んで往復する。移し終えると新しいサーバーの横に停まる
 *   ・新しいサーバーの上に、心拍のような監視の線。壊れた瞬間は赤く乱れて平らになり、控えが戻ると打ち直す
 *   ・奥に、ロゴの地球の経線と緯線がゆっくり回る
 */

const TILE = new Vector3(0.66, 0.2, 0.74);
/** 壊れて戻るまでの1周（秒） */
const CYCLE = 6.5;

const TILE_VERT = /* glsl */ `
attribute vec3 aOld;
attribute vec3 aNew;
attribute vec3 aVault;
attribute vec3 aScatter;
attribute vec4 aSeed; // x: 移る順番, y: 乱数, z: 壊れる板なら1, w: 乱数
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uGuard;
uniform float uRestore;
uniform float uCycle;
uniform float uAmbient;
uniform vec2 uScatter;
uniform mat4 uRig;
uniform vec2 uMouse;
uniform float uHover;
uniform vec3 uRipple;
uniform float uAspect;
uniform vec3 uSize;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFly;
varying float vAlert;
varying float vOk;
varying float vOld;
varying float vLed;
varying float vFront;
varying float vSeed;
varying float vEnergy;

mat3 rotXYZ(vec3 a) {
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

vec3 bez(vec3 a, vec3 c, vec3 b, float t) {
  float u = 1.0 - t;
  return u * u * a + 2.0 * u * t * c + t * t * b;
}

void main() {
  float t = uTime;
  vec3 shape = position * uSize * uIntro;

  // ── 移す：古いサーバーから新しいサーバーへ、上の段から順に弧を描いて移る ──
  float m = clamp((uPhase - aSeed.x * 0.75) / 0.25, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  float fly = 4.0 * m * (1.0 - m);
  vec3 ctrl = (aOld + aNew) * 0.5 + vec3(0.0, 3.0 + aSeed.y * 2.6, (aSeed.w - 0.5) * 2.4);
  vec3 pos = bez(aOld, ctrl, aNew, m);
  pos.y += sin(t * 1.4 + aSeed.y * 30.0) * 0.16 * fly;
  mat3 R = rotXYZ(vec3(aSeed.y - 0.5, aSeed.w * 2.0 - 1.0, aSeed.y) * fly * 2.2);
  vec3 off = R * shape;
  vec3 nrm = R * normal;

  // ── 戻す：壊れる板だけ、赤く点滅 → 崩れ落ちる → 保管庫から控えが飛んできて収まる ──
  float c = uCycle;
  float hit = aSeed.z * uRestore;
  float alert = smoothstep(0.12, 0.15, c) * (1.0 - smoothstep(0.27, 0.3, c));
  float fall = smoothstep(0.26, 0.44, c) * (1.0 - step(0.44, c));
  float back = smoothstep(0.44, 0.8, c) * step(0.44, c);
  float ok = step(0.44, c) * (1.0 - smoothstep(0.82, 1.0, c));
  vec3 cPos;
  vec3 cOff;
  vec3 cN;
  if (c < 0.44) {
    vec3 shake = vec3(sin(t * 61.0 + aSeed.y * 9.0), cos(t * 53.0 + aSeed.w * 7.0), sin(t * 47.0)) * 0.07 * alert;
    vec3 drop = vec3((aSeed.y - 0.5) * 2.6, -fall * 5.5, 1.6 + aSeed.w * 2.2) * fall;
    cPos = aNew + shake + drop;
    mat3 tumble = rotXYZ(vec3(aSeed.y + 0.4, aSeed.w, 0.5) * fall * 5.0);
    cOff = tumble * shape * (1.0 - fall);
    cN = tumble * normal;
  } else {
    float bk = back * back * (3.0 - 2.0 * back);
    vec3 vc = (aVault + aNew) * 0.5 + vec3(0.0, 2.4 + aSeed.y * 1.6, 0.0);
    cPos = bez(aVault, vc, aNew, bk);
    mat3 turn = rotXYZ(vec3(aSeed.w, aSeed.y, 0.0) * (1.0 - bk) * 3.0);
    cOff = turn * shape * mix(0.4, 1.0, bk);
    cN = turn * normal;
  }
  pos = mix(pos, cPos, hit);
  off = mix(off, cOff, hit);
  nrm = normalize(mix(nrm, cN, hit));

  vec3 pRig = (uRig * vec4(pos + off, 1.0)).xyz;
  vec3 nRig = normalize(mat3(uRig) * nrm);

  // CTA帯などの背景：板がばらばらに漂う
  vec3 sc = vec3(aScatter.xy * uScatter, aScatter.z * 3.0);
  sc += vec3(sin(t * 0.2 + aSeed.y * 40.0), cos(t * 0.17 + aSeed.w * 31.0), 0.0) * 0.4;
  mat3 spin = rotXYZ(vec3(1.0, 1.3, 0.7) * (0.15 + aSeed.w * 0.35) * t + aSeed.y * 6.28);
  vec3 pAmb = sc + spin * (position * uSize * 0.9 * uIntro);
  vec3 p = mix(pRig, pAmb, uAmbient);
  vec3 n = normalize(mix(nRig, spin * normal, uAmbient));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // マウスから少し逃げる ＋ クリックの波
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dm = ndc - uMouse; dm.x *= uAspect;
  float r = length(dm);
  float push = smoothstep(0.32, 0.0, r) * uHover;
  float age = uTime - uRipple.z;
  vec2 dr = ndc - uRipple.xy; dr.x *= uAspect;
  float wave = exp(-pow((length(dr) - age * 1.0) * 6.0, 2.0)) * exp(-age * 1.2) * step(0.0, age);
  float k = -mv.z * 0.1;
  mv.xy += (r > 0.0001 ? dm / r : vec2(0.0)) * push * k * 0.7;
  mv.y += wave * k * 1.2;

  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vSeed = aSeed.y;
  vFront = abs(normal.z);
  vFly = fly * (1.0 - hit) * (1.0 - uAmbient);
  vAlert = alert * hit + alert * uRestore * 0.18 * m * (1.0 - aSeed.z);
  vOk = ok * hit;
  vOld = (1.0 - m) * (1.0 - uAmbient);
  vLed = uGuard * m * (1.0 - uAmbient);
  vEnergy = push + wave;
  vec3 L = normalize(vec3(0.35, 1.0, 0.55));
  vShade = 0.86 + 0.14 * max(dot(n, L), 0.0);
  vFog = smoothstep(10.0, 28.0, -mv.z);
}
`;

const TILE_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uMove;
uniform vec3 uOk;
uniform vec3 uAlert;
uniform vec3 uSize;
uniform float uTime;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFly;
varying float vAlert;
varying float vOk;
varying float vOld;
varying float vLed;
varying float vFront;
varying float vSeed;
varying float vEnergy;
void main() {
  float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float w = fwidth(dEdge);
  float edge = 1.0 - smoothstep(0.03, 0.03 + w * 1.5, dEdge);

  // 板の面は、ほんのり企業の色（DPなら空色）を含んだ白
  vec3 face = vShade * mix(vec3(1.0), uOk, 0.07);
  face = mix(face, vec3(0.9, 0.915, 0.94), vOld * 0.55);
  face = mix(face, mix(vec3(1.0), uMove, 0.32), clamp(vFly, 0.0, 1.0));
  face = mix(face, mix(vec3(1.0), uAlert, 0.6), clamp(vAlert, 0.0, 1.0));
  face = mix(face, mix(vec3(1.0), uOk, 0.5), vOk);

  vec3 line = mix(uInk, mix(uInk, vec3(0.55), 0.5), vOld * 0.6);
  line = mix(line, uMove, clamp(vFly + vEnergy * 0.5, 0.0, 1.0));
  line = mix(line, uAlert, clamp(vAlert * 1.4, 0.0, 1.0));
  line = mix(line, uOk, vOk);
  line = mix(line, vec3(0.78), vFog);
  vec3 col = mix(face, line, edge);

  // 前面の小さなランプ：監視中は緑で瞬き、異常のときは赤
  if (vFront > 0.5) {
    vec2 q = (vUv - vec2(0.1, 0.5)) * uSize.xy;
    float led = 1.0 - smoothstep(0.022, 0.032, length(q));
    float blink = 0.5 + 0.5 * step(0.3, fract(uTime * 0.7 + vSeed * 7.3));
    vec3 ledCol = mix(vec3(0.72, 0.74, 0.8), uOk, vLed);
    ledCol = mix(ledCol, uAlert, step(0.2, vAlert));
    col = mix(col, ledCol, led * mix(0.7, blink, max(vLed, step(0.2, vAlert))));
    // ブレードの通気スリット
    float slit = step(0.62, vUv.x) * step(vUv.x, 0.9) * (1.0 - smoothstep(0.0, w * 2.0 + 0.004, abs(fract(vUv.x * 18.0) - 0.5) - 0.32)) * step(0.3, vUv.y) * step(vUv.y, 0.7);
    col = mix(col, line, slit * 0.35);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const PLANE_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** 床：設計図の点の方眼 */
const FLOOR_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uOpacity;
varying vec2 vP;
void main() {
  vec2 g = fract(vP) - 0.5;
  float fw = fwidth(vP.x);
  float dotv = 1.0 - smoothstep(0.035, 0.035 + fw * 1.5, length(g));
  vec2 g4 = abs(fract(vP / 4.0) - 0.5);
  float major = 1.0 - smoothstep(0.5 - fw * 0.25, 0.5, max(g4.x, g4.y));
  float fade = 1.0 - smoothstep(5.0, 13.0, length(vP));
  float dense = 1.0 - smoothstep(0.06, 0.22, fw);
  float a = (dotv * 0.4 + major * 0.1) * fade * dense * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uInk, a);
}
`;

/** 新しいサーバーの足もとで回るレーダー（24時間365日の見張り） */
const RADAR_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
uniform float uTime;
uniform float uR;
varying vec2 vP;
void main() {
  float r = length(vP) / uR;
  if (r > 1.0) discard;
  float a = atan(vP.y, vP.x) / 6.28318 + 0.5;
  float sweep = fract(a - uTime * 0.2);
  float wedge = smoothstep(0.8, 1.0, sweep) * 0.42 * (1.0 - r * 0.5);
  float fw = fwidth(r);
  float ring = (1.0 - smoothstep(0.0, fw * 1.5, abs(r - 0.985))) * 0.7
    + (1.0 - smoothstep(0.0, fw * 1.5, abs(r - 0.66))) * 0.35
    + (1.0 - smoothstep(0.0, fw * 1.5, abs(r - 0.33))) * 0.25;
  float alpha = (wedge + ring) * uOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uCol, alpha);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

/** 監視の線（心拍）。帯の両端は薄く消し、走査の先頭だけ明るくする */
const PULSE_VERT = /* glsl */ `
attribute float aU;
varying float vU;
void main() {
  vU = aU;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const PULSE_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
uniform float uHead;
varying float vU;
void main() {
  float a = smoothstep(0.0, 0.1, vU) * smoothstep(1.0, 0.9, vU);
  float d = uHead - vU;
  // 走査の先頭のすぐ後ろは明るく、離れるほど少し薄く（モニターの残像）
  float trail = d >= 0.0 ? mix(1.0, 0.45, clamp(d * 1.6, 0.0, 1.0)) : mix(0.45, 0.3, clamp(-d * 2.0, 0.0, 1.0));
  float alpha = a * trail * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uCol, alpha);
}
`;

/** 心電図の1拍（0〜1）。P波・QRS・T波をガウスの山で足す */
function beat(q: number): number {
  const g = (c: number, w: number) => Math.exp(-((q - c) * (q - c)) / (2 * w * w));
  return 0.12 * g(0.16, 0.035) - 0.16 * g(0.42, 0.012) + 1.0 * g(0.455, 0.014) - 0.32 * g(0.49, 0.013) + 0.24 * g(0.72, 0.05);
}

/** データの粒：古い→新しい（移す）／新しい→保管庫（控え）／保管庫→新しい（戻す） */
const DOT_VERT = /* glsl */ `
attribute vec4 aSeed; // x: ずらし, y/z: 流れの幅, w: 経路 0/1/2
uniform float uTime;
uniform float uPx;
uniform vec3 uOld;
uniform vec3 uNew;
uniform vec3 uVault;
uniform vec3 uAmt;
varying float vA;
varying float vRoute;
vec3 bez(vec3 a, vec3 c, vec3 b, float t) {
  float u = 1.0 - t;
  return u * u * a + 2.0 * u * t * c + t * t * b;
}
void main() {
  float route = aSeed.w;
  vec3 a = route < 0.5 ? uOld : (route < 1.5 ? uNew : uVault);
  vec3 b = route < 0.5 ? uNew : (route < 1.5 ? uVault : uNew);
  float speed = route < 0.5 ? 0.24 : (route < 1.5 ? 0.17 : 0.3);
  float k = fract(uTime * speed + aSeed.x);
  vec3 lane = vec3((aSeed.y - 0.5) * 1.4, (aSeed.z - 0.5) * 0.9, (aSeed.y + aSeed.z - 1.0) * 1.2);
  vec3 c = (a + b) * 0.5 + vec3(0.0, 3.4, 0.0) + lane * 1.6;
  vec3 p = bez(a + lane * 0.5, c, b + lane * 0.5, k);
  float amt = route < 0.5 ? uAmt.x : (route < 1.5 ? uAmt.y : uAmt.z);
  vA = sin(3.14159 * k) * amt;
  vRoute = route;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (0.55 + aSeed.y * 0.7) * (14.0 / -mv.z);
}
`;

const DOT_FRAG = /* glsl */ `
uniform vec3 uMove;
uniform vec3 uBack;
uniform vec3 uOk;
varying float vA;
varying float vRoute;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5);
  float d = max(q.x, q.y);
  float a = (1.0 - smoothstep(0.32, 0.5, d)) * vA;
  if (a < 0.01) discard;
  vec3 col = vRoute < 0.5 ? uMove : (vRoute < 1.5 ? uBack : uOk);
  gl_FragColor = vec4(col, a);
}
`;

export class VaultScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private world = new Group();
  private tileU: Record<string, { value: unknown }>;
  private floorU: Record<string, { value: unknown }>;
  private radarU: Record<string, { value: unknown }>;
  private dotU: Record<string, { value: unknown }>;
  private rings: { mesh: Mesh; u: Record<string, { value: unknown }>; offset: number }[] = [];
  private oldFrame: LineBasicMaterial;
  private newFrame: LineBasicMaterial;
  private vaultFrame: LineBasicMaterial;
  private dome: LineSegments;
  private bucket: LineSegments;
  /** 道とトラック（荷台に DP の箱） */
  private road: { a: Vector3; c: Vector3; b: Vector3 } = { a: new Vector3(), c: new Vector3(), b: new Vector3() };
  private park = new Vector3();
  private truck = new Group();
  private cargo = new Group();
  private wheels: Mesh[] = [];
  private roadMat: LineBasicMaterial;
  private truckMats: { m: MeshBasicMaterial | LineBasicMaterial; o: number }[] = [];
  private hazard: MeshBasicMaterial;
  private truckYaw = 0;
  /** 監視の線 */
  private pulse: { geo: BufferGeometry; pos: Float32Array; n: number; u: Record<string, { value: unknown }>; frame: LineBasicMaterial; origin: Vector3; len: number };
  /** ロゴの地球（経線と緯線） */
  private globe: LineSegments;
  private newBase = new Vector3();
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private kick = 0;
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private baseScale = 0.42;
  private offset = new Vector3();
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
    this.camera.position.set(0, 0.6, 16);

    const ink = new Color(o.ink);
    const move = new Color(o.brand);
    const okC = new Color(o.red);
    const css = getComputedStyle(document.documentElement);
    const alertC = new Color(css.getPropertyValue('--scene-alert').trim() || '#E5484D');
    // 控え（保管庫へ流れる粒）は、守る・戻すと同じ色
    const backC = okC.clone();
    const ambient = o.mode === 'aurora';

    // ── 配置：古いサーバー（左奥）、新しいサーバー（右手前）、別の場所の保管庫（さらに右奥・上） ──
    const OLD = new Vector3(-5.2, 0, -1.6);
    const NEW = new Vector3(1.6, 0, 1.0);
    const VAULT = new Vector3(6.6, 4.4, -3.4);
    const COLS = 4;
    const ROWS = 16;
    const LAYERS = 2;
    const DX = 0.76;
    const DY = 0.33;
    const DZ = 0.86;
    const n = COLS * ROWS * LAYERS;
    const aOld = new Float32Array(n * 3);
    const aNew = new Float32Array(n * 3);
    const aVault = new Float32Array(n * 3);
    const aScatter = new Float32Array(n * 3);
    const aSeed = new Float32Array(n * 4);
    let i = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        for (let layer = 0; layer < LAYERS; layer++) {
          const sx = (col - (COLS - 1) / 2) * DX;
          const sy = 0.25 + row * DY;
          const sz = (layer - (LAYERS - 1) / 2) * DZ;
          // 古い棚の上から順に降ろし、新しい棚には下から積む（引越しの荷物と同じ順番）
          const ny = 0.25 + (ROWS - 1 - row) * DY;
          aOld.set([OLD.x + sx, OLD.y + sy, OLD.z + sz], i * 3);
          aNew.set([NEW.x + sx, NEW.y + ny, NEW.z + sz], i * 3);
          aVault.set([VAULT.x + sx * 0.3, VAULT.y + (ny - (ROWS * DY) / 2) * 0.3, VAULT.z + sz * 0.3], i * 3);
          aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
          // 上の段から順に移る。壊れるのは、新しい棚の中ほどの一角（ひとまとまりで崩れる方が「サイトの一部が壊れた」と読める）
          const newRow = ROWS - 1 - row;
          const hit = newRow >= 6 && newRow <= 12 && col <= 2 ? 1 : 0;
          aSeed.set([0.65 * (1 - row / (ROWS - 1)) + 0.35 * Math.random(), Math.random(), hit, Math.random()], i * 4);
          i++;
        }
      }
    }
    const box = new BoxGeometry(1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = box.index;
    geo.setAttribute('position', box.getAttribute('position'));
    geo.setAttribute('normal', box.getAttribute('normal'));
    geo.setAttribute('uv', box.getAttribute('uv'));
    geo.setAttribute('aOld', new InstancedBufferAttribute(aOld, 3));
    geo.setAttribute('aNew', new InstancedBufferAttribute(aNew, 3));
    geo.setAttribute('aVault', new InstancedBufferAttribute(aVault, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(aSeed, 4));
    geo.instanceCount = ambient ? Math.round(n * 0.4) : n;

    this.tileU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uGuard: { value: 0 },
      uRestore: { value: 0 },
      uCycle: { value: 0 },
      uAmbient: { value: ambient ? 1 : 0 },
      uScatter: { value: new Vector2(8, 5) },
      uRig: { value: new Matrix4() },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uRipple: { value: new Vector3(0, 0, -100) },
      uAspect: { value: 1 },
      uSize: { value: TILE.clone() },
      uInk: { value: ink },
      uMove: { value: move },
      uOk: { value: okC },
      uAlert: { value: alertC },
    };
    const tiles = new Mesh(
      geo,
      new ShaderMaterial({ uniforms: this.tileU, vertexShader: TILE_VERT, fragmentShader: TILE_FRAG, depthTest: true, depthWrite: true }),
    );
    tiles.frustumCulled = false;
    this.scene.add(tiles);

    // ── サーバーの枠・保管庫・床・レーダー・鼓動の輪・データの粒（すべて world の子） ──
    const W = COLS * DX + 0.5;
    const H = ROWS * DY + 0.5;
    const D = LAYERS * DZ + 0.3;
    const rack = new EdgesGeometry(new BoxGeometry(W, H, D));
    this.oldFrame = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0.5 });
    this.newFrame = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0.75 });
    const oldRack = new LineSegments(rack, this.oldFrame);
    oldRack.position.set(OLD.x, H / 2, OLD.z);
    const newRack = new LineSegments(rack, this.newFrame);
    newRack.position.set(NEW.x, H / 2, NEW.z);
    this.world.add(oldRack, newRack);
    // 棚の段（4段ごとに横線）
    const shelfPts: number[] = [];
    for (let s = 4; s < ROWS; s += 4) {
      const y = s * DY + 0.08;
      shelfPts.push(-W / 2, y, D / 2, W / 2, y, D / 2, -W / 2, y, -D / 2, W / 2, y, -D / 2);
    }
    const shelfGeo = new BufferGeometry();
    shelfGeo.setAttribute('position', new BufferAttribute(new Float32Array(shelfPts), 3));
    const oldShelf = new LineSegments(shelfGeo, this.oldFrame);
    oldShelf.position.set(OLD.x, 0, OLD.z);
    const newShelf = new LineSegments(shelfGeo, this.newFrame);
    newShelf.position.set(NEW.x, 0, NEW.z);
    this.world.add(oldShelf, newShelf);

    // 保管庫：S3 のバケツ。控えが入っている（板の小さな写し）
    this.vaultFrame = new LineBasicMaterial({ color: backC, transparent: true, opacity: 0 });
    this.bucket = new LineSegments(new EdgesGeometry(new CylinderGeometry(1.3, 0.95, 1.9, 20, 1, true)), this.vaultFrame);
    this.bucket.position.copy(VAULT);
    this.world.add(this.bucket);

    this.floorU = { uInk: { value: ink }, uOpacity: { value: 1 } };
    const floor = new Mesh(
      new PlaneGeometry(30, 30, 1, 1),
      new ShaderMaterial({ uniforms: this.floorU, vertexShader: PLANE_VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, 0);
    this.world.add(floor);

    this.newBase.set(NEW.x, 0.01, NEW.z);
    this.radarU = { uCol: { value: okC }, uOpacity: { value: 0 }, uTime: { value: 0 }, uR: { value: 3.6 } };
    const radar = new Mesh(
      new PlaneGeometry(7.4, 7.4, 1, 1),
      new ShaderMaterial({ uniforms: this.radarU, vertexShader: PLANE_VERT, fragmentShader: RADAR_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    radar.rotation.x = -Math.PI / 2;
    radar.position.copy(this.newBase);
    this.world.add(radar);

    for (let r = 0; r < 3; r++) {
      const u = { uCol: { value: okC }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.96, 1, 72),
        new ShaderMaterial({ uniforms: u, vertexShader: PLANE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      this.world.add(mesh);
      this.rings.push({ mesh, u, offset: r / 3 });
    }

    // 見張りのドーム（緯線・経線の半球）
    this.dome = new LineSegments(
      new EdgesGeometry(new SphereGeometry(4.4, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2)),
      new LineBasicMaterial({ color: move, transparent: true, opacity: 0 }),
    );
    this.dome.position.copy(this.newBase);
    this.world.add(this.dome);

    // ── 道：古いサーバーの前から、新しいサーバーの前へ。点線（線分を1つおきに）で描く ──
    this.road.a.set(OLD.x + 0.4, 0.01, OLD.z + D / 2 + 1.25);
    this.road.b.set(NEW.x - 0.2, 0.01, NEW.z + D / 2 + 1.35);
    this.road.c.set((OLD.x + NEW.x) / 2 - 0.4, 0.01, Math.max(this.road.a.z, this.road.b.z) + 2.4);
    this.park.set(NEW.x + W / 2 + 1.5, 0, NEW.z + D / 2 + 0.6);
    const roadPts: number[] = [];
    const RS = 46;
    const at = (k: number) => this.roadAt(k);
    for (let r = 0; r < RS; r += 2) {
      const p0 = at(r / RS);
      const p1 = at((r + 1) / RS);
      roadPts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    for (const side of [-0.62, 0.62]) {
      for (let r = 0; r < RS; r++) {
        const p0 = at(r / RS);
        const p1 = at((r + 1) / RS);
        const n0 = this.roadNormal(r / RS).multiplyScalar(side);
        const n1 = this.roadNormal((r + 1) / RS).multiplyScalar(side);
        roadPts.push(p0.x + n0.x, 0.01, p0.z + n0.z, p1.x + n1.x, 0.01, p1.z + n1.z);
      }
    }
    const roadGeo = new BufferGeometry();
    roadGeo.setAttribute('position', new BufferAttribute(new Float32Array(roadPts), 3));
    this.roadMat = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0.4 });
    this.world.add(new LineSegments(roadGeo, this.roadMat));

    // ── トラック：サイト引越し屋さんのロゴの、オレンジの荷台つきトラック。面は塗り、辺は紺の線 ──
    const orange = new Color(getComputedStyle(document.documentElement).getPropertyValue('--dp-orange').trim() || '#FF8317');
    const part = (w: number, h: number, d: number, fill: Color | MeshBasicMaterial[], x: number, y: number, z: number, parent: Group) => {
      const g = new BoxGeometry(w, h, d);
      const mats = Array.isArray(fill) ? fill : [new MeshBasicMaterial({ color: fill, transparent: true })];
      const mesh = new Mesh(g, Array.isArray(fill) ? mats : mats[0]);
      mesh.position.set(x, y, z);
      const edge = new LineSegments(new EdgesGeometry(g), new LineBasicMaterial({ color: ink, transparent: true }));
      edge.position.copy(mesh.position);
      parent.add(mesh, edge);
      mats.forEach((m) => this.truckMats.push({ m, o: 1 }));
      this.truckMats.push({ m: edge.material as LineBasicMaterial, o: 0.9 });
      return mesh;
    };
    part(1.9, 0.14, 1.0, orange, -0.38, 0.38, 0, this.truck); // 荷台
    part(0.78, 0.78, 1.0, orange, 0.97, 0.7, 0, this.truck); // 運転席
    part(0.06, 0.34, 0.86, new Color('#ffffff'), 1.37, 0.84, 0, this.truck); // 窓
    part(0.08, 0.36, 1.0, orange, -1.31, 0.6, 0, this.truck); // あおり（後ろ）
    const wheelGeo = new CylinderGeometry(0.21, 0.21, 0.14, 16);
    wheelGeo.rotateX(Math.PI / 2);
    for (const [x, z] of [
      [-0.85, 0.5],
      [-0.85, -0.5],
      [0.95, 0.5],
      [0.95, -0.5],
    ]) {
      const wm = new MeshBasicMaterial({ color: ink, transparent: true });
      const w = new Mesh(wheelGeo, wm);
      w.position.set(x, 0.21, z);
      this.truckMats.push({ m: wm, o: 1 });
      this.wheels.push(w);
      this.truck.add(w);
    }
    // ハザード（停まったら点滅）
    this.hazard = new MeshBasicMaterial({ color: orange, transparent: true, opacity: 0 });
    const hz = new Mesh(new PlaneGeometry(0.12, 0.08), this.hazard);
    hz.position.set(-1.36, 0.5, 0.36);
    hz.rotation.y = -Math.PI / 2;
    const hz2 = hz.clone();
    hz2.position.z = -0.36;
    this.truck.add(hz, hz2);
    // 荷物：DPのロゴの箱（上面が淡い空色、側面がDPの青と空色）
    const sky = new Color('#00B1E9');
    const top = new Color('#8ADCF7');
    const dp = new Color('#0086C7');
    const boxMats = [sky, sky, top, top, dp, dp].map((c) => new MeshBasicMaterial({ color: c, transparent: true }));
    part(0.74, 0.74, 0.74, boxMats, 0, 0, 0, this.cargo);
    // 箱の上面に、ロゴの矢印（上向き）を線で
    const arrow = new BufferGeometry();
    arrow.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0.375, 0.2, 0, 0.375, -0.22, 0, 0.375, -0.22, -0.13, 0.375, -0.06, 0, 0.375, -0.22, 0.13, 0.375, -0.06]), 3),
    );
    const arrowMat = new LineBasicMaterial({ color: '#ffffff', transparent: true });
    this.truckMats.push({ m: arrowMat, o: 1 });
    const arrowLine = new LineSegments(arrow, arrowMat);
    arrowLine.rotation.y = Math.PI / 2;
    this.cargo.add(arrowLine);
    this.cargo.position.set(-0.4, 0.82, 0);
    this.truck.add(this.cargo);
    this.truck.scale.setScalar(0.92);
    this.world.add(this.truck);

    // ── 監視の線：新しいサーバーの上に浮かぶモニター。心拍のように打つ ──
    const PN = 150;
    const pPos = new Float32Array(PN * 2 * 3);
    const pU = new Float32Array(PN * 2);
    const pIdx: number[] = [];
    for (let k = 0; k < PN; k++) {
      pU[k * 2] = pU[k * 2 + 1] = k / (PN - 1);
      if (k < PN - 1) pIdx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    }
    const pGeo = new BufferGeometry();
    pGeo.setAttribute('position', new BufferAttribute(pPos, 3));
    pGeo.setAttribute('aU', new BufferAttribute(pU, 1));
    pGeo.setIndex(pIdx);
    const pulseU = { uCol: { value: okC.clone() }, uOpacity: { value: 0 }, uHead: { value: 0 } };
    const pulseMesh = new Mesh(
      pGeo,
      new ShaderMaterial({ uniforms: pulseU, vertexShader: PULSE_VERT, fragmentShader: PULSE_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    pulseMesh.frustumCulled = false;
    // 古いサーバーの上から、新しいサーバーの真上まで（移し終えたあとは、あいだの空がちょうど空く）
    const len = NEW.x - OLD.x + 0.4;
    const origin = new Vector3(OLD.x - 0.4, H + 1.05, (OLD.z + NEW.z) / 2 + D / 2);
    // モニターの枠（四隅のかぎ）
    const fr: number[] = [];
    const fx0 = origin.x - 0.2;
    const fx1 = origin.x + len + 0.2;
    const fy0 = origin.y - 0.55;
    const fy1 = origin.y + 1.25;
    const c = 0.35;
    for (const [x, y, dx, dy] of [
      [fx0, fy0, 1, 1],
      [fx1, fy0, -1, 1],
      [fx0, fy1, 1, -1],
      [fx1, fy1, -1, -1],
    ]) fr.push(x, y, origin.z, x + c * dx, y, origin.z, x, y, origin.z, x, y + c * dy, origin.z);
    const frGeo = new BufferGeometry();
    frGeo.setAttribute('position', new BufferAttribute(new Float32Array(fr), 3));
    const frame = new LineBasicMaterial({ color: okC, transparent: true, opacity: 0 });
    this.world.add(pulseMesh, new LineSegments(frGeo, frame));
    this.pulse = { geo: pGeo, pos: pPos, n: PN, u: pulseU, frame, origin, len };

    // ── ロゴの地球：奥で、経線と緯線がゆっくり回る ──
    const gl: number[] = [];
    const GR = 5.6;
    const SEG = 64;
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = GR * Math.sin((lat * Math.PI) / 180);
      const r = GR * Math.cos((lat * Math.PI) / 180);
      for (let k = 0; k < SEG; k++) {
        const a0 = (k / SEG) * Math.PI * 2;
        const a1 = ((k + 1) / SEG) * Math.PI * 2;
        gl.push(r * Math.cos(a0), y, r * Math.sin(a0), r * Math.cos(a1), y, r * Math.sin(a1));
      }
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const a = (lon * Math.PI) / 180;
      for (let k = 0; k < SEG; k++) {
        const b0 = (k / SEG) * Math.PI * 2;
        const b1 = ((k + 1) / SEG) * Math.PI * 2;
        gl.push(
          GR * Math.cos(b0) * Math.cos(a), GR * Math.sin(b0), GR * Math.cos(b0) * Math.sin(a),
          GR * Math.cos(b1) * Math.cos(a), GR * Math.sin(b1), GR * Math.cos(b1) * Math.sin(a),
        );
      }
    }
    const globeGeo = new BufferGeometry();
    globeGeo.setAttribute('position', new BufferAttribute(new Float32Array(gl), 3));
    this.globe = new LineSegments(globeGeo, new LineBasicMaterial({ color: orange, transparent: true, opacity: 0, depthWrite: false }));
    this.globe.position.set(-1.4, 4.6, -10.5);
    this.globe.rotation.z = 0.32;
    this.world.add(this.globe);

    // データの粒
    const DOTS = 3 * 70;
    const dSeed = new Float32Array(DOTS * 4);
    for (let d = 0; d < DOTS; d++) dSeed.set([Math.random(), Math.random(), Math.random(), Math.floor(d / 70)], d * 4);
    const dGeo = new BufferGeometry();
    dGeo.setAttribute('position', new BufferAttribute(new Float32Array(DOTS * 3), 3));
    dGeo.setAttribute('aSeed', new BufferAttribute(dSeed, 4));
    const mid = H * 0.55;
    this.dotU = {
      uTime: { value: 0 },
      uPx: { value: 6 * Math.min(window.devicePixelRatio || 1, 2) },
      uOld: { value: new Vector3(OLD.x, mid, OLD.z) },
      uNew: { value: new Vector3(NEW.x, mid, NEW.z) },
      uVault: { value: VAULT.clone() },
      uAmt: { value: new Vector3() },
      uMove: { value: move },
      uBack: { value: backC },
      uOk: { value: okC },
    };
    const dots = new Points(
      dGeo,
      new ShaderMaterial({ uniforms: this.dotU, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false }),
    );
    dots.frustumCulled = false;
    this.world.add(dots);

    // 中身の中心が原点に来るようにずらす
    this.world.position.set(-0.6, -2.7, 0.3);
    this.rig.add(this.world);
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
      this.render(CYCLE * 0.9);
    }
    o.host.classList.add('is-ready');
  }

  /** 道の上の位置（0＝古いサーバーの前、1＝新しいサーバーの前） */
  private roadAt(k: number, out = new Vector3()): Vector3 {
    const { a, c, b } = this.road;
    const u = 1 - k;
    return out.set(u * u * a.x + 2 * u * k * c.x + k * k * b.x, 0.01, u * u * a.z + 2 * u * k * c.z + k * k * b.z);
  }

  /** 道の向き（xz 平面の単位ベクトル） */
  private roadDir(k: number): Vector3 {
    const { a, c, b } = this.road;
    const u = 1 - k;
    return new Vector3(2 * u * (c.x - a.x) + 2 * k * (b.x - c.x), 0, 2 * u * (c.z - a.z) + 2 * k * (b.z - c.z)).normalize();
  }

  private roadNormal(k: number): Vector3 {
    const d = this.roadDir(k);
    return new Vector3(-d.z, 0, d.x);
  }

  /**
   * トラック：移している間は往復する（行きは箱を積み、着いたら降ろし、帰りは空）。移し終えたら新しいサーバーの横に停まり、ハザードを点ける。
   * 壊れて戻る場面では、警告のあいだハザードが速く点滅する
   */
  private driveTruck(t: number, ph: number, intro: number, alert: number) {
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const TRIP = 4.6;
    const u = (((t / TRIP) % 1) + 1) % 1;
    let s: number;
    let back: boolean;
    let load: number;
    if (u < 0.44) {
      s = sm(0, 0.44, u);
      back = false;
      load = 1;
    } else if (u < 0.56) {
      s = 1;
      back = sm(0.47, 0.56, u) > 0.5;
      load = 1 - sm(0.46, 0.52, u);
    } else if (u < 0.94) {
      s = 1 - sm(0.56, 0.94, u);
      back = true;
      load = 0;
    } else {
      s = 0;
      back = sm(0.95, 1, u) < 0.5;
      load = sm(0.96, 1, u);
    }
    const park = sm(0.86, 1.0, ph);
    const pos = this.roadAt(s);
    const dir = this.roadDir(s);
    let yaw = Math.atan2(-dir.z, dir.x) + (back ? Math.PI : 0);
    // 停まるときは、新しいサーバーの横で道の向きにそろえる
    const pDir = this.roadDir(1);
    const parkYaw = Math.atan2(-pDir.z, pDir.x);
    pos.lerp(this.park, park);
    yaw = yaw + (parkYaw - yaw) * park;
    // 向きは急に変えず、少しずつ回す（切り返し）
    let dy = yaw - this.truckYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.truckYaw += dy * (this.o.animate ? 0.14 : 1);
    this.truck.position.copy(pos);
    const moving = (u < 0.44 || (u > 0.56 && u < 0.94)) && park < 0.5 ? 1 : 0;
    this.truck.position.y = Math.abs(Math.sin(t * 22)) * 0.025 * moving;
    this.truck.rotation.set(0, this.truckYaw, 0);
    for (const w of this.wheels) w.rotation.z = -t * 9 * moving;
    // 荷物：着いたら持ち上がって消え、出発前にまた現れる（移し終えたら積まない）
    const carry = load * (1 - park);
    this.cargo.scale.setScalar(Math.max(0.001, carry));
    this.cargo.position.y = 0.82 + (1 - carry) * 0.5;
    const blink = alert > 0.05 ? (Math.sin(t * 22) > 0 ? 1 : 0.15) : Math.sin(t * 5.5) > 0 ? 1 : 0.1;
    this.hazard.opacity = park * blink;
    for (const tm of this.truckMats) tm.m.opacity = tm.o * intro;
  }

  /** 監視の線を描き直す。alert で乱れ、down で平らになり、戻ると打ち直す */
  private drawPulse(t: number, guard: number, alert: number, down: number, ok: number, ink: Color) {
    const P = this.pulse;
    const HEAD_SPEED = 0.28;
    const head = (t * HEAD_SPEED) % 1;
    for (let k = 0; k < P.n; k++) {
      const x = k / (P.n - 1);
      // 2拍ぶんを横に並べ、左から右へ流す
      const q = (((x * 2.2 - t * 0.62) % 1) + 1) % 1;
      let y = beat(q) * (1 - down);
      y += alert * (Math.sin(x * 90 + t * 37) * 0.22 + Math.sin(x * 41 - t * 23) * 0.18) * (1 - down);
      const px = P.origin.x + x * P.len;
      const py = P.origin.y + y * 0.9;
      const w = 0.045;
      const o = k * 6;
      P.pos[o] = px;
      P.pos[o + 1] = py - w;
      P.pos[o + 2] = P.origin.z;
      P.pos[o + 3] = px;
      P.pos[o + 4] = py + w;
      P.pos[o + 5] = P.origin.z;
    }
    P.geo.attributes.position.needsUpdate = true;
    const alertC = this.tileU.uAlert.value as Color;
    const okC = this.tileU.uOk.value as Color;
    const col = P.u.uCol.value as Color;
    col.copy(okC).lerp(alertC, Math.min(1, alert + down)).lerp(okC, ok * 0.3);
    P.u.uOpacity.value = guard;
    P.u.uHead.value = head;
    P.frame.color.copy(col).lerp(ink, 0.35);
    P.frame.opacity = guard * 0.7;
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.mouseTarget.set(x, y);
    this.hoverTarget = Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05 ? 1 : 0;
  };

  /** クリック：波を立てる。復旧の場面では、その場で「壊れて戻る」を起こす */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const t = this.tileU.uTime.value as number;
    (this.tileU.uRipple.value as Vector3).set(x, y, t);
    if (this.phase > 1.5) this.kick = t - CYCLE * 0.1;
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    (this.tileU.uScatter.value as Vector2).set(halfW * 1.02, halfH * 1.02);
    this.tileU.uAspect.value = this.camera.aspect;
    this.baseScale = Math.min(0.5, (halfW * 0.92) / 8.6, (halfH * 1.05) / 6.2);
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    if (wide) {
      this.offset.set(halfW * 0.36, -halfH * 0.12, 0);
      this.baseScale = Math.min(0.46, (halfW * 0.62) / 8.6, (halfH * 1.05) / 6.2);
    }
    // スマホ：文字は画面の下半分に来るので、サーバーは上の空いた場所に置く
    else if (this.o.layout === 'right') this.offset.set(0, halfH * 0.56, 0);
    else this.offset.set(0, -halfH * 0.18, 0);
    if (!this.o.animate) this.render(CYCLE * 0.9);
  }

  private render(t: number) {
    const ph = this.phase;
    this.rig.position.copy(this.offset);
    this.rig.scale.setScalar(this.baseScale);
    // 斜め上から見下ろし、ゆっくり左右に振れる。マウスで少し傾く
    this.rig.rotation.set(0.42 - this.mouse.y * 0.1, -0.32 + Math.sin(t * 0.13) * 0.14 + this.mouse.x * 0.3, 0, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.tileU.uRig.value as Matrix4).copy(this.world.matrixWorld);

    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const guard = sm(0.82, 1.0, ph);
    const restore = Math.min(1, Math.max(0, ph - 1));
    const cycle = (((t - this.kick) / CYCLE) % 1 + 1) % 1;
    this.tileU.uTime.value = t;
    this.tileU.uPhase.value = this.o.mode === 'aurora' ? 0 : Math.min(1, ph);
    this.tileU.uGuard.value = guard;
    this.tileU.uRestore.value = restore;
    this.tileU.uCycle.value = cycle;

    // 枠：移し終えると、古いサーバーは薄くなる
    this.oldFrame.opacity = 0.5 - 0.34 * sm(0.7, 1.0, ph);
    this.newFrame.opacity = 0.42 + 0.4 * sm(0.3, 1.0, ph);
    this.vaultFrame.opacity = 0.85 * sm(0.78, 1.0, ph);
    this.bucket.rotation.y = t * 0.25;
    this.dome.rotation.y = -t * 0.06;
    (this.dome.material as LineBasicMaterial).opacity = 0.16 * guard;

    const intro = this.tileU.uIntro.value as number;
    // 壊れて戻る1周の中の、警告・停止・復旧（シェーダーと同じ区切り）
    const alertW = restore * sm(0.12, 0.15, cycle) * (1 - sm(0.27, 0.3, cycle));
    const downW = restore * (cycle >= 0.27 && cycle < 0.6 ? sm(0.27, 0.32, cycle) * (1 - sm(0.5, 0.6, cycle)) : 0);
    const okW = restore * (cycle >= 0.44 ? 1 - sm(0.82, 1.0, cycle) : 0);
    this.driveTruck(t, this.o.mode === 'aurora' ? 0 : ph, intro, alertW);
    this.roadMat.opacity = 0.42 * intro * (1 - 0.5 * sm(0.9, 1.0, ph));
    this.drawPulse(t, guard * intro, alertW, downW, okW, this.tileU.uInk.value as Color);
    this.globe.rotation.y = t * 0.05;
    (this.globe.material as LineBasicMaterial).opacity = 0.16 * intro;

    this.radarU.uOpacity.value = guard * 0.9;
    this.radarU.uTime.value = t;
    for (const r of this.rings) {
      const k = (t * 0.32 + r.offset) % 1;
      r.mesh.position.copy(this.newBase);
      r.mesh.scale.setScalar(0.8 + k * 4.2);
      r.u.uOpacity.value = guard * (1 - k) * 0.55;
    }

    // 粒：移す（青）→ 控え（青緑）→ 戻す（緑、復旧の場面だけ）
    const restoring = sm(0.42, 0.48, cycle) * (1 - sm(0.78, 0.86, cycle));
    (this.dotU.uAmt.value as Vector3).set(
      sm(0.08, 0.3, ph) * (1 - sm(0.9, 1.05, ph)),
      sm(0.88, 1.05, ph) * (1 - restore * 0.55),
      restore * restoring,
    );
    this.dotU.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }

  /** 静止モード：入場の演出を終えた状態で、いまの場面を1回だけ描く */
  private still() {
    (this.tileU.uIntro as { value: number }).value = 1;
    this.phase = this.goal;
    // 「壊れて戻る」の途中ではなく、戻り終えた瞬間を描く
    this.kick = 0;
    this.render(CYCLE * 0.9);
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
    const intro = this.tileU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.014);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    (this.tileU.uMouse.value as Vector2).copy(this.mouse);
    this.tileU.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
