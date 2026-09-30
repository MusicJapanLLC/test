import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  Mesh,
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
 * 「バトンが渡る瞬間」を光で見せる。
 *   1. 左端から、白熱したレーザーの閃光が尾を引いて走ってくる
 *   2. 画面中央で着弾。閃光・横に伸びるアナモルフィックの光条・
 *      色収差のかかった衝撃波リング・火花が同時に起きる
 *   3. 光は右端まで渡りきり、一本の「バトンの線」として残る
 *      （線の上を、次の走者へ渡る光のパルスが流れ続ける）
 *   4. 余韻として、煙の中をステージレーザーがゆっくり掃き、
 *      残り火が立ちのぼる。マウスに合わせてビームの向きと照り返しが動く
 *
 * 全画面の板1枚（フラグメントシェーダ）と、火花・残り火の粒2組だけで描く。
 * 座標は「縦が -0.5〜0.5、横はアスペクト比ぶん」の平面にそろえている。
 */

const IMPACT_AT = 1.05; // 着弾までの秒数
const SETTLE = 0.32; // 着弾後、光が右端まで渡りきるまでの秒数

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

  // 原点 o から角度 ang へ伸びるステージレーザー1本
  vec3 beam(vec2 p, vec2 o, float ang, vec3 col, float fog) {
    vec2 d = vec2(cos(ang), sin(ang));
    vec2 v = p - o;
    float along = dot(v, d);
    if (along < 0.0) return vec3(0.0);
    float perp = length(v - d * along);
    float core = exp(-perp * perp * 26000.0);
    float glow = exp(-perp * 14.0) * 0.22 * fog;
    float haze = exp(-perp * 3.0) * 0.05 * fog;
    float fall = exp(-along * 0.55);
    return col * (core * 0.9 + glow + haze) * fall;
  }

  // 着弾の衝撃波リング。半径を少しずつずらして、縁に色収差を出す
  float ring(vec2 p, vec2 c, float r, float w) {
    float d = length(p - c) - r;
    return exp(-d * d * w);
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

    // ── 煙と地 ────────────────────────────────
    vec2 fp = p * 2.1 + vec2(time * 0.028, -time * 0.018);
    float fog = fbm(fp + fbm(fp * 0.7 + time * 0.02) * 0.9);
    vec3 col = vec3(0.006, 0.005, 0.006);
    col += uRed * 0.11 * pow(fog, 2.2);
    col += uGold * 0.03 * pow(fog, 3.0) * smoothstep(0.6, -0.2, p.y);
    // 天井から、タイトルへ落ちる柔らかいスポット
    float cone = smoothstep(0.55, 0.0, abs(p.x) - (0.5 - p.y) * 0.35);
    col += vec3(1.0, 0.86, 0.72) * 0.045 * cone * smoothstep(-0.2, 0.5, p.y) * (0.6 + fog);

    // ── 走ってくる閃光（着弾まで）と、残る「バトンの線」 ──
    float travel = clamp(t / IMPACT, 0.0, 1.0);
    // 加速しながら中央へ。着弾後は一気に右端まで渡る
    float headX = mix(-halfW - 0.25, 0.0, travel * travel);
    float after = clamp((t - IMPACT) / SETTLE, 0.0, 1.0);
    headX = t > IMPACT ? mix(0.0, halfW + 0.3, 1.0 - pow(1.0 - after, 3.0)) : headX;

    float dy = p.y - y0;
    float lit = smoothstep(headX + 0.015, headX - 0.04, p.x);
    float behind = max(headX - p.x, 0.0);
    // 走っている間は尾が熱く、着弾後はやや落ち着いた光量で残る
    float trailHot = exp(-behind * 2.6) * (1.0 - after);
    float settled = smoothstep(IMPACT, IMPACT + 1.2, t);
    // 線の上を流れる光のパルス（次の走者へ渡るバトン）
    float px = p.x / aspect;
    float pulse = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float ph = fract(time * (0.09 + fk * 0.025) + fk * 0.37);
      float pos = mix(-0.6, 0.6, ph);
      pulse += exp(-pow((px - pos) * 22.0, 2.0)) * smoothstep(0.0, 0.1, ph) * smoothstep(1.0, 0.9, ph);
    }
    float lineI = lit * (0.42 + trailHot * 2.4 + settled * pulse * 1.6);
    float lineCore = exp(-dy * dy * 90000.0);
    float lineGlow = exp(-abs(dy) * 60.0) * 0.28 + exp(-abs(dy) * 9.0) * 0.06;
    col += mix(uRed, vec3(1.0, 0.9, 0.82), 0.55) * lineCore * lineI * 1.4;
    col += uRed * lineGlow * lineI * 1.3;

    // 閃光の頭（走っている間だけ）
    if (t < IMPACT + SETTLE) {
      vec2 hd = p - vec2(headX, y0);
      float head = exp(-dot(hd, hd) * 900.0) * 2.2 + exp(-length(hd) * 16.0) * 0.5;
      float streak = exp(-hd.y * hd.y * 16000.0) * exp(-abs(hd.x) * 7.0) * 1.6;
      float on = smoothstep(0.0, 0.08, t) * (1.0 - after);
      col += (vec3(1.0, 0.95, 0.9) * head + mix(uRed, uGold, 0.3) * streak) * on;
    }

    // ── 着弾 ──────────────────────────────────
    float since = t - IMPACT;
    if (since > 0.0) {
      float flash = exp(-since * 9.0);
      float d = length(p - center);
      // 白く焼ける芯は小さく鋭く、周りは赤く短く。画面全体を灰色にしない
      col += vec3(1.0, 0.95, 0.9) * flash * exp(-d * 7.0) * 2.6;
      col += uRed * flash * exp(-d * 1.8) * 0.9;
      // 横一文字に伸びる光条（アナモルフィック）
      float streak = exp(-dy * dy * 5200.0) * exp(-abs(p.x) * 0.9);
      col += mix(vec3(1.0, 0.9, 0.8), uGold, 0.35) * streak * (flash * 3.2 + 0.0);
      // 衝撃波リング 2本。赤・緑・青で半径をずらす
      float r1 = since * 1.35;
      float fade1 = exp(-since * 2.4) * smoothstep(0.0, 0.04, since);
      col += vec3(
        ring(p, center, r1 * 1.000, 9000.0),
        ring(p, center, r1 * 0.992, 9000.0),
        ring(p, center, r1 * 0.984, 9000.0)
      ) * fade1 * 1.3;
      // 衝撃波の内側に、ごく薄い熱の揺らぎ
      col += uRed * smoothstep(r1, r1 * 0.7, length(p - center)) * fade1 * 0.08;
      float r2 = since * 0.7;
      float fade2 = exp(-since * 2.0) * smoothstep(0.08, 0.2, since);
      col += mix(uRed, uGold, 0.5) * ring(p, center, r2, 16000.0) * fade2 * 0.9;
      // 着弾点の残光
      col += mix(uRed, uGold, 0.4) * exp(-d * 9.0) * 0.35 * smoothstep(0.0, 0.3, since) * (0.7 + 0.3 * sin(time * 2.0));
    }

    // ── ステージレーザー（着弾のあと、煙の中を掃く） ──
    float stage = smoothstep(IMPACT + 0.15, IMPACT + 1.6, t);
    if (stage > 0.0) {
      vec3 b = vec3(0.0);
      float fogB = 0.35 + fog * 1.3;
      float m = uMouse.x * 0.18;
      float s = time * 0.32;
      vec2 oL = vec2(-halfW - 0.08, -0.62);
      vec2 oR = vec2( halfW + 0.08, -0.62);
      // 縦長の画面では、ビームを立てて画面の上まで届かせる
      float wide = clamp((aspect - 0.5) / 1.1, 0.0, 1.0);
      float a1 = mix(1.30, 0.95, wide);
      float a2 = mix(1.14, 0.62, wide);
      b += beam(p, oL, a1 + sin(s)       * 0.2 + m, uRed,  fogB);
      b += beam(p, oR, 3.14159 - a1 + sin(s + 1.9) * 0.2 + m, uRed,  fogB);
      b += beam(p, oL, a2 + sin(s * 0.8 + 3.1) * 0.16 + m, uGold, fogB) * 0.75;
      b += beam(p, oR, 3.14159 - a2 + sin(s * 0.8 + 0.7) * 0.16 + m, uGold, fogB) * 0.75;
      if (uLow < 0.5) {
        vec2 oT = vec2(0.0, 0.62);
        b += beam(p, oT, -1.57 + sin(s * 0.6) * 0.5 + m * 1.4, mix(uRed, uGold, 0.5), fogB) * 0.6;
        b += beam(p, oT, -1.57 + sin(s * 0.6 + 3.14) * 0.5 + m * 1.4, uRed, fogB) * 0.5;
      }
      // タイトルの上では少し控えて、文字を読ませる
      float titleMask = 1.0 - 0.55 * exp(-pow(p.y - y0 - 0.12, 2.0) * 18.0) * smoothstep(0.9, 0.0, abs(p.x));
      col += b * stage * titleMask * 0.8;
    }

    // マウスの照り返し
    col += mix(uRed, uGold, 0.5) * exp(-length(p - mouse) * 4.5) * 0.07 * (0.4 + fog);

    // 周辺減光・トーンマップ・粒子感
    float vig = smoothstep(1.25, 0.25, length(p * vec2(0.85 / max(aspect, 1.0) * 1.6, 1.25)));
    col *= mix(0.45, 1.0, vig);
    col = vec3(1.0) - exp(-col * 1.35);
    col = pow(col, vec3(0.92));
    col += (hash(gl_FragCoord.xy + fract(time) * 91.0) - 0.5) * 0.028;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** 着弾で飛び散る火花。1回きり */
const sparkVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  uniform float uIntro;
  uniform float uAspect;
  uniform float uLineY;
  uniform float uPixelRatio;
  varying float vAge;
  varying float vSeed;
  const float IMPACT = ${IMPACT_AT.toFixed(3)};
  void main() {
    float t = uIntro - IMPACT - aSeed * 0.08;
    vAge = t / aLife;
    vSeed = aSeed;
    vec2 dir = vec2(cos(aAngle), sin(aAngle));
    float drag = 3.2;
    vec2 pos = vec2(0.0, uLineY - 0.5) + dir * aSpeed * (1.0 - exp(-drag * max(t, 0.0))) / drag;
    pos.y -= 0.16 * t * t;
    vec2 clip = vec2(pos.x / (uAspect * 0.5), pos.y / 0.5);
    gl_Position = vec4(clip, 0.0, 1.0);
    float alive = step(0.0, t) * step(vAge, 1.0);
    gl_PointSize = aSize * 1.7 * uPixelRatio * (1.0 - vAge * 0.6) * alive;
  }
`;

const sparkFragment = /* glsl */ `
  uniform vec3 uRed;
  uniform vec3 uGold;
  varying float vAge;
  varying float vSeed;
  void main() {
    if (vAge < 0.0 || vAge > 1.0) discard;
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 hot = vec3(1.0, 0.96, 0.9);
    vec3 col = mix(hot, mix(uGold, uRed, vSeed), smoothstep(0.0, 0.55, vAge));
    gl_FragColor = vec4(col, a * (1.0 - vAge) * 1.2);
  }
`;

/** 余韻として立ちのぼる残り火。ずっと回る */
const emberVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uTime;
  uniform float uIntro;
  uniform float uAspect;
  uniform float uPixelRatio;
  uniform vec2 uMouse;
  varying float vTw;
  varying float vSeed;
  varying float vIn;
  const float IMPACT = ${IMPACT_AT.toFixed(3)};
  void main() {
    float speed = 0.02 + aSeed * 0.05;
    float y = mod(aStart.y + uTime * speed + 0.6, 1.2) - 0.6;
    float x = aStart.x * uAspect * 0.5 + sin(uTime * 0.6 + aSeed * 30.0) * 0.02 + uMouse.x * 0.03 * aStart.z;
    vec2 clip = vec2(x / (uAspect * 0.5), y / 0.5);
    gl_Position = vec4(clip, 0.0, 1.0);
    vTw = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
    vSeed = aSeed;
    vIn = smoothstep(IMPACT, IMPACT + 1.8, uIntro) * smoothstep(0.6, 0.2, abs(y));
    gl_PointSize = (1.0 + aStart.z * 2.6) * uPixelRatio;
  }
`;

const emberFragment = /* glsl */ `
  uniform vec3 uRed;
  uniform vec3 uGold;
  varying float vTw;
  varying float vSeed;
  varying float vIn;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uRed, uGold, step(0.55, vSeed));
    gl_FragColor = vec4(col * 1.4, a * vTw * vIn * 0.75);
  }
`;

export type HubHeroOptions = {
  /** 画面上で「バトンの線」を引く高さ（ヒーロー上端からの比率 0〜1） */
  lineY: () => number;
  /** 着弾した瞬間に呼ぶ。文字の点灯と同期させるため */
  onImpact: () => void;
  /** 読み込みが遅れて先に文字を点灯させたとき。着弾を飛ばして余韻から始める */
  skipIntro?: boolean;
  red?: string;
  gold?: string;
};

export function mountHubHeroScene(canvas: HTMLCanvasElement, opts: HubHeroOptions): () => void {
  const low = isLowPower();
  const renderer = makeRenderer(canvas);
  // 全画面シェーダは画素数がそのまま負荷になる。見た目が崩れない範囲で下げる
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));
  const scene = new Scene();
  const camera = new Camera();
  const red = new Color(opts.red ?? '#C8102E');
  const gold = new Color(opts.gold ?? '#D9A441');

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
      uLineY: { value: 0.5 },
      uLow: { value: low ? 1 : 0 },
    },
  });
  const quadGeo = new PlaneGeometry(2, 2);
  const quad = new Mesh(quadGeo, quadMat);
  quad.frustumCulled = false;
  scene.add(quad);

  // 火花
  const sparkCount = low ? 420 : 1100;
  const sparkGeo = new BufferGeometry();
  const angle = new Float32Array(sparkCount);
  const speed = new Float32Array(sparkCount);
  const life = new Float32Array(sparkCount);
  const size = new Float32Array(sparkCount);
  const sseed = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i += 1) {
    // 7割は線に沿って左右へ、残りは全方位へ
    const along = Math.random() < 0.7;
    const side = Math.random() < 0.5 ? 0 : Math.PI;
    angle[i] = along ? side + (Math.random() - 0.5) * 0.5 : Math.random() * Math.PI * 2;
    speed[i] = along ? 0.5 + Math.random() ** 2 * 2.6 : 0.15 + Math.random() * 0.9;
    life[i] = 0.5 + Math.random() * 1.6;
    size[i] = 1.2 + Math.random() * (along ? 3.2 : 2.2);
    sseed[i] = Math.random();
  }
  sparkGeo.setAttribute('position', new BufferAttribute(new Float32Array(sparkCount * 3), 3));
  sparkGeo.setAttribute('aAngle', new BufferAttribute(angle, 1));
  sparkGeo.setAttribute('aSpeed', new BufferAttribute(speed, 1));
  sparkGeo.setAttribute('aLife', new BufferAttribute(life, 1));
  sparkGeo.setAttribute('aSize', new BufferAttribute(size, 1));
  sparkGeo.setAttribute('aSeed', new BufferAttribute(sseed, 1));
  const sparkMat = new ShaderMaterial({
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uIntro: { value: 0 },
      uAspect: { value: 1 },
      uLineY: { value: 0.5 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uRed: { value: red },
      uGold: { value: gold },
    },
  });
  const sparks = new Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  // 残り火
  const emberCount = low ? 90 : 240;
  const emberGeo = new BufferGeometry();
  const start = new Float32Array(emberCount * 3);
  const eseed = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i += 1) {
    start[i * 3] = (Math.random() - 0.5) * 2;
    start[i * 3 + 1] = Math.random() * 1.2 - 0.6;
    start[i * 3 + 2] = Math.random();
    eseed[i] = Math.random();
  }
  emberGeo.setAttribute('position', new BufferAttribute(new Float32Array(emberCount * 3), 3));
  emberGeo.setAttribute('aStart', new BufferAttribute(start, 3));
  emberGeo.setAttribute('aSeed', new BufferAttribute(eseed, 1));
  const emberMat = new ShaderMaterial({
    vertexShader: emberVertex,
    fragmentShader: emberFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uAspect: { value: 1 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMouse: { value: [0, 0] },
      uRed: { value: red },
      uGold: { value: gold },
    },
  });
  const embers = new Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  scene.add(embers);

  const pointer = pointerTracker(canvas);
  const syncLine = () => {
    // シェーダの uv は下が0。DOMは上が0なので反転する
    const y = 1 - opts.lineY();
    quadMat.uniforms.uLineY.value = y;
    sparkMat.uniforms.uLineY.value = y;
  };

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    (quadMat.uniforms.uRes.value as number[])[0] = w;
    (quadMat.uniforms.uRes.value as number[])[1] = h;
    sparkMat.uniforms.uAspect.value = aspect;
    emberMat.uniforms.uAspect.value = aspect;
    const ratio = renderer.getPixelRatio();
    sparkMat.uniforms.uPixelRatio.value = ratio;
    emberMat.uniforms.uPixelRatio.value = ratio;
    syncLine();
  });
  syncLine();

  canvas.classList.add('is-ready');
  let introStart = -1;
  let impacted = Boolean(opts.skipIntro);
  // 着弾を飛ばすときは、火花が消えきった時点から始める
  const introOffset = opts.skipIntro ? IMPACT_AT + 4 : 0;

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
    sparkMat.uniforms.uIntro.value = intro;
    emberMat.uniforms.uTime.value = elapsed;
    emberMat.uniforms.uIntro.value = intro;
    (emberMat.uniforms.uMouse.value as number[])[0] = m.x;
    sparks.visible = intro < IMPACT_AT + 2.5;
    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    quadGeo.dispose();
    quadMat.dispose();
    sparkGeo.dispose();
    sparkMat.dispose();
    emberGeo.dispose();
    emberMat.dispose();
    renderer.dispose();
  };
}
