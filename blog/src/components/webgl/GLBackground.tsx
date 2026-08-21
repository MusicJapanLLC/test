"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NoiseField } from "./NoiseField";
import styles from "./GLBackground.module.css";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function GLBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });

  const [canRender, setCanRender] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCanRender(!reducedMotion && supportsWebGL());
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0 }
    );
    observer.observe(node);

    const onVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onPointerMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      mouse.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };
    node.addEventListener("pointermove", onPointerMove);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      node.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container} aria-hidden="true">
      <div className={styles.fallback} />
      {canRender && (
        <Canvas
          className={styles.canvas}
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        >
          <NoiseField active={inView && pageVisible} mouse={mouse} />
        </Canvas>
      )}
    </div>
  );
}
