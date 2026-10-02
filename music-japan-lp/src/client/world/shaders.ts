/**
 * 点と線のシェーダー。位置は「かたちの表」（浮動小数点テクスチャ）から読み、
 * 2つのかたちのあいだを、点ごとに少しずつ遅らせて移る（uMix）。
 */
const common = /* glsl */ `
  uniform sampler2D uLayouts;
  uniform vec2 uTex;        // テクスチャの幅・高さ
  uniform float uRows;      // 1レイアウトあたりの行数
  uniform float uA;         // 移る前のかたち
  uniform float uB;         // 移った先のかたち
  uniform float uMix;       // 0..1
  uniform float uTime;
  uniform float uDrift;
  uniform float uWave;      // 声の波の強さ

  vec4 fetchLayout(float lay, float idx) {
    float x = mod(idx, uTex.x);
    float y = floor(idx / uTex.x) + lay * uRows;
    return texture2D(uLayouts, vec2((x + 0.5) / uTex.x, (y + 0.5) / uTex.y));
  }

  float catOf(float w) { return mod(w, 16.0); }
  float grpOf(float w) { return floor(w / 16.0 + 0.001); }

  // 点ごとの遅れ（同じ番号の点は、線の端でも同じ動きになる）
  float stagger(vec4 r) {
    float t = clamp(uMix * 1.45 - r.x * 0.45, 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  vec3 waveDisp(vec3 p, float cat) {
    if (cat < 5.5 || cat > 6.5) return p;
    float a = atan(p.y, p.x);
    float amp = 0.16 + 0.22 * uWave;
    float k = sin(a * 9.0 + uTime * 2.4) * 0.55 + sin(a * 23.0 - uTime * 3.7) * 0.3 + sin(a * 5.0 + uTime * 1.3) * 0.4;
    return p * (1.0 + amp * k * 0.18);
  }

  vec3 morphPos(float idx, vec4 r, out float t, out vec4 a, out vec4 b) {
    a = fetchLayout(uA, idx);
    b = fetchLayout(uB, idx);
    t = stagger(r);
    vec3 pa = waveDisp(a.xyz, catOf(a.w));
    vec3 pb = waveDisp(b.xyz, catOf(b.w));
    vec3 p = mix(pa, pb, t);
    // 移っている途中は、奥と手前にふくらむ
    p.z += sin(t * 3.14159) * (r.y - 0.5) * 3.2;
    p.x += sin(t * 3.14159) * (r.z - 0.5) * 1.2;
    float tt = uTime * (0.18 + r.z * 0.25);
    p += vec3(sin(tt + r.w * 6.283), cos(tt * 0.87 + r.x * 6.283), sin(tt * 0.71 + r.y * 6.283)) * uDrift * (0.35 + r.z);
    return p;
  }
`;

export const pointVert = /* glsl */ `
  ${common}
  attribute float aIndex;
  attribute vec4 aRand;
  uniform float uSize;
  uniform float uDpr;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uAspect;
  uniform float uHiLayout;
  uniform float uHiGroup;
  uniform float uFade;
  uniform vec3 uC[9];
  uniform float uAlpha[9];
  uniform float uScale[9];
  varying vec3 vColor;
  varying float vAlpha;
  varying float vTw;

  float hiOf(float lay, float w) {
    return (abs(lay - uHiLayout) < 0.5 && abs(grpOf(w) - uHiGroup) < 0.5) ? 1.0 : 0.0;
  }

  void main() {
    float t; vec4 a; vec4 b;
    vec3 pos = morphPos(aIndex, aRand, t, a, b);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * mv;
    // カーソルの近くの点は、そっとよける
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);
    float push = smoothstep(0.32, 0.0, dist) * uMouseOn;
    clip.xy += normalize(d + 1e-5) / vec2(uAspect, 1.0) * push * 0.06 * clip.w;
    gl_Position = clip;

    int ca = int(catOf(a.w) + 0.5);
    int cb = int(catOf(b.w) + 0.5);
    float ha = hiOf(uA, a.w) * (1.0 - t);
    float hb = hiOf(uB, b.w) * t;
    float hi = max(ha, hb);
    vec3 col = mix(uC[ca], uC[cb], t);
    col = mix(col, uC[2] * 1.25, hi * 0.85);
    float al = mix(uAlpha[ca], uAlpha[cb], t) * (1.0 + hi * 0.6);
    float sz = mix(uScale[ca], uScale[cb], t) * (0.65 + aRand.w * 0.7) * (1.0 + hi * 0.7) * (1.0 + push * 1.4);
    // ときどき瞬く
    vTw = 0.75 + 0.25 * sin(uTime * (1.5 + aRand.z * 2.5) + aRand.x * 40.0);
    vColor = col;
    vAlpha = al * uFade * smoothstep(42.0, 7.0, -mv.z);
    gl_PointSize = max(0.0, uSize * sz * uDpr * (12.0 / -mv.z));
  }
`;

export const pointFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 1.7) * vAlpha * vTw;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export const lineVert = /* glsl */ `
  ${common}
  attribute float aA;
  attribute float aB;
  attribute float aEnd;
  attribute vec4 aRA;
  attribute vec4 aRB;
  attribute vec4 aMeta;   // x: かたち / y: 生える順番 / z: 色（0 白・1 赤・2 カーソルで見える線・3 引かれては消える紹介の線）/ w: 予備
  attribute vec2 aGrp;
  uniform float uGrow;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uAspect;
  uniform float uHiLayout;
  uniform float uHiGroup;
  uniform float uFade;
  varying float vAlpha;
  varying float vEnd;
  varying float vRed;
  varying float vSeed;
  varying float vRelay;

  void main() {
    float tA; vec4 a0; vec4 b0;
    float tB; vec4 a1; vec4 b1;
    vec3 pA = morphPos(aA, aRA, tA, a0, b0);
    vec3 pB = morphPos(aB, aRB, tB, a1, b1);
    vec3 p = mix(pA, pB, aEnd);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_Position = clip;

    float lay = aMeta.x;
    float m = uMix * uMix * (3.0 - 2.0 * uMix);
    float w = (abs(lay - uA) < 0.5 ? 1.0 - m : 0.0) + (abs(lay - uB) < 0.5 ? m : 0.0);
    w = min(w, 1.0);
    // ネットワークの線は、スクロールにあわせて順に生える
    float grow = abs(lay - 1.0) < 0.5 ? smoothstep(aMeta.y, aMeta.y + 0.06, uGrow) : 1.0;
    float relay = step(2.5, aMeta.z);
    float base = relay > 0.5 ? 1.0 : (aMeta.z > 1.5 ? 0.0 : (aMeta.z > 0.5 ? 0.85 : 0.22));
    // カーソルの近くでだけ見える線（最初の画面）
    if (aMeta.z > 1.5 && relay < 0.5) {
      vec4 ca = projectionMatrix * modelViewMatrix * vec4(pA, 1.0);
      vec4 cb = projectionMatrix * modelViewMatrix * vec4(pB, 1.0);
      vec2 mid = (ca.xy / ca.w + cb.xy / cb.w) * 0.5;
      float dist = length((mid - uMouse) * vec2(uAspect, 1.0));
      base = 0.05 + smoothstep(0.42, 0.04, dist) * 0.75 * uMouseOn;
    }
    float hi = (abs(lay - uHiLayout) < 0.5 && (abs(aGrp.x - uHiGroup) < 0.5 || abs(aGrp.y - uHiGroup) < 0.5)) ? 1.0 : 0.0;
    vAlpha = base * w * grow * uFade * (1.0 + hi * 1.6);
    vEnd = aEnd;
    vRed = max(max(step(0.5, aMeta.z) * step(aMeta.z, 1.5), relay), hi * 0.7);
    vSeed = aRA.x + aRB.y;
    vRelay = relay;
  }
`;

export const lineFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPaper;
  uniform vec3 uRed;
  varying float vAlpha;
  varying float vEnd;
  varying float vRed;
  varying float vSeed;
  varying float vRelay;
  void main() {
    // 線の上を走る光（信号）
    float head = fract(uTime * (0.18 + fract(vSeed * 7.0) * 0.22) + vSeed);
    float pulse = smoothstep(0.1, 0.0, abs(vEnd - head));
    vec3 col = mix(uPaper, uRed, vRed);
    float a = vAlpha * (0.55 + pulse * 1.6);
    if (vRelay > 0.5) {
      // 紹介の線：A から B へ引かれ、少し残って、消える。線ごとに時間をずらす
      float cyc = fract(uTime * 0.055 + fract(vSeed * 5.31));
      float draw = smoothstep(0.0, 0.14, cyc);
      float fade = 1.0 - smoothstep(0.24, 0.38, cyc);
      float tip = smoothstep(0.08, 0.0, abs(vEnd - draw)) * (1.0 - step(0.145, cyc));
      a = vAlpha * (step(vEnd, draw) * fade * 0.8 + tip * 3.0);
      col = mix(uRed, vec3(1.0, 0.9, 0.9), tip * 0.6);
    }
    gl_FragColor = vec4(col * a, a);
  }
`;

/** 最後の「つながる」線。2点のあいだを、画面上の太さを保った帯で描く */
export const beamVert = /* glsl */ `
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform float uWidth;
  uniform vec2 uRes;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 c0 = projectionMatrix * viewMatrix * vec4(uP0, 1.0);
    vec4 c1 = projectionMatrix * viewMatrix * vec4(uP1, 1.0);
    vec4 c = mix(c0, c1, uv.x);
    vec2 s0 = c0.xy / c0.w * uRes;
    vec2 s1 = c1.xy / c1.w * uRes;
    vec2 dir = normalize(s1 - s0 + 1e-5);
    vec2 n = vec2(-dir.y, dir.x);
    c.xy += n * (uv.y - 0.5) * uWidth / uRes * c.w * 2.0;
    gl_Position = c;
  }
`;

export const beamFrag = /* glsl */ `
  uniform float uDraw;
  uniform float uTime;
  uniform vec3 uRed;
  varying vec2 vUv;
  void main() {
    float across = abs(vUv.y - 0.5) * 2.0;
    float core = exp(-across * across * 26.0);
    float glow = exp(-across * 4.0) * 0.35;
    float drawn = smoothstep(uDraw, uDraw - 0.02, vUv.x);
    float spark = smoothstep(0.06, 0.0, abs(vUv.x - fract(uTime * 0.35))) * step(0.98, uDraw);
    float headGlow = smoothstep(0.08, 0.0, abs(vUv.x - uDraw)) * step(uDraw, 0.985);
    float a = (core + glow) * drawn + (spark + headGlow) * (core * 1.5 + glow);
    vec3 col = mix(uRed, vec3(1.0, 0.85, 0.85), core * 0.5 + spark);
    gl_FragColor = vec4(col * a, a);
  }
`;
