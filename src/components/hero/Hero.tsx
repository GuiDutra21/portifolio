import { Suspense, useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { useInView, useMotionValueEvent, useScroll } from "motion/react";
import { About } from "../about/About";
import { Projects } from "../projects/Projects";
import { HERO_ASSETS, HERO_CONFIG, HERO_MONITOR, HERO_TEXT } from "./config";
import { diveFrame, diveScrollLength, diveState, monitorFrame, scrollToPhases, type Rect } from "./dive";
import { HeroScene } from "./HeroScene";
import { Sparks } from "./Sparks";
import styles from "./Hero.module.css";

// Proporção da imagem do céu (public/hero/background-base.png)
const SKY_ASPECT = 1761 / 893;

// Onde um ponto da imagem do céu cai na tela (frações), com o enquadramento
// "cover" das camadas (mesma conta do coverUv em glsl.ts).
function imageToScreen(fx: number, fy: number) {
  const rs = window.innerWidth / window.innerHeight;
  const sx = rs > SKY_ASPECT ? 1 : rs / SKY_ASPECT;
  const sy = rs > SKY_ASPECT ? SKY_ASPECT / rs : 1;
  return { x: (fx - 0.5) / sx + 0.5, y: (fy - 0.5) / sy + 0.5 };
}

type Props = {
  // true = transição para o "Sobre" (o "Sobre" fica dentro do palco do hero)
  dive: boolean;
};

export function Hero({ dive }: Props) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const screenEl = useRef<HTMLDivElement>(null);
  const previewEl = useRef<HTMLDivElement>(null);
  const monitor = useRef({ x: 0, y: 0, w: 1, h: 1 }); // tela do monitor, em px
  const [ready, setReady] = useState(false);

  // Câmera indo até a tela do monitor: a cena inteira e a tela do monitor
  // crescem JUNTAS (como uma coisa só), a partir do monitor, que vai para o
  // centro. O zoom é "geométrico" (mesmo ritmo do começo ao fim) e, no fim, a
  // tela do monitor ocupa exatamente a tela toda.
  // A tela é HTML (fica nítida em qualquer tamanho) e mostra a tela de
  // projetos em miniatura; a cena em volta desfoca, como uma câmera focada
  // na tela (a imagem não tem resolução para um zoom tão grande).
  const placeCamera = useCallback((mf: ReturnType<typeof monitorFrame>, done: boolean, baseBlur: number) => {
    const el = screenEl.current;
    const pv = previewEl.current;
    const sc = scene.current;
    if (!el || !pv || !sc) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const mon = monitor.current;
    const u = mf.approach;
    // zoom: de 1 até a tela do monitor ter a largura da tela
    const zoomEnd = W / mon.w;
    const S = Math.pow(zoomEnd, u);
    // a tela do monitor só muda de proporção no fim (até a da tela), quando
    // já ocupa quase tudo; antes disso ela acompanha o monitor da cena
    const a0 = mon.w / mon.h;
    const morph = Math.min(1, Math.max(0, (u - 0.75) / 0.25));
    const aspect = a0 * Math.pow(W / H / a0, morph * morph * (3 - 2 * morph));
    const w = mon.w * S;
    const h = w / aspect;
    // o monitor vem para o centro (a câmera desce e o fundo sobe), chegando
    // lá um pouco antes do fim da aproximação
    const c = 1 - Math.pow(1 - Math.min(1, u / HERO_MONITOR.centerBy), 2);
    const cx = mon.x + (W / 2 - mon.x) * c;
    const cy = mon.y + (H / 2 - mon.y) * c;

    // cena: o ponto do monitor fica preso ao centro da tela do monitor
    if (u > 0) {
      sc.style.transform = `translate(${(cx - mon.x * S).toFixed(2)}px, ${(cy - mon.y * S).toFixed(2)}px) scale(${S.toFixed(4)})`;
    } else {
      sc.style.transform = "";
    }
    // desfoque em px da imagem (o filtro cresce junto com o zoom); começa só
    // depois de um pouco de zoom, quando os pixels começariam a aparecer
    const dof = HERO_MONITOR.blur * Math.min(1, Math.max(0, (S - 1.3) / 2.5));
    const blur = baseBlur + dof;
    const dim = 1 - HERO_MONITOR.darken * u;
    const filters = [];
    if (blur > 0.02) filters.push(`blur(${blur.toFixed(2)}px)`);
    if (dim < 0.999) filters.push(`brightness(${dim.toFixed(3)})`);
    sc.style.filter = filters.length ? filters.join(" ") : "none";

    // moldura da tela: termina um pouco além das bordas, para a borda sumir
    const pad = 3 * u;
    el.style.width = `${(w + 2 * pad).toFixed(1)}px`;
    el.style.height = `${(h + 2 * pad).toFixed(1)}px`;
    el.style.transform = `translate(${(cx - w / 2 - pad).toFixed(1)}px, ${(cy - h / 2 - pad).toFixed(1)}px)`;
    // miniatura: termina exatamente na tela (igual à seção de verdade); some
    // no MESMO instante em que a seção de verdade aparece
    pv.style.visibility = mf.screenOn > 0 && !done ? "visible" : "hidden";
    pv.style.transform =
      u >= 1
        ? "none"
        : `translate(${(cx - w / 2).toFixed(2)}px, ${(cy - h / 2).toFixed(2)}px) scale(${(w / W).toFixed(5)}, ${(h / H).toFixed(5)})`;
  }, []);

  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });

  // Aplica um instante da transição: estado das camadas WebGL + variáveis CSS
  const apply = useCallback(
    (scroll: number) => {
      const el = stage.current;
      if (!el || !dive) return;
      const { p, m } = scrollToPhases(scroll);
      diveState.progress = p;
      diveState.monitor = m;
      const f = diveFrame(p);
      const mf = monitorFrame(m);
      const w = el.clientWidth;
      el.style.setProperty("--text-out", f.textOut.toFixed(4));
      // links do hero deixam de ser clicáveis quando o texto já saiu
      el.dataset.textOut = f.textOut > 0.5 ? "1" : "0";
      el.style.setProperty("--line-l", `${(f.lineL * w).toFixed(1)}px`);
      el.style.setProperty("--line-r", `${(f.lineR * w).toFixed(1)}px`);
      el.style.setProperty("--line-op", f.lineOpacity.toFixed(4));
      el.style.setProperty("--line-grow", f.lineGrow.toFixed(4));
      el.style.setProperty("--reveal-on", f.splitting ? "1" : "0");
      // "Sobre" → projetos: o "Sobre" sai, o monitor brilha e tudo dissolve
      el.style.setProperty("--about-out", mf.aboutOut.toFixed(4));
      el.style.setProperty("--screen-on", mf.screenOn.toFixed(4));
      // o brilho interno da moldura diminui enquanto ela cresce
      el.style.setProperty("--frame-glow", (1 - 0.7 * mf.approach).toFixed(4));
      // fim do trecho: a seção de projetos (que sobe por cima do fim do hero)
      // assume, exatamente onde a miniatura está; sem fade
      const root = document.documentElement;
      const done = m >= 0.999;
      root.style.setProperty("--projects-in", done ? "1" : "0");
      root.dataset.projectsReady = done ? "1" : "0";
      // (o desfoque do "Sobre" some enquanto a cena volta)
      placeCamera(mf, done, f.sceneBlur * (1 - mf.sceneIn));
      setReady(f.ready && m < 0.02);
    },
    [dive, placeCamera],
  );

  useMotionValueEvent(scrollYProgress, "change", apply);

  // Liga/desliga a transição e acompanha o tamanho da tela
  useLayoutEffect(() => {
    diveState.active = dive;
    if (!dive) {
      diveState.progress = 0;
      document.documentElement.style.removeProperty("--projects-in");
      delete document.documentElement.dataset.projectsReady;
      return;
    }
    const resize = () => {
      diveState.beamX = imageToScreen(HERO_CONFIG.light.source[0], 0).x;
      const mon = imageToScreen(...HERO_MONITOR.focus);
      stage.current?.style.setProperty("--mon-x", `${(mon.x * 100).toFixed(2)}%`);
      stage.current?.style.setProperty("--mon-y", `${(mon.y * 100).toFixed(2)}%`);
      // tamanho da imagem do céu na tela ("cover") → tamanho da tela do monitor
      const W = window.innerWidth;
      const H = window.innerHeight;
      const imgW = Math.max(W, H * SKY_ASPECT);
      const imgH = imgW / SKY_ASPECT;
      monitor.current = {
        x: mon.x * W,
        y: mon.y * H,
        w: HERO_MONITOR.screen[0] * imgW,
        h: HERO_MONITOR.screen[1] * imgH,
      };
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
      id="inicio"
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
            {/* "Sobre" → projetos: a tela do monitor crescendo até cobrir tudo */}
            <div ref={previewEl} className={styles.projectsPreview} aria-hidden="true">
              <Projects preview />
            </div>
            <div ref={screenEl} className={styles.monitorScreen} aria-hidden="true" />
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
            <ul className={styles.links}>
              {HERO_TEXT.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer">
                    {l.label}
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
