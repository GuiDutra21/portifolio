"""Gera a camada da mesa e da pessoa (public/hero/) a partir de
tools/source/mesa_nova.png (a arte nova: mesa, pessoa e objetos sobre preto).

Saídas (um recorte só da região da mesa, em alta, para o zoom ficar nítido):
  public/hero/person-hd.webp    objetos com transparência (pessoa, cadeira,
                                monitores, mesa, lixeira, mochila)
  public/hero/person-glow.webp  a luz da arte (brilho do chão e embaixo da
                                mesa), sobre preto: é SOMADA por cima do céu
  src/components/hero/person.json  onde o recorte fica na imagem do céu

Recorte: o fundo preto é o que se liga à borda da imagem por pixels escuros
(o contorno iluminado da pessoa e da mesa segura); os vãos pretos embaixo da
mesa também são fundo; o chão iluminado vira luz.

Uso (na raiz do repositório):  python tools/build_person.py
"""

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source" / "mesa_nova.png"
OUT_DIR = ROOT / "public" / "hero"
OUT_JSON = ROOT / "src" / "components" / "hero" / "person.json"

SKY_SIZE = (1761, 893)  # public/hero/background-base.png

# ===== Encaixe na cena (px da arte nova -> px da imagem do céu) =====
# Mesmo lugar e tamanho da mesa antiga: borda esquerda do tampo e pé da mesa.
SCALE = 0.41
ANCHOR_ART = (628, 785)  # canto esquerdo do tampo (x) e pé da mesa (y), na arte nova
ANCHOR_SKY = (778, 824.5)  # onde isso fica na imagem do céu

CROP = (420, 460, 1350, 887)  # região da arte usada (inclui o brilho do chão)
FLOOR_Y = 772  # abaixo daqui, só o que é bem escuro (rodinhas, sapatos) é objeto; o resto é luz do chão
FLOOR_CUT = 798  # abaixo daqui, tudo é chão (reflexos escuros incluídos)


def main():
    im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
    H, W = im.shape[:2]
    lum = cv2.GaussianBlur(im @ np.array([0.2126, 0.7152, 0.0722], np.float32), (0, 0), 1.0)

    # 1) fundo: pixels escuros ligados à borda
    dark = (lum < 10).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # 2) vãos bem pretos e grandes, fechados (embaixo da mesa)
    for i in range(1, n):
        if i in border:
            continue
        m = lab == i
        if st[i, cv2.CC_STAT_AREA] > 2000 and lum[m].mean() < 1.5:
            bg |= m
    # 3) chão
    yy = np.arange(H)[:, None]
    bg |= ((yy > FLOOR_Y) & (lum >= 10)) | (yy > FLOOR_CUT)

    obj = cv2.morphologyEx((~bg).astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    alpha = np.clip(cv2.GaussianBlur(obj.astype(np.float32), (0, 0), 0.7), 0, 1)

    x0, y0, x1, y1 = CROP
    rgb = im[y0:y1, x0:x1]
    a = alpha[y0:y1, x0:x1]
    obj_rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    glow = (rgb * (1 - a)[..., None]).astype(np.uint8)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(obj_rgba, "RGBA").save(OUT_DIR / "person-hd.webp", "WEBP", quality=92, method=6)
    Image.fromarray(glow, "RGB").save(OUT_DIR / "person-glow.webp", "WEBP", quality=90, method=6)

    # onde o recorte fica na imagem do céu (frações, de cima para baixo)
    def to_sky(x, y):
        sx = ANCHOR_SKY[0] + (x - ANCHOR_ART[0]) * SCALE
        sy = ANCHOR_SKY[1] + (y - ANCHOR_ART[1]) * SCALE
        return sx / SKY_SIZE[0], sy / SKY_SIZE[1]

    rx0, ry0 = to_sky(x0, y0)
    rx1, ry1 = to_sky(x1, y1)
    OUT_JSON.write_text(json.dumps({"rect": [round(v, 6) for v in (rx0, ry0, rx1, ry1)]}, indent=2) + "\n")
    print(f"ok: recorte {x1 - x0}x{y1 - y0}, rect na cena {rx0:.4f},{ry0:.4f} -> {rx1:.4f},{ry1:.4f}")


if __name__ == "__main__":
    main()
