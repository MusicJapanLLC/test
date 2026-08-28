import {
  BoxGeometry,
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  type BufferGeometry,
} from 'three';
import type { MonumentKind, Theme } from '../types';

/**
 * 各サービスのヒーローに置く立体。
 * 3Dモデルは読み込まない。小さな箱を並べ方だけで意味づける。
 * 描画は InstancedMesh 1つなので、スマホでも負荷が乗らない。
 */

const vertexShader = /* glsl */ `
  attribute float aSeed;

  uniform float uTime;
  uniform float uScroll;

  varying vec3  vNormalW;
  varying vec3  vViewDir;
  varying float vSeed;

  void main() {
    vSeed = aSeed;

    // 一つひとつがわずかに息をする
    float breath = sin(uTime * 0.45 + aSeed * 6.28318) * 0.028;
    vec3 pos = position * (1.0 + breath);

    vec4 world = instanceMatrix * vec4(pos, 1.0);
    world.xyz *= 1.0 + uScroll * 0.12;

    vec4 mv = modelViewMatrix * world;
    vNormalW = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
    vViewDir = normalize(-mv.xyz);

    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform vec3  uBg;
  uniform float uTime;

  varying vec3  vNormalW;
  varying vec3  vViewDir;
  varying float vSeed;

  void main() {
    vec3 n = normalize(vNormalW);

    // 光源は置かない。面の向きだけで陰影をつくる
    float lambert = clamp(dot(n, normalize(vec3(0.45, 0.8, 0.6))), 0.0, 1.0);
    float fresnel = pow(1.0 - clamp(dot(n, normalize(vViewDir)), 0.0, 1.0), 2.4);

    // 個体差と、ゆっくり巡る明滅
    float shift = 0.5 + 0.5 * sin(uTime * 0.35 + vSeed * 6.28318);
    vec3 base = mix(uPrimary, uAccent, clamp(vSeed * 0.16 + shift * 0.06, 0.0, 1.0));

    vec3 color = mix(base * 0.58, base * 1.18, lambert);
    color = mix(color, uAccent, fresnel * 0.20);

    float alpha = 0.82 + lambert * 0.12 + fresnel * 0.06;
    gl_FragColor = vec4(color, alpha);
  }
`;

type Placement = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number };

/** 並べ方だけで意味を変える。かたちの定義はここに集約する */
function layout(kind: MonumentKind, count: number): Placement[] {
  const out: Placement[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);

    switch (kind) {
      // 積み上がる: 螺旋を描いて上へ伸びる塔
      case 'stack': {
        const turns = 3.2;
        const a = t * Math.PI * 2 * turns;
        const radius = 1.5 + Math.sin(t * Math.PI) * 0.85;
        out.push({
          x: Math.cos(a) * radius,
          y: (t - 0.5) * 5.6,
          z: Math.sin(a) * radius,
          rx: 0,
          ry: -a,
          rz: 0,
          s: 0.5 + (1 - t) * 0.42,
        });
        break;
      }

      // 組み合わさる: 立方体の骨組みに部品が噛み合う
      case 'lattice': {
        const per = Math.round(Math.cbrt(count));
        const ix = i % per;
        const iy = Math.floor(i / per) % per;
        const iz = Math.floor(i / (per * per)) % per;
        const edge =
          Number(ix === 0 || ix === per - 1) +
          Number(iy === 0 || iy === per - 1) +
          Number(iz === 0 || iz === per - 1);
        if (edge < 2) continue; // 面や内側は省いて、稜線だけ残す
        const step = 4.4 / (per - 1);
        out.push({
          x: ix * step - 2.2,
          y: iy * step - 2.2,
          z: iz * step - 2.2,
          rx: 0,
          ry: 0,
          rz: 0,
          s: 0.42,
        });
        break;
      }

      // 寄り集まる: ゆるい球に散らばりながら、中心へ寄る
      case 'cluster': {
        const y = 1 - t * 2;
        const r = Math.sqrt(Math.max(1 - y * y, 0));
        const a = golden * i;
        const shell = 2.0 + Math.sin(i * 1.7) * 0.75;
        out.push({
          x: Math.cos(a) * r * shell,
          y: y * shell * 0.92,
          z: Math.sin(a) * r * shell,
          rx: a,
          ry: a * 0.6,
          rz: 0,
          s: 0.3 + Math.abs(Math.sin(i * 2.3)) * 0.3,
        });
        break;
      }

      // 包む: 中心を層が囲う
      case 'shield': {
        const ring = i % 3;
        const k = Math.floor(i / 3);
        const total = Math.ceil(count / 3);
        const a = (k / total) * Math.PI * 2 + ring * 0.55;
        const radius = 1.5 + ring * 0.82;
        const tilt = (ring - 1) * 0.42;
        out.push({
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius * Math.cos(tilt),
          z: Math.sin(a) * radius * Math.sin(tilt),
          rx: tilt,
          ry: -a,
          rz: 0,
          s: 0.34 + (2 - ring) * 0.1,
        });
        break;
      }

      // 絞り込まれる: 広い上から、下の一点へ
      case 'funnel': {
        const a = golden * i;
        const depth = t;
        const radius = 3.1 * (1 - depth) ** 1.5 + 0.18;
        out.push({
          x: Math.cos(a) * radius,
          y: 2.5 - depth * 5.0,
          z: Math.sin(a) * radius,
          rx: 0,
          ry: -a,
          rz: 0,
          s: 0.26 + (1 - depth) * 0.34,
        });
        break;
      }
    }
  }

  return out;
}

function geometryFor(kind: MonumentKind): BufferGeometry {
  switch (kind) {
    case 'cluster':
      return new IcosahedronGeometry(0.5, 0);
    case 'funnel':
      return new IcosahedronGeometry(0.5, 0);
    default:
      return new BoxGeometry(0.9, 0.9, 0.9);
  }
}

/**
 * three は Color をリニア空間で保持するが、素の ShaderMaterial は
 * 出力時に sRGB へ戻す処理が入らない。そのまま渡すと暗く濁るので、
 * ここで sRGB 値に直してからシェーダーへ送る。
 */
const toSRGB = (hex: string): Color => new Color(hex).convertLinearToSRGB();

export type Monument = {
  mesh: InstancedMesh;
  material: ShaderMaterial;
  update: (elapsed: number, scroll: number, mouse: { x: number; y: number }) => void;
  dispose: () => void;
};

export function createMonument(kind: MonumentKind, theme: Theme, low: boolean): Monument {
  const requested = low ? 84 : 168;
  const places = layout(kind, kind === 'lattice' ? (low ? 125 : 216) : requested);

  const geometry = geometryFor(kind);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPrimary: { value: toSRGB(theme.primary) },
      uAccent: { value: toSRGB(theme.accent) },
      uBg: { value: toSRGB(theme.bg) },
    },
  });

  const mesh = new InstancedMesh(geometry, material, places.length);
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const seeds = new Float32Array(places.length);

  places.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, p.rz);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    seeds[i] = i / places.length;
  });
  mesh.instanceMatrix.needsUpdate = true;
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));

  return {
    mesh,
    material,
    update(elapsed, scroll, mouse) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uScroll.value = scroll;

      mesh.rotation.y = elapsed * 0.07 + mouse.x * 0.38 + scroll * 0.62;
      mesh.rotation.x = mouse.y * -0.22 + Math.sin(elapsed * 0.14) * 0.045;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
