import { useMemo } from "react";
import { Vector2, type Texture } from "three";
import { HERO_CONFIG } from "../config";
import { coverUv, fullscreenVertex } from "../glsl";
import { useSceneMaterial, type SceneUniforms } from "../sceneState";

// Pessoa, mesa e objetos (com transparência), parados sobre o céu.
// Sem a coluna de luz, viram silhueta: tons apagados e frios, com um resto de
// claridade no corpo e nas telas. uLight = 1 devolve a iluminação original.

const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uLight;

${coverUv}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImgSize);
  vec4 person = texture2D(uImage, uv);
  if (person.a < 0.002) discard;

  float pl = dot(person.rgb, vec3(0.2126, 0.7152, 0.0722));
  // as bordas do recorte carregam o brilho da luz que estava atrás: apagadas aqui
  float core = smoothstep(0.75, 1.0, person.a);
  vec3 silhouette = vec3(0.05, 0.06, 0.085) + pl * pl * core * vec3(0.55, 0.62, 0.85);
  vec3 color = mix(silhouette, person.rgb, uLight);

  gl_FragColor = vec4(color, person.a);
}`;

type Props = {
  scene: SceneUniforms;
  image: Texture;
  renderOrder: number;
};

export function PersonLayer({ scene, image, renderOrder }: Props) {
  const uniforms = useMemo(() => {
    const img = image.image as HTMLImageElement;
    return {
      uRes: { value: new Vector2(1, 1) },
      uImage: { value: image },
      uImgSize: { value: new Vector2(img.width, img.height) },
      // Sem a coluna de luz, a pessoa fica em silhueta
      uLight: { value: HERO_CONFIG.light.enabled ? HERO_CONFIG.person.light : 0 },
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
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
