# Texture style pipeline

Every painted surface texture in the game is made by one pipeline, so new textures match the approved ones instead of each prompt drifting into its own style. It mirrors the item-icon pipeline ([`assets-src/icons/README.md`](https://github.com/prabinpebam/atiya/blob/main/assets-src/icons/README.md)): frozen style references, a fixed style block per class, image-to-image generation, and a measured check.

## Why

The stone, brick and plaster textures had each been generated from a text prompt alone. Against the owner-approved wood and shingles, they read as "assorted assets from different art styles":

- **Brick and stone** varied in value from one block to the next, so light walls read as dirty rather than painted.
- **Plaster** had large grey blotches, which made the Town Hall look like dirty marble.
- **The cobble apron** was big, saturated, contrasty stones with dark earth and moss joints. The concept art shows small pale flagstones.
- **Wrong material choices:** the campfire stones used the laid-masonry mask, and the Town Hall's and Library's columns were "stone" (blocks) rather than clean painted columns.

Measured the way the game shows them (see [Build and QA](#build-and-qa) below), the old masonry and plaster were 2–3 times as blotchy as the wood, and the cobble tile was 5 times as contrasty as the lawn.

## The golden style set (frozen)

`assets-src/textures/style/` holds the references every texture is painted against. `python scripts/gen-textures.py golden` assembles them once; they are then frozen.

| Reference | Source | What it carries |
|---|---|---|
| `anchor-wood.png` | the approved `surf-wood` mask | brushwork, value range and softness of a greyscale detail mask |
| `anchor-shingle.png` | the approved `surf-shingle` mask | how units and joints are drawn (soft edges, one shadow line) |
| `concept-masonry.png` | crop of [concept 01](art-direction/concepts/01-plaza.jpg), beside the Town Hall | clean, pale, evenly painted blocks: no per-block value changes |
| `concept-paving.png` | crop of concept 01, beside the Post Office | the pale flagstones' palette, size and gentle contrast |

Never regenerate a reference without regenerating every texture made from it.

## Classes and the fixed style block

Each texture belongs to a **style class**. The class fixes its references and its style block, so only the subject line changes from one texture to the next (`CLASSES` and `MATERIALS` in `scripts/gen-textures.py`):

- **`mask`** (greyscale detail masks for the kit surfaces), with references wood + shingle + masonry. The block's value rules say:
  - the whole surface reads as one material painted one even colour;
  - every unit (brick, block, stone) has the same value as its neighbours;
  - form comes only from thin, soft joints and a faint bevel;
  - no patches, stains, dirt, weathering, cracks, speckles, noise or large-scale mottling.
- **`ground`** (colour ground tiles), with references paving + masonry. All the stones sit in a narrow, light value range, the joints are only slightly darker than the stones, and there's no dark earth, moss or mottling.

Every subject line gives the scale in real terms (for example "about 16 courses and 6 bricks per course"), because the kit maps one tile to a fixed number of world units (`SURFACE_TILE_U`).

## Laying: seamless tile or periodic cut

- **`tile`**, for organic surfaces (plaster, flagstones, ashlar): the gpt-image-2-5 skill's `tile` command, image-to-image with the references, then its masked seam-repair passes.
- **`periodic`**, for regular bonds (brick). A seam repair smears regular courses; the first brick attempt came out with melted bricks along the seams. So the brick is painted as a plain image-to-image picture. `periodic_tile` then:
  1. measures its course height and brick length by autocorrelation;
  2. cuts a whole number of repeats from the middle (10 courses, and as many bricks as keep the tile square);
  3. cross-fades the wrap using the painting's own continuation past the cut.

  The result repeats exactly, and every brick is the painter's own.

## Build and QA

`python scripts/gen-textures.py build` runs `scripts/build-textures.py` and then `qa`:

1. **Build.** Masks are stretched to 0…1 as before. Masonry and plaster (`FLATTEN`) then have their large-scale drift divided out by a wrap-aware blur, so a light wall can't go blotchy whatever the painting does. The build writes each mask's and tile's stats to `assets-src/textures/qa.json`.
2. **Measure as shown.** The kit shader applies a mask as `d = 1 + s·(tex/mean − 1)`, with a per-surface strength `s` (`SURFACE_TEX` in `rockDetail.ts`). So `qa` multiplies each mask's stats by its `s`. Two numbers per texture:
   - **std** is the overall contrast;
   - **blotch** is the std after a blur over 1/32 of the tile. That's per-unit value changes and mottling: the "dirty" signal. Fine grain and thin joints average out.
3. **Limits per class** (`style/limits.json`, calibrated on the approved textures). `qa` exits non-zero on a violation, and `tests/unit/textures.test.ts` enforces the same limits in CI. A new kit surface can't ship without a QA class.
4. **Review.** `style/contact-sheet.png` shows every texture tinted with its in-game colour at its runtime strength, all at one world scale. Look at it, and at the game, before accepting a texture.

| Class | std ≤ | blotch ≤ | Calibrated on |
|---|---|---|---|
| detail (wood, shingle, iron, canvas, bark, rock) | 0.28 | 0.065 | the approved wood (0.25 / 0.034) and shingle (0.18 / 0.057) |
| masonry (brick, stone) | 0.12 | 0.035 | "painted over": about half the wood's contrast, and no per-block changes |
| plaster | 0.06 | 0.02 | a clean limewash, barely there |
| ground (grass, dirt, sand) | 0.12 | 0.035 | the lawn tiles |
| paving (cobble) | 0.18 | 0.06 | below the concept art's flagstones (0.26 there, lighting included) |

## As built (2026-09-26)

| Texture | Before (std / blotch as shown) | After | Change |
|---|---|---|---|
| surf-brick | 0.247 / 0.079 | 0.104 / 0.012 | periodic cut of a painted-white brick wall; strength 0.7 → 0.3 |
| surf-stone | 0.219 / 0.071 | 0.103 / 0.021 | even ashlar blocks; strength 0.6 → 0.4 |
| surf-plaster | 0.141 / 0.059 | 0.041 / 0.014 | faint limewash strokes; strength 0.32 → 0.1 |
| cobble | 0.582 / 0.219 | 0.162 / 0.051 | pale flagstones like the concept; tile 2.2 → 1.5 u (smaller stones), relief 1.0 → 0.45 |

And in the models:

- **Town Hall**: the walls are painted brick in warm white (`#f7efe2`, was peach), the band courses are the same paint a shade deeper, and the portico columns are clean painted white with no masonry mask. The portico is a solid stone platform from the ground up to the door's sill (0.28 u; it was a slab floating above two short steps that didn't reach it), with three steps climbing to it.
- **Library**: the columns are clean painted white with no masonry mask.
- **Natural stones use the new `rock` surface** (the boulders' granite mask at strength 0.35), not the laid-masonry `stone`. That covers the campfire ring, the lighthouse's rocky base and the bridge abutments' loose stones.

## Adding or changing a texture

1. Add its entry to `MATERIALS` (class, subject with real-terms scale, laying) and its QA class to `style/limits.json`.
2. Run `python scripts/gen-textures.py tex <name>`. This writes `<name>.png` and `<name>.prompt.txt`, and for periodic textures `<name>.raw.png`.
3. Run `python scripts/gen-textures.py build`, fix any QA failure (regenerate, or lower the runtime strength), and review `style/contact-sheet.png` and the game.
4. Log the generation in `assets-src/CREDITS.md`.

Rules:

- Only masks change the look through `SURFACE_TEX` strengths; never exceed the class limits to "make it pop".
- A clean painted part (columns, trims, posts) is **untagged** (plain paint), not a masonry surface.
- Loose natural stones are `rock`; laid masonry is `stone`; painted brick is `brick`.
