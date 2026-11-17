import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HERO_DIVE } from "./config";

// A transição hero → "Sobre" só roda em telas grandes o bastante (o "Sobre"
// precisa caber inteiro no palco) e sem "movimento reduzido" no sistema.
export function useDiveEnabled() {
  const reducedMotion = useReducedMotion();
  const query = `(min-width: ${HERO_DIVE.minWidth}px) and (min-height: ${HERO_DIVE.minHeight}px)`;
  const [fits, setFits] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setFits(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return HERO_DIVE.enabled && fits && !reducedMotion;
}
