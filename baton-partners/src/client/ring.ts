import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderer } from 'three';
import { onPerfLevel, perfLevel, reportFrame } from './perf';
import type { SceneOptions } from './scene';

/**
 * 「響く」のシーン（presto の世界観。BE.PRESTO の「Be Fast to Ring the Bell」）。
 *
 *  夜の黒の上に、細かい点が方眼に並ぶ（まだ届いていない価値）。右の一点で鐘が鳴るたびに、
 *  音の輪が広がって、通り過ぎた点を BP の青に光らせる。輪はスクロールの段階で形を変える。
 *    ヒーロー（phase 0.55）… 丸い輪が、ゆっくり広がる
 *    採用SNS（0.8）     … 点が縦長のリールの形になる
 *    AI研修（1.0）       … 輪が四角になり、方眼にそって進む（型にして、仕組みにする）
 *    人材紹介（2.0）     … 鐘がもう一つ鳴り、二つの輪が重なったところだけ強く光る（会社と人が出会う）
 *  カーソルの下は点が大きくなり、押すとそこからも輪が広がる。
 *  CTA帯（mode 'aurora'）と下層のヒーローでは、右寄りの鐘が静かに鳴り続ける。
 *
 * 色は CSS 変数から（--scene-a＝点の青、--scene-b＝輪の明るい青、--scene-match＝重なりの白）。
 * 動きを減らす設定では、輪が3本広がったところの一枚だけ描く。
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uIntro;
uniform float uPhase;
uniform vec2 uSrc;
uniform vec2 uSrc2;
uniform vec2 uMouse;
uniform float uLens;
uniform float uAmbient;
uniform vec3 uBlue;
uniform vec3 uHi;
uniform vec3 uWhite;
uniform vec4 uRip[4];
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bump(float x, float c, float w) { return 1.0 - smoothstep(0.0, w, abs(x - c)); }

// 1本の輪：先頭は鋭く、少しだけ尾を引く
float narrow(float x) {
  return smoothstep(0.0, 0.012, x) * (1.0 - smoothstep(0.012, 0.075, x));
}
// 鐘を1回鳴らすと、輪が3本続いて広がる（あとの輪ほど弱い）。w は 0〜1 の位相
float band(float w) {
  return narrow(w) + narrow(w - 0.1) * 0.55 + narrow(w - 0.2) * 0.3;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float maxD = length(uRes);

  // 方眼の点（スマホは少し粗く）
  float cell = (uRes.x < 760.0 * uDpr ? 11.0 : 13.0) * uDpr;
  vec2 id = floor(frag / cell);
  vec2 c = (id + 0.5) * cell;
  vec2 lp = (frag - c) / cell; // -0.5〜0.5

  float kReel = bump(uPhase, 0.8, 0.16);
  float kGrid = bump(uPhase, 1.0, 0.13);
  float kPair = smoothstep(1.2, 1.85, uPhase);

  // 鐘からの距離。AI研修では四角い輪（方眼にそって進む）
  vec2 dv = c - uSrc;
  float de = length(dv);
  float dc = max(abs(dv.x), abs(dv.y)) * 1.12;
  float d = mix(de, dc, kGrid);

  // 鐘を鳴らす間隔：速い（presto）。人材紹介では二つの鐘が交互に
  float period = mix(2.5, 1.9, kGrid + kPair * 0.5);
  float speed = 330.0 * uDpr;
  float w1 = fract(uTime / period - d / (speed * period));
  float att = exp(-d / (0.95 * maxD));
  float r1 = band(w1) * att * 1.15;

  float d2 = length(c - uSrc2);
  float w2 = fract(uTime / period + 0.5 - d2 / (speed * period));
  float r2 = band(w2) * exp(-d2 / (0.85 * maxD)) * kPair;

  // 重なり：二つの輪が同時に通るところ
  float meet = min(r1, r2 / max(kPair, 0.001)) * kPair * 2.4;
  float wave = max(r1, r2) + meet;

  // 押したところからの輪
  float rip = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 2.6) {
      float dist = length(c - r.xy);
      float rad = age * 520.0 * uDpr;
      rip += exp(-pow((dist - rad) / (26.0 * uDpr), 2.0)) * (1.0 - age / 2.6) * r.w;
    }
  }

  // 鐘のまわり：鳴った瞬間だけ強く光る芯と、細い縁
  float strike = pow(1.0 - fract(uTime / period), 6.0);
  float core = (1.0 - smoothstep(24.0 * uDpr, 96.0 * uDpr, de)) * (0.45 + strike * 1.0);
  float rim = exp(-pow((de - 128.0 * uDpr) / (6.0 * uDpr), 2.0)) * 0.55 + exp(-pow((de - 150.0 * uDpr) / (4.0 * uDpr), 2.0)) * 0.25;
  float core2 = (1.0 - smoothstep(18.0 * uDpr, 60.0 * uDpr, d2)) * (0.3 + pow(1.0 - fract(uTime / period + 0.5), 6.0) * 0.9) * kPair;

  // まだ届いていない点：うっすら。鐘に近いほど少し明るい
  float grain = hash(id);
  float base = 0.08 + 0.15 * exp(-de / (0.32 * maxD)) + grain * 0.05;
  if (uAmbient > 0.5) base *= 0.8;

  // 読み込んだとき：鐘から外へ、点が順に灯る
  float reveal = smoothstep(uIntro * maxD * 1.1 - 120.0 * uDpr, uIntro * maxD * 1.1, de);
  float on = 1.0 - reveal;

  float lens = uLens * (1.0 - smoothstep(30.0 * uDpr, 170.0 * uDpr, distance(c, uMouse)));
  float energy = clamp(wave + rip * 0.9 + core + core2 + rim + lens * 0.5, 0.0, 1.6);

  // 点の形：ふだんは丸、採用SNSでは縦長のリール（角の丸い 9:16）
  float size = mix(0.15, 0.42, clamp(energy, 0.0, 1.0)) + lens * 0.08;
  vec2 hs = mix(vec2(size), vec2(size * 0.62, size * 1.12), kReel);
  float rr = min(hs.x, hs.y) * mix(1.0, 0.5, kReel);
  vec2 q = abs(lp) - hs + rr;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
  float aa = 1.2 / cell * uDpr;
  float dm = 1.0 - smoothstep(-aa, aa, sd);

  vec3 col = mix(uBlue, uHi, smoothstep(0.15, 0.7, energy));
  col = mix(col, uWhite, smoothstep(0.85, 1.4, energy) * 0.85);
  float a = dm * on * clamp(base + energy * 0.95, 0.0, 1.0);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a);
}`;

/** '#4FB8EC' → sRGB のままの 0〜1 */
function rgb(hex: string): Vector3 {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class RingScene {
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
  private lens = 0;
  private lensGoal = 0;
  private mouse = new Vector2(-9999, -9999);
  private ripples: Vector4[] = [];
  private nextRip = 0;

  constructor(private o: SceneOptions) {
    this.phase = o.phase;
    this.target = o.phase;
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

    const css = getComputedStyle(o.host);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    for (let i = 0; i < 4; i++) this.ripples.push(new Vector4(0, 0, -100, 0));
    this.u = {
      uRes: { value: new Vector2(1, 1) },
      uDpr: { value: this.renderer.getPixelRatio() },
      uTime: { value: 0 },
      uIntro: { value: o.animate ? 0 : 1 },
      uPhase: { value: this.phase },
      uSrc: { value: new Vector2() },
      uSrc2: { value: new Vector2() },
      uMouse: { value: this.mouse },
      uLens: { value: 0 },
      uAmbient: { value: o.mode === 'aurora' ? 1 : 0 },
      uBlue: { value: rgb(v('--scene-a', '#1A91C9')) },
      uHi: { value: rgb(v('--scene-b', '#4FB8EC')) },
      uWhite: { value: rgb(v('--scene-match', '#FFFFFF')) },
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
    o.host.classList.add('is-ready');

    if (o.animate) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      const area = o.host.closest('section') ?? o.host;
      area.addEventListener('pointerdown', this.onDown);
      document.addEventListener('visibilitychange', () => !document.hidden && this.kick());
      this.kick();
    } else {
      this.still();
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
  };

  private onDown = (e: PointerEvent) => {
    // リンクやボタンを押したときは、輪を出さない
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label')) return;
    const at = this.local(e);
    if (!at) return;
    const r = this.ripples[this.nextRip];
    this.nextRip = (this.nextRip + 1) % this.ripples.length;
    r.set(at.x, at.y, this.now(), 1);
    this.kick();
  };

  /** 鐘の位置（y は下から）。PCのヒーローは右寄せ（左に見出し）、スマホは見出しの下、CTA帯・下層は右端寄り */
  private place() {
    const res = this.u.uRes.value as Vector2;
    const small = res.x / (this.u.uDpr.value as number) < 768;
    const s = this.u.uSrc.value as Vector2;
    const s2 = this.u.uSrc2.value as Vector2;
    if (this.o.layout === 'right' && !small) {
      s.set(res.x * 0.72, res.y * 0.5);
      // 人材紹介の段階で鳴る、もう一つの鐘：右上の端
      s2.set(res.x * 0.97, res.y * 0.74);
    } else if (this.o.layout === 'right') {
      s.set(res.x * 0.66, res.y * 0.76);
      s2.set(res.x * 0.12, res.y * 0.58);
    } else {
      s.set(res.x * (small ? 0.78 : 0.82), res.y * (small ? 0.72 : 0.5));
      s2.set(res.x * 0.55, res.y * 0.2);
    }
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.o.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const d = this.renderer.getPixelRatio();
    (this.u.uRes.value as Vector2).set(w * d, h * d);
    this.u.uDpr.value = d;
    this.place();
    if (!this.o.animate || perfLevel() === 2) this.still();
  }

  private render(t: number) {
    this.u.uTime.value = t;
    this.u.uPhase.value = this.phase;
    this.renderer.render(this.scene, this.camera);
  }

  /** 止めた一枚：輪が3本ほど広がったところ */
  private still() {
    this.u.uIntro.value = 1;
    this.u.uLens.value = 0;
    this.phase = this.target;
    this.render(1.35);
  }

  private kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  private loop = () => {
    this.raf = 0;
    if (!this.visible || document.hidden || !this.o.animate) {
      this.lastAt = 0;
      return;
    }
    if (perfLevel() === 2) return this.still();
    this.frames += 1;
    const intro = this.u.uIntro as { value: number };
    intro.value = Math.min(1, intro.value + 1 / 80);
    this.lens += (this.lensGoal - this.lens) * 0.12;
    this.u.uLens.value = this.lens;
    this.phase += (this.target - this.phase) * 0.06;
    if (perfLevel() === 1 && this.frames % 2) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this.render(this.now());
    const now = performance.now();
    if (this.frames > 3 && this.lastAt) reportFrame((now - this.lastAt) / (perfLevel() === 1 ? 2 : 1));
    this.lastAt = now;
    this.raf = requestAnimationFrame(this.loop);
  };
}
