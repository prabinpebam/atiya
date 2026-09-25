"""Game item icons: a golden style set, icon generation against it, and the web build.

The consistency system (see assets-src/icons/README.md):

1. `golden`  paints ONE 2x2 sheet of four style exemplars (subjects that are *not* game items) in a
             single call, image-to-image from the landing key art, so the four share one style by
             construction. It is generated once, reviewed, and then frozen.
2. `slice`   cuts the sheet into assets-src/icons/style/golden-{1..4}.png.
3. `icon ID` paints an item icon image-to-image with the four golden exemplars as references and
             the fixed style block (STYLE) plus the item's subject line (ITEMS). Every icon uses the
             same references and the same style words, so only the subject changes.
4. `build`   trims, centres and pads every source onto a square, derives the colour variants
             (VARIANTS: the white flowers' petals re-tinted, shading kept), and writes
             public/icons/<id>.webp plus src/game/inventory/iconManifest.ts.

Generation calls the gpt-image-2-5 skill CLI (Azure OpenAI GPT Image 2.5); the key is read from
Windows Credential Manager by that CLI and never appears here.

  python scripts/gen-icons.py golden            # once (then review and freeze)
  python scripts/gen-icons.py slice
  python scripts/gen-icons.py icon apple [--quality high]
  python scripts/gen-icons.py all               # every item missing a source
  python scripts/gen-icons.py build
"""

from __future__ import annotations

import argparse
import colorsys
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "icons"
STYLE_DIR = SRC / "style"
OUT = ROOT / "public" / "icons"
MANIFEST = ROOT / "src" / "game" / "inventory" / "iconManifest.ts"
IMG = Path(os.environ.get("USERPROFILE", "~")) / ".copilot" / "skills" / "gpt-image-2-5" / "scripts" / "imagegen.py"
KEY_ART = ROOT / "public" / "og-image.jpg"

#: Shipped icon size (px). Slots draw at 40–48 CSS px, so 96 covers 2x screens.
SIZE = 96

GOLDEN_PROMPT = (
    "A 2x2 sheet of four separate game inventory item icons, one centred in each quadrant with generous "
    "empty padding around it, for a cozy hand-painted little-planet adventure game. Match the warmth, palette "
    "and soft painterly light of the reference key art. Top-left: a red spotted toadstool mushroom. Top-right: "
    "a small wooden bucket with two dark iron bands. Bottom-left: a glossy blue crystal cluster. Bottom-right: "
    "a green four-leaf clover. Icon style for all four: 3/4 view from slightly above; chunky, rounded, simplified "
    "shapes with a bold readable silhouette; soft painterly cel shading in three tone steps; warm sunlight from "
    "the upper left with a gentle cool shadow side and one small soft white highlight; a clean dark warm-brown "
    "outline of even medium thickness around each whole silhouette; saturated but soft colours; subtle brush "
    "texture. Each item isolated on a fully transparent background: no text, no labels, no frame, no grid "
    "lines, no ground shadow, no backdrop."
)

#: The fixed style block every item icon is generated with (only the subject changes).
STYLE = (
    "Paint ONE new game inventory item icon in exactly the same art style as the reference icons: the same "
    "3/4 view from slightly above, the same chunky simplified rounded shapes, the same soft painterly cel "
    "shading in three tone steps, the same warm upper-left sunlight with a cool shadow side and a small soft "
    "white highlight, the same dark warm-brown outline thickness, the same saturation and brush texture. "
    "Subject: {subject}. The object is centred and fills about 80% of the square canvas, with a bold, "
    "distinctive silhouette that is still recognisable at 32 pixels. Only this single object, isolated on a "
    "fully transparent background: no text, no labels, no frame, no ground shadow, no backdrop, none of the "
    "reference objects."
)

#: Item icons to generate: id -> subject. Flowers are painted white and re-tinted (VARIANTS).
ITEMS: dict[str, str] = {
    "log": "a short chopped wooden log lying on its side, rough brown bark around it and the pale cut end with clear tree rings facing the viewer",
    "leaves": "a small bunch of three fresh bright-green broad leaves fanned out from one short twig, with visible central veins",
    "apple": "a shiny round red apple with a short brown stem and a single green leaf",
    "orange": "a bright round orange citrus fruit with a dimpled peel and a small dark-green leaf on a stubby stem",
    "stone": "a chunky rough grey stone chunk with a few flat chipped facets and a slightly lighter top, like a piece broken off a boulder",
    "tulip": "a single WHITE tulip flower, a closed cup of pure white petals, on a short green stem with two long green leaves",
    "cosmos": "a single WHITE cosmos flower seen at a 3/4 angle, eight broad pure-white petals with notched tips around a golden-yellow centre, on a thin short green stem with a sprig of feathery leaves",
    "pansy": "a single WHITE pansy flower facing the viewer, five rounded overlapping pure-white petals with a small golden-yellow eye, on a short green stem with one rounded green leaf",
    # crafted materials (crafting.md)
    "planks": "a small neat stack of three flat light-wood planks, freshly sawn, with visible wood grain along them and pale cut ends facing the viewer",
    "beam": "one thick square wooden beam lying diagonally, solid honey-brown timber with strong grain lines along it and a squared pale end showing growth rings",
    "slab": "one flat rectangular grey stone slab, a smooth cut paving stone with slightly bevelled edges and a few speckles, seen at a 3/4 angle from above",
    "paint": "a small round tin paint pot with its lid off and a little wire handle, filled to the brim with glossy PURE WHITE paint, one thick white drip running down its grey metal side",
}

#: Colour names -> hex, the flower bloom palette the game plants (Props.tsx BLOOM_COLORS).
FLOWER_COLOURS: dict[str, str] = {
    "red": "#ff5a6a",
    "pink": "#ff9ec4",
    "yellow": "#ffd84d",
    "white": "#ffffff",
    "orange": "#ff9a4d",
    "purple": "#a98cff",
    "blue": "#7fb2ff",
}
FLOWERS = ("tulip", "cosmos", "pansy")
#: Derived icons: id -> (source id, petal tint).
VARIANTS: dict[str, tuple[str, str]] = {f"{f}-{c}": (f, hexc) for f in FLOWERS for c, hexc in FLOWER_COLOURS.items()}
# paint pots: the white paint re-tinted to each bloom colour (made from those flowers)
VARIANTS.update({f"paint-{c}": ("paint", hexc) for c, hexc in FLOWER_COLOURS.items()})
TINTED = (*FLOWERS, "paint")


def run(args: list[str]) -> None:
    print(">", " ".join(a if " " not in a else f'"{a[:60]}…"' for a in args))
    subprocess.run([sys.executable, str(IMG), *args], check=True)


def cmd_golden(q: str) -> None:
    STYLE_DIR.mkdir(parents=True, exist_ok=True)
    out = STYLE_DIR / "golden-sheet.png"
    run(["edit", "-i", str(KEY_ART), "-p", GOLDEN_PROMPT, "-o", str(out), "--size", "1024x1024", "--quality", q, "--background", "transparent"])
    (STYLE_DIR / "golden-sheet.prompt.txt").write_text(GOLDEN_PROMPT + "\n\nReference: public/og-image.jpg (landing key art)\n", encoding="utf-8")


def trim_square(im: Image.Image, pad: float = 0.06) -> Image.Image:
    """Crop to the opaque bounds, centre on a square with `pad` margin each side."""
    a = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(a > 8)
    if not len(xs):
        return im
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    c = im.crop(box)
    side = int(round(max(c.size) / (1 - 2 * pad)))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(c, ((side - c.size[0]) // 2, (side - c.size[1]) // 2), c)
    return sq


def cmd_slice() -> None:
    sheet = Image.open(STYLE_DIR / "golden-sheet.png").convert("RGBA")
    w, h = sheet.size
    for i in range(4):
        x, y = (i % 2) * w // 2, (i // 2) * h // 2
        cell = trim_square(sheet.crop((x, y, x + w // 2, y + h // 2)), 0.08)
        cell.resize((512, 512), Image.LANCZOS).save(STYLE_DIR / f"golden-{i + 1}.png")
        print("wrote", STYLE_DIR / f"golden-{i + 1}.png")


def cmd_icon(item: str, q: str) -> None:
    refs = [STYLE_DIR / f"golden-{i}.png" for i in range(1, 5)]
    missing = [r for r in refs if not r.exists()]
    if missing:
        sys.exit(f"missing golden refs: {missing} (run golden + slice first)")
    prompt = STYLE.format(subject=ITEMS[item])
    SRC.mkdir(parents=True, exist_ok=True)
    out = SRC / f"{item}.png"
    args = ["edit"]
    for r in refs:
        args += ["-i", str(r)]
    run([*args, "-p", prompt, "-o", str(out), "--size", "1024x1024", "--quality", q, "--background", "transparent"])
    (SRC / f"{item}.prompt.txt").write_text(prompt + "\n\nReferences: assets-src/icons/style/golden-1..4.png\n", encoding="utf-8")


def tint_petals(im: Image.Image, hexc: str) -> Image.Image:
    """Re-tint the white petals of a flower icon, keeping their painted shading (outline, stem, leaves and
    the yellow eye are saturated or dark, so they're left alone)."""
    if hexc.lower() == "#ffffff":
        return im.copy()
    rgba = np.asarray(im).astype(np.float32) / 255
    rgb = rgba[..., :3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    # petal pixels: light and nearly neutral (white or its cool shadow); soft ramp so edges blend
    w = np.clip((mx - 0.45) / 0.2, 0, 1) * np.clip((0.32 - sat) / 0.14, 0, 1)
    target = np.array([int(hexc[i : i + 2], 16) / 255 for i in (1, 3, 5)], dtype=np.float32)
    # keep the petals' value (shading), take the target's hue and saturation
    th, tl, ts = colorsys.rgb_to_hls(*target)
    lum = rgb.mean(-1, keepdims=True)
    shade = np.clip(lum / max(lum[w > 0.5].mean() if (w > 0.5).any() else 1, 1e-3), 0, 1.25)
    tinted = np.clip(target * shade * 1.02, 0, 1)
    out = rgb * (1 - w[..., None]) + tinted * w[..., None]
    res = np.concatenate([out, rgba[..., 3:]], -1)
    return Image.fromarray((res * 255 + 0.5).astype(np.uint8))


def cmd_build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict] = {}
    sources: dict[str, Image.Image] = {}
    for item in ITEMS:
        p = SRC / f"{item}.png"
        if not p.exists():
            print("skip (no source):", item)
            continue
        sources[item] = trim_square(Image.open(p).convert("RGBA"))
    def emit(icon_id: str, im: Image.Image) -> None:
        small = im.resize((SIZE, SIZE), Image.LANCZOS)
        # snap near-solid / near-clear alpha and bleed edge colour (no dark halos when scaled)
        a = np.asarray(small.getchannel("A")).copy()
        a[a >= 250] = 255
        a[a <= 4] = 0
        small.putalpha(Image.fromarray(a))
        path = OUT / f"{icon_id}.webp"
        small.save(path, "WEBP", quality=88, method=6)
        entries[icon_id] = {"url": f"/icons/{icon_id}.webp", "bytes": path.stat().st_size}
    for item, im in sources.items():
        if item not in TINTED:
            emit(item, im)
    for vid, (src, hexc) in VARIANTS.items():
        if src in sources:
            emit(vid, tint_petals(sources[src], hexc))
    total = sum(e["bytes"] for e in entries.values())
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// Generated by scripts/gen-icons.py build — do not edit by hand.",
        f"/** Item icons ({len(entries)} files, {total / 1024:.1f} KB total, {SIZE}x{SIZE} WebP). */",
        "export const ICONS: Record<string, { url: string; bytes: number }> = " + json.dumps(entries, indent=2) + ";",
        f"export const ICON_SIZE = {SIZE};",
        "",
    ]
    MANIFEST.write_text("\n".join(lines), encoding="utf-8")
    print(f"built {len(entries)} icons, {total / 1024:.1f} KB -> {OUT}")
    # contact sheet for review
    cols = 8
    n = len(entries)
    sheet = Image.new("RGBA", (cols * (SIZE + 8), ((n + cols - 1) // cols) * (SIZE + 8)), (58, 46, 38, 255))
    for i, k in enumerate(entries):
        im = Image.open(OUT / f"{k}.webp").convert("RGBA")
        sheet.paste(im, ((i % cols) * (SIZE + 8) + 4, (i // cols) * (SIZE + 8) + 4), im)
    sheet.save(SRC / "contact-sheet.png")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["golden", "slice", "icon", "all", "build"])
    ap.add_argument("item", nargs="?")
    ap.add_argument("--quality", default="high")
    ap.add_argument("--force", action="store_true", help="regenerate even if a source exists")
    a = ap.parse_args()
    if a.cmd == "golden":
        cmd_golden(a.quality)
    elif a.cmd == "slice":
        cmd_slice()
    elif a.cmd == "icon":
        if a.item not in ITEMS:
            sys.exit(f"unknown item {a.item!r}; one of {', '.join(ITEMS)}")
        cmd_icon(a.item, a.quality)
    elif a.cmd == "all":
        for item in ITEMS:
            if a.force or not (SRC / f"{item}.png").exists():
                cmd_icon(item, a.quality)
    else:
        cmd_build()


if __name__ == "__main__":
    main()
