import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Texture, TextureLoader, Vector2, Vector3, Vector4, WebGLRenderer } from 'three';
import { onPerfLevel, perfLevel, reportFrame } from './perf';
import type { SceneOptions } from './scene';

/**
 * 「印刷」のシーン（presto の世界観。BE.PRESTO の誌面『PRESTO』）。
 *
 *  写真あり（host の data-img）… 表紙の写真を、45度の網点で刷る。
 *    最初は版がずれていて（青と赤が左右にずれる）、網点も粗い。1秒ほどで版が合い、写真になる。
 *    カーソルの下だけ網点が粗く見える（ルーペで印刷物をのぞいたとき）。押すと、そこから波紋が広がる。
 *  写真なし（下層のヒーロー・CTA帯）… 青い網点のインクが、ゆっくり動く。カーソルの下と波紋は同じ。
 *
 * 色は CSS 変数から（--scene-a＝網点の青、--scene-b＝紙の生成り、--scene-match＝版の黒）。
 * 写真の色は sRGB のまま扱う（three の色管理を通さない）。動きを減らす設定では、版が合った最後の一枚だけ描く。
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uFocus;
uniform float uTime;
uniform float uIntro;
uniform float uDpr;
uniform vec2 uMouse;
uniform float uLens;
uniform float uAmbient;
uniform vec3 uInk;
uniform vec3 uBlue;
uniform vec3 uPaper;
uniform vec4 uRip[4];
varying vec2 vUv;

// object-fit: cover と object-position を、テクスチャの座標で
vec2 coverUv(vec2 uv) {
  float ca = uRes.x / uRes.y;
  float ia = uImg.x / uImg.y;
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  return uv * s + (1.0 - s) * uFocus;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;

  // 波紋：押した点から輪が広がり、網点を押し広げる
  vec2 disp = vec2(0.0);
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 2.4) {
      vec2 d = frag - r.xy;
      float dist = length(d);
      float rad = age * 820.0 * uDpr;
      float band = exp(-pow((dist - rad) / (42.0 * uDpr), 2.0));
      float fade = (1.0 - age / 2.4) * r.w;
      disp += (dist > 0.001 ? d / dist : vec2(0.0)) * band * fade * 9.0 * uDpr;
      ring += band * fade;
    }
  }
  vec2 p = frag - disp;

  // 網点の大きさ：ふだんは細かく、カーソルの下・刷りはじめ・波紋では粗く
  float lens = uLens * (1.0 - smoothstep(50.0 * uDpr, 240.0 * uDpr, distance(frag, uMouse)));
  float coarse = clamp(max(lens, 1.0 - uIntro) + ring * 0.7, 0.0, 1.0);
  float cell = mix((uHasTex > 0.5 ? 4.2 : 7.0) * uDpr, 15.0 * uDpr, coarse);

  // 45度の網目
  const float C = 0.70710678;
  vec2 q = vec2(C * p.x - C * p.y, C * p.x + C * p.y);
  vec2 cq = (floor(q / cell) + 0.5) * cell;
  vec2 center = vec2(C * cq.x + C * cq.y, -C * cq.x + C * cq.y);
  float dist = length(q - cq) / cell;
  float aa = 1.1 / cell * uDpr;

  if (uHasTex > 0.5) {
    vec3 c = texture2D(uTex, coverUv(center / uRes)).rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float rad = sqrt(lum) * 0.64;
    float dd = 1.0 - smoothstep(rad - aa, rad + aa, dist);
    vec3 ht = mix(uInk, min(c * 1.18 + 0.03, vec3(1.0)), dd);

    // 版ずれ：赤と青の版が左右にずれて刷られ、だんだん合う
    float reg = (1.0 - uIntro) * 0.016 + ring * 0.004;
    vec2 uvP = coverUv(p / uRes);
    vec3 photo = vec3(texture2D(uTex, uvP + vec2(reg, 0.0)).r, texture2D(uTex, uvP).g, texture2D(uTex, uvP - vec2(reg, reg * 0.35)).b);
    float pl = dot(photo, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(photo, mix(uInk, uPaper, pl), 0.16);
    float k = clamp(0.2 + coarse * 0.8, 0.0, 1.0);
    gl_FragColor = vec4(mix(graded, ht, k), 1.0);
    return;
  }

  // 写真なし：青い網点のインクが、ゆっくり流れる
  vec2 sp = center / uRes.y;
  float v = fbm(sp * 2.4 + vec2(uTime * 0.035, -uTime * 0.022));
  v = smoothstep(0.38, 0.86, v);
  float mask = uAmbient > 0.5 ? 0.5 : smoothstep(0.15, 0.95, center.x / uRes.x);
  v = v * mask * uIntro;
  v = max(v, lens * 0.42) + ring * 0.55;
  float rad = sqrt(clamp(v, 0.0, 1.0)) * 0.56;
  float dd = 1.0 - smoothstep(rad - aa, rad + aa, dist);
  vec3 ink = mix(uBlue, uPaper, smoothstep(0.75, 1.0, v) * 0.5);
  gl_FragColor = vec4(ink * dd, dd * 0.9);
}`;

/** '#4FB8EC' → sRGB のままの 0〜1 */
function rgb(hex: string): Vector3 {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

type Ripple = Vector4;

export class PressScene {
  phase = 0;
  target = 0;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private u: Record<string, { value: unknown }>;
  private start = performance.now();
  private raf = 0;
  private visible = true;
  private frames = 0;
  private lastAt = 0;
  private ready = false;
  private photo: boolean;
  private lens = 0;
  private lensGoal = 0;
  private mouse = new Vector2(-9999, -9999);
  private ripples: Ripple[] = [];
  private nextRip = 0;
  private introAt = -1;

  constructor(private o: SceneOptions) {
    const src = o.host.dataset.img;
    this.photo = Boolean(src);
    this.renderer = new WebGLRenderer({ canvas: o.canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    onPerfLevel((l) => {
      if (l === 1) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
        this.resize();
      } else if (l === 2) {
        cancelAnimationFrame(this.raf);
        this.still();
      }
    });

    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const [fx, fy] = (o.host.dataset.focus ?? '50,40').split(',').map((n) => Number(n) / 100);
    const [iw, ih] = (o.host.dataset.imgSize ?? '1000,1250').split(',').map(Number);
    for (let i = 0; i < 4; i++) this.ripples.push(new Vector4(0, 0, -100, 0));
    this.u = {
      uTex: { value: null as Texture | null },
      uHasTex: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uImg: { value: new Vector2(iw, ih) },
      // object-position は上から。テクスチャの座標は下から
      uFocus: { value: new Vector2(fx, 1 - fy) },
      uTime: { value: 0 },
      uIntro: { value: o.animate ? 0 : 1 },
      uDpr: { value: this.renderer.getPixelRatio() },
      uMouse: { value: this.mouse },
      uLens: { value: 0 },
      uAmbient: { value: o.mode === 'aurora' ? 1 : 0 },
      uInk: { value: rgb(v('--scene-match', '#0B0E0F')) },
      uBlue: { value: rgb(v('--scene-a', '#4FB8EC')) },
      uPaper: { value: rgb(v('--scene-b', '#F1ECE2')) },
      uRip: { value: this.ripples },
    };
    const mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false }),
    );
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    new ResizeObserver(() => this.resize()).observe(o.host);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.kick();
    }).observe(o.host);
    this.resize();

    const begin = () => {
      this.ready = true;
      this.start = performance.now();
      o.host.classList.add('is-ready');
      if (o.animate) {
        // 版が合ったところで、一度だけ波紋（写真なら顔のあたりから）
        this.introAt = 1.15;
        this.kick();
      } else {
        this.still();
      }
    };
    if (src) {
      new TextureLoader().load(
        src,
        (tex) => {
          tex.generateMipmaps = false;
          this.u.uTex.value = tex;
          this.u.uHasTex.value = 1;
          begin();
        },
        undefined,
        () => o.host.classList.add('is-fallback'),
      );
    } else {
      begin();
    }

    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      const area = o.host.closest('section') ?? o.host;
      area.addEventListener('pointerdown', this.onDown);
      document.addEventListener('visibilitychange', () => !document.hidden && this.kick());
    }
  }

  private now(): number {
    return (performance.now() - this.start) / 1000;
  }

  /** 端末の画素で、host の中の位置（y は下から） */
  private local(e: PointerEvent): Vector2 | null {
    const r = this.o.host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
    const d = this.renderer.getPixelRatio();
    return new Vector2(x * d, (r.height - y) * d);
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const at = this.local(e);
    this.lensGoal = at ? 1 : 0;
    if (at) this.mouse.copy(at);
    // 網点はカーソルについて動くので、ルーペが出ているあいだは描き直す
    if (at || this.lens > 0.002) this.kick();
  };

  private onDown = (e: PointerEvent) => {
    // リンクやボタンを押したときは、波紋を出さない
    if ((e.target as HTMLElement).closest('a, button')) return;
    const at = this.local(e);
    if (at) this.ripple(at, 1);
  };

  private ripple(at: Vector2, power: number) {
    const r = this.ripples[this.nextRip];
    this.nextRip = (this.nextRip + 1) % this.ripples.length;
    r.set(at.x, at.y, this.now(), power);
    this.kick();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const d = this.renderer.getPixelRatio();
    (this.u.uRes.value as Vector2).set(w * d, h * d);
    this.u.uDpr.value = d;
    if (this.ready && (!this.o.animate || perfLevel() === 2)) this.render();
  }

  private render() {
    this.u.uTime.value = this.now();
    this.renderer.render(this.scene, this.camera);
  }

  private still() {
    if (!this.ready) return;
    this.u.uIntro.value = 1;
    this.u.uLens.value = 0;
    this.render();
  }

  /** 何か動くものがあるときだけ、描き続ける */
  private busy(): boolean {
    const t = this.now();
    if ((this.u.uIntro.value as number) < 1) return true;
    // ルーペは、大きさが変わっているあいだだけ（止まったカーソルの下は描き直さない）
    if (Math.abs(this.lens - this.lensGoal) > 0.002) return true;
    if (this.ripples.some((r) => t - r.z < 2.5)) return true;
    if (this.introAt > 0) return true;
    return !this.photo; // 写真のないインクは、ゆっくり流れ続ける
  }

  private kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  private loop = () => {
    this.raf = 0;
    if (!this.ready || !this.visible || document.hidden || !this.o.animate) {
      this.lastAt = 0;
      return;
    }
    if (perfLevel() === 2) return this.still();
    this.frames += 1;
    const intro = this.u.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 1 / 66);
    this.lens += (this.lensGoal - this.lens) * 0.12;
    this.u.uLens.value = this.lens;
    const t = this.now();
    if (this.introAt > 0 && t > this.introAt) {
      this.introAt = -1;
      const res = this.u.uRes.value as Vector2;
      const f = this.u.uFocus.value as Vector2;
      this.ripple(new Vector2(res.x * (this.photo ? f.x : 0.72), res.y * (this.photo ? 0.62 : 0.5)), 0.55);
    }
    if (perfLevel() === 1 && this.frames % 2) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this.render();
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
    if (this.busy()) this.raf = requestAnimationFrame(this.loop);
    else this.lastAt = 0;
  };
}
