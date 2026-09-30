import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
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
 * 「学ぶ → つくる → 見つけてもらう」を、立方体の建築模型で描くシーン（Central AX など mono の世界観用）。
 *
 *  phase 0   白い立方体が宙に散らばり、ゆっくり回る（学ぶ前の、ばらばらの知識）
 *  phase 1   方眼の地面の上に組み上がり、街並み（現場）になる
 *  phase 2   青い走査線が下から上へなぞり、いちばん高い塔から光の柱と波紋が立つ（AIに見つけてもらう）
 *
 * 立方体は1つのジオメトリを instancing で並べ、面は白・辺は黒をフラグメントで描く（線画の建築模型に見える）。
 * 組み上がった後の配置は「リグ」（Group）の行列で回すので、地面・光の柱・波紋も同じ動きについてくる。
 */

const CUBE_VERT = /* glsl */ `
attribute vec3 aScatter;
attribute vec3 aBuild;
attribute vec4 aSeed; // x: 遅れ, y: 乱数, z: 回転の速さ, w: 大きさ
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform vec2 uScatter;
uniform mat4 uRig;
uniform float uScanLevel;
uniform vec2 uMouse;
uniform float uHover;
uniform vec3 uRipple;
uniform float uAspect;
varying vec2 vUv;
varying float vScan;
varying float vShade;
varying float vFog;
varying float vEnergy;

mat3 rotXYZ(vec3 a) {
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

void main() {
  float d = aSeed.x;
  float e1 = smoothstep(0.0, 1.0, clamp((uPhase - d * 0.45) / 0.55, 0.0, 1.0));
  float e2 = clamp(uPhase - 1.0, 0.0, 1.0);
  float t = uTime;

  // 散らばった状態：画面いっぱいに漂い、それぞれ回る
  vec3 sc = vec3(aScatter.xy * uScatter * (1.0 + (1.0 - uIntro) * 1.2), aScatter.z * 4.0);
  sc += vec3(sin(t * 0.2 + aSeed.y * 40.0), cos(t * 0.17 + aSeed.y * 31.0), sin(t * 0.13 + aSeed.y * 17.0)) * 0.35;
  mat3 spin = rotXYZ(vec3(1.0, 1.3, 0.7) * aSeed.z * t + aSeed.y * 6.28);
  float sSize = (0.28 + aSeed.w * 0.32) * uIntro;
  vec3 pScatter = sc + spin * (position * sSize);
  vec3 nScatter = spin * normal;

  // 組み上がった状態：リグの行列で配置。走査線が通ると少し浮く
  float scan = e2 * exp(-pow((aBuild.y - uScanLevel) * 1.5, 2.0));
  vec3 local = aBuild + vec3(0.0, scan * 0.35, 0.0) + position * 0.9;
  vec3 pBuild = (uRig * vec4(local, 1.0)).xyz;
  vec3 nBuild = normalize(mat3(uRig) * normal);

  vec3 p = mix(pScatter, pBuild, e1);
  vec3 n = normalize(mix(nScatter, nBuild, e1));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // マウスから逃げる ＋ クリックの波
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dm = ndc - uMouse; dm.x *= uAspect;
  float r = length(dm);
  float push = smoothstep(0.38, 0.0, r) * uHover;
  float age = uTime - uRipple.z;
  vec2 dr = ndc - uRipple.xy; dr.x *= uAspect;
  float wave = exp(-pow((length(dr) - age * 1.0) * 6.0, 2.0)) * exp(-age * 1.2) * step(0.0, age);
  float k = -mv.z * 0.1;
  mv.xy += (r > 0.0001 ? dm / r : vec2(0.0)) * push * k * 0.9;
  mv.y += wave * k * 1.4;

  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vScan = max(scan, wave * 0.8);
  vEnergy = push;
  vec3 L = normalize(vec3(0.35, 1.0, 0.55));
  vShade = 0.86 + 0.14 * max(dot(n, L), 0.0);
  vFog = smoothstep(9.0, 26.0, -mv.z);
}
`;

const CUBE_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uSignal;
varying vec2 vUv;
varying float vScan;
varying float vShade;
varying float vFog;
varying float vEnergy;
void main() {
  float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float w = fwidth(dEdge);
  float edge = 1.0 - smoothstep(0.02, 0.02 + w * 1.5, dEdge);
  vec3 face = vec3(vShade);
  face = mix(face, mix(vec3(1.0), uSignal, 0.22), clamp(vScan, 0.0, 1.0));
  vec3 line = mix(uInk, uSignal, clamp(vScan + vEnergy * 0.6, 0.0, 1.0));
  line = mix(line, vec3(0.78), vFog);
  gl_FragColor = vec4(mix(face, line, edge), 1.0);
}
`;

const FLOOR_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FLOOR_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uOpacity;
varying vec2 vP;
void main() {
  vec2 g = abs(fract(vP) - 0.5);
  float fw = fwidth(vP.x) * 1.2;
  float line = 1.0 - smoothstep(0.5 - fw, 0.5, max(g.x, g.y));
  vec2 g5 = abs(fract(vP / 4.0) - 0.5);
  float major = 1.0 - smoothstep(0.5 - fw * 0.25, 0.5, max(g5.x, g5.y));
  float fade = 1.0 - smoothstep(6.0, 12.0, length(vP));
  // 手前で線が細かく詰まりすぎると面のように潰れるので、その場所は消す
  float dense = 1.0 - smoothstep(0.06, 0.22, fw);
  float a = (line * 0.16 + major * 0.18) * fade * dense * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uInk, a);
}
`;

const BEAM_VERT = /* glsl */ `
varying float vY;
void main() {
  vY = position.y + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uSignal;
uniform float uOpacity;
uniform float uTime;
varying float vY;
void main() {
  float flicker = 0.85 + 0.15 * sin(uTime * 9.0 + vY * 20.0);
  float a = (1.0 - vY) * uOpacity * flicker;
  gl_FragColor = vec4(uSignal, a * 0.8);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uSignal;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uSignal, uOpacity); }
`;

/** 街並みの高さ。なめらかな起伏に、ばらつきを少し */
function heightAt(x: number, z: number, W: number, D: number): number {
  const nx = x / W;
  const nz = z / D;
  const h = 2.2 + Math.sin(nx * 5.1 + 0.6) * 1.3 + Math.cos(nz * 4.3 + 1.1) * 1.1 + (Math.random() - 0.5) * 1.6;
  return Math.max(1, Math.min(6, Math.round(h)));
}

export class LatticeScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private cubeU: Record<string, { value: unknown }>;
  private floorU: Record<string, { value: unknown }>;
  private beamU: Record<string, { value: unknown }>;
  private rings: { mesh: Mesh; u: Record<string, { value: unknown }>; offset: number }[] = [];
  private towerTop = new Vector3();
  private maxH = 6;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private hover = 0;
  private hoverTarget = 0;
  private baseScale = 0.45;
  private offset = new Vector3();
  phase: number;
  target: number;

  constructor(private o: SceneOptions) {
    this.phase = o.phase;
    this.target = o.phase;
    this.renderer = new WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera.position.set(0, 0.6, 16);

    const ink = new Color(o.ink);
    const signal = new Color(o.brand);
    const small = window.matchMedia('(max-width: 767px)').matches;
    const ambient = o.mode === 'aurora';

    // ── 街並みの配置 ──
    const W = small ? 10 : 14;
    const D = small ? 7 : 9;
    const build: number[] = [];
    let tallest = { x: 0, z: 0, h: 0 };
    const tx = Math.round(W * 0.68);
    const tz = Math.round(D * 0.4);
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        // 1本だけ高い塔（光の柱が立つ場所）
        const h = x === tx && z === tz ? 9 : heightAt(x, z, W, D);
        for (let y = 0; y < h; y++) build.push(x - W / 2 + 0.5, y + 0.5, z - D / 2 + 0.5);
        if (h > tallest.h) tallest = { x: x - W / 2 + 0.5, z: z - D / 2 + 0.5, h };
      }
    }
    this.maxH = tallest.h;
    this.towerTop.set(tallest.x, tallest.h, tallest.z);
    let n = build.length / 3;
    if (ambient) n = small ? 40 : 90;

    const aScatter = new Float32Array(n * 3);
    const aBuild = new Float32Array(n * 3);
    const aSeed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
      aBuild.set([build[i * 3] ?? 0, build[i * 3 + 1] ?? 0, build[i * 3 + 2] ?? 0], i * 3);
      // 下の段から順に組み上がるよう、高さで遅れをつける
      const y = build[i * 3 + 1] ?? 0;
      aSeed.set([Math.min(1, (y / this.maxH) * 0.7 + Math.random() * 0.3), Math.random(), 0.2 + Math.random() * 0.5, Math.random()], i * 4);
    }
    const box = new BoxGeometry(1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = box.index;
    geo.setAttribute('position', box.getAttribute('position'));
    geo.setAttribute('normal', box.getAttribute('normal'));
    geo.setAttribute('uv', box.getAttribute('uv'));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aBuild', new InstancedBufferAttribute(aBuild, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(aSeed, 4));
    geo.instanceCount = n;

    this.cubeU = {
      uTime: { value: 0 },
      uPhase: { value: ambient ? 0 : this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uScatter: { value: new Vector2(8, 5) },
      uRig: { value: new Matrix4() },
      uScanLevel: { value: -10 },
      uMouse: { value: new Vector2(9, 9) },
      uHover: { value: 0 },
      uRipple: { value: new Vector3(0, 0, -100) },
      uAspect: { value: 1 },
      uInk: { value: ink },
      uSignal: { value: signal },
    };
    const cubes = new Mesh(
      geo,
      new ShaderMaterial({ uniforms: this.cubeU, vertexShader: CUBE_VERT, fragmentShader: CUBE_FRAG, depthTest: true, depthWrite: true }),
    );
    cubes.frustumCulled = false;
    this.scene.add(cubes);

    // ── リグ：地面の方眼・光の柱・波紋 ──
    this.floorU = { uInk: { value: ink }, uOpacity: { value: 0 } };
    const floor = new Mesh(
      new PlaneGeometry(26, 26, 1, 1),
      new ShaderMaterial({
        uniforms: this.floorU,
        vertexShader: FLOOR_VERT,
        fragmentShader: FLOOR_FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    this.rig.add(floor);

    this.beamU = { uSignal: { value: signal }, uOpacity: { value: 0 }, uTime: { value: 0 } };
    const beam = new Mesh(
      new CylinderGeometry(0.16, 0.16, 1, 20, 1, true),
      new ShaderMaterial({ uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    beam.scale.set(1, 14, 1);
    beam.position.set(tallest.x, tallest.h + 7, tallest.z);
    this.rig.add(beam);

    for (let i = 0; i < 3; i++) {
      const u = { uSignal: { value: signal }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.92, 1, 64),
        new ShaderMaterial({ uniforms: u, vertexShader: FLOOR_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
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
      this.render(8);
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

  private onDown = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    (this.cubeU.uRipple.value as Vector3).set(x, y, this.cubeU.uTime.value as number);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    (this.cubeU.uScatter.value as Vector2).set(halfW * 1.02, halfH * 1.02);
    this.cubeU.uAspect.value = this.camera.aspect;
    this.baseScale = Math.min(0.46, (halfW * 0.9) / 8.5, (halfH * 1.1) / 8);
    const wide = this.o.layout === 'right' && this.camera.aspect > 1.15;
    if (wide) this.offset.set(halfW * 0.4, -halfH * 0.35, 0);
    // スマホ：文字は画面の下半分に来るので、模型は上の空いた場所に置く
    else if (this.o.layout === 'right') this.offset.set(0, halfH * 0.28, 0);
    else this.offset.set(0, -halfH * 0.4, 0);
    if (!this.o.animate) this.render(8);
  }

  private render(t: number) {
    const ph = this.phase;
    // リグ：斜め上から見下ろす角度で、ゆっくり回る。マウスで少し振れる
    this.rig.position.copy(this.offset);
    this.rig.scale.setScalar(this.baseScale);
    this.rig.rotation.set(0.5 - this.mouse.y * 0.12, t * 0.07 + this.mouse.x * 0.45 - 0.6, 0, 'XYZ');
    this.rig.updateMatrixWorld(true);
    (this.cubeU.uRig.value as Matrix4).copy(this.rig.matrixWorld);

    const e1 = Math.min(1, Math.max(0, ph));
    const e2 = Math.min(1, Math.max(0, ph - 1));
    this.cubeU.uTime.value = t;
    this.cubeU.uPhase.value = this.o.mode === 'aurora' ? 0 : ph;
    // 走査線：下から上へ、くり返しなぞる
    this.cubeU.uScanLevel.value = ((t * 2.2) % (this.maxH + 4)) - 2;
    this.floorU.uOpacity.value = e1;
    this.beamU.uOpacity.value = e2;
    this.beamU.uTime.value = t;
    for (const r of this.rings) {
      const k = (t * 0.35 + r.offset) % 1;
      r.mesh.position.set(this.towerTop.x, this.towerTop.y + k * 5, this.towerTop.z);
      r.mesh.scale.setScalar(0.6 + k * 2.4);
      r.u.uOpacity.value = e2 * (1 - k) * 0.7;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden || !this.o.animate) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = (performance.now() - this.start) / 1000;
    const intro = this.cubeU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.target - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.07);
    this.hover += (this.hoverTarget - this.hover) * 0.06;
    (this.cubeU.uMouse.value as Vector2).copy(this.mouse);
    this.cubeU.uHover.value = this.hover;
    this.render(t);
  };
}
