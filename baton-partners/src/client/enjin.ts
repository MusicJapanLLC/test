import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「円陣（縁陣）」のシーン（Presence など cheer の世界観用）。
 *
 *  phase 0〜1  六角形のタイル（一人ひとり）が宙を漂い、中心から順に亀甲の円盤へ収まる（出会う）
 *  phase 1     円盤がそろうと、離れたタイルどうしをオレンジの「縁の糸」が一組ずつ結ぶ。光が糸を渡る（応援する）
 *  phase 2     円盤が盛り上がって円陣を組み、星の光る甲羅になる。縁に沿ってウェーブが回り、足元に輪が広がる（陣を張る）
 *
 * 真ん中のタイルは金の星（センターピン）。タイルは1つのジオメトリを instancing で並べ、縁・星・裏の色はフラグメントで描く。
 * マウスを近づけるとタイルが裏返ってオレンジの面（人柄の面）を見せ、クリックすると中心から応援の波が広がる。
 * 甲羅は六角形の集まりだけで描く（会社のロゴのカメそのものは描かない）。
 */

const RINGS = 6;
/** 亀甲の間隔（六角形の外接円の半径） */
const S = 0.56;
const TILE = S * 0.9;
/** 円盤のときの縮尺（甲羅より小さくまとめ、文字の列にかからないように） */
const GRID_K = 0.64;
const THICK = 0.16;
/** 甲羅：半径・高さのつぶれ・中心の高さ */
const RD = 4.35;
const FY = 0.7;
const DY = -1.55;

const TILE_VERT = /* glsl */ `
attribute vec3 aGrid;
attribute vec3 aDome;
attribute vec3 aDomeN;
attribute vec3 aScatter;
attribute vec4 aInfo; // x: 種類(0=紺 1=白 2=橙 3=星), y: 乱数, z: 中心からの距離(0〜1), w: 乱数
attribute float aLink; // 縁の糸の端のタイル（糸の乱数）。ふつうのタイルは -1
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uAmbient;
uniform vec2 uScatter;
uniform vec2 uScatterC;
uniform mat4 uRig;
uniform vec2 uMouse;
uniform float uHover;
uniform float uAspect;
uniform float uCheer;
uniform float uSpinG;
uniform float uSpinD;
varying vec3 vN;
varying vec2 vLocal;
varying float vKind;
varying float vSeed;
varying float vFace;
varying float vLift;
varying float vGlow;
varying float vDome;
varying float vFog;

mat3 rotXYZ(vec3 a) {
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}
/* +Z を n に向ける回転 */
mat3 alignZ(vec3 n) {
  vec3 up = abs(n.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 x = normalize(cross(up, n));
  vec3 y = cross(n, x);
  return mat3(x, y, n);
}
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  float t = uTime;
  float d = aInfo.z;
  float e1 = smoothstep(0.0, 1.0, clamp((uPhase * 1.25 - d * 0.55 - 0.1) / 0.5, 0.0, 1.0));
  float e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.0 - d * 0.3) / 0.6, 0.0, 1.0));

  // 漂う：文字のない側に寄せて、ゆっくり回りながら
  vec3 sc = vec3(uScatterC + aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.7), aScatter.z * 4.0 - 1.0);
  sc += vec3(sin(t * 0.21 + aInfo.y * 40.0), cos(t * 0.17 + aInfo.w * 30.0), sin(t * 0.13 + aInfo.y * 17.0)) * 0.45;
  mat3 tumble = rotXYZ(vec3(t * (aInfo.y - 0.5) * 0.8 + aInfo.y * 6.28, t * (aInfo.w - 0.5) * 0.9 + aInfo.w * 6.28, aInfo.y * 3.0));

  // 応援の波：中心から外へ広がる輪（クリック）
  float ring = exp(-pow(d - (1.0 - uCheer) * 1.25, 2.0) * 26.0) * uCheer;

  // 亀甲の円盤：中心から外へ、呼吸するように波打つ
  vec3 grid = aGrid * GRID_KV;
  grid.xy = rot2(uSpinG) * grid.xy;
  grid.z += sin(t * 1.3 - length(aGrid.xy) * 1.1) * 0.07 + ring * 0.9;

  // 甲羅：縁に沿ってウェーブが回る
  vec3 dome = aDome;
  vec3 dn = aDomeN;
  dome.xz = rot2(uSpinD) * dome.xz;
  dn.xz = rot2(uSpinD) * dn.xz;
  float az = atan(dome.z, dome.x);
  float rim = smoothstep(0.45, 1.0, d);
  float wave = pow(max(0.0, sin(az - t * 2.1)), 10.0) * rim;
  dome += dn * (wave * 0.6 + ring * 0.7 + sin(t * 1.1 + d * 5.0) * 0.03);

  vec3 center = mix(grid, dome, e2);
  vec3 worldC = (uRig * vec4(center, 1.0)).xyz;
  vec3 pC = mix(sc, worldC, e1);
  vec4 clipC = projectionMatrix * modelViewMatrix * vec4(pC, 1.0);
  vec2 dm = clipC.xy / clipC.w - uMouse;
  dm.x *= uAspect;
  float near = smoothstep(0.3, 0.0, length(dm)) * uHover * (1.0 - uAmbient);

  // マウスの近くのタイルは、裏返ってオレンジの面を見せる
  mat3 flip = rotXYZ(vec3(0.0, 3.14159 * smoothstep(0.15, 0.85, near), 0.0));
  vec3 shape = position * vec3(TILE_S, TILE_S, THICK_S) * uIntro * mix(mix(1.0, GRID_KV, e1), 1.12, e2);
  mat3 gridR = rotXYZ(vec3(0.0, 0.0, uSpinG));
  mat3 domeR = alignZ(dn);
  vec3 placed = mix(gridR * (flip * shape), domeR * (flip * shape), e2);
  vec3 world = (uRig * vec4(center + placed, 1.0)).xyz;
  vec3 air = sc + tumble * shape;
  vec3 p = mix(air, world, e1);
  p = mix(p, air, uAmbient);

  vec3 nPlaced = mix(gridR * (flip * normal), domeR * (flip * normal), e2);
  vec3 nW = normalize(mat3(uRig) * nPlaced);
  vec3 n = normalize(mix(tumble * normal, nW, e1 * (1.0 - uAmbient)));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.z += near * 0.7;
  gl_Position = projectionMatrix * mv;

  vN = normalize(normalMatrix * n);
  vLocal = position.xy;
  vKind = aInfo.x;
  vSeed = aInfo.y;
  vFace = normal.z > 0.5 ? 1.0 : (normal.z < -0.5 ? -1.0 : 0.0);
  vLift = near;
  // 縁の糸の端のタイルは、糸を光が渡るたびに灯る
  float linkShow = aLink < 0.0 ? 0.0 : smoothstep(0.62, 0.98, uPhase) * (1.0 - 0.6 * e2);
  float linkPulse = aLink < 0.0 ? 0.0 : pow(0.5 + 0.5 * sin(t * (1.6 + aLink * 1.2) + aLink * 20.0), 3.0);
  vGlow = (wave * e2 + ring + linkShow * (0.35 + 0.65 * linkPulse)) * (1.0 - uAmbient);
  vDome = e2 * (1.0 - uAmbient);
  vFog = smoothstep(18.0, 34.0, -mv.z);
}
`
  .replace('TILE_S', TILE.toFixed(3))
  .replace('TILE_S', TILE.toFixed(3))
  .replace('THICK_S', THICK.toFixed(3))
  .replace(/GRID_KV/g, GRID_K.toFixed(3));

const TILE_FRAG = /* glsl */ `
uniform vec3 uNavy;
uniform vec3 uOrange;
uniform vec3 uGold;
uniform float uTime;
uniform float uAmbient;
varying vec3 vN;
varying vec2 vLocal;
varying float vKind;
varying float vSeed;
varying float vFace;
varying float vLift;
varying float vGlow;
varying float vDome;
varying float vFog;

/* 尖った頂点が上下の六角形。縁で 1 */
float hexD(vec2 p) { p = abs(p); return max(p.x, p.x * 0.5 + p.y * 0.8660254) / 0.8660254; }
/* 四つの角の星（✦）。中心で 0、外へ行くほど大きい */
float sparkle(vec2 p) { vec2 q = pow(abs(p), vec2(0.62)); return q.x + q.y; }

void main() {
  vec3 paper = vec3(1.0);
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.6));
  float diff = 0.62 + 0.38 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  float t = uTime + vSeed * 30.0;
  vec3 col;

  if (vFace > 0.5) {
    float d = hexD(vLocal);
    // 表：紺・白・オレンジ・星（金）。縁は細い線で、亀甲の目地になる
    vec3 face = vKind < 0.5 ? uNavy : vKind < 1.5 ? paper : vKind < 2.5 ? uOrange : uNavy;
    // 甲羅になると、星をまとった紺の甲羅へ。白は明るい紺に、オレンジは半分だけ残す
    vec3 lightNavy = mix(uNavy, vec3(0.16, 0.44, 0.75), 0.55 + 0.25 * vSeed);
    vec3 domeFace = vKind < 0.5 ? mix(uNavy, lightNavy, step(0.7, vSeed) * 0.6) : vKind < 1.5 ? lightNavy : vKind < 2.5 ? (vSeed < 0.5 ? uOrange : uNavy) : uNavy;
    face = mix(face, domeFace, vDome);
    // 灯ったタイル：円盤ではオレンジに、甲羅では明るい紺に（目地と星が金に光る）
    float g = clamp(vGlow, 0.0, 1.0);
    float gs = smoothstep(0.2, 0.7, g);
    face = mix(face, mix(uOrange, min(lightNavy * 1.3, vec3(1.0)), vDome), gs);
    col = face * mix(diff, 0.82 + 0.18 * diff, vDome);
    // 甲羅になると、ところどころのタイルに星が灯る
    float twinkle = smoothstep(0.82, 1.0, sin(t * 0.9) * 0.5 + 0.5) * vDome;
    float star = 1.0 - smoothstep(0.42, 0.5, sparkle(vLocal * 1.55));
    float showStar = vKind > 2.5 ? 1.0 : max(max(twinkle * step(0.25, vSeed), step(0.82, vSeed) * vDome), gs * vDome);
    col = mix(col, uGold * (0.85 + 0.15 * sin(t * 2.0)), star * showStar);
    // 目地：白いタイルは紺の線、ほかは白い線。甲羅では金に光る
    float seam = smoothstep(0.8, 0.9, d);
    vec3 seamCol = mix(vKind > 0.5 && vKind < 1.5 ? uNavy : paper, uGold, vDome);
    col = mix(col, seamCol, seam * mix(0.85, 1.0, vDome));
    col += uGold * seam * g * vDome * 0.5;
    col += spec * 0.25;
  } else if (vFace < -0.5) {
    // 裏：オレンジに白い星（人柄の面）
    float star = 1.0 - smoothstep(0.42, 0.5, sparkle(vLocal * 1.4));
    col = mix(uOrange * (0.8 + 0.2 * diff), paper, star);
  } else {
    // 側面：濃い紺
    col = uNavy * 0.62 * diff;
  }

  // ウェーブ・応援の波・マウスで浮いたタイルは、オレンジと金に光る
  col = mix(col, paper, clamp(vLift, 0.0, 1.0) * 0.12);
  col = mix(col, paper, vFog * 0.8);
  // 背景用（CTA帯など）は半透明で、ゆっくり漂うだけ
  gl_FragColor = vec4(col, uAmbient > 0.5 ? 0.3 : 1.0);
}
`;

/** 縁の糸：離れたタイルどうしを、弧を描いて結ぶ。光が糸を渡る */
const LINE_VERT = /* glsl */ `
attribute vec3 aGA;
attribute vec3 aGB;
attribute vec3 aUA;
attribute vec3 aUB;
attribute vec2 aT; // x: 糸の上の位置, y: 乱数
attribute vec2 aOff; // 画面上で1px ずらす量（同じ糸を4本重ねて太く見せる）
uniform vec2 uRes;
uniform float uTime;
uniform float uPhase;
uniform float uSpinG;
uniform float uSpinD;
varying float vA;
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
void main() {
  float t = aT.x;
  float k = aT.y;
  vec3 g = mix(aGA, aGB, t);
  g.z += sin(t * 3.14159) * (0.7 + k * 0.9);
  g.xy = rot2(uSpinG) * g.xy;
  vec3 u = normalize(mix(aUA, aUB, t));
  float lift = 1.0 + sin(t * 3.14159) * (0.16 + k * 0.12);
  vec3 dm = vec3(0.0, ${DY.toFixed(2)}, 0.0) + vec3(1.0, ${FY.toFixed(2)}, 1.0) * ${RD.toFixed(2)} * lift * u;
  dm.xz = rot2(uSpinD) * dm.xz;
  float e2 = smoothstep(1.0, 1.85, uPhase);
  vec3 p = mix(g, dm, e2);
  float show = smoothstep(0.62, 0.98, uPhase) * (1.0 - 0.45 * e2);
  float flow = fract(t * 0.8 - uTime * (0.22 + k * 0.25) + k * 5.0);
  vA = show * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t) * (0.28 + 0.72 * smoothstep(0.8, 1.0, flow));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position.xy += aOff * (2.0 / uRes) * gl_Position.w;
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

/** 星：ロゴのカメがまとう星にならって、いつもかすかに瞬く。甲羅になると金色に増え、ゆっくり昇る */
const STAR_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uShow;
uniform float uKick;
uniform float uPx;
varying float vA;
varying float vGold;
void main() {
  float sp = 0.035 + aSeed.y * 0.05;
  float life = fract(uTime * sp + aSeed.x * 7.0);
  vec3 p = position;
  p.y += life * 3.2 * uShow;
  float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed.z * 2.6) + aSeed.x * 40.0), 5.0);
  float fade = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.7, life);
  vA = (0.18 + 0.82 * tw) * mix(0.55, fade, uShow) * (0.45 + 0.55 * uShow) + uKick * 0.6;
  vGold = uShow;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (5.0 + aSeed.z * 9.0) * (0.55 + 0.45 * tw + uKick) * uPx / max(1.0, -mv.z * 0.07);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uOrange;
uniform vec3 uNavy;
varying float vA;
varying float vGold;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  vec2 a = pow(abs(q), vec2(0.62));
  float s = 1.0 - smoothstep(0.78, 1.0, a.x + a.y);
  float core = 1.0 - smoothstep(0.0, 0.35, length(q));
  if (s + core < 0.02) discard;
  vec3 c = mix(mix(uNavy, uOrange, 0.55), uGold, vGold);
  gl_FragColor = vec4(mix(c, vec3(1.0), core * 0.6), clamp(vA, 0.0, 1.0) * max(s, core * 0.8));
}
`;

const BASIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** 甲羅の後ろの光（存在感の光）。白地を濁さないよう、淡い金とオレンジの輪にとどめる */
const GLOW_FRAG = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uOrange;
uniform float uGlow;
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float halo = (1.0 - smoothstep(0.0, 1.0, r));
  float band = exp(-pow((r - 0.62 - sin(uTime * 0.8) * 0.02) * 9.0, 2.0)) * 0.5;
  vec3 c = mix(uGold, uOrange, smoothstep(0.2, 0.9, r));
  gl_FragColor = vec4(c, (halo * halo * 0.32 + band * 0.4) * uGlow);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

type U = Record<string, { value: unknown }>;

export class EnjinScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private tileU: U;
  private lineU: U;
  private starU: U;
  private glowU: U;
  private glow: Mesh;
  private rings: { mesh: Mesh; u: U; offset: number }[] = [];
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private cheer = 0;
  private kick = 0;
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
    // 「動きを減らす」設定のトップでは、スクロールで場面が進まない。いちばん伝わる一枚（光る甲羅）で止める
    const still = !o.animate && o.layout === 'right' && o.host.closest('[data-stage]') !== null;
    this.phase = still ? 2 : o.phase;
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
    this.camera.position.set(0, 0, 16);

    const navy = new Color(o.ink);
    const orange = new Color(o.brand);
    const gold = new Color(o.red);
    const ambient = o.mode === 'aurora';
    const small = window.matchMedia('(max-width: 767px)').matches;

    // ── タイル：亀甲の円盤・甲羅・漂う位置 ──
    const cells: { q: number; r: number; x: number; y: number; d: number }[] = [];
    for (let q = -RINGS; q <= RINGS; q++) {
      for (let r = Math.max(-RINGS, -q - RINGS); r <= Math.min(RINGS, -q + RINGS); r++) {
        cells.push({ q, r, x: S * Math.sqrt(3) * (q + r / 2), y: S * 1.5 * r, d: Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) });
      }
    }
    const n = cells.length;
    const maxR = Math.max(...cells.map((c) => Math.hypot(c.x, c.y)));
    const aGrid = new Float32Array(n * 3);
    const aDome = new Float32Array(n * 3);
    const aDomeN = new Float32Array(n * 3);
    const aScatter = new Float32Array(n * 3);
    const aInfo = new Float32Array(n * 4);
    const unit: Vector3[] = [];
    cells.forEach((c, i) => {
      aGrid.set([c.x, c.y, 0], i * 3);
      // 円盤の中心からの距離を、甲羅の天頂からの角度に写す
      const rr = Math.hypot(c.x, c.y) / maxR;
      const polar = rr * (Math.PI / 2) * 0.94;
      const az = Math.atan2(c.y, c.x);
      const u = new Vector3(Math.sin(polar) * Math.cos(az), Math.cos(polar), Math.sin(polar) * Math.sin(az));
      unit.push(u);
      aDome.set([RD * u.x, DY + RD * FY * u.y, RD * u.z], i * 3);
      // 楕円体の法線（つぶした分だけ、上向きに強く）
      const nn = new Vector3(u.x / RD, u.y / (RD * FY), u.z / RD).normalize();
      aDomeN.set([nn.x, nn.y, nn.z], i * 3);
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
      const roll = Math.random();
      // 真ん中は金の星（センターピン）。ほかは 紺6 : 白2.2 : 橙1.2 : 星0.6 くらい
      const kind = c.d === 0 ? 3 : roll < 0.6 ? 0 : roll < 0.82 ? 1 : roll < 0.94 ? 2 : 3;
      aInfo.set([kind, Math.random(), c.d / RINGS, Math.random()], i * 4);
    });

    const hex = new CylinderGeometry(1, 1, 1, 6, 1, false);
    hex.rotateX(Math.PI / 2);
    const geo = new InstancedBufferGeometry();
    geo.index = hex.index;
    geo.setAttribute('position', hex.getAttribute('position'));
    geo.setAttribute('normal', hex.getAttribute('normal'));
    geo.setAttribute('aGrid', new InstancedBufferAttribute(aGrid, 3));
    geo.setAttribute('aDome', new InstancedBufferAttribute(aDome, 3));
    geo.setAttribute('aDomeN', new InstancedBufferAttribute(aDomeN, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.instanceCount = ambient ? Math.round(n * (small ? 0.22 : 0.35)) : n;

    this.tileU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uAmbient: { value: ambient ? 1 : 0 },
      uScatter: { value: new Vector2(8, 5) },
      uScatterC: { value: new Vector2(0, 0) },
      uRig: { value: new Matrix4() },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uCheer: { value: 0 },
      uSpinG: { value: 0 },
      uSpinD: { value: 0 },
      uNavy: { value: navy },
      uOrange: { value: orange },
      uGold: { value: gold },
    };
    const tiles = new Mesh(
      geo,
      new ShaderMaterial({
        uniforms: this.tileU,
        vertexShader: TILE_VERT,
        fragmentShader: TILE_FRAG,
        depthTest: true,
        depthWrite: !ambient,
        transparent: ambient,
      }),
    );
    tiles.frustumCulled = false;
    this.scene.add(tiles);

    // ── 縁の糸：離れたタイルを一組ずつ結ぶ（数を打たず、一組だけ） ──
    const PAIRS = small ? 9 : 15;
    const SEG = 28;
    const gA: number[] = [];
    const gB: number[] = [];
    const uA: number[] = [];
    const uB: number[] = [];
    const tt: number[] = [];
    const off: number[] = [];
    const aLink = new Float32Array(n).fill(-1);
    const used = new Set<number>();
    let guard = 0;
    while (used.size / 2 < PAIRS && guard++ < 2000) {
      const i = 1 + Math.floor(Math.random() * (n - 1));
      const j = 1 + Math.floor(Math.random() * (n - 1));
      if (i === j || used.has(i) || used.has(j)) continue;
      if (Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y) < S * 4.5) continue;
      if (unit[i].dot(unit[j]) < -0.6) continue;
      used.add(i);
      used.add(j);
      const k = Math.random();
      aLink[i] = k;
      aLink[j] = k;
      for (const [ox, oy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        for (let s = 0; s < SEG; s++) {
          for (const f of [s / SEG, (s + 1) / SEG]) {
            gA.push(cells[i].x * GRID_K, cells[i].y * GRID_K, 0.1);
            gB.push(cells[j].x * GRID_K, cells[j].y * GRID_K, 0.1);
            uA.push(unit[i].x, unit[i].y, unit[i].z);
            uB.push(unit[j].x, unit[j].y, unit[j].z);
            tt.push(f, k);
            off.push(ox, oy);
          }
        }
      }
    }
    geo.setAttribute('aLink', new InstancedBufferAttribute(aLink, 1));
    const lgeo = new BufferGeometry();
    // position は使わない（シェーダーで計算する）が、three.js の描画に要るので同じ数だけ置く
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(tt.length * 1.5), 3));
    lgeo.setAttribute('aGA', new BufferAttribute(new Float32Array(gA), 3));
    lgeo.setAttribute('aGB', new BufferAttribute(new Float32Array(gB), 3));
    lgeo.setAttribute('aUA', new BufferAttribute(new Float32Array(uA), 3));
    lgeo.setAttribute('aUB', new BufferAttribute(new Float32Array(uB), 3));
    lgeo.setAttribute('aT', new BufferAttribute(new Float32Array(tt), 2));
    lgeo.setAttribute('aOff', new BufferAttribute(new Float32Array(off), 2));
    this.lineU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uSpinG: { value: 0 },
      uSpinD: { value: 0 },
      uCol: { value: orange },
      uRes: { value: new Vector2(1, 1) },
    };
    const lines = new LineSegments(
      lgeo,
      new ShaderMaterial({ uniforms: this.lineU, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false }),
    );
    lines.frustumCulled = false;
    this.rig.add(lines);

    // ── 甲羅の後ろの光 ──
    this.glowU = { uGold: { value: gold }, uOrange: { value: orange }, uGlow: { value: 0 }, uTime: { value: 0 } };
    this.glow = new Mesh(
      new CircleGeometry(RD * 1.75, 64),
      new ShaderMaterial({ uniforms: this.glowU, vertexShader: BASIC_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false }),
    );
    this.glow.position.set(0, DY + RD * FY * 0.45, -RD * 1.1);
    this.glow.renderOrder = -1;
    this.rig.add(this.glow);

    // ── 足元の輪（円陣）：甲羅のふちから外へ広がる ──
    for (let i = 0; i < 3; i++) {
      const u = { uCol: { value: orange }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.985, 1, 128),
        new ShaderMaterial({ uniforms: u, vertexShader: BASIC_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = DY - 0.05;
      this.rig.add(mesh);
      this.rings.push({ mesh, u, offset: i / 3 });
    }

    // ── 星 ──
    const STARS = ambient ? (small ? 26 : 50) : small ? 70 : 140;
    const sp = new Float32Array(STARS * 3);
    const ss = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = RD * (0.4 + Math.random() * 1.15);
      sp.set([Math.cos(a) * r, DY - 0.6 + Math.random() * (RD * 1.6), Math.sin(a) * r * 0.6 - 0.5], i * 3);
      ss.set([Math.random(), Math.random(), Math.random()], i * 3);
    }
    const sgeo = new BufferGeometry();
    sgeo.setAttribute('position', new BufferAttribute(sp, 3));
    sgeo.setAttribute('aSeed', new BufferAttribute(ss, 3));
    this.starU = {
      uTime: { value: 0 },
      uShow: { value: 0 },
      uKick: { value: 0 },
      uPx: { value: 1 },
      uGold: { value: gold },
      uOrange: { value: orange },
      uNavy: { value: navy },
    };
    const stars = new Points(
      sgeo,
      new ShaderMaterial({ uniforms: this.starU, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false }),
    );
    stars.frustumCulled = false;
    this.rig.add(stars);

    if (ambient) {
      lines.visible = false;
      this.glow.visible = false;
      this.rings.forEach((r) => (r.mesh.visible = false));
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

  /** クリック：中心から応援の波を広げ、星を瞬かせる */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) return;
    if ((e.target as Element | null)?.closest('a, button, input, select, textarea, label')) return;
    this.cheer = 1;
    this.kick = 1;
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    this.tileU.uAspect.value = this.camera.aspect;
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    const sc = this.tileU.uScatter.value as Vector2;
    const scc = this.tileU.uScatterC.value as Vector2;
    if (wide) {
      sc.set(halfW * 0.44, halfH * 0.98);
      scc.set(halfW * 0.52, 0);
    } else if (this.o.layout === 'right') {
      sc.set(halfW * 1.02, halfH * 0.36);
      scc.set(0, halfH * 0.6);
    } else {
      // 下層ページ・CTA帯：キャンバスの中ほどに。端のぼかし（mask）にかからないように
      sc.set(halfW * 0.78, halfH * 0.8);
      scc.set(halfW * 0.08, 0);
    }
    // 円盤の直径はおよそ 6.6、甲羅は幅 8.7・高さ 4.6
    if (wide) {
      this.offset.set(halfW * 0.46, -halfH * 0.02, 0);
      this.baseScale = Math.min(0.92, (halfW * 0.5) / 4.6, (halfH * 1.5) / 6.2);
    } else if (this.o.layout === 'right') {
      // スマホ：文字は下半分に来るので、甲羅は上の空いた場所に
      this.offset.set(0, halfH * 0.52, 0);
      this.baseScale = Math.min(0.7, (halfW * 1.45) / 9.2, (halfH * 0.62) / 5.4);
    } else {
      this.offset.set(0, 0, 0);
      this.baseScale = Math.min(0.95, (halfW * 0.95) / 4.8, (halfH * 1.6) / 6.2);
    }
    this.starU.uPx.value = this.renderer.getPixelRatio() * (h / 900) * 1.6;
    (this.lineU.uRes.value as Vector2).set(w, h);
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.o.mode === 'aurora' ? 0 : this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const dome = sm(1.05, 1.9, ph);
    this.rig.position.copy(this.offset);
    // 甲羅は少し上から見る。円盤は正面から。マウスで傾く。甲羅は幅があるので、少し小さく内側へ
    this.rig.position.y += dome * 0.35 * this.baseScale;
    this.rig.position.x -= dome * this.offset.x * 0.08;
    this.rig.scale.setScalar(this.baseScale * (1 - dome * 0.1));
    this.rig.rotation.set(-0.12 + dome * 0.5 - this.mouse.y * 0.12, this.mouse.x * 0.28, (1 - dome) * Math.sin(t * 0.2) * 0.04, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.tileU.uRig.value as Matrix4).copy(this.rig.matrixWorld);

    const spinG = t * 0.06;
    const spinD = t * 0.16;
    this.tileU.uTime.value = t;
    this.tileU.uPhase.value = ph;
    this.tileU.uCheer.value = this.cheer;
    this.tileU.uSpinG.value = spinG;
    this.tileU.uSpinD.value = spinD;
    this.lineU.uTime.value = t;
    this.lineU.uPhase.value = ph;
    this.lineU.uSpinG.value = spinG;
    this.lineU.uSpinD.value = spinD;
    this.starU.uTime.value = t;
    this.starU.uShow.value = dome;
    this.starU.uKick.value = this.kick;
    this.glowU.uTime.value = t;
    this.glowU.uGlow.value = dome;
    for (const r of this.rings) {
      const k = (t * 0.22 + r.offset) % 1;
      r.mesh.scale.setScalar(RD * (1.02 + k * 0.95));
      r.u.uOpacity.value = dome * (1 - k) * 0.55;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    (this.tileU.uIntro as { value: number }).value = 1;
    this.cheer = 0;
    this.kick = 0;
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
    const intro = this.tileU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    this.cheer = Math.max(0, this.cheer - 0.011);
    this.kick *= 0.94;
    (this.tileU.uMouse.value as Vector2).copy(this.mouse);
    this.tileU.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
