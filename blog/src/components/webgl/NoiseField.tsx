"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { fragmentShader, vertexShader } from "./shaders";

// A single triangle big enough to cover clip space, instead of a quad.
// Half the vertices, no diagonal seam, and the fragment shader derives UVs
// from gl_FragCoord anyway so the extra overhang past the screen is free.
function useFullscreenTriangle() {
  return useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);
}

interface NoiseFieldProps {
  active: boolean;
  mouse: React.RefObject<{ x: number; y: number }>;
}

// Drives the render loop by hand instead of relying on R3F's default
// always-on loop. With frameloop="demand" on the parent <Canvas>, nothing
// renders unless invalidate() is called -- so when `active` goes false
// (tab hidden, hero scrolled out of view) this simply stops scheduling
// frames and the GPU goes idle, rather than just freezing a uniform.
function FrameDriver({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const tick = () => {
      invalidate();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, invalidate]);

  return null;
}

export function NoiseField({ active, mouse }: NoiseFieldProps) {
  const geometry = useFullscreenTriangle();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const smoothedMouse = useRef({ x: 0, y: 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useFrame((state) => {
    if (!materialRef.current) return;

    const { width, height } = state.size;
    const dpr = state.viewport.dpr;
    uniforms.uResolution.value.set(width * dpr, height * dpr);
    uniforms.uTime.value = state.clock.elapsedTime;

    smoothedMouse.current.x += (mouse.current.x - smoothedMouse.current.x) * 0.04;
    smoothedMouse.current.y += (mouse.current.y - smoothedMouse.current.y) * 0.04;
    uniforms.uMouse.value.set(smoothedMouse.current.x, smoothedMouse.current.y);
  });

  return (
    <>
      <FrameDriver active={active} />
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
