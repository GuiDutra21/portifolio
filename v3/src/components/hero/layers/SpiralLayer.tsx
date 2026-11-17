import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Curve,
  CustomBlending,
  DoubleSide,
  Group,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  Vector4,
  type Texture,
} from "three";
import { HERO_CONFIG } from "../config";
import PANELS from "../panels.json";
import { useTechCards } from "../techs";
import type { SceneUniforms } from "../sceneState";

// Espiral 3D girando em loop infinito, com os painéis presos nela.
// Mesma ideia da referência (Framer "Spiral 3D"): os itens ficam em volta de
// um eixo vertical, em alturas e ângulos diferentes, e o conjunto todo gira.
//  - a linha dourada é uma hélice 3D (tubo com brilho);
//  - cada item é um cartão 3D: ou um painel da arte original (recorte dele em
//    spiral-atlas.png) ou um cartão de tecnologia (ícone + nome, desenhado em
//    techs.ts). A lista e a ordem vêm de HERO_CONFIG.spiral.items;
//  - atrás do eixo, linha e painéis ficam mais escuros;
//  - quem cobre quem é decidido ponto a ponto pela profundidade (depth buffer):
//    a placa escura de cada painel grava a profundidade, e a linha e o brilho
//    dos outros painéis só aparecem onde estão mais perto da câmera que ela.
//    Cada painel fica um pouco para fora da linha, então a linha passa por
//    trás do painel ao qual está presa.
// A espiral é posicionada em frações da imagem (como as outras camadas), então
// acompanha o enquadramento "cover" do céu.

// Hélice de altura 1, centrada na origem: u = 0 embaixo, u = 1 em cima.
class HelixCurve extends Curve<Vector3> {
  private turns: number;
  private radius: number;
  constructor(turns: number, radius: number) {
    super();
    this.turns = turns;
    this.radius = radius;
  }
  getPoint(u: number, target = new Vector3()) {
    const a = u * this.turns * Math.PI * 2;
    return target.set(Math.sin(a) * this.radius, u - 0.5, Math.cos(a) * this.radius);
  }
}

// ---------- linha ----------
const lineVertex = /* glsl */ `
varying float vAlong;
varying float vDepth;
varying float vFacing;
uniform float uRadius;
void main() {
  vAlong = uv.x;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 axis = modelMatrix * vec4(0.0, position.y, 0.0, 1.0);
  // profundidade em relação ao eixo: 1 = na frente, 0 = atrás
  vDepth = clamp((world.z - axis.z) / (uRadius * length(modelMatrix[0].xyz)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 v = normalize(cameraPosition - world.xyz);
  vFacing = abs(dot(n, v));
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const lineFragment = /* glsl */ `
varying float vAlong;
varying float vDepth;
varying float vFacing;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uBackDim;
uniform float uTime;
uniform float uSweep;
uniform float uSoft;      // 0 = núcleo fino, 1 = halo largo e suave
void main() {
  float ends = smoothstep(0.0, 0.05, vAlong) * smoothstep(1.0, 0.92, vAlong);
  float depth = mix(uBackDim, 1.0, smoothstep(0.1, 0.9, vDepth));
  // brilho percorrendo a linha (energia subindo)
  float s = fract(vAlong * 2.0 - uTime * 0.12);
  float sweep = 1.0 + uSweep * smoothstep(0.12, 0.0, abs(s - 0.5));
  float profile = mix(pow(vFacing, 3.0), pow(vFacing, 6.0) * 0.35, uSoft);
  gl_FragColor = vec4(uColor * profile * ends * depth * sweep * uIntensity, 1.0);
}`;

// ---------- painéis ----------
const panelVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Placa escura do painel: escurece o que está atrás e grava a profundidade
// (só onde a placa existe; fora dela o fragmento é descartado).
const plateFragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uShade;
uniform vec4 uRect;        // onde o painel está na folha (xmin, ymin, xmax, ymax)
uniform float uShadeAmount;
void main() {
  float ux = gl_FrontFacing ? vUv.x : 1.0 - vUv.x;
  vec2 tuv = vec2(mix(uRect.x, uRect.z, ux), mix(uRect.w, uRect.y, vUv.y));
  float shade = texture2D(uShade, tuv).r;
  if (shade < 0.5) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, shade * uShadeAmount);
}`;

// Brilho do painel (bordas, código, ícones), somado por cima da placa
const glowFragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uPanels;
uniform vec4 uRect;
uniform float uBright;     // escurece quando está atrás do eixo
uniform float uIntensity;
uniform float uBackFace;   // brilho do verso do painel
void main() {
  // no verso, desespelha (o nome continua legível quando o cartão vira de costas)
  float ux = gl_FrontFacing ? vUv.x : 1.0 - vUv.x;
  vec2 tuv = vec2(mix(uRect.x, uRect.z, ux), mix(uRect.w, uRect.y, vUv.y));
  vec3 glow = texture2D(uPanels, tuv).rgb;
  float face = gl_FrontFacing ? 1.0 : uBackFace;
  gl_FragColor = vec4(glow * uBright * face * uIntensity, 1.0);
}`;

type Props = {
  scene: SceneUniforms;
  panels: Texture;
  shade: Texture;
  imgSize: Vector2;
  compAspect: number; // largura / altura da imagem original da espiral
  renderOrder: number; // a espiral usa renderOrder .. renderOrder + 2
};

export function SpiralLayer({ scene, panels, shade, imgSize, compAspect, renderOrder }: Props) {
  const c = HERO_CONFIG.spiral;
  const comp = HERO_CONFIG.components;
  const outer = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const panelRefs = useRef<(Group | null)[]>([]);
  const glowMats = useRef<(ShaderMaterial | null)[]>([]);
  const lineMats = useRef<ShaderMaterial[]>([]);
  const size = useThree((s) => s.size);
  const viewport = useThree((s) => s.viewport);
  const camera = useThree((s) => s.camera);

  const curve = useMemo(() => new HelixCurve(c.turns, c.radius), [c.turns, c.radius]);
  const coreGeo = useMemo(() => new TubeGeometry(curve, 900, c.lineWidth, 8, false), [curve, c.lineWidth]);
  const haloGeo = useMemo(() => new TubeGeometry(curve, 900, c.lineWidth * 5, 10, false), [curve, c.lineWidth]);

  const lineUniforms = useMemo(() => {
    const make = (soft: number) => ({
      uColor: { value: new Color(...c.lineColor) },
      uIntensity: { value: c.lineIntensity * comp.intensity },
      uBackDim: { value: c.lineBackDim },
      uTime: { value: 0 },
      uSweep: { value: c.lineSweep },
      uSoft: { value: soft },
      uRadius: { value: c.radius },
    });
    // [núcleo, halo]
    return [make(0), make(1)];
  }, [c, comp.intensity]);

  const techCards = useTechCards(c.items);

  // Itens distribuídos ao longo da hélice, de cima (primeiro) para baixo
  const layout = useMemo(() => {
    const full = new Vector4(0, 0, 1, 1);
    const items = c.items
      .map((key) => {
        const panel = PANELS.find((p) => p.name === key);
        if (panel) {
          const [x0, y0, x1, y1] = panel.rect;
          return {
            width: (x1 - x0) * compAspect * c.panelScale,
            height: (y1 - y0) * c.panelScale,
            glowTex: panels,
            shadeTex: shade,
            uvRect: new Vector4(...panel.atlas),
          };
        }
        const card = techCards[key];
        if (card) {
          const h = c.techCardHeight * c.panelScale;
          return { width: h * card.aspect, height: h, glowTex: card.glow, shadeTex: card.shade, uvRect: full };
        }
        return null;
      })
      .filter((it) => it !== null);

    return items.map((it, i) => {
      const u = c.end - (i / Math.max(items.length - 1, 1)) * (c.end - c.start);
      return {
        u,
        angle: u * c.turns * Math.PI * 2,
        width: it.width,
        height: it.height,
        plateUniforms: {
          uShade: { value: it.shadeTex },
          uRect: { value: it.uvRect },
          uShadeAmount: { value: c.opacity },
        },
        glowUniforms: {
          uPanels: { value: it.glowTex },
          uRect: { value: it.uvRect },
          uBright: { value: 1 },
          uIntensity: { value: comp.intensity },
          uBackFace: { value: c.backFace },
        },
      };
    });
  }, [c, comp.intensity, panels, shade, compAspect, techCards]);

  useFrame(() => {
    if (!outer.current || !spin.current) return;
    const t = scene.uTime.value;
    const motion = scene.uMotion.value;
    const pointer = scene.uPointer.value;

    // Encaixe "cover": quanto mede a imagem do céu em unidades do mundo
    const vp = viewport.getCurrentViewport(camera, [0, 0, 0]);
    const screenAspect = size.width / size.height;
    const imgAspect = imgSize.x / imgSize.y;
    const imgH = screenAspect > imgAspect ? vp.width / imgAspect : vp.height;
    const imgW = imgH * imgAspect;

    const [cx, cy] = comp.center;
    outer.current.position.set(
      (cx - 0.5) * imgW + pointer.x * c.parallax * imgW,
      -(cy - 0.5) * imgH - pointer.y * c.parallax * imgH + Math.sin(t * 0.55) * comp.float * imgH * motion,
      0,
    );
    outer.current.scale.setScalar(comp.height * imgH);
    outer.current.rotation.set((c.tilt * Math.PI) / 180 + pointer.y * c.mouseTilt, pointer.x * c.mouseTilt, 0);

    // Giro infinito
    const spinAngle = t * c.speed * comp.speed * Math.PI * 2 * c.direction * motion;
    spin.current.rotation.y = spinAngle;

    for (const m of lineMats.current) m.uniforms.uTime.value = t * comp.speed;

    layout.forEach((p, i) => {
      const mesh = panelRefs.current[i];
      const glowMat = glowMats.current[i];
      if (!mesh || !glowMat) return;
      const a = p.angle + spinAngle;
      const depth = Math.cos(a) * 0.5 + 0.5; // 1 = na frente, 0 = atrás
      // turn = 1: o painel gira junto com a espiral (de lado nas laterais);
      // turn = 0: fica sempre de frente para a câmera.
      mesh.rotation.y = p.angle - a * (1 - c.turn);
      mesh.position.y = p.u - 0.5 + Math.sin(t * (0.6 + i * 0.07) + i * 1.7) * comp.panelFloat * motion;
      glowMat.uniforms.uBright.value = c.backDim + (1 - c.backDim) * depth;
    });
  });

  return (
    <group ref={outer}>
      <group ref={spin}>
        {/* Ordem: placas (gravam profundidade) → linha → brilho dos painéis */}
        {[coreGeo, haloGeo].map((geo, i) => (
          <mesh key={i} geometry={geo} frustumCulled={false} renderOrder={renderOrder + 1}>
            <shaderMaterial
              ref={(m) => {
                if (m) lineMats.current[i] = m;
              }}
              vertexShader={lineVertex}
              fragmentShader={lineFragment}
              uniforms={lineUniforms[i]}
              transparent
              blending={AdditiveBlending}
              depthTest
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        ))}

        {layout.map((p, i) => {
          const r = c.radius + c.panelOffset;
          return (
            <group
              key={i}
              ref={(g) => {
                panelRefs.current[i] = g;
              }}
              position={[Math.sin(p.angle) * r, p.u - 0.5, Math.cos(p.angle) * r]}
              rotation={[0, p.angle, 0]}
            >
              <mesh frustumCulled={false} renderOrder={renderOrder}>
                <planeGeometry args={[p.width, p.height]} />
                <shaderMaterial
                  vertexShader={panelVertex}
                  fragmentShader={plateFragment}
                  uniforms={p.plateUniforms}
                  transparent
                  side={DoubleSide}
                  blending={CustomBlending}
                  blendSrc={OneFactor}
                  blendDst={OneMinusSrcAlphaFactor}
                  depthTest
                  depthWrite
                />
              </mesh>
              <mesh frustumCulled={false} renderOrder={renderOrder + 2}>
                <planeGeometry args={[p.width, p.height]} />
                <shaderMaterial
                  ref={(m) => {
                    glowMats.current[i] = m;
                  }}
                  vertexShader={panelVertex}
                  fragmentShader={glowFragment}
                  uniforms={p.glowUniforms}
                  transparent
                  side={DoubleSide}
                  blending={AdditiveBlending}
                  depthTest
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
