# Surface textures

The sources for `public/textures/*.webp`: every `<name>.png` sits next to the exact prompt it was generated with (`<name>.prompt.txt`). `python scripts/build-textures.py` builds the WebPs, `src/game/world/textureManifest.ts` and `qa.json`. Never hand-edit those outputs.

Stone, brick, plaster and paving (and any new surface texture) are made by the **texture style pipeline**. It's documented in [art-pipeline.md](../../documentation/poc-3d-navigation/art-pipeline.md):

```
python scripts/gen-textures.py golden          # once: the frozen style references in style/
python scripts/gen-textures.py tex surf-brick  # paint one texture image-to-image against them
python scripts/gen-textures.py build           # build + style QA + style/contact-sheet.png
```

- `style/`: the frozen golden references (never regenerate one alone), `limits.json` (QA classes and limits, also enforced by `tests/unit/textures.test.ts`) and the review contact sheet.
- `qa.json` (generated): each mask's and tile's contrast (std) and blotchiness, before the runtime strength is applied.
- `<name>.raw.png`: the uncut painting behind a periodic texture (the brick), kept so it can be re-cut.
