# Spec: blade grass and meadow flowers

> **TL;DR:**
> - **What:** the planet's lawn gets opaque, painterly grass blades (140 K on high, 70 K on low) and meadow flowers in drifts.
> - **How it's drawn:** one instanced draw where each instance is a batch of 256 blades, built in the vertex shader from packed per-blade data. Each frame the CPU lists the visible batches.
> - **How it looks:** blades take their colour from the same lawn model as the ground, share the world's wind, receive shadows and lamplight, and lie flat under feet and dropped items. They never grow on paths, cobbles, water, mats or furniture bases.
> - **What it costs:** its own chunk, no blade textures, measured budgets.
>
> This is **v2**. An independent review of v1 found 17 issues, and a second prototype round tested the fixes (§10).

Status: **proposed**. It waits on the owner's decisions D1–D5 in the [proposal](./proposal.md#decisions-needed). D1 (skipping hidden batches) and D3 (the chunk budget) also change rules in AGENTS.md, so they must be approved before phase 2.

## 1. Scope

**In:**
- blade grass on every lawn surface, mesa tops included;
- meadow flowers;
- blade tufts in place of the 650 card clumps;
- grass lying flat around movers and ground drops;
- a calmer lawn under the blades;
- quality tiers and adaptive density.

**Out:**
- trees, bushes and hedges (their leaf cards stay);
- the pond reeds (a blade version is a follow-up);
- collectable flowers (they stay distinct props);
- cutting grass and seasons;
- WebGPU or compute shaders (the stack is WebGL2).

## 2. Look

| Property | Value | Why |
|---|---|---|
| Blade | 2 segments: 5 vertices, 3 triangles; tapered to 15 %; curved by its lean | Chunky blades need a visible bend; one triangle reads as a spike at this size |
| Height | 0.13–0.27 u (a base, plus clump and noise terms); tufts 0.3–0.4 u | About ankle-to-shin on the characters, as in the [target concept](./screenshots/target-meadow.jpg) |
| Width | 0.075 u at the root | 5 px at 720p, clear of the thin-triangle trap |
| Clumps | Voronoi cells about 0.35 u across: shared lean, height and a tiny hue shift | Avoids the "golf course" look (Ghost of Tsushima) |
| Colour | Root = the lawn's colour at that point (§5); tip × 1.15 toward warm yellow-green; a quadratic gradient | No seam with the ground; the painted look |
| Normal | The sphere normal, bent 30 % toward the lean; both faces use it | The field shades like one soft surface; no specular |
| Material | Opaque, `DoubleSide`, diffuse only; receives shadows, casts none; `renderOrder` 0 | The cheapest lighting that takes the sun, moon, fog and lamps, and keeps the outline contract |
| Flowers | Opaque hexagon head (6 triangles) on a 1-triangle stem, 0.2–0.27 u tall; white, butter-yellow, soft pink, lilac; single-colour drifts | The concept's drifts, with no alpha |

## 3. Where grass grows

Each rule is expanded by the blade's half-width plus its largest lean (about 0.12 u), so no blade can reach into an excluded area.

1. **Ground classification.** Use the final visual classification, not the raw weights. The ground shader's path and cobble edges are noise- and texture-thresholded (`planetMaterial.ts`), so the CPU uses the same thresholds with a margin: no blades where the visible path, plaza, cobble or sand weight could exceed 0.25, and none on the riverbed, the wet bank or steep ground. Density fades toward each edge, so edges stay ragged.
2. **Water:** none where `Terrain.inWater`, including the pond's lobed bowl.
3. **Pads:** none inside any pad's base box (`pads.ts`), so nothing grows under buildings, furniture or the beds. The spec lists are read after `attachHome` and `attachCraft`, so every pad is known.
4. **Mats and floors:** none on the picnic mat, the painting spot, the bridge deck or the plaza decal. This is a new exclusion list in `homestead.ts` / `layout.ts`.
5. **Obstacles:** none inside any obstacle circle (trunks, rocks, boulders, posts, cliff walls), enlarged by the margin above.
6. **Readability:** no meadow flowers within 0.5 u of a collectable flower or a special target (§6 covers drops).

The masks live in one pure module. A unit test samples points along every exclusion boundary, not only the centres, against the real layout.

## 4. Data and drawing

- **Ground data:** extract the displaced ground, its surface weights and its colour inputs from `Planet.tsx` into a pure `world/groundData.ts`. Both the ground mesh and the grass field read it, so roots sit exactly on the rendered triangles, mesa caps included. A unit test checks that every root lies on a ground triangle within 1e-4 u.
- **Placement** (`world/grass/field.ts`, pure):
  - A jittered grid per ground triangle, from a seed.
  - A spatial hash for obstacles and pads, so each candidate checks only its neighbours.
  - Deterministic output.
- **Batches:**
  - Blades are sorted into 256-blade batches by cube-sphere patch, then by Morton order within the patch, so each batch is spatially compact.
  - Within a batch, blades are sorted by a stable hash, so a prefix of the batch is a uniform thinning of it.
  - Each batch has a bounding sphere that covers root height, the tallest blade or tuft, the largest wind and mover lean, and view-space thickening.
- **Packing:** 20 bytes per blade.
  - `tex0`: a `Uint32Array` in an `RGBAIntegerFormat` / `UnsignedIntType` `DataTexture` (nearest filter, no mipmaps, no colour space). x, y, z are the root's float bits (`uintBitsToFloat`, so exact). w packs yaw (10 bits), height (8), width (6) and clump (8).
  - `tex1`: `RGBA8` holding the linear root colour, plus a hash.
  - Texel address: `ivec2(id & 1023, id >> 10)`.
  - Flowers use the same layout, with a palette index in the clump bits.
  - About 3 MB of GPU memory on high.
- **Draw:** one `Mesh` with an `InstancedBufferGeometry`.
  - The index template covers one 256-blade batch (1,280 vertices, `Uint16`).
  - A per-instance `aBatch` attribute holds the batch id.
  - The vertex shader finds its blade as `aBatch × 256 + gl_VertexID / 5`.
  - It is one draw call for the grass and one for the flowers, and needs no per-object uniforms (a shared-material uniform set in `onBeforeRender` isn't re-uploaded between objects in three.js).
  - The geometry has an explicit bounding sphere and `frustumCulled = false`.
- **Hidden batches** (decision D1):
  - Each frame, the CPU tests every batch against the planet with **horizon culling** ([Cesium, "Horizon culling"](https://cesium.com/blog/2013/04/25/horizon-culling/), and [computing the occlusion point](https://cesium.com/blog/2013/05/09/computing-the-horizon-occlusion-point/)).
    - The occluder is a sphere of the planet's **minimum** ground radius (the deepest riverbed or pond bowl), so it's conservative.
    - The occludee point comes from the batch's bounding sphere.
    - It is tested in planet space against the current camera, so any pitch (30–78°), the fly-over and the reset all work.
  - The visible batch ids are written into `aBatch` and set as `instanceCount`. That's about 550 tests and a ≤ 1 KB upload, and only when the camera or planet moved.
  - A test renders frames with and without skipping at the pitch limits, during the fly-over and at a mesa rim and the pond, and requires identical pixels.
- **Density** (tiers and adaptive):
  - The drawn index count is the batch prefix: `drawRange.count = ceil(d × 256) × 9`. Lowering density really removes vertex work.
  - Changes are temporal: the blades being removed shrink to zero over 0.6 s, then the range is cut. Blades being added grow from zero after the range is raised. Nothing pops.
  - Tiers: `high` d = 1 of 140 K; `low` d = 1 of 70 K.
  - Adaptive quality adds steps d = 0.7 and 0.5 after the pixel-ratio steps and before bloom is dropped.
- **Vertex shader:**
  - Builds the tangent frame from the root normal.
  - Bends the blade by its lean, the wind (§6), the movers and the clump.
  - Thickens it in view space when seen edge-on.
  - Writes the gradient colour **after** the blade is built. In three's chunk order, `color_vertex` runs before `beginnormal_vertex`: the prototype hit this.
  - NaN-safe: clamped `pow` bases, `inversesqrt(max(…))`.
- **Fragment:** the stock Lambert path (fog, shadows, `withLampLights`). The normal chunk is patched so back faces aren't flipped. No `discard`.
- **Chunk:**
  - A `grass` chunk, attached in `game-mount.tsx` after `attachHome` / `attachCraft` and before the scene mounts.
  - Placement runs in slices of ≤ 8 ms that yield while the textures finish loading. It needs the lawn tile, so it finishes after the tile is decoded. If that isn't enough, a worker is the fallback.
  - Both programs compile with `compileAsync` alongside the scene.

## 5. Colour continuity with the ground

The ground's lawn colour is the vertex `grassColor` times:
- a mottle fbm;
- a height tint;
- two triplanar lawn-tile samples;
- clover and painted flower dots;
- a warm tint beside the paths (`planetMaterial.ts`).

- **Share the colour model.** A pure `lawnAlbedo(n)` in TS reproduces the low-frequency terms (vertex colour, mottle, height tint, path warmth, drift) with the same noise functions. The tile is read from its decoded pixels in linear space and divided by its mean, exactly as the shader does.
- **Remove the dots.** When the grass is on, the ground shader drops its procedural clover and painted flowers (`USE_BLADES`): the blades and meadow flowers replace them. The lawn tile is repainted calmer (§7).
- **Check it.** `__game.grassDebug('roots')` draws each blade as a flat dot of its packed colour at its root. The mean difference from the ground beneath must be ≤ 6/255, measured on a real GPU at three views.

## 6. Wind, movers and drops

- **One wind model.** Extract the sway maths from `Props.tsx` (`addSway`) into a shared GLSL function next to `WIND_GLSL`, used by both the props and the blades. AGENTS.md gets a line saying pulled geometry may use that function directly.
  - Coordinate space: roots, wind and movers are all planet-local. The CPU converts movers from world space each frame, because the planet rotates under the camera.
  - The wind freezes under `selectAmbientPaused` and Reduce motion; `__game.setWind` makes it deterministic.
- **Movers:** a uniform array of 16 `vec4`s (planet-local position and radius):
  - the character, Chopper, the family and Prabin;
  - the 9 ground drops nearest the character.
- **Flattening:**
  - Within 0.2 u of an actor's feet, blades lie **fully** flat, so feet stay visible. The occlusion outline ignores occluders within 0.25 u, so it can't be relied on.
  - Between 0.2 and 0.45 u, blades lean away.
  - Blades under a drop lie flat within 0.3 u, so a resting drop (0.1 u above the ground) is never hidden.
- **Tests:** after a large planet rotation, the bend still sits under the character, and a resting drop is visible at the tallest blade setting.

## 7. Other plants and textures

- **Tufts:** the 650 `grassCards` clumps become tufts of 20–30 taller blades from the same field. The `grass-card` texture is removed.
- **Lawn tile:** repainted calmer (soft warm/cool drifts, no dots) with GPT Image 2.5 `tile`, using the concept and a game screenshot as references. The prompt and source go in `assets-src/textures/`.
- **Drift map:** a 256² seamless painted tile (warm/cool patches and flower-colour regions), sampled once per blade at load. If `gameTexture('meadow-drift')` is missing, a deterministic value-noise field is used instead, as the texture rules require.

## 8. Budgets

Frame and load numbers are **medians of 5 runs**, reported with their spread.

| Budget | Limit | Measured by |
|---|---|---|
| Grass chunk JS | ≤ 10 KB gz; on-demand total ≤ 80 KB (D3; the checker and AGENTS.md change with it) | `npm run verify:prod` |
| Main bundle | ≤ 0.2 KB for the attach glue | `verify:prod` |
| Textures | Lawn tile (replacing the old one) + drift tile ≤ 60 KB; total ≤ 1.5 MB | `textures.test.ts` |
| GPU memory | ≤ 4 MB allocated for textures and index buffers on high | Unit test on the allocated byte sizes |
| Draw calls | +2 (grass, flowers) | `perfStats` |
| Triangles drawn | ≤ 200 K on high (≈ 168 K grass + 25 K flowers) and ≤ 100 K on low at the spawn view, after skipping | `renderInfo` |
| Load | Placement ≤ 30 ms of main-thread work on desktop, ≤ 120 ms at 4× CPU throttle; longest task ≤ 50 ms; time to playable within 5 % | `perf:audit` with marks |
| Frame, SwiftShader proxy | ≤ +10 % at the spawn and home views with D1; ≤ +20 % without (all 140 K blades measured +15 %, before flowers) | The prototype's method in `perf:audit` |
| Frame, real GPU | No NaN pixels; no measurable GPU-time change on desktop | `perf:audit`, `hdrScan` |
| Phone (D5) | At the low tier on the owner's phone, at its native DPR cap (1.5), on the route plaza → home → pond for 60 s after a 30 s warm-up: p95 frame ≤ 33 ms, and adaptive quality not below d = 0.7 | Manual, recorded in the DoD |
| E2E | Suite time grows ≤ 10 %: unrelated tests run with a pre-mount test flag at d = 0.25, and the grass tests at full density | Full `npm run e2e` |

## 9. Test hook

- `__game.grass()`: counts per tier, batches drawn, density, the last placement time.
- `__game.setGrassDensity(d)` (a temporal change, like adaptive quality).
- `__game.grassDebug('roots' | 'off')`.
- A pre-mount test flag (the `localStorage` key `game.test.grassDensity`) for unrelated E2E tests.
- Dev and test builds only. `npm run check` is required, since the hook's signature changes.

## 10. Critique log (v1 → v2)

v1 was the common three.js recipe. The prototype replaced it with pulled blades, and an independent review of that draft found 17 more issues. Each was fixed:

| # | Finding | Fix in v2 |
|---|---|---|
| 1 | One instance per blade costs about 7× pulled blades (measured) | Pulled blades |
| 2 | A per-draw offset uniform on a shared material isn't re-uploaded per object in three.js | One draw; the batch id is a per-instance attribute |
| 3 | One geometry has one draw range; without a position attribute, bounds are undefined | An explicit bounding sphere; the draw range is the density prefix |
| 4 | Shrinking hashed blades to zero still runs every vertex | Density cuts the batch prefix; temporal grow and shrink |
| 5 | The 96-draw design was never benchmarked | Batched instances measured: the same cost as one pulled draw (§11) |
| 6 | The horizon test was vague (pitch range, fly-over, riverbeds, tall tufts) | Horizon culling against the minimum-radius sphere with swept bounds; tests at every extreme |
| 7 | Horizon culling breaks an explicit AGENTS rule | D1 is a hard prerequisite; AGENTS.md is amended in the same change; a no-D1 budget is set |
| 8 | Grass couldn't read the real ground data, which lives inside `Planet.tsx` | A shared pure `groundData.ts` |
| 9 | The lawn colour has more terms than the tile; the painted dots would stay | A shared `lawnAlbedo`; the dots are removed; a root-colour check |
| 10 | The load target assumed work would overlap without saying how | Ordering after attach; a spatial hash; ≤ 8 ms slices; a worker fallback; longest-task budget |
| 11 | Drops rest at 0.1 u, under 0.27 u blades; feet would hide | Drops and feet flatten the grass fully; tests for both |
| 12 | Sidedness was unspecified | `DoubleSide`, patched normals, a test from opposite sides |
| 13 | The integer texture format was unspecified | Exact format, filtering and bit layout; a real-GPU round-trip test |
| 14 | Raw masks miss the shader's noisy edges; shrunken obstacle radii let blades in | The visual thresholds with a margin; radii enlarged by half-width + lean; boundary tests |
| 15 | Custom wind would break the "all sway through `addSway`" rule | A shared wind function; the AGENTS line amended |
| 16 | Budgets used "within noise" and "steady" | Medians of 5; p95; an exact phone route and duration; draw-call and triangle caps |
| 17 | The pages weren't in the docs manifest | Registered |

## 11. Prototype evidence for v2

Batched instances (256 blades each) versus one pulled draw, 140 K chunky blades, home view, SwiftShader:

| Blades drawn | One pulled draw | Batched (256 per instance) |
|---|---|---|
| 0 | 450 ms | 450 ms |
| 56 K (≈ 40 %, as if hidden batches were skipped) | 483 ms (+33) | 483 ms (+33) |
| 140 K (all) | 533 ms (+83) | 517 ms (+67) |

Batching costs nothing measurable, so hidden-batch skipping and the density prefix come free. With about 40 % of the batches drawn, the grass adds about 7 % to the SwiftShader frame.

## 12. Plan

| Phase | Work | Validation (per the AGENTS tiers) |
|---|---|---|
| 0. Decisions | D1–D5 from the owner; AGENTS.md amended for D1 and D3 | — |
| 1. Data | `groundData.ts` extracted from `Planet.tsx` (pixel-identical ground); `field.ts` (masks, spatial hash, batches, packing); `lawnAlbedo`; the drift fallback | Unit: ground equivalence, masks along boundaries, determinism, packed and allocated sizes, batch bounds; E2E rendering group for the extraction |
| 2. Blades | The chunk, instanced batch draw, shader, colour, lighting, lamps, fog, sidedness, tiers, temporal density, horizon skipping, test hook | Unit: shader rules (no `discard`, clamped `pow`); E2E: rendering, landscape & wind, skip identity; `perf:audit` before and after; `hdrScan`; one screenshot |
| 3. Flowers | Drifts, palette, keep-clear, batched the same way | Unit: keep-clear; one screenshot |
| 4. Movers and drops | The bend array, full flatten at feet and drops, planet-local conversion | E2E: feet and drop visible; bend follows after rotation |
| 5. Other plants | Tufts replace the cards; the lawn tile repainted; the drift tile; the dots removed; CREDITS | `textures.test.ts`; the root-colour check; one screenshot per view |
| 6. Validation | The owner's phone; full E2E; `verify:prod`; `npm run check`; docs (this page as built, AGENTS, README, CREDITS) | Tier 3 |

## 13. Definition of Done

| # | Criterion | Evidence |
|---|---|---|
| 1 | Blades on every lawn at the spawn, home and plaza views, matching the target (chunky, clumped, ground-coloured, flower drifts) | Screenshots beside the concept; owner sign-off |
| 2 | No blade or flower on paths, plaza, cobbles, sand, water, mats, bases or obstacles | Boundary-sampled unit tests; screenshots of the home, pond and plaza |
| 3 | Roots are continuous with the ground | The root-colour check ≤ 6/255 at three views |
| 4 | No `discard`, alpha test or transparency in the grass or flowers | Unit test on the shader source |
| 5 | Wind matches the trees and freezes under Pause ambient motion and Reduce motion | E2E (landscape & wind) |
| 6 | Day, dusk and night lighting, lamplight and fog on the blades | Screenshots at 10:30, 18:30 and 22:00 |
| 7 | Feet and resting drops stay visible; blades part around movers after planet rotation | E2E pixel checks |
| 8 | No pop-in: density changes are temporal; skipping changes no pixel | E2E frame identity at pitch limits, fly-over, mesa rim and pond |
| 9 | No NaN pixels | `perf:audit` on a real GPU |
| 10 | Every budget in §8 met (medians of 5 with spread) | `verify:prod`, `perf:audit`, unit tests, E2E timing |
| 11 | The phone criterion met on the owner's phone | Recorded result |
| 12 | Docs updated: this spec marked as built, AGENTS rules (grass, D1, the wind function, the budget), README, CREDITS | Diff |
