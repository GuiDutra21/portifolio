import { useLayoutEffect, useRef, type PointerEvent } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import type { Rect } from "../hero/dive";
import { ABOUT } from "./content";
import { PhotoMaterialize } from "./PhotoMaterialize";
import { useTextMaterialize } from "./useTextMaterialize";
import styles from "./About.module.css";

const EASE = [0.2, 0.7, 0.2, 1] as const;

// Entrada da seção comum (celular / movimento reduzido): sobe, desfoca e aparece
const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.2 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE } },
};
const photo: Variants = {
  hidden: { opacity: 0, x: -28, scale: 1.08, filter: "blur(10px)" },
  show: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)", transition: { duration: 1.4, ease: EASE } },
};

type Props = {
  // "section": seção comum, abaixo do hero, com entrada ao aparecer na tela.
  // "stage": dentro do palco do hero; quem revela é a transição (as linhas).
  mode?: "section" | "stage";
  // (stage) posição da foto e do texto, em frações do palco
  onMeasure?: (photo: Rect, text: Rect) => void;
  // (stage) transição terminou: a seção fica interativa
  ready?: boolean;
};

export function About({ mode = "section", onMeasure, ready = false }: Props) {
  const stage = mode === "stage";
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);

  // Parallax sutil com o mouse, como as nuvens do hero
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const photoX = useTransform(sx, (v) => v * 10);
  const photoY = useTransform(sy, (v) => v * 8);

  const onPointerMove = (e: PointerEvent) => {
    if (reducedMotion || e.pointerType !== "mouse") return;
    const r = root.current!.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  // (stage) o texto aparece em "pixels" atrás da linha da direita
  const text = useTextMaterialize<HTMLDivElement>(stage && !ready);

  // (stage) mede onde a foto e o texto ficam, para o mosaico e as linhas
  useLayoutEffect(() => {
    if (!stage || !onMeasure) return;
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      const m = media.current?.getBoundingClientRect();
      const t = text.current?.getBoundingClientRect();
      if (!r || !m || !t || r.width === 0) return;
      const norm = (b: DOMRect): Rect => [
        (b.left - r.left) / r.width,
        (b.top - r.top) / r.height,
        (b.right - r.left) / r.width,
        (b.bottom - r.top) / r.height,
      ];
      onMeasure(norm(m), norm(t));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [root, media, text].forEach((el) => el.current && ro.observe(el.current));
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [stage, onMeasure, text]);

  const anim = !stage;
  const reveal = anim ? { initial: "hidden", whileInView: "show" } : {};

  return (
    <section
      ref={root}
      id="sobre"
      className={`${styles.about} ${stage ? styles.stage : ""} ${ready ? styles.ready : ""}`}
      aria-labelledby="about-title"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div
        ref={media}
        className={styles.media}
        {...reveal}
        viewport={{ once: true, amount: 0.25 }}
      >
        <motion.div className={styles.photoFrame} style={{ x: photoX, y: photoY }}>
          <motion.img
            // (stage) durante a transição quem aparece é o canvas abaixo
            className={`${styles.photo} ${stage && !ready ? styles.photoHidden : ""}`}
            src={ABOUT.photo}
            alt={ABOUT.photoAlt}
            width={900}
            height={1200}
            variants={anim ? photo : undefined}
          />
          {stage && !ready && <PhotoMaterialize src={ABOUT.photo} className={styles.photoCanvas} />}
        </motion.div>
      </motion.div>

      <motion.div
        ref={text}
        className={styles.text}
        variants={anim ? list : undefined}
        {...reveal}
        viewport={{ once: true, amount: 0.25 }}
      >
        <motion.p className="section-label" variants={anim ? item : undefined}>
          {ABOUT.index} / {ABOUT.label}
        </motion.p>

        <motion.h2 id="about-title" className={styles.title} variants={anim ? item : undefined}>
          {ABOUT.title}
        </motion.h2>

        {ABOUT.paragraphs.map((p) => (
          <motion.p key={p} className={styles.paragraph} variants={anim ? item : undefined}>
            {p}
          </motion.p>
        ))}

      </motion.div>
    </section>
  );
}
