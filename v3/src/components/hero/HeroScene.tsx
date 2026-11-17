import { useMemo } from "react";
import { Vector2 } from "three";
import { HERO_ASSETS, HERO_CONFIG } from "./config";
import { useRawTextures, useSceneUniforms } from "./sceneState";
import { SkyLayer } from "./layers/SkyLayer";
import { LightLayer } from "./layers/LightLayer";
import { FrontCloudLayer } from "./layers/FrontCloudLayer";
import { ComponentsLayer } from "./layers/ComponentsLayer";
import { SpiralLayer } from "./layers/SpiralLayer";
import { PersonLayer } from "./layers/PersonLayer";
import { DimLayer } from "./layers/DimLayer";

// Camadas do hero, de trás para a frente. Para adicionar uma camada nova
// (texto, botões 3D...), crie um componente em ./layers e coloque aqui na ordem.
export function HeroScene() {
  const scene = useSceneUniforms();
  const [sky, cloudMask, person, light, compStatic, compPanels, compShade, atlas, atlasShade] = useRawTextures([
    HERO_ASSETS.sky,
    HERO_ASSETS.cloudMask,
    HERO_ASSETS.person,
    HERO_ASSETS.light,
    HERO_ASSETS.componentsStatic,
    HERO_ASSETS.componentsPanels,
    HERO_ASSETS.componentsShade,
    HERO_ASSETS.spiralAtlas,
    HERO_ASSETS.spiralAtlasShade,
  ]);
  const imgSize = useMemo(() => {
    const img = sky.image as HTMLImageElement;
    return new Vector2(img.width, img.height);
  }, [sky]);

  return (
    <>
      <SkyLayer scene={scene} image={sky} mask={cloudMask} renderOrder={0} />
      {HERO_CONFIG.light.enabled && (
        <LightLayer scene={scene} image={light} renderOrder={1} />
      )}
      {HERO_CONFIG.frontClouds.enabled && (
        <FrontCloudLayer scene={scene} light={light} sky={sky} renderOrder={2} />
      )}
      {/* escurece o céu na transição para o "Sobre" (os cartões ficam por cima) */}
      <DimLayer renderOrder={5} />
      {HERO_CONFIG.components.enabled && HERO_CONFIG.components.mode === "spiral" && (
        <SpiralLayer
          scene={scene}
          panels={atlas}
          shade={atlasShade}
          imgSize={imgSize}
          compAspect={(compPanels.image as HTMLImageElement).width / (compPanels.image as HTMLImageElement).height}
          renderOrder={10}
        />
      )}
      {HERO_CONFIG.components.enabled && HERO_CONFIG.components.mode === "static" && (
        <ComponentsLayer
          scene={scene}
          staticGlow={compStatic}
          panels={compPanels}
          shade={compShade}
          imgSize={imgSize}
          renderOrder={3}
        />
      )}
      <PersonLayer scene={scene} image={person} renderOrder={100} />
    </>
  );
}
