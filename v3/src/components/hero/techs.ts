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
  siReact,
  siSpringboot,
  siTypescript,
} from "simple-icons";

// Tecnologias disponíveis para os cartões da espiral. A chave é o que vai em
// HERO_CONFIG.spiral.items. Ícones: Simple Icons (logos oficiais, licença CC0).
// gRPC e AWS não existem no Simple Icons; REST não tem logo.
type Icon = { path: string };
export const TECHS: Record<string, { name: string; icon: Icon }> = {
  react: { name: "React", icon: siReact },
  flutter: { name: "Flutter", icon: siFlutter },
  reactNative: { name: "React Native", icon: siReact },
  fastapi: { name: "FastAPI", icon: siFastapi },
  springBoot: { name: "Spring Boot", icon: siSpringboot },
  nestjs: { name: "NestJS", icon: siNestjs },
  firebase: { name: "Firebase", icon: siFirebase },
  postgresql: { name: "PostgreSQL", icon: siPostgresql },
  mysql: { name: "MySQL", icon: siMysql },
  typescript: { name: "TypeScript", icon: siTypescript },
  javascript: { name: "JavaScript", icon: siJavascript },
  python: { name: "Python", icon: siPython },
  java: { name: "Java", icon: siOpenjdk },
  c: { name: "C", icon: siC },
  cpp: { name: "C++", icon: siCplusplus },
  gcp: { name: "Google Cloud", icon: siGooglecloud },
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
