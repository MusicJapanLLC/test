import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import type { Theme } from '../types';
import { isLowPower } from '../lib/motion';
import { makeRenderer, onResize, pointerTracker, startLoop } from '../lib/webgl';

/**
 * Standment のページだけの例外。3D をフルに使う。
 * このページ自体が WebGL 制作のデモになる。
 *
 * 3Dノイズは Ashima Arts / Stefan Gustavson の simplex noise (MIT)。
 */

const NOISE = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const blobVertex = /* glsl */ `
  ${NOISE}

  uniform float uTime;
  uniform float uAmp;
  uniform float uScroll;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vDisp;

  void main() {
    float t = uTime * 0.22;
    float n = snoise(normal * 1.25 + vec3(t, t * 0.7, -t * 0.5));
    n += snoise(normal * 2.9 + vec3(-t * 0.9, t * 0.4, t)) * 0.45;

    float amp = uAmp * (1.0 + uScroll * 0.55);
    vec3 displaced = position + normal * n * amp;

    vDisp = n;
    vNormalW = normalize(normalMatrix * normal);

    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const blobFragment = /* glsl */ `
  precision highp float;

  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform vec3  uBg;
  uniform float uAlpha;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vDisp;

  void main() {
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 2.2);
    float shade = clamp(vDisp * 0.5 + 0.5, 0.0, 1.0);

    vec3 base = mix(uPrimary, uAccent, shade);
    vec3 color = mix(base, uBg, 0.18);
    color = mix(color, uAccent, fresnel * 0.85);
    color += fresnel * 0.16;

    float alpha = (0.62 + fresnel * 0.34) * uAlpha;
    gl_FragColor = vec4(color, alpha);
  }
`;

const dustVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aRadius;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScroll;

  varying float vAlpha;

  void main() {
    float a = aSeed * 6.28318 + uTime * (0.08 + aSeed * 0.12);
    float tilt = aSeed * 3.14159;
    float r = aRadius * (1.0 + uScroll * 0.22);

    vec3 pos = vec3(cos(a) * r, sin(a + tilt) * r * 0.42, sin(a) * r);
    pos.y += sin(uTime * 0.5 + aSeed * 9.0) * 0.28;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.4 + aSeed * 2.4) * uPixelRatio * (22.0 / max(-mv.z, 0.001));
    vAlpha = 0.20 + aSeed * 0.45;
  }
`;

const dustFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * vAlpha);
  }
`;

export function mountStandmentScene(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const low = isLowPower();

  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const primary = new Color(theme.primary);
  const accent = new Color(theme.accent);
  const bg = new Color(theme.bg);

  const blobMaterial = new ShaderMaterial({
    vertexShader: blobVertex,
    fragmentShader: blobFragment,
    transparent: true,
    // 変位した面どうしが重なって破片状に見えるので、本体だけ深度を書く
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.55 },
      uScroll: { value: 0 },
      uPrimary: { value: primary },
      uAccent: { value: accent },
      uBg: { value: bg },
      uAlpha: { value: 1 },
    },
  });

  const blob = new Mesh(new IcosahedronGeometry(2.35, low ? 3 : 5), blobMaterial);
  scene.add(blob);

  const shellMaterial = blobMaterial.clone();
  shellMaterial.uniforms.uAmp.value = 0.78;
  shellMaterial.wireframe = true;
  shellMaterial.uniforms.uPrimary.value = accent;
  shellMaterial.uniforms.uAccent.value = accent;
  // 外殻は骨組みが硬く出るので、うんと薄く
  shellMaterial.uniforms.uAlpha.value = 0.28;
  shellMaterial.depthWrite = false;

  const shell = new Mesh(new IcosahedronGeometry(2.85, low ? 2 : 3), shellMaterial);
  scene.add(shell);

  const dustCount = low ? 700 : 2600;
  const dustGeometry = new BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const seeds = new Float32Array(dustCount);
  const radii = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    seeds[i] = Math.random();
    radii[i] = 3.4 + Math.random() * 3.6;
  }
  dustGeometry.setAttribute('position', new BufferAttribute(dustPos, 3));
  dustGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  dustGeometry.setAttribute('aRadius', new BufferAttribute(radii, 1));

  const dustMaterial = new ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uColor: { value: accent },
    },
  });

  const dust = new Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  scene.add(dust);

  const pointer = pointerTracker(canvas);

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = w / h < 0.85;
    camera.fov = narrow ? 56 : 42;
    camera.updateProjectionMatrix();
    dustMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    // 文字は左に置くので、立体は右に逃がす
    const offsetX = narrow ? 0.4 : 2.6;
    blob.position.x = offsetX;
    shell.position.x = offsetX;
    dust.position.x = offsetX;
    blob.position.y = narrow ? -1.2 : 0;
    shell.position.y = blob.position.y;
    dust.position.y = blob.position.y;
  });

  canvas.classList.add('is-ready');

  let scroll = 0;
  const readScroll = () => {
    const h = canvas.getBoundingClientRect().height || window.innerHeight;
    scroll = Math.min(window.scrollY / h, 1);
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  const loop = startLoop(canvas, (elapsed) => {
    const m = pointer.update(0.05);

    blobMaterial.uniforms.uTime.value = elapsed;
    blobMaterial.uniforms.uScroll.value = scroll;
    shellMaterial.uniforms.uTime.value = elapsed * 0.7;
    shellMaterial.uniforms.uScroll.value = scroll;
    dustMaterial.uniforms.uTime.value = elapsed;
    dustMaterial.uniforms.uScroll.value = scroll;

    blob.rotation.y = elapsed * 0.12 + m.x * 0.42 + scroll * 1.1;
    blob.rotation.x = m.y * -0.32 + scroll * 0.4;
    shell.rotation.y = -elapsed * 0.08 + m.x * 0.24;
    shell.rotation.z = elapsed * 0.05;
    dust.rotation.y = elapsed * 0.03 + m.x * 0.18;

    camera.position.x += (m.x * 0.7 - camera.position.x) * 0.05;
    camera.position.y += (m.y * 0.45 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  });

  return () => {
    loop.stop();
    stopResize();
    pointer.dispose();
    window.removeEventListener('scroll', readScroll);
    blob.geometry.dispose();
    shell.geometry.dispose();
    dustGeometry.dispose();
    blobMaterial.dispose();
    shellMaterial.dispose();
    dustMaterial.dispose();
    renderer.dispose();
  };
}
