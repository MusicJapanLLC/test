import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
} from 'three';
import { isLowPower, prefersReducedMotion } from '../lib/motion';
import { makeRenderer, onResize, startLoop } from '../lib/webgl';

/**
 * 本人写真をWebGLの板に貼り、触ったところだけ水面のように動かす。
 *
 * 写真そのものは加工しない（人物の顔を歪めない）。動かすのは
 * 「写真を見ている側の空気」＝ごく浅い波・わずかな色ずれ・斜めに走る光の帯で、
 * 振幅は指先の近くだけに減衰させる。
 *
 * 画像が無い / WebGLが使えない / 動きを減らす設定のときは何もしない。
 * 元の <img> がそのまま残るので、ページは常に成立する。
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2  uCover;     /* object-fit: cover 相当の補正 */
  uniform vec2  uFocus;     /* 表示の中心（顔を切らないよう少し上） */
  uniform float uTime;
  uniform vec2  uMouse;     /* 0..1。板の中での指先 */
  uniform float uHover;     /* 0..1。近づくほど効果を強める */
  uniform float uReveal;    /* 0..1。下から立ち上がる導入 */

  varying vec2 vUv;

  void main() {
    /*
     * cover 補正。写真の比率を崩さずに枠を埋める。
     * 中心は「余っている分」までしか寄せない。寄せすぎると端の画素が
     * 引き伸ばされて、写真の上下に帯が出る。
     */
    vec2 halfSpan = uCover * 0.5;
    vec2 center = clamp(uFocus, halfSpan, 1.0 - halfSpan);
    vec2 uv = (vUv - 0.5) * uCover + center;

    float d = distance(vUv, uMouse);
    float near = exp(-d * d * 14.0) * uHover;

    /* 指先まわりだけ、ごく浅い波。顔の形は動かさない程度に留める */
    float wave = sin(d * 26.0 - uTime * 2.6) * 0.006 * near;
    vec2 dir = normalize(vUv - uMouse + vec2(0.0001));
    vec2 warped = uv + dir * wave;

    /* 色ずれも指先の近くだけ。周辺は素の写真のまま */
    float split = 0.0022 * near;
    float r = texture2D(uTex, warped + vec2(split, 0.0)).r;
    float g = texture2D(uTex, warped).g;
    float b = texture2D(uTex, warped - vec2(split, 0.0)).b;
    vec3 color = vec3(r, g, b);

    /* 斜めに走る細い光。主張させず、たまに通り過ぎる程度に留める */
    float sweep = fract((vUv.x + vUv.y) * 1.4 - uTime * 0.11);
    color += smoothstep(0.994, 1.0, sweep) * 0.10;

    /* 四隅を落として、額の中に収める */
    vec2 v = vUv - 0.5;
    color *= 1.0 - smoothstep(0.42, 0.86, length(v)) * 0.45;

    /* 下から立ち上がる導入。境目に細い光を1本置く */
    float y = 1.0 - vUv.y;
    if (y > uReveal) discard;
    /* 光の線は立ち上がっている最中だけ。出きったら消す */
    color += step(uReveal, 0.999) * smoothstep(uReveal - 0.014, uReveal, y) * 0.55;

    gl_FragColor = vec4(color, 1.0);
  }
`;

type Handle = { dispose: () => void };

export function mountPortraitGL(
  frame: HTMLElement,
  img: HTMLImageElement,
): Handle | null {
  if (prefersReducedMotion()) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'pf-shot__gl';
  canvas.setAttribute('aria-hidden', 'true');
  frame.appendChild(canvas);

  const renderer = makeRenderer(canvas);
  const scene = new Scene();
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

  let texture: Texture | null = null;
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTex: { value: null },
      uCover: { value: new Vector2(1, 1) },
      uFocus: { value: new Vector2(0.5, 0.56) },
      uTime: { value: 0 },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uReveal: { value: 0 },
    },
  });

  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  scene.add(mesh);

  /* 画像の比率と枠の比率から cover 相当の倍率を出す */
  let frameAspect = 1;
  const applyCover = () => {
    if (!texture?.image) return;
    const iw = (texture.image as HTMLImageElement).naturalWidth || 1;
    const ih = (texture.image as HTMLImageElement).naturalHeight || 1;
    const imgAspect = iw / ih;
    const cover = material.uniforms.uCover.value as Vector2;
    if (imgAspect > frameAspect) {
      cover.set(frameAspect / imgAspect, 1);
    } else {
      cover.set(1, imgAspect / frameAspect);
    }
  };

  const loader = new TextureLoader();
  loader.load(
    img.currentSrc || img.src,
    (tex) => {
      texture = tex;
      material.uniforms.uTex.value = tex;
      applyCover();
      canvas.classList.add('is-ready');
      frame.classList.add('has-gl');
    },
    undefined,
    () => {
      // 読めなければ何もしない。元の <img> がそのまま見え続ける
      canvas.remove();
    },
  );

  const target = { hover: 0, mx: 0.5, my: 0.5 };

  const onMove = (e: PointerEvent) => {
    const rect = frame.getBoundingClientRect();
    target.mx = (e.clientX - rect.left) / rect.width;
    target.my = 1 - (e.clientY - rect.top) / rect.height;
  };
  const onEnter = () => {
    target.hover = 1;
  };
  const onLeave = () => {
    target.hover = 0;
  };

  if (!isLowPower()) {
    frame.addEventListener('pointermove', onMove);
    frame.addEventListener('pointerenter', onEnter);
    frame.addEventListener('pointerleave', onLeave);
  }

  const stopResize = onResize(canvas, (w, h) => {
    renderer.setSize(w, h, false);
    frameAspect = w / h;
    applyCover();
  });

  const loop = startLoop(canvas, (elapsed, delta) => {
    const u = material.uniforms;
    u.uTime.value = elapsed;

    const mouse = u.uMouse.value as Vector2;
    mouse.x += (target.mx - mouse.x) * Math.min(1, delta * 8);
    mouse.y += (target.my - mouse.y) * Math.min(1, delta * 8);
    u.uHover.value += (target.hover - u.uHover.value) * Math.min(1, delta * 5);

    // 立ち上がりは最初の一度だけ
    if (u.uReveal.value < 1) u.uReveal.value = Math.min(1, u.uReveal.value + delta * 1.1);

    if (texture) renderer.render(scene, camera);
  });

  return {
    dispose() {
      loop.stop();
      stopResize();
      frame.removeEventListener('pointermove', onMove);
      frame.removeEventListener('pointerenter', onEnter);
      frame.removeEventListener('pointerleave', onLeave);
      texture?.dispose();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      canvas.remove();
      frame.classList.remove('has-gl');
    },
  };
}
