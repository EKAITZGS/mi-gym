import numpy as np, colorsys
from PIL import Image
from scipy import ndimage as ndi
src = Image.open('/mnt/user-data/uploads/7f2c54e8-image.png').convert('RGB')
W = 900
src = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS)
a = np.asarray(src).astype(np.float32) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = a.max(-1); mn = a.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
# tono
hue = np.zeros_like(mx)
d = np.maximum(mx - mn, 1e-6)
hr = ((g - b) / d) % 6; hg = (b - r) / d + 2; hb = (r - g) / d + 4
hue = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60
# silueta: todo lo no negro, cerrado y con huecos rellenos
fg = v > 0.16
sil = ndi.binary_fill_holes(ndi.binary_closing(fg, iterations=4))
sil = ndi.binary_dilation(sil, iterations=1)
colored = (s > 0.45) & (v > 0.2)
groups = {'Pecho': (345, 15), 'Pierna': (15, 45), 'Tríceps': (45, 75), 'Bíceps': (90, 150), 'Core': (165, 200), 'Hombro': (215, 265), 'Espalda': (280, 335)}
out = {}
for name, (h0, h1) in groups.items():
    if h0 > h1: m = (hue >= h0) | (hue < h1)
    else: m = (hue >= h0) & (hue < h1)
    m = m & colored & sil
    # quitar motas sueltas
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > 60])
        m = keep
    out[name] = m
    print(name, int(m.sum()))
claimed = np.zeros_like(sil)
for m in out.values(): claimed |= m
# máscaras suaves: cada grupo crece 2 px por debajo de las líneas para que no queden huecos
for name, m in out.items():
    grown = ndi.binary_dilation(m, iterations=2) & sil
    alpha = ndi.gaussian_filter(grown.astype(np.float32), 0.6)
    img = np.zeros((*m.shape, 4), np.uint8); img[..., :3] = 255; img[..., 3] = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(f'mask_{name}.png', optimize=True)
# capa base: líneas oscuras + partes grises (cabeza, antebrazos, manos, rodillas, pies) en tono pizarra
lum = 0.3 * r + 0.59 * g + 0.11 * b
grey = sil & ~colored & (s < 0.25) & (v > 0.2)
line = sil & (v <= 0.2)
base = np.zeros((*sil.shape, 4), np.float32)
# gris -> pizarra azulado oscuro conservando el sombreado
t = np.clip((lum - 0.2) / 0.6, 0, 1)
slate_lo = np.array([0.16, 0.18, 0.22]); slate_hi = np.array([0.50, 0.54, 0.62])
col = slate_lo + (slate_hi - slate_lo) * t[..., None]
base[grey, :3] = col[grey]; base[grey, 3] = 1
# líneas: casi negras, opacidad según lo oscuras que sean
la = np.clip((0.22 - v) / 0.22, 0, 1) * 0.9 + 0.1
base[line, :3] = [0.03, 0.035, 0.05]; base[line, 3] = la[line]
# bordes antialias entre color y línea
Image.fromarray((base * 255).astype(np.uint8), 'RGBA').save('base.png', optimize=True)
# contorno exterior claro
edge = sil & ~ndi.binary_erosion(sil, iterations=2)
eo = np.zeros((*sil.shape, 4), np.uint8); eo[edge] = [210, 218, 232, 150]
Image.fromarray(eo, 'RGBA').save('edge.png', optimize=True)
print(src.size)
