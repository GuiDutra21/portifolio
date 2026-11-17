import { useMemo } from "react";
import {
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Vector2,
  Vector4,
  type Texture,
} from "three";
import { HERO_CONFIG } from "../config";
import PANELS from "../panels.json";
import { coverUv, fullscreenVertex } from "../glsl";
import { useSceneMaterial, type SceneUniforms } from "../sceneState";

// Espiral com os painéis (as mesmas imagens da V2, separadas por
// tools/build_panels.py):
//  - components-static.png: a espiral sem os painéis;
//  - components-panels.png: os painéis; cada um flutua sozinho, no seu ritmo,
//    dentro do seu retângulo (panels.json);
//  - components-shade.png: o interior de cada painel escurece o que está atrás
//    (acompanha o painel), para o conteúdo ficar legível sobre o feixe.
// Além disso: o conjunto flutua junto, o brilho respira, uma faixa de luz
// sobe pela espiral e tudo segue o mouse de leve.
//
// Mistura num passe só: resultado = brilho + fundo × (1 − sombra).

const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uStatic;
uniform sampler2D uPanels;
uniform sampler2D uShade;
uniform vec4 uRects[PANEL_COUNT];   // xmin, ymin, xmax, ymax (frações da imagem)
uniform float uPanelFloat;
uniform float uPanelSpeed;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform vec2 uPointer;
uniform float uMotion;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uIntensity;
uniform float uSpeed;
uniform float uParallax;
uniform float uFloat;
uniform float uShadeAmount;
uniform float uPulse;
uniform float uSweep;

${coverUv}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImgSize);
  float t = uTime * uSpeed;

  vec2 shift = uPointer * uParallax + vec2(0.0, sin(t * 0.55) * uFloat) * uMotion;
  vec2 cu = (uv - uCenter - shift) / uSize + 0.5;
  if (cu.x <= 0.0 || cu.x >= 1.0 || cu.y <= 0.0 || cu.y >= 1.0) discard;

  vec3 glow = texture2D(uStatic, cu).rgb;
  float shade = 0.0;

  // Cada painel flutua sozinho: ritmo e fase próprios, mais vertical que lateral
  float pt = uTime * uPanelSpeed * uMotion;
  for (int i = 0; i < PANEL_COUNT; i++) {
    float fi = float(i);
    vec2 off = vec2(
      sin(pt * (0.47 + 0.07 * fi) + fi * 2.3) * 0.35,
      sin(pt * (0.61 + 0.05 * fi) + fi * 1.7)
    ) * uPanelFloat;
    vec2 p = cu - off;
    vec4 r = uRects[i];
    float inside = step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
    glow += texture2D(uPanels, p).rgb * inside;
    shade = max(shade, texture2D(uShade, p).r * inside);
  }
  shade *= uShadeAmount;

  // brilho respirando + uma faixa de luz que sobe pela espiral
  float band = fract(t * 0.11);
  float sweep = smoothstep(0.16, 0.0, abs((1.0 - cu.y) - (band * 1.4 - 0.2)));
  float gain = 1.0 + (sin(t * 1.2) * uPulse + sweep * uSweep) * uMotion;

  gl_FragColor = vec4(glow * gain * uIntensity, shade);
}`;

type Props = {
  scene: SceneUniforms;
  staticGlow: Texture;
  panels: Texture;
  shade: Texture;
  imgSize: Vector2;
  renderOrder: number;
};

export function ComponentsLayer({ scene, staticGlow, panels, shade, imgSize, renderOrder }: Props) {
  const uniforms = useMemo(() => {
    const c = HERO_CONFIG.components;
    const g = staticGlow.image as HTMLImageElement;
    // largura em UV do fundo, preservando a proporção da espiral
    const width = c.height * (imgSize.y / imgSize.x) * (g.width / g.height);
    return {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uPointer: { value: new Vector2() },
      uRes: { value: new Vector2(1, 1) },
      uStatic: { value: staticGlow },
      uPanels: { value: panels },
      uRects: { value: PANELS.map((p) => new Vector4(...p.rect)) },
      uPanelFloat: { value: c.panelFloat },
      uPanelSpeed: { value: c.panelSpeed * c.speed },
      uShade: { value: shade },
      uImgSize: { value: imgSize },
      uCenter: { value: new Vector2(...c.center) },
      uSize: { value: new Vector2(width, c.height) },
      uIntensity: { value: c.intensity },
      uSpeed: { value: c.speed },
      uParallax: { value: c.parallax },
      uFloat: { value: c.float },
      uShadeAmount: { value: c.shade },
      uPulse: { value: c.pulse },
      uSweep: { value: c.sweep },
    };
  }, [staticGlow, panels, shade, imgSize]);

  const material = useSceneMaterial(scene);

  return (
    <mesh frustumCulled={false} renderOrder={renderOrder}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={fullscreenVertex}
        fragmentShader={fragment}
        defines={{ PANEL_COUNT: PANELS.length }}
        uniforms={uniforms}
        transparent
        blending={CustomBlending}
        blendSrc={OneFactor}
        blendDst={OneMinusSrcAlphaFactor}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
