"""Build game-ready textures from the generated sources in assets-src/textures/.

Sources are original, AI-generated images (gpt-image-2.5, see the *.prompt.txt next to each
source). This script turns them into small, optimised WebP files in public/ and writes the
typed manifest src/game/world/textureManifest.ts (URLs + mean linear colours used by shaders).

Requires Python 3.10+ with Pillow and numpy. Outputs are committed, so only asset authors need it:
    python scripts/build-textures.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "textures"
OUT = ROOT / "public" / "textures"
MANIFEST = ROOT / "src" / "game" / "world" / "textureManifest.ts"

# name: (kind, output size). kinds:
#   tile   - seamless colour tile (wrap-safe resize), mean colour exported
#   mask   - seamless greyscale tile (luminance, stretched to 0…1), mean value exported
#   decal  - non-tiling colour image mapped once (e.g. the plaza), plain resize
#   tint   - alpha sprite converted to normalised greyscale (tinted by vertex/instance colour in game)
#   sprite - alpha sprite kept in colour
TEXTURES: dict[str, tuple[str, int]] = {
    "grass": ("tile", 512),
    "dirt": ("tile", 512),
    "cobble": ("tile", 512),
    "sand": ("tile", 512),
    "riverbed": ("tile", 512),
    "rock": ("tile", 512),
    "boulder": ("mask", 256),
    "water": ("mask", 512),
    "paint-grain": ("mask", 256),
    # per-surface detail on the kit models (wood grain, shingles, plaster, masonry, iron, canvas)
    "surf-wood": ("mask", 512),
    "surf-shingle": ("mask", 512),
    "surf-plaster": ("mask", 256),
    "surf-stone": ("mask", 512),
    "surf-brick": ("mask", 512),
    "surf-metal": ("mask", 256),
    "surf-canvas": ("mask", 256),
    "surf-bark": ("mask", 256),
    "plaza": ("decal", 1024),
    "leaf-broad": ("tint", 256),
    "leaf-single": ("tint", 128),
    "grass-card": ("tint", 256),
    "moon": ("sprite", 256),
}
# 2×2 atlases: name -> (cell sources in order [top-left, top-right, bottom-left, bottom-right], size, mode)
# mode "tint" = normalised greyscale (tinted in game), "sprite" = full colour
ATLASES: dict[str, tuple[list[str], int, str]] = {
    "conifer-atlas": (["conifer-clump", "conifer-bough", "conifer-tufts", "conifer-crown"], 512, "tint"),
    "pond-atlas": (["pond-lilies", "pond-reeds", "pond-iris", "pond-fern"], 512, "sprite"),
}
# how a sprite sits in its square card: bottom = base touches the bottom edge (stems, grass, crown),
# top = hangs from the top edge (boughs)
ALIGN = {"leaf-broad": "bottom", "grass-card": "bottom", "leaf-single": "center", "moon": "center",
         "conifer-clump": "center", "conifer-bough": "top", "conifer-tufts": "center", "conifer-crown": "bottom",
         "pond-lilies": "center", "pond-reeds": "bottom", "pond-iris": "bottom", "pond-fern": "bottom"}
# minimum width/height ratio: narrow sprites are widened so the cards keep their coverage
MIN_ASPECT: dict[str, float] = {}


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def resize_tileable(im: Image.Image, size: int) -> Image.Image:
    a = np.asarray(im.convert("RGB"))
    pad = max(8, a.shape[0] // 16)
    big = Image.fromarray(np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode="wrap"))
    s = size / a.shape[0]
    big = big.resize((round(big.width * s), round(big.height * s)), Image.LANCZOS)
    p = round(pad * s)
    return big.crop((p, p, p + size, p + size))


def _blur(arr: np.ndarray, radius: float) -> np.ndarray:
    return np.dstack([np.asarray(Image.fromarray(np.clip(arr[..., c], 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), np.float32)
                      for c in range(arr.shape[-1])])


def bleed(img: Image.Image) -> Image.Image:
    """Give fully transparent pixels the colour of nearby opaque ones (no mipmap halos)."""
    rgba = np.asarray(img.convert("RGBA"), np.float32)
    rgb = rgba[..., :3].copy()
    known = rgba[..., 3] > 0
    weight = rgba[..., 3] / 255
    for radius in (1, 3, 8, 24, 64):
        k = (weight * known)[..., None]
        num = _blur(rgb * k, radius)
        den = _blur(k * 255, radius)[..., 0] / 255
        new = ~known & (den > 0.01)
        rgb[new] = num[new] / den[new][:, None]
        weight[new] = 1
        known |= new
        if known.all():
            break
    rgb[~known] = rgb[known].mean(axis=0) if known.any() else 128
    return Image.fromarray(np.clip(np.dstack([rgb, rgba[..., 3]]) + 0.5, 0, 255).astype(np.uint8))


def fit_sprite(im: Image.Image, size: int, align: str, min_aspect: float = 0.0) -> Image.Image:
    """Crop to the opaque bounds and fit into a square card (with a small margin)."""
    im = im.convert("RGBA")
    a = np.asarray(im)[..., 3]
    a = np.where(a >= 250, 255, np.where(a <= 4, 0, a)).astype(np.uint8)
    im.putalpha(Image.fromarray(a))
    ys, xs = np.nonzero(a > 8)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    im = im.crop(box)
    if im.width < im.height * min_aspect:
        im = im.resize((round(im.height * min_aspect), im.height), Image.LANCZOS)
    margin = 0.03
    inner = size * (1 - 2 * margin)
    s = inner / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    card = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - im.width) // 2
    y = size - im.height if align == "bottom" else 0 if align == "top" else (size - im.height) // 2
    card.alpha_composite(im, (x, y))
    return card


def tint_sprite(im: Image.Image) -> Image.Image:
    """Greyscale version whose opaque body averages ~0.85 and peaks at 1.0, so vertex/instance
    colours multiply it like the old canvas-drawn cards."""
    rgba = np.asarray(im.convert("RGBA"), np.float32) / 255
    lum = rgba[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    body = rgba[..., 3] > 0.5
    lo, hi = np.percentile(lum[body], [2, 98])
    g = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)
    g = 0.55 + 0.45 * g  # keep painted shading, but never darker than 0.55 (the tint does colour)
    out = np.dstack([g, g, g, rgba[..., 3]]) * 255
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))


def save_webp(im: Image.Image, path: Path, lossless=False) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    kw = {"lossless": True} if lossless else {"quality": 88, "method": 6}
    if im.mode == "RGBA":
        kw["exact"] = True  # keep bled colour under transparent pixels
    im.save(path, "WEBP", **kw)
    return path.stat().st_size


def main() -> None:
    manifest: dict[str, dict] = {}
    total = 0
    for name, (kind, size) in TEXTURES.items():
        src = SRC / f"{name}.png"
        if not src.exists():
            print(f"skip {name}: no source")
            continue
        im = Image.open(src)
        entry: dict = {"url": f"/textures/{name}.webp", "kind": kind}
        if kind == "tile":
            out = resize_tileable(im, size)
            lin = srgb_to_linear(np.asarray(out, np.float32) / 255)
            entry["mean"] = [round(float(v), 4) for v in lin.reshape(-1, 3).mean(axis=0)]
        elif kind == "mask":
            g = np.asarray(resize_tileable(im, size).convert("L"), np.float32)
            lo, hi = np.percentile(g, [1, 99.5])
            g = np.clip((g - lo) / max(hi - lo, 1) * 255, 0, 255).astype(np.uint8)
            out = Image.fromarray(g).convert("RGB")
            # masks are sampled raw (no colour space), so the mean is the raw 0…1 value
            m = round(float(g.mean() / 255), 4)
            entry["mean"] = [m, m, m]
        elif kind == "decal":
            out = im.convert("RGB").resize((size, size), Image.LANCZOS)
        elif kind == "tint":
            out = bleed(tint_sprite(fit_sprite(im, size, ALIGN.get(name, "center"), MIN_ASPECT.get(name, 0.0))))
        else:
            out = bleed(fit_sprite(im, size, ALIGN.get(name, "center")))
        n = save_webp(out, OUT / f"{name}.webp")
        total += n
        entry["bytes"] = n
        manifest[name] = entry
        print(f"{name:12s} {kind:6s} {size:4d}px  {n / 1024:6.1f} KB")

    for name, (cells, size, mode) in ATLASES.items():
        if not all((SRC / f"{c}.png").exists() for c in cells):
            print(f"skip {name}: missing a cell source")
            continue
        half = size // 2
        atlas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        for i, c in enumerate(cells):
            sprite = fit_sprite(Image.open(SRC / f"{c}.png"), half, ALIGN.get(c, "center"), MIN_ASPECT.get(c, 0.0))
            if mode == "tint":
                sprite = tint_sprite(sprite)
            atlas.alpha_composite(sprite, ((i % 2) * half, (i // 2) * half))
        n = save_webp(bleed(atlas), OUT / f"{name}.webp")
        total += n
        manifest[name] = {"url": f"/textures/{name}.webp", "kind": mode, "bytes": n, "cells": cells}
        print(f"{name:12s} atlas  {size:4d}px  {n / 1024:6.1f} KB")

    # landing key art + social card
    hero = SRC / "landing-hero.png"
    if hero.exists():
        im = Image.open(hero).convert("RGB")
        for w in (1200, 800):
            h = round(im.height * w / im.width)
            n = save_webp(im.resize((w, h), Image.LANCZOS), ROOT / "public" / "poster" / f"landing-{w}.webp")
            print(f"poster {w}w  {n / 1024:6.1f} KB")
        og = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        top = max(0, (og.height - 630) // 2)
        og = og.crop((0, top, 1200, top + 630))
        og.save(ROOT / "public" / "og-image.jpg", "JPEG", quality=86, optimize=True, progressive=True)
        print(f"og-image   {(ROOT / 'public' / 'og-image.jpg').stat().st_size / 1024:6.1f} KB")

    body = json.dumps(manifest, indent=2)
    MANIFEST.write_text(
        "// Generated by scripts/build-textures.py — do not edit by hand.\n"
        "// `mean` is the tile's average colour in linear space (used to keep the shader's palette).\n"
        f"export const TEXTURES = {body} as const;\n\n"
        "export type TextureName = keyof typeof TEXTURES;\n",
        encoding="utf-8",
    )
    print(f"total game textures: {total / 1024:.0f} KB -> {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
