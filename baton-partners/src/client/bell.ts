import { onPerfLevel, perfLevel, reportFrame } from './perf';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { SceneOptions } from './scene';

/**
 * 「鐘」のシーン（BE.PRESTO など presto の世界観用）。夜の楽譜の上で光る。
 *
 *  phase 0〜0.6 五線から外れた音符が、画面じゅうに散らばって漂う。うしろでかすかに五線がゆれる（埋もれている価値）
 *  phase 0.8    ところどころの音符が青く灯る（見つける）
 *  phase 1      音符が五線に並び、楽譜になって流れていく。五線は波のようにゆれる（言葉にする）
 *  phase 2      音符が集まって、真鍮の鐘の形になる。鐘から波紋が広がり続ける（響かせる）
 *
 * 色は CSS 変数から：音符＝ロゴの BP の青、鐘と波紋＝真鍮、鳴った瞬間＝生成り。光は加算で重ねる。
 * ページの鐘のボタンを押すと（client/presto.ts の「bp:ring」）、どの場面でも波紋が広がる。
 */

const BEAT = (60 / 184) * 4; // 1小節（♩=184 の4拍）。鐘の場面では、小節ごとに波紋を出す
const RINGS = 6;

/** 鐘の輪郭の半径（y：0＝口、1＝頂上） */
function bellR(y: number): number {
  if (y < 0.06) return 0.62 - (y / 0.06) * 0.1;
  if (y < 0.3) return 0.52 - ((y - 0.06) / 0.24) * 0.1;
  if (y < 0.78) return 0.42 - ((y - 0.3) / 0.48) * 0.06;
  const k = (y - 0.78) / 0.22;
  return 0.36 * Math.sqrt(Math.max(0, 1 - k * k));
}

/** 鐘の形の上の点（中心をおよそ 0 に） */
function bellPoint(): [number, number] {
  const r = Math.random();
  let x: number;
  let y: number;
  if (r < 0.5) {
    // 輪郭（左右）
    y = Math.pow(Math.random(), 0.9);
    x = bellR(y) * (Math.random() < 0.5 ? -1 : 1);
    x += (Math.random() - 0.5) * 0.015;
  } else if (r < 0.66) {
    // 口の線
    y = (Math.random() - 0.5) * 0.02;
    x = (Math.random() * 2 - 1) * 0.62;
  } else if (r < 0.72) {
    // 舌（下の玉）
    const a = Math.random() * Math.PI * 2;
    const rr = 0.07 * Math.sqrt(Math.random());
    x = Math.cos(a) * rr;
    y = -0.1 + Math.sin(a) * rr;
  } else if (r < 0.76) {
    // 頂上の吊り輪
    const a = Math.random() * Math.PI;
    x = Math.cos(a) * 0.06;
    y = 1.0 + Math.sin(a) * 0.06;
  } else {
    // 胴の中（少なめ。下ほど薄く）
    y = Math.random();
    x = (Math.random() * 2 - 1) * bellR(y) * 0.92;
    if (Math.random() < 0.4) x *= 0.5;
  }
  return [x, y - 0.46];
}

const NOTE_VERT = /* glsl */ `
attribute vec3 aScatter; // xy: -1〜1, z: 奥行き
attribute vec2 aStaff;   // x: 五線の上の横の位置(0〜1), y: 線と間の段（0〜8 が五線の中）
attribute vec2 aBell;    // 鐘の形の上の位置
attribute vec4 aInfo;    // x: 乱数, y: 大きさの乱数, z: 白抜きの音符(1), w: 灯る音符(1)
uniform float uTime;
uniform float uPhase;
uniform float uIntro;
uniform float uAmbient;
uniform float uKick;
uniform float uKickT;
uniform vec2 uScatter;
uniform float uStaffW;
uniform float uGap;
uniform float uBellS;
uniform vec2 uMouse;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColM;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
varying float vOpen;

float staffWave(float x, float t) { return sin(x * 0.55 + t * 1.2) * 0.12; }

void main() {
  float t = uTime;
  float ph = uPhase;
  float wStaff = smoothstep(0.84, 1.0, ph);
  float wBell = smoothstep(1.2, 1.85, ph);
  float found = aInfo.w * smoothstep(0.62, 0.8, ph) * (1.0 - wStaff * 0.7);

  // 散らばって漂う（ゆっくり左へ流れ、少し上下する）
  vec3 sc = vec3(aScatter.xy * uScatter, aScatter.z);
  sc.x += sin(t * 0.17 + aInfo.x * 31.0) * 0.35 - mod(t * 0.04 * (0.5 + aInfo.y), 2.0) * 0.0;
  sc.y += cos(t * 0.14 + aInfo.x * 17.0) * 0.26;
  // マウスの近くの音符は、少し逃げる
  vec2 dm = sc.xy - uMouse * uScatter;
  sc.xy += normalize(dm + 0.0001) * exp(-dot(dm, dm) * 0.35) * 0.5 * (1.0 - wStaff);

  // 五線に並んで流れる
  float u = fract(aStaff.x - t * 0.022);
  vec3 st = vec3((u - 0.5) * uStaffW, (aStaff.y - 4.0) * uGap * 0.5, 0.0);
  st.y += staffWave(st.x, t);

  // 鐘の形
  vec3 bl = vec3(aBell * uBellS, 0.0);
  bl.x += sin(t * 1.6 + aBell.y * 9.0) * 0.015;

  vec3 p = mix(sc, st, wStaff);
  p = mix(p, bl, wBell);

  // 鐘が鳴った波紋：中心から広がる輪の近くの音符を押し広げて、明るくする
  float age = t - uKickT;
  float rad = age * 4.2;
  float dist = length(p.xy);
  float ring = exp(-pow((dist - rad) * 1.4, 2.0)) * exp(-age * 0.9) * uKick;
  p.xy += normalize(p.xy + 0.0001) * ring * 0.3;

  // 入場：奥から手前へ
  p = mix(p * 1.4 + vec3(0.0, 0.0, -7.0), p, uIntro);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = (0.05 + aInfo.y * 0.05) * (1.0 + found * 1.4 + ring * 1.6) * mix(1.0, 0.82, wBell) * mix(1.0, 0.7, uAmbient);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  vUv = position.xy;
  vOpen = aInfo.z;
  vec3 col = mix(uColA, uColB, wBell);
  col = mix(col, uColM, clamp(ring * 0.9 + found * 0.2, 0.0, 1.0));
  vCol = col;
  // 散らばっている間は控えめに（ヒーローの文字の後ろで、読みやすさを邪魔しない）
  float base = mix(0.1 + aInfo.x * 0.2, 0.9, max(wStaff, wBell));
  vA = (base + found * 0.7 + ring) * uIntro * mix(1.0, 0.45, uAmbient);
}
`;

const NOTE_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
varying float vOpen;
void main() {
  // 傾いた楕円の符頭。白抜きの音符は真ん中を抜く
  float a = -0.42;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * vUv;
  q.y /= 0.7;
  float r = length(q);
  float fill = 1.0 - smoothstep(0.78, 0.98, r);
  float hole = vOpen > 0.5 ? smoothstep(0.38, 0.56, r) : 1.0;
  float glow = exp(-r * r * 2.2) * 0.35;
  float alpha = fill * hole + glow;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vCol, alpha * vA);
}
`;

const LINE_VERT = /* glsl */ `
attribute float aLine;
uniform float uTime;
uniform float uStaffW;
uniform float uGap;
uniform float uKick;
uniform float uKickT;
void main() {
  float t = uTime;
  vec3 p = position;
  p.x *= uStaffW;
  p.y = (aLine - 2.0) * uGap + position.y + sin(p.x * 0.55 + t * 1.2) * 0.12;
  // 波紋が通るところで、線が跳ねる
  float age = t - uKickT;
  float rad = age * 4.2;
  float d = length(p.xy);
  p.y += sin((d - rad) * 4.0) * exp(-pow((d - rad) * 1.4, 2.0)) * exp(-age * 0.9) * uKick * 0.22;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

const RING_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uCol, uOpacity); }
`;

type U = Record<string, { value: unknown }>;

export class BellScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private rig = new Group();
  private noteU: U;
  private lineU: U;
  private lines: Mesh;
  private rings: { mesh: Mesh; u: U; start: number; power: number }[] = [];
  private nextRing = 0;
  private lastAuto = 0;
  private raf = 0;
  private visible = true;
  private start = performance.now();
  private mouse = new Vector2();
  private mouseTarget = new Vector2();
  private offset = new Vector2();
  private sideX = 0;
  private baseScale = 1;
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
    // 「動きを減らす」設定のトップでは、いちばん伝わる一枚（鐘）で止める
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

    const blue = new Color(o.ink);
    const brass = new Color(o.brand);
    const cream = new Color(o.red);
    const ambient = o.mode === 'aurora';
    const n = Math.max(300, Math.min(Math.round(o.count * 0.5), 1100));

    // ── 音符 ──
    const aScatter = new Float32Array(n * 3);
    const aStaff = new Float32Array(n * 2);
    const aBell = new Float32Array(n * 2);
    const aInfo = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      aScatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 4 - 3], i * 3);
      // 段は五線の中（0〜8）が多め。たまに上下の加線
      const r = Math.random();
      const step = r < 0.88 ? Math.floor(Math.random() * 9) : r < 0.94 ? -1 - Math.floor(Math.random() * 2) : 9 + Math.floor(Math.random() * 2);
      aStaff.set([Math.random(), step], i * 2);
      aBell.set(bellPoint(), i * 2);
      aInfo.set([Math.random(), Math.random(), Math.random() < 0.18 ? 1 : 0, Math.random() < 0.12 ? 1 : 0], i * 4);
    }
    const quad = new PlaneGeometry(2, 2);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('aScatter', new InstancedBufferAttribute(aScatter, 3));
    geo.setAttribute('aStaff', new InstancedBufferAttribute(aStaff, 2));
    geo.setAttribute('aBell', new InstancedBufferAttribute(aBell, 2));
    geo.setAttribute('aInfo', new InstancedBufferAttribute(aInfo, 4));
    geo.instanceCount = ambient ? Math.round(n * 0.3) : n;
    this.noteU = {
      uTime: { value: 0 },
      uPhase: { value: this.phase },
      uIntro: { value: o.animate ? 0 : 1 },
      uAmbient: { value: ambient ? 1 : 0 },
      uKick: { value: 0 },
      uKickT: { value: -10 },
      uScatter: { value: new Vector2(8, 5) },
      uStaffW: { value: 20 },
      uGap: { value: 0.42 },
      uBellS: { value: 4.4 },
      uMouse: { value: new Vector2(9, 9) },
      uColA: { value: blue },
      uColB: { value: brass },
      uColM: { value: cream },
    };
    const notes = new Mesh(
      geo,
      new ShaderMaterial({
        uniforms: this.noteU,
        vertexShader: NOTE_VERT,
        fragmentShader: NOTE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    notes.frustumCulled = false;
    notes.renderOrder = 2;
    this.rig.add(notes);

    // ── 五線（5本。x は -0.5〜0.5 をシェーダーで幅に広げる） ──
    const SEG = 160;
    const pos: number[] = [];
    const line: number[] = [];
    const idx: number[] = [];
    const TH = 0.008;
    for (let l = 0; l < 5; l++) {
      const base = pos.length / 3;
      for (let s = 0; s <= SEG; s++) {
        const x = s / SEG - 0.5;
        pos.push(x, -TH, 0, x, TH, 0);
        line.push(l, l);
        if (s < SEG) {
          const a = base + s * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const lgeo = new BufferGeometry();
    lgeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    lgeo.setAttribute('aLine', new BufferAttribute(new Float32Array(line), 1));
    lgeo.setIndex(idx);
    this.lineU = {
      uTime: this.noteU.uTime,
      uStaffW: this.noteU.uStaffW,
      uGap: this.noteU.uGap,
      uKick: this.noteU.uKick,
      uKickT: this.noteU.uKickT,
      uCol: { value: new Color('#F4EFE4') },
      uOpacity: { value: 0.1 },
    };
    this.lines = new Mesh(
      lgeo,
      new ShaderMaterial({
        uniforms: this.lineU,
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;
    this.rig.add(this.lines);

    // ── 鐘の波紋（輪を使い回す） ──
    for (let i = 0; i < RINGS; i++) {
      const u = { uCol: { value: i % 2 ? brass.clone() : blue.clone() }, uOpacity: { value: 0 } };
      const mesh = new Mesh(
        new RingGeometry(0.985, 1, 128),
        new ShaderMaterial({
          uniforms: u,
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: DoubleSide,
          blending: AdditiveBlending,
        }),
      );
      mesh.renderOrder = 0;
      mesh.visible = false;
      this.rig.add(mesh);
      this.rings.push({ mesh, u, start: -100, power: 0 });
    }

    if (ambient) {
      this.lines.visible = false;
    }
    this.scene.add(this.rig);

    new ResizeObserver(() => this.resize()).observe(o.host);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.loop();
    }).observe(o.host);
    this.resize();

    window.addEventListener('bp:ring', this.onRing);
    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      document.addEventListener('visibilitychange', () => !document.hidden && this.loop());
      this.loop();
    } else {
      this.render(6);
    }
    o.host.classList.add('is-ready');
  }

  private now(): number {
    return (performance.now() - this.start) / 1000;
  }

  /** 波紋を1つ出す（鐘のボタン・小節の頭） */
  private ripple(power: number) {
    const r = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RINGS;
    r.start = this.now();
    r.power = power;
    r.mesh.visible = true;
  }

  private onRing = (e: Event) => {
    if (this.o.mode === 'aurora') return;
    const power = (e as CustomEvent<{ power?: number }>).detail?.power ?? 1;
    this.ripple(power);
    window.setTimeout(() => this.ripple(power * 0.6), 160);
    this.noteU.uKick.value = Math.min(1.4, power);
    this.noteU.uKickT.value = this.now();
    if (!this.o.animate || perfLevel() === 2) this.render(this.now());
  };

  private onPointer = (e: PointerEvent) => {
    const r = this.o.host.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.mouseTarget.set(x, y);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    const stage = this.o.layout === 'right';
    const wide = this.camera.aspect > 1.15;
    (this.noteU.uScatter.value as Vector2).set(halfW * 0.95, halfH * 0.9);
    this.noteU.uStaffW.value = halfW * 2.6;
    this.sideX = 0;
    if (stage && wide) {
      // トップ：巨大な見出しの後ろに五線。動詞の場面では右へ寄る
      this.offset.set(0, -halfH * 0.04);
      this.sideX = halfW * 0.34;
      this.baseScale = 1;
      this.noteU.uGap.value = Math.min(0.46, halfH * 0.085);
      this.noteU.uBellS.value = Math.min(4.6, halfH * 0.95);
    } else if (stage) {
      // スマホ：上のほうに。見出しは下
      this.offset.set(0, halfH * 0.3);
      this.baseScale = 1;
      this.noteU.uGap.value = Math.min(0.36, halfW * 0.09);
      this.noteU.uBellS.value = Math.min(3.4, halfW * 1.15);
    } else {
      this.offset.set(0, 0);
      this.baseScale = 1;
      this.noteU.uGap.value = Math.min(0.42, halfH * 0.1);
      this.noteU.uBellS.value = Math.min(4.2, halfH * 1.0);
    }
    if (!this.o.animate) this.render(6);
  }

  private render(t: number) {
    const ph = this.o.mode === 'aurora' ? 0.2 : this.phase;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const wStaff = sm(0.84, 1.0, ph);
    const wBell = sm(1.2, 1.85, ph);
    const side = sm(0.6, 0.85, ph);
    this.rig.position.set(this.offset.x + this.sideX * side, this.offset.y, 0);
    this.rig.scale.setScalar(this.baseScale);
    this.rig.rotation.set(-this.mouse.y * 0.08, this.mouse.x * 0.16 * (1 - wStaff * 0.6), 0);

    this.noteU.uTime.value = t;
    this.noteU.uPhase.value = ph;
    (this.noteU.uMouse.value as Vector2).copy(this.mouse);
    // 五線：ヒーローではかすかに、楽譜の場面ではくっきり、鐘の場面では消える
    this.lineU.uOpacity.value = (0.1 + wStaff * 0.4) * (1 - wBell * 0.9);

    // 鐘の場面では、小節の頭ごとに波紋。ヒーローでは2小節ごとに、かすかに
    if (this.o.animate && this.o.mode !== 'aurora' && t - this.lastAuto > (wBell > 0.5 ? BEAT : BEAT * 2)) {
      this.lastAuto = t;
      this.ripple(wBell > 0.5 ? 0.9 : 0.35);
    }
    const bellCenterY = wBell * 0;
    for (const r of this.rings) {
      const age = t - r.start;
      if (age < 0 || age > 4) {
        r.u.uOpacity.value = 0;
        r.mesh.visible = false;
        continue;
      }
      const rad = 0.4 + age * 3.2;
      r.mesh.scale.setScalar(rad);
      r.mesh.position.set(0, bellCenterY, -0.2);
      r.u.uOpacity.value = Math.max(0, 1 - age / 4) * 0.45 * r.power;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    this.noteU.uIntro.value = 1;
    this.noteU.uKick.value = 0;
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
    const t = this.now();
    const intro = this.noteU.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 0.012);
    this.phase += (this.goal - this.phase) * 0.06;
    this.mouse.lerp(this.mouseTarget, 0.06);
    const kick = this.noteU.uKick as { value: number };
    kick.value = Math.max(0, kick.value - 0.004);
    this.render(t);
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
  };
}
