import { useMemo } from "react";
import { Vector2, Vector3, type Texture } from "three";
import { HERO_CONFIG, cloudMotionUniforms } from "../config";

// Valores do modo de cor escolhido (escuro, claro, maisClaro)
function moodUniforms() {
  const mood = HERO_CONFIG.sky.moods[HERO_CONFIG.sky.mood];
  return {
    uExposure: { value: mood.exposure },
    uShadows: { value: mood.shadows },
    uTint: { value: new Vector3(...mood.tint) },
    uTintAmount: { value: mood.tintAmount },
    uSaturation: { value: mood.saturation },
    uFloorGrade: { value: mood.floor },
    uHorizon: { value: 0.909 }, // linha do horizonte na imagem do céu
  };
}
import { cloudMotion, coverUv, fullscreenVertex, noise } from "../glsl";
import { useSceneMaterial, type SceneUniforms } from "../sceneState";

// Céu com as nuvens animadas. A máscara diz onde as nuvens podem se mover
// (some antes do horizonte, então o chão fica parado).
// Movimento próprio, sempre ativo:
//  - vaivém: o céu inteiro desliza devagar para os lados (mais no alto, onde
//    as nuvens estão "mais perto"; menos junto ao horizonte);
//  - faixas: camadas de nuvens em alturas diferentes deslizam umas contra as outras;
//  - forma: ruído animado faz as nuvens mudarem de forma;
//  - vento: manchas suaves de luz e sombra atravessam as nuvens.
// Somado a isso, as nuvens seguem o ponteiro.

const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform vec2 uPointer;
uniform float uMotion;
uniform float uLightStrength;
uniform float uExposure;
uniform float uShadows;
uniform vec3 uTint;
uniform float uTintAmount;
uniform float uSaturation;
uniform float uFloorGrade;
uniform float uHorizon;
uniform float uLightSpeed;
uniform vec2 uWindDir;

${coverUv}
${noise}
${cloudMotion}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImgSize);

  // Máscara das nuvens; some perto das bordas para nunca amostrar fora da imagem.
  float m = texture2D(uMask, uv).r;
  m *= smoothstep(0.0, 0.10, uv.x) * smoothstep(1.0, 0.90, uv.x) * smoothstep(0.0, 0.05, uv.y);

  vec2 offset = cloudOffset(uv, uTime, uPointer, uMotion);
  vec2 q = cloudQ;

  // Uma única amostra → nitidez total
  vec3 color = texture2D(uImage, uv + offset * m).rgb;

  // Manchas de luz e sombra atravessando as nuvens (vento)
  vec2 lp = uv * vec2(2.6, 3.4) - uWindDir * uTime * uLightSpeed * 2.6;
  float light = fbm(lp + q * 0.8) - 0.5;
  color *= 1.0 + light * uLightStrength * m * uMotion;

  // Cor do céu (modo escolhido em HERO_CONFIG.sky.mood). No céu vale inteiro;
  // no chão, só a fração "floor".
  vec3 graded = color * uExposure;
  graded = pow(max(graded, 0.0), vec3(uShadows));          // < 1 abre as sombras
  float lum = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  graded = mix(vec3(lum), graded, uSaturation);
  float tintLum = dot(uTint, vec3(0.2126, 0.7152, 0.0722));
  graded = mix(graded, uTint * (lum / max(tintLum, 0.001)), uTintAmount);
  float skyPart = 1.0 - smoothstep(uHorizon - 0.025, uHorizon + 0.01, uv.y);
  color = mix(color, graded, mix(uFloorGrade, 1.0, skyPart));

  gl_FragColor = vec4(color, 1.0);
}`;

type Props = {
  scene: SceneUniforms;
  image: Texture;
  mask: Texture;
  renderOrder: number;
};

export function SkyLayer({ scene, image, mask, renderOrder }: Props) {
  const uniforms = useMemo(() => {
    const c = HERO_CONFIG.sky;
    const img = image.image as HTMLImageElement;
    return {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uPointer: { value: new Vector2() },
      uRes: { value: new Vector2(1, 1) },
      uImage: { value: image },
      uMask: { value: mask },
      uImgSize: { value: new Vector2(img.width, img.height) },
      ...cloudMotionUniforms(),
      ...moodUniforms(),
      uLightStrength: { value: c.lightStrength * c.intensity },
      uLightSpeed: { value: c.lightSpeed * c.speed },
      uWindDir: { value: new Vector2(...c.windDir) },
    };
  }, [image, mask]);

  const material = useSceneMaterial(scene);

  return (
    <mesh frustumCulled={false} renderOrder={renderOrder}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={fullscreenVertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
