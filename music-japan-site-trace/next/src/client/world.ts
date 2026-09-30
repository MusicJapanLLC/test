import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { bus, sample } from './bus';
import { clamp, damp, lerp, small } from './env';

/**
 * THE RECORD. One fixed WebGL layer behind every page: the official Music Japan symbol
 * becomes a vinyl record. Sections set a target "state"; the record eases towards it.
 */

export type WorldState = {
  x: number; // in viewport half-widths (−1 left edge … 1 right edge)
  y: number; // in viewport half-heights
  scale: number; // record radius as a fraction of viewport height
  tilt: number; // rotation around X (0 = facing camera, −1.2 = lying flat)
  roll: number;
  cut: number; // 0 = blank lacquer, 1 = fully grooved
  orbit: number; // sleeves circling the record
  wave: number; // particles form a circular waveform
  arm: number; // 0 = tonearm resting, 1 = needle on the record
  fade: number; // overall visibility
  spin: number; // rotation speed multiplier
};

export const STATES: Record<string, WorldState> = {
  intro: { x: 0, y: 0, scale: 0.05, tilt: -1.45, roll: 0.6, cut: 0, orbit: 0, wave: 0, arm: 0, fade: 0, spin: 0 },
  hero: { x: 0.44, y: -0.02, scale: 0.54, tilt: -0.62, roll: 0.18, cut: 1, orbit: 0, wave: 0, arm: 1, fade: 1, spin: 1 },
  cut: { x: 0.42, y: 0, scale: 0.46, tilt: -0.18, roll: 0.05, cut: 0, orbit: 0, wave: 0, arm: 0, fade: 1, spin: 0.35 },
  spin: { x: 0.4, y: 0, scale: 0.34, tilt: -0.08, roll: 0, cut: 1, orbit: 1, wave: 0, arm: 0, fade: 1, spin: 2.4 },
  voice: { x: 0.56, y: -0.08, scale: 0.28, tilt: -1.08, roll: 0.1, cut: 1, orbit: 0, wave: 1, arm: 0, fade: 1, spin: 0.8 },
  ambient: { x: 0.82, y: 0.66, scale: 0.26, tilt: -0.5, roll: 0.3, cut: 1, orbit: 0, wave: 0, arm: 0, fade: 0.26, spin: 0.6 },
  crate: { x: -1.02, y: 0.78, scale: 0.3, tilt: -0.3, roll: -0.2, cut: 1, orbit: 0, wave: 0, arm: 0, fade: 0.16, spin: 0.9 },
  cta: { x: 0, y: -0.05, scale: 0.62, tilt: -1.12, roll: 0, cut: 1, orbit: 0, wave: 1, arm: 0, fade: 0.55, spin: 1.2 },
  'inner-hero': { x: 0.6, y: 0.18, scale: 0.42, tilt: -0.72, roll: 0.25, cut: 1, orbit: 0, wave: 0, arm: 0, fade: 0.9, spin: 0.7 },
  portrait: { x: -0.5, y: 0.02, scale: 0.46, tilt: -0.35, roll: -0.2, cut: 1, orbit: 0, wave: 0, arm: 0, fade: 0.95, spin: 0.7 },
};

const MOBILE: Partial<Record<string, Partial<WorldState>>> = {
  hero: { x: 0.34, y: -0.34, scale: 0.3, tilt: -0.55 },
  cut: { x: 0.1, y: -0.42, scale: 0.26 },
  spin: { x: 0.05, y: -0.42, scale: 0.19 },
  voice: { x: 0.05, y: -0.4, scale: 0.22 },
  ambient: { x: 0.78, y: 0.8, scale: 0.2, fade: 0.2 },
  crate: { x: -0.9, y: 0.85, scale: 0.2, fade: 0.14 },
  cta: { x: 0, y: -0.25, scale: 0.4 },
  'inner-hero': { x: 0.5, y: -0.46, scale: 0.26, fade: 0.7 },
  portrait: { x: 0.3, y: -0.5, scale: 0.28, fade: 0.8 },
};

const KEYS = Object.keys(STATES.hero) as (keyof WorldState)[];

const recordVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const recordFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uSpin, uCut, uBass, uLevel, uKick, uFade;
uniform vec3 uAccent;
uniform sampler2D uLabel;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float aw = a + uSpin;                     // angle in world space (light stays put)
  vec3 col;
  float emis = 0.0;
  if (r < 0.34) {
    // Label: printed texture spins with the disc (uv already rotates with the mesh)
    vec2 luv = p / 0.34 * 0.5 + 0.5;
    vec4 lab = texture2D(uLabel, luv);
    col = lab.rgb;
    col *= 0.92 + 0.08 * cos(aw * 2.0);
    col += uAccent * uKick * 0.25;
    if (r < 0.024) col = vec3(0.02);        // spindle hole
    else if (r < 0.034) col = vec3(0.62);   // spindle ring
  } else {
    float cutR = mix(0.99, 0.36, uCut);
    float grooved = step(cutR, r);
    // fine grooves + track gaps
    float g = 0.5 + 0.5 * sin(r * 1400.0);
    float tracks = 1.0 - 0.75 * (smoothstep(0.004, 0.0, abs(r - 0.52)) + smoothstep(0.004, 0.0, abs(r - 0.66)) + smoothstep(0.004, 0.0, abs(r - 0.8)) + smoothstep(0.004, 0.0, abs(r - 0.92)));
    float micro = hash(vec2(floor(r * 900.0), 1.0)) * 0.35;
    vec3 base = vec3(0.028, 0.028, 0.034);
    // anisotropic sheen: two light wedges that stay fixed while the disc spins
    float wedge = pow(abs(cos(aw - 0.9)), 26.0) + 0.55 * pow(abs(cos(aw + 1.1)), 60.0);
    float sheen = wedge * (0.35 + 0.65 * g) * tracks;
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (r * 1.6 + vec3(0.0, 0.33, 0.67)));
    vec3 grooveCol = base + sheen * mix(vec3(0.85), irid, 0.35) * 0.55 + micro * 0.012;
    // lacquer (not yet cut): smooth, glossier, one broad highlight
    vec3 lacquer = base * 1.4 + pow(abs(cos(aw - 0.9)), 8.0) * 0.12;
    col = mix(lacquer, grooveCol * tracks, grooved);
    // cutting head: a hot line at the cut radius
    float head = smoothstep(0.012, 0.0, abs(r - cutR)) * step(0.001, uCut) * step(uCut, 0.999);
    emis += head * 3.0;
    // sound: rings travelling outward on the bass
    float ripple = pow(0.5 + 0.5 * sin(r * 48.0 - uTime * 7.0), 12.0) * uBass * grooved;
    emis += ripple * 1.4 + uKick * 0.25 * grooved * g;
    // rim light
    col += smoothstep(0.975, 1.0, r) * 0.18;
  }
  col += uAccent * emis;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

const glowFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uLevel, uKick, uFade, uTime;
uniform vec3 uAccent;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float ring = smoothstep(0.62, 0.745, r) * smoothstep(1.0, 0.745, r);
  float halo = smoothstep(1.0, 0.72, r) * 0.25;
  float a = (ring * (0.18 + uLevel * 1.8 + uKick * 1.2) + halo * (0.1 + uLevel)) * uFade;
  gl_FragColor = vec4(uAccent * a, a);
}`;

const pointsVert = /* glsl */ `
attribute float aSeed; attribute float aAngle; attribute float aRed;
uniform float uTime, uWave, uBass, uMid, uLevel, uPx, uFade;
varying float vAlpha; varying float vRed;
void main(){
  // A: drifting dust around the record
  vec3 dust = position;
  dust.x += sin(uTime * 0.12 + aSeed * 30.0) * 0.12;
  dust.y += cos(uTime * 0.1 + aSeed * 20.0) * 0.12;
  // B: a circular waveform around the disc, driven by the sound
  float k = floor(aSeed * 3.0) + 5.0;
  float amp = 0.06 + uBass * 0.5 + uMid * 0.2;
  float rr = 1.18 + sin(aAngle * k + uTime * 1.8) * amp * (0.6 + 0.4 * sin(uTime + aSeed * 6.0)) + (aSeed - 0.5) * 0.08;
  vec3 ring = vec3(cos(aAngle) * rr, sin(aAngle) * rr, (aSeed - 0.5) * 0.05);
  vec3 pos = mix(dust, ring, uWave);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = mix(1.4, 2.6, aSeed) * (1.0 + uLevel * 1.6);
  gl_PointSize = size * uPx * (4.0 / -mv.z);
  vAlpha = mix(0.35, 0.95, uWave) * uFade * (0.5 + 0.5 * aSeed);
  vRed = aRed;
}`;

const pointsFrag = /* glsl */ `
precision highp float;
varying float vAlpha; varying float vRed;
uniform vec3 uAccent;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  vec3 col = mix(vec3(0.93, 0.91, 0.87), uAccent * 1.6, vRed);
  gl_FragColor = vec4(col * a, a);
}`;

const finalShader = {
  uniforms: { tDiffuse: { value: null }, uAberration: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; uniform float uAberration; varying vec2 vUv;
  void main(){
    vec2 d = (vUv - 0.5) * uAberration;
    vec3 c = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
    float v = smoothstep(1.15, 0.35, length(vUv - 0.5));
    gl_FragColor = vec4(c * mix(0.55, 1.0, v), 1.0);
  }`,
};

function drawLabel(canvas: HTMLCanvasElement, accent: string) {
  const s = canvas.width;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, s, s);
  const c = s / 2;
  const grad = g.createRadialGradient(c, c * 0.8, s * 0.05, c, c, s * 0.5);
  grad.addColorStop(0, '#ef2d3a');
  grad.addColorStop(0.75, accent === '#e1222f' ? '#b3101c' : accent);
  grad.addColorStop(1, '#6e0a14');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // concentric print rings
  g.strokeStyle = 'rgba(0,0,0,.22)';
  for (const r of [0.47, 0.44]) { g.lineWidth = s * 0.004; g.beginPath(); g.arc(c, c, s * r, 0, Math.PI * 2); g.stroke(); }
  // official mark, printed in ivory
  g.save();
  g.translate(c, c * 0.93);
  const k = s / 64 * 0.34;
  g.scale(k, k);
  g.translate(-32, -32);
  g.strokeStyle = '#f3ede4';
  g.fillStyle = '#f3ede4';
  for (const [i, r] of [27, 23.6, 20.2, 16.8, 13.4, 10].entries()) {
    g.lineWidth = 2 - i * 0.1;
    g.globalAlpha = 1;
    g.beginPath(); g.arc(32, 32, r, Math.PI / 2, Math.PI * 1.5); g.stroke();
    g.globalAlpha = 0.55;
    g.beginPath(); g.arc(32, 32, r, -Math.PI / 2, Math.PI / 2); g.stroke();
  }
  g.globalAlpha = 1;
  g.lineWidth = 1.6;
  g.stroke(new Path2D('M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6'));
  g.restore();
  // type
  g.fillStyle = '#f3ede4';
  g.textAlign = 'center';
  g.font = `800 ${s * 0.064}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  g.fillText('MUSIC JAPAN', c, s * 0.77);
  g.font = `500 ${s * 0.032}px "JetBrains Mono", monospace`;
  g.globalAlpha = 0.8;
  g.fillText('SIDE A  ·  33⅓ RPM  ·  OSAKA', c, s * 0.84);
  g.globalAlpha = 1;
  // curved catalogue text along the top
  g.font = `500 ${s * 0.028}px "JetBrains Mono", monospace`;
  const text = 'MUSIC · STORIES · CONNECTIONS · FROM JAPAN · ';
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

export class World {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private final: ShaderPass | null = null;
  private rig = new THREE.Group();
  private record = new THREE.Group();
  private disc: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private glow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private arm = new THREE.Group();
  private sleeves = new THREE.Group();
  private labelCanvas = document.createElement('canvas');
  private labelTex: THREE.CanvasTexture;
  private accent = new THREE.Color('#e1222f');
  private accentTarget = new THREE.Color('#e1222f');
  private state: WorldState = { ...STATES.intro };
  target: WorldState = { ...STATES.hero };
  private spinAngle = 0;
  private time = 0;
  private raf = 0;
  private last = performance.now();
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private flash = 0;
  private visible = true;
  private dprCap: number;
  private slowFrames = 0;

  constructor(canvas: HTMLCanvasElement, opts: { sleeves?: string[] } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    // Shaders here are authored in display values: no sRGB round trip, so #060607 stays #060607.
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x060607, 1);
    this.dprCap = small() ? 1.5 : 1.75;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.dprCap));
    this.camera.position.set(0, 0, 8);

    this.labelCanvas.width = this.labelCanvas.height = 1024;
    drawLabel(this.labelCanvas, '#e1222f');
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = THREE.NoColorSpace;
    this.labelTex.anisotropy = 4;
    document.fonts?.ready.then(() => { drawLabel(this.labelCanvas, '#e1222f'); this.labelTex.needsUpdate = true; });

    const common = { uTime: { value: 0 }, uFade: { value: 0 }, uAccent: { value: this.accent }, uLevel: { value: 0 }, uKick: { value: 0 } };
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 256),
      new THREE.ShaderMaterial({
        vertexShader: recordVert,
        fragmentShader: recordFrag,
        uniforms: { ...common, uSpin: { value: 0 }, uCut: { value: 1 }, uBass: { value: 0 }, uLabel: { value: this.labelTex } },
      }),
    );
    // thickness: a thin dark edge
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.035, 128, 1, true), new THREE.MeshBasicMaterial({ color: 0x101012 }));
    edge.rotation.x = Math.PI / 2;
    edge.position.z = -0.018;

    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 2.9),
      new THREE.ShaderMaterial({
        vertexShader: recordVert,
        fragmentShader: glowFrag,
        uniforms: { ...common },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glow.position.z = -0.05;

    // tonearm: pivot top-right, pipe, headshell
    const metal = new THREE.MeshStandardMaterial({ color: 0x9a948c, metalness: 0.9, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.4, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 40), dark);
    base.rotation.x = Math.PI / 2;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 16), metal);
    pipe.position.set(0, -0.65, 0.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.03), metal);
    head.rotation.z = 0.35;
    head.position.set(0.02, -1.3, 0.1);
    const needle = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xe1222f }));
    needle.rotation.x = -Math.PI / 2;
    needle.position.set(0.02, -1.37, 0.06);
    this.arm.add(base, pipe, head, needle);
    this.arm.position.set(1.05, 1.05, 0.12);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 3, 4);
    const rim = new THREE.PointLight(0xe1222f, 6, 8);
    rim.position.set(-2, -1, 2);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));

    // particles
    const n = small() ? 900 : 2600;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const angle = new Float32Array(n);
    const red = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 1.4 + Math.random() * 3.2;
      const t = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(t) * r * 1.4;
      pos[i * 3 + 1] = Math.sin(t) * r * 0.9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
      seed[i] = Math.random();
      angle[i] = (i / n) * Math.PI * 2;
      red[i] = Math.random() < 0.28 ? 1 : 0;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    pg.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
    pg.setAttribute('aRed', new THREE.BufferAttribute(red, 1));
    this.points = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        vertexShader: pointsVert,
        fragmentShader: pointsFrag,
        uniforms: { ...common, uWave: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    // sleeves orbiting in the SPIN chapter
    const loader = new THREE.TextureLoader();
    (opts.sleeves ?? []).forEach((src, i, all) => {
      const tex = loader.load(src);
      tex.colorSpace = THREE.NoColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      m.userData.angle = (i / all.length) * Math.PI * 2;
      this.sleeves.add(m);
    });

    this.record.add(edge, this.disc);
    this.rig.add(this.glow, this.record, this.arm, this.points, this.sleeves);
    this.scene.add(this.rig);

    if (!small()) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.62);
      this.composer.addPass(this.bloom);
      this.final = new ShaderPass(finalShader);
      this.composer.addPass(this.final);
    }

    this.resize();
    addEventListener('resize', () => this.resize(), { passive: true });
    addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else this.start();
    });
  }

  set(name: string) {
    const base = STATES[name] ?? STATES.ambient;
    this.target = { ...base, ...(small() ? MOBILE[name] ?? {} : {}) };
  }

  /** Blend between two named states (used by the pinned stage). */
  blend(a: string, b: string, t: number) {
    const A = { ...STATES[a], ...(small() ? MOBILE[a] ?? {} : {}) };
    const B = { ...STATES[b], ...(small() ? MOBILE[b] ?? {} : {}) };
    const out = {} as WorldState;
    for (const k of KEYS) out[k] = lerp(A[k], B[k], t);
    this.target = out;
  }

  setCut(v: number) { this.target.cut = v; }

  /** The needle drop: snap in, flash, start spinning. */
  drop() {
    this.flash = 1;
    this.set('hero');
  }

  jump(name: string) {
    this.set(name);
    this.state = { ...this.target };
  }

  setAccent(hex: string) { this.accentTarget.set(hex); }

  start() {
    if (this.raf || !this.visible) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      // adaptive quality: sustained slow frames lower the pixel ratio once
      if (dt > 1 / 40) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 90 && this.dprCap > 1) {
        this.dprCap = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
        this.slowFrames = 0;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Render one still frame (reduced motion). */
  still(name = 'hero') {
    this.jump(name);
    this.frame(0.016);
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w / 2, h / 2);
    this.points.material.uniforms.uPx.value = this.renderer.getPixelRatio();
  }

  private frame(dt: number) {
    sample(dt);
    this.time += dt;
    const s = this.state;
    const t = this.target;
    for (const k of KEYS) s[k] = damp(s[k], t[k], k === 'cut' ? 6 : k === 'fade' ? 3.5 : 4, dt);

    // viewport → world units at the record's depth
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const vw = vh * this.camera.aspect;
    this.pointer.x = damp(this.pointer.x, this.pointer.tx, 3, dt);
    this.pointer.y = damp(this.pointer.y, this.pointer.ty, 3, dt);
    this.rig.position.set((s.x * vw) / 2, (-s.y * vh) / 2, 0);
    const radius = s.scale * vh;
    this.rig.scale.setScalar(radius * (1 + bus.kick * 0.025));
    this.rig.rotation.set(s.tilt + this.pointer.y * 0.12, this.pointer.x * 0.18, s.roll);

    this.spinAngle += dt * (0.55 * s.spin + bus.level * 2.2);
    this.record.rotation.z = -this.spinAngle;
    this.arm.rotation.z = lerp(0.45, -0.2, s.arm) + Math.sin(this.time * 2.1) * 0.004 * s.arm;
    this.arm.visible = s.arm > 0.05;
    (this.arm.children as THREE.Mesh[]).forEach((m) => {
      const mat = m.material as THREE.Material & { opacity: number; transparent: boolean };
      mat.transparent = true;
      mat.opacity = clamp(s.fade * 1.2) * clamp(s.arm * 1.5 + 0.2);
    });

    this.accent.lerp(this.accentTarget, 1 - Math.exp(-3 * dt));
    this.flash = Math.max(0, this.flash - dt * 1.6);

    const du = this.disc.material.uniforms;
    du.uTime.value = this.time;
    du.uSpin.value = this.spinAngle;
    du.uCut.value = s.cut;
    du.uBass.value = bus.bass;
    du.uLevel.value = bus.level;
    du.uKick.value = Math.max(bus.kick, this.flash);
    du.uFade.value = s.fade;
    const gu = this.glow.material.uniforms;
    gu.uLevel.value = bus.level + this.flash * 0.6;
    gu.uKick.value = Math.max(bus.kick, this.flash);
    gu.uFade.value = s.fade;
    gu.uTime.value = this.time;
    const pu = this.points.material.uniforms;
    pu.uTime.value = this.time;
    pu.uWave.value = s.wave;
    pu.uBass.value = bus.bass;
    pu.uMid.value = bus.mid;
    pu.uLevel.value = bus.level;
    pu.uFade.value = Math.max(0.35, s.fade);

    this.sleeves.children.forEach((m, i) => {
      const mesh = m as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      const a = mesh.userData.angle + this.time * 0.35;
      const r = 1.75 + Math.sin(this.time * 0.8 + i) * 0.05;
      mesh.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.62, Math.sin(a) * 0.6);
      mesh.rotation.set(-s.tilt * 0.6, Math.cos(a) * 0.5, 0);
      mesh.material.opacity = s.orbit * s.fade;
      mesh.scale.setScalar(0.4 + s.orbit * 0.6);
      mesh.visible = s.orbit > 0.02;
    });

    if (this.composer && this.bloom && this.final) {
      this.bloom.strength = 0.55 + bus.level * 1.1 + this.flash * 1.6;
      this.final.uniforms.uAberration.value = 0.002 + bus.kick * 0.012 + this.flash * 0.02;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
