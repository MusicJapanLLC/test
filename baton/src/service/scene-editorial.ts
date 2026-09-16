import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Points,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
} from 'three';
import type { Theme } from '../types';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';

/**
 * unveilプロフィール（heroVariant: 'editorial'）専用の軽量WebGL演出。
 * 壁谷さんのheavyWebGL（立体モニュメント）とは別物で、写真やテクスチャは使わず
 * テーマカラーだけで構成する。
 * 背景: 生地が揺らぐような暖色のシルク状グラデーション（フルスクリーン板1枚）。
 * 前面: 花びらのように漂う光の粒子（Points、1パス）。
 * 低スペック端末では粒子数を落とし、動きを減らす設定では呼び出し側がそもそも
 * mountしない（main.ts の shouldRender3D 判定）。
 */

const silkVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const silkFragment = /* glsl */ `
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uAspect;
  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform vec3  uBg;

  float fold(vec2 p, float t) {
    return sin(p.x * 1.4 + t) * 0.5
         + sin(p.y * 1.1 - t * 0.7 + p.x) * 0.35
         + sin((p.x - p.y) * 0.9 + t * 0.5) * 0.3;
  }

  void main() {
    vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
    vec2 m = uMouse * vec2(0.4 * uAspect, 0.4);
    float t = uTime * 0.05;

    float n = fold(p * 1.35 + m * 0.2, t);
    float sheen = fold(p * 2.4 - m * 0.15, t * 1.6 + 4.0);

    vec3 color = uBg;
    color = mix(color, uAccent, smoothstep(-0.2, 0.9, n) * 0.22);
    color = mix(color, uPrimary, smoothstep(0.1, 1.0, -n) * 0.12);
    color += vec3(sheen) * 0.015;

    // 上下をわずかに沈めて奥行きを出す
    color = mix(color, uPrimary, smoothstep(0.5, 1.05, vUv.y) * 0.06);
    color = mix(color, uPrimary, smoothstep(0.0, -0.35, vUv.y) * 0.05);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const petalVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute float aSpin;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2  uMouse;
  uniform float uIntro;

  varying float vSeed;
  varying float vAngle;
  varying float vNear;

  void main() {
    vSeed = aSeed;
    vec3 pos = position;

    float speed = 0.3 + aSeed * 0.45;
    pos.y = mod(pos.y - uTime * speed, 9.0) - 4.5;
    /* 落ちながら左右に振れる。振れ幅は粒ごとに変える */
    pos.x += sin(uTime * 0.28 + aSeed * 12.0) * 0.55;

    /* 指先からゆっくり遠ざかる。手前の粒ほど強く逃げる */
    float depth = smoothstep(-5.0, 1.0, pos.z);
    pos.xy += uMouse * (0.25 + depth * 0.5);

    /* 落ちながら回る。1枚ずつ向きと速さが違う */
    vAngle = aSeed * 6.28318 + uTime * aSpin;
    vNear = depth;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    /* 読み込み直後に開いていく */
    gl_PointSize = aSize * uIntro * uPixelRatio * (260.0 / -mv.z);
  }
`;

const petalFragment = /* glsl */ `
  varying float vSeed;
  varying float vAngle;
  varying float vNear;

  uniform vec3 uAccent;
  uniform vec3 uPrimary;

  void main() {
    /* 点を回してから、縦長・上すぼまりに削る。丸ではなく花びらに見せる */
    vec2 c = gl_PointCoord - 0.5;
    float ca = cos(vAngle);
    float sa = sin(vAngle);
    c = mat2(ca, -sa, sa, ca) * c;
    c.x /= 0.52;

    float d = length(c);
    if (d > 0.5) discard;

    float taper = smoothstep(0.55, -0.45, c.y);
    float alpha = smoothstep(0.5, 0.06, d) * mix(0.3, 1.0, taper);

    /* 奥の粒はぼかして沈める。手前だけ輪郭を残す */
    alpha *= mix(0.35, 1.0, vNear) * (0.3 + vSeed * 0.35);

    vec3 color = mix(uAccent, uPrimary, fract(vSeed * 5.3));
    /* 中心に置く淡い芯。紙の上の箔のように、わずかに明るく */
    color += (1.0 - smoothstep(0.0, 0.32, d)) * 0.12;

    gl_FragColor = vec4(color, alpha);
  }
`;

export function mountEditorialScene(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const low = isLowPower();
  const renderer = makeRenderer(canvas);
  renderer.autoClear = false;

  // 背景: シルク状グラデーション
  const bgScene = new Scene();
  const bgCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMaterial = new ShaderMaterial({
    vertexShader: silkVertex,
    fragmentShader: silkFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uAspect: { value: 1 },
      uPrimary: { value: new Color(theme.primary) },
      uAccent: { value: new Color(theme.accent) },
      uBg: { value: new Color(theme.bg) },
    },
  });
  const bgMesh = new Mesh(new PlaneGeometry(2, 2), bgMaterial);
  bgMesh.frustumCulled = false;
  bgScene.add(bgMesh);

  // 前面: 漂う光の粒子（花びらのイメージ）
  const count = low ? 40 : 150;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const spins = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 11;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    // 手前と奥に散らす。手前の少数だけ大きく、ぼけて通り過ぎる
    const near = Math.random() < 0.22;
    positions[i * 3 + 2] = near ? 0.5 + Math.random() * 1.5 : (Math.random() - 0.5) * 4 - 2;
    seeds[i] = Math.random();
    sizes[i] = near ? 0.16 + Math.random() * 0.16 : 0.04 + Math.random() * 0.08;
    spins[i] = (Math.random() - 0.5) * 0.9;
  }

  const petalGeometry = new BufferGeometry();
  petalGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  petalGeometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
  petalGeometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  petalGeometry.setAttribute('aSpin', new Float32BufferAttribute(spins, 1));

  const petalMaterial = new ShaderMaterial({
    vertexShader: petalVertex,
    fragmentShader: petalFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, low ? 1.25 : 1.75) },
      uMouse: { value: [0, 0] },
      uIntro: { value: 0 },
      uAccent: { value: new Color(theme.accent) },
      uPrimary: { value: new Color(theme.primary) },
    },
  });

  const petals = new Points(petalGeometry, petalMaterial);
  const frontScene = new Scene();
  frontScene.add(petals);
  const frontCamera = new PerspectiveCamera(42, 1, 0.1, 30);
  frontCamera.position.set(0, 0, 8);

  const pointer = pointerTracker(canvas);

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    bgMaterial.uniforms.uAspect.value = w / h;
    frontCamera.aspect = w / h;
    frontCamera.updateProjectionMatrix();
  });

  canvas.classList.add('is-ready');

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(0.05);
    bgMaterial.uniforms.uTime.value = elapsed;
    (bgMaterial.uniforms.uMouse.value as number[])[0] = m.x;
    (bgMaterial.uniforms.uMouse.value as number[])[1] = m.y;
    petalMaterial.uniforms.uTime.value = elapsed;
    (petalMaterial.uniforms.uMouse.value as number[])[0] = m.x;
    (petalMaterial.uniforms.uMouse.value as number[])[1] = m.y;
    // 読み込み直後だけ、花びらが開いていく
    petalMaterial.uniforms.uIntro.value = Math.min(1, elapsed / 1.6);

    frontCamera.position.x = m.x * 0.4;
    frontCamera.position.y = m.y * 0.3;
    frontCamera.lookAt(0, 0, 0);

    renderer.clear();
    renderer.render(bgScene, bgCamera);
    renderer.clearDepth();
    renderer.render(frontScene, frontCamera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    bgMesh.geometry.dispose();
    bgMaterial.dispose();
    petalGeometry.dispose();
    petalMaterial.dispose();
    renderer.dispose();
  };
}
