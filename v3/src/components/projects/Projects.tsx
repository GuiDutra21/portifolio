import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { PROJECTS, PROJECTS_SECTION, type Project } from "./content";
import { ProjectModal } from "./ProjectModal";
import styles from "./Projects.module.css";

// Carrossel em "barril" (como no vídeo de referência): os cartões ficam em
// volta de um cilindro vertical, vistos de frente e um pouco de cima, e giram
// arrastando (ou pelas setas / teclado). Ao soltar, encaixa no cartão mais
// próximo. Com 4 projetos o barril tem 8 faces (cada projeto aparece 2 vezes),
// para os vizinhos ficarem inclinados e não de lado.
// Clicar no cartão da frente abre o painel com a descrição completa e os links.

const COPIES = 2;
const FACES = PROJECTS.length * COPIES;
const STEP = 360 / FACES; // graus entre um cartão e o próximo
const DRAG = 0.22; // graus de giro por px arrastado
const TILT = 17; // inclinação (graus): visto de cima, dá para ver os cartões de trás
const AUTO_SPEED = 0.007; // giro automático, em graus por ms (~7°/s)
const RESUME_AFTER = 2500; // ms parado depois de mexer (toque, setas, teclado)

type Props = {
  // depois da transição do monitor: a seção sobe por cima do fim dela
  afterDive?: boolean;
  // cópia parada, mostrada dentro da tela do monitor na transição
  preview?: boolean;
};

// tamanho dos cartões e raio do barril, conforme a largura da tela
function useBarrelSize() {
  const [size, setSize] = useState(() => measure());
  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}
// O conjunto (título + barril + setas) precisa caber inteiro na altura da tela.
const LIFT_RATIO = 2 * (0.5 / Math.tan(Math.PI / FACES) + 0.06) * Math.sin((TILT * Math.PI) / 180) * 0.62;
const CHROME = 330; // px fora dos cartões: título, setas, dica e espaços
const REFLECT = 0.16; // espaço para o reflexo embaixo dos cartões (fração da largura do cartão)
function measure() {
  const vw = window.innerWidth;
  const byWidth = vw < 720 ? vw * 0.62 : vw * 0.22;
  const byHeight = (window.innerHeight - CHROME) / (4 / 3 + LIFT_RATIO + REFLECT);
  const card = Math.round(Math.min(380, Math.max(170, Math.min(byWidth, byHeight))));
  const radius = Math.round(card / 2 / Math.tan(Math.PI / FACES) + card * 0.06);
  // quanto os cartões de trás sobem acima dos da frente (com a perspectiva)
  const lift = Math.round(2 * radius * Math.sin((TILT * Math.PI) / 180) * 0.62);
  return { card, radius, lift };
}

export function Projects({ afterDive = false, preview = false }: Props) {
  const reducedMotion = useReducedMotion();
  const { card, radius, lift } = useBarrelSize();
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const inView = useInView(section, { amount: 0.25 });
  const ring = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const rot = useMotionValue(0);
  const [front, setFront] = useState(0); // índice da face da frente
  const [open, setOpen] = useState<{ project: Project; from: DOMRect; face: number } | null>(null);

  // Gira o barril e ajusta cada cartão conforme está de frente ou de lado
  const render = useCallback(
    (r: number) => {
      if (ring.current) ring.current.style.transform = `translateZ(${-radius}px) rotateY(${r}deg)`;
      cards.current.forEach((el, i) => {
        if (!el) return;
        const facing = Math.cos(((i * STEP + r) * Math.PI) / 180); // 1 = de frente
        el.style.setProperty("--facing", facing.toFixed(3));
      });
    },
    [radius],
  );
  useMotionValueEvent(rot, "change", (r) => {
    render(r);
    setFront((((-Math.round(r / STEP)) % FACES) + FACES) % FACES);
  });
  useLayoutEffect(() => render(rot.get()), [render, rot]);

  const snapTo = useCallback(
    (target: number) => {
      const snapped = Math.round(target / STEP) * STEP;
      if (reducedMotion) rot.set(snapped);
      else animate(rot, snapped, { type: "spring", stiffness: 140, damping: 24 });
    },
    [rot, reducedMotion],
  );
  // última interação (toque, setas, teclado): o giro automático espera um pouco
  const lastTouch = useRef(0);
  const hover = useRef(false);
  const go = (dir: number) => {
    lastTouch.current = performance.now();
    snapTo(Math.round(rot.get() / STEP) * STEP - dir * STEP);
  };

  // ----- arrastar -----
  const drag = useRef({ active: false, x: 0, start: 0, moved: 0, vx: 0, t: 0 });
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    rot.stop();
    drag.current = { active: true, x: e.clientX, start: rot.get(), moved: 0, vx: 0, t: performance.now() };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const now = performance.now();
    const next = d.start + dx * DRAG;
    d.vx = (next - rot.get()) / Math.max(1, now - d.t); // graus por ms
    d.t = now;
    d.moved = Math.max(d.moved, Math.abs(dx));
    // só "prende" o ponteiro quando vira arraste de verdade; antes disso o
    // clique precisa chegar ao cartão / botão
    const el = e.currentTarget as HTMLElement;
    if (d.moved > 4 && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    rot.set(next);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    lastTouch.current = performance.now();
    // inércia: continua um pouco na direção do arraste e encaixa
    if (d.moved > 4) snapTo(rot.get() + d.vx * 260);
  };

  const onCardClick = (face: number, project: Project) => {
    if (drag.current.moved > 6) return; // foi arraste, não clique
    if (face !== front) {
      // cartão de lado: gira até ele
      const delta = ((((face - front) % FACES) + FACES + FACES / 2) % FACES) - FACES / 2;
      snapTo(Math.round(rot.get() / STEP) * STEP - delta * STEP);
      return;
    }
    const el = cards.current[face];
    if (el) setOpen({ project, from: el.getBoundingClientRect(), face });
  };

  // para só com o mouse em cima de um cartão (não basta mexer o mouse)
  const onCardEnter = (e: PointerEvent) => {
    if (e.pointerType === "mouse") hover.current = true;
  };
  const onCardLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") hover.current = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    // Enter abre o projeto da frente (com o foco no carrossel, não num link)
    else if (e.key === "Enter" && e.target === e.currentTarget) onCardClick(front, PROJECTS[front % PROJECTS.length]);
  };

  // ----- giro automático -----
  // Gira sozinho devagar; para (e encaixa no cartão mais próximo, para dar
  // para ler) quando o mouse está em cima, ao arrastar/tocar, com o foco do
  // teclado nele ou com o painel aberto. Volta a girar suavemente depois.
  const autoOn = !preview && !reducedMotion && inView && !open;
  useEffect(() => {
    if (!autoOn) return;
    let raf = 0;
    let last = performance.now();
    let speed = 0;
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const vp = viewport.current;
      if (document.documentElement.dataset.projectsReady === "0") {
        // ainda na transição do monitor: parado no começo, igual à miniatura
        // da tela do monitor (a troca entre as duas não aparece)
        speed = 0;
        if (rot.get() !== 0) {
          rot.stop();
          rot.set(0);
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      const paused =
        hover.current ||
        drag.current.active ||
        now - lastTouch.current < RESUME_AFTER ||
        !!(vp && (vp.matches(":focus-visible") || vp.querySelector(":focus-visible")));
      if (paused) {
        // freia encaixando no cartão mais próximo (na direção em que ia)
        if (speed > 0) snapTo(rot.get() - speed * 220);
        speed = 0;
      } else if (!rot.isAnimating()) {
        speed += (AUTO_SPEED - speed) * Math.min(1, dt / 700); // retoma aos poucos
        rot.set(rot.get() - speed * dt);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoOn, rot, snapTo]);

  const active = front % PROJECTS.length;

  return (
    <section
      ref={section}
      id={preview ? undefined : "projetos"}
      className={`${styles.projects} ${afterDive ? styles.afterDive : ""}`}
      aria-labelledby={preview ? undefined : "projects-title"}
      aria-hidden={preview || undefined}
      inert={preview}
    >
      {/* fundo: o céu da primeira tela, translúcido */}
      <div className={styles.ambient} aria-hidden="true" />

      <header className={styles.header}>
        <p className="section-label">
          {PROJECTS_SECTION.index} / {PROJECTS_SECTION.label}
        </p>
        <h2 id={preview ? undefined : "projects-title"} className={styles.title}>
          {PROJECTS_SECTION.title}
        </h2>
      </header>

      <div
        ref={viewport}
        className={styles.viewport}
        style={
          {
            "--card-w": `${card}px`,
            "--lift": `${lift}px`,
            "--tilt": `${-TILT}deg`,
            "--reflect": `${Math.round(card * REFLECT)}px`,
          } as CSSProperties
        }
        onPointerDown={preview ? undefined : onPointerDown}
        onPointerMove={preview ? undefined : onPointerMove}
        onPointerUp={preview ? undefined : onPointerUp}
        onPointerCancel={preview ? undefined : onPointerUp}
        onKeyDown={preview ? undefined : onKeyDown}
        tabIndex={preview ? -1 : 0}
        role="region"
        aria-roledescription="carrossel"
        aria-label="Projetos"
      >
        <div className={styles.tilt}>
          <div ref={ring} className={styles.ring}>
            {Array.from({ length: FACES }, (_, face) => {
              const project = PROJECTS[face % PROJECTS.length];
              const isFront = face === front;
              return (
                <article
                  key={face}
                  ref={(el) => {
                    cards.current[face] = el;
                  }}
                  className={`${styles.card} ${isFront ? styles.front : ""}`}
                  style={{ transform: `rotateY(${face * STEP}deg) translateZ(${radius}px)` }}
                  onClick={() => onCardClick(face, project)}
                  onPointerEnter={onCardEnter}
                  onPointerLeave={onCardLeave}
                  aria-hidden={!isFront}
                  data-front={isFront}
                >
                  <img className={styles.cardImg} src={project.image} alt={project.imageAlt} draggable={false} />
                  <div className={styles.cardBody}>
                    <span className={styles.cardIndex}>
                      {String((face % PROJECTS.length) + 1).padStart(2, "0")}
                    </span>
                    <h3 className={styles.cardTitle}>{project.title}</h3>
                    <p className={styles.cardSummary}>{project.summary}</p>
                    <div className={styles.cardLinks}>
                      <a href={project.links.live} target="_blank" rel="noreferrer" tabIndex={isFront ? 0 : -1}>
                        Ver projeto <span aria-hidden="true">↗</span>
                      </a>
                      <a href={project.links.code} target="_blank" rel="noreferrer" tabIndex={isFront ? 0 : -1}>
                        Código <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>
                  {/* escurece os cartões que estão de lado */}
                  <div className={styles.cardShade} aria-hidden="true" />
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Projeto anterior">
          ←
        </button>
        <span className={styles.counter} aria-live="polite">
          {String(active + 1).padStart(2, "0")} / {String(PROJECTS.length).padStart(2, "0")}
        </span>
        <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Próximo projeto">
          →
        </button>
      </div>
      <p className={styles.hint}>{PROJECTS_SECTION.hint}</p>

      {open && !preview && (
        <ProjectModal
          project={open.project}
          from={open.from}
          onClose={() => {
            const face = open.face;
            setOpen(null);
            lastTouch.current = performance.now();
            cards.current[face]?.focus();
          }}
        />
      )}
    </section>
  );
}
