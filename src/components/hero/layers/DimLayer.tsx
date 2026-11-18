import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { fullscreenVertex } from "../glsl";
import { diveFrame, diveState, monitorFrame } from "../dive";

// Véu escuro sobre o céu e o feixe, na transição para o "Sobre".
// Fica ABAIXO da espiral: os cartões em voo continuam acesos.

const fragment = /* glsl */ `
varying vec2 vUv;
uniform float uDim;
void main() {
  // um pouco mais leve embaixo, onde está a pessoa
  float a = uDim * mix(0.82, 1.0, smoothstep(0.0, 0.35, vUv.y));
  gl_FragColor = vec4(0.02, 0.027, 0.047, a);
}`;

export function DimLayer({ renderOrder }: { renderOrder: number }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uDim: { value: 0 } }), []);

  useFrame(() => {
    const u = material.current?.uniforms;
    if (!u) return;
    // (transição p/ projetos) a cena volta a ser como na primeira tela
    u.uDim.value = diveState.active
      ? diveFrame(diveState.progress).dim * (1 - monitorFrame(diveState.monitor).sceneIn)
      : 0;
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
