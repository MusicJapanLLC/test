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

  vec3 face = vec3(vShade);
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
    const backC = move.clone().lerp(okC, 0.45);
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
