"""Separa os painéis da espiral para cada um flutuar sozinho.
Rodar de dentro de v3/:  python tools/build_panels.py

Entradas:
  public/hero/components-glow.png    espiral + painéis (luz)
  ../v2/assets/components-shade.png  sombra dos painéis que já têm placa
Saídas:
  public/hero/components-shade.png   sombra de todos os painéis (inclui as
                                     placas novas do celular e do banco)
  public/hero/components-static.png  espiral SEM os painéis (buracos preenchidos)
  public/hero/components-panels.png  só os painéis, sobre preto
  public/hero/spiral-atlas.png       folha da espiral 3D: cada painel isolado no
  public/hero/spiral-atlas-shade.png seu espaço (sem pedaços dos vizinhos), com a sombra
  src/components/hero/panels.json    retângulo de cada painel (frações da imagem)
                                     e onde ele está na folha (atlas)

As áreas dos painéis são desenhadas à mão (coordenadas em px da imagem 820x932).
"""
import json
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

PANELS = {
    "html":    [(355, 147), (436, 132), (437, 188), (356, 204)],   # </>
    "code":    [(363, 231), (551, 294), (551, 409), (363, 372)],   # janela de código
    "github":  [(248, 405), (326, 400), (326, 472), (249, 478)],
    "phone":   [(564, 424), (628, 424), (628, 520), (564, 520)],   # placa nova
    "diagram": [(370, 490), (563, 525), (563, 637), (370, 624)],
    "mini":    [(245, 570), (342, 581), (342, 657), (246, 650)],   # mini código
    "db":      [(574, 592), (636, 592), (636, 657), (574, 657)],   # banco de dados (placa nova)
}
GROW = 6  # px a mais em volta de cada painel, para levar a borda brilhante junto
EDGE_BAND = 9  # px de preenchimento em volta (o painel nunca se move mais que isso)

glow = np.asarray(Image.open("public/hero/components-glow.png").convert("RGB"))
H, W, _ = glow.shape

# ---------- placas novas (celular e banco não tinham placa na arte) ----------
# Placa escura com cantos arredondados + borda dourada fina com brilho, no
# estilo das placas que já existiam (GitHub, </>).
PLATES = ["phone", "db"]
PLATE_RADIUS = 6
BORDER_COLOR = np.array([255, 158, 70], np.float32)
S2 = 4
plate_fill = Image.new("L", (W * S2, H * S2), 0)
plate_line = Image.new("L", (W * S2, H * S2), 0)
df, dl = ImageDraw.Draw(plate_fill), ImageDraw.Draw(plate_line)
for name in PLATES:
    xs = [p[0] for p in PANELS[name]]; ys = [p[1] for p in PANELS[name]]
    box = [min(xs) * S2, min(ys) * S2, max(xs) * S2, max(ys) * S2]
    df.rounded_rectangle(box, radius=PLATE_RADIUS * S2, fill=255)
    dl.rounded_rectangle(box, radius=PLATE_RADIUS * S2, outline=255, width=int(1.6 * S2))
plate_fill = plate_fill.resize((W, H), Image.LANCZOS)
line = np.asarray(plate_line.resize((W, H), Image.LANCZOS), np.float32) / 255
halo = np.asarray(Image.fromarray((line * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
border = (line * 0.85 + halo * 0.9)[..., None] * BORDER_COLOR
glow = np.clip(glow.astype(np.float32) + border, 0, 255).astype(np.uint8)

shade = np.asarray(Image.open("../v2/assets/components-shade.png").convert("L"), np.float32)
shade = np.maximum(shade, np.asarray(plate_fill, np.float32))
Image.fromarray(shade.astype(np.uint8)).save("public/hero/components-shade.png")

S = 4
big = Image.new("L", (W * S, H * S), 0)
d = ImageDraw.Draw(big)
for poly in PANELS.values():
    d.polygon([(x * S, y * S) for x, y in poly], fill=255)
mask = big.resize((W, H), Image.LANCZOS)
mask = mask.filter(ImageFilter.MaxFilter(GROW * 2 + 1)).filter(ImageFilter.GaussianBlur(1.5))
m = np.asarray(mask, np.float32) / 255

panels = (glow.astype(np.float32) * m[..., None] + 0.5).astype(np.uint8)
hole = (m > 0.02).astype(np.uint8)
static = cv2.inpaint(glow, hole, 7, cv2.INPAINT_TELEA)
# Só uma faixa fina perto da borda fica à mostra quando o painel se mexe;
# o miolo fica vazio (senão o preenchimento borrado apareceria pelas janelas).
interior = cv2.erode(hole, np.ones((2 * EDGE_BAND + 1, 2 * EDGE_BAND + 1), np.uint8))
interior = cv2.GaussianBlur(interior.astype(np.float32), (0, 0), 2.0)
static = (static.astype(np.float32) * (1 - interior[..., None]) + 0.5).astype(np.uint8)

Image.fromarray(panels).save("public/hero/components-panels.png")
Image.fromarray(static).save("public/hero/components-static.png")

# ---------- folha (atlas) da espiral 3D ----------
# Cada painel recortado só com a PRÓPRIA máscara, lado a lado, sem sobreposição.
shade_f = shade / 255
ATLAS_W, GAP = 1024, 6
cells, x, y, row_h = [], GAP, GAP, 0
for name, poly in PANELS.items():
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    pad = GROW + 4
    x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
    w, h = x1 - x0, y1 - y0
    if x + w + GAP > ATLAS_W:
        x, y, row_h = GAP, y + row_h + GAP, 0
    cells.append((name, poly, (x0, y0, x1, y1), (x, y)))
    x += w + GAP
    row_h = max(row_h, h)
ATLAS_H = y + row_h + GAP
atlas = np.zeros((ATLAS_H, ATLAS_W, 3), np.float32)
atlas_shade = np.zeros((ATLAS_H, ATLAS_W), np.float32)
atlas_rects = {}
for name, poly, (x0, y0, x1, y1), (ax, ay) in cells:
    own = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(own).polygon([(px * S, py * S) for px, py in poly], fill=255)
    own = own.resize((W, H), Image.LANCZOS).filter(ImageFilter.MaxFilter(GROW * 2 + 1)).filter(ImageFilter.GaussianBlur(1.5))
    mo = np.asarray(own, np.float32)[y0:y1, x0:x1] / 255
    atlas[ay:ay + (y1 - y0), ax:ax + (x1 - x0)] = glow[y0:y1, x0:x1].astype(np.float32) * mo[..., None]
    atlas_shade[ay:ay + (y1 - y0), ax:ax + (x1 - x0)] = shade_f[y0:y1, x0:x1] * mo
    atlas_rects[name] = [round(ax / ATLAS_W, 5), round(ay / ATLAS_H, 5),
                         round((ax + x1 - x0) / ATLAS_W, 5), round((ay + y1 - y0) / ATLAS_H, 5)]
Image.fromarray((atlas + 0.5).astype(np.uint8)).save("public/hero/spiral-atlas.png")
Image.fromarray((atlas_shade * 255 + 0.5).astype(np.uint8)).save("public/hero/spiral-atlas-shade.png")

rects = []
for name, poly in PANELS.items():
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    pad = GROW + 4
    rects.append({"name": name, "atlas": atlas_rects[name],
                  "rect": [round((min(xs) - pad) / W, 4), round((min(ys) - pad) / H, 4),
                           round((max(xs) + pad) / W, 4), round((max(ys) + pad) / H, 4)]})
json.dump(rects, open("src/components/hero/panels.json", "w"), indent=2)
print(f"ok: {len(rects)} painéis")
