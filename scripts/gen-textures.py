"""Surface textures: a frozen golden style set, generation against it, and a measured style QA.

The consistency system (see assets-src/textures/README.md and
documentation/poc-3d-navigation/art-pipeline.md):

1. `golden`  assembles the frozen style references in assets-src/textures/style/ from approved art:
             the owner-approved wood and shingle masks (the style anchors) and two crops of the
             concept art (clean pale masonry, pale flagstone paving). Run once; never regenerate one
             reference without regenerating every texture made from it.
2. `tex N`   paints texture N image-to-image with its class's references, the class's fixed style
             block (STYLE) and the texture's subject line (MATERIALS), as a seamless tile (the
             gpt-image-2-5 skill's `tile` command). Only the subject changes between textures.
3. `build`   runs scripts/build-textures.py (web build + assets-src/textures/qa.json), then `qa`.
4. `qa`      measures every surface texture as the game shows it (mask stats times the runtime strength
             from rockDetail.ts) against the class limits in style/limits.json, prints the table, and
             writes style/contact-sheet.png (each texture tinted with its in-game colour, at the same
             world scale), exiting non-zero on a violation. tests/unit/textures.test.ts enforces the
             same limits.

Generation calls the gpt-image-2-5 skill CLI (Azure OpenAI GPT Image 2.5); the key is read from
Windows Credential Manager by that CLI and never appears here.

  python scripts/gen-textures.py golden [--force]
  python scripts/gen-textures.py tex surf-brick [--quality high]
  python scripts/gen-textures.py build
  python scripts/gen-textures.py qa
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "textures"
STYLE_DIR = SRC / "style"
PUBLIC = ROOT / "public" / "textures"
QA_JSON = SRC / "qa.json"
LIMITS = STYLE_DIR / "limits.json"
IMG = Path(os.environ.get("USERPROFILE", "~")) / ".copilot" / "skills" / "gpt-image-2-5" / "scripts" / "imagegen.py"
CONCEPT = ROOT / "documentation" / "poc-3d-navigation" / "art-direction" / "concepts" / "01-plaza.jpg"

#: The frozen references: file -> (source, crop box in the source or None, size).
GOLDEN: dict[str, tuple[Path, tuple[int, int, int, int] | None, int]] = {
    "anchor-wood.png": (SRC / "surf-wood.png", None, 512),
    "anchor-shingle.png": (SRC / "surf-shingle.png", None, 512),
    # the concept's clean pale block plinth and walls beside the Town Hall
    "concept-masonry.png": (CONCEPT, (1100, 560, 1300, 760), 512),
    # the concept's pale flagstones beside the Post Office
    "concept-paving.png": (CONCEPT, (290, 660, 450, 820), 512),
}

#: Style classes: the references and the fixed style block every texture of the class is painted with.
CLASSES: dict[str, dict] = {
    "mask": {
        "refs": ["anchor-wood.png", "anchor-shingle.png", "concept-masonry.png"],
        "style": (
            "Paint a NEW greyscale detail texture for the same cozy, toy-like, hand-painted life-sim game, in "
            "exactly the same style as the reference textures: the same soft, clean painterly brushwork, the same "
            "gentle value range and the same flat, even light as the approved painted wood grain and wooden "
            "shingles, and the same clean, pale, evenly painted masonry as the concept art. VALUE RULES: the whole "
            "surface reads as one material painted one even colour; every repeated unit (brick, block, stone) has "
            "the same light value as its neighbours; form is shown only by thin, soft joints and a faint soft bevel "
            "along the unit edges; no dark or light patches, no stains, dirt, grime, soot, weathering, cracks, chips, "
            "speckles or noise, no large-scale mottling. Subject: {subject}. Monochrome neutral light greys only "
            "(#cfcbc6 to #f4f2ef, joints no darker than #b4afa9), no colour, no objects, no text."
        ),
    },
    "ground": {
        "refs": ["concept-paving.png", "concept-masonry.png"],
        "style": (
            "Paint a NEW ground texture for the same cozy, toy-like, hand-painted life-sim game, in exactly the same "
            "style and palette as the pale paving in the reference concept art: the same soft, clean painterly "
            "brushwork, pale warm colours and gentle contrast. VALUE RULES: all the stones lie within a narrow, light "
            "value range (no stone darker or more saturated than its neighbours); the joints are only slightly darker "
            "than the stones; each stone has only a very soft lighter centre and a faint soft shade along its edge; "
            "no dark earth, moss, stains, dirt, cracks, speckles or noise, no large-scale mottling. Subject: "
            "{subject}. No objects, no grass, no text."
        ),
    },
}

#: Textures made by this pipeline: name -> (style class, subject, laying). Their QA classes are in
#: style/limits.json. Laying "tile" = the skill's seamless `tile` command (organic surfaces);
#: "periodic" = a plain image-to-image painting of a regular bond, cut to a whole number of its own
#: repeats and cross-faded at the wrap (`periodic_tile`): a seam repair smears regular courses.
MATERIALS: dict[str, tuple[str, str, str]] = {
    "surf-brick": (
        "mask",
        "painted brick wall seen straight on: small bricks in a running bond, about 16 courses from top to bottom "
        "and 6 bricks per course from side to side, all bricks exactly the same size, courses perfectly horizontal "
        "and evenly spaced, each course offset by exactly half a brick; thin, shallow mortar joints about one tenth "
        "of the brick height; bricks with softly rounded corners and smooth flat faces, as if the whole wall had "
        "been painted over with white limewash; flat orthographic view, evenly lit, the bricks fill the whole frame",
        "periodic",
    ),
    "surf-stone": (
        "mask",
        "dressed ashlar stone wall seen straight on: smooth rectangular cut stone blocks in perfectly level courses, "
        "exactly 6 courses from top to bottom, each block two to three times as wide as it is tall, the vertical "
        "joints staggered between courses; thin soft joints, gently rounded block edges, and faces with only a faint "
        "soft chisel texture",
        "tile",
    ),
    "surf-plaster": (
        "mask",
        "smooth limewashed plaster wall seen straight on: an almost flat, light surface with only a few very faint, "
        "broad, soft trowel strokes in varied directions; no blocks, no lines, no cracks",
        "tile",
    ),
    "cobble": (
        "ground",
        "pale flagstone paving seen from directly above: flat, softly rounded, irregular flagstones of similar size "
        "packed closely together, about 9 stones across the image, in pale warm cream and very light warm greys "
        "(#efe7d8, #e6dccb, #ddd3c2, #d4cdc1); narrow joints of pale sandy grey (#c2b8a7)",
        "tile",
    ),
}
#: Courses per tile for the periodic bonds (the kit maps one tile to SURFACE_TILE_U world units).
COURSES: dict[str, int] = {"surf-brick": 10}

#: Contact-sheet tints (a representative in-game colour per surface) and world units per repeat.
PREVIEW: dict[str, tuple[str, float]] = {
    "surf-wood": ("#b98457", 0.8),
    "surf-shingle": ("#5b74d6", 0.9),
    "surf-plaster": ("#f3ead9", 1.3),
    "surf-stone": ("#efe3c8", 1.1),
    "surf-brick": ("#f7efe2", 0.8),
    "surf-metal": ("#5a5f66", 0.6),
    "surf-canvas": ("#e8d9b8", 0.3),
    "surf-bark": ("#7a5a3e", 0.9),
    "boulder": ("#a7a5a0", 0.7),
    "cobble": ("#ffffff", 1.5),
    "grass": ("#ffffff", 2.0),
    "dirt": ("#ffffff", 2.0),
}


def load_style() -> dict:
    return json.loads(LIMITS.read_text(encoding="utf-8"))


def runtime_strengths() -> dict[str, float]:
    """The per-surface strengths the kit shader applies (SURFACE_TEX in rockDetail.ts)."""
    src = (ROOT / "src" / "game" / "world" / "rockDetail.ts").read_text(encoding="utf-8")
    return {n: float(s) for n, s in re.findall(r"\['\w+', '([\w-]+)', ([\d.]+)\]", src)}


def run(args: list[str]) -> None:
    print(">", " ".join(a if " " not in a else f'"{a[:60]}…"' for a in args))
    subprocess.run([sys.executable, str(IMG), *args], check=True)


def cmd_golden(force: bool) -> None:
    STYLE_DIR.mkdir(parents=True, exist_ok=True)
    for name, (src, box, size) in GOLDEN.items():
        out = STYLE_DIR / name
        if out.exists() and not force:
            print("frozen, kept:", out.name)
            continue
        im = Image.open(src).convert("RGB")
        if box:
            im = im.crop(box)
        im.resize((size, size), Image.LANCZOS).save(out)
        print("wrote", out.relative_to(ROOT))


def _period(profile: np.ndarray, lo: int, hi: int) -> float:
    """The fundamental period of a 1-D profile (autocorrelation), refined on its furthest clear multiple."""
    p = profile - profile.mean()
    n = len(p)
    ac = np.correlate(p, p, "full")[n - 1 :] / np.arange(n, 0, -1)
    seg = ac[lo:hi]
    peaks = [i for i in range(1, len(seg) - 1) if seg[i] >= seg[i - 1] and seg[i] >= seg[i + 1]]
    top = max(seg[i] for i in peaks)
    base = lo + next(i for i in peaks if seg[i] >= 0.6 * top)
    best = float(base)
    for k in range(2, n // base):
        c = int(round(k * base))
        win = range(max(1, c - 3), min(n // 2, c + 4))
        if not len(win) or c > n * 0.6:
            break
        j = max(win, key=lambda i: ac[i])
        y0, y1, y2 = ac[j - 1], ac[j], ac[j + 1]
        den = y0 - 2 * y1 + y2
        best = (j + (0.5 * (y0 - y2) / den if abs(den) > 1e-9 else 0.0)) / k
    return best


def periodic_tile(im: Image.Image, courses: int, out: int = 1024, blend: int = 24) -> Image.Image:
    """Cut a running-bond painting to a whole number of its own repeats (`courses` courses, as many
    bricks as keep the tile square) and cross-fade the wrap, so it tiles exactly with no seam repair."""
    g = np.asarray(im.convert("L"), np.float32)
    H, W = g.shape
    rows = g.mean(1)
    h = _period(rows, H // 40, H // 4)  # course height
    ph = int(np.argmin(rows[: int(h) + 1]))  # a mortar line (joints are the darkest rows)
    y = np.arange(H)
    even = ((y - ph) % (2 * h) > 0.25 * h) & ((y - ph) % (2 * h) < 0.75 * h)
    w = _period(g[even].mean(0), W // 20, W // 2)  # brick length (one course's joints)
    courses += courses % 2
    bricks = max(1, round(courses * h / w))
    cw, ch = bricks * w, courses * h
    scale = (out + blend) / out
    if cw * scale > W - 8 or ch * scale > H - 8:
        sys.exit(f"painting too small for {courses} courses x {bricks} bricks (h={h:.1f}, w={w:.1f}px)")
    x0, y0 = (W - cw * scale) / 2, (H - ch * scale) / 2
    ext = np.asarray(
        im.convert("RGB").transform((out + blend, out + blend), Image.EXTENT, (x0, y0, x0 + cw * scale, y0 + ch * scale), Image.BICUBIC),
        np.float32,
    )
    t = (np.arange(blend, dtype=np.float32) / blend)[:, None, None]
    ext[:blend] = ext[out : out + blend] * (1 - t) + ext[:blend] * t
    t = t.reshape(1, blend, 1)
    ext[:, :blend] = ext[:, out : out + blend] * (1 - t) + ext[:, :blend] * t
    print(f"periodic: course {h:.2f}px, brick {w:.2f}px -> {courses} courses x {bricks} bricks")
    return Image.fromarray(np.clip(ext[:out, :out] + 0.5, 0, 255).astype(np.uint8))


def cmd_tex(name: str, q: str) -> None:
    cls, subject, lay = MATERIALS[name]
    refs = [STYLE_DIR / r for r in CLASSES[cls]["refs"]]
    missing = [r for r in refs if not r.exists()]
    if missing:
        sys.exit(f"missing golden refs: {missing} (run golden first)")
    prompt = CLASSES[cls]["style"].format(subject=subject)
    out = SRC / f"{name}.png"
    if lay == "periodic":
        raw = SRC / f"{name}.raw.png"
        args = ["edit", "-p", prompt, "-o", str(raw), "--size", "1024x1024", "--quality", q]
        for r in refs:
            args += ["-i", str(r)]
        run(args)
        periodic_tile(Image.open(raw), COURSES[name]).save(out)
        how = (
            "Image-to-image painting (imagegen.py edit) with the frozen golden references ({rel}); the raw painting "
            "is kept as {name}.raw.png. scripts/gen-textures.py periodic_tile then measured its course height and "
            f"brick length (autocorrelation), cut {COURSES[name]} courses and a whole number of bricks from the middle, "
            "and cross-faded the wrap, so the tile repeats exactly with no seam repair."
        )
    else:
        args = ["tile", "-p", prompt, "-o", str(out), "--quality", q]
        for r in refs:
            args += ["-r", str(r)]
        run(args)
        how = (
            "Seamless tile: imagegen.py tile, image-to-image with the frozen golden references ({rel}), then the "
            "tool's masked seam-repair passes. The tool prefixes the prompt with \"Using the reference image(s) only "
            "for material, palette, art style and scale, create …\" and appends its seamless-texture rules."
        )
    rel = ", ".join(f"assets-src/textures/style/{r.name}" for r in refs)
    (SRC / f"{name}.prompt.txt").write_text(
        f"Model: gpt-image-2.5 (Azure OpenAI), quality {q}, 1024x1024, generated {dt.date.today().isoformat()} "
        f"by scripts/gen-textures.py (style class '{cls}', laying '{lay}').\n"
        + how.format(rel=rel, name=name)
        + f"\n\nPrompt:\n{prompt}\n",
        encoding="utf-8",
    )


def measure() -> list[dict]:
    """Every classed texture's effective (as-shown) contrast and blotchiness."""
    stats = json.loads(QA_JSON.read_text(encoding="utf-8"))
    strength = runtime_strengths()
    classes = load_style()["textures"]
    rows = []
    for name, st in stats.items():
        cls = classes.get(name)
        if cls is None:
            continue
        s = strength.get(name, 1.0) if st["kind"] == "mask" else 1.0
        rows.append({"name": name, "class": cls, "s": s, "std": st["std"] * s, "blotch": st["blotch"] * s})
    return rows


def cmd_qa() -> int:
    limits = load_style()["classes"]
    bad = 0
    print(f"{'texture':14s} {'class':8s} {'s':>5s} {'std':>6s} {'max':>6s} {'blotch':>7s} {'max':>6s}")
    for r in measure():
        lim = limits[r["class"]]
        ok = r["std"] <= lim["std"] and r["blotch"] <= lim["blotch"]
        bad += not ok
        print(f"{r['name']:14s} {r['class']:8s} {r['s']:5.2f} {r['std']:6.3f} {lim['std']:6.3f} {r['blotch']:7.3f} {lim['blotch']:6.3f}  {'ok' if ok else 'FAIL'}")
    contact_sheet()
    return 1 if bad else 0


def contact_sheet(px_per_u: float = 200.0, cell: int = 320) -> None:
    """Each texture as the game shows it: its in-game colour modulated at the runtime strength (masks at 0.85
    exposure so light colours keep their highlights), tiled at a common world scale (px_per_u), so relative size
    and contrast can be judged side by side."""
    strength = runtime_strengths()
    names = [n for n in PREVIEW if (PUBLIC / f"{n}.webp").exists()]
    cols = 4
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 20)), (30, 27, 34))
    draw = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        tint, tile_u = PREVIEW[n]
        im = Image.open(PUBLIC / f"{n}.webp").convert("RGB")
        side = max(8, round(tile_u * px_per_u))
        im = im.resize((side, side), Image.LANCZOS)
        a = np.asarray(im, np.float32) / 255
        if n.startswith("surf-") or n == "boulder":
            g = a[..., 0]
            d = np.clip(1 + strength.get(n, 0.5) * (g / g.mean() - 1), 0.5, 1.4)
            col = np.array([int(tint[j : j + 2], 16) for j in (1, 3, 5)], np.float32) / 255
            a = np.clip(d[..., None] * col * 0.85, 0, 1)  # a little headroom, so light walls don't clip
        reps = cell // side + 1
        big = np.tile(a, (reps, reps, 1))[:cell, :cell]
        x, y = (i % cols) * cell, (i // cols) * (cell + 20)
        sheet.paste(Image.fromarray((big * 255 + 0.5).astype(np.uint8)), (x, y + 20))
        draw.text((x + 6, y + 4), f"{n}  ({tile_u} u)", fill=(235, 230, 240))
    sheet.save(STYLE_DIR / "contact-sheet.png")
    print("wrote", (STYLE_DIR / "contact-sheet.png").relative_to(ROOT))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["golden", "tex", "build", "qa"])
    ap.add_argument("name", nargs="?")
    ap.add_argument("--quality", default="high")
    ap.add_argument("--force", action="store_true", help="golden: overwrite the frozen references")
    a = ap.parse_args()
    if a.cmd == "golden":
        cmd_golden(a.force)
    elif a.cmd == "tex":
        if a.name not in MATERIALS:
            sys.exit(f"unknown texture {a.name!r}; one of {', '.join(MATERIALS)}")
        cmd_tex(a.name, a.quality)
    elif a.cmd == "build":
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build-textures.py")], check=True)
        sys.exit(cmd_qa())
    else:
        sys.exit(cmd_qa())


if __name__ == "__main__":
    main()
