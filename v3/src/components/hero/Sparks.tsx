import { useEffect, useRef } from "react";
import { HERO_DIVE } from "./config";
import { diveFrame, diveState, type Rect } from "./dive";

// Faíscas da transformação: "pixels" âmbar que ficam para trás das linhas,
// como a poeira do vídeo de referência. Num canvas 2D POR CIMA do texto e da
// foto (a cena WebGL fica por baixo deles).
// Cada faísca nasce quando a linha passa pelo ponto dela, então tudo é função
// da posição da linha: rolar para trás "recompõe" o efeito.

const SEEDS = (() => {
  // 6 números por faísca, fixos (sempre o mesmo desenho)
  let x = 1234567;
  const rand = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  return Float32Array.from({ length: HERO_DIVE.sparks * 6 }, rand);
})();

const LIFE = 0.11; // quanto a linha anda até a faísca sumir (fração da largura)

let dirty = false; // há faíscas desenhadas no canvas

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, time: number) {
  const f = diveState.active ? diveFrame(diveState.progress) : null;
  if (!f || !f.splitting || f.afterSplit >= 1) {
    // fora da fase das linhas: limpa uma vez e fica parado
    if (dirty) ctx.clearRect(0, 0, w, h);
    dirty = false;
    return;
  }
  ctx.clearRect(0, 0, w, h);
  dirty = true;

  ctx.globalCompositeOperation = "lighter";
  const n = HERO_DIVE.sparks;
  const fadeTail = f.afterSplit * 1.4; // depois que as linhas param, as últimas se apagam

  for (let i = 0; i < n; i++) {
    const s = i * 6;
    const right = i % 3 !== 0; // 2/3 saindo dos cartões, 1/3 na foto
    const rect: Rect = right ? diveState.mosaicRect : diveState.photoRect;
    const life = LIFE * (0.6 + SEEDS[s + 3] * 0.9);
    // onde nasce: um ponto da área, do lado de fora do feixe
    const bx = rect[0] + SEEDS[s] * (rect[2] - rect[0]);
    const by = rect[1] + SEEDS[s + 1] * (rect[3] - rect[1]);
    // idade: quanto a linha já andou desde que passou por ali
    let age = right ? (f.lineR - bx) / life : (bx - f.lineL) / life;
    if (age <= 0) continue;
    age += fadeTail;
    if (age >= 1) continue;

    // fica para trás da linha, se espalhando um pouco
    const drift = (0.015 + SEEDS[s + 4] * 0.05) * age;
    const x = (right ? bx - drift : bx + drift) * w;
    const y = (by + (SEEDS[s + 5] - 0.5) * 0.05 * age - 0.012 * age * age) * h;
    const size = Math.max(1, (1.4 + SEEDS[s + 2] * 3.2) * (1 - age * 0.45)) * dpr;
    const twinkle = 0.65 + 0.35 * Math.sin(time * 9 + SEEDS[s] * 60);
    ctx.globalAlpha = Math.pow(1 - age, 1.4) * twinkle;
    // nascem quase brancas e esfriam para o âmbar
    ctx.fillStyle = age < 0.18 ? "#fff3dc" : age < 0.5 ? "#ffc278" : "#e98a3c";
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function Sparks({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = (now: number) => {
      draw(ctx, el.width, el.height, dpr, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
