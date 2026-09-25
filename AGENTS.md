# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project

Personal portfolio site for a Principal Design Manager at Microsoft, showcasing a wide range of expertise. See [documentation/seed-spec.md](./documentation/seed-spec.md).

### 3D "Little Planet" navigation POC

Spec, plan and Definition of Done: [documentation/poc-3d-navigation/](./documentation/poc-3d-navigation/spec.md). Conventions for agents working on it:

- **Pinned stack (exact versions only):** astro 7.3.3, @astrojs/react 6.0.6, react/react-dom **19.2.8** (R3F 9.7.0 requires `<19.3`), three 0.186.0, @react-three/fiber **9.7.0** (never the proxy's v10 canary), @react-three/drei 10.7.8, @react-three/postprocessing 3.1.1 + postprocessing 6.39.5 (needs three `<0.187`), zustand 5.0.15. See spec §5.1 for the full list.
- Use **R3F v9 / drei v10 APIs** (not v8 patterns, not v10 alphas). Use `WebGLRenderer` only: no WebGPU/TSL, no physics engine. The tilt-shift must always be on, on both tiers; bloom and vignette are `high`-only, and adaptive quality may drop them but never the tilt-shift.
- Movement model: **rotate the planet under a fixed player and camera** (spec §5.2). Keep simulation logic in pure, unit-tested TS modules under `src/game/math` and `src/game/systems`.
- All actionable UI (prompts, dialogs, menus) is **semantic DOM**, not in-canvas. The classic site must stay reachable from every state.
- `/play` uses a **capability-gated dynamic import**, not a `client:only` island. `src/game/platform/gate.ts` must never import React or three. Game code is emitted as `game-*` chunks, and gated-out devices must never request them.
- `window.__game` exists only in dev and `--mode test` builds, never in production.

### Commands

- `npm run check` (types), `npm test` (Vitest unit), `npm run e2e` (Playwright + axe; builds the test bundle), `npm run verify:prod` (production build + bundle budgets + no test hook). Which of these to run for a change: see **Validation** below; don't run them all by default.
- `tests/unit/fixtures.ts` must mirror the landmark frontmatter; a test enforces this.
- Game keys are active only while the game region has focus. Never intercept Tab.
- **View:** never rotate the camera's yaw. User rotation is `PlanetSim.rotateView` (a planet spin about world +Y), so the sky, sun and moon rig stays in the camera frame. Tilt is `controller.view.pitch`. The compass uses map north (`math/compass.ts`), not geographic north, because the plaza sits on the pole. Planet clicks are taps: check `controller.viewDragged` and `e.delta` so a drag never walks.
- **No third-party game IP** (Nintendo names, characters, music, fonts, UI). Use CC0 or original assets only, and log every asset in `assets-src/CREDITS.md`.
- **Art pipeline:** build 3D assets procedurally with the geometry kit (`src/game/world/kit.ts` + `parts.ts`): vertex-coloured primitives merged into one mesh per material layer (`solid` / `glow` / `glass`). Surface detail comes from generated hand-painted textures (see **Textures** below).
  - Don't add per-part meshes; add parts to the kit instead.
  - `Kit.build()` returns **indexed** geometry (`indexExact`: only bit-identical vertices are shared, so it's lossless). Code or tests that walk triangles must call `toNonIndexed()` first, and never call `computeVertexNormals` on kit output. New hand-built geometry should be indexed too (like the leaf `Cards`).
  - **No culling:** everything on the planet is always drawn, so nothing pops in (owner decision). Don't add distance, horizon or LOD culling that makes things appear or disappear.
  - Trees and bushes live in `world/foliage.ts` (leaf cards + dark core). Foliage needs its alpha-tested `depthMaterial` for correct shadows. Trunks are low-poly `bark` tubes (`barkTube` / `rootFlare`): add rings only where the shape bends or tapers and let the bark texture carry the detail (`tests/unit/trunks.test.ts` holds the triangle budget).
  - Keep the canvas opaque (the sky is a scene background). A transparent canvas causes post-processing halos. It has no MSAA or stencil: the composer multisamples the scene into its own buffer.
  - **Load path** (`SimDriver` in `Scene.tsx`): every program is compiled with `compileAsync` *before* the first draw, against a render target (the scene draws into the composer's linear buffer, not the canvas), while the camera looks at an empty layer. Mount new materials with the scene, not after load, or they compile blocking on their first frame. Textures load as `ImageBitmap`s already flipped: don't set `flipY` on them.
  - Pure per-vertex builders (terrain, ground) run ~35 k times at load: skip work with cheap bounds (a dot product against a precomputed cosine) where a term is exactly 0 or 1, and keep a unit test comparing against the full evaluation (see `flatMask`).
  - Measure performance with `npm run perf:audit` (and `__game.perfStats()`) before and after changes to loading, materials or geometry; the method and baseline are in `documentation/poc-3d-navigation/performance-audit.md`. Change nothing visible for performance's sake without the owner's sign-off.
  - Glow parts use the HDR `glow` material so only they exceed the bloom threshold.
  - **Art direction:** the target look is in `documentation/poc-3d-navigation/art-direction/` (game screenshots repainted as concept art with GPT Image 2.5). Compare new work against it: warm directional sun, crisp (the tilt-shift only softens the very edges), sunlit meadow greens, abundant flowers and sprigs, painted clouds. Keep flowers cheap: the abundance comes from `flowerSprig` (≈ 150 triangles, no shadow), not full flower props (≈ 700).
  - **Clouds** are painted sprites (`cloud-atlas` + `cloud-normal`, `world/Sky.tsx`), one alpha-blended instanced draw sorted far to near; the 3D `cloud()` puffs are only the fallback. **Normal maps** go where they add relief the albedo lacks (the clouds' volume, the lawn). Don't put them on painted leaf/conifer cards: the sprite already carries its relief, and a per-leaf normal fights the canopy's volume shading (tried; the crowns read flatter).
  - **Shaders must never output NaN or Inf.** One bad pixel in the HDR buffer is smeared by the bloom's blur over the whole screen, which turns black. Clamp the base of every GLSL `pow()` (`pow(clamp(x, 0.0, 1.0), k)`), and normalize with `v * inversesqrt(max(dot(v, v), 1e-12))`. A value can't be trusted to stay in 0…1 just because it was clamped in the vertex shader: with MSAA a varying is extrapolated past its triangle at edge pixels. `tests/unit/shaders.test.ts` checks every `pow()`. SwiftShader doesn't reproduce this, so check on a real GPU with `npm run perf:audit` (it fails on any NaN pixel) or `__game.hdrScan(1280, 4)`.
  - **Exposure:** the post chain is linear HDR, tone-mapped once by the final `ToneMapping` effect. An effect that outputs a whole image (tilt-shift, any blur or colour effect) must use `BlendFunction.NORMAL`; some `@react-three/postprocessing` wrappers default to ADD, which doubles the radiance and clips highlights. Only additive-by-nature effects (bloom) may ADD. Change brightness through `sceneExposure` (`world/timeOfDay.ts`), never with a per-effect boost.
  - **Doors:** a building with a door uses hollow `walls({ opening })` and `courses()` for its bands (so nothing crosses the doorway). `door()` returns its leaves as separate kits that `Landmark.tsx` swings about their hinges (`world/doors.ts`). The room behind (`world/interiors.ts`) is drawn only while its door is open: it's hidden behind the shut door, not culled. Put furniture where it can be seen through the doorway, clear of the leaves' swing. Night light from doors comes from the one shared `DoorLight`; don't add a point light per building (the light count must never change).
  - **Lamplight:** never fake local light with additive decals on surfaces. Register a lamp with `addLamp` (`world/lampLights.ts`), and give any material that should receive it `withLampLights` (after its other patches; it chains). Keep the list ≤ `LAMP_MAX`, and lamps at intensity 0 by day. Additive blending is only for light in the air (beams, halos, glow sprites).
  - **Day–night:** never hard-code sky, fog or light colours in components. `world/DayNight.tsx` owns the lights, fog and `scene.background`, driven by the pure keyframes in `world/timeOfDay.ts`.
    - Any material with an emissive "daylight lift" must call `registerDaylit()` (`world/materials.ts`) so it dims at night.
    - Night-only effects read `controller.sky.night` (0–1) in `useFrame`.
    - Sky objects go on planes behind the planet in the camera frame, inside the camera's far plane (130).
    - Use `window.__game.setTime(h)` for screenshots and tests.
  - **Terrain:** the ground isn't a plain sphere anymore. Place anything that sits on the ground at `R + terrain.height(n)`: set `PropInstance.h` in `world/layout.ts`, or call `controller.terrain`. Place anything the character stands on at `walkHeight`.
    - Collision stays 2D (circles on the unit sphere). Make unwalkable features (river, cliffs, rails) obstacles in `layout.ts`, never height checks.
    - Keep the plaza, landmark footprints and approach points at height 0, and keep every spawn→approach corridor clear: the layout tests enforce both.
    - River, mesa and bridge placement lives in `world/features.ts` (authored lat/lon). An upper tier's outline is `tierEdge(m.tier, angle)` (sampled and kept `TIER_TERRACE_U` inside the base rim); never recompute it from `mesaRadius`. Terrain, walls, caps and layout must all use the same outline (`plateaus(m)` in `cliffs.ts`).
    - Mesa tops are drawn by caps merged into the ground mesh (`buildMesaCaps`), not by the displaced ground. Anything placed on a mesa top must sit on flat ground, clear of every rim (`mesaTopClearance`, `nearPlateauRim` in `layout.ts` / `cliffs.ts`), and trees near a mesa keep their whole crown (`canopyRadius`) off the walls.
  - **Wind:** all sway goes through `addSway` / `swayMaterial` in `world/Props.tsx`, which read the shared `windUniforms` (`world/windField.ts`). `addSway` chains onto a material's existing `onBeforeCompile` (the trees keep the kit surface detail), and `clone()` does not copy shader patches, so re-apply them to clones. Apply the same sway to a foliage `depthMaterial`, or its shadows won't move with it.
    - Prefix shader locals `w*` to avoid clashes with three.js chunk variables (e.g. the instancing chunk's `mat3 im`).
    - Effects must freeze or hide under `selectAmbientPaused`.
    - Use `window.__game.setWind(gust)` for deterministic screenshots and tests.
  - **Textures:** hand-painted textures are generated with the global `gpt-image-2-5` skill (Azure OpenAI; the key lives in Windows Credential Manager, so never put it in the repo).
    - Keep each source PNG and its exact prompt in `assets-src/textures/` (`<name>.png` + `<name>.prompt.txt`). Log generations in `assets-src/CREDITS.md`.
    - Run `python scripts/build-textures.py` to rebuild `public/textures/*.webp` and the generated `src/game/world/textureManifest.ts`. Never hand-edit either.
    - Tiles must be seamless (use the skill's `tile` command and check the 2×2 preview). Use the game's own screenshots as image-to-image references so the palette matches. Never prompt for third-party IP.
    - Materials read textures with `gameTexture(name)` (preloaded before mount), and **must** fall back to the procedural look when it returns null.
    - Ground layers are divided by the tile's `textureMean` so the palette is unchanged.
    - **Kit surfaces:** wrap parts in `k.surface('wood' | 'roof' | 'plaster' | 'stone' | 'brick' | 'metal' | 'canvas' | 'bark', () => …)` so they get that material's painted detail; untagged parts are plain `paint` (brush grain). Tag new props too: an untagged wooden bench reads as plastic. The kit writes `aSurf` + box-projected `aSurfUV` itself (wood grain follows the part's long axis, courses stay level, and sloped `roof` faces map in their own plane with the texture's up running up the slope, so shingle tabs point down to the eaves); `bark` instead uses the part's own `uv` in world units (the trunk tubes supply it). Never add per-surface materials or meshes. A new surface needs an entry in `SURFACES` / `SURFACE_TILE_U` (`kit.ts`), a mask in `SURFACE_TEX` (`rockDetail.ts`) and the build script.
    - Other geometry has no UVs: use triplanar sampling (`TRIPLANAR_GLSL`) in planet- or object-local space, or add a purpose-built UV attribute (like the cliffs' `aRockUV`). Directional patterns such as strata criss-cross under triplanar projection.
    - **Stones** (boulders, rocks, pebbles) share `withStoneDetail` (`rockDetail.ts`): the non-directional `boulder` granite mask, moss grown in the shader on upward faces, and contact darkening at the base. Build new stone props with `chiselledBlob` and `stoneGeometry(k, moss)` (`propModels.ts`) so they carry `aMoss`; never paint moss into vertex colours (per-vertex moss smears into streaks).
    - Foliage sprites are tintable greyscale, and alpha cards need a matching depth material. Several sprites can share one texture as a 2×2 atlas (`ATLASES` in the build script, with mode `tint` for greyscale-tintable or `sprite` for full colour, like `pond-atlas`; `Cards.add(…, uvRect)` picks the cell), which keeps them to a single draw call. Give repeated props a few seeded geometry variants (like `cedar(variant)`) rather than one identical model.
    - Water that should read as one body shares one level and one shader: the pond sits at the stream's `RIVER_WATER_U`, with its bowl part of `Terrain.height` (`pondBasin` in `world/pond.ts`). Transparent water writes depth, so overlapping surfaces need a hair of height offset plus `renderOrder`, and a cross-fade (`aFlow.z`) rather than a hard end. The pond's lobed outline comes from `shoreRadius` in `pond.ts` (or `Terrain.pondShore`); anything that tests "in the pond" must use it, not the nominal radius. Water is wadeable, not an obstacle: use `Terrain.inWater` / `waterDepth` for anything that reacts to it.
    - Keep game textures ≤ 512² (the 1024² plaza decal is the one exception) and the total ≤ 1.5 MB (the unit test enforces the total).
    - Hand-built geometry must be wound counter-clockwise as seen from the side that should show (three.js culls back faces). `flatShading` hides a wrong winding in the lighting, so check it with a unit test like `tests/unit/cliffs.test.ts` rather than by eye.
  - Check triangle counts with `tests/unit/triangles.report.test.ts` (unskip locally) and `window.__game.renderInfo()`.
  - Windows is case-insensitive: never create module names that differ only by case.
- **Sound:** `public/audio/*.mp3` and `src/game/audio/audioManifest.ts` are generated by `python scripts/build-audio.py` (numpy + scipy + ffmpeg); never hand-edit them. Sources must be CC0: add each to `SOURCES`/`KENNEY` in the script and to `assets-src/CREDITS.md`.
  - Analyse a candidate before using it: check level steadiness, clipping, hum and tonal peaks, and look at its spectrogram. Then read the script's `check()` report (loop-seam percentiles should stay under ~90, and slot levels should be close within a set).
  - Freesound previews are public (`cdn.freesound.org/previews/…-hq.mp3`), but Pixabay audio is **not** CC0. Never pass `-ss` before `-i pipe:0` to ffmpeg: an input seek on a pipe silently drops most of an Ogg.
  - Play sounds only through `SoundEngine` (`audio/engine.ts`); keep the rules pure in `audio/audioLogic.ts`. Audio is created only from a user gesture (`unlock()`), nothing is fetched while muted, and every cue must duplicate something visible.
- **Player characters:** `public/models/character.glb` (Skater) and `character-female.glb` (Sunny) are generated. Don't hand-edit them; change `scripts/build-character.mjs` and run `npm run build:character`, then `npm run build:portraits` for the picker images (`public/avatars/`). Characters are listed in `src/game/player/characters.ts`.
  - A skin atlas must keep the Kenney UV layout exactly: generate by *editing* an existing skin, then clean it with a script like `assets-src/characters/compose-female.py` and check it with a UV-wireframe overlay. Keep the prompt and raw output next to it.
  - Extra parts (like the ponytail) are rigid meshes parented to a bone, authored in bind-pose space and moved into the bone's frame. They sample flat colours from the atlas (`HAIR_UV`, `TIE_UV`), so no second texture is needed.
  - FBX2glTF is a native tool installed into `%TEMP%\fbxconv`. Never add it to `package.json`.
  - The occlusion outline (`player/outline.ts`) depends on draw order: opaque scenery at renderOrder 0, the outline twins at 1, the character at 2. Don't give opaque scenery a renderOrder of 1 or more (it would draw after the twins and never show them), and call `addOcclusionOutline` for any new avatar.
  - Keep `useGLTF(url, false, false)` (no Draco/Meshopt), so no decoder is fetched from a CDN.

### Validation: run what the change needs, not everything

Headless E2E is slow here (SwiftShader at 1–2.5 fps, one worker, a test build per run: about 1–2 min per test, about 22 min for the full suite). So validation is scoped to the change's blast radius, the way large teams do it: test impact analysis (Microsoft, Google TAP) and predictive test selection (Meta) run the tests a change can affect on every change, keep the full suite for milestones, and fall back to "run everything" when the impact is unclear. Pick the **lowest tier that covers the change**; escalate only for the reasons in tier 3.

| Tier | When | What to run (typical cost) |
|---|---|---|
| **0 – none** | Docs, comments, copy, `README`/spec/AGENTS edits, renames the language server did | Nothing. Proof-read the diff |
| **1 – affected units** | Any code change | `npx vitest related <changed files> --run` (seconds; follows the import graph). Add `npm run check` only if types, props, test-hook signatures or `tests/e2e` types changed. Write or update the unit test for the pure logic you touched |
| **2 – targeted E2E / one look** | A change a unit test can't see: rendering, shaders, input, DOM UI, doors, sound, anything behind `window.__game` | Only the affected test(s): `npx playwright test --reporter=line -g "<test title or describe group>"` (1–2 min each). For visual changes, **one** screenshot of the affected view, not the whole gallery. Re-run just what failed with `--last-failed`. Use `-x` to stop at the first failure |
| **3 – broad** | Only when a trigger below applies | Full `npm test`, `npm run check`, `npm run verify:prod`, full `npm run e2e` |

Tier 3 triggers (these are the "risky change" cases; otherwise don't):
- **Accumulated change:** several features since the last full run (roughly 5+ commits or a day's work), or before a release/deploy or a milestone review. Run it once at that point, not after every change, and in the background (`mode: async`) while other work continues.
- **A behavioural change to shared infrastructure** whose impact the import graph can't bound (adding a field or a test hook doesn't count): `controller.ts`, `Scene.tsx`/post-processing, `GameApp.tsx`, the store, `config.ts`, the test hook's shared helpers, renderer settings, `playwright.config.ts`, `vite`/`astro` config.
- **Dependencies or build:** `package.json`/lockfile changes, new assets, anything that can move the bundle size → `npm run verify:prod` (always for these; it takes about a minute).
- **Gate / production path:** `platform/gate.ts`, `/play` loading, or the test-hook guard → `verify:prod` plus the "capability gate" and "landing & classic" groups.
- A targeted run failed for a reason you don't understand, or the fix touched more than the original change.

Rules of thumb:
- Map the change to E2E groups by area: `landing & classic`, `capability gate`, `rendering` (post FX, exposure, textures), `day–night` (sky, lamps, clouds, clock), `view controls`, `landscape & wind` (terrain, water, wading, wind), `doors`, `sound`, `player character`, `planet` (movement, proximity, dialogs, travel, reset, a11y). Run the one or two groups you touched, or a single test by title.
- Don't re-run a check whose inputs haven't changed since it last passed (e.g. unit tests after a docs-only fix, or E2E after only editing a unit test).
- Don't re-capture README screenshots unless the change visibly alters that view.
- A timeout under host load isn't a regression: re-run that one test before investigating, and compare with the baseline only if it fails again.
- Say what you ran and what you deliberately skipped (and why) in the summary, so the next full run knows what's pending.

## Package installation: use Microsoft package feed proxy (required)

This project is developed on a Microsoft-managed device. Direct access to public package registries is blocked or progressively restricted:

- `registry.npmjs.org`
- `pypi.org/simple`
- `files.pythonhosted.org`
- selected NuGet endpoints

All package installs **must** go through the Microsoft package feed proxy. Projects already using approved Microsoft feeds keep working; anything pointing at public registries will fail.

### Feed URLs

| Ecosystem | URL |
|-----------|-----|
| npm | `https://packagefeedproxy.microsoft.io/npm/` |
| PyPI / pip | `https://packagefeedproxy.microsoft.io/pypi/simple/` |

### npm

- Verify: `npm config get registry` → should return `https://packagefeedproxy.microsoft.io/npm/`.
- If `~/.npmrc` (`%USERPROFILE%\.npmrc`) or a project `.npmrc` contains `registry=https://registry.npmjs.org/`, change it to `registry=https://packagefeedproxy.microsoft.io/npm/`.
- Do **not** add a project `.npmrc` (or lockfile `resolved` URLs) pointing at `registry.npmjs.org`.
- This applies to `npm`, `npx`, `pnpm`, `yarn`, `bun`, and MCP servers launched via `npx`.
- The proxy's `latest` dist-tag is sometimes wrong (e.g. `@react-three/fiber` reports a `10.0.0-canary.*` build, `next` reports a canary). **Always pin explicit versions** verified against the package's GitHub releases (`npm install pkg@x.y.z`) instead of relying on `latest`.

### Python

- Use index URL `https://packagefeedproxy.microsoft.io/pypi/simple/` (e.g. in `%APPDATA%\pip\pip.ini` / `pip.conf`, or `--index-url`).
- `uv` does **not** read pip config; configure it explicitly (e.g. `UV_INDEX_URL` / `UV_DEFAULT_INDEX`, or `[[tool.uv.index]]` in `pyproject.toml`).
- Container builds must also use the proxy rather than `files.pythonhosted.org`.

### Common symptoms of misconfiguration

- `npm install` / `npx` fails, MCP servers fail to start, 403 or TLS/connection errors against npmjs.org.
- `pip install` fails reaching `pypi.org`; container builds fail fetching from `files.pythonhosted.org`; `uv pip install` bypasses pip proxy config.

Root cause is usually a personal `.npmrc`, `pip.ini`, or tool-specific config overriding the Microsoft-managed registry. Check those first.

### References (internal)

- [MSBench: package feed alternate (ADO, PowerBI)](https://dev.azure.com/powerbi/95357ac2-28a1-4a93-9a31-d2fb5a35e6ea/_workitems/edit/2258855)
- [Route dev installs through proxy / enforcement (ADO, MSAzure)](https://dev.azure.com/msazure/b32aa71e-8ed2-41b2-9d77-5bc261222004/_workitems/edit/39159526)
- [Update pip to MS proxy (ADO, MSAzure)](https://dev.azure.com/msazure/b32aa71e-8ed2-41b2-9d77-5bc261222004/_workitems/edit/38967792)
- [Use Microsoft proxy for image builds (ADO, Microsoft)](https://dev.azure.com/microsoft/8d47e068-03c8-4cdc-aa9b-fc6929290322/_workitems/edit/63746497)
- [npm install returns 403 (Viva Engage)](https://engage.cloud.microsoft/main/threads/eyJfdHlwZSI6IlRocmVhZCIsImlkIjoiMzk5ODM5MTY5OTAyMTgyNCJ9)
- [How to configure when npm is blocked? (Viva Engage)](https://engage.cloud.microsoft/main/threads/eyJfdHlwZSI6IlRocmVhZCIsImlkIjoiMzk2NDA5MzY4NDAxNTEwNCJ9)
- Central Feed Services (CFS) guidance for supported configurations and exceptions.
