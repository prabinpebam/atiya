# Progressive loading: a greeting at first paint, a planet you can walk at once, the world summoned around you (spec and plan: audit, v1, critique, v2)

> **TL;DR.** Today the planet loads as one block. A static "Loading the planet…" card shows for 2.3 s on a fast desktop, 6.2 s on a mid-range laptop (CPU ×4) and 17.7 s on a slow connection. The main thread is frozen for most of that, building every tree, flower, rabbit and house, and then everything appears at once. This spec splits the load into **tiers**:
>
> - **T0, first paint:** Prabin's greeting, in the page's own HTML.
> - **T1, planet live:** the ground, the sky, the seven buildings and the character. You can walk from here.
> - **T2, summoned:** everything else, built in small slices and popped into place with a springy wiggle, nearest first, as Prabin "brings the planet to life".
> - **T3 and T4, idle and on demand:** what the first minute doesn't need.
>
> Only the path to T1 keeps a load-time budget. What follows is bounded by frame rate and memory.
>
> **Status: implemented** (phases 1–6 and 8; phase 7, workers, isn't needed yet at 1× CPU; phase 9 is optional). The decisions in §6 were taken as proposed. What was built, where it differs from this spec and the measurements are in §9. The audit in §1 is from 28 September 2026 (commit `085e431`).

## 1. Audit: today's load, measured

### 1.1 Method

- **Build:** the production-like test build (`npm run build:test`), served by `astro preview`. The dev server was used only to attribute costs to source files (a CPU profile of a warm reload).
- **Machine:** the owner's desktop. The GPU is an RTX 4090 through ANGLE/D3D11, so the CPU, not the GPU, sets the pace.
- **Profiles:** 1× and 4× CPU (Chrome's throttling; 4× is roughly a mid-range laptop), with no network throttling, "fast" (10 Mbps, 40 ms) and "slow" (1.6 Mbps, 150 ms) connections. The cache was disabled; each figure is the median of 3 runs.
- **Timeline:** temporary `performance.mark`s at each step, removed after measuring (phase 1 adds them for good), plus the existing `game:shaders-compile`, `game:shaders-ready` and `game:playable`.
- **What the visitor sees:** screenshots every half second during the load.

### 1.2 The timeline (ms from navigation)

| Step | 1×, no throttle | 4× CPU | 1×, fast network | 4×, slow network |
|---|---|---|---|---|
| The gate runs (capability probe) | 157 | 177 | 181 | 786 |
| The game's JS has arrived | 215 | 502 | 651 | 3,487 |
| World generated (layout, terrain) | 244 | 640 | 680 | 3,654 |
| Textures and the four chunks downloaded | 299 | 809 | 2,116 | 12,075 |
| Chunks attached (home, crafting) | 401 | 1,261 | 2,219 | 12,532 |
| First frame: shader compile starts | 1,181 | 4,863 | 3,015 | 16,301 |
| Shaders ready | 1,731 | 5,511 | 3,608 | 16,925 |
| **Playable** | **2,275** | **6,213** | **4,159** | **17,684** |

The 1.52 s in the [performance audit](./performance-audit.md) has grown to 2.28 s as the planet gained the home, the family, crafting, the deck, the furnace, the grass and the wildlife.

### 1.3 Findings

1. **One long build in the first render, the biggest block:** 0.8 s at 1×, **3.6 s at 4×**. Every component builds its geometry in `useMemo` during the first render, all in one task, so at 4× the page can't draw a single frame for about 5 s. The biggest builders, from a CPU profile (dev server, 1×):

   | Builder | Time |
   |---|---|
   | The ground (`buildGround`) | 275 ms |
   | The blade grass (`GrassField`, `placeGrass`) | 245 ms |
   | The home (house, yard, garden) | 193 ms |
   | The landmarks (`landmarkModel`) | 132 ms |
   | The wildlife, 113 ms of it the rabbit models (colour callbacks that transform every vertex) | 125 ms |
   | The landforms (cliffs, mesas) | 84 ms |
   | The props (trees, rocks, flowers) | 72 ms |
   | The family's navigation grid (`attachHome`) | 70 ms |
   | The plaza | 61 ms |
   | The viewing deck | 55 ms |
   | The crafting chunk's attach | 51 ms |

   Underneath, the time goes to:
   - kit geometry: merging, exact indexing, rounded boxes, edges and vertex colours;
   - placement tests: `angleBetween`, `riverDistance` and `mesaRadius`;
   - allocation.
2. **Everything downloads before anything shows.** All 30 textures (1.33 MB) and all four chunks must arrive before React mounts, and they only start once the 450 KB of game JS has arrived. They hold the mount back to 2.1 s on the fast connection and to 12 s on the slow one.
3. **The shader compile and the first three frames come after the build:** 0.55–0.65 s to compile (already parallel) and 0.55–0.7 s for the first frames, which upload every geometry and texture at once.
4. **2.4–2.6 MB is downloaded before anyone can play:**
   - the game's JS: 450 KB gz;
   - the textures: 1.33 MB;
   - the player's character model: 164 KB;
   - the other character's model: 303 KB, needed because Rojina's body is the Sunny rig;
   - the family's skins, as PNG: 146 KB.
5. **What the visitor sees:** the loading card, unchanged, for the whole time. Then the planet appears all at once, with Prabin's welcome already open.
6. **Caching:** GitHub Pages serves every file with `Cache-Control: max-age=600`. A repeat visit more than 10 minutes later revalidates everything.

## 2. Research: established patterns

| Pattern | Where it comes from | What we take |
|---|---|---|
| Load what's round the player first, the rest in rings outward | Open-world games stream by distance; Minecraft generates and loads the chunks round the player first | Summon nearest first, in a wave outward from the character |
| Response-time limits: 0.1 s feels instant, 1 s keeps the flow of thought, 10 s loses attention | Jakob Nielsen, *Usability Engineering* (1993) | Something meaningful at first paint, and something playable well before 10 s, even on slow connections |
| Load in under 5 s on a mid-range phone; no main-thread task over 50 ms | Google's RAIL model; Core Web Vitals (LCP ≤ 2.5 s, INP ≤ 200 ms) | The planet live within budget, and the summoning in slices that never block input |
| Fill the wait with content, not a spinner | Skeleton screens, and games that play their intro dialogue while the level streams | Prabin's greeting *is* the loading screen: reading it covers the load |
| Make the pop-in a moment | Games that spawn objects with a scale-and-bounce "pop" rather than a sudden appearance | The summoning: a springy, wiggling scale-up with a puff of sparkles, as a feature, not a glitch |
| Make repeat visits fast | HTTP caching, service workers | Cached assets on return; optionally cached generated geometry |

## 3. Plan v1 (the owner's brief)

1. Not everything has to be on the critical path.
2. Audit it, and make a judgement call on what must be on the critical path and what can load progressively.
3. That may change the acceptable budget. Loading progressively, the final loaded state can be larger, bound only by frame rate, not by load time.
4. An interesting load animation, with Prabin's greeting appearing at load time itself. The player can start playing as soon as the UI is ready.
5. If trees, rocks and buildings take time to load, make it a feature. Once the planet has loaded, each object appears as if magically summoned into place, with a wiggle, growing, and a springy bounce.
6. Frontload what loads fast and get it out of the way, so players can engage at once. The experience must be coherent.

## 4. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | "Buildings" among the summoned things | The buildings are the portfolio: the reason to come. They're also only 132 ms of the build | The buildings arrive with the planet (T1); trees, rocks, flowers, grass, the home and the rest are summoned (T2) |
| 2 | "Play as soon as the UI is ready" | A HUD with no planet under it isn't playable | "Live" means the ground, the sky, the buildings, the character and the controls; the UI comes with them |
| 3 | "Bound only by frame rate" | Memory, the total download (data plans) and heap growth also bound a big planet | Runtime budgets: frame rate, GPU memory, JS heap, draw calls, and a soft cap on total download (§5.6) |
| 4 | Objects appearing after the planet does | AGENTS.md's rule is "no culling, nothing pops in" | Summoning happens only at load, as a designed moment; the rule holds from `game:complete` on (decision 1) |
| 5 | Walking into things not summoned yet | Invisible trees would block you | Obstacles, targets and nav blocks switch on at each object's reveal, and the wave starts at the character |
| 6 | Prabin's greeting at load time | The welcome lives in the home chunk and needs the whole game: it can't appear before the JS | The page renders the talk box and the lines itself (T0); the game takes it over at the line the visitor has reached |
| 7 | Prabin speaking before he exists | In the game, he stands in front of you as he talks | He talks from the page first, and is the first thing summoned, beside you |
| 8 | The welcome holds the controls | That works against "play at once" | Once the planet is live, a step or a click ends the welcome and walks (decision 2); talking to the family still holds the controls |
| 9 | Textures arriving after play starts | Swapping a texture into a live material recompiles it: a hitch | A group's materials are made when its group mounts, after its textures; none change on a live material |
| 10 | Summoning while playing | The same build, run later, would freeze the game instead | Built in slices of about 8 ms a frame, or in a worker; each group's programs compiled on their own before its reveal |
| 11 | The animation for everyone | A wiggling world is a lot of motion | Under reduced motion, each batch just appears, in the same order and at the same time |
| 12 | Tests that assume everything exists at `playing` | They'd race the summoning | A `game:complete` stage, `__game.loadStage()`, and a test helper that waits for it |

## 5. Spec v2

### 5.1 The tiers: what's on the critical path

The test for critical: can the visitor meaningfully start without it?

| Tier | When | What | Why |
|---|---|---|---|
| **T0 First paint** | With the HTML (≈ 0.3 s; ≈ 0.8 s on a slow link) | The header; **Prabin's greeting** (the talk box, server-rendered, with his portrait); a small animated planet illustration; a progress bar; the Classic site link | HTML and CSS only, no game JS. It says who this is and what to do, and the reading time hides the load |
| **T1 Planet live** | As soon as it's ready; input is on from here | three.js, React and the controller; the ground, paths, water, sky, sun, moon, lights and post; **the seven landmarks**; the plaza and its lamps; the chest; the mesas' walls; the character (its model, 164 KB); the HUD; the textures those use (≈ 780 KB) | The world you stand on and the buildings you came for; nothing here is decoration |
| **T2 Summoned** | Right after T1, nearest first, in slices of at most a frame's work | **Prabin**, summoned first, beside you; Chopper; trees, bushes, rocks and boulders; flowers and sprigs; the blade grass, which sprouts; the home, the family (with the Sunny model, 303 KB, for Rojina) and the garden; the crafting table and the build sites; the swing, the deck and the furnace; the painted clouds; the wildlife | Smoothness matters more than seconds for these. Each is seen being made, so the wait becomes the show |
| **T3 Idle** | Once the planet is complete and the browser is idle | Card images; Chopper's card; the landmark dialog; the menu; the night-only assets (the moon's texture, the crickets and frogs) | Never needed in the first minute, so they never compete with the load |
| **T4 On demand** | When first used | The inventory and crafting screens; the paint palette; the touch controls (coarse pointers only); sound (on the first press) | As today |

This moves out of the critical path:

- every prop and the grass;
- the models in the four chunks (home, crafting, nature, Chopper's body);
- about 550 KB of textures: trees, rocks, the pond, the tufts, Chopper's fur, the picnic mat, the clouds, the moon;
- the Sunny model (303 KB);
- the family's skins.

The greeting moves in: today it opens only after everything has loaded.

### 5.2 The experience

A first visit on a mid-range laptop and a fast connection:

| Time | What happens | What the visitor can do |
|---|---|---|
| 0.3 s | The page appears on its sky gradient, with a small illustrated planet turning slowly in the middle. The wood talk box slides up with Prabin's name and portrait, and his first line types out: "Hi, I'm Prabin. Welcome to my little planet!…" A slim progress bar sits under the planet | Read; E, Enter or **Next** for the next line; go to the classic site |
| 0.3–2.5 s | The lines go on (how to walk, E and Space, the lantern). The bar fills as the JS and the core textures arrive | Keep reading. Nothing heavy runs yet, so the page stays responsive |
| ≈ 2.5 s | **The planet is live.** The illustration cross-fades into the real planet, and the camera settles from a slightly higher view onto the character. The planet is bare but whole: the ground, the paths, the water and the seven buildings | Walk, look round, open a building, whether or not the talk has finished |
| 2.5–5 s | **The summoning.** Prabin appears beside you in a puff of sparkles as his line says "Let me bring the planet to life for you!". Then, outward from you in a wave: trees pop up with a springy wiggle, rocks drop in with a thud, flowers open, and the grass sprouts in a ripple across the meadows. Chopper bounds in; the home, the family and the garden settle into place; the rabbits hop in and the ducks paddle out. The clouds drift in from the edges of the sky | Everything. A tree becomes solid and shakeable the moment it has appeared |
| ≈ 5 s | The planet is complete. Card images and night-only assets fetch quietly in the background | |

On a slow connection the greeting still shows at first paint, the planet goes live at about 7 s, and the summoning goes on as the assets arrive, nearest first.

### 5.3 The greeting at first paint

- **It's the game's own talk box:** `.talk-box`, on the wood surface, rendered by `play.astro`. The lines come from a small shared module (`welcomeLines`, moved out of `family.ts` into `world/home/welcome.ts`), which the page renders at build time. A few lines of script in the gate handle **Next** and the keys until the game takes over.
- **The handoff:** when the game mounts, it opens the talk at the line the visitor has reached. The box doesn't move or flicker; only its owner changes.
- **Returning visitors** get the short greeting (the existing `onboardingSeen` rule), and usually a much faster load from the cache.
- **Touch** gets the touch wording: the page checks `(any-pointer: coarse)` before the first paint.
- **Finishing early:** if the visitor reaches the last line before the planet is live, the box shows a quiet "Getting the planet ready…" beside the bar. It never loops or blocks.
- **Screen readers:** the greeting is real text in the page. There's one announcement when the planet is live ("The planet is ready."), and none per object.

### 5.4 Playing at once

- Input is on from T1. Once the planet is live, a movement key or a click on the planet ends the welcome and walks; the notice board and How to play keep every instruction. The welcome is the one talk that behaves this way.
- The buildings, their previews and their cards are all T1, so the whole portfolio is reachable as soon as the planet is live.
- Nothing is solid or usable before it has appeared.

### 5.5 The summoning

- **The pop:** each object scales up from zero along a spring, overshooting to about 1.12 and settling in about 0.45 s. As it grows it wiggles a few degrees about its upright, and the wiggle dies away with the spring. A small puff of sparkles marks the spot, reusing the build puffs and `Sparkles`.
- **Each kind in its own way**, one idea in many voices:

  | What | How it appears |
  |---|---|
  | Trees and bushes | The pop, the crown lagging a beat behind the trunk |
  | Rocks and boulders | A drop and a squash (they're heavy), and a thud once sound is on |
  | Flowers and sprigs | They open: a quicker, smaller pop |
  | Blade grass | It sprouts: the blades rise from the ground in a ripple (a height ramp in its shader) |
  | The home, the table, the build sites | They rise on a spring, as builds already do (`BUILD_S`) |
  | Prabin, the family, Chopper | A sparkle burst, and they're there (people don't grow) |
  | Rabbits, birds and ducks | They hop, fly or paddle in from off-screen |
  | The painted clouds | They fade and drift in; the sky starts clear |

- **The order:** a wave outward from the character at about 12 u/s. Within reach, what you can use comes before what you only see. Each frame starts at most a few objects, so the wave reads as a ripple, not a flash.
- **Sound:** a soft pop per burst, rate-limited, and only once sound is on (it still starts on the first press).
- **Reduced motion:** no spring, no wiggle, no ripple. Each batch appears in the same order and at the same time, and the grass is simply there.
- **Once only:** summoning is a load event. After `game:complete`, nothing ever pops in or out.
- **Edge cases:**
  - A chunk that fails: its group never appears, and the rest of the planet still works (today's `catch` fallbacks).
  - A background tab: the summoning pauses with rendering. Whatever is left appears in one quick wave on return.
  - A deep link (`/play/?open=…`): the card opens as soon as the planet is live, over the summoning.
  - The gate's "Explore in 3D anyway?" offer and the low tier: the same tiers; the tier only changes quality.

### 5.6 The budget model

Today the initial bundle is budgeted as if every byte blocks play. Every other chunk shares one on-demand waiver, which has risen with each feature (70 → 120 KB). With tiers, only the critical path needs a load-time budget; the rest is bounded by what the running game can afford.

**The critical path, in time** (CPU ×4):

| | Fast (10 Mbps) | Slow (1.6 Mbps) | Today (fast / slow) |
|---|---|---|---|
| The greeting shows (first paint) | ≤ 0.6 s | ≤ 1.2 s | 0.4 s / 0.8 s (the loading card) |
| The planet is live (input on) | ≤ 2.5 s | ≤ 7 s | ≈ 6.9 s estimated / 17.7 s measured |
| The planet is complete | ≤ 6 s | ≤ 16 s | as above |
| Longest main-thread task after it's live | ≤ 50 ms | ≤ 50 ms | 3.6 s before it's live |

**The critical path, in bytes:**

- critical JS: ≤ 450 KB gz, the current number, now meaning T1 only;
- critical textures and models: ≤ 1.0 MB;
- ≤ 1.5 MB in all before the planet is live (today 2.4–2.6 MB).

**The progressive part**, at runtime, replacing the on-demand waiver:

- each summoned group's chunk ≤ 150 KB gz, so every wave lands quickly;
- ≥ 50 fps on the reference machine while summoning;
- in the complete state, as now or tighter:
  - GPU texture memory ≤ 32 MB;
  - JS heap ≤ 80 MB;
  - ≤ 180 draw calls;
  - triangles within the plan's waiver;
- ≤ 6 MB in total, T3 included, as a courtesy to data plans (Save-Data already gets the gate's offer).

The complete planet can then grow where frame rate and memory allow, without each addition fighting for bytes in the first seconds.

### 5.7 Architecture

**The boot stages:**

1. **The page (T0):** `play.astro` renders the talk box, the illustration and the progress bar. The gate stays tiny: no React, no three.js.
2. **The gate passes:** it starts the game chunk and, in parallel, warms the cache with the T1 assets: the player's character model and the critical textures. Their list is generated and inlined in the page, and the game's loaders then find them in the cache. Today the textures start only after the JS has arrived, so on slow connections this alone saves several seconds. Gated-out devices still request none of it.
3. **The core mount (T1):**
   - the controller and the whole layout, obstacles included, computed as now (it's pure, and takes 30–140 ms);
   - the ground, the sky, the landmarks, the plaza, the character and the HUD;
   - only T1's materials compiled before the first frame.

   Then `game:live`, which takes over from `game:playable`.
4. **The summoner (T2):** a pure scheduler (`world/summon.ts`, unit-tested) runs the groups in order. For each group:
   - build its geometry in slices of about 8 ms a frame (or in a worker);
   - compile its new programs with `compileAsync` on the group alone (most reuse the kit programs already compiled);
   - upload its textures while the driver compiles;
   - reveal it: the pop starts, and its obstacles, targets and nav blocks switch on.

   When every group is revealed: `game:complete`.
5. **Idle (T3):** `requestIdleCallback` fetches the rest after `game:complete`.

**Groups and their order:**

1. Prabin, then Chopper.
2. The props near the character.
3. The home, the family and the garden.
4. The grass: near, then the rest.
5. The far props.
6. The crafting table and the build sites.
7. The deck, the furnace and the clay beds.
8. The wildlife.
9. The clouds.

The groups are the existing seams: the components (`Props`, `GrassField`, `HomeView`…) and the chunks (home, craft, nature, Chopper). Each mounts a hidden subtree first and becomes visible at its reveal. The home chunk's simulation (the family's routines) starts at the home's reveal.

**Building off the critical path:**

- **First, time slicing.** The pure builders (the kit, the foliage, the grass field, the terrain queries) become resumable. A group builds a few objects per frame under a time budget, yielding with `scheduler.yield()` where it exists and `setTimeout(0)` elsewhere. This alone ends the long freeze.
- **Then workers, where they pay.** The biggest pure builders (the grass field's placement and the kit models) run in a Web Worker and return typed arrays by transfer. They depend only on the layout and the seed, which the worker computes too.

**Textures in tiers:** the texture manifest gets a `tier` per texture.

- **T1:** the ground layers, the plaza, the kit surfaces the landmarks use, the water.
- **T2:** the leaves, the bark, the conifers, the rocks, the pond atlas, the tufts, Chopper's fur, the picnic mat, the painted clouds.
- **T3:** the moon.

A group's materials are made when it mounts, after its textures have arrived. The procedural fallbacks stay, for failures only.

**The pop, drawn cheaply:**

- **Instanced props** (trees, rocks, flowers): an `aBorn` instanced attribute (the reveal time) and a shared `uNow` uniform. The vertex shader scales each instance about its base along the spring and adds the wiggle. There are no per-frame buffer uploads, and a finished instance costs one comparison. The same patch goes on their depth materials, so shadows grow with them.
- **Single models** (the home, the table, the deck): a scale on their group, as the builds already do.
- **The grass:** a birth time per batch in its data texture, and a height ramp in its shader.

**Test hooks and marks:**

- **Marks:** `game:gate`, `game:chunk`, `game:world`, `game:live`, one per group reveal, and `game:complete`.
- **`__game.loadStage()`:** the tier and the groups revealed so far.
- **E2E:** tests wait for `complete` by default (a helper), except the loading tests themselves.
- **A test flag** skips the pop animations, so software rendering isn't slowed; the order stays the same.

### 5.8 Risks

| Risk | Mitigation |
|---|---|
| Pop-in against the "nothing pops in" rule | A load-only, designed moment; the rule holds after `game:complete`, and AGENTS.md gets the exception once agreed |
| A hitch when a group's programs compile | Each group is compiled alone with `compileAsync` before its reveal; most reuse programs already compiled |
| Shadows appearing before their objects | The birth scale also goes into the depth materials |
| The family's routines starting before their home exists | The home chunk's simulation starts at its reveal; until then, the welcome speaks from the page |
| Frame drops while summoning on weak GPUs | A slice budget per frame, and fewer starts per frame when frames run long. Adaptive quality's warm-up counts from `game:complete` |
| More failure paths: a group can fail on its own | Each group is independent (as the chunks are today) and failures are logged; the planet without it still works |

## 6. Decisions for the owner

1. **Summoning at load:** may things pop in *during the load*, as a designed moment, with the "nothing pops in" rule holding from `game:complete` on?
2. **The welcome:** should a step or a click end the welcome once the planet is live, rather than the welcome holding the controls until it's closed?
3. **The sky starts clear:** the painted clouds would drift in during the summoning (their textures are 127 KB), rather than being there from the first frame.
4. **The budget model:** should the tiered budgets (§5.6) replace the rising on-demand waiver?
5. **Workers:** time slicing first, and workers only where they pay (§5.7), rather than moving every builder to a worker at once?

**Taken as proposed** when the owner asked for the implementation (30 September 2026): 1 yes (the load only; the rule holds from `game:complete`); 2 yes; 3 yes; 4 yes (with the before-live figure at 1.6 MB, §9.4); 5 yes (slicing only so far).

## 7. Plan

Each phase ships on its own and leaves the game better. Visual changes need the owner's look.

| # | Phase | What | Where | Validation |
|---|---|---|---|---|
| 1 | Instrument | The stage marks for good; `perf:audit` reports the stages and runs the fast and slow network profiles | `platform/gate.ts`, `game-mount.tsx`, `controller.ts`, `scripts/perf-audit.mjs` | One audit run, recorded as this page's baseline |
| 2 | Quick wins | The rabbits' models under 10 ms (colour in model space once per part; each coat built once); the family's skins as WebP | `world/wildlifeModels.ts`, `assets-src/characters/` | Unit: a geometry checksum shows the models unchanged; `verify:prod`; the audit |
| 3 | Assets in parallel | The critical asset list, generated and inlined in the page; the gate warms the cache once it passes; texture tiers in the manifest | `play.astro`, `platform/gate.ts`, `scripts/build-textures.py`, `world/textureManifest.ts` | Unit: no game asset is requested before the gate passes; the "capability gate" E2E group; the audit on the slow profile |
| 4 | The greeting at first paint | The talk box and the illustration in the page; the lines module shared; the handoff to the game; a step ends the welcome | `play.astro`, `platform/gate.ts`, `world/home/welcome.ts`, `controller.ts`, `hud.css` | E2E: the greeting visible before the game's JS runs, Next working, and the handoff keeping the line; axe |
| 5 | The summoner | The group scheduler; time-sliced builders; a compile per group; obstacles and targets at reveal; `game:live`, `game:complete` and `loadStage()` | `Scene.tsx`, `world/summon.ts` (new, pure), the groups' components, `controller.ts` | Unit: the order, the slices, obstacles only at reveal. E2E: live before complete; nothing usable before its reveal. The audit: no long task after live |
| 6 | The pop | The spring and the wiggle per kind; the grass sprouting; the sparkles; reduced motion; the pop sound | `world/Props.tsx` (the instanced patch), `world/grass/`, the chunks' views | Unit: the spring's curve settles and is NaN-safe. A real-GPU look; the "rendering" E2E group |
| 7 | Workers | The grass field's placement and the kit builders in a worker | `world/grass/field.ts`, `world/kit.ts`, a new worker module | Unit: the worker's output equals the main thread's, byte for byte. The audit at 4× CPU |
| 8 | Budgets | The size report's tiers; the targets in §5.6; the on-demand waiver retired | `scripts/size-report.mjs`, [plan.md](./plan.md), AGENTS.md | `verify:prod` |
| 9 | Optional | A service worker (stale-while-revalidate for the hashed JS and the textures); generated geometry cached in IndexedDB, keyed by the build's hash | New modules | A repeat-visit audit |

Phases 1–3 need no design sign-off, and they cut the slow-network time the most. Phase 4 changes what the visitor sees first. Phases 5–6 are the heart of the change, and wait for decisions 1–3 and the owner's look.

## 8. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | The greeting shows at first paint, before the game's JS | E2E "Prabin's welcome is on the page from the first paint…" holds the game's JS back, reads the greeting and turns its page, then checks the handoff keeps the line. The audit's first paint: 0.33 s (1×), 0.32 s (4×, fast), 0.71 s (4×, slow) | Done |
| 2 | The planet is live within budget | The audit, 4× CPU: 5.9 s on the fast connection (budget 2.5 s) and 13.9 s on the slow one (budget 7 s), down from 6.2 s unthrottled and 17.7 s slow. At 1×: 1.57 s unthrottled and 3.49 s on the fast connection (from 2.28 s and 4.16 s) | Partly: faster everywhere, within budget only at 1×. What's left is the critical path's own work (§9.5) |
| 3 | No long task after the planet is live | The audit's long tasks between live and complete: none at 1× (from 5, the longest 108 ms). At 4×: 9, the longest 157 ms (from 11, the longest 513 ms), each one model's build | Done at 1×; at 4×, §9.5 |
| 4 | Everything is summoned nearest first, and is solid and usable only once seen | Unit: `summon.test.ts` (the order, the wave), `summoner.test.ts` (obstacles join as things appear; targets wait for their group). E2E "the planet is playable before it is complete…": live before complete, nothing revealed or held-back obstacle released at live, a tree not out and the props group hidden until its reveal, then everything out | Done |
| 5 | The summoning reads as a moment, and reduced motion gets none of its motion | Real-GPU contact sheet (the page's greeting and drawn planet, the cross-fade, the pops). Unit: `popPose` under reduced motion is the settled pose at once; the grass is simply there; `SummonFx` draws no bursts | Done; the owner's look is pending |
| 6 | ≤ 1.5 MB downloaded before the planet is live | `size-report.mjs`: 1,583 KB (from 2.4–2.6 MB) | Partly: under the 1.6 MB it now checks (§9.4) |
| 7 | The complete planet within the runtime budgets | The audit at complete: 89 programs (91 before), 267 draw calls (265 before; the budget's 180 was never met, §9.4), JS heap 65 MB at live, 0 NaN pixels, 73 textures | Done, as before |
| 8 | Nothing ever pops after `game:complete` | The summoner stops at `complete` (no further reveals, holds or pops); AGENTS.md's no-culling rule has the load exception | Done |

## 9. As built (30 September 2026)

### 9.1 What runs, in order

1. **T0, the page** (`src/pages/play.astro`, `platform/greeting.ts`): the header, a small drawn planet turning (SVG, tokens only), a bar, a status line, and Prabin's talk box with his first line, chosen before the first paint (first visit, touch, or returning). E, Enter or **Next** turn its pages; Space, Esc or the close button end it. The gate starts the game's code and warms the cache with the first tier of textures and the visitor's character (`warmCriticalAssets`), so the game's loaders find them there.
2. **T1, live** (`game-mount.tsx`): the tier-1 textures, the Chopper, home and crafting chunks (they level the ground under what they build), the ground built in slices (`prepareGround`), then the scene mounts in a transition, so React builds it component by component and the page's welcome stays responsive. The warm-up compiles, three frames draw, and `game:live`: the loading scene cross-fades out, "The planet is ready." is announced, and the game takes the talk box over at the line reached.
3. **T2, the summoning** (`world/summoner.ts`, the order in the pure `world/summon.ts`): Prabin (and Chopper and the family), the props, the home, the grass, the crafting, the wildlife, the clouds. Each group is prepared (its textures, its models built ahead a slice at a time: `world/prebuilt.ts`, the props' and the grass's generators, the wildlife's `prepareWildlife`), mounted hidden in a transition (`Summoned` in `Scene.tsx`), compiled on its own (its shadow programs too), its textures uploaded and its programs' uniforms looked up a few a frame, and then revealed. Then `game:complete`.
4. **T3, idle**: the moon's texture (`requestIdleCallback`, at most 3 s after complete).

### 9.2 Where it differs from §5

| Spec | As built | Why |
|---|---|---|
| The chunks' models leave the critical path (§5.1) | The Chopper, home and crafting chunks' code is still waited for; only their views are summoned. The props (now their own chunk) and the nature chunk (the wildlife, the grass, the activation cues, the sparkles) aren't waited for; `Slot` in `Scene.tsx` draws their views once they've arrived | The home and the crafting level the ground under what they build (their pads), and they own targets and seats the planet needs at T1 |
| Groups 2 and 5, the near and far props, apart | One props group; each prop is timed by the wave (`waveTimes`, 12 u/s outward from the character, a few a frame), so the near ones still come first | Simpler, and it reads the same |
| The pop in a vertex shader (`aBorn`, `uNow`) | Instance matrices written each frame while a prop is popping (`stepPops` in `Props.tsx`), then left alone; groups that rise are scaled about the planet's centre | The shadows follow for free, and it costs nothing once the planet is complete |
| A worker for the biggest builders (phase 7) | Not built: slicing, the transitions and building ahead cleared the long tasks at 1× | Decision 5 |
| Tests skip only the pops | Tests (`game.test.pop = '0'`) also build without slicing and reveal every group at once, in order | Software rendering's frames are slow: sliced, the summoning took 40 s in the E2E browser; unsliced, about 8 s |

Other things found and fixed on the way:

- **Shadow programs compiled on their first draw.** `compile` only sees a mesh's own material, so each caster's depth program was built, blocking, when its group first cast a shadow (9 programs, the biggest stalls after live). The summoner now compiles them too (`shadowDepthMaterial`: the material three's shadow map will use, without the fog), and only for what will cast a shadow when the group appears.
- **Dev only:** Chopper's body was disposed by StrictMode's rehearsal unmount while his programs compiled (`glGetProgramiv` warnings); the dispose is deferred now.
- **The rabbits' painter** parsed colour strings for every vertex; the coats are parsed once now, and the kit reuses a blob it has built before (`Kit.blob`). The models are unchanged bit for bit (`wildlifeModels.test.ts`) and build in about half the time.
- **The family's skins** are lossless WebP now (146 KB → 75 KB, pixel-identical; `compose-family.py` writes them).
- **An unknown deep link's notice** ("Couldn't find that place…") is said once the planet is live, after "The planet is ready.", not overwritten by it.

### 9.3 Measurements

The test build, served by `astro preview`, on the owner's desktop (RTX 4090 through ANGLE/D3D11), `npm run perf:audit` (medians; each run a new browser, so the cache starts empty):

| | 1× | 1×, fast network | 4× CPU | 4×, fast network | 4×, slow network |
|---|---|---|---|---|---|
| First paint: the welcome | 0.33 s | 0.41 s | 0.49 s | 0.32 s | 0.71 s |
| Live (was: playable, §1.2) | **1.57 s** (2.28) | **3.49 s** (4.16) | **4.22 s** (6.21) | 5.89 s | **13.9 s** (17.7) |
| Complete | 2.89 s | 5.04 s | 8.85 s | 10.6 s | 20.2 s |
| Long tasks, live → complete | none | none | 9, the longest 157 ms | 11, the longest 169 ms | 10, the longest 177 ms |

At complete: 89 programs, 267 draw calls, 1.51 M triangles in all passes, 73 textures, 0 NaN pixels; the JS heap 65 MB at live.

### 9.4 Budgets

`scripts/size-report.mjs` checks the tiers (§5.6), and the rising on-demand waiver is retired ([plan.md](./plan.md) §6):

- the critical JS: 449.7 KB gz (≤ 450);
- each chunk fetched later: the largest 37.2 KB gz (≤ 150), 130.2 KB in all;
- before the planet is live: 1,583 KB. That's the gate 4, the critical JS 450, the chunks still waited for 94, the first tier of textures 871 and the character 163. The check is at ≤ 1.6 MB, not the 1.5 MB of §5.6: that figure assumed about 780 KB of first-tier textures, but the shared kit material reads every surface mask when it's made, so all of them are T1 (871 KB).

The draw-call figure in §5.6 (≤ 180) was never the planet's: it was 265 before this work and is 267 now (the summoning's sparkles, one instanced draw).

### 9.5 What's left

- **Live at 4× CPU** is 4.2 s, not 2.5 s. What remains on the critical path is the world's own work: generating the layout, attaching the home (its route planner's grid) and the crafting, building the ground and the landmarks, and compiling the shaders. The next steps, in order of what they'd save: move the home's and the crafting's pads (pure data) into the main bundle, so their chunks can be summoned rather than waited for (this also brings the before-live download under 1.5 MB); then a worker for the ground and the route planner's grid (phase 7).
- **The long tasks left at 4×** are single models built ahead (Chopper's body, the house, the yard, the old pine: 100–160 ms each at 4×). Splitting those builders into steps, or a worker, would clear them.
- **Phase 9** (a service worker; cached geometry) is still optional.
