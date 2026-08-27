import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';

/**
 * ハブのヒーロー。
 * 「バトンが渡っていく流れ」の抽象化。
 * 何本かの流れに沿って粒が進み、そこを明滅（＝バトン）が追い越していく。
 * マウス位置には緩やかに反応する。
 */

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aLane;
  attribute float aSeed;
  attribute float aJitter;
  attribute float aScale;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uPixelRatio;
  uniform float uSpan;
  uniform float uHeight;

  varying float vPulse;
  varying float vFade;

  void main() {
    float speed = 0.026 + aSeed * 0.020;
    float t = fract(aPhase + uTime * speed);

    float x = (t - 0.5) * uSpan;

    // 同じレーンの粒は同じ曲線を通る。だから点の集まりが「流れ」に見える
    float laneY = (aLane - 0.5) * uHeight * 0.72;
    float wave = sin(t * 3.14159 + aSeed * 6.28318 + uTime * 0.18)
               * uHeight * 0.085;
    float y = laneY + wave + aJitter * uHeight * 0.022;
    float z = sin(t * 3.14159 + aSeed * 6.28318) * 1.4 + aJitter * 0.6;

    vec3 pos = vec3(x, y, z);

    vec2 m = uMouse * vec2(uSpan * 0.42, uHeight * 0.42);
    vec2 away = pos.xy - m;
    float d2 = dot(away, away);
    float infl = exp(-d2 / 9.0);
    pos.xy += normalize(away + vec2(0.0001)) * infl * 1.35;
    pos.z  += infl * 1.8;

    // バトンの受け渡し: 明滅が流れを追い越し、隣のレーンへ渡っていく
    float head = fract(uTime * 0.115 + aSeed * 0.72);
    float gap = abs(fract(t - head + 0.5) - 0.5);
    vPulse = smoothstep(0.045, 0.0, gap);

    vFade = smoothstep(0.0, 0.14, t) * smoothstep(1.0, 0.86, t);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * (1.0 + vPulse * 2.0) * uPixelRatio * (26.0 / max(-mv.z, 0.001));
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec3  uColorBase;
  uniform vec3  uColorAccent;
  uniform float uOpacity;

  varying float vPulse;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.08, d);
    if (alpha < 0.01) discard;

    vec3 color = mix(uColorBase, uColorAccent, smoothstep(0.25, 1.0, vPulse));
    gl_FragColor = vec4(color, alpha * vFade * uOpacity * (0.55 + vPulse * 0.45));
  }
`;

export function mountHubScene(canvas: HTMLCanvasElement): () => void {
  const low = isLowPower();
  const count = low ? 3200 : 12000;

  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3); // 実座標は頂点シェーダ側で作る
  const phase = new Float32Array(count);
  const lane = new Float32Array(count);
  const seed = new Float32Array(count);
  const jitter = new Float32Array(count);
  const scale = new Float32Array(count);

  const lanes = low ? 5 : 8;
  // レーンごとのシード。これを粒で共有することで1本の線として読める
  const laneSeeds = Array.from({ length: lanes }, (_, i) => (i + 0.5) / lanes);

  for (let i = 0; i < count; i += 1) {
    phase[i] = Math.random();
    const laneIndex = i % lanes;
    lane[i] = laneIndex / (lanes - 1);
    seed[i] = laneSeeds[laneIndex];
    jitter[i] = (Math.random() - 0.5) * 2;
    scale[i] = 0.6 + Math.random() * 1.0;
  }

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new BufferAttribute(phase, 1));
  geometry.setAttribute('aLane', new BufferAttribute(lane, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
  geometry.setAttribute('aJitter', new BufferAttribute(jitter, 1));
  geometry.setAttribute('aScale', new BufferAttribute(scale, 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSpan: { value: 40 },
      uHeight: { value: 15 },
      uColorBase: { value: new Color('#1a1a1a') },
      uColorAccent: { value: new Color('#c8102e') },
      uOpacity: { value: low ? 0.85 : 0.72 },
    },
  });

  // 白地では加算合成だと色が飛ぶ。どちらの経路でも通常合成にそろえる
  material.blending = NormalBlending;

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const pointer = pointerTracker(canvas);

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const visibleHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    material.uniforms.uHeight.value = visibleHeight * 0.92;
    material.uniforms.uSpan.value = visibleHeight * camera.aspect * 1.55;
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  canvas.classList.add('is-ready');

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(low ? 0.08 : 0.045);
    material.uniforms.uTime.value = elapsed;
    (material.uniforms.uMouse.value as number[])[0] = m.x;
    (material.uniforms.uMouse.value as number[])[1] = m.y;
    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
