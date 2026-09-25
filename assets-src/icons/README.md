# Item icons: the golden style set

Every inventory icon is generated with GPT Image 2.5, image-to-image against a **frozen golden style set**, so all icons look like one hand drew them. The rules and the pipeline are in [`scripts/gen-icons.py`](../../scripts/gen-icons.py); the game-side design is in [collection-inventory.md §6](../../documentation/poc-3d-navigation/collection-inventory.md).

## The golden set (`style/`)

- `golden-sheet.png`: four style exemplars (a spotted toadstool, a wooden bucket, a blue crystal cluster, a four-leaf clover), painted **together in one call** from the landing key art (`public/og-image.jpg`). They're deliberately *not* game items, so no icon copies a reference's subject; one call guarantees they share one style. Its prompt is in `golden-sheet.prompt.txt`.
- `golden-1.png` … `golden-4.png`: the sheet sliced into its four cells (`gen-icons.py slice`). **These four are the only references any icon is generated with.**
- **Frozen:** don't regenerate the golden set unless you regenerate every icon with it. A new golden set means a new style.

## Style rules (the fixed style block, `STYLE` in the script)

- 3/4 view from slightly above; chunky, rounded, simplified shapes.
- A bold silhouette that's recognisable at 32 px (squint test), and distinct from every other item's.
- Soft painterly cel shading in three tone steps; warm sunlight from the **upper left**, a cool shadow side, and one small soft white highlight.
- A clean dark warm-brown outline of even medium weight round the whole silhouette.
- Saturated but soft colours; each item has its own dominant colour.
- Transparent background: no text, labels, frame, backdrop or ground shadow.

Only the subject line (`ITEMS`) changes from icon to icon.

## Colour variants

Flowers come in the planet's seven bloom colours. Each flower kind is painted once, with **white** petals. `build` re-tints the petal pixels (light and nearly neutral) to each colour while keeping their painted shading, much as Minecraft uses tint layers. So the seven tulips share one drawing and differ only in colour.

The crafting chunk's paint pots work the same way: one pot of **white** paint is painted, and `build` re-tints it (`paint-<colour>`) to each bloom colour. Planks, the wooden beam and the stone slab are painted directly.

## Commands

```
python scripts/gen-icons.py golden          # once: the golden sheet (then review and freeze)
python scripts/gen-icons.py slice           # cut it into style/golden-1..4.png
python scripts/gen-icons.py icon <id>       # one item (image-to-image with the four golden refs)
python scripts/gen-icons.py all [--force]   # every item without a source
python scripts/gen-icons.py build           # public/icons/*.webp + src/game/inventory/iconManifest.ts + contact-sheet.png
```

- **Sources:** each generated source is kept here as `<id>.png`, with the exact prompt in `<id>.prompt.txt`.
- **Build output:** 96×96 WebP files (36 icons, ≈ 108 KB in total). Review `contact-sheet.png` after every build.
- **Adding an item:** add it to `ITEMS` in the script and in `src/game/inventory/items.ts`, run `icon <id>`, view the result, then run `build`.
