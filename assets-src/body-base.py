import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src = Image.open('/mnt/user-data/uploads/7f2c54e8-image.png').convert('RGB')
W = 1000
src = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS)
a = np.asarray(src).astype(np.float32) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = a.max(-1); mn = a.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
fg = v > 0.16
sil = ndi.binary_fill_holes(ndi.binary_closing(fg, iterations=4))
silf = ndi.gaussian_filter(sil.astype(np.float32), 0.8)
lum = 0.3 * r + 0.59 * g + 0.11 * b
colored = (s > 0.35) & (v > 0.18)
greyish = (s < 0.3) & (v > 0.18)
# líneas: oscuridad continua dentro de la silueta (antialias)
dark = np.clip((0.42 - v) / 0.34, 0, 1)
dark = np.where(colored, np.clip((0.55 - v) / 0.4, 0, 1), dark)
line_a = dark * silf
# partes neutras (gris): tono pizarra muy oscuro con el sombreado original
t = np.clip((lum - 0.25) / 0.55, 0, 1)
lo = np.array([0.10, 0.11, 0.14]); hi = np.array([0.30, 0.33, 0.39])
neutral = lo + (hi - lo) * t[..., None]
# antebrazos: zona gris entre codo y muñeca (pasa a ser músculo con su propia máscara)
H = sil.shape[0]
yy, xx = np.mgrid[0:H, 0:W]
arms = ((xx < 175) | ((xx > 370) & (xx < 465)) | ((xx > 535) & (xx < 632)) | (xx > 830)) & (yy > 240) & (yy < 392)
fore = greyish & sil & arms
lab, n = ndi.label(fore)
if n:
    sz = ndi.sum(fore, lab, range(1, n + 1)); fore = np.isin(lab, [i + 1 for i, z in enumerate(sz) if z > 150])
fore = ndi.binary_fill_holes(ndi.binary_closing(fore, iterations=3))
fm = ndi.gaussian_filter((ndi.binary_dilation(fore, iterations=2) & sil).astype(np.float32), 0.6)
mimg = np.zeros((*fore.shape, 4), np.uint8); mimg[..., :3] = 255; mimg[..., 3] = (np.clip(fm, 0, 1) * 255).astype(np.uint8)
Image.fromarray(mimg, 'RGBA').save('mask_Antebrazo.png', optimize=True)
print('antebrazo px', int(fore.sum()))
grey_a = (greyish & sil & ~fore).astype(np.float32)
grey_a = ndi.gaussian_filter(grey_a, 0.5)
out = np.zeros((*sil.shape, 4), np.float32)
# capa: primero gris neutro, luego líneas encima
out[..., :3] = neutral; out[..., 3] = grey_a
lc = np.array([0.02, 0.025, 0.035])
A = line_a + out[..., 3] * (1 - line_a)
out[..., :3] = np.where(A[..., None] > 0, (lc * line_a[..., None] + out[..., :3] * out[..., 3:4] * (1 - line_a[..., None])) / np.maximum(A[..., None], 1e-6), 0)
out[..., 3] = A
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA').save('base.png', optimize=True)
# contorno exterior suave
ring = np.clip(silf - ndi.gaussian_filter(ndi.binary_erosion(sil, iterations=2).astype(np.float32), 0.8), 0, 1)
e = np.zeros((*sil.shape, 4), np.uint8); e[..., :3] = [190, 205, 230]; e[..., 3] = (ring * 140).astype(np.uint8)
Image.fromarray(e, 'RGBA').save('edge.png', optimize=True)
# máscaras a la misma resolución: reescalar las ya corregidas
import glob
for f in [x for x in glob.glob('mask_*.png') if 'Antebrazo' not in x]:
    m = Image.open(f).resize((W, sil.shape[0]), Image.LANCZOS)
    m.save(f, optimize=True)
print(src.size)
