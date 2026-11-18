import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, NoColorSpace } from "three";
import { HERO_CONFIG } from "./config";
import {
  siC,
  siCplusplus,
  siDocker,
  siFastapi,
  siFigma,
  siFirebase,
  siFlutter,
  siGit,
  siGithub,
  siGitlab,
  siGooglecloud,
  siJavascript,
  siKubernetes,
  siLinux,
  siMysql,
  siNestjs,
  siOpenjdk,
  siPostgresql,
  siPython,
  siScikitlearn,
  siTailwindcss,
  siCloudflare,
  siDuckdb,
  siAnthropic,
  siPytorch,
  siHuggingface,
  siTelegram,
  siReact,
  siSpringboot,
  siTypescript,
} from "simple-icons";

// Tecnologias disponíveis para os cartões da espiral. A chave é o que vai em
// HERO_CONFIG.spiral.items. Ícones: Simple Icons (logos oficiais, licença CC0).
// gRPC e AWS não existem no Simple Icons: usam ícones genéricos (Material
// Icons, Apache 2.0) abaixo. REST não tem logo.
type Icon = { path: string };
// nuvem
const iconCloud: Icon = {
  path: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
};
// setas de ida e volta (chamada e resposta)
const iconRpc: Icon = {
  path: "M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
};
export const TECHS: Record<string, { name: string; icon: Icon }> = {
  react: { name: "React", icon: siReact },
  flutter: { name: "Flutter", icon: siFlutter },
  reactNative: { name: "React Native", icon: siReact },
  fastapi: { name: "FastAPI", icon: siFastapi },
  springBoot: { name: "Spring Boot", icon: siSpringboot },
  nestjs: { name: "NestJS", icon: siNestjs },
  firebase: { name: "Firebase", icon: siFirebase },
  postgresql: { name: "PostgreSQL", icon: siPostgresql },
  duckdb: { name: "DuckDB", icon: siDuckdb },
  anthropic: { name: "Claude", icon: siAnthropic },
  mysql: { name: "MySQL", icon: siMysql },
  typescript: { name: "TypeScript", icon: siTypescript },
  tailwind: { name: "Tailwind CSS", icon: siTailwindcss },
  cloudflare: { name: "Cloudflare", icon: siCloudflare },
  javascript: { name: "JavaScript", icon: siJavascript },
  python: { name: "Python", icon: siPython },
  pytorch: { name: "PyTorch", icon: siPytorch },
  scikitlearn: { name: "scikit-learn", icon: siScikitlearn },
  huggingface: { name: "Hugging Face", icon: siHuggingface },
  telegram: { name: "Telegram", icon: siTelegram },
  java: { name: "Java", icon: siOpenjdk },
  c: { name: "C", icon: siC },
  cpp: { name: "C++", icon: siCplusplus },
  gcp: { name: "Google Cloud", icon: siGooglecloud },
  aws: { name: "AWS", icon: iconCloud },
  grpc: { name: "gRPC", icon: iconRpc },
  docker: { name: "Docker", icon: siDocker },
  kubernetes: { name: "Kubernetes", icon: siKubernetes },
  linux: { name: "Linux", icon: siLinux },
  git: { name: "Git", icon: siGit },
  github: { name: "GitHub", icon: siGithub },
  gitlab: { name: "GitLab", icon: siGitlab },
  figma: { name: "Figma", icon: siFigma },
};

// ---------- desenho do cartão (canvas → textura) ----------
// Cartão em linha: placa escura arredondada com borda dourada, ícone à
// esquerda e o nome ao lado. São duas texturas, como nos outros painéis:
//  - glow: o que brilha (borda, ícone, nome) → somado à cena;
//  - shade: o formato da placa → escurece o que está atrás e grava profundidade.

const H = 200; // altura do cartão em px na textura (largura depende do nome)
const PAD = 44;
const ICON = 92;
const GAP = 30;
const RADIUS = 34;
// tamanho do nome: 76px na textura × HERO_CONFIG.spiral.techFontSize
const FONT = `600 ${Math.round(76 * HERO_CONFIG.spiral.techFontSize)}px 'Space Grotesk Variable', system-ui, sans-serif`;
const GOLD = "rgb(255, 170, 80)";
const TEXT = "rgb(255, 222, 170)";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function measure(name: string) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = FONT;
  return PAD + ICON + GAP + Math.ceil(ctx.measureText(name).width) + PAD;
}

function draw(glow: HTMLCanvasElement, shade: HTMLCanvasElement, name: string, icon: Icon) {
  const W = glow.width;
  const inset = 10; // espaço para o brilho da borda não ser cortado

  const s = shade.getContext("2d")!;
  s.clearRect(0, 0, W, H);
  s.fillStyle = "#000";
  s.fillRect(0, 0, W, H);
  s.fillStyle = "#fff";
  roundedRect(s, inset, inset, W - inset * 2, H - inset * 2, RADIUS);
  s.fill();

  const g = glow.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);

  // borda dourada com brilho
  g.save();
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.shadowColor = GOLD;
  g.shadowBlur = 18;
  roundedRect(g, inset + 2, inset + 2, W - inset * 2 - 4, H - inset * 2 - 4, RADIUS - 2);
  g.stroke();
  g.shadowBlur = 0;
  g.globalAlpha = 0.9;
  g.stroke();
  g.restore();

  // ícone (path SVG 24x24 do Simple Icons)
  g.save();
  g.translate(PAD, (H - ICON) / 2);
  g.scale(ICON / 24, ICON / 24);
  g.fillStyle = TEXT;
  g.shadowColor = GOLD;
  g.shadowBlur = 14;
  g.fill(new Path2D(icon.path));
  g.restore();

  // nome
  g.save();
  g.font = FONT;
  g.textBaseline = "middle";
  g.fillStyle = TEXT;
  g.shadowColor = GOLD;
  g.shadowBlur = 16;
  g.fillText(name, PAD + ICON + GAP, H / 2 + 4);
  g.restore();
}

function makeTexture(canvas: HTMLCanvasElement) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = NoColorSpace;
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

export type TechCard = {
  glow: CanvasTexture;
  shade: CanvasTexture;
  aspect: number; // largura / altura
};

// Cria (e redesenha quando a fonte terminar de carregar) os cartões pedidos.
export function useTechCards(keys: string[]): Record<string, TechCard> {
  const cards = useMemo(() => {
    const out: Record<string, TechCard> = {};
    for (const key of keys) {
      const tech = TECHS[key];
      if (!tech) continue;
      const W = measure(tech.name);
      const glow = Object.assign(document.createElement("canvas"), { width: W, height: H });
      const shade = Object.assign(document.createElement("canvas"), { width: W, height: H });
      draw(glow, shade, tech.name, tech.icon);
      out[key] = { glow: makeTexture(glow), shade: makeTexture(shade), aspect: W / H };
    }
    return out;
  }, [keys]);

  useEffect(() => {
    let alive = true;
    document.fonts.load(FONT).then(() => {
      if (!alive) return;
      for (const [key, card] of Object.entries(cards)) {
        const tech = TECHS[key];
        draw(card.glow.image as HTMLCanvasElement, card.shade.image as HTMLCanvasElement, tech.name, tech.icon);
        card.glow.needsUpdate = true;
        card.shade.needsUpdate = true;
      }
    });
    return () => {
      alive = false;
    };
  }, [cards]);

  return cards;
}
