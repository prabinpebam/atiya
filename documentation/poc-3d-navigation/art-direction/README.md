# Art direction — concept art from game screenshots

Seven game scenes were captured on a real GPU at 1536×1024 with the HUD hidden (`screenshots/`, taken before this art pass). Each was repainted with GPT Image 2.5 image-to-image (`concepts/`), with the landing key art ([`public/og-image.jpg`](https://github.com/prabinpebam/atiya/blob/main/public/og-image.jpg)) as a second, style reference. The prompts are in [`concepts/prompt.txt`](concepts/prompt.txt), and the night scene used [`concepts/prompt-night.txt`](concepts/prompt-night.txt). The concepts keep each shot's composition, camera, buildings and time of day, so they show the *same* scene rendered the way the game should look.

| Scene | Game (before) | Game (after this pass) | Concept |
|---|---|---|---|
| Plaza, morning | ![Plaza, morning, before](screenshots/01-plaza.jpg) | ![Plaza, morning, after](after/01-plaza.jpg) | ![Plaza, morning, concept](concepts/01-plaza.jpg) |
| Workshop | ![Workshop, before](screenshots/02-workshop.jpg) | ![Workshop, after](after/02-workshop.jpg) | ![Workshop, concept](concepts/02-workshop.jpg) |
| Pond, afternoon | ![Pond, afternoon, before](screenshots/03-pond.jpg) | ![Pond, afternoon, after](after/03-pond.jpg) | ![Pond, afternoon, concept](concepts/03-pond.jpg) |
| Waterfall mesa | ![Waterfall mesa, before](screenshots/04-waterfall.jpg) | ![Waterfall mesa, after](after/04-waterfall.jpg) | ![Waterfall mesa, concept](concepts/04-waterfall.jpg) |
| Bridge | ![Bridge, before](screenshots/05-bridge.jpg) | ![Bridge, after](after/05-bridge.jpg) | ![Bridge, concept](concepts/05-bridge.jpg) |
| Lighthouse, dusk | ![Lighthouse, dusk, before](screenshots/06-lighthouse-dusk.jpg) | ![Lighthouse, dusk, after](after/06-lighthouse-dusk.jpg) | ![Lighthouse, dusk, concept](concepts/06-lighthouse-dusk.jpg) |
| Town Hall, night | ![Town Hall, night, before](screenshots/07-plaza-night.jpg) | ![Town Hall, night, after](after/07-plaza-night.jpg) | ![Town Hall, night, concept](concepts/07-plaza-night.jpg) |

## What the concepts do differently

1. **Crisp, not blurred.** The whole planet reads sharply. The game's tilt-shift blurred the horizon ring and the foreground.
2. **Warm, directional sunlight.** A golden key light with lit and shaded sides on every form. The game was flat, because a strong sky fill washed the shading out.
3. **Sunlit meadow.** The grass is warm yellow-green, varied between sunlit drifts and cooler hollows, and dotted with tiny flowers. The game's grass was a flat saturated green.
4. **Abundant flowers.** White, yellow and pink clusters line every path and dot the grass. The game had a few sparse clumps.
5. **Canopies with lime sunlit tops** and deep green undersides, so each tree reads as a volume.
6. **Sky.** A deeper blue zenith; cumulus clouds with warm cream tops and blue-grey bases; a yellow sun.
7. **Dusk:** golden light raking across the grass, and pink clouds with warm rims.
8. **Night:** still readable. A cool moonlit blue-violet ambient over green grass, lilac-blue lit clouds, and warm lamp pools on the bricks and paths. The game's night was much darker.

## What was done (all within the performance budget)

| # | Change | Where | Cost |
|---|---|---|---|
| 1 | **Crisp picture:** the tilt-shift now only softens the very edges (focus area 0.86, feather 0.3, smallest kernel); it stays on | `Scene.tsx` | slightly cheaper blur |
| 2 | **Warm, directional light:** warmer and stronger sun (2.6), less sky fill (1.25), warmer ground bounce, deeper blue zenith; golden dusk (less orange, so the grass stays green); readable moonlit night (brighter cool ambient, moon 0.65) | `timeOfDay.ts` | none |
| 3 | **Painted clouds:** four generated cumulus paintings (true alpha) in a 1024×512 atlas, with a derived **normal map** (a puffy dome + the painted puffs) so the sun and moon light them: gold rims at dusk, lilac at night. Billboards turned with their ring (base toward the planet), 54 of them in one alpha-blended draw. The 3D puffs are the fallback | `Sky.tsx`, `clouds.ts`, `cloud-atlas` / `cloud-normal` | **−48 k triangles**, +135 KB download |
| 4 | **Sunlit meadow:** warm yellow-green drifts and cooler hollows; visible white, yellow and pink daisies on little leaf clumps (procedural); a **grass normal map** (derived from the painted tile, seamless, triplanar) so the lawn catches the light | `Planet.tsx`, `planetMaterial.ts`, `grass-normal` | 1–3 texture samples on grass pixels, +17 KB |
| 5 | **Abundant flowers:** flower clumps in the meadows, beside every path and round the plaza, plus **flowering sprigs** (≈ 150-triangle leaf tufts with blossoms, shadowless) that line the paths | `layout.ts`, `foliage.ts`, `Props.tsx` | ≈ +95 k triangles (instanced), +3 draw calls |
| 6 | **Canopies with lime sunlit tops:** warmer, brighter leaf palettes (the greyscale leaf sprite averages 0.6, so the cards are lifted ×1.2) | `foliage.ts` | none |
| 7 | **Stronger lamp pools** at night (intensity 4.2 → 5.2, reach 2.7 → 3.4 u) | `Plaza.tsx` | none |

Net, at the spawn view: **≈ 727 k triangles** (was 680 k), 142 draw calls, 0 Inf/NaN pixels, texture download 1.28 MB (≤ 1.5 MB), GPU texture memory ≈ 29 MB (≤ 32 MB).

**Tried and dropped:**
- **Normal maps on leaf and conifer cards**, from a generated height map of the leaf sprite. They made the crowns read *flatter*: the painted sprites already carry their relief, and a per-leaf normal fights the canopy's volume shading.
- **Full-size flower props everywhere**: at ≈ 700 triangles each, 600 of them added ≈ 300 k triangles. The cheap sprigs give the abundance instead.

**Still open:**
- the concepts' painterly density (many more small plants and bushes);
- the concepts' deeper, bluer shadow tones;
- more varied, rounder canopy silhouettes.

These need more geometry or new foliage art, and the triangle budget is already above target.
