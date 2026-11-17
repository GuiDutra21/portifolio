import { Suspense, useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { useInView, useMotionValueEvent, useScroll } from "motion/react";
import { About } from "../about/About";
import { HERO_ASSETS, HERO_CONFIG, HERO_TEXT } from "./config";
import { diveFrame, diveScrollLength, diveState, scrollToProgress, type Rect } from "./dive";
import { HeroScene } from "./HeroScene";
import { Sparks } from "./Sparks";
import styles from "./Hero.module.css";

// Proporção da imagem do céu (public/hero/background-base.png)
const SKY_ASPECT = 1761 / 893;

// Onde uma coordenada x da imagem do céu cai na tela, com o enquadramento
// "cover" das camadas (mesma conta do coverUv em glsl.ts).
function imageXToScreen(fx: number) {
  const rs = window.innerWidth / window.innerHeight;
  const sx = rs > SKY_ASPECT ? 1 : rs / SKY_ASPECT;
  return (fx - 0.5) / sx + 0.5;
}

type Props = {
  // true = transição para o "Sobre" (o "Sobre" fica dentro do palco do hero)
  dive: boolean;
};

export function Hero({ dive }: Props) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });

  // Aplica um instante da transição: estado das camadas WebGL + variáveis CSS
  const apply = useCallback(
    (scroll: number) => {
      const el = stage.current;
      if (!el || !dive) return;
      const p = scrollToProgress(scroll);
      diveState.progress = p;
      const f = diveFrame(p);
      const w = el.clientWidth;
      el.style.setProperty("--text-out", f.textOut.toFixed(4));
      el.style.setProperty("--line-l", `${(f.lineL * w).toFixed(1)}px`);
      el.style.setProperty("--line-r", `${(f.lineR * w).toFixed(1)}px`);
      el.style.setProperty("--line-op", f.lineOpacity.toFixed(4));
      el.style.setProperty("--line-grow", f.lineGrow.toFixed(4));
      el.style.setProperty("--reveal-on", f.splitting ? "1" : "0");
      if (scene.current) scene.current.style.filter = f.sceneBlur > 0.05 ? `blur(${f.sceneBlur.toFixed(2)}px)` : "none";
      setReady(f.ready);
    },
    [dive],
  );

  useMotionValueEvent(scrollYProgress, "change", apply);

  // Liga/desliga a transição e acompanha o tamanho da tela
  useLayoutEffect(() => {
    diveState.active = dive;
    if (!dive) {
      diveState.progress = 0;
      return;
    }
    const resize = () => {
      diveState.beamX = imageXToScreen(HERO_CONFIG.light.source[0]);
      diveState.aspect = window.innerWidth / window.innerHeight;
      apply(scrollYProgress.get());
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      diveState.active = false;
    };
  }, [dive, apply, scrollYProgress]);

  const onMeasure = useCallback(
    (photo: Rect, text: Rect) => {
      diveState.photoRect = photo;
      diveState.textRect = text;
      apply(scrollYProgress.get());
    },
    [apply, scrollYProgress],
  );

  // A cena WebGL só renderiza enquanto o hero aparece na tela
  const inView = useInView(track);

  return (
    <section
      ref={track}
      className={`${styles.track} ${dive ? "" : styles.still}`}
      aria-label="Início"
      style={{ "--dive": `${diveScrollLength().toFixed(2)}svh` } as CSSProperties}
    >
      <div ref={stage} className={styles.stage}>
        <div ref={scene} className={styles.scene}>
          {/* Imagem estática: aparece enquanto a cena carrega ou sem WebGL */}
          <img className={styles.fallback} src={HERO_ASSETS.sky} alt="" />
          <Canvas
            className={styles.canvas}
            flat
            frameloop={inView ? "always" : "never"}
            camera={{ fov: 30, position: [0, 0, 12] }}
            dpr={[1, HERO_CONFIG.maxDpr]}
            gl={{ antialias: false }}
            resize={{ offsetSize: true }}
            aria-hidden="true"
          >
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
          </Canvas>
        </div>

        {dive && (
          <>
            <About mode="stage" onMeasure={onMeasure} ready={dive && ready} />
            {/* linhas de transformação: nascem no lugar do feixe e se separam */}
            <div className={`${styles.line} ${styles.lineL}`} aria-hidden="true" />
            <div className={`${styles.line} ${styles.lineR}`} aria-hidden="true" />
            <Sparks className={styles.sparks} />
          </>
        )}

        <div
          className={styles.content}
          style={
            {
              "--name-size": HERO_TEXT.nameSize,
              "--role-size": HERO_TEXT.roleSize,
            } as CSSProperties
          }
        >
          <div className={styles.exit}>
            <h1 className={styles.name}>{HERO_TEXT.name}</h1>
            <p className={styles.role}>{HERO_TEXT.role}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
