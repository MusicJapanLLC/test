import {
  Color,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
} from 'three';
import type { MonumentKind, Theme } from '../types';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';
import { createMonument } from './monument';

/**
 * サービスページのヒーロー。
 * 背景はフルスクリーンの板1枚、その上に小さな立体を並べたモニュメントを1つ。
 * 3Dモデルは読み込まず、描画は2パスだけ。スマホの表示速度を優先する。
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
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

export function mountLightScene(
  canvas: HTMLCanvasElement,
  theme: Theme,
  kind?: MonumentKind,
): () => void {
  const low = isLowPower();
  const renderer = makeRenderer(canvas);
  renderer.autoClear = false;

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

  // 前面: サービスごとの立体
  const front = new Scene();
  const frontCamera = new PerspectiveCamera(42, 1, 0.1, 100);
  frontCamera.position.set(0, 0, 12.5);
  const monument = kind ? createMonument(kind, theme, low) : null;
  if (monument) front.add(monument.mesh);

  const pointer = pointerTracker(canvas);

  let scroll = 0;
  const readScroll = () => {
    const h = canvas.getBoundingClientRect().height || window.innerHeight;
    scroll = Math.min(window.scrollY / h, 1);
  };
  if (monument) {
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();
  }

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    material.uniforms.uAspect.value = w / h;

    const narrow = w / h < 0.85;
    frontCamera.aspect = w / h;
    frontCamera.fov = narrow ? 54 : 42;
    frontCamera.updateProjectionMatrix();

    if (monument) {
      // 文字は左に置くので、立体は右へ逃がす
      monument.mesh.position.x = narrow ? 0.3 : 3.4;
      monument.mesh.position.y = narrow ? -1.6 : 0;
    }
  });

  canvas.classList.add('is-ready');

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(0.05);
    material.uniforms.uTime.value = elapsed;
    (material.uniforms.uMouse.value as number[])[0] = m.x;
    (material.uniforms.uMouse.value as number[])[1] = m.y;

    renderer.clear();
    renderer.render(scene, camera);

    if (monument) {
      monument.update(elapsed, scroll, m);
      renderer.clearDepth();
      renderer.render(front, frontCamera);
    }
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    window.removeEventListener('scroll', readScroll);
    monument?.dispose();
    mesh.geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
