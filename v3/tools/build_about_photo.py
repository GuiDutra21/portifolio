"""Gera as fotos do "Sobre" (public/about/), com transparência:

- photo.webp    ← tools/source/foto_recorte.png (a foto já sem fundo, 688x918)
- photo-hd.webp ← tools/source/foto_minha.jpeg (a original, 1200x1600, mais
  nítida), recortada com o mesmo recorte da foto_recorte.png (é a mesma foto,
  então o recorte dela serve de máscara, ampliado)

Qual delas aparece no site: `photo` em src/components/about/config.ts.

As fotos ficam cruas (cores originais). O único ajuste é o escurecimento da
parte de baixo, para a pessoa parecer flutuar no escuro (o site ainda esfuma a
borda de baixo com uma máscara, em About.module.css).

Uso (dentro de v3/):  python tools/build_about_photo.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools" / "source"
CUTOUT = SOURCE / "foto_recorte.png"
ORIGINAL = SOURCE / "foto_minha.jpeg"
OUT_DIR = ROOT / "public" / "about"

# ===== Escurecimento embaixo =====
BOTTOM_START = 0.62  # a partir de que altura começa a escurecer (0 = topo, 1 = base)
BOTTOM_DARK = 0.85  # quanto escurece na base (0 = nada, 1 = preto)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def finish(img, alpha, out, size):
    """img: RGB 0..1, alpha: 0..1 (mesmo tamanho). Escurece embaixo e salva."""
    h = img.shape[0]
    v = (np.arange(h, dtype=np.float32) / h)[:, None, None]
    # escurece em luz linear, e volta para sRGB
    lin = img**2.2
    lin *= 1.0 - BOTTOM_DARK * smoothstep(BOTTOM_START, 1.0, v)
    rgb = np.clip(lin, 0, 1) ** (1 / 2.2)
    result = np.dstack([rgb, alpha])
    im = Image.fromarray((result * 255).astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    im.save(out, "WEBP", quality=92, method=6)
    print(f"ok: {out.relative_to(ROOT)} {im.size}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cut = Image.open(CUTOUT).convert("RGBA")

    # 1) a recortada (como antes)
    rgba = np.asarray(cut).astype(np.float32) / 255.0
    finish(rgba[..., :3], rgba[..., 3], OUT_DIR / "photo.webp", (900, 1200))

    # 2) a original em alta, com o recorte da de cima ampliado como máscara
    orig = Image.open(ORIGINAL).convert("RGB")
    mask = cut.getchannel("A").resize(orig.size, Image.BICUBIC)
    img = np.asarray(orig).astype(np.float32) / 255.0
    alpha = np.asarray(mask).astype(np.float32) / 255.0
    # a borda ampliada fica um pouco mole: firma de leve (sem serrilhar)
    alpha = smoothstep(0.08, 0.92, alpha)
    finish(img, alpha, OUT_DIR / "photo-hd.webp", orig.size)


if __name__ == "__main__":
    main()
