import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
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
 * 「波長」のシーン（ZETTAICHI / n1a など orbit の世界観用）。
 *
 *  phase 0〜1  一人ひとりの人柄の五角形（Big Five の5つの軸の長さがそれぞれちがう）が、宙を漂う（知る）
 *  phase 1     五角形が3本の惑星の軌道（公式サイトの PLANET A / B / C にならう）に並んで回る。
 *              ちがう軌道の二人を波の糸が結び、波長がそろうと糸が藍色に静まって、二人が灯る（合わせる）
 *  phase 2     五角形が角の丸い四角に変わり、水色とピンクの吹き出しが重なる点描になる。
 *              重なった所は藍色、真ん中の3つの「…」が入力中のように跳ねる（出会う）
 *
 * 色はロゴの3色（水色・ピンク・重なりの藍）。点描の形は n1a のロゴの吹き出しにならう（ロゴの画像そのものは使わない）。
 * マウスを近づけると五角形が少しふくらみ、クリックすると中心から波が広がって「…」が跳ねる。
 */

/** ロゴの座標（画素）→ シーンの座標。中心と縮尺 */
const CX = 635;
const CY = 705;
const K = 1 / 100;
/** 軌道の傾き（手前に倒して楕円に見せる）と、少しの回転 */
const TILT = -1.08;
const ROLL = 0.22;
const RADII = [1.55, 2.5, 3.45];
const SPEEDS = [0.34, 0.22, 0.15];

const TILE_VERT = /* glsl */ `
attribute vec3 aMark;
attribute vec3 aScatter;
attribute vec3 aOrbit; // x: 半径, y: 初めの角度, z: 速さ
attribute vec4 aInfo;  // x: 種類(0=水色 1=ピンク 2=藍 3=「…」), y: 乱数, z: 中心からの距離(0〜1), w: 乱数（「…」は順番）
attribute vec4 aTa;    // 5つの軸の長さ（前の4つ）
attribute vec2 aTb;    // x: 5つめの軸, y: 大きさの乱数
attribute float aLink; // 波の糸の端（糸の乱数）。ふつうは -1
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
uniform vec2 uScatter;
uniform vec2 uScatterC;
uniform vec2 uMouse;
uniform mat3 uOrbitR;
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
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  float t = uTime;
  float d = aInfo.z;
  float e1 = smoothstep(0.0, 1.0, clamp((uPhase * 1.3 - d * 0.45 - 0.12) / 0.55, 0.0, 1.0));
  float e2 = smoothstep(0.0, 1.0, clamp((uPhase - 1.0 - d * 0.35) / 0.6, 0.0, 1.0));
  float isDot = step(2.5, aInfo.x);

  // 漂う：文字のない側に寄せて、ゆっくり
  vec3 sc = vec3(uScatterC + aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.6), aScatter.z * 3.0 - 1.2);
  sc += vec3(sin(t * 0.23 + aInfo.y * 40.0), cos(t * 0.19 + aInfo.w * 30.0), 0.0) * 0.38;

  // 惑星の軌道
  float a = aOrbit.y + t * aOrbit.z;
  vec3 orb = uOrbitR * vec3(cos(a) * aOrbit.x, 0.0, sin(a) * aOrbit.x);

  // 重なる吹き出しの点描。クリックの波が中心から広がり、「…」は順に跳ねる
  float ring = exp(-pow(d - (1.0 - uKick) * 1.3, 2.0) * 22.0) * uKick;
  vec3 mk = aMark;
  float hop = pow(max(0.0, sin(t * 3.4 - aInfo.w * 1.05)), 6.0);
  mk.y += isDot * (hop * 0.15 + uKick * 0.12);
  mk.z += ring * 0.5;

  vec3 local = mix(orb, mk, e2);
  vec3 placed = (uRig * vec4(local, 1.0)).xyz;
  vec3 c = mix(sc, placed, e1);
  c = mix(c, sc, uAmbient);

  vec4 clip = projectionMatrix * modelViewMatrix * vec4(c, 1.0);
  vec2 dm = clip.xy / clip.w - uMouse;
  dm.x *= uAspect;
  float near = smoothstep(0.32, 0.0, length(dm)) * uHover * (1.0 - uAmbient);

  // 波の糸の端の二人：波長がそろうと灯る（糸のシェーダーと同じ式）
  float orbitShow = e1 * (1.0 - e2) * (1.0 - uAmbient);
  float link = aLink < 0.0 ? 0.0 : smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(t * 0.45 + aLink * 6.2832)) * orbitShow;

  // 漂う五角形は、小さいものが多く、ときどき大きいもの
  float sAir = (0.11 + pow(aTb.y, 3.0) * 0.4) * uAirS;
  float sOrb = (0.075 + aTb.y * 0.055) * uRigS;
  float sMark = uCell * 0.5 * uRigS * (isDot > 0.5 ? 1.9 : 0.94);
  float size = mix(mix(sAir, sOrb, e1), sMark, e2) * uIntro * (1.0 + near * 0.45 + ring * 0.5 + link * 0.4);
  size = mix(size, sAir * uIntro, uAmbient);

  float spin = t * (aInfo.y - 0.5) * 0.5 + aInfo.w * 6.2832;
  float rot = mix(mix(spin, spin * 0.3, e1), 0.0, e2);
  vec2 q = rot2(rot) * position.xy * size;

  vec4 mv = modelViewMatrix * vec4(c + vec3(q, 0.0), 1.0);
  gl_Position = projectionMatrix * mv;

  vUv = position.xy;
  vTa = aTa;
  vTb = aTb.x;
  vKind = aInfo.x;
  vMorph = e2 * (1.0 - uAmbient);
  vOrbitE = e1 * (1.0 - uAmbient);
  vNear = near;
  vLink = link;
  vSeed = aInfo.y;
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
  // 漂っている間は、少し明るく、中心から縁へ淡い光
  vec3 col = mix(base, vec3(1.0), (1.0 - vMorph) * 0.16 * (1.0 - length(p) * 0.8));
  col = mix(col, vec3(1.0), vNear * 0.18);

  // 枠：5つの軸がそろったときの正五角形（漂っている間だけ、細い線で）
  float fd = abs(frameD(p));
  float frame = (1.0 - smoothstep(0.0, fw * 1.6 + 0.012, fd)) * (1.0 - vMorph) * 0.55;
  // 灯った二人：まわりに藍色の輪
  float halo = (1.0 - smoothstep(0.0, fw * 2.0 + 0.03, abs(length(p) - 0.94))) * vLink;

  float alpha = fill * mix(0.86, 1.0, vMorph);
  vec3 outCol = col;
  float outA = alpha;
  if (frame > 0.001 && fill < 0.5) {
    outCol = mix(base, uIndigo, 0.4);
    outA = max(outA, frame * mix(0.55, 0.0, vOrbitE * 0.6));
  }
  if (halo > 0.001) {
    outCol = mix(outCol, uIndigo, halo * (1.0 - fill));
    outA = max(outA, halo);
  }
  if (outA < 0.01) discard;
  // 背景用（CTA帯など）は淡く漂うだけ
  gl_FragColor = vec4(outCol, outA * (uAmbient > 0.5 ? 0.32 : 1.0));
}
`;

/** 波の糸：ちがう軌道の二人を結ぶ。波長がそろう（振れ幅が小さくなる）と、ピンクから藍に静まる */
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
  float amp = mix(0.24, 0.03, tune) * sin(3.14159 * s);
  float freq = mix(2.5 + k * 3.0, 1.5, tune);
  P += n * sin(s * 6.2832 * freq - uTime * (2.2 + k) + k * 10.0) * amp;
  float show = smoothstep(0.55, 0.95, uPhase) * (1.0 - smoothstep(1.12, 1.5, uPhase));
  vA = show * smoothstep(0.0, 0.05, s) * smoothstep(1.0, 0.95, s) * mix(0.32, 0.92, tune);
  vTuned = tune;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  gl_Position.xy += aOff * (2.0 / uRes) * gl_Position.w;
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uPink;
uniform vec3 uIndigo;
varying float vA;
varying float vTuned;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(mix(uPink, uIndigo, vTuned), vA);
}
`;

const BASIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** 軌道の線：ごく淡い紺 */
const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

/** 真ん中の光：水色とピンクの淡いにじみ（白地を濁さない程度に） */
const GLOW_FRAG = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uPink;
uniform float uGlow;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float halo = 1.0 - smoothstep(0.0, 1.0, r);
  float side = 0.5 + 0.5 * sin(atan(c.y, c.x) + uTime * 0.2);
  vec3 col = mix(uSky, uPink, side);
  gl_FragColor = vec4(col, halo * halo * 0.2 * uGlow);
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
    // 「動きを減らす」設定のトップでは、スクロールで場面が進まない。いちばん伝わる一枚（重なる吹き出し）で止める
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

    const sky = new Color(o.ink);
    const pink = new Color(o.brand);
    const indigo = new Color(o.red);
    const navy = new Color('#001E44');
    const ambient = o.mode === 'aurora';
    const small = window.matchMedia('(max-width: 767px)').matches;

    // 軌道の傾き
    const orbitG = new Group();
    orbitG.rotation.set(TILT, 0, ROLL);
    orbitG.updateMatrix();
    const orbitR = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(orbitG.rotation));

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
    const aInfo = new Float32Array(n * 4);
    const aTa = new Float32Array(n * 4);
    const aTb = new Float32Array(n * 2);
    const orbits: number[][] = [];
    let dot = 0;
    cells.forEach((c, i) => {
      aMark.set([(c.x - CX) * K, -(c.y - CY) * K, 0], i * 3);
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()], i * 3);
      // 軌道は内側ほど少なめに
      const roll = Math.random();
      const ring = roll < 0.24 ? 0 : roll < 0.6 ? 1 : 2;
      // 軌道は線ではなく帯に。半径を少しずつずらす
      const ob = [RADII[ring] + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, SPEEDS[ring] * (0.9 + Math.random() * 0.2)];
      orbits.push(ob);
      aOrbit.set(ob, i * 3);
      const w = c.kind === 3 ? dot++ : Math.random();
      aInfo.set([c.kind, Math.random(), Math.hypot(c.x - CX, c.y - CY) / maxD, w], i * 4);
      // 5つの軸の長さ（人柄）。少しだけ尖りを出す
      const tr = Array.from({ length: 5 }, () => 0.34 + Math.random() * 0.66);
      aTa.set(tr.slice(0, 4), i * 4);
      aTb.set([tr[4], Math.random()], i * 2);
    });

    const quad = new PlaneGeometry(2, 2);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('aMark', new InstancedBufferAttribute(aMark, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aOrbit', new InstancedBufferAttribute(aOrbit, 3));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.setAttribute('aTa', new InstancedBufferAttribute(aTa, 4));
    geo.setAttribute('aTb', new InstancedBufferAttribute(aTb, 2));
    geo.instanceCount = ambient ? Math.round(n * (small ? 0.12 : 0.18)) : n;

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
      uScatter: { value: new Vector2(8, 5) },
      uScatterC: { value: new Vector2(0, 0) },
      uMouse: { value: new Vector2(9, 9) },
      uOrbitR: { value: orbitR },
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
      uIndigo: { value: indigo },
    };
    const lines = new LineSegments(
      lgeo,
      new ShaderMaterial({ uniforms: this.lineU, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, depthTest: false }),
    );
    lines.frustumCulled = false;
    lines.renderOrder = 1;
    this.rig.add(lines);

    // ── 3本の軌道（PLANET A / B / C）と、真ん中の淡い光 ──
    RADII.forEach((r) => {
      const u = { uCol: { value: navy }, uOpacity: { value: 0 } };
      const g = new RingGeometry(r - 0.008, r + 0.008, 160);
      g.rotateX(Math.PI / 2);
      const mesh = new Mesh(
        g,
        new ShaderMaterial({ uniforms: u, vertexShader: BASIC_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide }),
      );
      orbitG.add(mesh);
      this.rings.push({ mesh, u });
    });
    this.rig.add(orbitG);
    this.glowU = { uSky: { value: sky }, uPink: { value: pink }, uGlow: { value: 0 }, uTime: { value: 0 } };
    const glow = new Mesh(
      new CircleGeometry(4.6, 64),
      new ShaderMaterial({ uniforms: this.glowU, vertexShader: BASIC_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, depthTest: false }),
    );
    glow.position.z = -1.5;
    glow.renderOrder = -1;
    this.rig.add(glow);

    if (ambient) {
      lines.visible = false;
      glow.visible = false;
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
    // 軌道の直径はおよそ 7、吹き出しは幅 5.3・高さ 4.2
    if (wide) {
      this.offset.set(halfW * 0.48, -halfH * 0.02, 0);
      this.baseScale = Math.min(0.95, (halfW * 0.5) / 3.7, (halfH * 1.55) / 4.6);
    } else if (this.o.layout === 'right') {
      // スマホ：文字は下半分に来るので、上の空いた場所に
      this.offset.set(0, halfH * 0.5, 0);
      this.baseScale = Math.min(0.72, (halfW * 1.6) / 7.2, (halfH * 0.66) / 4.4);
    } else {
      this.offset.set(0, 0, 0);
      this.baseScale = Math.min(0.82, (halfW * 0.86) / 3.7, (halfH * 1.5) / 4.6);
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
    const orbit = sm(0.45, 0.95, ph) * (1 - sm(1.15, 1.7, ph));
    const mark = sm(1.2, 1.9, ph);
    this.rig.position.copy(this.offset);
    this.rig.scale.setScalar(this.baseScale);
    // 軌道は少し回りながら、マウスで傾く。吹き出しは正面を向く
    this.rig.rotation.set(-this.mouse.y * 0.1 * (1 - mark * 0.6), this.mouse.x * 0.22 * (1 - mark * 0.6), (1 - mark) * Math.sin(t * 0.15) * 0.04, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.tileU.uRig.value as Matrix4).copy(this.rig.matrixWorld);
    this.tileU.uRigS.value = this.baseScale;

    this.tileU.uTime.value = t;
    this.tileU.uPhase.value = ph;
    this.tileU.uKick.value = this.kick;
    this.lineU.uTime.value = t;
    this.lineU.uPhase.value = ph;
    this.glowU.uTime.value = t;
    this.glowU.uGlow.value = Math.max(orbit, mark * 0.6);
    this.rings.forEach((r, i) => (r.u.uOpacity.value = orbit * (0.16 - i * 0.03)));
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
