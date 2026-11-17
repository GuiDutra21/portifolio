"""Remove as faixas escuras laterais de assets/hero-original.png -> assets/hero.png.
As faixas são um escurecimento multiplicativo (~50%) do conteúdo original; aqui
medimos o ganho por coluna e o desfazemos, mantendo a vinheta natural da cena."""
import numpy as np
from PIL import Image

a = np.asarray(Image.open("assets/hero-original.png").convert("RGB"), np.float32)
H, W, _ = a.shape
rng = np.random.default_rng(7)

def fix_side(img, bands=6):
    """Corrige a faixa da ESQUERDA de img (para a direita, passa a imagem espelhada)."""
    EDGE, FIT0, FIT1 = 310, 320, 470      # faixa termina antes de EDGE; ajuste em [FIT0, FIT1)
    xs = np.arange(W, dtype=np.float32)
    gains = []
    ys = np.linspace(0, H, bands + 1).astype(int)
    for y0, y1 in zip(ys[:-1], ys[1:]):
        m = np.log(img[y0:y1].mean(axis=(0, 2)) + 1e-3)
        k, b = np.polyfit(xs[FIT0:FIT1], m[FIT0:FIT1], 1)
        k = float(np.clip(k, 0.0, 0.0015))          # vinheta suave, nunca invertida
        b = m[FIT0:FIT1].mean() - k * xs[FIT0:FIT1].mean()
        g = np.exp(m[:EDGE] - (k * xs[:EDGE] + b))
        gains.append(np.clip(g, 0.2, 1.0))
    gains = np.array(gains)                          # (bands, EDGE)
    # suaviza em x (leve) e interpola em y
    kern = np.exp(-0.5 * (np.arange(-6, 7) / 2.0) ** 2); kern /= kern.sum()
    gains = np.array([np.convolve(np.pad(g, 6, mode="edge"), kern, "valid") for g in gains])
    yc = (ys[:-1] + ys[1:]) / 2
    full = np.empty((H, EDGE), np.float32)
    for x in range(EDGE):
        full[:, x] = np.interp(np.arange(H), yc, gains[:, x])
    # funde com 1.0 perto de EDGE
    t = np.clip((EDGE - 1 - np.arange(EDGE)) / 12.0, 0, 1)
    full = 1 + (full - 1) * t
    out = img.copy()
    out[:, :EDGE] = img[:, :EDGE] / full[..., None]
    out[:, :EDGE] += rng.uniform(-0.5, 0.5, (H, EDGE, 1))   # dither contra banding
    return out

a = fix_side(a)
a = fix_side(a[:, ::-1])[:, ::-1]
Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).save("assets/hero.png")

col = a.mean(axis=(0, 2))
print("perfil:", [round(float(col[x]), 1) for x in (0, 100, 200, 260, 300, 340, 400, 1520, 1600, 1640, 1680, 1720, 1820, 1926)])
