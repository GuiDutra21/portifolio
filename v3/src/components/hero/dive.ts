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

import { HERO_DIVE, HERO_MONITOR } from "./config";

export type Rect = [number, number, number, number]; // x0, y0, x1, y1 (frações da tela)

// Estado compartilhado, escrito pelo Hero e lido pelas camadas a cada frame
// (sem re-render do React).
export const diveState = {
  active: false, // false = sem transição (celular, movimento reduzido)
  progress: 0, // hero → "Sobre"
  monitor: 0, // "Sobre" → projetos
  beamX: 0.5, // onde fica o feixe na tela (fração da largura)
  aspect: 16 / 9, // largura / altura da tela
  textRect: [0.55, 0.2, 0.9, 0.8] as Rect, // bloco de texto do "Sobre"
  photoRect: [0.12, 0.15, 0.45, 0.85] as Rect, // foto do "Sobre"
  mosaicRect: [0.55, 0.3, 0.9, 0.6] as Rect, // área ocupada pelos cartões no mosaico da direita (texto)
  mosaicRectL: [0.15, 0.3, 0.4, 0.6] as Rect, // ... e no da esquerda (foto)
};

// Lado de cada cartão da espiral (de cima para baixo): alterna entre os dois
// mosaicos, na proporção leftShare, para os dois lados encherem juntos.
export function isLeftCard(i: number) {
  const s = HERO_DIVE.leftShare;
  return Math.floor((i + 1) * s) > Math.floor(i * s);
}

// Área do mosaico da esquerda: o miolo da foto (a foto some embaixo e na
// borda esquerda, então os cartões ficam onde ela é mais forte).
export function photoMosaicRect([x0, y0, x1, y1]: Rect): Rect {
  const w = x1 - x0;
  const h = y1 - y0;
  return [x0 + w * 0.16, y0 + h * 0.1, x1 - w * 0.04, y1 - h * 0.3];
}

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

// Quanto se rola durante a transição hero → "Sobre", em % da altura da tela
export function aboutScrollLength() {
  return HERO_DIVE.length * splitWeights().total;
}

// Quanto se rola durante as transições (Sobre + pausa + monitor), em % da altura da tela
export function diveScrollLength() {
  return aboutScrollLength() + HERO_MONITOR.aboutHold + HERO_MONITOR.length;
}

// Ponto da rolagem (em % da altura da tela, a partir do topo do hero) no meio
// da pausa do "Sobre": onde o botão "Sobre" do menu para
export function aboutRestScroll() {
  return aboutScrollLength() + HERO_MONITOR.aboutHold / 2;
}

// Rolagem real do trecho preso (0..1) → progresso de cada transição (0..1):
// p = hero → "Sobre"; (pausa: nada muda); m = "Sobre" → projetos (monitor)
export function scrollToPhases(r: number) {
  const about = aboutScrollLength();
  const hold = HERO_MONITOR.aboutHold;
  const x = clamp01(r) * diveScrollLength();
  if (x <= about) return { p: scrollToProgress(x / about), m: 0 };
  if (x <= about + hold) return { p: 1, m: 0 };
  return { p: 1, m: (x - about - hold) / HERO_MONITOR.length };
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
// mirror = espelhado (linhas enchem da direita para a esquerda): para o
// mosaico da esquerda, onde os cartões entram pela esquerda. Ele também fica
// com as linhas centralizadas (com poucos cartões, justificar espalha demais).
export function mosaicSlots(aspects: number[], rect: Rect, screenAspect: number, maxRow: number, mirror = false) {
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
  const widest = aspects.length ? Math.max(...aspects) : 0;
  while (
    (rows.length * rowH + (rows.length - 1) * gapY() > h * 0.92 || widest * rowH * toX > w) &&
    rowH > 0.01
  ) {
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
    const natural = rowH * 0.28 * toX;
    const gap = row.length > 1 ? (last || mirror ? natural : (w - used) / (row.length - 1)) : 0;
    const rowW = used + gap * (row.length - 1);
    let x = row.length === 1 || mirror ? x0 + (w - rowW) / 2 : x0;
    row.forEach((i, k) => {
      const cx = x + widths[k] / 2;
      slots[i] = { x: mirror ? x0 + x1 - cx : cx, y, h: rowH };
      x += widths[k] + gap;
    });
    y += rowH + gapY();
  });
  return slots;
}

// ---------- "Sobre" → projetos (monitor) ----------

export type MonitorFrame = {
  aboutOut: number; // 0..1 "Sobre" saindo
  sceneIn: number; // 0..1 cena voltando (menos escura, sem desfoque)
  lightOn: number; // 0..1 monitores acendendo
  approach: number; // 0..1 câmera indo até a tela (0 = longe, 1 = a tela ocupa tudo)
  screenOn: number; // 0..1 tela do monitor acesa
};

export function monitorFrame(m: number): MonitorFrame {
  const d = HERO_MONITOR;
  return {
    aboutOut: easeOut(range(m, d.aboutOut)),
    sceneIn: easeInOut(range(m, d.sceneIn)),
    lightOn: easeInOut(range(m, d.lightOn)),
    approach: easeInOut(range(m, d.zoomIn)),
    screenOn: easeInOut(range(m, d.screenOn)),
  };
}

// Força do feixe de luz da primeira tela: some na ida para o "Sobre" e volta
// na ida para os projetos (1 = como na primeira tela)
export function beamLevel() {
  if (!diveState.active) return 1;
  return 1 - diveFrame(diveState.progress).beamOut * (1 - monitorFrame(diveState.monitor).lightOn);
}
