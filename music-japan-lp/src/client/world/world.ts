import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  Group,
  LineSegments,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { buildLayouts, L, LAYOUT_COUNT, type Built } from './layouts';
import { beamFrag, beamVert, lineFrag, lineVert, pointFrag, pointVert } from './shaders';

export type Tier = 'high' | 'mid' | 'low';

/** レイアウトをDOMの要素の位置・大きさに合わせる（WebGLのかたちが、ページの中の決まった場所に現れる） */
export type Anchor = { el: HTMLElement | null; fit: 'contain' | 'height' | 'width' | 'none'; ox?: number; oy?: number; scale?: number };

const FOV = 38;
const CAM_Z = 12;
const TEX_W = 256;

/** かたちごとの向き。spin は回り続ける（輪・波など、回っても形が変わらないものだけ）、sway はゆっくり揺れる */
const RIG: { rx: number; ry: number; rz: number; spin: [number, number, number]; sway: [number, number, number]; drift: number }[] = [
  { rx: 0, ry: 0, rz: 0, spin: [0, 0.02, 0], sway: [0, 0, 0], drift: 0.12 }, // DUST
  { rx: 0.08, ry: -0.18, rz: 0, spin: [0, 0, 0], sway: [0.04, 0.22, 0], drift: 0.03 }, // NETWORK
  { rx: 0.1, ry: -0.5, rz: 0.02, spin: [0, 0, 0], sway: [0.03, 0.08, 0], drift: 0.015 }, // PAGES
  { rx: -0.32, ry: 0.36, rz: 0.04, spin: [0, 0, 0], sway: [0.03, 0.06, 0], drift: 0.015 }, // SEARCH
  { rx: 0.06, ry: -0.08, rz: 0, spin: [0, 0, 0], sway: [0, 0.04, 0], drift: 0.02 }, // BUILDLINE
  { rx: -0.4, ry: 0, rz: 0.1, spin: [0, 0, 0], sway: [0.05, 0.1, 0.04], drift: 0.05 }, // PROJECTS
  { rx: 0.2, ry: -0.35, rz: 0, spin: [0, 0, 0.06], sway: [0, 0, 0], drift: 0.01 }, // WAVE
  { rx: -0.08, ry: 0.22, rz: -0.03, spin: [0, 0, 0], sway: [0.03, 0.08, 0], drift: 0.04 }, // LOG
  { rx: 0, ry: 0, rz: 0, spin: [0, 0, -0.12], sway: [0, 0, 0], drift: 0.01 }, // MARK
  { rx: 0, ry: 0, rz: 0, spin: [0, 0, 0], sway: [0.05, 0.08, 0], drift: 0.04 }, // CONNECT
];
const wrapAngle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));

export class World {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 120);
  readonly group = new Group();
  private points!: Points;
  private lines!: LineSegments;
  private beam!: Mesh;
  private built!: Built;
  private pMat!: ShaderMaterial;
  private lMat!: ShaderMaterial;
  private bMat!: ShaderMaterial;
  private n: number;
  private chapter = 0;
  private chapterTarget = 0;
  private anchors: Anchor[] = [];
  private mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, active: false };
  /** かたちごとの回転の積み重ね（見えていないかたちの分は、見えないうちに一周の中へ戻す） */
  private spinOf = Array.from({ length: LAYOUT_COUNT }, () => [0, 0, 0]);
  private grow = 0;
  private buildP = 0;
  private beamP = 0;
  private hi = { layout: -1, group: -1 };
  private visible = true;
  private raf = 0;
  private last = performance.now();
  private slowFrames = 0;
  private dpr = 1;
  private w = 1;
  private h = 1;
  private reduced: boolean;
  private mobile: boolean;
  private onFrame: ((w: World) => void)[] = [];
  private tmp = new Vector3();

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: { tier: Tier; mobile: boolean; reduced: boolean },
  ) {
    this.mobile = opts.mobile;
    this.reduced = opts.reduced;
    this.n = opts.tier === 'high' ? 9000 : opts.tier === 'mid' ? 6000 : 3200;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.dpr = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.6 : 1.8);
    this.renderer.setPixelRatio(this.dpr);
    this.camera.position.set(0, 0, CAM_Z);
    this.scene.add(this.group);
    this.build();
    this.resize();
  }

  private build() {
    const b = buildLayouts(this.n, this.mobile);
    this.built = b;
    const rows = Math.ceil(this.n / TEX_W);
    const tex = new Float32Array(TEX_W * rows * LAYOUT_COUNT * 4);
    for (let l = 0; l < LAYOUT_COUNT; l++) {
      for (let i = 0; i < this.n; i++) {
        const src = (l * this.n + i) * 4;
        const x = i % TEX_W;
        const y = Math.floor(i / TEX_W) + l * rows;
        const dst = (y * TEX_W + x) * 4;
        tex[dst] = b.data[src];
        tex[dst + 1] = b.data[src + 1];
        tex[dst + 2] = b.data[src + 2];
        tex[dst + 3] = b.data[src + 3];
      }
    }
    const layouts = new DataTexture(tex, TEX_W, rows * LAYOUT_COUNT, RGBAFormat, FloatType);
    layouts.minFilter = NearestFilter;
    layouts.magFilter = NearestFilter;
    layouts.generateMipmaps = false;
    layouts.needsUpdate = true;

    const rand = new Float32Array(this.n * 4);
    for (let i = 0; i < rand.length; i++) rand[i] = Math.random();

    const paper = new Color('#efe9e0');
    const red = new Color('#ff2f3e');
    const shared = {
      uLayouts: { value: layouts },
      uTex: { value: [TEX_W, rows * LAYOUT_COUNT] },
      uRows: { value: rows },
      uA: { value: 0 },
      uB: { value: 0 },
      uMix: { value: 0 },
      uTime: { value: 0 },
      uDrift: { value: 0.12 },
      uWave: { value: 0 },
      uMouse: { value: [0, 0] },
      uMouseOn: { value: 0 },
      uAspect: { value: 1 },
      uHiLayout: { value: -1 },
      uHiGroup: { value: -1 },
      uFade: { value: 1 },
    };

    // 点
    const geo = new BufferGeometry();
    const idx = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) idx[i] = i;
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.n * 3), 3));
    geo.setAttribute('aIndex', new BufferAttribute(idx, 1));
    geo.setAttribute('aRand', new BufferAttribute(rand, 4));
    this.pMat = new ShaderMaterial({
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      uniforms: {
        ...shared,
        uSize: { value: this.mobile ? 2.6 : 2.4 },
        uDpr: { value: this.dpr },
        uC: {
          value: [
            new Color('#d9d2c8'), // 0 塵
            paper.clone(), // 1 明るい点
            red.clone(), // 2 赤
            new Color('#1cccE8'), // 3 水色（エボルグ）
            new Color('#3b5bff'), // 4 青（Central AX）
            new Color('#cfc6ba'), // 5 淡い構造
            red.clone(), // 6 波
            new Color('#000000'), // 7 見えない
            new Color('#f3d9d4'), // 8 手前でぼける大きな光
          ],
        },
        uAlpha: { value: [0.36, 0.95, 1.0, 0.95, 1.0, 0.5, 1.0, 0.0, 0.3] },
        uScale: { value: [0.9, 1.55, 1.9, 1.6, 1.6, 1.05, 1.55, 0.0, 6.5] },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geo, this.pMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // 線
    const ls = b.lines.filter((l) => l.a >= 0 && l.b >= 0);
    const m = ls.length;
    const aA = new Float32Array(m * 2);
    const aB = new Float32Array(m * 2);
    const aEnd = new Float32Array(m * 2);
    const aRA = new Float32Array(m * 2 * 4);
    const aRB = new Float32Array(m * 2 * 4);
    const aMeta = new Float32Array(m * 2 * 4);
    const aGrp = new Float32Array(m * 2 * 2);
    ls.forEach((l, i) => {
      for (let e = 0; e < 2; e++) {
        const v = i * 2 + e;
        aA[v] = l.a;
        aB[v] = l.b;
        aEnd[v] = e;
        for (let k = 0; k < 4; k++) {
          aRA[v * 4 + k] = rand[l.a * 4 + k];
          aRB[v * 4 + k] = rand[l.b * 4 + k];
        }
        aMeta[v * 4] = l.layout;
        aMeta[v * 4 + 1] = l.order;
        aMeta[v * 4 + 2] = l.color;
        aGrp[v * 2] = l.ga;
        aGrp[v * 2 + 1] = l.gb;
      }
    });
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(m * 2 * 3), 3));
    lg.setAttribute('aA', new BufferAttribute(aA, 1));
    lg.setAttribute('aB', new BufferAttribute(aB, 1));
    lg.setAttribute('aEnd', new BufferAttribute(aEnd, 1));
    lg.setAttribute('aRA', new BufferAttribute(aRA, 4));
    lg.setAttribute('aRB', new BufferAttribute(aRB, 4));
    lg.setAttribute('aMeta', new BufferAttribute(aMeta, 4));
    lg.setAttribute('aGrp', new BufferAttribute(aGrp, 2));
    this.lMat = new ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: { ...shared, uGrow: { value: 0 }, uPaper: { value: paper.clone().multiplyScalar(0.95) }, uRed: { value: red.clone() } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.lines = new LineSegments(lg, this.lMat);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    // 最後の赤い線
    this.bMat = new ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms: {
        uP0: { value: new Vector3() },
        uP1: { value: new Vector3() },
        uWidth: { value: this.mobile ? 34 : 46 },
        uRes: { value: [1, 1] },
        uDraw: { value: 0 },
        uTime: { value: 0 },
        uRed: { value: new Color('#ff2a3a') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.beam = new Mesh(new PlaneGeometry(1, 1, 48, 1), this.bMat);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.scene.add(this.beam);
  }

  /** レイアウトごとに、合わせるDOM要素を決める */
  setAnchors(a: Anchor[]) {
    this.anchors = a;
  }
  setChapter(ch: number) {
    this.chapterTarget = Math.max(0, Math.min(LAYOUT_COUNT - 1, ch));
  }
  setGrow(v: number) {
    this.grow = v;
  }
  setBuild(p: number) {
    this.buildP = p;
  }
  setBeam(p: number) {
    this.beamP = p;
  }
  setWave(v: number) {
    this.pMat.uniforms.uWave.value = v;
  }
  setHighlight(layout: number, group: number) {
    this.hi = { layout, group };
  }
  setFade(v: number) {
    this.pMat.uniforms.uFade.value = v;
    this.lMat.uniforms.uFade.value = v;
  }
  setVisible(v: boolean) {
    this.visible = v;
  }
  pointer(x: number, y: number, active = true) {
    this.mouse.tx = x;
    this.mouse.ty = y;
    this.mouse.active = active;
  }
  frame(fn: (w: World) => void) {
    this.onFrame.push(fn);
  }

  resize() {
    // 画面（レイアウトの幅）ではなく、実際に描いているキャンバスの大きさを基準にする
    const box = this.renderer.domElement.getBoundingClientRect();
    this.w = box.width || window.innerWidth;
    this.h = box.height || window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.pMat.uniforms.uAspect.value = this.w / this.h;
    this.lMat.uniforms.uAspect.value = this.w / this.h;
    this.bMat.uniforms.uRes.value = [this.w * this.dpr, this.h * this.dpr];
  }

  /** z=0 の面で、1ピクセルが何ユニットか */
  private unitPerPx() {
    return (2 * CAM_Z * Math.tan((FOV * Math.PI) / 360)) / this.h;
  }

  /** レイアウトの置き場所（DOM要素の中心と大きさから） */
  private placement(layout: number): { x: number; y: number; s: number } {
    const a = this.anchors[layout];
    if (!a || !a.el || a.fit === 'none') return { x: (a?.ox ?? 0), y: (a?.oy ?? 0), s: a?.scale ?? 1 };
    const r = a.el.getBoundingClientRect();
    const u = this.unitPerPx();
    const cx = (r.left + r.width / 2 - this.w / 2) * u;
    const cy = -(r.top + r.height / 2 - this.h / 2) * u;
    const size = a.fit === 'height' ? r.height : a.fit === 'width' ? r.width : Math.min(r.width, r.height);
    const s = ((size * u) / this.built.refSize[layout]) * (a.scale ?? 1);
    return { x: cx + (a.ox ?? 0), y: cy + (a.oy ?? 0), s };
  }

  /** DOMのラベル用：レイアウト空間の点を、画面の座標に */
  screen(layout: number, k: number): { x: number; y: number } | null {
    const p = this.built.anchors[layout]?.[k];
    if (!p) return null;
    this.tmp.set(p[0], p[1], p[2]).applyMatrix4(this.group.matrixWorld).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * this.w, y: ((1 - this.tmp.y) / 2) * this.h };
  }
  /** いまのかたちの中で、layout がどれだけ見えているか（0..1） */
  weight(layout: number): number {
    const a = Math.floor(this.chapter);
    const t = this.chapter - a;
    if (layout === a) return 1 - t;
    if (layout === a + 1) return t;
    return 0;
  }

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.visible || document.hidden) return;
      this.tick(dt, now / 1000);
      // 重い端末では、描画の解像度を下げる
      if (dt > 1 / 40) this.slowFrames++;
      else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 90 && this.dpr > 1) {
        this.dpr = 1;
        this.renderer.setPixelRatio(1);
        this.pMat.uniforms.uDpr.value = 1;
        this.resize();
        this.slowFrames = 0;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** 動きを減らす設定のとき：その場のかたちを1枚だけ描く */
  still() {
    this.chapter = this.chapterTarget;
    this.tick(0, 1.5);
  }

  private tick(dt: number, time: number) {
    // かたちの切り替えは、スクロール位置に少し遅れてついてくる
    const k = this.reduced ? 1 : 1 - Math.pow(0.0009, dt);
    this.chapter += (this.chapterTarget - this.chapter) * k;
    const a = Math.min(LAYOUT_COUNT - 1, Math.floor(this.chapter + 1e-4));
    const b = Math.min(LAYOUT_COUNT - 1, a + 1);
    const t = Math.min(1, Math.max(0, this.chapter - a));
    const e = t * t * (3 - 2 * t);

    // カーソル
    this.mouse.x += (this.mouse.tx - this.mouse.x) * Math.min(1, dt * 6);
    this.mouse.y += (this.mouse.ty - this.mouse.y) * Math.min(1, dt * 6);
    this.mouse.on += ((this.mouse.active ? 1 : 0) - this.mouse.on) * Math.min(1, dt * 3);

    // 置き場所（DOMに合わせる）と向き
    const pa = this.placement(a);
    const pb = this.placement(b);
    const ra = RIG[a];
    const rb = RIG[b];
    for (let k = 0; k < LAYOUT_COUNT; k++) {
      const sp = this.spinOf[k];
      for (let i = 0; i < 3; i++) sp[i] = k === a || k === b ? sp[i] + dt * RIG[k].spin[i] : wrapAngle(sp[i]);
    }
    const rot = (i: 0 | 1 | 2) => this.spinOf[a][i] * (1 - e) + this.spinOf[b][i] * e + Math.sin(time * (0.21 + i * 0.07) + i * 1.7) * (ra.sway[i] * (1 - e) + rb.sway[i] * e);
    let x = pa.x + (pb.x - pa.x) * e;
    const y = pa.y + (pb.y - pa.y) * e;
    const s = pa.s + (pb.s - pa.s) * e;
    // 工程の並びは、横スクロールの位置にあわせて流れる
    const bw = this.weight(L.BUILDLINE);
    if (bw > 0) {
      const sp = 3.6;
      const target = -((this.buildP * 7 - 3.5) * sp) + (this.mobile ? 0 : 2.6);
      x = x * (1 - bw) + target * bw;
    }
    this.group.position.set(x, y, 0);
    this.group.scale.setScalar(s);
    this.group.rotation.set(
      ra.rx + (rb.rx - ra.rx) * e + rot(0) + this.mouse.y * 0.06,
      ra.ry + (rb.ry - ra.ry) * e + rot(1) + this.mouse.x * 0.1,
      ra.rz + (rb.rz - ra.rz) * e + rot(2),
    );
    this.camera.position.x += (this.mouse.x * 0.35 - this.camera.position.x) * Math.min(1, dt * 2);
    this.camera.position.y += (this.mouse.y * 0.25 - this.camera.position.y) * Math.min(1, dt * 2);
    this.camera.lookAt(0, 0, 0);
    this.group.updateMatrixWorld(true);

    for (const m of [this.pMat, this.lMat]) {
      const u = m.uniforms;
      u.uA.value = a;
      u.uB.value = b;
      u.uMix.value = t;
      u.uTime.value = time;
      u.uDrift.value = ra.drift * (1 - e) + rb.drift * e;
      u.uMouse.value = [this.mouse.x, this.mouse.y];
      u.uMouseOn.value = this.mouse.on;
      u.uHiLayout.value = this.hi.layout;
      u.uHiGroup.value = this.hi.group;
    }
    this.lMat.uniforms.uGrow.value = this.grow;

    // 最後の線
    const cw = this.weight(L.CONNECT);
    this.beam.visible = cw > 0.5 && this.beamP > 0.001;
    if (this.beam.visible) {
      const p0 = this.built.anchors[L.CONNECT][0];
      const p1 = this.built.anchors[L.CONNECT][1];
      (this.bMat.uniforms.uP0.value as Vector3).set(p0[0], p0[1], p0[2]).applyMatrix4(this.group.matrixWorld);
      (this.bMat.uniforms.uP1.value as Vector3).set(p1[0], p1[1], p1[2]).applyMatrix4(this.group.matrixWorld);
      this.bMat.uniforms.uDraw.value = Math.min(1, this.beamP * 1.02);
      this.bMat.uniforms.uTime.value = time;
    }

    for (const fn of this.onFrame) fn(this);
    this.renderer.render(this.scene, this.camera);
  }
}
