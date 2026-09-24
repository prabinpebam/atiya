# Personal site — "Little Planet" 3D navigation POC

A personal portfolio site with two ways in:

- **Classic site** (`/classic/`): normal, fast, accessible pages.
- **Game mode** (`/play/`): a cozy 3D tiny planet. You walk a character around with **WASD**; walking up to a landmark previews that part of the portfolio, and **E** opens it. The classic site is always one click away.

Design docs: [spec](documentation/poc-3d-navigation/spec.md) · [plan](documentation/poc-3d-navigation/plan.md) · [Definition of Done](documentation/poc-3d-navigation/definition-of-done.md) · [research](documentation/poc-3d-navigation/research/). Agent conventions: [AGENTS.md](AGENTS.md).

| Spawn plaza | Proximity preview | Landmark dialog |
|---|---|---|
| ![Spawn view](documentation/poc-3d-navigation/screenshots/spawn.png) | ![Preview card](documentation/poc-3d-navigation/screenshots/proximity-preview.png) | ![Dialog](documentation/poc-3d-navigation/screenshots/landmark-dialog.png) |

| Lighthouse | Pond | Low quality tier |
|---|---|---|
| ![Lighthouse](documentation/poc-3d-navigation/screenshots/lighthouse.png) | ![Pond](documentation/poc-3d-navigation/screenshots/pond.png) | ![Low tier](documentation/poc-3d-navigation/screenshots/low-quality-tier.png) |

![Player character: walking toward the camera, from behind at the Workshop, running, idle](documentation/poc-3d-navigation/screenshots/character.png)

![Trees: leaf-card hardwoods (incl. fruit tree), cedars and leafy bushes](documentation/poc-3d-navigation/screenshots/trees.png)

**View controls.** The compass (bottom-right) always points to map north. Drag the planet, or use the buttons around the compass, to rotate and tilt the view. Click the compass to face north again, or **Reset** to fly back to the plaza.

| Rotated 45° (north is up-right) | Tumbled to a top view |
|---|---|
| ![Rotated view](documentation/poc-3d-navigation/screenshots/view-rotated.png) | ![Top view after dragging](documentation/poc-3d-navigation/screenshots/view-tumbled-top.png) |

**Day–night cycle.** One planet day takes about 6 minutes. You can also choose *Match my local time* or *Always daytime* under Menu → Time of day. Whatever the mode, the Town Hall's clock shows the real time on your device.

| Dawn | Golden hour | Dusk |
|---|---|---|
| ![Dawn](documentation/poc-3d-navigation/screenshots/daynight-dawn.png) | ![Golden hour](documentation/poc-3d-navigation/screenshots/daynight-golden-hour.png) | ![Dusk: sun setting right, moon rising left](documentation/poc-3d-navigation/screenshots/daynight-dusk.png) |

| Night at the plaza | Lighthouse at night | Fireflies at the pond |
|---|---|---|
| ![Night: lamps, light pools, stars, moon](documentation/poc-3d-navigation/screenshots/daynight-night.png) | ![Lighthouse at night](documentation/poc-3d-navigation/screenshots/daynight-lighthouse-night.png) | ![Pond with fireflies](documentation/poc-3d-navigation/screenshots/daynight-pond-fireflies.png) |

**Landscape & wind.** The land gently rolls. Rocky cliff mesas rise from it, and a stream runs from a waterfall down to the pond, passing under an arched plank bridge you can walk over. The stream flows straight into the pond: they share one water level and shader, so there's no rim or seam, and the pond's lobed shore is planted with painted reeds, cattails, irises, ferns and floating lily pads. You can wade through both: the character walks down onto the bed, slows to a knee-deep slosh, and leaves a foam collar and spreading wake rings. A breeze sways every tree, bush, flower and grass tuft; gusts blow leaves across the scene and now and then a soft wind swirl curls past.

| Bridge on the Greenhouse path | Waterfall mesa | Cliff mesa and boulders | Wading across the stream |
|---|---|---|---|
| ![Arched plank bridge over the stream](documentation/poc-3d-navigation/screenshots/landscape-bridge.png) | ![Waterfall pouring off a sandstone mesa](documentation/poc-3d-navigation/screenshots/landscape-waterfall.png) | ![Two-tier cliff mesa with boulders](documentation/poc-3d-navigation/screenshots/landscape-mesa.png) | ![Character wading knee-deep across the stream, with wake rings](documentation/poc-3d-navigation/screenshots/landscape-wading.png) |

| The stream | A gust: flying leaves and a swirl | Bridge lanterns at dusk | Waterfall at night |
|---|---|---|---|
| ![Meandering stream with pebbly banks](documentation/poc-3d-navigation/screenshots/landscape-river.png) | ![Leaves and a wind swirl blowing across the plaza](documentation/poc-3d-navigation/screenshots/wind-gust.png) | ![Bridge with glowing lanterns at dusk](documentation/poc-3d-navigation/screenshots/daynight-dusk-bridge.png) | ![Waterfall and stream at night](documentation/poc-3d-navigation/screenshots/daynight-night-waterfall.png) |

| Two-tier mesa: the upper tier sits inside a lower terrace, the lawn rolls over both rims, and the trees stand clear of the walls |
|---|
| ![Two-tier mesa with a lower terrace all the way round, trees on both levels clear of the cliff walls](documentation/poc-3d-navigation/screenshots/landscape-mesa-tiers.png) |

**Hand-painted textures.** The lawn, paths, cobbles, beach, riverbed, cliff strata, boulders, river caustics, leaf cards, conifer clumps and boughs, grass clumps, the moon, the compass-rose plaza and the buildings' materials (plank grain, roof shingles, brick, stone, plaster, metal and canvas) all use original, seamless or alpha textures generated with GPT Image 2.5, in the game's own palette. The landing page and social card use a painted key art of the planet.

| Painted compass-rose plaza, ground, cobbles and grass | Leaf-card trees | Cliff strata, boulders and caustics |
|---|---|---|
| ![Spawn plaza with the painted compass-rose decal and painted ground textures](documentation/poc-3d-navigation/screenshots/textures-spawn.png) | ![Hardwood trees with painted leaf clusters on low-poly faceted trunks with buttress roots](documentation/poc-3d-navigation/screenshots/textures-forest.png) | ![Waterfall mesa with painted strata, boulders and river](documentation/poc-3d-navigation/screenshots/textures-waterfall.png) |

| Organic cedars: grouped painted clumps and boughs | Painted moon at night | Landing page key art |
|---|---|---|
| ![Cedar trees built from grouped painted conifer clumps and drooping boughs](documentation/poc-3d-navigation/screenshots/textures-cedars.png) | ![Night sky with the painted moon](documentation/poc-3d-navigation/screenshots/textures-night-moon.png) | ![Landing page with the painted planet poster](documentation/poc-3d-navigation/screenshots/landing.png) |

| Per-surface materials: shingled roof, planked walls and doors, brick chimney, stone steps, timber bridge |
|---|
| ![Workshop with shingled roof, wooden siding and doors, brick chimney and stone steps, next to the timber bridge](documentation/poc-3d-navigation/screenshots/textures-surfaces.png) |

## Quick start

Prerequisites:
- Node ≥ 22.12 (tested on 24.13).
- npm pointed at the Microsoft package feed proxy (see [AGENTS.md](AGENTS.md)).

```powershell
npm ci                 # exact, pinned versions from package-lock.json
npm run dev            # http://localhost:4321  (landing) → /play/ (planet) · /classic/
```

| Script | What it does |
|---|---|
| `npm run dev` | Astro dev server (includes the `window.__game` test hook) |
| `npm run build` / `npm run preview` | Production build / serve `dist/` |
| `npm run build:test` | Non-deployable test build (`--mode test`, includes the test hook) |
| `npm run check` | `astro check` (TypeScript + Astro diagnostics) |
| `npm test` | Vitest unit tests (sphere math, collision, proximity, URL, gate, content validation, route test, day–night, compass, terrain, wind, texture manifest) |
| `npm run e2e` | Playwright E2E + axe (builds the test bundle, headless Chromium with SwiftShader) |
| `npm run size` | Bundle budget report for the current `dist/` |
| `npm run verify:prod` | Production build + budgets + checks the test hook is absent |
| `npm run build:character` | Rebuild `public/models/character.glb` from the Kenney FBX files. Needs FBX2glTF once: `npm install --prefix "%TEMP%\fbxconv" fbx2gltf@0.9.7`. Pass a skin name to swap outfits, e.g. `node scripts/build-character.mjs skaterFemaleA` |
| `python scripts/build-textures.py` | Rebuild `public/textures/*.webp`, the landing poster, the social card and `src/game/world/textureManifest.ts` from the generated sources in `assets-src/textures/`. Needs Python 3.10+ with Pillow and numpy. The outputs are committed |

First-time E2E setup: `npx playwright install chromium`. To use the installed Edge instead, set `PW_CHANNEL=msedge`.

## Controls

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Move | W A S D / arrow keys (screen-relative) | Click/tap the ground to walk there |
| Run | Hold Shift | — |
| Open a nearby place | E, Enter or Space | "Open" on the preview card |
| Travel directly | M (menu), then pick a place, or Tab to the hidden "Travel to a place" list | Click a building, or use Menu |
| Rotate the view | Hold `,` / `.` | Drag left/right, or ⟲ / ⟳ by the compass |
| Tilt the view | Hold Page Up / Page Down | Drag up/down, or ˄ / ˅ by the compass |
| Face north | N | Click the compass |
| Reset position & direction (back to the plaza, facing north) | H or Home | **Reset** under the compass |
| Close / back | Esc, or the browser Back button | Close button / backdrop |
| Classic site | Skip link (first Tab stop), or the header **Classic site** button | Header button |

Game keys only work while the planet has focus, and Tab is never captured. A short tap on the ground walks there; a drag turns and tilts the view instead.

## How it works

- **Movement: rotate the planet, not the player** (spec §5.2). The character stays still at the top of the planet and input rotates the planet underneath. The camera is fixed, with no pole flips.
  - Collision is kinematic (no physics engine): circles on the sphere, sliding, sub-stepping, and a push-out that doesn't twist the planet.
  - Code: [src/game/math/sphere.ts](src/game/math/sphere.ts), [src/game/systems/movement.ts](src/game/systems/movement.ts).
- **Proximity:** one global "nearby" landmark, with hysteresis, a switch margin and a 150 ms interact buffer ([src/game/systems/proximity.ts](src/game/systems/proximity.ts)).
- **View controls & compass** ([ViewControls.tsx](src/game/ui/ViewControls.tsx), [compass.ts](src/game/math/compass.ts)):
  - Rotating the view spins the planet about the player's vertical axis (`PlanetSim.rotateView`), and tilting changes the camera pitch (30°–78°).
  - The compass shows *map north* from a stereographic grid centred on the plaza, which sits on the pole where true north is undefined. At the plaza it points toward the Workshop.
  - Reset flies back to the plaza facing north.
- **Content:** a single source of truth in [src/content/landmarks/](src/content/landmarks/).
  - Frontmatter drives the game (placement and dialog copy); the Markdown body drives the classic page.
  - Cross-entry validation runs at build time ([src/game/math/landmarks.ts](src/game/math/landmarks.ts)).
- **Capability-gated loading** (spec §5.9):
  - `/play/` runs a 2.6 KB gate ([src/game/platform/gate.ts](src/game/platform/gate.ts)) that checks WebGL2, software rendering and Data Saver.
  - Only if the check passes does it `import()` the game bundle ([src/game/game-mount.tsx](src/game/game-mount.tsx)).
  - Unsupported devices get the classic site and never download 3D code.
- **UI:** everything you can act on is semantic DOM (`<dialog>`, buttons, links), in [src/game/ui/](src/game/ui/). There's a parallel landmark list and an `aria-live` region for announcements. All rules live in [src/game/controller.ts](src/game/controller.ts).
- **Art:** original procedural models in a soft, bevelled "cozy life-sim" style (spec §4.12). A geometry kit merges vertex-coloured primitives into about 3 draw calls per model ([src/game/world/kit.ts](src/game/world/kit.ts), [parts.ts](src/game/world/parts.ts), [models.ts](src/game/world/models.ts), [propModels.ts](src/game/world/propModels.ts)). Trees and bushes use overlapping alpha-tested leaf cards over a dark canopy volume ([foliage.ts](src/game/world/foliage.ts)). The ground is a procedural shader layered with painted tiles ([planetMaterial.ts](src/game/world/planetMaterial.ts)).
- **Player character:** the CC0 Kenney "Animated Characters: Protagonists" model ([Player.tsx](src/game/player/Player.tsx)). It is scaled to 1.25 u, and its idle and run clips are blended by speed with the stride matched to movement. It hops when a fast travel lands. The procedural avatar ([Character.tsx](src/game/player/Character.tsx)) stands in while the model loads or if it fails. Credits are in [assets-src/CREDITS.md](assets-src/CREDITS.md).
- **Day–night cycle** (spec §4.13):
  - The pure model in [timeOfDay.ts](src/game/world/timeOfDay.ts) keyframes the sky, fog, light and cloud palettes and computes the sun/moon arcs and cycle speed.
  - The rig in [DayNight.tsx](src/game/world/DayNight.tsx) drives the lights (so shadows move through the day), the sky texture, the sun, moon and stars, and the night extras: glowing lamps and windows, lamp light pools, fireflies and a brighter lighthouse beam.
  - In cycle mode the clock stops under Reduce motion or Pause ambient motion.
- **Landscape** (spec §4.14):
  - The pure height model [terrain.ts](src/game/world/terrain.ts) (`Terrain.height` / `walkHeight`) displaces the ground mesh, places every prop and lifts the character and camera. Collision stays 2D on the sphere, so the cliff walls and the bridge rails are ordinary obstacle circles. The stream and pond are **wadeable**: `waterDepth` lowers the character onto the bed (at most knee-deep), slows them down, and [WadeFx.tsx](src/game/world/WadeFx.tsx) adds a foam collar and wake rings.
  - [features.ts](src/game/world/features.ts) defines the river spline, the mesas and where bridges go.
  - [Landforms.tsx](src/game/world/Landforms.tsx) builds the cliffs (geometry in [cliffs.ts](src/game/world/cliffs.ts); each mesa's grassy cap is merged into the ground mesh, so its top is the same lawn as the land around it), the flowing water (one shader shared by the stream, the waterfall and a still-water pond variant; the stream cross-fades into the pond) and the bridge. [pond.ts](src/game/world/pond.ts) gives the pond its lobed shoreline and bowl, and [pondPlants.ts](src/game/world/pondPlants.ts) places its plants.
  - The ground shader ([planetMaterial.ts](src/game/world/planetMaterial.ts)) paints the lawn's soft mottling, clover, path edges, mossy cobbles, river banks and rock strata.
- **Wind** (spec §4.14): the pure model [windField.ts](src/game/world/windField.ts) (direction plus breathing gusts) feeds one set of shared shader uniforms. All the foliage sways and flutters on the GPU, and its shadows move with it ([Props.tsx](src/game/world/Props.tsx) `addSway`). [WindFx.tsx](src/game/world/WindFx.tsx) adds instanced flying leaves and a small pool of swirl ribbons. Everything stops under Reduce motion or Pause ambient motion.
- **Hand-painted textures** (spec §4.15):
  - The sources are original GPT Image 2.5 generations; each prompt is kept next to its source in [assets-src/textures/](assets-src/textures/). [build-textures.py](scripts/build-textures.py) turns them into about 1.1 MB of WebP plus a typed manifest.
  - [textures.ts](src/game/world/textures.ts) preloads them before the first render. Anything that fails falls back to the procedural look.
  - Ground tiles are sampled triplanar in planet-local space and normalised by their mean colour, so the palette and lighting don't change.
  - Cliff walls are UV-mapped so the strata stay horizontal, and boulders, rocks and pebbles get their own painted granite tile plus moss grown in the shader on their upward faces ([rockDetail.ts](src/game/world/rockDetail.ts)); their chiselled shapes come from [propModels.ts](src/game/world/propModels.ts).
  - The leaf, conifer and grass sprites are tintable greyscale with real alpha. Cedars use a 2×2 atlas of four painted conifer sprites in grouped, irregular tiers, with three variants. The pond plants come from a full-colour 2×2 `pond-atlas` (lilies, reeds, irises, fern).
  - Buildings, the bridge and the plaza furniture have per-surface materials: each kit part is tagged `wood`, `roof`, `plaster`, `stone`, `brick`, `metal` or `canvas` and gets its own painted detail (luminance only, so the palette is kept) on box-projected UVs, with wood grain along each board. Plain painted trims keep a subtle brush grain.
  - The spawn plaza is a painted decal (brick rings and a compass rose that points to map north), feathered into the lawn.
- **Quality tiers:**
  - `high`: tilt-shift, bloom, vignette and neutral tone mapping, plus 2048² shadows.
  - `low`: a cheaper tilt-shift, no bloom or vignette, and 1024² shadows. Chosen automatically for software rendering, Data Saver or coarse pointers.
  - Adaptive quality never removes the tilt-shift. After a 10 s warm-up it lowers resolution, then drops bloom and vignette, and steps back up when the frame rate recovers.
  - Everything on the planet is always drawn (no culling), so nothing pops into view.
  - In dev and test builds, `?quality=high|low` forces a tier.
- **Stack (exact pins):** Astro 7.3.3, React 19.2.8, three 0.186.0 (WebGLRenderer), @react-three/fiber 9.7.0, @react-three/drei 10.7.8, @react-three/postprocessing 3.1.1 + postprocessing 6.39.5, zustand 5.0.15.

Differences from the spec's proposed structure (§5.7):
- UI components are grouped into `ui/Hud.tsx` and `ui/Dialogs.tsx`.
- The mount entry is `game-mount.tsx`.
- Keyboard input is in `input/keyboard.ts`; pointer input is handled on the planet mesh.
- Prop layout and signposts are in `world/layout.ts`.

## Status against the Definition of Done

**Verified automatically (all passing):**

| Area | Evidence |
|---|---|
| Movement: WASD, diagonal, run, frame-rate independence (30 vs 120 fps within ±2 %), full-planet walk, dt clamp, no tunneling, slide, twist-preserving push-out, auto-walk arrive/blocked, travel | `tests/unit/movement.test.ts`, `tests/unit/sphere.test.ts`, E2E "WASD moves the player" |
| Proximity: enter/exit hysteresis, nearest wins, switch margin, tie-break, 150/151 ms buffer | `tests/unit/proximity.test.ts`, E2E "proximity preview…" |
| Content validation, prop layout, **route test: every landmark reached in ≤ 8 s** | `tests/unit/landmarks.test.ts`, E2E "route test" |
| Workshop base and door on screen at spawn | E2E "spawn view…" |
| Dialog: E opens, Esc/Back closes, URL `?at=&open=1`, focus returns to whatever opened it | E2E: "proximity preview, open with E…", "preview-card Open returns focus…", "deep link opens the dialog…" |
| Deep links, invalid `?at=` → Plaza + status message | E2E: "deep link opens the dialog…", "invalid deep link falls back…" |
| Context-preserving classic switch, and back via Explore in 3D | E2E: "context-preserving switch to classic…" |
| Fast travel (menu, parallel nav), reduced-motion fade | E2E: "fast travel from the menu…", "reduced motion makes fast travel a short fade", "parallel landmark nav…" |
| Gate: no WebGL2 → fallback with **zero game-bundle requests**; bundle load error → Retry/Classic; `?mode=classic` redirect + saved preference; context lost → Reload/Classic | E2E: "capability gate" group, "?mode=classic redirects…", "WebGL context loss…" |
| Game keys ignored when HUD focused; Start button doesn't steal focus | E2E: "start button, then WASD moves the player…" |
| axe: no serious/critical issues on landing, classic, fallback, dialog, menu | E2E: landing, classic, no-WebGL2, dialog and menu tests (axe scans) |
| Budgets: landing 0 KB 3D JS; gate 2.8 KB gz; game 396 KB gz (≤ 450); character model 163 KB; generated textures ≈ 1.1 MB (23 WebP, ≤ 1.5 MB); landing poster 104 KB (mobile) / 194 KB (desktop); no `__game` in production | `npm run verify:prod`, `tests/unit/textures.test.ts` |
| Render stats (all passes, everything always drawn): ≈ 96–106 draw calls / ≈ 650–670 k triangles on `high`. **This exceeds the original 60 / 100 k target; a waiver is proposed in the plan's §6 and needs owner sign-off.** | `window.__game.renderInfo()` |
| Textures: all 23 generated textures load (HTTP 200) before the planet appears, with no fallback. Every manifest entry is a square, power-of-two WebP that matches its recorded size; sprites have real alpha; tiles export a mean colour; each kit surface has a detail mask with its mean; each source has its prompt. The total stays within budget (≈ 1.1 MB of 1.5 MB). The landing key art loads with fixed dimensions, and the social card is served | `tests/unit/textures.test.ts`, `tests/unit/surfaces.test.ts`, E2E "hand-painted textures all load…", "landing ships no game JS…" |
| Player character: rigged CC0 model loads (`character.glb` 200); procedural fallback when the model fails, still playable | E2E: "player character" group |
| Day–night: continuous palette (incl. midnight wrap), sun↔moon handover at zero intensity, cycle timing; clock runs, night lights the lamps, badge shows the moon; "Always daytime" holds the day and is remembered; Pause ambient motion freezes the clock; the Town Hall clock's hands show the device's local time (and follow it when it changes) | `tests/unit/timeOfDay.test.ts`, `tests/unit/clock.test.ts`, E2E "day–night" group |
| View controls: map north is a smooth unit tangent (Workshop north, Town Hall east, Library south, Post Office west of the plaza); rotating keeps the player in place and WASD screen-relative; rotate/compass buttons, tap-vs-drag, `,` `.` / PgUp PgDn / N / H keys, tilt limits, Reset back to the plaza facing north | `tests/unit/compass.test.ts`, E2E "view controls" group |
| Landscape & wind: the river runs from the waterfall cliff to the pond, stays clear of the plaza and every landmark, and crosses exactly one path (the Greenhouse path) under a bridge; the ground is flat at the plaza, landmark footprints and approaches, rolls mildly elsewhere, and the river bed sits below the water, which sits below the banks; the mesas are flat-topped and every cliff face faces outwards; the grassy caps face up, droop outwards over the rim and sit just above the ground; each upper tier leaves a lower terrace all the way round; tree crowns stay off the cliff walls and mesa-top trees stand on flat ground well inside their rim (clear of the tier wall); the bridge deck arches; mesas and boulders stay off the paths; the wind is tangent, breezy at the plaza and every landmark, and its gusts never exceed 1. The pond: its lobed shore relaxes to the nominal radius at the stream mouth; the bowl dips below the shared water level inside the shore and rises above it just outside; lilies float inside, ferns sit on the bank, nothing is placed in the mouth, and no other prop stands in the water. Wading: the stream and pond have depth (never more than knee-deep), dry hollows and bridges don't, deeper water is slower, and the character can walk straight across the stream and into the pond. In the browser: walking over the bridge lifts the character and still reaches the Greenhouse; you can wade straight across the stream (down onto the bed, slower, with a foam collar and ripples) and climb out on the far bank; gusts bring flying leaves and swirls, and Pause ambient motion hides them | `tests/unit/terrain.test.ts`, `tests/unit/cliffs.test.ts`, `tests/unit/wind.test.ts`, E2E "landscape & wind" group |
| Types | `npm run check` → 0 errors |

**Still to do before sign-off** (manual checks, or not yet built):

- [ ] Screen-reader smoke tests (Narrator + Edge, NVDA + Firefox) and the `role="region"` vs `application` decision.
- [ ] Manual pass on Edge, Firefox and Safari 26, plus one touch device.
- [ ] Performance on the reference hardware: frame pacing, draw calls, heap, time to playable, and Lighthouse on `/`, using the spec §7 method. (Headless SwiftShader numbers don't count.)
- [ ] Usability sessions (≥ 5 testers) and comfort sessions (≥ 3), plus the owner feel review (decision D-3).
- [ ] 60–90 s demo video.
- [ ] Not built yet:
  - a loader with % progress (there are no heavy assets yet, so there's only a loading message)
  - an in-game timeout and error overlay after mount (the gate covers bundle-load failures)
  - a leva tuning panel
- [ ] P1/P2 backlog (M8): juice (squash, dust), follow-lead camera, visited state, `auto` activation experiment, run toggle, joystick, gamepad, zoom, "I'm stuck", quality setting, audio, key remapping, preview deployment.

## Known issues

- Headless Chromium reports software rendering, so E2E tests click **Continue anyway** on the interstitial. That's expected, and it exercises the "offer" path.
- The React/Astro renderer chunk (`client.*.js`, 0.9 KB) is emitted even though no page uses an Astro React island. It is never requested.
- `/play` has no Astro React island, so in dev the gate installs React Fast Refresh's preamble itself (`installDevRefreshPreamble` in `gate.ts`). Without it, dev throws `$RefreshSig$ is not defined`. It is stripped from production builds.
- The console warning `THREE.Clock: This module has been deprecated` comes from @react-three/fiber 9.7 internals and is harmless.
- A browser tab that is hidden (for example a background tab, or the VS Code integrated browser while its pane isn't visible) pauses `requestAnimationFrame`, so the planet stays on "Loading…" until the tab is visible. This is expected browser behaviour.
- If the dev server shows `X is not defined` right after an edit, it probably caught a half-saved file. Re-save the file or restart `npm run dev`.
- `og:image` must be an absolute URL. Set `site` in `astro.config.mjs` when the site is deployed; until then the social-card URL is built from the request URL (e.g. localhost in dev).
- Windows file names are case-insensitive, so don't give two modules names that differ only in case (for example `daynight.ts` and `DayNight.tsx`). TypeScript reports an error, and Vite's dev cache may keep serving the old file until the dev server restarts.
