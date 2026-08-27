import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import type { Theme } from '../types';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';

/**
 * サービスページの軽量背景。
 * フルスクリーンの板1枚だけ。3Dモデルは使わない（スマホの表示速度優先）。
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uAspect;
  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform vec3  uBg;

  // 軽い擬似ノイズ。テクスチャもループも使わない
  float wave(vec2 p, float t) {
    return sin(p.x * 2.1 + t) * 0.5
         + sin(p.y * 1.7 - t * 0.8) * 0.35
         + sin((p.x + p.y) * 1.3 + t * 0.6) * 0.25;
  }

  void main() {
    vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
    vec2 m = uMouse * vec2(0.5 * uAspect, 0.5);

    float t = uTime * 0.16;
    float n = wave(p * 1.6 + m * 0.35, t);

    float glowA = smoothstep(0.95, -0.35, length(p - vec2(0.42 * uAspect, 0.34)) * 2.0 - n * 0.22);
    float glowB = smoothstep(1.05, -0.30, length(p + vec2(0.40 * uAspect, 0.42)) * 2.0 + n * 0.18);

    vec3 color = uBg;
    color = mix(color, uAccent, clamp(glowA, 0.0, 1.0) * 0.30);
    color = mix(color, uPrimary, clamp(glowB, 0.0, 1.0) * 0.22);

    // 上から下へごくわずかに沈める
    color = mix(color, uPrimary, smoothstep(0.55, 1.0, vUv.y) * 0.05);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function mountLightScene(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
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

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const pointer = pointerTracker(canvas);

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    material.uniforms.uAspect.value = w / h;
  });

  canvas.classList.add('is-ready');

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(0.05);
    material.uniforms.uTime.value = elapsed;
    (material.uniforms.uMouse.value as number[])[0] = m.x;
    (material.uniforms.uMouse.value as number[])[1] = m.y;
    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    mesh.geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
