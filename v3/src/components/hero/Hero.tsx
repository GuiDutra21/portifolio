import { Suspense, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { HERO_ASSETS, HERO_CONFIG, HERO_TEXT } from "./config";
import { HeroScene } from "./HeroScene";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-label="Início">
      {/* Imagem estática: aparece enquanto a cena carrega ou sem WebGL */}
      <img className={styles.fallback} src={HERO_ASSETS.sky} alt="" />
      <Canvas
        className={styles.canvas}
        flat
        camera={{ fov: 30, position: [0, 0, 12] }}
        dpr={[1, HERO_CONFIG.maxDpr]}
        gl={{ antialias: false }}
        aria-hidden="true"
      >
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      </Canvas>

      <div
        className={styles.content}
        style={
          {
            "--name-size": HERO_TEXT.nameSize,
            "--role-size": HERO_TEXT.roleSize,
          } as CSSProperties
        }
      >
        <h1 className={styles.name}>{HERO_TEXT.name}</h1>
        <p className={styles.role}>{HERO_TEXT.role}</p>
      </div>
    </section>
  );
}
