"use client";

import dynamic from "next/dynamic";
import styles from "./Hero.module.css";

const GLBackground = dynamic(
  () => import("./webgl/GLBackground").then((mod) => mod.GLBackground),
  { ssr: false }
);

export function Hero() {
  return (
    <section className={styles.hero}>
      <GLBackground />
      <div className={styles.content}>
        <p className={styles.eyebrow}>personal / unfiltered</p>
        <h1 className={styles.title}>クソみたいなブログ</h1>
        <p className={styles.tagline}>
          AIをどう使っているか、何を試して何がダメだったかを、思いついた順にだらだら書いていく。
          会員登録もコメント欄もない、自分専用のブログです。
        </p>
      </div>
    </section>
  );
}
