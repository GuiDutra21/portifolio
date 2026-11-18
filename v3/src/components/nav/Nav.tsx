import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { aboutRestScroll, aboutScrollLength } from "../hero/dive";
import styles from "./Nav.module.css";

// Menu fixo no canto superior direito: Início · Sobre · Projetos.
// No desktop o "Sobre" não é uma seção própria: ele aparece no meio da
// transição do hero, num ponto da rolagem. Por isso cada botão calcula a
// posição de rolagem do seu destino em vez de só pular para um #id.

type Id = "inicio" | "sobre" | "projetos";

const ITEMS: { id: Id; label: string }[] = [
  { id: "inicio", label: "Início" },
  { id: "sobre", label: "Sobre" },
  { id: "projetos", label: "Projetos" },
];

// Velocidade da rolagem pelos botões (segundos): base + por tela percorrida,
// com um teto
const SCROLL_BASE = 1.0;
const SCROLL_PER_SCREEN = 0.45;
const SCROLL_MAX = 4.0;

// posição de rolagem (px) onde cada tela está inteira
function targets(dive: boolean): Record<Id | "sobreIn", number> {
  const top = (id: string) => {
    const el = document.getElementById(id);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  };
  const hero = top("inicio");
  // (dive) no meio da pausa do "Sobre", onde nada se mexe (HERO_MONITOR.aboutHold)
  const sobre = dive ? hero + (aboutRestScroll() / 100) * window.innerHeight : top("sobre");
  // (dive) onde o "Sobre" termina de aparecer: dali em diante conta como "Sobre"
  const sobreIn = dive ? hero + (aboutScrollLength() / 100) * window.innerHeight : sobre;
  return { inicio: hero, sobre, sobreIn, projetos: top("projetos") };
}

export function Nav({ dive }: { dive: boolean }) {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<Id>("inicio");

  // destaca a tela em que a pessoa está
  useEffect(() => {
    const update = () => {
      const t = targets(dive);
      const y = window.scrollY;
      const vh = window.innerHeight;
      if (y >= t.projetos - vh * 0.5) setActive("projetos");
      // (dive) conta como "Sobre" a partir de quando as linhas começam a revelá-lo
      else if (y >= (dive ? t.inicio + (t.sobreIn - t.inicio) * 0.6 : t.sobre - vh * 0.5)) setActive("sobre");
      else setActive("inicio");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [dive]);

  // destaque dourado que desliza até o item ativo
  const list = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const a = list.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
      if (a) setPill({ x: a.offsetLeft, w: a.offsetWidth });
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  // Rolagem até o destino. O "smooth" do navegador é rápido demais (e não dá
  // para controlar), então a rolagem é animada aqui: mais tempo quanto mais
  // longe, para as transições do caminho terem tempo de aparecer.
  const scrolling = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => {
    // a pessoa mexeu (rodinha, toque, teclado): para a rolagem automática
    const stop = () => scrolling.current?.stop();
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, []);

  const go = (e: MouseEvent, id: Id) => {
    e.preventDefault();
    history.replaceState(null, "", id === "inicio" ? location.pathname : `#${id}`);
    const to = targets(dive)[id];
    scrolling.current?.stop();
    if (reducedMotion) {
      window.scrollTo(0, to);
      return;
    }
    const from = window.scrollY;
    const screens = Math.abs(to - from) / window.innerHeight;
    // ~1,4 s para uma tela, até 4 s para o caminho inteiro (início → projetos)
    const duration = Math.min(SCROLL_MAX, SCROLL_BASE + screens * SCROLL_PER_SCREEN);
    scrolling.current = animate(from, to, {
      duration,
      ease: [0.45, 0, 0.25, 1],
      onUpdate: (y) => window.scrollTo(0, y),
    });
  };

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <ul ref={list} className={styles.list}>
        {pill && (
          <li
            className={styles.pill}
            aria-hidden="true"
            style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
          />
        )}
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-id={item.id}
              className={`${styles.link} ${active === item.id ? styles.active : ""}`}
              aria-current={active === item.id ? "location" : undefined}
              onClick={(e) => go(e, item.id)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
