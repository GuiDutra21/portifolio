import { useEffect, useRef } from "react";
import { HERO_DIVE } from "../hero/config";
import { diveFrame, diveState } from "../hero/dive";

// O texto se materializando atrás da linha da direita, com o mesmo efeito da
// foto e dos cartões: ele aparece em "pixels" de CELL px, com a borda
// irregular (ruído), conforme a linha passa.
// O texto é HTML de verdade (nítido, selecionável), então o efeito é uma
// máscara: uma imagem pequena (1 px por célula) desenhada a cada mudança da
// rolagem e esticada sobre o bloco, sem suavizar (pixels "duros").
// Para não piscar enquanto a máscara nova carrega, a anterior fica por baixo
// (as duas somadas) até a próxima troca.

const CELL = 3; // tamanho do "pixel", em px de tela

// Devolve a ref para pôr no bloco de texto.
export function useTextMaterialize<T extends HTMLElement>(active: boolean) {
  const target = useRef<T>(null);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const clear = () => {
      for (const prop of ["maskImage", "webkitMaskImage"] as const) el.style[prop] = "";
      el.style.removeProperty("mask-size");
      el.style.removeProperty("-webkit-mask-size");
      el.style.removeProperty("mask-repeat");
      el.style.removeProperty("-webkit-mask-repeat");
      el.style.removeProperty("mask-composite");
      el.style.removeProperty("-webkit-mask-composite");
      el.style.removeProperty("image-rendering");
    };
    if (!active) {
      clear();
      return;
    }

    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d")!;
    let cols = 0;
    let rows = 0;
    let noise = new Float32Array(0);
    let data: ImageData | null = null;
    let prevUrl = "";
    let lastKey = "";
    let raf = 0;

    el.style.setProperty("mask-size", "100% 100%");
    el.style.setProperty("-webkit-mask-size", "100% 100%");
    el.style.setProperty("mask-repeat", "no-repeat");
    el.style.setProperty("-webkit-mask-repeat", "no-repeat");
    el.style.setProperty("mask-composite", "add");
    el.style.setProperty("-webkit-mask-composite", "source-over");
    el.style.setProperty("image-rendering", "pixelated");

    const resize = () => {
      cols = Math.max(1, Math.ceil(el.clientWidth / CELL));
      rows = Math.max(1, Math.ceil(el.clientHeight / CELL));
      mask.width = cols;
      mask.height = rows;
      data = mctx.createImageData(cols, rows);
      // ruído fixo por célula (sempre o mesmo desenho)
      noise = new Float32Array(cols * rows);
      let x = 192837465;
      for (let i = 0; i < noise.length; i++) {
        x = (x * 16807) % 2147483647;
        noise[i] = (x - 1) / 2147483646;
      }
      lastKey = "";
    };

    const draw = () => {
      if (!data) return;
      const p = diveState.progress;
      const key = `${p.toFixed(5)}|${cols}x${rows}|${diveState.textRect.join()}`;
      if (key === lastKey) return; // só redesenha quando a rolagem muda
      lastKey = key;

      const f = diveFrame(p);
      const [x0, , x1] = diveState.textRect;
      const band = HERO_DIVE.dissolveBand;
      const d = data.data;
      for (let c = 0; c < cols; c++) {
        // quanto a linha da direita já passou desta coluna
        const sx = x0 + ((c + 0.5) / cols) * (x1 - x0);
        const behind = f.splitting ? (f.lineR - sx) / band + f.afterSplit * 2 : -1;
        for (let r = 0; r < rows; r++) {
          const i = r * cols + c;
          d[i * 4 + 3] = behind - noise[i] > 0 ? 255 : 0;
        }
      }
      mctx.putImageData(data, 0, 0);
      const url = `url(${mask.toDataURL()})`;
      const layers = prevUrl ? `${url}, ${prevUrl}` : url;
      el.style.maskImage = layers;
      el.style.webkitMaskImage = layers;
      prevUrl = url;
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clear();
    };
  }, [active]);
  return target;
}
