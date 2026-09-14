import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';
import type { Theme } from '../types';

/**
 * プロフィールのヒーロー背景。
 *
 * 「響き」と「受け渡し」を1つの立体にしたもの。
 * 粒は球殻の上に並び、極から極へ波が抜けていく。波が通った粒だけが
 * 金に灯り、通り過ぎると元の色に戻る ＝ バトンが渡っていく。
 * 手前にはピントの合っていない塵をもう一層置いて、奥行きを作る。
 *
 * サービスページの scene-standment とは別物。あちらは製品の立体、
 * こちらは人物ページの空気なので、主張しすぎないことを優先する。
 */

const shellVertex = /* glsl */ `
  attribute float aPhi;
  attribute float aTheta;
  attribute float aSeed;
  attribute float aScale;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uPixelRatio;
  uniform float uRadius;

  varying float vPulse;
  varying float vDepth;

  const float PI = 3.14159265;

  void main() {
    /* 球殻。半径をわずかに揺らして、面ではなく層に見せる */
    float breathe = sin(uTime * 0.35 + aSeed * 6.28318) * 0.045;
    float r = uRadius * (0.92 + aSeed * 0.12 + breathe);

    vec3 pos = vec3(
      r * sin(aTheta) * cos(aPhi),
      r * cos(aTheta),
      r * sin(aTheta) * sin(aPhi)
    );

    /* 極から極へ抜けていく波。通過した粒が灯る */
    float head = fract(uTime * 0.085 + aSeed * 0.015);
    float along = aTheta / PI;
    float gap = abs(fract(along - head + 0.5) - 0.5);
    vPulse = smoothstep(0.06, 0.0, gap);

    /* 波の腹はわずかに外へ膨らむ。音が面を押す感じ */
    pos *= 1.0 + vPulse * 0.06;

    /* 指先に向かって、手前の層ほど大きく寄る */
    pos.xy += uMouse * uRadius * 0.10 * (0.4 + aSeed);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = smoothstep(-uRadius * 2.2, uRadius * 0.6, mv.z);

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * uPixelRatio * (42.0 / max(-mv.z, 0.001)) * (1.0 + vPulse * 2.4);
  }
`;

const shellFragment = /* glsl */ `
  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform float uOpacity;

  varying float vPulse;
  varying float vDepth;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.04, d);
    if (alpha < 0.01) discard;

    /* 暗い地に沈まないよう、素の色を一段持ち上げてから混ぜる */
    vec3 color = mix(uPrimary * 1.45, uAccent, smoothstep(0.2, 1.0, vPulse));
    /* 奥の粒は沈め、手前だけ拾う。板1枚に見えないように */
    float depthFade = mix(0.35, 1.0, vDepth);

    gl_FragColor = vec4(color, alpha * uOpacity * depthFade * (0.4 + vPulse * 0.6));
  }
`;

const dustVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aScale;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uPixelRatio;
  uniform float uSpan;

  varying float vFade;

  void main() {
    vec3 pos = position;
    /* ゆっくり昇っていく。上端まで行ったら下から出し直す */
    pos.y = mod(pos.y + uTime * (0.12 + aSeed * 0.22) + uSpan, uSpan * 2.0) - uSpan;
    pos.x += sin(uTime * 0.3 + aSeed * 6.28318) * 0.5;
    pos.xy += uMouse * 0.9 * aSeed;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vFade = smoothstep(0.0, 0.25, aSeed);

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * uPixelRatio * (60.0 / max(-mv.z, 0.001));
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3  uAccent;
  uniform float uOpacity;

  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    /* ピントの合っていない塵。輪郭を作らない */
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(uAccent, alpha * vFade * uOpacity);
  }
`;

export function mountProfileHeroScene(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const low = isLowPower();
  const shellCount = low ? 9000 : 42000;
  const dustCount = low ? 120 : 420;

  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0, 26);

  const primary = new Color(theme.primary);
  const accent = new Color(theme.accent);

  /* ── 球殻 ── */
  const shellGeo = new BufferGeometry();
  shellGeo.setAttribute('position', new BufferAttribute(new Float32Array(shellCount * 3), 3));
  const phi = new Float32Array(shellCount);
  const thetaAttr = new Float32Array(shellCount);
  const shellSeed = new Float32Array(shellCount);
  const shellScale = new Float32Array(shellCount);

  for (let i = 0; i < shellCount; i += 1) {
    phi[i] = Math.random() * Math.PI * 2;
    // cos を一様に取ると、極に粒が溜まらず球面に均等に散る
    thetaAttr[i] = Math.acos(2 * Math.random() - 1);
    shellSeed[i] = Math.random();
    shellScale[i] = 0.5 + Math.random() * 1.1;
  }

  shellGeo.setAttribute('aPhi', new BufferAttribute(phi, 1));
  shellGeo.setAttribute('aTheta', new BufferAttribute(thetaAttr, 1));
  shellGeo.setAttribute('aSeed', new BufferAttribute(shellSeed, 1));
  shellGeo.setAttribute('aScale', new BufferAttribute(shellScale, 1));

  const shellMat = new ShaderMaterial({
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uRadius: { value: 9 },
      uPrimary: { value: primary },
      uAccent: { value: accent },
      uOpacity: { value: low ? 0.82 : 0.78 },
    },
  });

  const shell = new Points(shellGeo, shellMat);
  shell.frustumCulled = false;
  scene.add(shell);

  /* ── 手前の塵 ── */
  const dustGeo = new BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  const dustScale = new Float32Array(dustCount);
  const span = 14;

  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (Math.random() - 0.5) * 46;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * span * 2;
    dustPos[i * 3 + 2] = 10 + Math.random() * 9;
    dustSeed[i] = Math.random();
    dustScale[i] = 0.6 + Math.random() * 2.4;
  }

  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new BufferAttribute(dustSeed, 1));
  dustGeo.setAttribute('aScale', new BufferAttribute(dustScale, 1));

  const dustMat = new ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSpan: { value: span },
      uAccent: { value: accent },
      uOpacity: { value: 0.8 },
    },
  });

  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  const pointer = pointerTracker(canvas);

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const ratio = renderer.getPixelRatio();
    shellMat.uniforms.uPixelRatio.value = ratio;
    dustMat.uniforms.uPixelRatio.value = ratio;

    // 縦画面では立体を小さくして、文字の裏に回しきる
    const portrait = h > w;
    shellMat.uniforms.uRadius.value = portrait ? 7 : 9;
    camera.position.z = portrait ? 30 : 26;
  });

  canvas.classList.add('is-ready');

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(low ? 0.07 : 0.04);

    shellMat.uniforms.uTime.value = elapsed;
    dustMat.uniforms.uTime.value = elapsed;
    (shellMat.uniforms.uMouse.value as number[])[0] = m.x;
    (shellMat.uniforms.uMouse.value as number[])[1] = m.y;
    (dustMat.uniforms.uMouse.value as number[])[0] = m.x;
    (dustMat.uniforms.uMouse.value as number[])[1] = m.y;

    shell.rotation.y = elapsed * 0.045 + m.x * 0.22;
    shell.rotation.x = Math.sin(elapsed * 0.07) * 0.12 - m.y * 0.16;

    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    shellGeo.dispose();
    shellMat.dispose();
    dustGeo.dispose();
    dustMat.dispose();
    renderer.dispose();
  };
}
