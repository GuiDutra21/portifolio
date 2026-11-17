"""Gera assets/cloud-mask.png: branco = nuvem (anima), preto = fixo.
Uso: python tools/make_cloud_mask.py  [--preview]"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src = Image.open("assets/hero.png").convert("RGB")
W, H = src.size
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
xn, yn = x / W, y / H

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

# Zona das nuvens: metade de cima, sumindo antes do horizonte
mask = 1 - smooth(0.52, 0.68, yn)

# Cone do feixe de luz (protege raios + painéis), abre a partir do topo
cx = 0.495
half = 0.045 + (yn - 0.16) * 0.11          # largura do cone cresce pra baixo
dist = np.abs(xn - cx) - np.maximum(half, 0.0)
cone = (1 - smooth(-0.015, 0.06, dist)) * smooth(0.13, 0.22, yn)
mask *= 1 - cone

# Bloco dos painéis flutuantes (inclui ícones laterais)
px = smooth(0.405, 0.385, xn) + smooth(0.595, 0.615, xn)   # fora em x
py = smooth(0.26, 0.24, yn) + smooth(0.70, 0.73, yn)        # fora em y
panels = 1 - np.clip(px + py, 0, 1)
mask *= 1 - panels

img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), "L")
img = img.filter(ImageFilter.GaussianBlur(10))
img.save("assets/cloud-mask.png")

if "--preview" in sys.argv:
    m = np.asarray(img, np.float32)[..., None] / 255
    s = np.asarray(src, np.float32)
    tint = s * (1 - m * 0.6) + np.array([255, 0, 120]) * m * 0.6
    Image.fromarray(tint.astype(np.uint8)).save(sys.argv[-1])
print("ok", W, H)
