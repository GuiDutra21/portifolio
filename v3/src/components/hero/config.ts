// Ajustes da cena do hero. Todas as camadas usam o enquadramento do céu
// (public/hero/background-base.png).

type RGB = [number, number, number];
export type SkyMood = "escuro" | "claro" | "maisClaro";

// Texto do hero
export const HERO_TEXT = {
  name: "Guilherme Silva Dutra",
  role: "Engenheiro de IA",
  // Tamanho das fontes (1 = padrão, 1.2 = 20% maior, 0.8 = 20% menor).
  // O tamanho já se adapta à largura da tela; isto multiplica por cima.
  nameSize: 0.75, // seu nome
  roleSize: 1.0, // cargo (Engenheiro de IA)
};

// Transição do hero para o "Sobre mim" (a lógica está em dive.ts).
// Ao rolar, a cena fica presa na tela: os cartões saem da espiral e viram um
// mosaico, o feixe vira uma linha que se divide em duas, e essas linhas
// transformam o mosaico no texto e revelam a foto.
// As fases usam o progresso da rolagem nesse trecho (0 = início, 1 = fim).
export const HERO_DIVE = {
  enabled: true, // false = o hero rola normalmente e o "Sobre" vem depois
  length: 280, // quanto se rola durante a transição, em % da altura da tela
  // Abaixo disto (largura ou altura da tela, em px) a transição é desligada e o
  // "Sobre" vira uma seção comum, logo abaixo do hero (celular, telas baixas).
  minWidth: 861,
  minHeight: 560,

  darken: 0.78, // quanto o céu escurece (0 = nada, 1 = preto)
  blur: 3, // desfoque da cena no fim, em px (para o texto ficar legível)
  // Esteira: os cartões sobem juntos pela espiral e cada um se solta no topo.
  exitAt: 1.0, // onde se soltam (0 = pé da espiral, 1 = topo)
  flightLength: 0.38, // duração do voo do topo até o mosaico, medida em "espiral"
  //                     (0.38 = o tempo de subir 38% da espiral)
  mosaicRow: 0.058, // altura máxima dos cartões no mosaico (fração da altura da tela)
  dissolveBand: 0.05, // largura da faixa onde os cartões se desfazem (fração da largura)
  sparks: 2600, // quantidade de faíscas

  // Fases [início, fim]
  textOut: [0, 0.1] as [number, number], // nome e cargo saindo
  darkIn: [0.04, 0.5] as [number, number], // céu escurecendo
  conveyor: [0.06, 0.56] as [number, number], // esteira: do 1º cartão subindo ao último pousando
  beamOut: [0.42, 0.6] as [number, number], // feixe de luz apagando
  lineIn: [0.46, 0.6] as [number, number], // linha nascendo no lugar do feixe
  split: [0.6, 0.9] as [number, number], // linhas se separando (transformação)
  // Ritmo SÓ das linhas se separando: 1 = normal, 1.25 = 25% mais lentas
  // (ganham mais rolagem; as outras fases não mudam, a página fica mais longa)
  splitSlowdown: 2.5,
  lineOut: [0.88, 0.97] as [number, number], // linhas se apagando
  blurIn: [0.86, 1] as [number, number], // cena desfocando
};

export const HERO_ASSETS = {
  sky: "/hero/background-base.png",
  cloudMask: "/hero/cloud-mask.png",
  person: "/hero/person-layer.png",
  light: "/hero/light-layer.png",
  componentsStatic: "/hero/components-static.png",
  componentsPanels: "/hero/components-panels.png",
  componentsShade: "/hero/components-shade.png",
  spiralAtlas: "/hero/spiral-atlas.png",
  spiralAtlasShade: "/hero/spiral-atlas-shade.png",
} as const;

export const HERO_CONFIG = {
  sky: {
    // ===== Controles gerais (multiplicam todos os efeitos abaixo) =====
    // intensidade: quanto as nuvens se deslocam. 1 = padrão, 0 = paradas,
    //              0.5 = metade, 2 = o dobro.
    intensity: 1.0,
    // velocidade: quão rápido tudo acontece. 1 = padrão, 0.5 = mais calmo,
    //             2 = mais agitado.
    speed: 1,

    // ===== Ajuste fino de cada efeito =====
    // Movimento próprio (acontece sempre, com ou sem mouse)
    driftAmount: 0.024, // vaivém lento do céu inteiro, para os lados (em UV)
    driftSpeed: 1.0, // velocidade desse vaivém (1 = um ciclo a cada ~30 s)
    bandAmount: 0.012, // faixas de nuvens deslizando umas contra as outras (em UV)
    bandSpeed: 0.22, // velocidade desse deslize
    flowStrength: 0.034, // nuvens mudando de forma (em UV)
    flowSpeed: 0.11, // velocidade dessa mudança
    lightStrength: 0.5, // luz/sombra que atravessa as nuvens
    lightSpeed: 0.035, // velocidade dessa luz (UV por segundo)
    windDir: [1, -0.12] as [number, number], // direção do vento (x direita, y baixo)

    // Reação ao mouse (somada ao movimento próprio)
    parallax: 0.035, // quanto as nuvens seguem o mouse (em UV)

    // ===== Cor do céu: modos =====
    // Escolha o modo aqui. Cada modo tem seus valores logo abaixo, e dá para
    // ajustar qualquer um deles à vontade.
    mood: "maisClaro" as SkyMood, // "escuro" | "claro" | "maisClaro"
    moods: {
      // Como a imagem original
      escuro: {
        exposure: 1.0, // brilho geral. 1 = original, 1.3 = 30% mais claro
        shadows: 1.0, // clareia as partes escuras sem estourar as claras. 1 = original, 0.8 = mais aberto
        tint: [0.55, 0.7, 1.0] as RGB, // cor puxada pelo céu (R, G, B de 0 a 1). Azul = [0.55, 0.7, 1.0]
        tintAmount: 0.0, // quanto o céu puxa para essa cor. 0 = nada, 0.5 = bastante
        saturation: 1.0, // intensidade das cores. 1 = original, 1.2 = mais vivas, 0.8 = mais acinzentadas
        floor: 0.5, // quanto disso vale também para o chão (0 = chão original, 1 = igual ao céu)
      },
      // Azul noturno mais aberto
      claro: {
        exposure: 1.3,
        shadows: 0.82,
        tint: [0.55, 0.7, 1.0] as RGB,
        tintAmount: 0.35,
        saturation: 1.1,
        floor: 0.5,
      },
      // Bem mais claro e azul
      maisClaro: {
        exposure: 1.65,
        shadows: 0.7,
        tint: [0.55, 0.72, 1.0] as RGB,
        tintAmount: 0.45,
        saturation: 1.15,
        floor: 0.5,
      },
    },
  },
  light: {
    // Coluna de luz da cena original (public/hero/light-layer.png), animada.
    enabled: true, // false = desliga a luz (e a pessoa volta a ser silhueta)

    // ===== Controles gerais =====
    intensity: 0.75, // brilho da luz. 1 = igual à imagem original, 0.5 = metade, 1.5 = mais forte
    speed: 0.5, // velocidade de toda a animação da luz. 1 = padrão, 0.5 = mais calmo

    // ===== Animação =====
    fall: 0.0, // feixes de brilho descendo pelos raios: a luz "caindo" (0 = sem)
    fallSpeed: 0.3, // velocidade com que eles descem
    shimmer: 0, // raios cintilando (0 = parados)
    pulse: 0.05, // "respiração" do brilho (0 = constante)
    dust: 1, // poeira descendo dentro da luz (0 = sem)
    dustSpeed: 0.05, // velocidade da poeira

    // De onde os raios saem (x, y em frações da imagem). Só muda a direção da
    // animação; a luz em si é a da imagem.
    source: [0.502, 0.06] as [number, number],

    // ===== Origem da luz (abertura no céu) =====
    sourceBrightness: 0.55, // brilho da abertura. 1 = como na imagem, 0.5 = mais discreta
    sourceSize: 1.0, // tamanho da área escurecida em volta da abertura

    // ===== Movimento junto com as nuvens (inclusive com o mouse) =====
    followClouds: 1.0, // no alto da luz: 1 = anda igual às nuvens, 0 = parada
    followBottom: 0.15, // no pé da luz, sobre a pessoa (0 = fixa no lugar)
  },
  frontClouds: {
    // Nuvens passando NA FRENTE da origem da luz, com as bordas iluminadas
    // por trás — mostram que a luz sai de dentro das nuvens.
    enabled: true,
    amount: 0.5, // quanto da abertura elas cobrem. 0 = nada, 1 = cobrem tudo
    opacity: 0, // 1 = nuvem densa, 0.5 = translúcida
    size: 1.0, // tamanho dos tufos. 1.5 = nuvens maiores
    area: [0.15, 0.1] as [number, number], // até onde aparecem em volta da origem (largura, altura)
    speed: 1.0, // velocidade com que passam
    glow: 1.0, // brilho das bordas iluminadas pela luz
  },
  components: {
    // Espiral com os painéis (terminal, código, GitHub, diagrama...).
    enabled: true,
    // "spiral" = espiral 3D girando com os painéis presos nela (seção spiral)
    // "static" = a imagem original parada, com os painéis flutuando no lugar
    mode: "spiral" as "spiral" | "static",

    // ===== Controles gerais =====
    intensity: 1.0, // brilho da espiral. 1 = padrão, 0.7 = mais discreta
    speed: 1.0, // velocidade de toda a animação dela

    // ===== Posição e tamanho (frações da imagem) =====
    center: [0.497, 0.4723] as [number, number], // centro da espiral (x, y)
    height: 0.6552, // altura da espiral. 0.6 = menor, 0.7 = maior

    // ===== Animação =====
    float: 0.004, // flutuação do conjunto inteiro, para cima e para baixo (0 = parado)
    panelFloat: 0.007, // flutuação de CADA painel, separada (0 = parados; máximo ~0.009)
    panelSpeed: 1.0, // velocidade da flutuação dos painéis
    pulse: 0.07, // "respiração" do brilho (0 = constante)
    sweep: 0.22, // faixa de luz que sobe pela espiral (0 = sem)
    parallax: 0.005, // quanto ela segue o mouse (0 = não segue)

    // Escurecimento atrás dos painéis, para o conteúdo deles ficar legível
    // sobre o feixe (0 = transparente, 1 = fundo preto)
    shade: 0.62,
  },
  spiral: {
    // Espiral 3D (components.mode = "spiral"). Posição, tamanho, brilho e
    // sombra dos painéis vêm da seção components.

    // ===== Giro =====
    speed: 0.03, // voltas por segundo. 0.04 = uma volta a cada 25 s
    direction: 1, // 1 ou -1 (sentido do giro)

    // ===== Forma da espiral =====
    turns: 2.5, // quantas voltas a linha dá de baixo até em cima
    radius: 0.25, // raio, em frações da altura da espiral
    tilt: 8, // inclinação para a câmera, em graus (0 = vista de lado)
    start: 0.14, // onde fica o painel de baixo (0 = pé da espiral, 1 = topo)
    end: 0.9, // onde fica o painel de cima

    // ===== Linha dourada =====
    lineColor: [1.0, 0.62, 0.22] as [number, number, number], // cor (R, G, B de 0 a 1)
    lineWidth: 0.0028, // espessura
    lineIntensity: 1.6, // brilho
    lineSweep: 1.2, // brilho percorrendo a linha (0 = sem)
    lineBackDim: 0.6, // brilho da parte da linha que passa atrás (1 = igual à da frente)

    // ===== Itens da espiral (de cima para baixo) =====
    // Painéis da arte original: "html", "code", "github", "phone", "diagram", "mini", "db"
    // Cartões de tecnologia (ícone + nome): qualquer chave de TECHS em techs.ts,
    //   ex.: "python", "react", "fastapi", "docker", "typescript", "postgresql"...
    items: [
      "python",
      "fastapi",
      "typescript",
      "react",
      "nestjs",
      "springBoot",
      "flutter",
      "postgresql",
      "docker",
      "kubernetes",
      "gcp",
      "github",
    ],
    techCardHeight: 0.064, // altura dos cartões de tecnologia (frações da altura da espiral)
    techFontSize: 1.0, // tamanho do nome nos cartões (1 = padrão, 1.2 = maior). O ícone não muda

    // ===== Painéis =====
    panelScale: 1.0, // tamanho de todos os itens. 0.8 = menores
    panelOffset: 0.02, // distância dos painéis para fora da linha (a linha passa por trás deles)
    opacity: 0.96, // fundo dos painéis: 1 = cobre totalmente o feixe atrás, 0.6 = vidro translúcido
    turn: 1.0, // 1 = giram junto com a espiral (como na referência), 0 = sempre de frente
    backDim: 0.45, // brilho dos painéis que estão atrás do eixo (1 = igual aos da frente)
    backFace: 0.35, // brilho do verso dos painéis, quando viram de costas

    // ===== Mouse =====
    parallax: 0.006, // quanto a espiral se desloca com o mouse
    mouseTilt: 0.12, // quanto ela inclina com o mouse (radianos)
  },
  person: {
    // Quanto a coluna de luz ilumina a pessoa (0 = silhueta, 1 = iluminada
    // como na cena original). Sem a luz (enabled: false), ela fica em silhueta.
    light: 1.0,
  },
  pointer: {
    follow: 2.2, // rapidez com que alcança o alvo
    idleAfterMs: 2500, // mouse parado por esse tempo → passeio automático
  },
  maxDpr: 2,
};

// Uniforms do movimento das nuvens (trecho cloudMotion de glsl.ts), com os
// controles gerais do céu aplicados. Usado pelo céu e pela luz.
export function cloudMotionUniforms() {
  const c = HERO_CONFIG.sky;
  return {
    uFlowStrength: { value: c.flowStrength * c.intensity },
    uFlowSpeed: { value: c.flowSpeed * c.speed },
    uParallax: { value: c.parallax },
    uDriftAmount: { value: c.driftAmount * c.intensity },
    uDriftSpeed: { value: c.driftSpeed * c.speed },
    uBandAmount: { value: c.bandAmount * c.intensity },
    uBandSpeed: { value: c.bandSpeed * c.speed },
  };
}
