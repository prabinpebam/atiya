# Performance audit — September 2026

A measured audit of the 3D planet: what it costs to load and to draw, where that time goes, what was changed, and what was deliberately left alone. The rule for every change was **no visible difference**: each optimization had to be lossless or pixel-identical, or it was dropped.

## How it was measured

- **Production-like build:** `npm run build:test` (minified, with the test hook), served by `astro preview`. The dev server was used only to attribute costs to source files.
- **Real GPU:** headless Chromium on ANGLE/D3D11 (an RTX 4090 on the audit machine). GPU time per frame comes from `EXT_disjoint_timer_query_webgl2`, summed over each animation frame.
  - A 4090 is latency-bound on this scene (≈ 1 ms per frame at 4K). Its numbers show *relative* costs, not what a laptop iGPU will do.
  - SwiftShader (a CPU rasterizer) was used as a second, very slow "GPU". It is vertex-bound here: halving the resolution barely changes its frame time.
- **Slow CPU:** Chrome DevTools CPU throttling ×4, roughly a mid-range laptop or phone.
- **Time to playable:** the `game:playable` mark, as a median over 4 runs.
- **Visual check:** 7 fixed views (spawn by day and night, Lighthouse at dusk, Library, pond, bridge at night, forest) rendered before and after under SwiftShader, with ambient motion paused. The images were compared pixel by pixel.
- **Geometry check:** a checksum of every mesh's triangle stream (indices expanded), before and after.
- **Re-run it:** `npm run perf:audit` ([scripts/perf-audit.mjs](../../scripts/perf-audit.mjs)) against a dev or test server. The `__game.perfStats()` test hook returns the scene census.

## Baseline: what it cost

| | Measured | Notes |
|---|---|---|
| Time to playable, 1× CPU | **2.92 s** | Spec §7 budget: ≤ 3.0 s, and that budget also assumes a throttled network |
| Time to playable, 4× CPU | **8.7 s** | |
| Main thread blocked in shader compile/link | **≈ 1.9 s**, in one frame | `getProgramInfoLog` / `LINK_STATUS` inside the first draw |
| Shader programs | 82 | 25 of them compiled for an output encoding that is never used |
| JS heap at playable | 93 MB | |
| Draw calls / triangles per frame (all passes) | 138 / 681 k | Scene 464 k + shadow casters 237 k |
| Vertices | 1.19 M | 3 per triangle for every kit model |
| JS per frame | 1–2 ms | No GC churn, 9 DOM mutations in 3 s of walking |
| GPU per frame (4090, 4K, DPR 2) | 0.90 ms | |
| Texture GPU memory (est.) | 25.7 MB | Budget ≤ 32 MB |

The frame loop itself was already lean: little JS, instanced props, merged kit models and about 140 draw calls. The real problems were at **load** (one long freeze) and in **memory and vertex bandwidth**, which hurt most on integrated GPUs, where video memory is shared with the system.

## What was changed

| # | Change | Why | Effect | Look |
|---|---|---|---|---|
| 1 | **Shader warm-up before the first draw** ([Scene.tsx](../../src/game/Scene.tsx) `SimDriver`) | `compileAsync` ran *alongside* the first render, so the first draw compiled everything, blocking. It also compiled for the canvas (sRGB output), while the scene is drawn into the composer's linear HDR buffer, so each program was built again for the right encoding. | The camera looks at an empty layer until `compileAsync` (with a render target bound, and with parallel compile where the driver supports it) finishes. The loading screen stays up throughout. Programs 82 → 57; the 1.9 s freeze is gone. | Identical |
| 2 | **Textures uploaded during the compile** (`uploadTextures`) and **decoded off the main thread** ([textures.ts](../../src/game/world/textures.ts): `ImageBitmapLoader`, flipped at decode) | The 24 WebPs were decoded and uploaded one by one inside the first frame | The decode happens while the chunk loads; the upload overlaps the driver's compile | Identical (pixel diff) |
| 3 | **Shader error checks off in production** (`gl.debug.checkShaderErrors`) | Each check forces a synchronous link-status query | Removes the last synchronous queries. Dev and test builds keep the checks | n/a |
| 4 | **Exact indexing of kit models and leaf cards** ([kit.ts](../../src/game/world/kit.ts) `indexExact`, [foliage.ts](../../src/game/world/foliage.ts) `Cards`) | `toNonIndexed` + merge left 3 vertices per triangle, so every vertex was shaded 3–6 times, in both the colour and the shadow pass | Vertices 1.19 M → **0.49 M (−59 %)** with the same triangles; heap −26 MB. Only vertices that are bit-for-bit identical in every attribute are merged, so it is lossless. Build cost ≈ 50 ms | Identical (bit-identical triangle streams) |
| 5 | **No MSAA or stencil on the canvas** ([GameApp.tsx](../../src/game/GameApp.tsx)) | The composer draws the scene into its own 4× multisampled buffer; the canvas only receives a full-screen copy, so its own MSAA smoothed nothing | Frees a multisampled colour + depth buffer the size of the canvas: ≈ 150 MB at 1080p × DPR 1.5, ≈ 265 MB at 4K. GPU 1.23 → 1.18 ms at 4K | Identical |
| 6 | **Bounds tests before the terrain's arc maths** ([terrain.ts](../../src/game/world/terrain.ts) `flatMask`, [Planet.tsx](../../src/game/world/Planet.tsx) `buildGround`) | For each of ~35 k ground vertices and each landmark, two `acos` distances and an allocating path-segment distance, although the factor is exactly 1 (or the band exactly 0) almost everywhere | A dot product against a precomputed cosine skips them. The river distance is computed once per vertex instead of twice | Identical (ground checksum; unit test against the full evaluation) |
| 7 | **Adaptive quality starts when the planet is playable** ([Scene.tsx](../../src/game/Scene.tsx) `Adaptive`) | Found while testing: the frame-rate monitor ran from mount, so the bursty loading frames (a 2 s freeze, then fast frames) counted as four up/down flip-flops and tripped its fallback. That **switched adaptive quality off for the whole visit** on every device | The monitor mounts, and its 10 s warm-up starts, only once the game is playable, so a slow device really does step down | n/a |
| 8 | **Probe the strict WebGL context first** ([capabilities.ts](../../src/game/platform/capabilities.ts)) | The gate made two probe contexts on every visit, before the game could start downloading | A single context on capable devices; same decisions | n/a |

**After:**

| | Before | After |
|---|---|---|
| Time to playable, 1× CPU | 2.92 s | **1.52 s (−48 %)** |
| Time to playable, 4× CPU | 8.69 s | **3.97 s (−54 %)** |
| Longest main-thread block during load | ≈ 1.9 s | ≈ 0.3 s (first frame: geometry uploads) |
| JS heap at playable | 93 MB | **43 MB** |
| Shader programs | 82 | 57 |
| Vertices | 1.19 M | **0.49 M** |
| Draw calls / triangles | 138 / 681 k | 137 / 681 k |
| Canvas MSAA buffers | ≈ 150–265 MB | 0 |

## Considered and not done

| Idea | Why not |
|---|---|
| 2× instead of 4× MSAA at high pixel ratios | Measured *slower* on the NVIDIA GPU (0.87 → 1.19 ms at 4K), and a slight quality loss elsewhere. Reverted. |
| Precompiling the shadow-pass depth programs too | Works (a dry shadow pass collects the exact depth materials), but no measurable gain: they are small and quick to compile. It also depended on three.js internals. Removed. |
| Throttling to 30 fps when idle | The world is never still: swaying trees, water, clouds, the idle animation. At 30 fps that motion loses smoothness. |
| Horizon culling of objects on the far side, or of their shadow casters | It would save roughly 40 % of landmark shadow-caster triangles. But the owner's rule is "no culling, nothing pops in" (AGENTS.md), so it needs an owner decision. Casters well past the horizon could be dropped from the shadow pass only, with nothing visible changing. |
| Moving the 3 point lights (door, lanterns) into the lamp system | By day it would save three physically based light evaluations per fragment. But the lamps are diffuse-only, so the lanterns would lose their specular glints on the water and the planks. |
| Fewer bloom mip levels or a lower resolution | Visibly shrinks the night glow's halo. |
| LOD models | Ruled out by the owner's no-LOD rule; the triangle budget waiver is pending instead (plan §6). |
| KTX2 / Basis textures | Texture memory (≈ 26 MB) is within budget, and the transcoder would add more download than it saves for 24 small textures. |
| Removing the canvas depth buffer too (`depth: false`) | Small saving now that the canvas has no MSAA. Any frame drawn straight to the canvas (e.g. while the composer is swapped) would then have no depth test. |

## Remaining opportunities (in order of value)

1. **World generation off the critical path.** Before the shaders start compiling, ≈ 0.8 s passes at 1× (≈ 3 s at 4×), spent parsing the game chunk and generating the procedural world (layout, kit models, the ground). Options, in order of effort:
   - build the ground and the kit models in a Web Worker (they're pure functions of the layout);
   - cache the generated geometry in IndexedDB, keyed by a content hash, for repeat visits;
   - generate it at build time and ship it as a binary asset.
2. **Shadow-caster cost** (237 k triangles per frame). The landmark models cast from their full detail. Casting from a simplified hull (walls and roof only), or dropping far-side casters, needs art and owner sign-off.
3. **Starting quality on phones.** Adaptive quality waits 10 s before stepping down. Coarse-pointer devices could start at DPR 1.25 instead of 1.5, but this needs measurements on real phones first.
4. **Real-device numbers** (a Definition of Done item that is still open): frame pacing on the owner's laptop iGPU, an Apple Silicon Mac and two phones, using the spec §7 method. None of the numbers above come from a battery-powered device.

## Keeping it fast

- New materials that appear after load (e.g. a model streamed in later) compile synchronously on their first frame. Mount them with the scene when possible.
- Kit output is indexed. Code that walks triangles must expand it first (`toNonIndexed()`), and code must never call `computeVertexNormals` on kit output (it would replace the parts' own normals).
- `npm run perf:audit` before and after anything that touches loading, materials or geometry; compare time to playable, programs and vertices.
