import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineBasicMaterial,
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
 * 「縁（えん）」のシーン（Cominka など minka の世界観用）。
 *
 *  phase 0〜1  検索の札（和紙のカード）が宙を舞い、障子の格子に一枚ずつ収まっていく（設計する：整理と優先順位）
 *  phase 1     格子の中央に、朱色の判子（お客さまのサイト）が押される。札から赤い糸が伸び始める（改善する）
 *  phase 2     すべての札が赤い糸で判子に結ばれ、判子が手前に浮き上がる。波紋が広がり、糸の上を光が渡る（検証する：成果）
 *
 * 札は1つのジオメトリを instancing で並べ、和紙の繊維・朱の印・検索結果の行をフラグメントで描く。
 * マウスを近づけると札がめくれ、クリックすると糸を光が駆け抜ける。
 */

const CARD = new Vector3(0.92, 0.6, 0.03);
const COLS = 9;
const ROWS = 7;
const DX = 1.2;
const DY = 0.88;

const CARD_VERT = /* glsl */ `
attribute vec3 aGrid;
attribute vec3 aScatter;
attribute vec4 aSeed; // x: 収まる順番, y: 乱数, z: 糸の遅れ, w: 乱数
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uTie;
uniform float uRise;
uniform float uAmbient;
uniform vec2 uScatter;
uniform mat4 uRig;
uniform vec2 uMouse;
uniform float uHover;
uniform vec3 uPulse;
uniform float uAspect;
uniform vec3 uSize;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFront;
varying float vSeed;
varying float vTied;
varying float vLift;

mat3 rotXYZ(vec3 a) {
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

void main() {
  float t = uTime;
  vec3 shape = position * uSize * uIntro;

  // 散らばる：画面いっぱいに、ひらひらと舞う
  vec3 sc = vec3(aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 0.8), aScatter.z * 4.0);
  sc += vec3(sin(t * 0.21 + aSeed.y * 40.0), cos(t * 0.17 + aSeed.w * 30.0) - t * 0.0, sin(t * 0.13 + aSeed.y * 17.0)) * 0.45;
  mat3 flutter = rotXYZ(vec3(sin(t * 0.6 + aSeed.y * 9.0) * 1.2, t * (0.3 + aSeed.w * 0.5) + aSeed.y * 6.28, sin(t * 0.4 + aSeed.w * 7.0) * 0.6));

  // 収まる：障子の格子に、順番に
  float e = smoothstep(0.0, 1.0, clamp((uPhase - aSeed.x * 0.55) / 0.45, 0.0, 1.0));
  // 結ばれた札は、中央の判子のほうへ少しだけ傾く
  vec3 toCenter = -aGrid;
  float tied = uTie * smoothstep(aSeed.z, aSeed.z + 0.25, uTie);
  mat3 lean = rotXYZ(vec3(toCenter.y * 0.05, -toCenter.x * 0.04, 0.0) * tied * uRise);
  vec3 grid = aGrid + vec3(0.0, 0.0, -length(aGrid.xy) * 0.06 * uRise);

  vec3 local = mix(sc, grid, e);
  vec3 off = mix(flutter * shape, lean * shape, e);
  vec3 nrm = normalize(mix(flutter * normal, lean * normal, e));

  vec3 pAir = sc + flutter * shape;
  vec3 p = mix(pAir, (uRig * vec4(local + off, 1.0)).xyz, e);
  p = mix(p, pAir, uAmbient);
  vec3 n = normalize(mix(mix(flutter * normal, mat3(uRig) * nrm, e), flutter * normal, uAmbient));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // マウスの近くの札は、めくれるように手前へ
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dm = ndc - uMouse; dm.x *= uAspect;
  float near = smoothstep(0.3, 0.0, length(dm)) * uHover;
  float k = -mv.z * 0.1;
  mv.z += near * 0.9;
  mv.y += near * k * 0.25;

  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vSeed = aSeed.y;
  vFront = abs(normal.z);
  vTied = tied * (1.0 - uAmbient);
  vLift = near;
  vec3 L = normalize(vec3(-0.3, 0.8, 0.6));
  vShade = 0.9 + 0.1 * max(dot(n, L), 0.0);
  vFog = smoothstep(12.0, 30.0, -mv.z);
}
`;

const CARD_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uShu;
uniform vec3 uSize;
uniform float uTime;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFront;
varying float vSeed;
varying float vTied;
varying float vLift;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float w = fwidth(dEdge);
  float edge = 1.0 - smoothstep(0.02, 0.02 + w * 1.5, dEdge);

  // 和紙：生成りに、細かな繊維のむら
  vec3 washi = vec3(0.985, 0.968, 0.93);
  float fiber = hash(floor(vUv * vec2(90.0, 60.0)) + vSeed * 13.0) * 0.035 + hash(floor(vUv * vec2(14.0, 220.0))) * 0.02;
  vec3 col = washi * (vShade - fiber);

  if (vFront > 0.5) {
    // 検索結果の行：見出し（濃い）と、説明の2行（薄い）
    float lw = 0.006 + w;
    float title = step(0.12, vUv.x) * step(vUv.x, 0.12 + 0.42 + vSeed * 0.18) * (1.0 - smoothstep(0.0, lw * 3.0, abs(vUv.y - 0.7) - 0.035));
    float l1 = step(0.12, vUv.x) * step(vUv.x, 0.8) * (1.0 - smoothstep(0.0, lw * 2.0, abs(vUv.y - 0.5) - 0.018));
    float l2 = step(0.12, vUv.x) * step(vUv.x, 0.45 + vSeed * 0.3) * (1.0 - smoothstep(0.0, lw * 2.0, abs(vUv.y - 0.36) - 0.018));
    col = mix(col, uInk, title * 0.72);
    col = mix(col, vec3(0.78, 0.74, 0.67), max(l1, l2));
    // 右下の朱の印（結ばれると濃くなる）
    vec2 q = (vUv - vec2(0.84, 0.22)) * uSize.xy;
    float box = step(max(abs(q.x), abs(q.y)), 0.06);
    float inner = step(max(abs(q.x), abs(q.y)), 0.045) * (1.0 - step(max(abs(q.x), abs(q.y)), 0.035));
    vec3 seal = mix(uShu, vec3(1.0), inner * 0.85);
    col = mix(col, seal, box * mix(0.55, 1.0, vTied));
  }
  vec3 line = mix(uInk, uShu, clamp(vTied * 0.8 + vLift, 0.0, 1.0));
  line = mix(line, vec3(0.8, 0.77, 0.72), vFog);
  col = mix(col, line, edge * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** 赤い糸：札から判子へ。描き進み、糸の上を光が渡る */
const THREAD_VERT = /* glsl */ `
attribute vec3 aFrom;
attribute vec3 aCtrl;
attribute vec2 aT; // x: 糸の上の位置 0〜1, y: 遅れ
uniform float uTie;
uniform float uRise;
uniform float uTime;
uniform vec3 uPulse;
varying float vA;
varying float vGlow;
void main() {
  float t = aT.x;
  vec3 to = vec3(0.0, 0.0, uRise * 1.4);
  float u = 1.0 - t;
  vec3 p = u * u * aFrom + 2.0 * u * t * (aCtrl + vec3(0.0, 0.0, uRise * 0.6)) + t * t * to;
  float drawn = clamp((uTie - aT.y) / 0.35, 0.0, 1.0);
  vA = step(t, drawn) * smoothstep(0.0, 0.06, drawn);
  // 光：一定の間隔で、札から判子へ渡る。クリックで、全部の糸を一斉に
  float run = fract(uTime * 0.32 + aT.y * 3.7);
  float g = exp(-pow((t - run) * 14.0, 2.0)) * uRise;
  float age = uTime - uPulse.z;
  g += exp(-pow((t - age * 1.4) * 10.0, 2.0)) * step(0.0, age) * step(age, 1.2);
  vGlow = g;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const THREAD_FRAG = /* glsl */ `
uniform vec3 uShu;
uniform float uOpacity;
varying float vA;
varying float vGlow;
void main() {
  float a = vA * (0.55 + vGlow * 0.45) * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uShu, vec3(1.0, 0.82, 0.7), clamp(vGlow, 0.0, 1.0) * 0.6), a);
}
`;

/** 中央の判子（お客さまのサイト）：朱の面に、白い二重の枠 */
const SEAL_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SEAL_FRAG = /* glsl */ `
uniform vec3 uShu;
uniform float uGlow;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec3 col = uShu * (0.92 + 0.08 * vN.z);
  if (vN.z > 0.5) {
    vec2 q = abs(vUv - 0.5);
    float m = max(q.x, q.y);
    float ring = step(m, 0.42) * (1.0 - step(m, 0.36)) + step(m, 0.3) * (1.0 - step(m, 0.27));
    // 中の「縁」の代わりに、糸が結ばれた形（十字と結び目）
    float knot = (step(abs(vUv.x - 0.5), 0.025) + step(abs(vUv.y - 0.5), 0.025)) * step(m, 0.27);
    knot = clamp(knot, 0.0, 1.0) + step(length(vUv - 0.5), 0.07);
    col = mix(col, vec3(1.0, 0.97, 0.94), clamp(ring + knot, 0.0, 1.0) * 0.92);
  }
  col += uGlow * 0.18;
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

const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

export class EnScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private cardU: Record<string, { value: unknown }>;
  private threadU: Record<string, { value: unknown }>;
  private sealU: Record<string, { value: unknown }>;
  private seal: Mesh;
  private kumiko: LineBasicMaterial;
  private frame: LineBasicMaterial;
  private rings: { mesh: Mesh; u: Record<string, { value: unknown }>; offset: number }[] = [];
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private baseScale = 0.5;
  private offset = new Vector3();
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
    this.camera.position.set(0, 0.2, 16);

    const ink = new Color(o.ink);
    const shu = new Color(o.brand);
    const ambient = o.mode === 'aurora';

    // ── 札：格子の位置（中央の1マスは判子のために空ける） ──
    const cells: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!(r === 3 && c === 4)) cells.push([c, r]);
    const n = cells.length;
    const aGrid = new Float32Array(n * 3);
    const aScatter = new Float32Array(n * 3);
    const aSeed = new Float32Array(n * 4);
    cells.forEach(([c, r], i) => {
      const x = (c - (COLS - 1) / 2) * DX;
      const y = (r - (ROWS - 1) / 2) * DY;
      aGrid.set([x, y, 0], i * 3);
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
      // 中央に近い札から順に収まり、糸も近い札から結ばれる
      const d = Math.hypot(x / ((COLS * DX) / 2), y / ((ROWS * DY) / 2)) / Math.SQRT2;
      aSeed.set([Math.min(1, d * 0.75 + Math.random() * 0.25), Math.random(), Math.min(0.75, d * 0.55 + Math.random() * 0.2), Math.random()], i * 4);
    });
    const box = new BoxGeometry(1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = box.index;
    geo.setAttribute('position', box.getAttribute('position'));
    geo.setAttribute('normal', box.getAttribute('normal'));
    geo.setAttribute('uv', box.getAttribute('uv'));
    geo.setAttribute('aGrid', new InstancedBufferAttribute(aGrid, 3));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(aSeed, 4));
    geo.instanceCount = ambient ? Math.round(n * 0.5) : n;

    this.cardU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uTie: { value: 0 },
      uRise: { value: 0 },
      uAmbient: { value: ambient ? 1 : 0 },
      uScatter: { value: new Vector2(8, 5) },
      uRig: { value: new Matrix4() },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uPulse: { value: new Vector3(0, 0, -100) },
      uAspect: { value: 1 },
      uSize: { value: CARD.clone() },
      uInk: { value: ink },
      uShu: { value: shu },
    };
    const cards = new Mesh(
      geo,
      new ShaderMaterial({ uniforms: this.cardU, vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, depthTest: true, depthWrite: true }),
    );
    cards.frustumCulled = false;
    this.scene.add(cards);

    // ── 障子の格子（組子）：札のあいだの線と、太い外枠 ──
    const W = COLS * DX;
    const H = ROWS * DY;
    const lines: number[] = [];
    for (let c = 0; c <= COLS; c++) {
      const x = -W / 2 + c * DX;
      lines.push(x, -H / 2, -0.06, x, H / 2, -0.06);
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = -H / 2 + r * DY;
      lines.push(-W / 2, y, -0.06, W / 2, y, -0.06);
    }
    const lgeo = new BufferGeometry();
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(lines), 3));
    this.kumiko = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
    this.rig.add(new LineSegments(lgeo, this.kumiko));
    const f = 0.35;
    const fgeo = new BufferGeometry();
    const fw = W / 2 + f;
    const fh = H / 2 + f;
    fgeo.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([-fw, -fh, -0.08, fw, -fh, -0.08, fw, -fh, -0.08, fw, fh, -0.08, fw, fh, -0.08, -fw, fh, -0.08, -fw, fh, -0.08, -fw, -fh, -0.08]),
        3,
      ),
    );
    this.frame = new LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
    this.rig.add(new LineSegments(fgeo, this.frame));

    // ── 中央の判子 ──
    this.sealU = { uShu: { value: shu }, uGlow: { value: 0 } };
    this.seal = new Mesh(
      new BoxGeometry(0.9, 0.9, 0.24),
      new ShaderMaterial({ uniforms: this.sealU, vertexShader: SEAL_VERT, fragmentShader: SEAL_FRAG }),
    );
    this.rig.add(this.seal);

    // ── 赤い糸：札ひとつにつき1本（28分割の曲線） ──
    const SEG = 28;
    const tFrom: number[] = [];
    const tCtrl: number[] = [];
    const tT: number[] = [];
    cells.forEach(([c, r], i) => {
      const x = (c - (COLS - 1) / 2) * DX;
      const y = (r - (ROWS - 1) / 2) * DY;
      const delay = aSeed[i * 4 + 2];
      const cx = x * 0.45 + (Math.random() - 0.5) * 0.6;
      const cy = y * 0.45 - 0.5 - Math.random() * 0.6;
      const cz = 1.2 + Math.random() * 1.4;
      for (let s = 0; s < SEG; s++) {
        for (const k of [s / SEG, (s + 1) / SEG]) {
          tFrom.push(x + 0.3, y - 0.12, 0.03);
          tCtrl.push(cx, cy, cz);
          tT.push(k, delay);
        }
      }
    });
    const tgeo = new BufferGeometry();
    tgeo.setAttribute('position', new BufferAttribute(new Float32Array(tFrom.length), 3));
    tgeo.setAttribute('aFrom', new BufferAttribute(new Float32Array(tFrom), 3));
    tgeo.setAttribute('aCtrl', new BufferAttribute(new Float32Array(tCtrl), 3));
    tgeo.setAttribute('aT', new BufferAttribute(new Float32Array(tT), 2));
    this.threadU = {
      uTie: { value: 0 },
      uRise: { value: 0 },
      uTime: { value: 0 },
      uPulse: { value: new Vector3(0, 0, -100) },
      uShu: { value: shu },
      uOpacity: { value: 1 },
    };
    const threads = new LineSegments(
      tgeo,
      new ShaderMaterial({ uniforms: this.threadU, vertexShader: THREAD_VERT, fragmentShader: THREAD_FRAG, transparent: true, depthWrite: false }),
    );
    threads.frustumCulled = false;
    this.rig.add(threads);

    // ── 波紋：判子から、格子の面に沿って広がる ──
    for (let i = 0; i < 3; i++) {
      const u = { uCol: { value: shu }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.97, 1, 80),
        new ShaderMaterial({ uniforms: u, vertexShader: PLANE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
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

  /** クリック：すべての糸を、光が一斉に駆け抜ける */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    const t = this.cardU.uTime.value as number;
    (this.threadU.uPulse.value as Vector3).set(0, 0, t);
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
      this.offset.set(halfW * 0.4, -halfH * 0.04, 0);
      this.baseScale = Math.min(0.62, (halfW * 0.62) / 6.2, (halfH * 1.4) / 4.4);
    } else if (this.o.layout === 'right') {
      // スマホ：文字は下半分に来るので、格子は上の空いた場所に
      this.offset.set(0, halfH * 0.5, 0);
      this.baseScale = Math.min(0.6, (halfW * 1.7) / 6.2, (halfH * 0.7) / 4.4);
    } else {
      this.offset.set(0, 0, 0);
      this.baseScale = Math.min(0.62, (halfW * 0.9) / 6.2, (halfH * 1.4) / 4.4);
    }
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.phase;
    this.rig.position.copy(this.offset);
    this.rig.scale.setScalar(this.baseScale);
    // 少し右から見る角度で、ゆっくり揺れる。マウスで傾く
    this.rig.rotation.set(-0.1 - this.mouse.y * 0.12, -0.38 + Math.sin(t * 0.12) * 0.08 + this.mouse.x * 0.28, 0.02, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.cardU.uRig.value as Matrix4).copy(this.rig.matrixWorld);

    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const tie = sm(0.85, 1.75, ph);
    const rise = Math.min(1, Math.max(0, ph - 1));
    const stamp = sm(0.7, 1.05, ph);
    this.cardU.uTime.value = t;
    this.cardU.uPhase.value = this.o.mode === 'aurora' ? 0 : Math.min(1, ph);
    this.cardU.uTie.value = tie;
    this.cardU.uRise.value = rise;
    this.threadU.uTie.value = tie;
    this.threadU.uRise.value = rise;
    this.threadU.uTime.value = t;
    this.kumiko.opacity = 0.32 * sm(0.3, 0.95, ph);
    this.frame.opacity = 0.85 * sm(0.4, 1.0, ph);

    // 判子：押されるときは上から少し強く、成果の場面では手前に浮いて脈打つ
    const press = stamp < 1 ? 1 + (1 - stamp) * 0.6 : 1;
    this.seal.scale.setScalar(Math.max(0.001, stamp) * press * (1 + rise * 0.25 + Math.sin(t * 2.4) * 0.03 * rise));
    this.seal.position.set(0, 0, rise * 1.4);
    this.seal.rotation.set(0, 0, (1 - stamp) * 0.4);
    this.sealU.uGlow.value = rise * (0.5 + 0.5 * Math.sin(t * 2.4));
    for (const r of this.rings) {
      const k = (t * 0.28 + r.offset) % 1;
      r.mesh.position.set(0, 0, rise * 1.4 - 0.02);
      r.mesh.scale.setScalar(0.6 + k * 5.2);
      r.u.uOpacity.value = rise * (1 - k) * 0.5;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    (this.cardU.uIntro as { value: number }).value = 1;
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
    intro.value = Math.min(1, intro.value + 0.014);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    (this.cardU.uMouse.value as Vector2).copy(this.mouse);
    this.cardU.uHover.value = this.hover;
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
