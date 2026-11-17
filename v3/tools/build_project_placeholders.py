"""Gera imagens PROVISÓRIAS para os cartões de projetos (public/projects/).

São capas abstratas só para mostrar o layout: um "print" de interface, de
ponta a ponta, com linhas de código, um gráfico e blocos.
Troque pelos prints reais dos projetos (mesmo nome de arquivo, ou mude o
caminho em src/components/projects/content.ts).

Uso (dentro de v3/):  python tools/build_project_placeholders.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "projects"
SIZE = (1600, 1200)

# cor de destaque de cada capa (R, G, B)
PALETTES = [
    (247, 170, 90),  # âmbar
    (90, 200, 190),  # verde-água
    (150, 130, 245),  # violeta
    (235, 95, 110),  # coral
]


def background(accent, seed):
    w, h = SIZE
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    base = np.array([11, 14, 23], np.float32)
    img = np.ones((h, w, 3), np.float32) * base
    for _ in range(3):  # manchas de luz
        cx, cy = rng.uniform(0.15, 0.85), rng.uniform(0.1, 0.9)
        r = rng.uniform(0.25, 0.5)
        g = np.exp(-(((u - cx) / r) ** 2 + ((v - cy) / (r * 1.2)) ** 2))
        img += g[..., None] * np.array(accent, np.float32) * rng.uniform(0.25, 0.45)
    img += rng.normal(0, 3, img.shape[:2])[..., None]  # grão
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def ui(draw, accent, seed):
    rng = np.random.default_rng(seed + 100)
    w, h = SIZE
    a = tuple(accent)
    dim = tuple(int(c * 0.45) for c in accent)
    # a interface ocupa a imagem toda (como um print); o conteúdo fica no
    # miolo, que é o que aparece no cartão em pé
    draw.rectangle((0, 0, w, h), fill=(14, 18, 30))
    draw.rectangle((0, 0, w, 56), fill=(20, 25, 40))
    x0, y0, x1, y1 = int(w * 0.2), 0, int(w * 0.8), int(h * 0.96)
    for i, c in enumerate([(235, 95, 90), (240, 190, 80), (110, 200, 120)]):
        draw.ellipse((x0 + i * 36, 18, x0 + 20 + i * 36, 38), fill=c)
    # coluna de código
    cy = y0 + 120
    for _ in range(14):
        indent = int(rng.integers(0, 4)) * 36
        length = int(rng.uniform(0.08, 0.2) * w)
        color = a if rng.random() < 0.3 else (90, 100, 125)
        draw.rounded_rectangle((x0 + 50 + indent, cy, x0 + 50 + indent + length, cy + 16), 8, fill=color)
        cy += 40
    # gráfico
    gx0, gy0, gx1, gy1 = int(w * 0.52), y0 + 120, x1, int(h * 0.55)
    draw.rounded_rectangle((gx0, gy0, gx1, gy1), 18, fill=(18, 23, 38))
    pts, n = [], 9
    vals = np.cumsum(rng.normal(0, 1, n)) + 4
    vals = (vals - vals.min()) / (np.ptp(vals) or 1)
    for i, val in enumerate(vals):
        pts.append((gx0 + 30 + i * (gx1 - gx0 - 60) / (n - 1), gy1 - 30 - val * (gy1 - gy0 - 60)))
    draw.line(pts, fill=a, width=7, joint="curve")
    # blocos
    by = int(h * 0.6)
    for i in range(3):
        bx = gx0 + i * ((gx1 - gx0) // 3)
        draw.rounded_rectangle((bx + 6, by, bx + (gx1 - gx0) // 3 - 6, y1 - 50), 16,
                               fill=(18, 23, 38), outline=dim if i else a, width=3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, accent in enumerate(PALETTES):
        img = background(accent, i)
        glow = Image.new("RGB", SIZE, (0, 0, 0))
        ui(ImageDraw.Draw(glow), accent, i)
        # um leve brilho em volta da interface
        img = Image.blend(img, Image.composite(glow, img, glow.convert("L").point(lambda v: 255 if v > 8 else 0)), 1.0)
        halo = glow.filter(ImageFilter.GaussianBlur(40))
        img = Image.fromarray(np.clip(np.asarray(img, np.float32) + np.asarray(halo, np.float32) * 0.25, 0, 255).astype(np.uint8))
        path = OUT / f"projeto-{i + 1}.webp"
        img.save(path, "WEBP", quality=86, method=6)
        print("ok:", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
