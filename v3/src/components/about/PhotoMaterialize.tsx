import { useEffect, useRef } from "react";
import { HERO_DIVE } from "../hero/config";
import { diveFrame, diveState } from "../hero/dive";

// A foto se materializando atrás da linha da esquerda: o inverso dos cartões,
// que se desfazem atrás da linha da direita. Mesma regra: a foto é dividida em
// "pixels" de CELL px e cada um aparece quando a linha já passou dele o
// bastante (com um ruído, para a borda ficar irregular). Os pixels recém-
// formados nascem quentes (âmbar) e esfriam; logo à frente deles, alguns
// pixels soltos de luz anunciam o que vem.
// É um canvas por cima da <img>: quando a transição termina, a <img> assume.

const CELL = 4; // tamanho do "pixel", em px de tela
const HEAT = 0.45; // largura da borda quente (em faixas de desintegração)

type Props = { src: string; className?: string };

export function PhotoMaterialize({ src, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    const img = new Image();
    img.src = src;
    const mask = document.createElement("canvas");
    const heat = document.createElement("canvas");
    const mctx = mask.getContext("2d")!;
    const hctx = heat.getContext("2d")!;
    let cols = 0;
    let rows = 0;
    let noise = new Float32Array(0);
    let cover = new Float32Array(0); // quanto de foto (sem fundo) há em cada pixel
    let mData: ImageData | null = null;
    let hData: ImageData | null = null;
    let lastKey = "";
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(el.clientWidth * dpr));
      el.height = Math.max(1, Math.round(el.clientHeight * dpr));
      cols = Math.max(1, Math.ceil(el.clientWidth / CELL));
      rows = Math.max(1, Math.ceil(el.clientHeight / CELL));
      mask.width = heat.width = cols;
      mask.height = heat.height = rows;
      mData = mctx.createImageData(cols, rows);
      hData = hctx.createImageData(cols, rows);
      // ruído fixo por pixel (sempre o mesmo desenho)
      noise = new Float32Array(cols * rows);
      let x = 987654321;
      for (let i = 0; i < noise.length; i++) {
        x = (x * 16807) % 2147483647;
        noise[i] = (x - 1) / 2147483646;
      }
      measureCover();
      lastKey = "";
    };

    // A foto não tem fundo: a borda quente só aparece onde há pessoa
    const measureCover = () => {
      cover = new Float32Array(cols * rows).fill(1);
      if (!img.complete || !img.naturalWidth) return;
      const small = document.createElement("canvas");
      small.width = cols;
      small.height = rows;
      const sctx = small.getContext("2d", { willReadFrequently: true })!;
      sctx.drawImage(img, 0, 0, cols, rows);
      const d = sctx.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < cover.length; i++) cover[i] = d[i * 4 + 3] / 255;
    };

    const draw = () => {
      if (!img.complete || !mData || !hData) return;
      const p = diveState.active ? diveState.progress : 1;
      const key = `${p.toFixed(5)}|${el.width}|${diveState.photoRect.join()}`;
      if (key === lastKey) return; // só redesenha quando a rolagem muda
      lastKey = key;

      const f = diveFrame(p);
      const W = el.width;
      const H = el.height;
      ctx.clearRect(0, 0, W, H);
      if (!f.splitting) return;

      const [x0, , x1] = diveState.photoRect;
      const band = HERO_DIVE.dissolveBand;
      const m = mData.data;
      const h = hData.data;
      for (let c = 0; c < cols; c++) {
        // posição do pixel na tela (fração da largura) → quanto a linha já passou
        const sx = x0 + ((c + 0.5) / cols) * (x1 - x0);
        const behind = (sx - f.lineL) / band + f.afterSplit * 2;
        for (let r = 0; r < rows; r++) {
          const i = r * cols + c;
          const v = behind - noise[i];
          const o = i * 4;
          m[o + 3] = v > 0 ? 255 : 0;
          // quente logo depois de formar; à frente, só alguns pixels de luz
          let k = 0;
          if (v > 0 && v < HEAT) k = 1 - v / HEAT;
          else if (v > -0.12 && v <= 0 && noise[(i * 7) % noise.length] > 0.55) k = 0.7;
          k *= cover[i];
          h[o] = 255;
          h[o + 1] = 150 + 70 * k;
          h[o + 2] = 60 + 90 * k * k;
          h[o + 3] = Math.round(k * k * 235);
        }
      }
      mctx.putImageData(mData, 0, 0);
      hctx.putImageData(hData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.imageSmoothingEnabled = false; // pixels "duros", como nos cartões
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(heat, 0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    img.onload = () => {
      measureCover();
      lastKey = "";
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [src]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
