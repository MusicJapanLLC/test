import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「レコード」のシーン（Music Japan の needle の世界観用）。
 * 公式サイト（music-japan.com）の NEEDLE DROP と同じ盤：公式シンボルを印刷した赤いレーベル、溝の光沢、トーンアーム。
 * 公式サイトのブルームなどの後処理は使わず、盤1枚・アーム・粒・ジャケットだけで描く（軽さを優先）。
 *
 *  phase 0.55  斜めに置かれた盤が回り、針が乗っている（ヒーロー）
 *  phase 0.8   CUT：盤が正面を向き、赤く光るカッティングの線が外から内へ溝を刻む（専用LPをつくる）
 *  phase 1     SPIN：盤が速く回り、掲載企業のジャケットが周りを回る（検索とAIで回る）
 *  phase 2     DROP：盤が寝て、針が落ちる。赤い輪が広がり、粒が盤を囲む波形になる（話がつながる）
 *
 * マウスで少し傾き、クリック（タップ）すると盤をこすったように速く回る。
 */

type Pose = { x: number; y: number; scale: number; tilt: number; roll: number; orbit: number; wave: number; arm: number; spin: number; cutting: number; fade: number };

const POSES: Record<'inner' | 'hero' | 'cut' | 'spin' | 'drop' | 'cta' | 'center', Pose> = {
  inner: { x: 0.0, y: 0.0, scale: 0.62, tilt: -0.72, roll: 0.25, orbit: 0, wave: 0, arm: 0, spin: 0.7, cutting: 0, fade: 1 },
  hero: { x: 0.46, y: -0.02, scale: 0.6, tilt: -0.62, roll: 0.18, orbit: 0, wave: 0, arm: 1, spin: 1, cutting: 0, fade: 1 },
  cut: { x: 0.44, y: 0.0, scale: 0.52, tilt: -0.16, roll: 0.05, orbit: 0, wave: 0, arm: 0, spin: 0.35, cutting: 1, fade: 1 },
  spin: { x: 0.44, y: 0.0, scale: 0.4, tilt: -0.1, roll: 0, orbit: 1, wave: 0, arm: 0, spin: 2.6, cutting: 0, fade: 1 },
  drop: { x: 0.46, y: -0.04, scale: 0.5, tilt: -1.08, roll: 0.1, orbit: 0, wave: 1, arm: 1, spin: 0.9, cutting: 0, fade: 1 },
  cta: { x: 0.5, y: -0.08, scale: 0.78, tilt: -1.12, roll: 0, orbit: 0, wave: 1, arm: 0, spin: 1.2, cutting: 0, fade: 0.7 },
  center: { x: 0.0, y: 0.0, scale: 0.62, tilt: -0.6, roll: 0.2, orbit: 0, wave: 0, arm: 1, spin: 1, cutting: 0, fade: 1 },
};
const KEYS = Object.keys(POSES.hero) as (keyof Pose)[];
const mix = (a: Pose, b: Pose, k: number): Pose => {
  const o = { ...a };
  for (const key of KEYS) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
};
const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

const RECORD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** 公式サイトの盤のシェーダー（溝・2本の光の帯・虹色・レーベル・カッティングの線）を、後処理なしで見えるよう少し明るく */
const RECORD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uSpin, uCut, uKick, uFade;
uniform vec3 uAccent;
uniform sampler2D uLabel;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float aw = a + uSpin;
  vec3 col;
  float emis = 0.0;
  if (r < 0.34) {
    vec2 luv = p / 0.34 * 0.5 + 0.5;
    col = texture2D(uLabel, luv).rgb;
    col *= 0.9 + 0.1 * cos(aw * 2.0);
    col += uAccent * uKick * 0.2;
    if (r < 0.024) col = vec3(0.02);
    else if (r < 0.034) col = vec3(0.62);
  } else {
    float cutR = mix(0.99, 0.36, uCut);
    float grooved = step(cutR, r);
    float g = 0.5 + 0.5 * sin(r * 1400.0);
    float tracks = 1.0 - 0.75 * (smoothstep(0.004, 0.0, abs(r - 0.52)) + smoothstep(0.004, 0.0, abs(r - 0.66)) + smoothstep(0.004, 0.0, abs(r - 0.8)) + smoothstep(0.004, 0.0, abs(r - 0.92)));
    float micro = hash(vec2(floor(r * 900.0), 1.0)) * 0.35;
    vec3 base = vec3(0.034, 0.034, 0.04);
    float wedge = pow(abs(cos(aw - 0.9)), 22.0) + 0.6 * pow(abs(cos(aw + 1.1)), 50.0);
    float sheen = wedge * (0.35 + 0.65 * g) * tracks;
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (r * 1.6 + vec3(0.0, 0.33, 0.67)));
    vec3 grooveCol = base + sheen * mix(vec3(0.9), irid, 0.4) * 0.75 + micro * 0.014;
    vec3 lacquer = base * 1.5 + pow(abs(cos(aw - 0.9)), 8.0) * 0.16;
    col = mix(lacquer, grooveCol * tracks, grooved);
    float head = smoothstep(0.012, 0.0, abs(r - cutR)) * step(0.001, uCut) * step(uCut, 0.999);
    emis += head * 2.2;
    emis += uKick * 0.22 * grooved * g;
    col += smoothstep(0.975, 1.0, r) * 0.22;
  }
  col += uAccent * emis;
  gl_FragColor = vec4(col * uFade, uFade);
}`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uKick, uFade;
uniform vec3 uAccent;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float ring = smoothstep(0.62, 0.745, r) * smoothstep(1.0, 0.745, r);
  float halo = smoothstep(1.0, 0.72, r) * 0.25;
  float a = (ring * (0.22 + uKick * 1.3) + halo * (0.12 + uKick * 0.5)) * uFade;
  gl_FragColor = vec4(uAccent * a, a);
}`;

/** 粒：盤のまわりを漂う → 盤を囲む円い波形になる（公式サイトと同じ考え方。音の代わりに時間で揺らす） */
const POINTS_VERT = /* glsl */ `
attribute float aSeed; attribute float aAngle; attribute float aRed;
uniform float uTime, uWave, uKick, uPx, uFade;
varying float vAlpha; varying float vRed;
void main(){
  vec3 dust = position;
  dust.x += sin(uTime * 0.12 + aSeed * 30.0) * 0.12;
  dust.y += cos(uTime * 0.1 + aSeed * 20.0) * 0.12;
  float k = floor(aSeed * 3.0) + 5.0;
  float amp = 0.07 + uKick * 0.35 + 0.05 * sin(uTime * 2.3);
  float rr = 1.18 + sin(aAngle * k + uTime * 1.8) * amp * (0.6 + 0.4 * sin(uTime + aSeed * 6.0)) + (aSeed - 0.5) * 0.08;
  vec3 ring = vec3(cos(aAngle) * rr, sin(aAngle) * rr, (aSeed - 0.5) * 0.05);
  vec3 pos = mix(dust, ring, uWave);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(1.4, 2.6, aSeed) * uPx * (4.0 / -mv.z);
  vAlpha = mix(0.3, 0.95, uWave) * uFade * (0.5 + 0.5 * aSeed);
  vRed = aRed;
}`;
const POINTS_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha; varying float vRed;
uniform vec3 uAccent, uDust;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(mix(uDust, uAccent * 1.5, vRed) * a, a);
}`;

/** レーベル：赤地に公式シンボル（左半分は濃く、右半分は薄い溝・赤い波）と、MUSIC JAPAN / BATON PARTNERS の文字 */
function drawLabel(canvas: HTMLCanvasElement) {
  const s = canvas.width;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, s, s);
  const c = s / 2;
  const grad = g.createRadialGradient(c, c * 0.8, s * 0.05, c, c, s * 0.5);
  grad.addColorStop(0, '#ef2d3a');
  grad.addColorStop(0.75, '#b3101c');
  grad.addColorStop(1, '#6e0a14');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(0,0,0,.22)';
  for (const r of [0.47, 0.44]) {
    g.lineWidth = s * 0.004;
    g.beginPath();
    g.arc(c, c, s * r, 0, Math.PI * 2);
    g.stroke();
  }
  g.save();
  g.translate(c, c * 0.93);
  const k = (s / 64) * 0.34;
  g.scale(k, k);
  g.translate(-32, -32);
  g.strokeStyle = '#f3ede4';
  for (const [i, r] of [27, 23.6, 20.2, 16.8, 13.4, 10].entries()) {
    g.lineWidth = 2 - i * 0.1;
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(32, 32, r, Math.PI / 2, Math.PI * 1.5);
    g.stroke();
    g.globalAlpha = 0.55;
    g.beginPath();
    g.arc(32, 32, r, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.lineWidth = 1.6;
  g.stroke(new Path2D('M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6'));
  g.restore();
  g.fillStyle = '#f3ede4';
  g.textAlign = 'center';
  g.font = `800 ${s * 0.064}px "Archivo Variable", Archivo, "Helvetica Neue", Arial, sans-serif`;
  g.fillText('MUSIC JAPAN', c, s * 0.77);
  g.font = `500 ${s * 0.03}px "JetBrains Mono Variable", "JetBrains Mono", monospace`;
  g.globalAlpha = 0.85;
  g.fillText('BATON PARTNERS  ·  BP-000', c, s * 0.84);
  g.globalAlpha = 1;
  g.font = `500 ${s * 0.028}px "JetBrains Mono Variable", "JetBrains Mono", monospace`;
  const text = 'PAGES · SEARCH · AIO · CONNECTIONS · FROM JAPAN · ';
  const R = s * 0.405;
  for (let i = 0; i < text.length; i++) {
    const ang = -Math.PI * 0.92 + (i / text.length) * Math.PI * 0.84;
    g.save();
    g.translate(c + Math.cos(ang) * R, c + Math.sin(ang) * R);
    g.rotate(ang + Math.PI / 2);
    g.fillText(text[i], 0, 0);
    g.restore();
  }
}

/** ジャケット：掲載企業の白抜きロゴ、または公式サイトのジャケット写真 */
const SLEEVES: { img: string; tint: string; label: string; kind: 'logo' | 'photo' }[] = [
  { img: '/partners/evorg/logo-light.png', tint: '#e83c4f', label: 'BP-001', kind: 'logo' },
  { img: '/partners/music-japan/jackets/tokyo-junkies.webp', tint: '#e1222f', label: 'MJ-001', kind: 'photo' },
  { img: '/partners/central-ax/logo-white.png', tint: '#6a7080', label: 'BP-002', kind: 'logo' },
  { img: '/partners/music-japan/jackets/beach-sunset.webp', tint: '#e1222f', label: 'MJ-003', kind: 'photo' },
  { img: '/partners/smartaleck/logo-light.png', tint: '#1f92ca', label: 'BP-005', kind: 'logo' },
  { img: '/partners/music-japan/jackets/late-night-jazz.webp', tint: '#e1222f', label: 'MJ-007', kind: 'photo' },
];

function sleeveTexture(sl: (typeof SLEEVES)[number]): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const paint = (img?: HTMLImageElement) => {
    g.fillStyle = '#121216';
    g.fillRect(0, 0, 256, 256);
    if (img && sl.kind === 'photo') {
      g.drawImage(img, 0, 0, 256, 256);
    } else {
      const gr = g.createLinearGradient(0, 0, 256, 256);
      gr.addColorStop(0, `${sl.tint}66`);
      gr.addColorStop(1, '#0c0c0f');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
      if (img) {
        const w = 190;
        const h = (img.height / img.width) * w;
        g.drawImage(img, (256 - w) / 2, 128 - h / 2, w, h);
      }
      g.fillStyle = 'rgba(239,233,224,.85)';
      g.font = '600 15px "JetBrains Mono Variable", "JetBrains Mono", monospace';
      g.fillText(sl.label, 16, 30);
    }
    g.strokeStyle = 'rgba(239,233,224,.18)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 253, 253);
  };
  paint();
  const tex = new CanvasTexture(cv);
  tex.colorSpace = NoColorSpace;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    paint(img);
    tex.needsUpdate = true;
  };
  img.src = sl.img;
  return tex;
}

export class VinylScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 50);
  private rig = new Group();
  private disc: Mesh;
  private recordU: Record<string, { value: unknown }>;
  private glowU: Record<string, { value: unknown }>;
  private pointsU: Record<string, { value: unknown }>;
  private arm = new Group();
  private sleeves: Mesh[] = [];
  private rings: { mesh: Mesh; mat: MeshBasicMaterial; at: number }[] = [];
  private labelCanvas = document.createElement('canvas');
  private labelTex: CanvasTexture;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private last = performance.now();
  private angle = 0;
  private boost = 0;
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private dist = 1 / Math.tan((35 * Math.PI) / 360);
  private wide = true;
  private dropped = false;
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
    this.phase = o.animate ? o.phase : Math.max(o.phase, 0.55);
    this.goal = this.phase;
    this.renderer = new WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    onPerfLevel((l) => {
      if (l === 1) {
        this.renderer.setPixelRatio(1);
        this.resize();
      } else if (l === 2) {
        cancelAnimationFrame(this.raf);
        this.still();
      }
    });

    const accent = new Color(o.brand);
    const dust = new Color(o.ink);

    this.labelCanvas.width = this.labelCanvas.height = 1024;
    drawLabel(this.labelCanvas);
    this.labelTex = new CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = NoColorSpace;
    this.labelTex.anisotropy = 4;
    document.fonts?.ready.then(() => {
      drawLabel(this.labelCanvas);
      this.labelTex.needsUpdate = true;
    });

    this.recordU = {
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uCut: { value: 1 },
      uKick: { value: 0 },
      uFade: { value: 1 },
      uAccent: { value: accent },
      uLabel: { value: this.labelTex },
    };
    this.disc = new Mesh(
      new CircleGeometry(1, 160),
      new ShaderMaterial({ uniforms: this.recordU, vertexShader: RECORD_VERT, fragmentShader: RECORD_FRAG, transparent: true }),
    );
    this.glowU = { uKick: { value: 0 }, uFade: { value: 1 }, uAccent: { value: accent } };
    const glow = new Mesh(
      new PlaneGeometry(2.6, 2.6),
      new ShaderMaterial({ uniforms: this.glowU, vertexShader: RECORD_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    );
    glow.position.z = -0.02;
    this.rig.add(glow, this.disc);

    // トーンアーム：台座・腕・ヘッド（盤と一緒に傾く）
    const metal = new MeshBasicMaterial({ color: 0xb9b3ab });
    const dark = new MeshBasicMaterial({ color: 0x1b1b20 });
    const base = new Mesh(new CylinderGeometry(0.11, 0.13, 0.08, 32), dark);
    base.rotation.x = Math.PI / 2;
    const ring = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 24), metal);
    ring.rotation.x = Math.PI / 2;
    const rod = new Mesh(new BoxGeometry(0.03, 1.02, 0.03), metal);
    rod.position.set(0, -0.5, 0.06);
    const head = new Mesh(new BoxGeometry(0.1, 0.16, 0.05), dark);
    head.position.set(0, -1.04, 0.07);
    const tip = new Mesh(new BoxGeometry(0.02, 0.05, 0.02), new MeshBasicMaterial({ color: accent }));
    tip.position.set(0, -1.1, 0.04);
    this.arm.add(base, ring, rod, head, tip);
    this.arm.position.set(1.16, 0.88, 0.04);
    this.rig.add(this.arm);

    // 粒
    const n = this.ambient ? 260 : o.count > 1500 ? 700 : 360;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const ang = new Float32Array(n);
    const red = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 1.1 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r * 1.4, Math.sin(a) * r, (Math.random() - 0.5) * 0.6], i * 3);
      seed[i] = Math.random();
      ang[i] = Math.random() * Math.PI * 2;
      red[i] = Math.random() < 0.18 ? 1 : 0;
    }
    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(pos, 3));
    pg.setAttribute('aSeed', new BufferAttribute(seed, 1));
    pg.setAttribute('aAngle', new BufferAttribute(ang, 1));
    pg.setAttribute('aRed', new BufferAttribute(red, 1));
    this.pointsU = { uTime: { value: 0 }, uWave: { value: 0 }, uKick: { value: 0 }, uPx: { value: 2 }, uFade: { value: 1 }, uAccent: { value: accent }, uDust: { value: dust } };
    const points = new Points(pg, new ShaderMaterial({ uniforms: this.pointsU, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    points.frustumCulled = false;
    this.rig.add(points);

    // ジャケット（SPINで盤のまわりを回る）。ステージのときだけ用意する
    if (!this.ambient && o.layout === 'right') {
      const geo = new PlaneGeometry(0.62, 0.62);
      for (const sl of SLEEVES) {
        const m = new Mesh(geo, new MeshBasicMaterial({ map: sleeveTexture(sl), transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
        this.sleeves.push(m);
        this.scene.add(m);
      }
    }

    // 針が落ちた瞬間・クリックで広がる赤い輪（盤の面に沿う）
    for (let i = 0; i < 2; i++) {
      const mat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
      const mesh = new Mesh(new RingGeometry(0.985, 1, 128), mat);
      mesh.position.z = 0.01;
      this.rig.add(mesh);
      this.rings.push({ mesh, mat, at: -100 });
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
      this.render(4);
    }
    o.host.classList.add('is-ready');
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
    this.mouseTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };

  /** クリック：盤をこすったように速く回り、赤い輪が広がる */
  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    this.boost = 9;
    this.pulse(1, (performance.now() - this.start) / 1000);
  };

  private pulse(i: number, t: number) {
    this.rings[i].at = t;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.wide = this.camera.aspect > 1.15;
    const px = Math.max(1.6, Math.min(3, h / 300)) * Math.min(window.devicePixelRatio || 1, 1.5);
    this.pointsU.uPx.value = px;
    if (!this.o.animate) this.render(4);
  }

  /** phase から、盤の姿勢を決める */
  private pose(ph: number): Pose {
    if (this.ambient) return POSES.cta;
    if (this.o.layout !== 'right') {
      // 下層のヒーロー・看板の帯：中央に。phase が進むほど、寝て波形になる
      if (ph < 1.5) return mix(POSES.center, POSES.inner, ease((ph - 0.4) / 0.6));
      return { ...POSES.drop, x: 0, y: 0, scale: 0.6 };
    }
    if (ph <= 0.55) return POSES.hero;
    if (ph <= 0.8) return mix(POSES.hero, POSES.cut, ease((ph - 0.55) / 0.25));
    if (ph <= 1) return mix(POSES.cut, POSES.spin, ease((ph - 0.8) / 0.2));
    return mix(POSES.spin, POSES.drop, ease(ph - 1));
  }

  private render(t: number, dt = 0) {
    let P = this.pose(this.phase);
    const aspect = this.camera.aspect;
    // スマホ（縦長）のステージ：盤は上の空いたところに
    if (this.o.layout === 'right' && !this.wide && !this.ambient) P = { ...P, x: 0.22, y: 0.5, scale: Math.min(P.scale, 0.3) };
    if (this.ambient && !this.wide) P = { ...P, x: 0.1, y: 0.42, scale: 0.42 };

    this.rig.position.set(P.x * aspect, P.y, 0);
    this.rig.scale.setScalar(P.scale);
    this.rig.rotation.set(P.tilt + this.mouse.y * 0.12, this.mouse.x * 0.18 + P.roll * 0.6, P.roll * 0.3, 'XYZ');

    this.angle += dt * (0.55 * P.spin + this.boost);
    this.boost *= Math.pow(0.04, dt);
    this.disc.rotation.z = -this.angle;
    this.recordU.uSpin.value = this.angle;
    this.recordU.uTime.value = t;
    // CUT：カッティングの線が外から内へ、繰り返し溝を刻む
    const cycle = (t * 0.2) % 1;
    this.recordU.uCut.value = 1 - P.cutting + P.cutting * ease(cycle * 1.15);

    // 針：ヒーローとDROPでは盤の上に、それ以外は外に置く
    this.arm.rotation.z = -0.32 - P.arm * 0.36;
    const drop = P.wave > 0.85 && P.arm > 0.85;
    if (drop && !this.dropped) this.pulse(0, t);
    this.dropped = drop;

    const kick = Math.max(0, ...this.rings.map((r) => Math.max(0, 1 - (t - r.at) / 1.2))) * 0.9 + Math.min(1, this.boost / 9) * 0.4;
    this.recordU.uKick.value = kick;
    this.glowU.uKick.value = kick;
    this.recordU.uFade.value = P.fade;
    this.glowU.uFade.value = P.fade;
    this.pointsU.uTime.value = t;
    this.pointsU.uWave.value = P.wave;
    this.pointsU.uKick.value = kick;
    this.pointsU.uFade.value = P.fade;

    for (const r of this.rings) {
      const age = t - r.at;
      const k = Math.min(1, Math.max(0, age / 1.4));
      r.mat.opacity = age >= 0 && age < 1.4 ? (1 - k) * 0.85 : 0;
      r.mesh.scale.setScalar(1 + k * 0.9);
    }

    // ジャケット：盤のまわりの楕円を回る
    if (this.sleeves.length) {
      const R = P.scale * 1.75;
      this.sleeves.forEach((m, i) => {
        const a = this.angle * 0.35 + (i / this.sleeves.length) * Math.PI * 2;
        m.position.set(P.x * aspect + Math.cos(a) * R * 1.15, P.y + Math.sin(a) * R * 0.55, Math.sin(a) * 0.3);
        m.scale.setScalar(P.scale * 1.1 * (0.85 + 0.15 * Math.sin(a)));
        m.rotation.set(0, Math.cos(a) * 0.5, Math.sin(a) * 0.08);
        (m.material as MeshBasicMaterial).opacity = P.orbit;
        m.visible = P.orbit > 0.01;
      });
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    this.phase = this.goal;
    this.render(4);
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
    this.phase += (this.goal - this.phase) * 0.07;
    this.mouse.lerp(this.mouseTarget, 0.06);
    this.render(t, dt);
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
