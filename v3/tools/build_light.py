"""Extrai a coluna de luz da cena original (a mesma da V2) e encaixa no céu da V3.
Rodar de dentro de v3/:  python tools/build_light.py

Entradas (da V2):
  ../v2/assets/background.png   cena original completa (céu, luz, pessoa, chão)
  ../v2/assets/person.png       recorte da pessoa (só o alfa é usado)
Saída:
  public/hero/light-layer.png   só a luz, sobre preto, no enquadramento de
                                public/hero/background-base.png -> somada à cena

Método (igual à V2): estima como seria o céu sem a luz, interpolando o céu dos
dois lados da coluna e emprestando a textura vizinha; o que a cena original
tem de mais claro que isso, dentro da região da coluna, é a luz. Atrás da
pessoa, a luz é completada para continuar por trás dela.
"""
import numpy as np
import cv2
from PIL import Image
from scipy.ndimage import gaussian_filter, gaussian_filter1d

BEAM_CX = 0.502
HORIZON_SCENE = 796   # y do horizonte na cena original
HORIZON_BASE = 812    # y do horizonte no céu da V3

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

img8 = np.asarray(Image.open("../v2/assets/background.png").convert("RGB"))
img = img8.astype(np.float32)
H, W, _ = img.shape
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
yn = y / H

FEATHER = 60.0
HORIZON = int(0.88 * H)
half_px = np.interp(np.arange(H) / H, [0.0, 0.50, 0.78, 0.88, 1.0], [0.100, 0.100, 0.140, 0.165, 0.165]) * W
cxp = BEAM_CX * W
d_px = np.abs(x - cxp) - half_px[:, None]
# Diferente da V2: a região vai até o topo, então a abertura brilhante no
# céu (de onde a luz sai) também vem junto na camada.
region = 1 - smooth(0.0, FEATHER, d_px)

# tom geral do céu sem a luz: interpolado, linha a linha, dos dois lados
low = np.empty_like(img)
for row in range(H):
    xl = int(cxp - half_px[row] - FEATHER)
    xr = int(cxp + half_px[row] + FEATHER)
    left = np.percentile(img[row, xl - 130:xl - 10], 45, axis=0)
    right = np.percentile(img[row, xr + 10:xr + 130], 45, axis=0)
    tt = np.clip((np.arange(W) - xl) / max(xr - xl, 1), 0, 1)[:, None]
    low[row] = left * (1 - tt) + right * tt
low[:HORIZON] = gaussian_filter1d(low[:HORIZON], 26, axis=0, mode="nearest")
low[HORIZON:] = gaussian_filter1d(low[HORIZON:], 10, axis=0, mode="nearest")

# textura do céu vizinho (espelhada para dentro da coluna)
detail_all = img - gaussian_filter(img, sigma=(30, 30, 0))
detail = np.zeros_like(img)
cols = np.arange(W, dtype=np.float32)
for row in range(H):
    w = half_px[row] + FEATHER
    u = cols - cxp
    inside = np.abs(u) <= w
    ui = u[inside]
    xa = cxp + w + 30 + (ui + w)
    xb = cxp - w - 30 - (w - ui)
    xa = (W - 1 - np.abs(W - 1 - xa)).astype(int).clip(0, W - 1)
    xb = np.abs(xb).astype(int).clip(0, W - 1)
    wa = 1 - smooth(-0.25 * w, 0.25 * w, ui)
    norm = np.sqrt(wa ** 2 + (1 - wa) ** 2)
    detail[row, inside] = (detail_all[row, xa] * wa[:, None] + detail_all[row, xb] * (1 - wa)[:, None]) / norm[:, None]
synth = np.clip(low + detail, 0, 255)

light = np.clip(img - synth, 0, None) * region[..., None]

# completa a luz por trás da pessoa
alpha = np.asarray(Image.open("../v2/assets/person.png"))[..., 3].astype(np.float32) / 255
hole = (cv2.dilate((alpha > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0).astype(np.uint8)
light8 = cv2.inpaint(np.clip(light + 0.5, 0, 255).astype(np.uint8), hole, 6, cv2.INPAINT_TELEA)

# encaixe no céu da V3: estica na vertical para o horizonte bater (o topo fica no topo)
base = Image.open("public/hero/background-base.png")
BW, BH = base.size
new_h = round(H * HORIZON_BASE / HORIZON_SCENE)
stretched = Image.fromarray(light8).resize((W, new_h), Image.LANCZOS)
out = Image.new("RGB", (BW, BH), (0, 0, 0))
out.paste(stretched, (round((BW - W) / 2), 0))
out.save("public/hero/light-layer.png")

prev = np.clip(np.asarray(base.convert("RGB"), np.float32) + np.asarray(out, np.float32), 0, 255)
Image.fromarray(prev.astype(np.uint8)).save("tools/preview-light.jpg", quality=90)
print(f"ok: luz {W}x{H} -> esticada para {W}x{new_h}, colocada em {BW}x{BH}")
