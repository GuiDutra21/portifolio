import { useMemo } from "react";
import { Vector2, type Texture } from "three";
import { HERO_CONFIG } from "../config";
import { coverUv, fullscreenVertex, noise } from "../glsl";
import { useSceneMaterial, type SceneUniforms } from "../sceneState";
import { diveFrame, diveState } from "../dive";

// Nuvens passando NA FRENTE da origem da luz, só em volta da abertura no céu.
// O formato dos tufos vem de ruído animado; a TEXTURA vem das nuvens reais do
// próprio céu (outra região da imagem), então elas parecem do mesmo céu.
// As bordas finas recebem a luz que está atrás (lida da camada da luz) e
// ficam douradas — a luz parece sair de dentro das nuvens.

const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uLight;
uniform sampler2D uSky;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform float uMotion;
uniform vec2 uSource;
uniform vec2 uArea;
uniform float uAmount;
uniform float uOpacity;
uniform float uSize;
uniform float uSpeed;
uniform float uGlow;
uniform float uLightIntensity;

${coverUv}
${noise}

// fbm com mais detalhe que o padrão, para os tufos terem textura de nuvem
float clouds(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImgSize);
  float aspect = uImgSize.x / uImgSize.y;

  // Só em volta da origem da luz (um pouco acima dela, onde fica a abertura)
  vec2 a = (uv - uSource - vec2(0.0, -0.01)) / uArea;
  float area = exp(-dot(a, a) * 1.4);
  if (area < 0.01) discard;

  // Tufos deslizando devagar para o lado, mudando de forma
  float t = uTime * uSpeed * uMotion;
  vec2 p = uv * vec2(aspect, 1.0) * (9.0 / uSize);
  vec2 warp = vec2(clouds(p * 0.5 + vec2(0.0, t * 0.03)), clouds(p * 0.5 + vec2(4.1, -t * 0.025)));
  float n = clouds(p + warp * 1.6 + vec2(t * 0.08, 0.0));

  float cut = mix(0.78, 0.30, uAmount);
  float alpha = smoothstep(cut, cut + 0.16, n) * area * uOpacity;
  if (alpha < 0.003) discard;

  // Textura de nuvem real: amostra o céu numa região cheia de nuvens,
  // deslizando junto com os tufos
  vec2 su = vec2(0.16, 0.30) + (uv - uSource) * 1.15 + warp * 0.02 + vec2(t * 0.004, 0.0);
  vec3 cloudTex = texture2D(uSky, su).rgb;

  // Bordas finas (densidade baixa) recebem a luz de trás; o miolo fica escuro
  float rim = 1.0 - smoothstep(cut + 0.02, cut + 0.26, n);
  vec3 behind = texture2D(uLight, uv).rgb * uLightIntensity;
  float texLum = dot(cloudTex, vec3(0.33));
  vec3 col = cloudTex * 0.9 + behind * (rim * uGlow * (0.9 + texLum * 6.0) + 0.05);

  gl_FragColor = vec4(col, alpha);
}`;

type Props = {
  scene: SceneUniforms;
  light: Texture;
  sky: Texture;
  renderOrder: number;
};

export function FrontCloudLayer({ scene, light, sky, renderOrder }: Props) {
  const uniforms = useMemo(() => {
    const c = HERO_CONFIG.frontClouds;
    const L = HERO_CONFIG.light;
    const img = light.image as HTMLImageElement;
    return {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uRes: { value: new Vector2(1, 1) },
      uLight: { value: light },
      uSky: { value: sky },
      uImgSize: { value: new Vector2(img.width, img.height) },
      uSource: { value: new Vector2(...L.source) },
      uArea: { value: new Vector2(...c.area) },
      uAmount: { value: c.amount },
      uOpacity: { value: c.opacity },
      uSize: { value: c.size },
      uSpeed: { value: c.speed },
      uGlow: { value: L.enabled ? c.glow : 0 },
      uLightIntensity: { value: L.intensity },
    };
  }, [light, sky]);

  const baseGlow = uniforms.uGlow.value;
  const material = useSceneMaterial(scene, (u) => {
    u.uGlow.value = baseGlow * (diveState.active ? 1 - diveFrame(diveState.progress).beamOut : 1);
  });

  return (
    <mesh frustumCulled={false} renderOrder={renderOrder}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={fullscreenVertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
