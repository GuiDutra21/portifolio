import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { animate, useReducedMotion } from "motion/react";
import type { Project } from "./content";
import { TechChip } from "./TechChip";
import styles from "./Projects.module.css";

// Painel do projeto, por cima de tudo. Ele "sai" do cartão clicado: começa no
// lugar e no tamanho do cartão e cresce até o centro (e volta ao fechar).
// Fecha com Esc, clicando fora ou no ×.

const EASE = [0.2, 0.7, 0.2, 1] as const;

type Props = {
  project: Project;
  from: DOMRect; // onde estava o cartão clicado
  // onde o cartão está AGORA (ao fechar, o painel volta para lá, mesmo que o
  // carrossel tenha terminado de encaixar depois do clique)
  getFrom?: () => DOMRect | undefined;
  onClose: () => void;
};

export function ProjectModal({ project, from, getFrom, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  // do cartão até o centro: mede o painel já no lugar final e anima a diferença
  const flipFrom = (target: DOMRect = from) => {
    const el = panel.current!;
    const to = el.getBoundingClientRect();
    return {
      x: target.left + target.width / 2 - (to.left + to.width / 2),
      y: target.top + target.height / 2 - (to.top + to.height / 2),
      scaleX: target.width / to.width,
      scaleY: target.height / to.height,
    };
  };

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const f = flipFrom();
    animate(panel.current!, { x: [f.x, 0], y: [f.y, 0], scaleX: [f.scaleX, 1], scaleY: [f.scaleY, 1] }, { duration: 0.6, ease: EASE });
    animate(backdrop.current!, { opacity: [0, 1] }, { duration: 0.4 });
    animate(body.current!, { opacity: [0, 1], y: [12, 0] }, { duration: 0.45, delay: 0.3, ease: EASE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    if (!reducedMotion) {
      const f = flipFrom(getFrom?.() ?? from);
      const shrink = 0.6;
      animate(body.current!, { opacity: 0 }, { duration: 0.18 });
      animate(backdrop.current!, { opacity: 0 }, { duration: shrink, ease: "easeInOut" });
      // o painel se dissolve no fim da volta, revelando o cartão que já está
      // embaixo: sem a troca seca de um pelo outro no último quadro
      animate(panel.current!, { opacity: 0 }, { duration: shrink * 0.45, delay: shrink * 0.55, ease: "easeIn" });
      await animate(
        panel.current!,
        { x: f.x, y: f.y, scaleX: f.scaleX, scaleY: f.scaleY },
        { duration: shrink, ease: [0.45, 0, 0.2, 1] },
      );
    }
    onClose();
  };

  // Esc fecha; a página não rola enquanto o painel está aberto
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className={styles.modalRoot} role="dialog" aria-modal="true" aria-labelledby="project-title">
      <div ref={backdrop} className={styles.backdrop} onClick={close} />
      <div ref={panel} className={styles.panel}>
        <div className={styles.panelMedia}>
          <img src={project.image} alt={project.imageAlt} />
        </div>
        <div ref={body} className={styles.panelBody}>
          {project.status && <span className={styles.status}>{project.status}</span>}
          <h3 id="project-title" className={styles.panelTitle}>
            {project.title}
          </h3>
          {project.description.map((p) => (
            <p key={p} className={styles.panelText}>
              {p}
            </p>
          ))}
          <div className={styles.chips}>
            {project.tags.map((t) => (
              <TechChip key={t} tech={t} />
            ))}
          </div>
          <div className={styles.panelLinks}>
            {project.links.live && (
              <a className={styles.primary} href={project.links.live} target="_blank" rel="noreferrer">
                Acessar projeto <span aria-hidden="true">↗</span>
              </a>
            )}
            {project.links.code && (
              <a className={styles.secondary} href={project.links.code} target="_blank" rel="noreferrer">
                Ver código <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
        <button ref={closeBtn} type="button" className={styles.close} onClick={close} aria-label="Fechar">
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
