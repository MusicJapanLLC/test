import {
  AdditiveBlending,
  NormalBlending,
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

const shellVertex = /* glsl */ `
  attribute float aPhi;
  attribute float aTheta;
  attribute float aSeed;
  attribute float aScale;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uPixelRatio;
  uniform float uRadius;
  varying float vPulse;
  varying float vDepth;
  const float PI = 3.14159265;
  void main() {
    float breathe = sin(uTime * 0.35 + aSeed * 6.28318) * 0.045;
    float r = uRadius * (0.92 + aSeed * 0.12 + breathe);
    vec3 pos = vec3(
      r * sin(aTheta) * cos(aPhi),
      r * cos(aTheta),
      r * sin(aTheta) * sin(aPhi)
    );
    float head = fract(uTime * 0.085 + aSeed * 0.015);
    float along = aTheta / PI;
    float gap = abs(fract(along - head + 0.5) - 0.5);
    vPulse = smoothstep(0.06, 0.0, gap);
    pos *= 1.0 + vPulse * 0.06;
    pos.xy += uMouse * uRadius * 0.10 * (0.4 + aSeed);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = smoothstep(-uRadius * 2.2, uRadius * 0.6, mv.z);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * uPixelRatio * (42.0 / max(-mv.z, 0.001)) * (1.0 + vPulse * 2.4);
  }
`;

const shellFragment = /* glsl */ `
  uniform vec3 uPrimary;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vPulse;
  varying float vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.04, d);
    if (alpha < 0.01) discard;
    vec3 color = mix(uPrimary * 1.45, uAccent, smoothstep(0.2, 1.0, vPulse));
    float depthFade = mix(0.35, 1.0, vDepth);
    gl_FragColor = vec4(color, alpha * uOpacity * depthFade * (0.4 + vPulse * 0.6));
  }
`;

const dustVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aScale;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uPixelRatio;
  uniform float uSpan;
  varying float vFade;
  void main() {
    vec3 pos = position;
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
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uAccent, alpha * vFade * uOpacity);
  }
`;

/** 背景が明るいかどうか。加算合成は白地だと色が飛ぶので、そこで切り替える */
function isLightBg(hex: string): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) >= 0.2;
}

export function mountProfileHeroScene(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const low = isLowPower();
  const light = isLightBg(theme.bg);
  const shellCount = low ? 9000 : 42000;
  const dustCount = low ? 120 : 420;
  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0, 26);
  const primary = new Color(theme.primary);
  const accent = new Color(theme.accent);

  const shellGeo = new BufferGeometry();
  shellGeo.setAttribute('position', new BufferAttribute(new Float32Array(shellCount * 3), 3));
  const phi = new Float32Array(shellCount);
  const thetaAttr = new Float32Array(shellCount);
  const shellSeed = new Float32Array(shellCount);
  const shellScale = new Float32Array(shellCount);
  for (let i = 0; i < shellCount; i += 1) {
    phi[i] = Math.random() * Math.PI * 2;
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
    // 白地では加算合成だと色が飛ぶ。明るい地では通常合成にそろえる
    blending: light ? NormalBlending : AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uRadius: { value: 9 },
      uLift: { value: light ? 0.85 : 1.45 },
      uPrimary: { value: primary },
      uAccent: { value: accent },
      uOpacity: { value: light ? 0.5 : low ? 0.82 : 0.78 },
    },
  });
  const shell = new Points(shellGeo, shellMat);
  shell.frustumCulled = false;
  scene.add(shell);

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
    blending: light ? NormalBlending : AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSpan: { value: span },
      uAccent: { value: accent },
      uOpacity: { value: light ? 0.35 : 0.8 },
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
