import { TECHS } from "../hero/techs";
import styles from "./Projects.module.css";

// Etiqueta de tecnologia: os mesmos ícones dos cartões da espiral
export function TechChip({ tech }: { tech: string }) {
  const t = TECHS[tech];
  if (!t) return null;
  return (
    <span className={styles.chip}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={t.icon.path} />
      </svg>
      {t.name}
    </span>
  );
}
