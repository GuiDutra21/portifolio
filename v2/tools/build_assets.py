"""Prepara as camadas da V2 a partir das duas imagens originais.
Rodar de dentro de v2/:  python tools/build_assets.py

Entradas:
  assets/background.png            cena completa (nuvens, feixe, pessoa, chão) — de onde saem a luz e a pessoa
  assets/background-base.png       céu limpo (nuvens + chão), fornecido pronto. NÃO é gerado aqui.
  assets/components-original.png   espiral + painéis sobre fundo escuro
Saídas:
  assets/old/background-base-reconstructed.png   céu reconstruído a partir da cena completa (não usado)
  assets/light.png             só a coluna de luz + reflexo, sobre preto -> somada à cena
  assets/person.png            pessoa, mesa e objetos recortados (com transparência)
  assets/cloud-mask.png        branco = nuvem (anima), preto = fixo
  assets/components-glow.png   só a luz dos componentes (fundo escuro removido) -> somada à cena
  assets/components-shade.png  interior dos painéis -> escurece o fundo atrás deles
  assets/fallback.jpg          composição estática (sem WebGL)
"""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Posição dos componentes sobre o fundo (frações do fundo). Mesmo valor usado em js/scene.js.
LAYOUT = {"cx": 0.502, "cy": 0.4635, "h": 0.643}
SHADE_STRENGTH = 0.62

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

bg = Image.open("assets/background.png").convert("RGB")
W, H = bg.size
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
xn, yn = x / W, y / H
BEAM_CX = 0.502

# ---------- 0. separa o fundo em camadas ----------
# Camadas (de trás para a frente):  céu/chão  ->  luz (somada)  ->  pessoa
#   - background-base.png: a imagem sem a coluna de luz e sem a pessoa. Onde
#     elas estavam, o céu e o chão são RECONSTRUÍDOS: tom geral interpolado dos
#     dois lados + textura de nuvem/chão emprestada do céu vizinho.
#   - light.png: tudo o que a imagem original tem de mais claro que esse fundo,
#     dentro da região da coluna. Atrás da pessoa, a luz é completada.
#   - person.png: pessoa, mesa, monitores, lixeira e mochila, recortados (com alfa).
# Parada, a soma das camadas refaz a imagem original.
import cv2
from scipy.ndimage import gaussian_filter, gaussian_filter1d

img8 = np.asarray(bg)
img = img8.astype(np.float32)
FEATHER = 60.0
HORIZON = int(0.88 * H)
# meia-largura da região da coluna (px): reta no alto, abre perto do chão
half_px = np.interp(np.arange(H) / H, [0.0, 0.50, 0.78, 0.88, 1.0], [0.100, 0.100, 0.140, 0.165, 0.165]) * W
cxp = BEAM_CX * W
d_px = np.abs(x - cxp) - half_px[:, None]
region = (1 - smooth(0.0, FEATHER, d_px)) * smooth(0.10, 0.22, yn)

# --- 0a. recorte da pessoa ---
PX0, PX1, PY0, PY1 = int(0.431 * W), int(0.590 * W), int(0.753 * H), int(0.922 * H)
roi = img8[PY0:PY1, PX0:PX1]
lum = roi.astype(np.float32).max(axis=2)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (75, 75))
behind = cv2.morphologyEx(cv2.GaussianBlur(lum, (0, 0), 1.0), cv2.MORPH_CLOSE, kernel)
behind = cv2.GaussianBlur(behind, (0, 0), 8)
init = (lum / np.maximum(behind, 1)) < 0.72            # mais escuro que a luz ao redor
gc = np.where(init, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
gc[cv2.erode(init.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = cv2.GC_FGD
gc[:6, :] = cv2.GC_BGD; gc[:, :6] = cv2.GC_BGD; gc[:, -6:] = cv2.GC_BGD
cv2.grabCut(cv2.cvtColor(roi, cv2.COLOR_RGB2BGR), gc, None,
            np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
fg = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
fg = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.float32)
# abaixo dos pés é reflexo no chão, não pessoa
feet = int(0.913 * H) - PY0
fg *= 1 - smooth(feet, feet + 6, np.arange(fg.shape[0], dtype=np.float32))[:, None]
matte = np.zeros((H, W), np.float32)
matte[PY0:PY1, PX0:PX1] = cv2.GaussianBlur(fg, (0, 0), 0.7)
matte_wide = np.zeros((H, W), np.float32)
matte_wide[PY0:PY1, PX0:PX1] = cv2.GaussianBlur(cv2.dilate(fg, np.ones((9, 9), np.uint8)), (0, 0), 2.0)
matte_wide = np.clip(matte_wide * 1.3, 0, 1)

person = np.dstack([img8, (matte * 255 + 0.5).astype(np.uint8)])
Image.fromarray(person, "RGBA").save("assets/person.png")

# --- 0b. céu/chão reconstruídos atrás da coluna ---
# tom geral: por linha, interpola o céu (parte mais escura) dos dois lados
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

# textura: os detalhes (nuvens, ondas do chão) do céu vizinho. A metade esquerda
# da coluna recebe a textura do lado direito e vice-versa, misturadas no meio —
# assim nenhuma nuvem aparece repetida logo ao lado de si mesma.
detail_all = img - gaussian_filter(img, sigma=(30, 30, 0))
detail = np.zeros_like(img)
cols = np.arange(W, dtype=np.float32)
for row in range(H):
    w = half_px[row] + FEATHER
    u = cols - cxp
    inside = np.abs(u) <= w
    ui = u[inside]
    xa = cxp + w + 30 + (ui + w)              # vem do céu à direita
    xb = cxp - w - 30 - (w - ui)              # vem do céu à esquerda
    xa = (W - 1 - np.abs(W - 1 - xa)).astype(int).clip(0, W - 1)
    xb = np.abs(xb).astype(int).clip(0, W - 1)
    wa = 1 - smooth(-0.25 * w, 0.25 * w, ui)
    norm = np.sqrt(wa ** 2 + (1 - wa) ** 2)
    detail[row, inside] = (detail_all[row, xa] * wa[:, None] + detail_all[row, xb] * (1 - wa)[:, None]) / norm[:, None]
synth = np.clip(low + detail, 0, 255)

light = np.clip(img - synth, 0, None) * region[..., None]
base = img - light
# onde estava a pessoa, entra o fundo reconstruído
base = base * (1 - matte_wide[..., None]) + synth * matte_wide[..., None]
# ... e a luz é completada por trás dela
hole = (matte_wide > 0.02).astype(np.uint8)
light8 = np.clip(light + 0.5, 0, 255).astype(np.uint8)
light8 = cv2.inpaint(light8, hole, 6, cv2.INPAINT_TELEA)

base8 = np.clip(base + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(base8).save("assets/old/background-base-reconstructed.png")
Image.fromarray(light8).save("assets/light.png")

# conferência: camadas somadas x imagem original
recomp = np.clip(base8.astype(np.float32) + light8, 0, 255)
recomp = recomp * (1 - matte[..., None]) + img * matte[..., None]
err = np.abs(recomp - img)
print("recomposição: erro médio %.2f, máx %.0f (de 255)" % (err.mean(), err.max()))

# ---------- 1. máscara das nuvens ----------
# O céu limpo (background-base.png) não tem luz nem pessoa: as nuvens se movem
# em toda a parte de cima; o movimento some antes da linha do horizonte (~0.90).
mask = 1 - smooth(0.76, 0.87, yn)
m_img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(8))
m_img.save("assets/cloud-mask.png")

# ---------- 2. componentes: luz (glow) ----------
comp = Image.open("assets/components-original.png").convert("RGB")
CW, CH = comp.size
c = np.asarray(comp, np.float32)

# fundo escuro azulado da imagem: estimado por um desfoque largo do "mínimo local"
dark = np.asarray(comp.filter(ImageFilter.MinFilter(31)).filter(ImageFilter.GaussianBlur(40)), np.float32)
floor = np.maximum(dark, np.array([17, 21, 26], np.float32)) + 5.0
glow = np.clip((c - floor) / (255.0 - floor), 0, 1)
# remove o resíduo azulado: a luz é sempre quente (R >= B)
warm = smooth(-0.01, 0.03, glow[..., 0] - glow[..., 2])
glow *= warm[..., None]

cy_, cx_ = np.mgrid[0:CH, 0:CW].astype(np.float32)
edge = (smooth(0, 60, cx_) * smooth(0, 60, CW - 1 - cx_) * smooth(0, 40, cy_) * smooth(0, 40, CH - 1 - cy_))
glow *= edge[..., None]
Image.fromarray((glow * 255 + 0.5).astype(np.uint8), "RGB").save("assets/components-glow.png")

# ---------- 3. componentes: sombra dos painéis ----------
PANELS = [
    [(355, 147), (436, 132), (437, 188), (356, 204)],     # </>
    [(363, 231), (551, 294), (551, 409), (363, 372)],     # janela de código
    [(248, 405), (326, 400), (326, 472), (249, 478)],     # GitHub
    [(370, 490), (563, 525), (563, 637), (370, 624)],     # diagrama
    [(245, 570), (342, 581), (342, 657), (246, 650)],     # mini código
]
S = 4  # supersampling
sh = Image.new("L", (CW * S, CH * S), 0)
d = ImageDraw.Draw(sh)
for poly in PANELS:
    d.polygon([(px * S, py * S) for px, py in poly], fill=255)
sh = sh.resize((CW, CH), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
sh.save("assets/components-shade.png")

# ---------- 4. fallback estático ----------
b = np.asarray(bg, np.float32) / 255
ch = LAYOUT["h"] * H
cw = ch * CW / CH
box = (int(round(LAYOUT["cx"] * W - cw / 2)), int(round(LAYOUT["cy"] * H - ch / 2)))
size = (int(round(cw)), int(round(ch)))
g = np.asarray(Image.fromarray((glow * 255).astype(np.uint8)).resize(size, Image.LANCZOS), np.float32) / 255
s = np.asarray(sh.resize(size, Image.LANCZOS), np.float32) / 255
reg = b[box[1]:box[1] + size[1], box[0]:box[0] + size[0]]
reg[:] = np.clip(reg * (1 - s[..., None] * SHADE_STRENGTH) + g, 0, 1)
Image.fromarray((b * 255 + 0.5).astype(np.uint8)).save("assets/fallback.jpg", quality=90)

print(json.dumps({"bg": [W, H], "comp": [CW, CH], "layout": LAYOUT}))
