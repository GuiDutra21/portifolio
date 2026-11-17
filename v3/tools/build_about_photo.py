"""Gera public/about/photo.webp a partir de tools/source/foto_recorte.png
(a foto já sem fundo, com transparência).

A foto fica crua (cores originais). O único ajuste é o escurecimento da parte
de baixo, para a pessoa parecer flutuar no escuro (o site ainda esfuma a borda
de baixo com uma máscara, em About.module.css).

Uso (dentro de v3/):  python tools/build_about_photo.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source" / "foto_recorte.png"
OUT = ROOT / "public" / "about" / "photo.webp"
OUT_SIZE = (900, 1200)

# ===== Escurecimento embaixo =====
BOTTOM_START = 0.62  # a partir de que altura começa a escurecer (0 = topo, 1 = base)
BOTTOM_DARK = 0.85  # quanto escurece na base (0 = nada, 1 = preto)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def main():
    rgba = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32) / 255.0
    img, alpha = rgba[..., :3], rgba[..., 3]
    h = img.shape[0]
    v = (np.arange(h, dtype=np.float32) / h)[:, None, None]

    # escurece em luz linear (como antes), e volta para sRGB
    lin = img**2.2
    lin *= 1.0 - BOTTOM_DARK * smoothstep(BOTTOM_START, 1.0, v)
    out = np.clip(lin, 0, 1) ** (1 / 2.2)

    result = np.dstack([out, alpha])
    im = Image.fromarray((result * 255).astype(np.uint8), "RGBA").resize(OUT_SIZE, Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "WEBP", quality=90, method=6)
    print(f"ok: {OUT.relative_to(ROOT)} {im.size}")


if __name__ == "__main__":
    main()
