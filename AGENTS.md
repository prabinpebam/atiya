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

- `npm run check` (types), `npm test` (Vitest unit), `npm run e2e` (Playwright + axe; builds the test bundle), `npm run verify:prod` (production build + bundle budgets + no test hook).
- Run `npm test` after changing anything in `src/game/math`, `src/game/systems` or `src/content/landmarks`. `tests/unit/fixtures.ts` must mirror the landmark frontmatter; a test enforces this.
- Game keys are active only while the game region has focus. Never intercept Tab.
- **View:** never rotate the camera's yaw. User rotation is `PlanetSim.rotateView` (a planet spin about world +Y), so the sky, sun and moon rig stays in the camera frame. Tilt is `controller.view.pitch`. The compass uses map north (`math/compass.ts`), not geographic north, because the plaza sits on the pole. Planet clicks are taps: check `controller.viewDragged` and `e.delta` so a drag never walks.
- **No third-party game IP** (Nintendo names, characters, music, fonts, UI). Use CC0 or original assets only, and log every asset in `assets-src/CREDITS.md`.
- **Art pipeline:** build 3D assets procedurally with the geometry kit (`src/game/world/kit.ts` + `parts.ts`): vertex-coloured primitives merged into one mesh per material layer (`solid` / `glow` / `glass`). Surface detail comes from generated hand-painted textures (see **Textures** below).
  - Don't add per-part meshes; add parts to the kit instead.
  - **No culling:** everything on the planet is always drawn, so nothing pops in (owner decision). Don't add distance, horizon or LOD culling that makes things appear or disappear.
  - Trees and bushes live in `world/foliage.ts` (leaf cards + dark core). Foliage needs its alpha-tested `depthMaterial` for correct shadows.
  - Keep the canvas opaque (the sky is a scene background). A transparent canvas causes post-processing halos.
  - Glow parts use the HDR `glow` material so only they exceed the bloom threshold.
  - **Day–night:** never hard-code sky, fog or light colours in components. `world/DayNight.tsx` owns the lights, fog and `scene.background`, driven by the pure keyframes in `world/timeOfDay.ts`.
    - Any material with an emissive "daylight lift" must call `registerDaylit()` (`world/materials.ts`) so it dims at night.
    - Night-only effects read `controller.sky.night` (0–1) in `useFrame`.
    - Sky objects go on planes behind the planet in the camera frame, inside the camera's far plane (130).
    - Use `window.__game.setTime(h)` for screenshots and tests.
  - **Terrain:** the ground isn't a plain sphere anymore. Place anything that sits on the ground at `R + terrain.height(n)`: set `PropInstance.h` in `world/layout.ts`, or call `controller.terrain`. Place anything the character stands on at `walkHeight`.
    - Collision stays 2D (circles on the unit sphere). Make unwalkable features (river, cliffs, rails) obstacles in `layout.ts`, never height checks.
    - Keep the plaza, landmark footprints and approach points at height 0, and keep every spawn→approach corridor clear: the layout tests enforce both.
    - River, mesa and bridge placement lives in `world/features.ts` (authored lat/lon).
  - **Wind:** all sway goes through `addSway` / `swayMaterial` in `world/Props.tsx`, which read the shared `windUniforms` (`world/windField.ts`). Apply the same sway to a foliage `depthMaterial`, or its shadows won't move with it.
    - Prefix shader locals `w*` to avoid clashes with three.js chunk variables (e.g. the instancing chunk's `mat3 im`).
    - Effects must freeze or hide under `selectAmbientPaused`.
    - Use `window.__game.setWind(gust)` for deterministic screenshots and tests.
  - **Textures:** hand-painted textures are generated with the global `gpt-image-2-5` skill (Azure OpenAI; the key lives in Windows Credential Manager, so never put it in the repo).
    - Keep each source PNG and its exact prompt in `assets-src/textures/` (`<name>.png` + `<name>.prompt.txt`). Log generations in `assets-src/CREDITS.md`.
    - Run `python scripts/build-textures.py` to rebuild `public/textures/*.webp` and the generated `src/game/world/textureManifest.ts`. Never hand-edit either.
    - Tiles must be seamless (use the skill's `tile` command and check the 2×2 preview). Use the game's own screenshots as image-to-image references so the palette matches. Never prompt for third-party IP.
    - Materials read textures with `gameTexture(name)` (preloaded before mount), and **must** fall back to the procedural look when it returns null.
    - Ground layers are divided by the tile's `textureMean` so the palette is unchanged.
    - The kit geometry has no UVs: use triplanar sampling (`TRIPLANAR_GLSL`) in planet- or object-local space, or add a purpose-built UV attribute (like the cliffs' `aRockUV`). Directional patterns such as strata criss-cross under triplanar projection.
    - Foliage sprites are tintable greyscale, and alpha cards need a matching depth material.
    - Keep game textures ≤ 512² and the total ≤ 1.5 MB (the unit test enforces this).
  - Check triangle counts with `tests/unit/triangles.report.test.ts` (unskip locally) and `window.__game.renderInfo()`.
  - Windows is case-insensitive: never create module names that differ only by case.
- **Player character:** `public/models/character.glb` is generated. Don't hand-edit it; change `scripts/build-character.mjs` and run `npm run build:character`.
  - FBX2glTF is a native tool installed into `%TEMP%\fbxconv`. Never add it to `package.json`.
  - Keep `useGLTF(url, false, false)` (no Draco/Meshopt), so no decoder is fetched from a CDN.

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
