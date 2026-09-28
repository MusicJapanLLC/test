import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

/**
 * 「集める → つなぐ → 決める」を点と線で描くシーン。
 *
 * 点は2つで1組（求職者＝墨の点 / 求人＝企業色の輪）。
 *  phase 0   紙の上に散らばる（集める前）
 *  phase 1   球状のネットワークに集まり、組どうしが線でつながる
 *  phase 2   組が1点に重なり、輪の上に並ぶ（決まる）。一部は赤で強調
 *
 * 位置の補間はすべて頂点シェーダーで行う。CPUは phase と時間を渡すだけ。
 * 点と線は同じジオメトリを共有する（頂点 2k と 2k+1 が1組 = LineSegments の1本）。
 */

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform vec2 uScatter;
uniform vec3 uOffset;
uniform float uScale;
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
  float spread = 1.0 + (1.0 - uIntro) * 0.9;
  vec3 a = vec3(aA.xy * uScatter * spread, aA.z * 3.0);
  a += vec3(sin(t * 0.21 + aSeed.y * 40.0), cos(t * 0.17 + aSeed.y * 31.0), sin(t * 0.13 + aSeed.y * 17.0)) * 0.24;
  vec3 b = rotY(aB, t * 0.08) * uScale + uOffset;
  b += vec3(sin(t * 0.6 + aSeed.y * 20.0), cos(t * 0.5 + aSeed.y * 13.0), 0.0) * 0.025;
  vec3 c = rotX(rotZ(aC, t * 0.05), -1.08) * uScale + uOffset;
  return mix(mix(a, b, e1), c, e2);
}
`;

const POINT_VERT = /* glsl */ `
${COMMON}
uniform float uPixel;
varying float vKind;
varying float vAccent;
varying float vE2;
varying float vAlpha;
void main() {
  float e1; float e2;
  vec3 p = place(e1, e2);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float base = aKind < 0.5 ? 2.4 : 5.4;
  base = mix(base, 6.4 + aAccent * 5.0, e2);
  gl_PointSize = base * uPixel * (16.0 / -mv.z);
  vKind = aKind;
  vAccent = aAccent;
  vE2 = e2;
  vAlpha = uIntro * (0.5 + 0.5 * aSeed.y) * smoothstep(40.0, 9.0, -mv.z);
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
void main() {
  float r = length(gl_PointCoord - 0.5);
  float dotShape = 1.0 - smoothstep(0.40, 0.5, r);
  float ringShape = smoothstep(0.27, 0.33, r) * (1.0 - smoothstep(0.43, 0.5, r));
  float matched = max(ringShape, 1.0 - smoothstep(0.12, 0.18, r));
  float shape = mix(vKind < 0.5 ? dotShape : ringShape, matched, vE2);
  vec3 col = vKind < 0.5 ? uInk : uBrand;
  col = mix(col, uBrand, vE2 * 0.55);
  col = mix(col, uRed, vAccent * vE2);
  float a = shape * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}
`;

const LINE_VERT = /* glsl */ `
${COMMON}
varying float vAlpha;
varying float vAccent;
void main() {
  float e1; float e2;
  vec3 p = place(e1, e2);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = smoothstep(0.55, 1.0, uPhase) * (1.0 - smoothstep(1.3, 1.85, uPhase));
  vAlpha = grow * uIntro * (0.16 + 0.34 * aAccent) * smoothstep(40.0, 9.0, -mv.z);
  vAccent = aAccent;
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uBrand;
uniform vec3 uRed;
varying float vAlpha;
varying float vAccent;
void main() {
  if (vAlpha < 0.004) discard;
  gl_FragColor = vec4(mix(uBrand, uRed, vAccent), vAlpha);
}
`;

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
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  phase: number;
  target: number;

  constructor(private o: SceneOptions) {
    this.phase = o.phase;
    this.target = o.phase;

    this.renderer = new WebGLRenderer({
      canvas: o.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera.position.set(0, 0, 16);

    const pairs = Math.max(60, Math.floor(o.count / 2));
    const n = pairs * 2;
    const aA = new Float32Array(n * 3);
    const aB = new Float32Array(n * 3);
    const aC = new Float32Array(n * 3);
    const aSeed = new Float32Array(n * 2);
    const aKind = new Float32Array(n);
    const aAccent = new Float32Array(n);
    const pos = new Float32Array(n * 3);
    const R = 3.0;

    for (let k = 0; k < pairs; k++) {
      const delay = Math.random();
      const accent = Math.random() < 0.075 ? 1 : 0;
      const pCand = randomUnit().multiplyScalar(R * (0.9 + Math.random() * 0.1));
      const pJob = pCand
        .clone()
        .normalize()
        .add(randomUnit().multiplyScalar(0.62))
        .normalize()
        .multiplyScalar(R * (0.9 + Math.random() * 0.1));
      const theta = (k / pairs) * Math.PI * 2 + (Math.random() - 0.5) * 0.02;
      const rr = 3.5 + (Math.random() - 0.5) * 0.26;
      const ring = new Vector3(Math.cos(theta) * rr, Math.sin(theta) * rr, (Math.random() - 0.5) * 0.18);

      for (let s = 0; s < 2; s++) {
        const i = k * 2 + s;
        aA.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
        const b = s === 0 ? pCand : pJob;
        aB.set([b.x, b.y, b.z], i * 3);
        aC.set([ring.x, ring.y, ring.z], i * 3);
        aSeed.set([delay, Math.random()], i * 2);
        aKind[i] = s;
        aAccent[i] = accent;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aA', new BufferAttribute(aA, 3));
    geo.setAttribute('aB', new BufferAttribute(aB, 3));
    geo.setAttribute('aC', new BufferAttribute(aC, 3));
    geo.setAttribute('aSeed', new BufferAttribute(aSeed, 2));
    geo.setAttribute('aKind', new BufferAttribute(aKind, 1));
    geo.setAttribute('aAccent', new BufferAttribute(aAccent, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uScatter: { value: new Vector2(8, 5) },
      uOffset: { value: new Vector3() },
      uScale: { value: 1 },
      uPixel: { value: this.renderer.getPixelRatio() },
      uInk: { value: new Color(o.ink) },
      uBrand: { value: new Color(o.brand) },
      uRed: { value: new Color(o.red) },
    };

    const common = {
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    };
    const lines = new LineSegments(
      geo,
      new ShaderMaterial({ ...common, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG }),
    );
    const points = new Points(
      geo,
      new ShaderMaterial({ ...common, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG }),
    );
    // 位置はシェーダーで決まるので、視錐台カリングは切っておく
    lines.frustumCulled = false;
    points.frustumCulled = false;
    this.group.add(lines, points);
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
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.loop();
      });
      this.loop();
    } else {
      this.render(12);
    }
    o.host.classList.add('is-ready');
  }

  private onPointer = (e: PointerEvent) => {
    this.mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
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
    const scale = Math.min(1, halfW / 4.6, halfH / 4.4);
    this.uniforms.uScale.value = scale;
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
    this.renderer.render(this.scene, this.camera);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden || !this.o.animate) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = (performance.now() - this.start) / 1000;
    const intro = this.uniforms.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.target - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.05);
    this.group.rotation.y = this.mouse.x * 0.16;
    this.group.rotation.x = this.mouse.y * 0.1;
    this.render(t);
  };
}
