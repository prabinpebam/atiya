# Asset credits

All 3D geometry in the POC is **original**, built procedurally from three.js primitives (rounded boxes, cones, cylinders, spheres, lathes, tori, extrusions) by the geometry kit in `src/game/world/` and `src/game/player/`. The one exception is the **player character**, a CC0 Kenney model listed below. There are no other third-party models, fonts, audio or animations. The ground patterns are a procedural shader, detailed with the generated textures below.

**Generated textures and art (original):** the hand-painted ground tiles (grass, dirt, cobbles, sand, riverbed, rock, water caustics, a subtle painted brush grain for the buildings), the foliage, conifer, pond-plant (lily pads, reeds with cattails, irises, fern), grass and flying-leaf sprites, the moon, and the landing key art and social card were generated for this project with OpenAI **GPT Image 2.5** (`gpt-image-2.5-sunburst` via Azure OpenAI) on 2026-09-24. Sources and the exact prompt for each are in [`textures/`](./textures/) (`<name>.png` + `<name>.prompt.txt`). The only image inputs were this project's own screenshots, used as palette/style references. Tiles were made seamless with the offset-and-inpaint pass of the `gpt-image-2-5` skill. `scripts/build-textures.py` builds the WebP files in `public/textures/`, `public/poster/` and `public/og-image.jpg`. No third-party IP was prompted for or referenced.

Fonts are the visitor's system fonts (Segoe UI / system-ui); nothing is loaded from a CDN.

**Style reference:** Animal Crossing: New Horizons screenshots (Nookipedia, 2026-09-24) were viewed during development for general style cues only: proportions, bevelled forms, roof, door and window vocabulary, tree and flower shapes, and the tilt-shift look. They are **not** stored in this repository, and no Nintendo characters, logos, buildings, names, text or UI were copied.

When third-party assets are added, list each here with source URL and license. Only CC0 or original assets are allowed (see [AGENTS.md](../AGENTS.md)):

| Asset | Source URL | License | Used in |
|---|---|---|---|
| Animated Characters: Protagonists 1.1 (model `characterMedium`, Idle/Run/Jump animations, `skaterMaleA` skin) by Kenney | https://kenney.nl/assets/animated-characters-protagonists (source files in `assets-src/kenney_animated-characters-protagonists/`, incl. `License.txt`) | CC0 1.0 | `public/models/character.glb` (built by `npm run build:character`), the player character |
