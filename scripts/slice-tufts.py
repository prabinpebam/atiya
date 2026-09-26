"""Slice the generated tuft sheets (meadow-tufts-1/2.png, four tufts each) into single sprites
meadow-tuft-1…8.png: each tuft is the run of image columns between clear gaps of transparency.

Run after regenerating a sheet; scripts/build-textures.py then packs the tufts into `tuft-atlas`.
"""
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "assets-src" / "textures"


def runs(mask: np.ndarray, min_gap: int = 12, min_width: int = 20) -> list[tuple[int, int]]:
    """Column ranges where `mask` is set, merged across gaps narrower than `min_gap`."""
    out: list[list[int]] = []
    for x in np.nonzero(mask)[0]:
        if out and x - out[-1][1] <= min_gap:
            out[-1][1] = x
        else:
            out.append([x, x])
    return [(a, b + 1) for a, b in out if b + 1 - a >= min_width]


def main() -> None:
    k = 1
    for sheet in ("meadow-tufts-1", "meadow-tufts-2"):
        im = Image.open(SRC / f"{sheet}.png").convert("RGBA")
        a = np.asarray(im)[..., 3]
        cols = runs((a > 24).sum(axis=0) > 2)
        # the four widest runs, left to right
        cols = sorted(sorted(cols, key=lambda r: r[1] - r[0], reverse=True)[:4])
        if len(cols) != 4:
            raise SystemExit(f"{sheet}: expected 4 tufts, found {len(cols)}")
        for x0, x1 in cols:
            part = im.crop((max(0, x0 - 4), 0, min(im.width, x1 + 4), im.height))
            pa = np.asarray(part)[..., 3]
            ys, xs = np.nonzero(pa > 8)
            part = part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            part.save(SRC / f"meadow-tuft-{k}.png")
            print(f"meadow-tuft-{k}: {part.width}x{part.height} from {sheet} [{x0}, {x1})")
            k += 1


if __name__ == "__main__":
    main()
