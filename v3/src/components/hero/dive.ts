// Transição do hero para o "Sobre mim", controlada pela rolagem.
//
// A cena fica presa na tela e a rolagem "toca" a sequência:
//  1. o nome sai e o céu escurece;
//  2. os cartões sobem pela espiral como numa esteira; cada um se solta no
//     topo e voa até um mosaico no lugar onde o texto vai ficar (matéria-prima,
//     como o código no vídeo de referência). A linha da espiral vai sendo
//     recolhida para cima atrás do último cartão;
//  3. o feixe de luz se apaga e se condensa numa linha fina no centro;
//  4. a linha se divide em duas: a da direita passa pelo mosaico, desfaz os
//     cartões em faíscas e deixa o texto para trás; a da esquerda revela a foto;
//  5. as linhas se apagam e a tela "Sobre" fica pronta.
//
// Tudo sai de diveFrame(progresso): uma função pura, usada pelo HTML (Hero.tsx),
// pela cena WebGL (camadas) e pelas faíscas. Rolar para trás desfaz tudo.

import { HERO_DIVE } from "./config";

export type Rect = [number, number, number, number]; // x0, y0, x1, y1 (frações da tela)

// Estado compartilhado, escrito pelo Hero e lido pelas camadas a cada frame
// (sem re-render do React).
export const diveState = {
  active: false, // false = sem transição (celular, movimento reduzido)
  progress: 0,
  beamX: 0.5, // onde fica o feixe na tela (fração da largura)
  aspect: 16 / 9, // largura / altura da tela
  textRect: [0.55, 0.2, 0.9, 0.8] as Rect, // bloco de texto do "Sobre"
  photoRect: [0.12, 0.15, 0.45, 0.85] as Rect, // foto do "Sobre"
  mosaicRect: [0.55, 0.3, 0.9, 0.6] as Rect, // área ocupada pelos cartões no mosaico
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, [a, b]: [number, number]) => clamp01((p - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// O trecho das linhas (split) pode ter um ritmo próprio (splitSlowdown): ele
// ganha mais rolagem que as outras fases. Para isso, a rolagem "real" (0..1
// no trecho preso) é convertida no progresso da transição (0..1), esticando
// só o intervalo do split.
function splitWeights() {
  const d = HERO_DIVE;
  const [a, b] = d.split;
  const slow = Math.max(0.05, d.splitSlowdown);
  return { a, b, slow, total: a + (b - a) * slow + (1 - b) };
}

// Quanto se rola durante a transição, em % da altura da tela
export function diveScrollLength() {
  return HERO_DIVE.length * splitWeights().total;
}

// Rolagem real (0..1) → progresso da transição (0..1)
export function scrollToProgress(r: number) {
  const { a, b, slow, total } = splitWeights();
  const x = clamp01(r) * total;
  if (x <= a) return x;
  if (x <= a + (b - a) * slow) return a + (x - a) / slow;
  return b + (x - a - (b - a) * slow);
}

export type DiveFrame = {
  textOut: number; // 0..1 nome e cargo saindo
  dim: number; // 0..1 escurecimento do céu
  beamOut: number; // 0..1 feixe de luz apagando
  lineOpacity: number; // 0..1 linhas de transformação
  lineGrow: number; // 0..1 linha nascendo (do alto para baixo)
  splitting: boolean; // as linhas já começaram a se separar
  lineL: number; // posição da linha da esquerda (fração da largura)
  lineR: number; // posição da linha da direita
  afterSplit: number; // 0..1 depois que as linhas pararam (faíscas terminando)
  sceneBlur: number; // px
  ready: boolean; // "Sobre" pronto: links clicáveis
};

export function diveFrame(p: number, s = diveState): DiveFrame {
  const d = HERO_DIVE;
  const split = easeInOut(range(p, d.split));
  // as linhas vão até as bordas da tela (e, se o mosaico ou a foto chegarem
  // muito perto da borda, um pouco além, para terminar de transformá-los)
  const endR = Math.max(1, s.textRect[2] + d.dissolveBand);
  const endL = Math.min(0, s.photoRect[0] - 0.04);
  return {
    textOut: easeOut(range(p, d.textOut)),
    dim: range(p, d.darkIn) * d.darken,
    beamOut: easeInOut(range(p, d.beamOut)),
    lineOpacity: range(p, d.lineIn) * (1 - range(p, d.lineOut)),
    lineGrow: easeOut(range(p, d.lineIn)),
    splitting: p > d.split[0],
    lineL: s.beamX + (endL - s.beamX) * split,
    lineR: s.beamX + (endR - s.beamX) * split,
    afterSplit: range(p, [d.split[1], 1]),
    sceneBlur: range(p, d.blurIn) * d.blur,
    ready: p > 0.97,
  };
}

// Esteira: quanto os cartões já subiram pela espiral (em unidades da espiral,
// 0..total). Um cartão que começou na altura u está em u + subida: enquanto
// isso for menor que exitAt ele anda sobre a linha; depois, está em voo.
// lowestU = altura do cartão mais baixo (o último a chegar ao mosaico).
export function conveyorClimb(p: number, lowestU: number) {
  const d = HERO_DIVE;
  const total = d.exitAt - lowestU + d.flightLength;
  return easeInOut(range(p, d.conveyor)) * total;
}

// Voo do topo da espiral até o mosaico: 0 = soltou agora, 1 = pousou.
export function flightOf(u: number, climb: number) {
  const d = HERO_DIVE;
  return clamp01((u + climb - d.exitAt) / d.flightLength);
}

// Mosaico: os cartões em linhas justificadas, como um parágrafo, dentro do
// bloco de texto. aspects = largura/altura de cada cartão.
// Devolve o centro (x, y) e a altura de cada cartão, em frações da tela.
export function mosaicSlots(aspects: number[], rect: Rect, screenAspect: number, maxRow: number) {
  const [x0, y0, x1, y1] = rect;
  const w = x1 - x0;
  const h = y1 - y0;
  const toX = 1 / screenAspect; // altura (fração da tela) → largura (fração da tela)

  const flow = (rowH: number) => {
    const gapX = rowH * 0.28 * toX;
    const rows: number[][] = [[]];
    let x = 0;
    aspects.forEach((a, i) => {
      const cw = a * rowH * toX;
      if (x > 0 && x + cw > w) {
        rows.push([]);
        x = 0;
      }
      rows[rows.length - 1].push(i);
      x += cw + gapX;
    });
    return rows;
  };

  // maior altura de linha (até maxRow) em que tudo cabe no bloco
  let rowH = maxRow;
  let rows = flow(rowH);
  const gapY = () => rowH * 0.42;
  while (rows.length * rowH + (rows.length - 1) * gapY() > h * 0.92 && rowH > 0.01) {
    rowH *= 0.96;
    rows = flow(rowH);
  }

  const slots: { x: number; y: number; h: number }[] = new Array(aspects.length);
  const blockH = rows.length * rowH + (rows.length - 1) * gapY();
  let y = y0 + (h - blockH) / 2 + rowH / 2;
  rows.forEach((row, r) => {
    const widths = row.map((i) => aspects[i] * rowH * toX);
    const used = widths.reduce((acc, v) => acc + v, 0);
    const last = r === rows.length - 1 && row.length > 1;
    // justificado (a última linha fica alinhada à esquerda, como num texto)
    const gap = row.length > 1 ? (last ? rowH * 0.28 * toX : (w - used) / (row.length - 1)) : 0;
    let x = row.length === 1 ? x0 + (w - used) / 2 : x0;
    row.forEach((i, k) => {
      slots[i] = { x: x + widths[k] / 2, y, h: rowH };
      x += widths[k] + gap;
    });
    y += rowH + gapY();
  });
  return slots;
}
