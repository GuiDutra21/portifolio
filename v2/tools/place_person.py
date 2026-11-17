"""Encaixa a pessoa (recortada da cena completa) sobre o céu limpo.
Rodar de dentro de v2/:  python tools/place_person.py   (depois de build_assets.py)

assets/person.png (no enquadramento da cena completa) -> assets/person-layer.png
(no enquadramento de background-base.png). As duas imagens não têm o horizonte
na mesma altura, então a pessoa é deslocada para os pés pousarem no chão do céu novo.
"""
import numpy as np
from PIL import Image

# Horizonte (y em px) de cada imagem, medido nas laterais, longe da luz.
HORIZON_SCENE = 796      # assets/background.png
HORIZON_BASE = 812       # assets/background-base.png
CENTER_SHIFT_X = 0       # ajuste fino horizontal (px), se precisar

person = Image.open("assets/person.png").convert("RGBA")
base = Image.open("assets/background-base.png")
W, H = base.size
sw, sh = person.size

dx = round((W - sw) / 2) + CENTER_SHIFT_X
dy = HORIZON_BASE - HORIZON_SCENE
layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
layer.alpha_composite(person, (dx, dy))

# O recorte trouxe uma faixa fina do chão iluminado embaixo da mesa. Nas últimas
# linhas, só fica o que continua algo de cima (pés da mesa, cadeira, lixeira,
# mochila); a faixa horizontal solta sai.
arr = np.asarray(layer).copy()
alpha = arr[..., 3].astype(np.float32) / 255
rows = np.nonzero(alpha.max(axis=1) > 0.03)[0]
bottom = rows.max()
BAND, LOOK = 10, 12
for y in range(bottom - BAND, bottom + 1):
    above = alpha[y - LOOK]
    alpha[y] *= np.clip((above - 0.3) / 0.4, 0, 1)
arr[..., 3] = (alpha * 255 + 0.5).astype(np.uint8)
layer = Image.fromarray(arr, "RGBA")
layer.save("assets/person-layer.png")

# prévia estática
comp = base.convert("RGBA")
comp.alpha_composite(layer)
comp.convert("RGB").save("assets/preview-person.jpg", quality=90)
a = np.asarray(layer)[..., 3]
ys, xs = np.nonzero(a > 8)
print(f"deslocamento dx={dx} dy={dy}; pessoa em x {xs.min()}..{xs.max()}, y {ys.min()}..{ys.max()} de {W}x{H}")
