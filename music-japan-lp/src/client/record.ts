import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Matrix4,
  NormalBlending,
  PerspectiveCamera,
  Plane,
  Points,
  Ray,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { clamp, isMobile, webglOk } from './env';

/**
 * トップの右側：点でできたレコード。
 * - 溝は数千の墨の点。公式のマークと同じく、左側が明るく右側が沈む
 * - ゆっくり回り、赤い弧がいっしょに回る
 * - カーソルの近くの溝が、少し浮き上がる
 * - ときどき赤い点が溝から離れて、外へ流れていく（音が、人と人のつながりになっていく）
 * - 下へ読み進めると、レコードが起き上がり、溝がほどける
 */
const vert = /* glsl */ `
  attribute vec2 aPolar;   // 半径, 角度
  attribute float aKind;   // 0 溝 / 1 赤い弧 / 2 ラベル / 3 離れていく点
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uSpin;
  uniform float uDpr;
  uniform float uSize;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uOpen;
  varying float vAlpha;
  varying float vRed;

  void main() {
    float r = aPolar.x;
    float th = aPolar.y + uSpin;
    vec3 p = vec3(cos(th) * r, sin(th) * r, 0.0);
    // 溝のわずかなうねり
    p.z += sin(th * 3.0 + r * 22.0) * 0.004;
    // カーソルの近くが浮く
    float d = distance(p.xy, uMouse);
    float lift = smoothstep(0.42, 0.0, d) * uHover;
    p.z += lift * (0.07 + 0.05 * sin(r * 70.0 - uTime * 5.0));
    // 読み進めると、溝がほどける
    p.z += uOpen * (aRand.x - 0.5) * 0.9 * r;
    p.xy *= 1.0 + uOpen * (aRand.y - 0.3) * 0.25;

    float alpha;
    float red = 0.0;
    if (aKind > 2.5) {
      // 離れていく点：溝の上から、外へ、少し上へ
      float life = fract(uTime * (0.05 + aRand.y * 0.04) + aRand.z);
      float a = aRand.w * 6.2831;
      vec2 start = vec2(cos(th), sin(th)) * r;
      vec2 dir = normalize(start + vec2(cos(a), sin(a)) * 0.6);
      p = vec3(start + dir * life * 0.95, life * 0.55 + uOpen * 0.4);
      alpha = sin(life * 3.14159) * 0.95;
      red = 1.0;
    } else if (aKind > 1.5) {
      alpha = 0.55 + aRand.z * 0.35;
      red = 1.0;
    } else if (aKind > 0.5) {
      alpha = 0.95;
      red = 1.0;
    } else {
      // 公式マークと同じ光の当たり方：左が明るく、右が沈む（溝が回っても光は動かない）
      float sheen = 0.5 + 0.5 * cos(th - 2.55);
      float groove = 0.55 + 0.45 * step(0.5, fract(r * 34.0));
      alpha = (0.16 + 0.62 * sheen) * groove * (0.75 + aRand.z * 0.35);
      alpha += lift * 0.35;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = aKind > 2.5 ? 3.2 : (aKind > 0.5 ? 2.3 : 1.55);
    gl_PointSize = uSize * s * uDpr * (3.2 / -mv.z) * (0.8 + aRand.w * 0.4) * (1.0 + lift * 0.6);
    vAlpha = alpha;
    vRed = red;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uRed;
  varying float vAlpha;
  varying float vRed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.18, d) * vAlpha;
    gl_FragColor = vec4(mix(uInk, uRed, vRed), a);
  }
`;

function buildGeometry(mobile: boolean): BufferGeometry {
  const polar: number[] = [];
  const kind: number[] = [];
  const rand: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const push = (r: number, th: number, k: number) => {
    polar.push(r, th);
    kind.push(k);
    rand.push(rnd(), rnd(), rnd(), rnd());
  };
  const rings = mobile ? 34 : 50;
  const density = mobile ? 46 : 64;
  for (let i = 0; i < rings; i++) {
    const r = 0.34 + (i / (rings - 1)) * 0.66;
    const n = Math.floor(Math.PI * 2 * r * density);
    for (let j = 0; j < n; j++) push(r + (rnd() - 0.5) * 0.004, rnd() * Math.PI * 2, 0);
  }
  // 赤い弧（公式マークの赤い線）
  for (let j = 0; j < (mobile ? 90 : 150); j++) push(0.66 + (rnd() - 0.5) * 0.01, 0.35 + rnd() * 1.6, 1);
  // ラベル（真ん中の赤い円）
  for (let j = 0; j < (mobile ? 260 : 420); j++) {
    const r = Math.sqrt(0.004 + rnd() * 0.06);
    push(r, rnd() * Math.PI * 2, 2);
  }
  // 離れていく点
  for (let j = 0; j < (mobile ? 16 : 28); j++) push(0.4 + rnd() * 0.58, rnd() * Math.PI * 2, 3);

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(kind.length * 3), 3));
  g.setAttribute('aPolar', new Float32BufferAttribute(polar, 2));
  g.setAttribute('aKind', new Float32BufferAttribute(kind, 1));
  g.setAttribute('aRand', new Float32BufferAttribute(rand, 4));
  return g;
}

export function record(reduced: boolean) {
  const host = document.querySelector<HTMLElement>('[data-record]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-record-canvas]');
  if (!host || !canvas) return;
  if (!webglOk()) {
    host.classList.add('is-fallback');
    return;
  }
  const mobile = isMobile();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  } catch {
    host.classList.add('is-fallback');
    return;
  }
  const css = getComputedStyle(document.documentElement);
  const ink = new Color(css.getPropertyValue('--ink').trim() || '#141414');
  const red = new Color(css.getPropertyValue('--accent').trim() || '#d62b33');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  const group = new Group();
  scene.add(group);

  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uDpr: { value: dpr },
      uSize: { value: mobile ? 1.7 : 1.9 },
      uHover: { value: 0 },
      uMouse: { value: new Vector2(9, 9) },
      uOpen: { value: 0 },
      uInk: { value: ink },
      uRed: { value: red },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
  });
  const points = new Points(buildGeometry(mobile), mat);
  points.frustumCulled = false;
  group.add(points);

  const size = () => {
    const r = host.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  };
  size();
  window.addEventListener('resize', size);

  // カーソルを、レコードの面の上の位置に変える
  const ray = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const inv = new Matrix4();
  const hit = new Vector3();
  const local = new Ray();
  const pointer = { x: 0, y: 0, on: false, tx: 0, ty: 0 };
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointer.on = e.pointerType === 'mouse';
  });
  host.addEventListener('pointerleave', () => (pointer.on = false));

  const hero = document.querySelector<HTMLElement>('.hero');
  let spin = 0.6;
  let hover = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // 最初の画面をどれだけ読み進めたか（0..1）
    const h = hero?.getBoundingClientRect();
    const open = h ? clamp(-h.top / (h.height * 0.9)) : 0;
    spin += dt * (0.16 + open * 0.3);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5);
    hover += ((pointer.on ? 1 : 0) - hover) * Math.min(1, dt * 4);

    group.rotation.set(-0.98 + open * 0.55 + pointer.y * 0.07, pointer.x * 0.12, -0.18);
    group.position.set(0, -0.05 + open * 0.25, 0);
    group.updateMatrixWorld(true);

    ray.setFromCamera(new Vector2(pointer.x, pointer.y), camera);
    inv.copy(group.matrixWorld).invert();
    local.copy(ray.ray).applyMatrix4(inv);
    if (local.intersectPlane(plane, hit)) (mat.uniforms.uMouse.value as Vector2).set(hit.x, hit.y);

    mat.uniforms.uTime.value = now / 1000;
    mat.uniforms.uSpin.value = spin;
    mat.uniforms.uHover.value = hover;
    mat.uniforms.uOpen.value = open;
    renderer.render(scene, camera);
  };

  host.classList.add('is-ready');
  if (reduced) {
    frame(performance.now());
    window.addEventListener('resize', () => frame(performance.now()));
    return;
  }
  let raf = 0;
  let running = false;
  const loop = (now: number) => {
    frame(now);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running && !document.hidden) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!e.isIntersecting && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }).observe(host);
}
