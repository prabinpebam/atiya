"""Compose the family NPCs' skins (Rojina, Laija, Lingjel, Prabin) on the Kenney character atlas layout.

Painted from the project's own atlases, region by region, so every UV island stays exactly where the
rig expects it (docs: documentation/poc-3d-navigation/family.md §4):
  - the head block comes from Sunny's generated face (Rojina, Laija) or the Kenney skater's face
    (Lingjel, cleaned of the piercing and chin mark), with the hair recoloured;
  - the T-shirt block, the sleeve strips, the trouser block (shorts: skin below the knee line) and
    the shoe block are refilled with flat colours, keeping the atlas's own shading steps;
  - the glove blocks become plain skin; each shirt gets a small chest motif.
Writes public/models/skins/<id>.png.  Run:  python assets-src/characters/compose-family.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "models" / "skins"
male = np.array(Image.open(SRC / "kenney_animated-characters-protagonists" / "Skins" / "skaterMaleA.png").convert("RGB")).astype(float)
sunny = np.array(Image.open(SRC / "characters" / "casualFemaleA.png").convert("RGB")).astype(float)
SKIN = np.array([246, 149, 116], float)

FAMILY = {
    # Rojina: a sage-teal T-shirt with a little white leaf, navy trousers, tan flats; she wears Sunny's
    # model (its ponytail takes this atlas's dark hair and teal tee), and glasses on the Head bone
    "rojina": dict(face="sunny", hair=(34, 25, 22), shirt=(112, 178, 158), sleeve=(112, 178, 158), cuff=(90, 150, 132), motif="leaf", legs=(58, 70, 104), shorts=False, shoe=(170, 112, 72), tee=True),
    # Laija (9): a coral-pink T-shirt with a white star, light-denim trousers, purple sneakers
    "laija": dict(face="sunny", hair=(46, 32, 26), shirt=(240, 128, 150), sleeve=(247, 176, 190), cuff=(226, 102, 128), motif="star", legs=(104, 150, 205), shorts=False, shoe=(150, 100, 214)),
    # Lingjel (5): a bright blue T-shirt with a little red car (he loves cars), khaki shorts, green crocs
    "lingjel": dict(face="skater", hair=(40, 28, 22), shirt=(66, 140, 226), sleeve=(98, 162, 236), cuff=(48, 112, 196), motif="car", legs=(196, 160, 104), shorts=True, shoe=(76, 190, 92)),
    # Prabin (the owner, an NPC; visitors play the Skater): black hair, a mustard T-shirt with a little
    # pencil, charcoal trousers and brown shoes (docs: prabin-npc.md §4.6)
    "prabin": dict(face="skater", hair=(24, 20, 20), shirt=(222, 170, 58), sleeve=(222, 170, 58), cuff=(190, 142, 44), motif="pencil", legs=(66, 68, 78), shorts=False, shoe=(120, 78, 50), tee=True),
}


def head(face: str, hair: tuple) -> np.ndarray:
    src = (sunny if face == "sunny" else male)[0:490, 0:640].copy()
    if face == "skater":
        # remove the eyebrow piercing and the chin mark: fill with the surrounding skin
        for (x0, y0, x1, y1) in [(262, 186, 282, 206), (308, 272, 336, 292)]:
            blk = src[y0:y1, x0:x1]
            blk[:] = np.median(src[y1 : y1 + 12, x0:x1].reshape(-1, 3), axis=0)
    # hair: every pixel close to the source hair colour (dark red-brown) takes the new colour, keeping its shading
    base = np.array([80, 22, 18] if face == "skater" else [92, 46, 27], float)
    d = np.abs(src - base).sum(2)
    m = d < 70
    shade = src[m].sum(1, keepdims=True) / base.sum()
    src[m] = np.clip(np.array(hair, float)[None] * shade, 0, 255)
    return src


def motif(img: Image.Image, kind: str, colour: tuple) -> None:
    d = ImageDraw.Draw(img)
    cx, cy = 320, 840
    if kind == "star":
        pts = []
        for i in range(10):
            r = 34 if i % 2 == 0 else 15
            a = -np.pi / 2 + i * np.pi / 5
            pts.append((cx + r * np.cos(a), cy + r * np.sin(a)))
        d.polygon(pts, fill=(255, 250, 240))
    elif kind == "car":
        d.rounded_rectangle([cx - 40, cy - 6, cx + 40, cy + 18], 8, fill=(226, 56, 52))
        d.rounded_rectangle([cx - 22, cy - 24, cx + 20, cy], 8, fill=(226, 56, 52))
        d.rectangle([cx - 15, cy - 19, cx - 2, cy - 4], fill=(200, 232, 255))
        d.rectangle([cx + 2, cy - 19, cx + 14, cy - 4], fill=(200, 232, 255))
        for x in (cx - 22, cx + 22):
            d.ellipse([x - 11, cy + 8, x + 11, cy + 30], fill=(40, 40, 46))
            d.ellipse([x - 4, cy + 15, x + 4, cy + 23], fill=(200, 200, 206))
    elif kind == "leaf":
        d.ellipse([cx - 14, cy - 30, cx + 14, cy + 22], fill=(250, 248, 240))
        d.line([cx, cy - 22, cx, cy + 30], fill=tuple(int(c * 0.8) for c in colour), width=4)
    elif kind == "pencil":
        # a small pencil, drawn at a slant: the body, the sharpened wood and the lead, a pink eraser
        d.line([cx - 30, cy + 22, cx + 22, cy - 22], fill=(60, 60, 70), width=16)
        d.line([cx - 28, cy + 20, cx + 20, cy - 20], fill=(250, 246, 236), width=12)
        d.polygon([(cx + 18, cy - 26), (cx + 26, cy - 18), (cx + 36, cy - 36)], fill=(234, 196, 150))
        d.polygon([(cx + 31, cy - 31), (cx + 34, cy - 28), (cx + 36, cy - 36)], fill=(50, 50, 56))
        d.line([cx - 32, cy + 24, cx - 24, cy + 16], fill=(236, 120, 140), width=14)
    elif kind == "buttons":
        # a button placket down the middle of the shirt, and a little breast pocket
        d.rectangle([cx - 6, 700, cx + 6, 1000], fill=tuple(int(c * 0.8) for c in colour))
        for y in range(730, 990, 55):
            d.ellipse([cx - 6, y - 6, cx + 6, y + 6], fill=(245, 242, 232))
        d.rounded_rectangle([cx + 40, 780, cx + 100, 840], 6, outline=tuple(int(c * 0.8) for c in colour), width=5)


def build(name: str, o: dict) -> None:
    out = male.copy()
    out[0:490, 0:640] = head(o["face"], o["hair"])
    # hands: the glove blocks become plain skin
    for (x0, x1, y0, y1) in [(824, 1024, 134, 524), (640, 1024, 524, 765)]:
        blk = out[y0:y1, x0:x1]
        dark = ndimage.binary_dilation(blk[..., 0] < 225, iterations=2)
        blk[dark] = np.median(blk[~dark], axis=0)
    # T-shirt block: flat shirt colour with the atlas's own light-to-dark steps (the tee's gradient)
    # (only its top-to-bottom gradient: the skull and the hem wave are left behind)
    tee = male[490:1024, 160:480].mean(2)
    rows = np.median(tee, axis=1)
    lum = (rows / np.median(rows))[:, None, None]
    out[490:1024, 152:490] = np.clip(np.array(o["shirt"], float)[None, None] * np.clip(lum, 0.9, 1.1), 0, 255)
    # sleeves: the sleeve colour, a cuff ring where the wrist band runs, no strap buckle
    for (x0, x1, bar) in [(0, 152, (113, 137)), (490, 611, (507, 531))]:
        reg = male[490:1024, x0:x1]
        l = reg.sum(2)
        new = np.zeros_like(reg)
        new[:] = o["sleeve"]
        xs = np.arange(x0, x1)[None, :].repeat(reg.shape[0], 0)
        new[(l < 400) & (xs >= bar[0]) & (xs < bar[1])] = o["cuff"]
        out[490:1024, x0:x1] = new
    out[490:765, 611:640] = o["sleeve"]
    if o.get("tee"):
        # short sleeves: the arm strips run along the arm in x (the left strip from the wrist at x 0 to
        # the shoulder at 152, the right one mirrored: shoulder at 490, wrist at 611; checked with a
        # colour-coded atlas), round it in y; below the sleeve's hem the arm is bare skin
        out[490:1024, 0:104] = SKIN
        out[490:1024, 104:112] = np.array(o["cuff"], float)
        out[490:1024, 537:611] = SKIN
        out[490:1024, 529:537] = np.array(o["cuff"], float)
    # trousers: denim / khaki with the atlas's seam line; shorts end above the knee (skin below)
    # (row by row, so the knee pads go but the seam lines stay, softened)
    leg = male[765:1024, 611:1024].mean(2)
    lrows = np.median(leg, axis=1)
    llum = (lrows / np.median(lrows))[:, None, None]
    out[765:1024, 611:1024] = np.clip(np.array(o["legs"], float)[None, None] * np.clip(llum, 0.82, 1.12), 0, 255)
    if o["shorts"]:
        out[885:1024, 611:1024] = SKIN
        out[872:885, 611:1024] = np.array(o["legs"], float) * 0.85
    # shoes: the sneaker shapes (green in the skater atlas) take the new colour; crocs get their holes
    shoes = out[134:524, 640:824]
    g = male[134:524, 640:824]
    green = (g[..., 1] > g[..., 0] + 40) & (g[..., 1] > g[..., 2] + 10)
    shoes[green] = o["shoe"]
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if o["shorts"]:
        d = ImageDraw.Draw(img)
        dark = tuple(int(c * 0.7) for c in o["shoe"])
        for (cx, cy) in [(700, 190), (730, 175), (760, 190), (715, 215), (745, 215), (700, 365), (730, 350), (760, 365), (715, 390), (745, 390)]:
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=dark)
    motif(img, o["motif"], o["shirt"])
    OUT.mkdir(parents=True, exist_ok=True)
    img.quantize(96, dither=Image.Dither.NONE).convert("RGB").save(OUT / f"{name}.png", optimize=True)
    print(name, (OUT / f"{name}.png").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    for n, o in FAMILY.items():
        build(n, o)
