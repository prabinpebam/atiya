"""Build game-ready textures from the generated sources in assets-src/textures/.

Sources are original, AI-generated images (gpt-image-2.5, see the *.prompt.txt next to each
source). This script turns them into small, optimised WebP files in public/ and writes the
typed manifest src/game/world/textureManifest.ts (URLs + mean linear colours used by shaders) and
the style stats assets-src/textures/qa.json (checked by `scripts/gen-textures.py qa` and the unit tests).

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
    "moon": ("sprite", 256),
    # Chopper's curly coat (the fur shells' locks; chopper.md §2)
    "chopper-fur": ("mask", 256),
    # the family picnic blanket by the pond (family.md §3)
    "picnic-mat": ("decal", 256),
}
# 2×2 atlases: name -> (cell sources in order [top-left, top-right, bottom-left, bottom-right], size, mode)
# mode "tint" = normalised greyscale (tinted in game), "sprite" = full colour
ATLASES: dict[str, tuple[list[str], int, str]] = {
    "conifer-atlas": (["conifer-clump", "conifer-bough", "conifer-tufts", "conifer-crown"], 512, "tint"),
    "pond-atlas": (["pond-lilies", "pond-reeds", "pond-iris", "pond-fern"], 512, "sprite"),
}
# Painted sky clouds (art direction): four wide sprites in the 2:1 cells of a 1024×512 atlas, with
# each cloud's opaque rectangle recorded (UV, v up) so the game sizes its quad to the cloud, and a
# matching tangent-space normal atlas (a puffy dome from the alpha + the painted detail) so the
# clouds catch the day's light: name -> (cells [TL, TR, BL, BR], (width, height), normal-map name)
CLOUD_ATLAS = ("cloud-atlas", ["cloud-a", "cloud-b", "cloud-c", "cloud-d"], (1024, 512), "cloud-normal")
# Knee-high grass tufts (vegetation spec): eight 3–4-blade tufts (sliced from two generated sheets by
# scripts/slice-tufts.py) in a 4×2 grid of portrait cells, tintable greyscale, each standing on its
# cell's bottom edge; each tuft's opaque rectangle is recorded (UV, v up) so its card fits it
TUFT_ATLAS = ("tuft-atlas", [f"meadow-tuft-{i}" for i in range(1, 9)], (512, 512), (4, 2))
# Normal maps (tangent space, OpenGL convention), so textures react to the light:
#   sprite-height: a generated height map of a sprite (same framing), fitted with the sprite's alpha
#   atlas-dome:    derived from an atlas: a dome over each clump plus its painted shading as relief
#   tile-lum:      derived from a seamless tile's painted luminance (wrap-aware, stays seamless)
# (Leaf and conifer cards were tried and dropped: their painted sprites carry the relief already, and
# a per-leaf normal fights the canopy's volume shading.)
NORMALS: dict[str, tuple[str, str, int, float]] = {
    "grass-normal": ("tile-lum", "grass", 256, 5.0),
    "cobble-normal": ("tile-lum", "cobble", 256, 4.0),
}
# Masks whose large-scale value drift is divided out after the stretch (a wrap-aware blur of this
# fraction of the tile), so light walls can't read as blotchy or dirty whatever the painting drifts:
FLATTEN: dict[str, float] = {"surf-brick": 1 / 6, "surf-stone": 1 / 6, "surf-plaster": 1 / 8}
# Style QA (scripts/gen-textures.py qa, tests/unit/textures.test.ts): for every mask and tile, the
# spread of its value around the mean (std) and of the same blurred over 1/32 of the tile (blotch:
# per-unit value changes and mottling, the "dirty" signal), written to assets-src/textures/qa.json.
QA_JSON = SRC / "qa.json"
QA_BLUR = 1 / 32
# how a sprite sits in its square card: bottom = base touches the bottom edge (stems, grass, crown),
# top = hangs from the top edge (boughs)
ALIGN = {"leaf-broad": "bottom", "leaf-single": "center", "moon": "center",
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


def wrap_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur of a seamless square tile, wrapping at the edges (exact, via the FFT)."""
    f = np.fft.fftfreq(a.shape[0])
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (f[:, None] ** 2 + f[None, :] ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def style_stats(v: np.ndarray) -> dict[str, float]:
    """std and blotch (see QA_BLUR) of a tile's values relative to their mean."""
    r = v / max(float(v.mean()), 1e-6) - 1
    return {"std": round(float(r.std()), 4), "blotch": round(float(wrap_blur(r, v.shape[0] * QA_BLUR).std()), 4)}


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


def fit_rect(im: Image.Image, w: int, h: int, margin: float = 0.04) -> Image.Image:
    """Crop to the opaque bounds and fit, centred, into a w×h cell (keeping the aspect)."""
    im = im.convert("RGBA")
    a = np.asarray(im)[..., 3]
    a = np.where(a >= 250, 255, np.where(a <= 4, 0, a)).astype(np.uint8)
    im.putalpha(Image.fromarray(a))
    ys, xs = np.nonzero(a > 8)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = min(w * (1 - 2 * margin) / im.width, h * (1 - 2 * margin) / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    cell = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cell.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    return cell


def height_to_normal(hgt: np.ndarray, strength: float) -> Image.Image:
    """Tangent-space normal map (OpenGL convention: +x right, +y up the image) from a height field."""
    dy, dx = np.gradient(hgt.astype(np.float32))
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(hgt, np.float32)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(np.clip((n * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), "RGB")


def box_blur(a: np.ndarray, passes: int) -> np.ndarray:
    """Repeated 3×3 box blur of a float field (≈ Gaussian)."""
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[dy:dy + a.shape[0], dx:dx + a.shape[1]] for dy in range(3) for dx in range(3)) / 9
    return a


def edge_distance(mask: np.ndarray, limit: int) -> np.ndarray:
    """Approximate distance (px) from each inside pixel to the edge, by repeated 1-px erosion."""
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    depth = np.zeros(mask.shape, np.float32)
    for _ in range(limit):
        depth += np.asarray(im, np.float32) / 255
        im = im.filter(ImageFilter.MinFilter(3))
        if not np.asarray(im).any():
            break
    return depth


def wrap_normal(hgt: np.ndarray, strength: float) -> Image.Image:
    """Normal map of a tiling height field (central differences with wrap-around, so it tiles)."""
    dx = (np.roll(hgt, -1, axis=1) - np.roll(hgt, 1, axis=1)) * 0.5
    dy = (np.roll(hgt, -1, axis=0) - np.roll(hgt, 1, axis=0)) * 0.5
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(hgt, np.float32)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(np.clip((n * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), "RGB")


def atlas_rgba(cells: list[str], size: int) -> Image.Image:
    half = size // 2
    atlas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        sprite = fit_sprite(Image.open(SRC / f"{c}.png"), half, ALIGN.get(c, "center"), MIN_ASPECT.get(c, 0.0))
        atlas.alpha_composite(sprite, ((i % 2) * half, (i // 2) * half))
    return atlas


def build_normals(manifest: dict) -> int:
    total = 0
    for name, (mode, source, size, strength) in NORMALS.items():
        if mode == "sprite-height":
            albedo, height = SRC / f"{source}.png", SRC / f"{source}-height.png"
            if not (albedo.exists() and height.exists()):
                print(f"skip {name}: no source")
                continue
            h = Image.open(height).convert("L").resize(Image.open(albedo).size, Image.LANCZOS)
            rgba = Image.merge("RGBA", (h, h, h, Image.open(albedo).convert("RGBA").getchannel("A")))
            card = np.asarray(fit_sprite(rgba, size * 2, ALIGN.get(source, "center"), MIN_ASPECT.get(source, 0.0)), np.float32) / 255
            hgt = box_blur(card[..., 0] * (card[..., 3] > 0.5), 1)
            out = height_to_normal(hgt, strength * size * 2 / 256).resize((size, size), Image.LANCZOS)
        elif mode == "atlas-dome":
            cells = ATLASES[source][0]
            if not all((SRC / f"{c}.png").exists() for c in cells):
                print(f"skip {name}: missing a cell source")
                continue
            rgba = np.asarray(atlas_rgba(cells, size * 2), np.float32) / 255
            inside = rgba[..., 3] > 0.5
            depth = box_blur(edge_distance(inside, size // 4), 4) * inside
            t = np.clip(depth / max(1.0, float(depth.max())), 0, 1)
            lum = rgba[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            detail = lum - box_blur(lum, 3)
            hgt = box_blur(np.sqrt(1 - (1 - t) ** 2) * depth.max() * 0.25 + detail * 12.0 * np.clip(depth / 3.0, 0, 1), 1)
            out = height_to_normal(hgt, strength).resize((size, size), Image.LANCZOS)
        else:  # tile-lum
            src = SRC / f"{source}.png"
            if not src.exists():
                print(f"skip {name}: no source")
                continue
            tile = np.asarray(resize_tileable(Image.open(src), size).convert("L"), np.float32) / 255
            out = wrap_normal(tile - tile.mean(), strength)
        n = save_webp(out, OUT / f"{name}.webp")
        manifest[name] = {"url": f"/textures/{name}.webp", "kind": "normal", "bytes": n}
        total += n
        print(f"{name:18s} normal {size:4d}px  {n / 1024:6.1f} KB")
    return total


def build_tuft_atlas(manifest: dict) -> int:
    name, cells, (w, h), (cols, rows) = TUFT_ATLAS
    if not all((SRC / f"{c}.png").exists() for c in cells):
        print(f"skip {name}: missing a cell source")
        return 0
    cw, ch = w // cols, h // rows
    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rects = []
    for i, c in enumerate(cells):
        im = Image.open(SRC / f"{c}.png").convert("RGBA")
        a = np.asarray(im)[..., 3]
        ys, xs = np.nonzero(a > 8)
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        s = min(cw * 0.94 / im.width, ch * 0.97 / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        x0, y0 = (i % cols) * cw + (cw - im.width) // 2, (i // cols) * ch + ch - im.height - 1
        atlas.alpha_composite(tint_sprite(im), (x0, y0))
        rects.append([round(x0 / w, 5), round(1 - (y0 + im.height) / h, 5), round((x0 + im.width) / w, 5), round(1 - y0 / h, 5)])
    total = save_webp(bleed(atlas), OUT / f"{name}.webp")
    manifest[name] = {"url": f"/textures/{name}.webp", "kind": "tint", "bytes": total, "cells": cells, "rects": rects}
    print(f"{name:12s} atlas  {w}x{h}  {total / 1024:6.1f} KB")
    return total


def build_cloud_atlas(manifest: dict) -> int:
    name, cells, (w, h), normal_name = CLOUD_ATLAS
    if not all((SRC / f"{c}.png").exists() for c in cells):
        print(f"skip {name}: missing a cell source")
        return 0
    cw, ch = w // 2, h // 2
    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rects = []
    for i, c in enumerate(cells):
        cell = fit_rect(Image.open(SRC / f"{c}.png"), cw, ch)
        x0, y0 = (i % 2) * cw, (i // 2) * ch
        atlas.alpha_composite(cell, (x0, y0))
        a = np.asarray(cell)[..., 3]
        ys, xs = np.nonzero(a > 8)
        bx0, bx1, by0, by1 = x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1
        rects.append([round(bx0 / w, 5), round(1 - by1 / h, 5), round(bx1 / w, 5), round(1 - by0 / h, 5)])
    total = save_webp(bleed(atlas), OUT / f"{name}.webp")
    manifest[name] = {"url": f"/textures/{name}.webp", "kind": "sprite", "bytes": total, "cells": cells, "rects": rects}
    print(f"{name:12s} atlas  {w}x{h}  {total / 1024:6.1f} KB")
    # normal atlas at half resolution: each cloud bulges like a dome from its rim to its middle
    # (a spherical cap over the distance to the edge), with the painted puffs as gentle relief
    rgba = np.asarray(atlas, np.float32) / 255
    alpha = rgba[..., 3]
    depth = box_blur(edge_distance(alpha > 0.5, int(ch * 0.3)), 8) * (alpha > 0.5)  # soften the medial ridges
    reach = max(1.0, float(depth.max()))
    t = np.clip(depth / reach, 0, 1)
    dome = np.sqrt(1 - (1 - t) ** 2)
    lum = rgba[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    detail = lum - np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
    inner = np.clip(depth / 6.0, 0, 1)  # no relief ridge along the silhouette
    hgt = dome * reach * 0.35 + detail * 18.0 * inner
    hgt = box_blur(hgt, 2)
    nmap = height_to_normal(hgt, strength=1.0).resize((w // 2, h // 2), Image.LANCZOS)
    n = save_webp(nmap, OUT / f"{normal_name}.webp")
    manifest[normal_name] = {"url": f"/textures/{normal_name}.webp", "kind": "normal", "bytes": n}
    print(f"{normal_name:12s} normal {w // 2}x{h // 2}  {n / 1024:6.1f} KB")
    return total + n


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


# loading tiers (progressive-loading.md §5.7); anything not listed is tier 1
TIERS = {
    "conifer-atlas": 2,
    "pond-atlas": 2,
    "cloud-atlas": 2,
    "cloud-normal": 2,
    "tuft-atlas": 2,
    "chopper-fur": 2,
    "picnic-mat": 2,
    "moon": 3,
}


def save_webp(im: Image.Image, path: Path, lossless=False) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    kw = {"lossless": True} if lossless else {"quality": 88, "method": 6}
    if im.mode == "RGBA":
        kw["exact"] = True  # keep bled colour under transparent pixels
    im.save(path, "WEBP", **kw)
    return path.stat().st_size


def main() -> None:
    manifest: dict[str, dict] = {}
    qa: dict[str, dict] = {}
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
            qa[name] = {"kind": kind, **style_stats(lin @ np.array([0.2126, 0.7152, 0.0722], np.float32))}
        elif kind == "mask":
            g = np.asarray(resize_tileable(im, size).convert("L"), np.float32)
            lo, hi = np.percentile(g, [1, 99.5])
            g = np.clip((g - lo) / max(hi - lo, 1), 0, 1)
            if name in FLATTEN:
                low = wrap_blur(g, size * FLATTEN[name])
                g = np.clip(g / np.maximum(low, 0.05) * low.mean(), 0, 1)
                lo, hi = np.percentile(g, [1, 99.5])
                g = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
            qa[name] = {"kind": kind, **style_stats(g)}
            g = np.clip(g * 255, 0, 255).astype(np.uint8)
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

    total += build_cloud_atlas(manifest)
    total += build_tuft_atlas(manifest)
    total += build_normals(manifest)

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

    # Chopper's photos for his profile card (fetched only when it opens; chopper.md §5)
    for i in (1, 2):
        photo = ROOT / "assets-src" / "chopper" / f"chopper-photo-{i}.png"
        if photo.exists():
            im = Image.open(photo).convert("RGB")
            w = 900
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            dst = ROOT / "public" / "chopper" / f"chopper-{i}.webp"
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.save(dst, "WEBP", quality=86, method=6)
            print(f"chopper-{i}  {im.width}x{im.height}  {dst.stat().st_size / 1024:6.1f} KB")

    # the loading tier each texture is fetched in (progressive-loading.md §5.7): 1 before the planet is
    # live (the ground, the water, the plaza, the kit's surfaces and the leaves the landmarks use),
    # 2 while it's summoned (the props', the home's, Chopper's, the grass's and the clouds'), 3 when idle
    for name, entry in manifest.items():
        entry["tier"] = TIERS.get(name, 1)
    body = json.dumps(manifest, indent=2)
    MANIFEST.write_text(
        "// Generated by scripts/build-textures.py — do not edit by hand.\n"
        "// `mean` is the tile's average colour in linear space (used to keep the shader's palette).\n"
        f"export const TEXTURES = {body} as const;\n\n"
        "export type TextureName = keyof typeof TEXTURES;\n",
        encoding="utf-8",
    )
    print(f"total game textures: {total / 1024:.0f} KB -> {MANIFEST.relative_to(ROOT)}")
    QA_JSON.write_text(json.dumps(qa, indent=2) + "\n", encoding="utf-8")
    print(f"style stats -> {QA_JSON.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
