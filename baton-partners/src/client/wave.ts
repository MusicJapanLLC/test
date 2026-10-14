import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Matrix3,
  Matrix4,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「波長」のシーン（ZETTAICHI / n1a など orbit の世界観用）。黒い宇宙で光る。
 *
 *  phase 0〜0.6 一人ひとりの人柄の五角形（Big Five の5つの軸の長さがそれぞれちがう）が集まって、輪のある惑星になって回っている。
 *               公式サイトのヒーローの「輪のある惑星」へのオマージュ（知る前）
 *  phase 1      惑星がほどけて、五角形が3本の軌道（PLANET A / B / C）に散る。ちがう軌道の二人を波の糸が結び、
 *               波長がそろうと糸が静まって二人が灯る（合わせる）
 *  phase 2      五角形が角の丸い四角に変わり、水色とピンクの吹き出しが重なる点描になる。重なりは藍、真ん中の「…」が跳ねる（出会う）
 *
 * 色はロゴの3色（水色・ピンク・重なりの藍）を、黒地で光るように少し明るく。光は加算で重ねる（ネオンのように）。
 * マウスを近づけると五角形がふくらみ、クリックすると中心から波が広がって「…」が跳ねる。
 * 吹き出しの形は n1a のロゴにならった点描（ロゴの画像そのものは使わない）。
 */

/** ロゴの座標（画素）→ シーンの座標。中心と縮尺 */
const CX = 635;
const CY = 705;
const K = 1 / 100;
/** 軌道の傾き（手前に倒して楕円に見せる）と、少しの回転 */
const TILT = -1.12;
const ROLL = 0.24;
const RADII = [1.6, 2.6, 3.6];
const SPEEDS = [0.34, 0.22, 0.15];
/** 惑星の半径と、輪の内側・外側 */
const RS = 2.0;
const RING_IN = 2.75;
const RING_OUT = 4.2;

const TILE_VERT = /* glsl */ `
attribute vec3 aMark;
attribute vec3 aScatter;
attribute vec3 aOrbit;  // x: 半径, y: 初めの角度, z: 速さ
attribute vec4 aPlanet; // xyz: 惑星の上の位置（輪は輪の面の上）, w: 0=表面 1=輪
attribute vec4 aInfo;   // x: 種類(0=水色 1=ピンク 2=藍 3=「…」), y: 乱数, z: 中心からの距離(0〜1), w: 乱数（「…」は順番）
attribute vec4 aTa;     // 5つの軸の長さ（前の4つ）
attribute vec2 aTb;     // x: 5つめの軸, y: 大きさの乱数
attribute float aLink;  // 波の糸の端（糸の乱数）。ふつうは -1
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uAmbient;
uniform float uAspect;
uniform float uHover;
uniform float uKick;
uniform float uCell;
uniform float uRigS;
uniform float uAirS;
uniform float uSpin;
uniform vec2 uScatter;
uniform vec2 uScatterC;
uniform vec2 uMouse;
uniform mat3 uOrbitR;
uniform mat3 uPlanetR;
uniform mat4 uRig;
varying vec2 vUv;
varying vec4 vTa;
varying float vTb;
varying float vKind;
varying float vMorph;
varying float vOrbitE;
varying float vNear;
varying float vLink;
varying float vSeed;
varying float vDim;
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }

void main() {
  float t = uTime;
  float d = aInfo.z;
  float e1 = smoothstep(0.0, 1.0, clamp((uPhase - 0.5 - d * 0.2) / 0.3, 0.0, 1.0));
  float e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.0 - d * 0.35) / 0.6, 0.0, 1.0));
  float isDot = step(2.5, aInfo.x);
  float isRing = step(0.5, aPlanet.w);

  // クリックの波：中心から外へ広がる輪
  float ring = exp(-pow(d - (1.0 - uKick) * 1.3, 2.0) * 22.0) * uKick;

  // 輪のある惑星：表面は自転、輪はゆっくり回る。全体を傾ける
  vec3 pl = rotY(aPlanet.xyz, uSpin * mix(1.0, 0.55, isRing));
  pl *= 1.0 + ring * 0.18;
  pl = uPlanetR * pl;
  // 奥（カメラから遠い半球）は暗く。輪は明るいまま
  float zN = pl.z / ${RS.toFixed(2)};
  float dim = mix(0.18 + 0.82 * smoothstep(-0.9, 0.7, zN), 1.0, isRing);

  // 惑星の軌道
  float a = aOrbit.y + t * aOrbit.z;
  vec3 orb = uOrbitR * vec3(cos(a) * aOrbit.x, 0.0, sin(a) * aOrbit.x);

  // 重なる吹き出しの点描。「…」は順に跳ねる
  vec3 mk = aMark;
  float hop = pow(max(0.0, sin(t * 3.4 - aInfo.w * 1.05)), 6.0);
  mk.y += isDot * (hop * 0.15 + uKick * 0.12);
  mk.z += ring * 0.5;

  // 惑星がほどけるとき、外へ弾けてから軌道に入る
  vec3 burst = normalize(pl + vec3(1e-3)) * sin(e1 * 3.14159) * 1.1;
  vec3 local = mix(mix(pl, orb, e1) + burst, mk, e2);
  vec3 placed = (uRig * vec4(local, 1.0)).xyz;

  // 漂う（背景用）：文字のない側に寄せて、ゆっくり
  vec3 sc = vec3(uScatterC + aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.6), aScatter.z * 3.0 - 1.2);
  sc += vec3(sin(t * 0.23 + aInfo.y * 40.0), cos(t * 0.19 + aInfo.w * 30.0), 0.0) * 0.38;
  vec3 c = mix(placed, sc, uAmbient);

  vec4 clip = projectionMatrix * modelViewMatrix * vec4(c, 1.0);
  vec2 dm = clip.xy / clip.w - uMouse;
  dm.x *= uAspect;
  float near = smoothstep(0.3, 0.0, length(dm)) * uHover * (1.0 - uAmbient);

  // 波の糸の端の二人：波長がそろうと灯る（糸のシェーダーと同じ式）
  float orbitShow = e1 * (1.0 - e2) * (1.0 - uAmbient);
  float link = aLink < 0.0 ? 0.0 : smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(t * 0.45 + aLink * 6.2832)) * orbitShow;

  float sPlanet = (0.075 + aTb.y * 0.06 + isRing * 0.02) * uRigS;
  float sOrb = (0.08 + aTb.y * 0.06) * uRigS;
  float sMark = uCell * 0.5 * uRigS * (isDot > 0.5 ? 1.9 : 0.94);
  float sAir = (0.11 + pow(aTb.y, 3.0) * 0.36) * uAirS;
  float size = mix(mix(sPlanet, sOrb, e1), sMark, e2) * uIntro * (1.0 + near * 0.6 + ring * 0.5 + link * 0.45);
  size = mix(size, sAir * uIntro, uAmbient);
  // 光のにじみの分だけ、四角形を大きく取る（形は frag で 1/1.7 に縮めて描く）
  size *= 1.7;

  float spin = t * (aInfo.y - 0.5) * 0.5 + aInfo.w * 6.2832;
  float rot = mix(mix(spin, spin * 0.3, e1), 0.0, e2);
  vec2 q = rot2(rot) * position.xy * size;

  vec4 mv = modelViewMatrix * vec4(c + vec3(q, 0.0), 1.0);
  gl_Position = projectionMatrix * mv;

  vUv = position.xy * 1.7;
  vTa = aTa;
  vTb = aTb.x;
  vKind = aInfo.x;
  vMorph = e2 * (1.0 - uAmbient);
  vOrbitE = e1 * (1.0 - uAmbient);
  vNear = near;
  vLink = link;
  vSeed = aInfo.y;
  vDim = mix(mix(dim, 1.0, e1), 1.0, uAmbient);
}
`;

const TILE_FRAG = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uPink;
uniform vec3 uIndigo;
uniform float uAmbient;
uniform float uTime;
varying vec2 vUv;
varying vec4 vTa;
varying float vTb;
varying float vKind;
varying float vMorph;
varying float vOrbitE;
varying float vNear;
varying float vLink;
varying float vSeed;
varying float vDim;

float axisR(int i) {
  if (i == 0) return vTa.x;
  if (i == 1) return vTa.y;
  if (i == 2) return vTa.z;
  if (i == 3) return vTa.w;
  return vTb;
}
/* Big Five の五角形（レーダー）。上から時計回りに5つの軸。外側が正 */
float radarD(vec2 p, float scale) {
  float th = atan(p.x, p.y);
  if (th < 0.0) th += 6.2831853;
  float step5 = 6.2831853 / 5.0;
  int k = int(floor(th / step5));
  int k1 = k == 4 ? 0 : k + 1;
  float a0 = float(k) * step5;
  float a1 = a0 + step5;
  vec2 p0 = vec2(sin(a0), cos(a0)) * axisR(k) * scale;
  vec2 p1 = vec2(sin(a1), cos(a1)) * axisR(k1) * scale;
  vec2 e = p1 - p0;
  vec2 n = normalize(vec2(e.y, -e.x));
  if (dot(n, p0) < 0.0) n = -n;
  return dot(p - p0, n);
}
/* 5つの軸がそろった、正五角形の枠 */
float frameD(vec2 p) {
  float th = atan(p.x, p.y);
  float s = 6.2831853 / 5.0;
  float a = mod(th, s) - s * 0.5;
  return length(p) * cos(a) - 0.809 * 0.96;
}
float boxD(vec2 p) {
  vec2 q = abs(p) - vec2(0.8) + 0.24;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.24;
}

void main() {
  vec2 p = vUv;
  float dR = radarD(p, 0.96);
  float dB = boxD(p);
  float d = mix(dR, dB, vMorph);
  float fw = max(fwidth(d), 0.0015);
  float fill = 1.0 - smoothstep(-fw, fw, d);

  vec3 base = vKind < 0.5 ? uSky : vKind < 1.5 ? uPink : uIndigo;
  // 「…」は、点描になると白く抜ける
  if (vKind > 2.5) base = mix(uIndigo, vec3(1.0), vMorph);
  // 中心ほど白く光る芯
  vec3 core = mix(base, vec3(1.0), (1.0 - vMorph) * 0.32 * (1.0 - length(p) * 0.9));
  core = mix(core, vec3(1.0), vNear * 0.35);

  // 外へにじむ光（加算で重なる）
  float glow = exp(-max(d, 0.0) * 6.0) * (1.0 - fill) * mix(0.42, 0.24, vMorph);
  // 枠：5つの軸がそろったときの正五角形（惑星と軌道の間だけ、細い線で）
  float frame = (1.0 - smoothstep(0.0, fw * 1.6 + 0.014, abs(frameD(p)))) * (1.0 - vMorph) * 0.5;
  // 灯った二人：まわりに白い輪
  float halo = (1.0 - smoothstep(0.0, fw * 2.0 + 0.03, abs(length(p) - 1.05))) * vLink;

  vec3 col = core * fill + base * glow + mix(base, vec3(1.0), 0.5) * frame * (1.0 - fill) + vec3(1.0) * halo * (1.0 - fill);
  float a = fill * mix(0.92, 1.0, vMorph) + glow + frame * (1.0 - fill) + halo;
  // 奥の半球は暗く
  col *= vDim;
  a *= vDim;
  if (a < 0.01) discard;
  // 背景用（CTA帯など）は淡く漂うだけ
  gl_FragColor = vec4(col, min(a, 1.0) * (uAmbient > 0.5 ? 0.5 : 1.0));
}
`;

/** 波の糸：ちがう軌道の二人を結ぶ。波長がそろう（振れ幅が小さくなる）と、ピンクから白く静まる */
const LINE_VERT = /* glsl */ `
attribute vec3 aOA;
attribute vec3 aOB;
attribute vec2 aT;   // x: 糸の上の位置, y: 乱数
attribute vec2 aOff; // 画面上で1px ずらす量（同じ糸を重ねて太く見せる）
uniform float uTime;
uniform float uPhase;
uniform mat3 uOrbitR;
uniform vec2 uRes;
varying float vA;
varying float vTuned;
vec3 orbitP(vec3 o) { float a = o.y + uTime * o.z; return uOrbitR * vec3(cos(a) * o.x, 0.0, sin(a) * o.x); }
void main() {
  float s = aT.x;
  float k = aT.y;
  vec3 A = orbitP(aOA);
  vec3 B = orbitP(aOB);
  vec3 P = mix(A, B, s);
  vec3 dir = normalize(B - A + 1e-4);
  vec3 n = normalize(cross(dir, vec3(0.0, 0.0, 1.0)) + vec3(0.0, 1e-4, 0.0));
  float tune = smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(uTime * 0.45 + k * 6.2832));
  float amp = mix(0.26, 0.03, tune) * sin(3.14159 * s);
  float freq = mix(2.5 + k * 3.0, 1.5, tune);
  P += n * sin(s * 6.2832 * freq - uTime * (2.2 + k) + k * 10.0) * amp;
  float show = smoothstep(0.75, 1.0, uPhase) * (1.0 - smoothstep(1.12, 1.5, uPhase));
  vA = show * smoothstep(0.0, 0.05, s) * smoothstep(1.0, 0.95, s) * mix(0.4, 1.0, tune);
  vTuned = tune;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  gl_Position.xy += aOff * (2.0 / uRes) * gl_Position.w;
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uPink;
uniform vec3 uSky;
varying float vA;
varying float vTuned;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(mix(uPink, mix(uSky, vec3(1.0), 0.55), vTuned), vA);
}
`;

const BASIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** 軌道の線：淡い青白 */
const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

/** 惑星の芯：宇宙を少し隠す暗い円盤と、ZETTAICHI の青の縁の光（公式サイトの惑星の縁の光にならう） */
const CORE_FRAG = /* glsl */ `
uniform vec3 uBlue;
uniform float uShow;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float body = 1.0 - smoothstep(0.86, 1.0, r);
  // 左上から光が当たる縁
  float lit = smoothstep(0.55, 1.0, r) * (0.55 + 0.45 * dot(normalize(c + 1e-4), normalize(vec2(-0.6, 0.8))));
  vec3 col = mix(vec3(0.02, 0.03, 0.07), uBlue, clamp(lit, 0.0, 1.0) * 0.9);
  gl_FragColor = vec4(col, body * uShow * 0.92);
}
`;

/** まわりの光：ZETTAICHI の青と n1a の水色・ピンクのにじみ */
const GLOW_FRAG = /* glsl */ `
uniform vec3 uBlue;
uniform vec3 uSky;
uniform vec3 uPink;
uniform float uGlow;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float halo = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0);
  float band = exp(-pow((r - 0.42) * 7.0, 2.0)) * 0.5;
  float side = 0.5 + 0.5 * sin(atan(c.y, c.x) + uTime * 0.25);
  vec3 col = mix(uBlue, mix(uSky, uPink, side), 0.45);
  gl_FragColor = vec4(col, (halo * 0.55 + band) * uGlow);
}
`;

type U = Record<string, { value: unknown }>;

/* ── ロゴの吹き出しの形（画素の座標）。水色＝左の耳つき、ピンク＝右の耳としっぽつき、重なり＝藍 ── */
function sdRoundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): number {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dx = Math.abs(x - cx) - ((x1 - x0) / 2 - r);
  const dy = Math.abs(y - cy) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}
function inPoly(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inSky = (x: number, y: number) =>
  sdRoundRect(x, y, 369, 540, 795, 895, 92) < 0 ||
  inPoly(x, y, [
    [369, 660],
    [369, 528],
    [376, 506],
    [398, 498],
    [424, 505],
    [565, 582],
    [565, 660],
  ]);
const inPink = (x: number, y: number) =>
  sdRoundRect(x, y, 405, 580, 830, 913, 92) < 0 ||
  inPoly(x, y, [
    [690, 660],
    [690, 584],
    [800, 520],
    [818, 518],
    [830, 532],
    [830, 660],
  ]) ||
  inPoly(x, y, [
    [843, 790],
    [902, 888],
    [888, 913],
    [765, 913],
  ]);
const DOTS: [number, number][] = [
  [511, 772],
  [600, 772],
  [689, 772],
];

export class WaveScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private tileU: U;
  private lineU: U;
  private glowU: U;
  private coreU: U;
  private rings: { mesh: Mesh; u: U }[] = [];
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private kick = 0;
  private offset = new Vector3();
  /** 動詞の場面（Know / Tune / Meet）で、左の文字をよけて惑星を右へ寄せる幅 */
  private sideX = 0;
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
    // 「動きを減らす」設定のトップでは、スクロールで場面が進まない。いちばん伝わる一枚（輪のある惑星）で止める
    const still = !o.animate && o.layout === 'right' && o.host.closest('[data-stage]') !== null;
    this.phase = still ? 0.45 : o.phase;
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

    const sky = new Color(o.ink);
    const pink = new Color(o.brand);
    const indigo = new Color(o.red);
    const blue = new Color('#2F7BFF');
    const ambient = o.mode === 'aurora';
    const small = window.matchMedia('(max-width: 767px)').matches;

    // 軌道と惑星の傾き
    const orbitG = new Group();
    orbitG.rotation.set(TILT, 0, ROLL);
    orbitG.updateMatrix();
    const orbitR = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(orbitG.rotation));
    const planetEuler = new Group().rotation.set(0.32, 0, -0.34);
    const planetR = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(planetEuler));

    // ── 点描のマス目（吹き出しの中だけ）。「…」の所は抜いて、別に3つ置く ──
    const STEP = small ? 26 : 19;
    const cells: { x: number; y: number; kind: number }[] = [];
    for (let y = 498 + STEP / 2; y < 916; y += STEP) {
      for (let x = 369 + STEP / 2; x < 904; x += STEP) {
        const s = inSky(x, y);
        const pk = inPink(x, y);
        if (!s && !pk) continue;
        if (DOTS.some(([dx, dy]) => Math.abs(x - dx) < 24 && Math.abs(y - dy) < 24)) continue;
        cells.push({ x, y, kind: s && pk ? 2 : s ? 0 : 1 });
      }
    }
    DOTS.forEach(([x, y]) => cells.push({ x, y, kind: 3 }));
    const n = cells.length;
    const maxD = Math.max(...cells.map((c) => Math.hypot(c.x - CX, c.y - CY)));

    const aMark = new Float32Array(n * 3);
    const aScatter = new Float32Array(n * 3);
    const aOrbit = new Float32Array(n * 3);
    const aPlanet = new Float32Array(n * 4);
    const aInfo = new Float32Array(n * 4);
    const aTa = new Float32Array(n * 4);
    const aTb = new Float32Array(n * 2);
    const orbits: number[][] = [];
    // 惑星の表面はフィボナッチ球で均等に。3割ほどは輪に
    const ringCount = Math.round(n * 0.34);
    const surfCount = n - ringCount;
    const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
    let dot = 0;
    cells.forEach((c, i) => {
      aMark.set([(c.x - CX) * K, -(c.y - CY) * K, 0], i * 3);
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()], i * 3);
      const roll = Math.random();
      const ringIdx = roll < 0.24 ? 0 : roll < 0.6 ? 1 : 2;
      // 軌道は線ではなく帯に。半径を少しずつずらす
      const ob = [RADII[ringIdx] + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, SPEEDS[ringIdx] * (0.9 + Math.random() * 0.2)];
      orbits.push(ob);
      aOrbit.set(ob, i * 3);
      const slot = order[i];
      if (slot < surfCount) {
        const k = slot + 0.5;
        const phi = Math.acos(1 - (2 * k) / surfCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * k;
        aPlanet.set([RS * Math.sin(phi) * Math.cos(theta), RS * Math.cos(phi), RS * Math.sin(phi) * Math.sin(theta), 0], i * 4);
      } else {
        const r = RING_IN + Math.pow(Math.random(), 0.8) * (RING_OUT - RING_IN);
        const th = Math.random() * Math.PI * 2;
        aPlanet.set([Math.cos(th) * r, (Math.random() - 0.5) * 0.06, Math.sin(th) * r, 1], i * 4);
      }
      const w = c.kind === 3 ? dot++ : Math.random();
      aInfo.set([c.kind, Math.random(), Math.hypot(c.x - CX, c.y - CY) / maxD, w], i * 4);
      // 5つの軸の長さ（人柄）。少しだけ尖りを出す
      const tr = Array.from({ length: 5 }, () => 0.34 + Math.random() * 0.66);
      aTa.set(tr.slice(0, 4), i * 4);
      aTb.set([tr[4], Math.random()], i * 2);
    });
    // 輪は惑星の赤道面に（惑星と同じ傾きで回す）。輪の面は xz なので、表面と同じ uPlanetR で傾く

    const quad = new PlaneGeometry(2, 2);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('aMark', new InstancedBufferAttribute(aMark, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aOrbit', new InstancedBufferAttribute(aOrbit, 3));
    geo.setAttribute('aPlanet', new InstancedBufferAttribute(aPlanet, 4));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.setAttribute('aTa', new InstancedBufferAttribute(aTa, 4));
    geo.setAttribute('aTb', new InstancedBufferAttribute(aTb, 2));
    geo.instanceCount = ambient ? Math.round(n * (small ? 0.14 : 0.2)) : n;

    this.tileU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uAmbient: { value: ambient ? 1 : 0 },
      uAspect: { value: 1 },
      uHover: { value: 0 },
      uKick: { value: 0 },
      uCell: { value: STEP * K },
      uRigS: { value: 1 },
      // スマホでは漂う五角形を小さめに（文字の上に重なるので）
      uAirS: { value: small ? 0.68 : 1 },
      uSpin: { value: 0 },
      uScatter: { value: new Vector2(8, 5) },
      uScatterC: { value: new Vector2(0, 0) },
      uMouse: { value: new Vector2(9, 9) },
      uOrbitR: { value: orbitR },
      uPlanetR: { value: planetR },
      uRig: { value: new Matrix4() },
      uSky: { value: sky },
      uPink: { value: pink },
      uIndigo: { value: indigo },
    };
    const tiles = new Mesh(
      geo,
      new ShaderMaterial({
        uniforms: this.tileU,
        vertexShader: TILE_VERT,
        fragmentShader: TILE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    tiles.frustumCulled = false;
    tiles.renderOrder = 2;
    this.scene.add(tiles);

    // ── 波の糸：ちがう軌道の二人を、一組ずつ ──
    const PAIRS = small ? 7 : 12;
    const SEG = 64;
    const oA: number[] = [];
    const oB: number[] = [];
    const tt: number[] = [];
    const off: number[] = [];
    const aLink = new Float32Array(n).fill(-1);
    const used = new Set<number>();
    let guard = 0;
    while (used.size / 2 < PAIRS && guard++ < 4000) {
      const i = Math.floor(Math.random() * n);
      const j = Math.floor(Math.random() * n);
      if (i === j || used.has(i) || used.has(j) || cells[i].kind === 3 || cells[j].kind === 3) continue;
      if (Math.abs(orbits[i][0] - orbits[j][0]) < 0.5) continue;
      used.add(i);
      used.add(j);
      const k = Math.random();
      aLink[i] = k;
      aLink[j] = k;
      for (const [ox, oy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        for (let s = 0; s < SEG; s++) {
          for (const f of [s / SEG, (s + 1) / SEG]) {
            oA.push(...orbits[i]);
            oB.push(...orbits[j]);
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
    lgeo.setAttribute('aOA', new BufferAttribute(new Float32Array(oA), 3));
    lgeo.setAttribute('aOB', new BufferAttribute(new Float32Array(oB), 3));
    lgeo.setAttribute('aT', new BufferAttribute(new Float32Array(tt), 2));
    lgeo.setAttribute('aOff', new BufferAttribute(new Float32Array(off), 2));
    this.lineU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uOrbitR: { value: orbitR },
      uRes: { value: new Vector2(1, 1) },
      uPink: { value: pink },
      uSky: { value: sky },
    };
    const lines = new LineSegments(
      lgeo,
      new ShaderMaterial({
        uniforms: this.lineU,
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    lines.frustumCulled = false;
    lines.renderOrder = 1;
    this.rig.add(lines);

    // ── 3本の軌道（PLANET A / B / C） ──
    RADII.forEach((r) => {
      const u = { uCol: { value: new Color('#9FB8FF') }, uOpacity: { value: 0 } };
      const g = new RingGeometry(r - 0.008, r + 0.008, 160);
      g.rotateX(Math.PI / 2);
      const mesh = new Mesh(
        g,
        new ShaderMaterial({
          uniforms: u,
          vertexShader: BASIC_VERT,
          fragmentShader: RING_FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: DoubleSide,
          blending: AdditiveBlending,
        }),
      );
      orbitG.add(mesh);
      this.rings.push({ mesh, u });
    });
    this.rig.add(orbitG);

    // ── まわりの光と、惑星の芯 ──
    this.glowU = { uBlue: { value: blue }, uSky: { value: sky }, uPink: { value: pink }, uGlow: { value: 0 }, uTime: { value: 0 } };
    const glow = new Mesh(
      new CircleGeometry(6.4, 64),
      new ShaderMaterial({
        uniforms: this.glowU,
        vertexShader: BASIC_VERT,
        fragmentShader: GLOW_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    glow.position.z = -2;
    glow.renderOrder = -2;
    this.rig.add(glow);
    this.coreU = { uBlue: { value: blue }, uShow: { value: 1 }, uTime: { value: 0 } };
    const core = new Mesh(
      new CircleGeometry(RS * 0.98, 64),
      new ShaderMaterial({
        uniforms: this.coreU,
        vertexShader: BASIC_VERT,
        fragmentShader: CORE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: NormalBlending,
      }),
    );
    core.renderOrder = -1;
    this.rig.add(core);

    if (ambient) {
      lines.visible = false;
      glow.visible = false;
      core.visible = false;
      orbitG.visible = false;
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

  /** クリック：中心から波を広げ、「…」を跳ねさせる */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) return;
    if ((e.target as Element | null)?.closest('a, button, input, select, textarea, label')) return;
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
    const stage = this.o.layout === 'right';
    const wide = this.camera.aspect > 1.15;
    const sc = this.tileU.uScatter.value as Vector2;
    const scc = this.tileU.uScatterC.value as Vector2;
    sc.set(halfW * 0.86, halfH * 0.86);
    scc.set(0, 0);
    // 惑星と輪はおよそ幅 8.4・高さ 5、軌道は直径 7.2、吹き出しは幅 5.3
    this.sideX = 0;
    if (stage && wide) {
      // トップ：公式サイトのヒーローのように、巨大な見出しの真後ろに惑星
      this.offset.set(0, -halfH * 0.02, 0);
      this.sideX = halfW * 0.36;
      this.baseScale = Math.min(1.15, (halfW * 1.2) / 4.4, (halfH * 1.42) / 4.2);
    } else if (stage) {
      // スマホ：見出しの後ろ、少し上に。輪は画面の端から少しはみ出す
      this.offset.set(0, halfH * 0.3, 0);
      this.baseScale = Math.min(0.78, (halfW * 1.5) / 4.4, (halfH * 0.9) / 4.2);
    } else {
      this.offset.set(0, 0, 0);
      this.baseScale = Math.min(0.92, (halfW * 0.9) / 4.4, (halfH * 1.4) / 4.4);
    }
    (this.lineU.uRes.value as Vector2).set(w, h);
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.o.mode === 'aurora' ? 0 : this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const planet = 1 - sm(0.55, 0.9, ph);
    const orbit = sm(0.7, 1.0, ph) * (1 - sm(1.15, 1.7, ph));
    const mark = sm(1.2, 1.9, ph);
    const side = sm(0.6, 0.85, ph);
    this.rig.position.set(this.offset.x + this.sideX * side, this.offset.y, this.offset.z);
    const scale = this.baseScale * (1 - side * (this.sideX ? 0.12 : 0));
    this.rig.scale.setScalar(scale);
    // マウスで傾く。吹き出しは正面を向く
    this.rig.rotation.set(-this.mouse.y * 0.12 * (1 - mark * 0.6), this.mouse.x * 0.26 * (1 - mark * 0.6), (1 - mark) * Math.sin(t * 0.15) * 0.04, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.tileU.uRig.value as Matrix4).copy(this.rig.matrixWorld);
    this.tileU.uRigS.value = scale;

    this.tileU.uTime.value = t;
    this.tileU.uPhase.value = ph;
    this.tileU.uKick.value = this.kick;
    this.tileU.uSpin.value = t * 0.16;
    this.lineU.uTime.value = t;
    this.lineU.uPhase.value = ph;
    this.glowU.uTime.value = t;
    this.glowU.uGlow.value = Math.max(planet * 0.95, orbit * 0.7, mark * 0.55);
    this.coreU.uShow.value = planet;
    this.rings.forEach((r, i) => (r.u.uOpacity.value = orbit * (0.3 - i * 0.06)));
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    (this.tileU.uIntro as { value: number }).value = 1;
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
    this.kick = Math.max(0, this.kick - 0.012);
    (this.tileU.uMouse.value as Vector2).copy(this.mouse);
    this.tileU.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
