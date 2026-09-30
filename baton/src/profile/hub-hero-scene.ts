import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';

/**
 * Baton トップ（/profile/）のヒーロー。
 *
 * 「いい人から、いい人へ、光が手渡される」瞬間を、白い紙の上の光で描く。
 *   1. 左から、赤と金の光（バトン）が絹のリボンを描きながら運ばれてくる
 *   2. 右からは、受け取る側の淡い金の光が近づいてくる
 *   3. 中央で2つが重なった瞬間に、やわらかな金の光だまりと水面の波紋、
 *      金の粉がふわりと広がる（＝バトンが渡る）
 *   4. 光は右端まで渡りきり、リボンとして残る。以後は数本のリボンの上を、
 *      小さな光が次の人へ次の人へと流れ続ける
 *
 * 白地では光を「足す」と色が飛ぶので、すべて地の色へ「混ぜて」描く。
 * 全画面の板1枚（フラグメントシェーダ）と、金の粉の粒だけで描く。
 * 座標は「縦が -0.5〜0.5、横はアスペクト比ぶん」の平面にそろえている。
 */

const IMPACT_AT = 1.35; // バトンが渡るまでの秒数
const SETTLE = 0.9; // 渡ったあと、光が右端まで届くまでの秒数

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const quadFragment = /* glsl */ `
  precision highp float;
  uniform vec2  uRes;
  uniform float uTime;
  uniform float uIntro;
  uniform vec2  uMouse;
  uniform vec3  uRed;
  uniform vec3  uGold;
  uniform vec3  uPaper;
  uniform vec3  uChamp;
  uniform float uLineY;
  uniform float uLow;
  varying vec2 vUv;

  const float IMPACT = ${IMPACT_AT.toFixed(3)};
  const float SETTLE = ${SETTLE.toFixed(3)};

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      if (uLow > 0.5 && i == 3) break;
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // 主役のリボン。中央（タイトルの下）でだけ線の高さに一致し、左右へ向かってゆるやかに波打つ
  float mainRibbonY(float x, float y0, float time) {
    float spread = smoothstep(0.0, 0.9, abs(x));
    return y0 + (sin(x * 2.3 + time * 0.25) * 0.055 + sin(x * 5.1 - time * 0.18) * 0.012) * spread;
  }

  // 背景に流れる、絹のリボン
  float silkY(float x, float base, float amp, float k, float phase, float time) {
    return base + sin(x * k + phase + time * 0.21) * amp + sin(x * k * 2.1 - phase * 1.3 - time * 0.13) * amp * 0.28;
  }

  // 曲線 y=f(x) までのおおよその距離（傾きで補正）
  float curveDist(vec2 p, float y, float slope) {
    return abs(p.y - y) / sqrt(1.0 + slope * slope);
  }

  // 色を「地へ混ぜる」。白地の上で光を描くための基本操作
  vec3 over(vec3 base, vec3 col, float a) {
    return mix(base, col, clamp(a, 0.0, 1.0));
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float halfW = aspect * 0.5;
    float t = uIntro;
    float time = uTime;
    float y0 = uLineY - 0.5;
    vec2 center = vec2(0.0, y0);
    vec2 mouse = uMouse * vec2(halfW, 0.5);

    // ── 紙と、にじむ水彩 ─────────────────────
    vec2 fp = p * 1.6 + vec2(time * 0.018, -time * 0.012);
    float wash = fbm(fp + fbm(fp * 0.8 + time * 0.015) * 0.8);
    vec3 col = uPaper;
    col = over(col, mix(uPaper, uRed, 0.3), smoothstep(0.6, 0.95, wash) * 0.07);
    col = over(col, mix(uPaper, uChamp, 0.6), smoothstep(0.5, 0.95, fbm(fp * 0.7 + 7.3)) * 0.12);
    // 天井から、タイトルへ落ちるやわらかな光
    col = mix(col, vec3(1.0), 0.35 * exp(-pow(length((p - vec2(0.0, y0 + 0.18)) * vec2(0.8, 1.3)), 2.0) * 3.0));

    float stage = smoothstep(IMPACT - 0.2, IMPACT + 1.6, t);

    // ── 背景の絹のリボン（渡ったあとに現れる） ──
    if (stage > 0.0) {
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        if (uLow > 0.5 && i == 2) break;
        float base = y0 + (fi - 1.0) * 0.21 + 0.05;
        float amp = 0.06 + fi * 0.015;
        float k = 1.6 + fi * 0.55;
        float ph = fi * 2.1 + uMouse.x * 0.35;
        float y = silkY(p.x, base, amp, k, ph, time);
        float dx = 0.002;
        float slope = (silkY(p.x + dx, base, amp, k, ph, time) - y) / dx;
        float d = curveDist(p, y, slope);
        vec3 c = mix(uRed, uGold, 0.35 + fi * 0.25);
        float body = exp(-d * d * 42000.0) * 0.55 + exp(-d * 90.0) * 0.10;
        // 絹の艶: ところどころ明るく
        float sheen = 0.55 + 0.45 * sin(p.x * 3.0 - time * 0.6 + fi);
        // リボンの上を流れる小さな光（次の人へ渡るバトン）
        float head = fract(time * (0.07 + fi * 0.018) + fi * 0.41);
        float hx = mix(-halfW - 0.1, halfW + 0.1, head);
        float pulse = exp(-pow((p.x - hx) * 9.0, 2.0)) * exp(-d * 60.0);
        float edge = smoothstep(halfW + 0.02, halfW - 0.25, abs(p.x));
        col = over(col, c, body * sheen * stage * edge * 0.75);
        col = over(col, uChamp, pulse * stage * edge * 0.8);
        col = mix(col, vec3(1.0), pulse * exp(-d * 300.0) * 0.8 * stage);
      }
    }

    // ── 主役のリボン（バトンの軌跡） ─────────────
    float travel = clamp(t / IMPACT, 0.0, 1.0);
    float ease = 1.0 - pow(1.0 - travel, 2.2);
    float headL = mix(-halfW - 0.2, 0.0, ease);
    float headR = mix(halfW + 0.2, 0.0, ease);
    float after = clamp((t - IMPACT) / SETTLE, 0.0, 1.0);
    float reach = t > IMPACT ? mix(0.0, halfW + 0.3, 1.0 - pow(1.0 - after, 3.0)) : headL;

    float my = mainRibbonY(p.x, y0, time);
    float mslope = (mainRibbonY(p.x + 0.002, y0, time) - my) / 0.002;
    float md = curveDist(p, my, mslope);
    float lit = smoothstep(reach + 0.01, reach - 0.08, p.x);
    // 左から来た光が通ったところだけリボンになる
    float ribbonA = exp(-md * md * 30000.0) * 0.85 + exp(-md * 70.0) * 0.16;
    vec3 ribbonC = mix(uRed, uGold, smoothstep(-halfW, halfW, p.x) * 0.8);
    float fadeEdge = smoothstep(halfW + 0.05, halfW - 0.3, abs(p.x));
    col = over(col, ribbonC, ribbonA * lit * mix(1.0, fadeEdge, stage));
    // 中心のハイライト（絹の光沢）
    col = mix(col, vec3(1.0, 0.95, 0.86), exp(-md * md * 260000.0) * lit * 0.55);

    // ── 運ばれてくる2つの光 ──────────────────
    if (t < IMPACT + 0.25) {
      float on = smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(IMPACT, IMPACT + 0.25, t));
      vec2 pl = vec2(headL, mainRibbonY(headL, y0, time));
      vec2 pr = vec2(headR, mainRibbonY(headR, y0, time));
      float dl = length(p - pl);
      float dr = length(p - pr);
      // 渡す側: 赤い芯に、シャンパン色の光輪と横に伸びる光
      col = over(col, uChamp, exp(-dl * 12.0) * 0.7 * on);
      col = over(col, mix(uChamp, uRed, 0.25), exp(-abs(p.y - pl.y) * 140.0) * exp(-abs(p.x - pl.x) * 9.0) * 0.6 * on);
      col = over(col, uRed, exp(-dl * dl * 4200.0) * 0.95 * on);
      col = mix(col, vec3(1.0), exp(-dl * dl * 30000.0) * on);
      // 受け取る側: 淡い金の光
      col = over(col, uChamp, exp(-dr * 14.0) * 0.6 * on);
      col = over(col, uGold, exp(-dr * dr * 5200.0) * 0.85 * on);
      col = mix(col, vec3(1.0), exp(-dr * dr * 34000.0) * on);
    }

    // ── 渡る瞬間: 光だまりと、水面の波紋 ─────────
    float since = t - IMPACT;
    if (since > 0.0) {
      vec2 q = (p - center) * vec2(1.0, 1.15);
      float d = length(q);
      float bloom = exp(-since * 2.2);
      // シャンパン色の光だまりが、ふわっと広がって溶ける
      float halo = exp(-pow(d / (0.1 + since * 0.5), 2.0));
      col = over(col, uChamp, halo * bloom * 0.85);
      // 中心から、やわらかな光の筋（後光）が放たれる
      float ang = atan(q.y, q.x);
      float rays = pow(noise(vec2(ang * 7.0, 3.1)) * 0.6 + noise(vec2(ang * 17.0, since * 0.4 + 9.0)) * 0.4, 2.2);
      float rayLen = exp(-d / (0.12 + since * 0.55));
      col = over(col, mix(uChamp, uGold, 0.25), rays * rayLen * exp(-since * 1.5) * smoothstep(0.0, 0.1, since) * 0.9);
      col = mix(col, vec3(1.0), exp(-d * d * 140.0) * bloom);
      // 2本の、やわらかな波紋。赤から金へ色が移る
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float s = since - fk * 0.3;
        if (s <= 0.0) continue;
        float r = s * (0.5 - fk * 0.12);
        float w = exp(-pow((d - r) * 70.0, 2.0));
        float fade = exp(-s * 1.6) * smoothstep(0.0, 0.1, s);
        col = over(col, mix(uChamp, mix(uRed, uGold, 0.6), 0.3), w * fade * 0.55);
        col = mix(col, vec3(1.0), exp(-pow((d - r + 0.012) * 160.0, 2.0)) * fade * 0.8);
      }
    }

    // マウスのまわりだけ、紙が少し明るむ
    col = mix(col, vec3(1.0, 0.985, 0.95), exp(-length(p - mouse) * 5.0) * 0.18);

    // 周辺をわずかに沈め、紙の繊維のような粒を足す
    float vig = smoothstep(1.3, 0.3, length(p * vec2(0.8 / max(aspect, 1.0) * 1.6, 1.2)));
    col *= mix(0.975, 1.0, vig);
    col += (hash(gl_FragCoord.xy + fract(time) * 91.0) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** バトンが渡った瞬間に舞う金の粉。ゆっくり広がり、少し浮かんで消える */
const dustVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  uniform float uIntro;
  uniform float uTime;
  uniform float uAspect;
  uniform float uLineY;
  uniform float uPixelRatio;
  varying float vAge;
  varying float vSeed;
  const float IMPACT = ${IMPACT_AT.toFixed(3)};
  void main() {
    float t = uIntro - IMPACT - aSeed * 0.15;
    vAge = t / aLife;
    vSeed = aSeed;
    vec2 dir = vec2(cos(aAngle), sin(aAngle) * 0.75);
    float drag = 1.6;
    vec2 pos = vec2(0.0, uLineY - 0.5) + dir * aSpeed * (1.0 - exp(-drag * max(t, 0.0))) / drag;
    // 最後はふわりと浮かぶ
    pos.y += 0.03 * max(t, 0.0) * max(t, 0.0);
    pos.x += sin(uTime * 1.3 + aSeed * 40.0) * 0.006 * max(t, 0.0);
    vec2 clip = vec2(pos.x / (uAspect * 0.5), pos.y / 0.5);
    gl_Position = vec4(clip, 0.0, 1.0);
    float alive = step(0.0, t) * step(vAge, 1.0);
    gl_PointSize = aSize * (aSeed > 0.6 ? 3.2 : 1.0) * uPixelRatio * (1.0 - vAge * 0.5) * alive;
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uRed;
  uniform vec3 uGold;
  varying float vAge;
  varying float vSeed;
  void main() {
    if (vAge < 0.0 || vAge > 1.0) discard;
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d);
    vec3 col = mix(uGold, uRed, step(0.8, vSeed) * 0.7);
    float life = smoothstep(0.0, 0.08, vAge) * (1.0 - vAge);
    // 十字のきらめき（大きい粒だけ）
    vec2 c = gl_PointCoord - 0.5;
    float glint = max(exp(-abs(c.x) * 40.0) * exp(-abs(c.y) * 4.0), exp(-abs(c.y) * 40.0) * exp(-abs(c.x) * 4.0));
    float tw = step(0.6, vSeed) * (0.5 + 0.5 * sin(vAge * 30.0 + vSeed * 50.0));
    gl_FragColor = vec4(mix(col, vec3(1.0, 0.97, 0.88), tw * 0.4), max(a, glint * tw) * life * 0.95);
  }
`;

/** ずっと漂う、ごく淡い金の粒 */
const floatVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uTime;
  uniform float uIntro;
  uniform float uAspect;
  uniform float uPixelRatio;
  uniform vec2 uMouse;
  varying float vTw;
  varying float vIn;
  const float IMPACT = ${IMPACT_AT.toFixed(3)};
  void main() {
    float speed = 0.012 + aSeed * 0.025;
    float y = mod(aStart.y + uTime * speed + 0.6, 1.2) - 0.6;
    float x = aStart.x * uAspect * 0.5 + sin(uTime * 0.4 + aSeed * 30.0) * 0.02 + uMouse.x * 0.02 * aStart.z;
    vec2 clip = vec2(x / (uAspect * 0.5), y / 0.5);
    gl_Position = vec4(clip, 0.0, 1.0);
    vTw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);
    vIn = smoothstep(IMPACT, IMPACT + 2.0, uIntro) * smoothstep(0.6, 0.25, abs(y));
    gl_PointSize = (1.2 + aStart.z * 2.4) * uPixelRatio;
  }
`;

const floatFragment = /* glsl */ `
  uniform vec3 uGold;
  varying float vTw;
  varying float vIn;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(uGold, a * vTw * vIn * 0.55);
  }
`;

export type HubHeroOptions = {
  /** 画面上で「バトンの線」を引く高さ（ヒーロー上端からの比率 0〜1） */
  lineY: () => number;
  /** バトンが渡った瞬間に呼ぶ。文字の点灯と同期させるため */
  onImpact: () => void;
  /** 読み込みが遅れて先に文字を点灯させたとき。渡る瞬間を飛ばして余韻から始める */
  skipIntro?: boolean;
  red?: string;
  gold?: string;
  paper?: string;
};

export function mountHubHeroScene(canvas: HTMLCanvasElement, opts: HubHeroOptions): () => void {
  const low = isLowPower();
  const renderer = makeRenderer(canvas);
  // 全画面シェーダは画素数がそのまま負荷になる。見た目が崩れない範囲で下げる
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));
  const scene = new Scene();
  const camera = new Camera();
  const red = new Color(opts.red ?? '#C8102E');
  const gold = new Color(opts.gold ?? '#C9A052');
  const paper = new Color(opts.paper ?? '#FDFCFA');
  // 光の色。白地で「光って」見えるよう、紙よりわずかに色の濃いシャンパンゴールド
  const champ = new Color('#F1D9A6');

  const quadMat = new ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: quadFragment,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uRes: { value: [1, 1] },
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uMouse: { value: [0, 0] },
      uRed: { value: red },
      uGold: { value: gold },
      uPaper: { value: paper },
      uChamp: { value: champ },
      uLineY: { value: 0.5 },
      uLow: { value: low ? 1 : 0 },
    },
  });
  const quadGeo = new PlaneGeometry(2, 2);
  const quad = new Mesh(quadGeo, quadMat);
  quad.frustumCulled = false;
  scene.add(quad);

  // 金の粉
  const dustCount = low ? 260 : 620;
  const dustGeo = new BufferGeometry();
  const angle = new Float32Array(dustCount);
  const speed = new Float32Array(dustCount);
  const life = new Float32Array(dustCount);
  const size = new Float32Array(dustCount);
  const dseed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    angle[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.08 + Math.random() ** 1.6 * 0.75;
    life[i] = 1.4 + Math.random() * 2.2;
    size[i] = 1.4 + Math.random() * 3.2;
    dseed[i] = Math.random();
  }
  dustGeo.setAttribute('position', new BufferAttribute(new Float32Array(dustCount * 3), 3));
  dustGeo.setAttribute('aAngle', new BufferAttribute(angle, 1));
  dustGeo.setAttribute('aSpeed', new BufferAttribute(speed, 1));
  dustGeo.setAttribute('aLife', new BufferAttribute(life, 1));
  dustGeo.setAttribute('aSize', new BufferAttribute(size, 1));
  dustGeo.setAttribute('aSeed', new BufferAttribute(dseed, 1));
  const dustMat = new ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
    uniforms: {
      uIntro: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uLineY: { value: 0.5 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uRed: { value: red },
      uGold: { value: gold },
    },
  });
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // 漂う金の粒
  const floatCount = low ? 70 : 180;
  const floatGeo = new BufferGeometry();
  const start = new Float32Array(floatCount * 3);
  const fseed = new Float32Array(floatCount);
  for (let i = 0; i < floatCount; i += 1) {
    start[i * 3] = (Math.random() - 0.5) * 2;
    start[i * 3 + 1] = Math.random() * 1.2 - 0.6;
    start[i * 3 + 2] = Math.random();
    fseed[i] = Math.random();
  }
  floatGeo.setAttribute('position', new BufferAttribute(new Float32Array(floatCount * 3), 3));
  floatGeo.setAttribute('aStart', new BufferAttribute(start, 3));
  floatGeo.setAttribute('aSeed', new BufferAttribute(fseed, 1));
  const floatMat = new ShaderMaterial({
    vertexShader: floatVertex,
    fragmentShader: floatFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uAspect: { value: 1 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMouse: { value: [0, 0] },
      uGold: { value: gold },
    },
  });
  const floaters = new Points(floatGeo, floatMat);
  floaters.frustumCulled = false;
  scene.add(floaters);

  const pointer = pointerTracker(canvas);
  const syncLine = () => {
    // シェーダの uv は下が0。DOMは上が0なので反転する
    const y = 1 - opts.lineY();
    quadMat.uniforms.uLineY.value = y;
    dustMat.uniforms.uLineY.value = y;
  };

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    (quadMat.uniforms.uRes.value as number[])[0] = w;
    (quadMat.uniforms.uRes.value as number[])[1] = h;
    dustMat.uniforms.uAspect.value = aspect;
    floatMat.uniforms.uAspect.value = aspect;
    const ratio = renderer.getPixelRatio();
    dustMat.uniforms.uPixelRatio.value = ratio;
    floatMat.uniforms.uPixelRatio.value = ratio;
    syncLine();
  });
  syncLine();

  canvas.classList.add('is-ready');
  let introStart = -1;
  let impacted = Boolean(opts.skipIntro);
  // 渡る瞬間を飛ばすときは、金の粉が消えきった時点から始める
  const introOffset = opts.skipIntro ? IMPACT_AT + 5 : 0;

  const loop = startLoop(canvas, (elapsed) => {
    if (introStart < 0) introStart = elapsed;
    const intro = elapsed - introStart + introOffset;
    if (!impacted && intro >= IMPACT_AT) {
      impacted = true;
      opts.onImpact();
    }
    const m = pointer.update(low ? 0.08 : 0.05);
    quadMat.uniforms.uTime.value = elapsed;
    quadMat.uniforms.uIntro.value = intro;
    (quadMat.uniforms.uMouse.value as number[])[0] = m.x;
    (quadMat.uniforms.uMouse.value as number[])[1] = m.y;
    dustMat.uniforms.uIntro.value = intro;
    dustMat.uniforms.uTime.value = elapsed;
    floatMat.uniforms.uTime.value = elapsed;
    floatMat.uniforms.uIntro.value = intro;
    (floatMat.uniforms.uMouse.value as number[])[0] = m.x;
    dust.visible = intro < IMPACT_AT + 4.5;
    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    quadGeo.dispose();
    quadMat.dispose();
    dustGeo.dispose();
    dustMat.dispose();
    floatGeo.dispose();
    floatMat.dispose();
    renderer.dispose();
  };
}
