"""Clean up the generated female skin so every UV island matches the Kenney atlas layout exactly."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
ROOT = r"e:\Projects\Personal\personal-site\assets-src"
male = np.array(Image.open(ROOT + r"\kenney_animated-characters-protagonists\Skins\skaterMaleA.png").convert("RGB")).astype(float)
# the generation has a fine painterly grain; a small median filter flattens it back to clean vector fills
out = np.array(Image.open(ROOT + r"\characters\casualFemaleA.raw.png").convert("RGB").filter(ImageFilter.MedianFilter(5))).astype(float)
lum = male.sum(2)

# hands: the glove blocks become plain skin (the male's own skin there, gloves filled with the block's median skin)
for (x0, x1, y0, y1) in [(824, 1024, 134, 524), (640, 1024, 524, 765)]:
    blk = male[y0:y1, x0:x1].copy()
    # glove pixels and their anti-aliased edges are all well below the skin's red (≈ 245)
    dark = ndimage.binary_dilation(blk[..., 0] < 225, iterations=2)
    blk[dark] = np.median(blk[~dark], axis=0)
    out[y0:y1, x0:x1] = blk
# the orange strip (unused by the skater skin) stays as it was
out[0:134, 640:1024] = male[0:134, 640:1024]

# sleeves: cream, with a mustard cuff ring exactly where the male's wrist band runs; no strap buckle
CREAM, SHADE, CUFF = (250, 243, 229), (236, 231, 222), (236, 170, 50)
for (x0, x1, bar) in [(0, 152, (113, 137)), (490, 640, (507, 531))]:
    reg = male[490:1024, x0:x1]
    l = reg.sum(2)
    new = np.zeros_like(reg)
    new[:] = CREAM
    xs0 = np.arange(x0, x1)[None, :]
    new[((xs0 < 42) | (xs0 >= 597)) & (l > 600) & (l < 740)] = SHADE
    xs = np.arange(x0, x1)[None, :].repeat(reg.shape[0], 0)
    band = (l < 400) & (xs >= bar[0]) & (xs < bar[1])
    new[band] = CUFF
    if x0 == 490:
        # the trousers island starts at x 611 below y 765: leave it alone
        new[765 - 490 :, 611 - x0 :] = out[765:1024, 611:640]
    out[490:1024, x0:x1] = new

# the collar opening on top of the shoulders: a darker mustard, where the male's darker red patch is
reg = male[690:800, 250:390]
patch = (np.abs(reg - [234, 48, 49]).sum(2) < 40)
sub = out[690:800, 250:390]
sub[patch] = (214, 142, 36)

img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
# flat vector colours: an adaptive 96-colour palette (no dithering) keeps it small like Kenney's own skins
img.save(ROOT + r"\characters\casualFemaleA.png", optimize=True)
print("ok")
