import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Curve,
  CustomBlending,
  DoubleSide,
  Group,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  TubeGeometry,
  Quaternion,
  Vector2,
  Vector3,
  Vector4,
  type Texture,
} from "three";
import { HERO_CONFIG, HERO_DIVE } from "../config";
import { conveyorClimb, diveFrame, diveState, flightOf, mosaicSlots } from "../dive";
import { noise } from "../glsl";
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
uniform float uTrim;      // a linha só existe acima desta altura (esteira subindo)
void main() {
  float ends = smoothstep(0.0, 0.05, vAlong) * smoothstep(1.0, 0.92, vAlong)
              * smoothstep(uTrim, uTrim + 0.06, vAlong);
  float depth = mix(uBackDim, 1.0, smoothstep(0.1, 0.9, vDepth));
  // brilho percorrendo a linha (energia subindo)
  float s = fract(vAlong * 2.0 - uTime * 0.12);
  float sweep = 1.0 + uSweep * smoothstep(0.12, 0.0, abs(s - 0.5));
  float profile = mix(pow(vFacing, 3.0), pow(vFacing, 6.0) * 0.35, uSoft);
  gl_FragColor = vec4(uColor * profile * ends * depth * sweep * uIntensity, 1.0);
}`;

// ---------- painéis ----------
// Desintegração atrás da linha de transformação (transição para o "Sobre"):
// onde a linha já passou, o painel se desfaz em "pixels" de 3 px, numa faixa
// de largura uBand; perto da borda que ainda resta, ele esquenta (âmbar).
const dissolve = /* glsl */ `
uniform float uLineX;  // posição da linha (fração da largura); < 0 = desligada
uniform float uBand;
uniform vec2 uRes;
${noise}
// > 0: já se desfez (descartar). Entre -1 e 0: borda quente.
float dissolveAmount() {
  if (uLineX < 0.0) return -2.0;
  float behind = (uLineX - gl_FragCoord.x / uRes.x) / uBand;
  float n = hash(floor(gl_FragCoord.xy / 3.0));
  return behind - n;
}`;

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
${dissolve}
void main() {
  if (dissolveAmount() > 0.0) discard;
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
${dissolve}
void main() {
  float dz = dissolveAmount();
  if (dz > 0.0) discard;
  // no verso, desespelha (o nome continua legível quando o cartão vira de costas)
  float ux = gl_FrontFacing ? vUv.x : 1.0 - vUv.x;
  vec2 tuv = vec2(mix(uRect.x, uRect.z, ux), mix(uRect.w, uRect.y, vUv.y));
  vec3 glow = texture2D(uPanels, tuv).rgb;
  float face = gl_FrontFacing ? 1.0 : uBackFace;
  // borda que ainda resta, logo antes de se desfazer: brilha em âmbar
  float heat = smoothstep(-0.35, 0.0, dz);
  vec3 col = glow * uBright * face * uIntensity + vec3(1.0, 0.55, 0.2) * heat * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

const dissolveUniforms = () => ({
  uLineX: { value: -1 },
  uBand: { value: HERO_DIVE.dissolveBand },
  uRes: { value: new Vector2(1, 1) },
});

// Temporários reaproveitados a cada frame (sem criar objetos no loop)
const tmp = {
  parentInv: new Matrix4(),
  m: new Matrix4(),
  pos: new Vector3(),
  quat: new Quaternion(),
  scl: new Vector3(),
  pos2: new Vector3(),
  scl2: new Vector3(),
  front: new Quaternion(),
  p0: new Vector3(),
  p1: new Vector3(),
  p2: new Vector3(),
  p3: new Vector3(),
  prev: new Vector3(),
  q0: new Quaternion(),
  s0: new Vector3(),
  w1: new Vector3(),
  w2: new Vector3(),
  c1: new Vector3(),
  c2: new Vector3(),
};

// Ponto de uma curva de Bézier cúbica
function bezier(out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number) {
  const it = 1 - t;
  return out
    .copy(a)
    .multiplyScalar(it * it * it)
    .addScaledVector(b, 3 * it * it * t)
    .addScaledVector(c, 3 * it * t * t)
    .addScaledVector(d, t * t * t);
}

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
  const plateMats = useRef<(ShaderMaterial | null)[]>([]);
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
      uTrim: { value: -1 },
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
        aspect: it.width / it.height,
        plateUniforms: {
          uShade: { value: it.shadeTex },
          uRect: { value: it.uvRect },
          uShadeAmount: { value: c.opacity },
          ...dissolveUniforms(),
        },
        glowUniforms: {
          uPanels: { value: it.glowTex },
          uRect: { value: it.uvRect },
          uBright: { value: 1 },
          uIntensity: { value: comp.intensity },
          uBackFace: { value: c.backFace },
          ...dissolveUniforms(),
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

    // Transição para o "Sobre" (dive.ts)
    const f = diveFrame(diveState.active ? diveState.progress : 0);
    const lineX = diveState.active && f.splitting ? f.lineR : -1;
    const slots = diveState.active
      ? mosaicSlots(
          layout.map((it) => it.aspect),
          diveState.textRect,
          size.width / size.height,
          HERO_DIVE.mosaicRow,
        )
      : null;

    if (slots) {
      // área do mosaico, para as faíscas nascerem de onde estão os cartões
      const mr = diveState.mosaicRect;
      mr[0] = mr[1] = 1;
      mr[2] = mr[3] = 0;
      slots.forEach((sl, i) => {
        const hw = (sl.h * layout[i].aspect * size.height) / size.width / 2;
        mr[0] = Math.min(mr[0], sl.x - hw);
        mr[2] = Math.max(mr[2], sl.x + hw);
        mr[1] = Math.min(mr[1], sl.y - sl.h / 2);
        mr[3] = Math.max(mr[3], sl.y + sl.h / 2);
      });
    }

    // Esteira: todos sobem juntos; a linha é recolhida atrás do último cartão
    const lowestU = layout.length ? Math.min(...layout.map((it) => it.u)) : 0;
    const climb = slots ? conveyorClimb(diveState.progress, lowestU) : 0;
    for (const m of lineMats.current) {
      m.uniforms.uTime.value = t * comp.speed;
      m.uniforms.uTrim.value = climb > 0 ? lowestU + climb - 0.05 : -1;
    }

    // matriz que leva do "mundo" para dentro do grupo que gira (para pôr os
    // cartões em voo numa posição da tela, apesar da inclinação e do giro)
    outer.current.updateMatrixWorld(true);
    tmp.parentInv.copy(spin.current.matrixWorld).invert();
    const r = c.radius + c.panelOffset;

    layout.forEach((p, i) => {
      const mesh = panelRefs.current[i];
      const glowMat = glowMats.current[i];
      const plateMat = plateMats.current[i];
      if (!mesh || !glowMat) return;
      // Pose sobre a hélice na altura u (a esteira só muda o u)
      const placeOnHelix = (u: number, float: number) => {
        const angle = u * c.turns * Math.PI * 2;
        const a = angle + spinAngle;
        mesh.position.set(Math.sin(angle) * r, u - 0.5 + float, Math.cos(angle) * r);
        // turn = 1: o painel gira junto com a espiral (de lado nas laterais);
        // turn = 0: fica sempre de frente para a câmera.
        mesh.rotation.set(0, angle - a * (1 - c.turn), 0);
        mesh.scale.setScalar(1);
        return Math.cos(a) * 0.5 + 0.5; // 1 = na frente, 0 = atrás
      };
      const float = Math.sin(t * (0.6 + i * 0.07) + i * 1.7) * comp.panelFloat * motion;
      const fl = slots ? flightOf(p.u, climb) : 0;

      let bright: number;
      if (!slots || fl <= 0) {
        // ainda na espiral (subindo pela esteira, se ela já começou)
        const depth = placeOnHelix(p.u + climb, float);
        bright = c.backDim + (1 - c.backDim) * depth;
      } else {
        // Voo do topo até o mosaico, CONTORNANDO o mosaico pela direita (para não
        // passar por cima dos cartões que já pousaram):
        //   topo da espiral → W1 (acima e à direita do mosaico)
        //   → W2 (desce pela lateral até a altura da sua linha)
        //   → vaga (entra pela direita, onde ainda não pousou ninguém: as vagas
        //     de cada linha enchem da esquerda para a direita).
        // Três curvas de Bézier emendadas sem quina; a primeira SAI na direção
        // em que o cartão vinha subindo (sem tranco ao deixar a espiral).
        const ex = HERO_DIVE.exitAt;
        const depth = placeOnHelix(ex, 0);
        mesh.updateMatrix();
        tmp.m.multiplyMatrices(spin.current!.matrixWorld, mesh.matrix);
        tmp.m.decompose(tmp.p0, tmp.q0, tmp.s0);
        placeOnHelix(ex - 0.01, 0);
        mesh.updateMatrix();
        tmp.m.multiplyMatrices(spin.current!.matrixWorld, mesh.matrix);
        tmp.m.decompose(tmp.prev, tmp.quat, tmp.scl);

        const slot = slots[i];
        const mr = diveState.mosaicRect;
        const toWorld = (out: Vector3, sx: number, sy: number) =>
          out.set((sx - 0.5) * vp.width, -(sy - 0.5) * vp.height, 0);
        // meia largura do cartão já pousado (fração da tela): o corredor da
        // direita fica afastado o bastante para ele não raspar no mosaico
        const halfW = (slot.h * p.aspect * size.height) / size.width / 2;
        // (com folga: em voo o cartão vem mais perto da câmera e parece maior)
        const rx = Math.min(1 - halfW * 1.35 - 0.01, mr[2] + halfW + 0.02); // sem sair da tela
        toWorld(tmp.w1, rx, mr[1] - slot.h * 1.2);
        toWorld(tmp.w2, rx, slot.y);
        toWorld(tmp.p3, slot.x, slot.y);

        // cada trecho dura proporcional ao comprimento dele
        const l1 = tmp.p0.distanceTo(tmp.w1);
        const l2 = tmp.w1.distanceTo(tmp.w2);
        const l3 = tmp.w2.distanceTo(tmp.p3);
        const total = l1 + l2 + l3 || 1;
        const f1 = l1 / total;
        const f2 = l2 / total;
        const bend = vp.height * 0.08;

        // sai na velocidade da esteira e freia ao pousar
        const e = fl + fl * fl - fl * fl * fl;
        if (e < f1) {
          // 1) do topo até W1, chegando de cima (descendo)
          tmp.p1
            .subVectors(tmp.p0, tmp.prev)
            .multiplyScalar((1 / 0.01) * ((HERO_DIVE.flightLength * f1) / 3))
            .add(tmp.p0);
          tmp.c2.copy(tmp.w1).setY(tmp.w1.y + bend);
          bezier(tmp.pos, tmp.p0, tmp.p1, tmp.c2, tmp.w1, e / f1);
        } else if (e < f1 + f2) {
          // 2) descendo pela lateral do mosaico
          tmp.c1.copy(tmp.w1).setY(tmp.w1.y - bend);
          tmp.c2.copy(tmp.w2).setY(tmp.w2.y + bend * 0.5);
          bezier(tmp.pos, tmp.w1, tmp.c1, tmp.c2, tmp.w2, (e - f1) / f2);
        } else {
          // 3) curva para a esquerda e entra na vaga pela direita
          tmp.c1.copy(tmp.w2).setY(tmp.w2.y - bend * 0.5);
          tmp.c2.copy(tmp.p3).setX(tmp.p3.x + bend * 1.2);
          bezier(tmp.pos, tmp.w2, tmp.c1, tmp.c2, tmp.p3, (e - f1 - f2) / (1 - f1 - f2 || 1));
        }
        // um pouco mais perto da câmera durante o voo (passa na frente de tudo)
        tmp.pos.z += Math.sin(Math.PI * e) * vp.height * 0.1;
        const ease = fl * fl * (3 - 2 * fl);
        tmp.quat.copy(tmp.q0).slerp(tmp.front, ease);
        const target = (slot.h * vp.height) / p.height;
        tmp.scl2.setScalar(tmp.s0.x + (target - tmp.s0.x) * ease);
        // de volta para o espaço do grupo que gira
        tmp.m.compose(tmp.pos, tmp.quat, tmp.scl2).premultiply(tmp.parentInv);
        tmp.m.decompose(mesh.position, mesh.quaternion, mesh.scale);
        const b0 = c.backDim + (1 - c.backDim) * depth;
        bright = b0 + (1 - b0) * ease;
      }

      glowMat.uniforms.uBright.value = bright;
      for (const mat of [glowMat, plateMat]) {
        if (!mat) continue;
        mat.uniforms.uLineX.value = lineX;
        mat.uniforms.uRes.value.copy(scene.uRes.value);
      }
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
                  ref={(m) => {
                    plateMats.current[i] = m;
                  }}
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
