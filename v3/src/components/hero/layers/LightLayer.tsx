import { useMemo } from "react";
import { AdditiveBlending, Vector2, type Texture } from "three";
import { HERO_CONFIG, cloudMotionUniforms } from "../config";
import { cloudMotion, coverUv, fullscreenVertex, noise } from "../glsl";
import { useSceneMaterial, type SceneUniforms } from "../sceneState";

// Coluna de luz da cena original (public/hero/light-layer.png), SOMADA à cena
// e animada sem trocar o desenho dela:
//  - feixes de brilho descendo ao longo dos raios → a luz "cai" do céu;
//  - raios cintilando devagar, cada um no seu ritmo;
//  - brilho "respirando";
//  - poeira descendo, só onde já existe luz.
// Ela também se move JUNTO com as nuvens (mesmo balanço, vaivém e mouse), para
// os resquícios de nuvem dentro dela acompanharem o céu. O efeito vai sumindo
// para baixo, então a luz continua caindo em cima da pessoa.

const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform float uMotion;
uniform vec2 uSource;
uniform float uIntensity;
uniform float uSpeed;
uniform float uFall;
uniform float uFallSpeed;
uniform float uShimmer;
uniform float uPulse;
uniform float uDust;
uniform float uDustSpeed;
uniform float uSourceBrightness;
uniform float uSourceSize;
uniform vec2 uPointer;
uniform float uFollowTop;
uniform float uFollowBottom;

${coverUv}
${noise}
${cloudMotion}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImgSize);

  // Mesmo deslocamento das nuvens: inteiro no alto, sumindo até o pé da luz
  float follow = mix(uFollowTop, uFollowBottom, smoothstep(0.15, 0.8, uv.y));
  vec3 light = texture2D(uImage, uv + cloudOffset(uv, uTime, uPointer, uMotion) * follow).rgb;
  float t = uTime * uSpeed;

  // Posição em relação à abertura no céu: ângulo = qual raio, r = distância
  float aspect = uImgSize.x / uImgSize.y;
  vec2 d = (uv - uSource) * vec2(aspect, 1.0);
  float r = length(d);
  float ang = atan(d.x, max(d.y, 0.0001));
  // Colado na origem (e acima dela) os raios convergem num ponto: ali a
  // animação some, senão vira um "estouro" artificial.
  float animMask = smoothstep(0.05, 0.2, r) * smoothstep(0.0, 0.08, d.y);

  // Feixes de brilho descendo pelos raios (ruído esticado ao longo deles,
  // rolando para baixo). Média 1 → não muda o brilho geral, só o distribui.
  float fallT = t * uFallSpeed;
  float fn = noise(vec2(ang * 90.0, r * 5.0 - fallT * 5.0)) * 0.65
           + noise(vec2(ang * 200.0 + 11.0, r * 11.0 - fallT * 8.0)) * 0.35;
  float fall = 1.0 + (fn - 0.5) * 2.0 * uFall * animMask;

  // Raios cintilando devagar
  float sn = noise(vec2(ang * 60.0, t * 0.25)) * 0.6 + noise(vec2(ang * 150.0 + 3.0, t * 0.4)) * 0.4;
  float shimmer = 1.0 + (sn - 0.5) * 2.0 * uShimmer * animMask;

  float pulse = 1.0 + sin(t * 0.7) * uPulse;
  vec3 col = light * mix(1.0, fall * shimmer * pulse, uMotion);

  // Abertura mais discreta: escurece a luz em volta da origem
  float sz = 0.09 * uSourceSize;
  float nearSource = exp(-dot(d, d) / (sz * sz));
  col *= mix(1.0, uSourceBrightness, nearSource);

  // Poeira descendo, só onde já existe luz
  vec2 g = uv * vec2(aspect, 1.0) * 70.0;
  g.y -= t * uDustSpeed * 70.0 * uMotion;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  vec2 jitter = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float speck = smoothstep(0.09, 0.0, length(f - jitter * 0.7)) * step(0.85, h);
  float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 + h * 40.0);
  float where = smoothstep(0.04, 0.35, dot(light, vec3(0.33)));
  col += vec3(1.0, 0.75, 0.45) * speck * twinkle * where * uDust;

  gl_FragColor = vec4(col * uIntensity, 1.0);
}`;

type Props = {
  scene: SceneUniforms;
  image: Texture;
  renderOrder: number;
};

export function LightLayer({ scene, image, renderOrder }: Props) {
  const uniforms = useMemo(() => {
    const c = HERO_CONFIG.light;
    const img = image.image as HTMLImageElement;
    return {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uRes: { value: new Vector2(1, 1) },
      uImage: { value: image },
      uImgSize: { value: new Vector2(img.width, img.height) },
      uSource: { value: new Vector2(...c.source) },
      uIntensity: { value: c.intensity },
      uSpeed: { value: c.speed },
      uFall: { value: c.fall },
      uFallSpeed: { value: c.fallSpeed },
      uShimmer: { value: c.shimmer },
      uPulse: { value: c.pulse },
      uDust: { value: c.dust },
      uDustSpeed: { value: c.dustSpeed },
      uSourceBrightness: { value: c.sourceBrightness },
      uSourceSize: { value: c.sourceSize },
      ...cloudMotionUniforms(),
      uPointer: { value: new Vector2() },
      uFollowTop: { value: c.followClouds },
      uFollowBottom: { value: c.followBottom },
    };
  }, [image]);

  const material = useSceneMaterial(scene);

  return (
    <mesh frustumCulled={false} renderOrder={renderOrder}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={fullscreenVertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
