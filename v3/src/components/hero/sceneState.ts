import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  LinearFilter,
  NoColorSpace,
  TextureLoader,
  Vector2,
  type ShaderMaterial,
  type Texture,
} from "three";
import { HERO_CONFIG } from "./config";

// Estado compartilhado por todas as camadas: tempo, ponteiro suavizado e
// resolução, atualizados a cada frame sem re-render do React. Cada camada
// copia esses valores para o próprio material com useSyncSceneUniforms.
export type SceneUniforms = {
  uTime: { value: number };
  uPointer: { value: Vector2 };
  uRes: { value: Vector2 };
  uMotion: { value: number };
};

// Só em desenvolvimento: abrir a página com ?t=12 congela a cena no segundo 12.
// Serve para capturar instantes exatos e comparar o movimento entre eles.
const debugTime = import.meta.env.DEV
  ? Number(new URLSearchParams(window.location.search).get("t") ?? NaN)
  : NaN;

function createUniforms(): SceneUniforms {
  return {
    uTime: { value: 0 },
    uPointer: { value: new Vector2() },
    uRes: { value: new Vector2(1, 1) },
    uMotion: { value: 1 },
  };
}

export function useSceneUniforms(): SceneUniforms {
  // Objeto estável criado uma vez; os valores dentro dele mudam a cada frame
  // (é assim que o three.js lê uniforms), sem passar pelo estado do React.
  const [uniforms] = useState(createUniforms);
  const uniformsRef = useRef(uniforms);

  // Alvo do ponteiro (-1..1, y para baixo) e instante do último movimento
  const target = useRef({ x: 0, y: 0, lastMove: -Infinity });
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      target.current.lastMove = performance.now();
    };
    const onLeave = () => {
      target.current.lastMove = -Infinity;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)"));

  useFrame((_, delta) => {
    const u = uniformsRef.current!;
    const tg = target.current;
    const frozen = !Number.isNaN(debugTime);
    const now = frozen ? debugTime * 1000 : performance.now();
    const t = now / 1000;
    const still = reducedMotion.current.matches;
    const { follow, idleAfterMs } = HERO_CONFIG.pointer;

    // Mouse parado → passeio lento automático
    if (!still && now - tg.lastMove > idleAfterMs) {
      tg.x = Math.sin(t * 0.11) * 0.55 + Math.sin(t * 0.037 + 2.0) * 0.25;
      tg.y = Math.sin(t * 0.083 + 1.3) * 0.35;
    }
    const k = frozen ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * follow);
    const p = u.uPointer.value;
    p.x += ((still ? 0 : tg.x) - p.x) * k;
    p.y += ((still ? 0 : tg.y) - p.y) * k;

    u.uTime.value = t;
    u.uMotion.value = still ? 0 : 1;
    gl.getDrawingBufferSize(u.uRes.value);
  });

  return uniforms;
}

// Devolve a ref para o <shaderMaterial> de uma camada e, a cada frame, copia
// o estado da cena para os uniforms dele (os que o shader declarar).
// É preciso copiar: o R3F recria os objetos de uniform ao montar o material,
// então números (uTime, uMotion) não ficam ligados ao estado compartilhado.
export function useSceneMaterial(scene: SceneUniforms): RefObject<ShaderMaterial | null> {
  const material = useRef<ShaderMaterial>(null);
  useFrame(() => {
    const u = material.current?.uniforms;
    if (!u) return;
    if (u.uTime) u.uTime.value = scene.uTime.value;
    if (u.uMotion) u.uMotion.value = scene.uMotion.value;
    if (u.uPointer) u.uPointer.value.copy(scene.uPointer.value);
    if (u.uRes) u.uRes.value.copy(scene.uRes.value);
  });
  return material;
}

// Ajusta a textura para uso "cru" nos shaders: sem conversão de cor, sem
// inverter o eixo y (os shaders trabalham com y para baixo) e sem mipmaps.
function prepareRawTexture(tex: Texture) {
  tex.colorSpace = NoColorSpace;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
}

export function useRawTextures(urls: string[]): Texture[] {
  const textures = useLoader(TextureLoader, urls);
  useLayoutEffect(() => {
    textures.forEach(prepareRawTexture);
  }, [textures]);
  return textures;
}
