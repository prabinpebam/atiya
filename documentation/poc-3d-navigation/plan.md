# POC Plan — "Little Planet" 3D Navigation UI

| | |
|---|---|
| **Status** | Draft v0.2 (re-baselined after design review) |
| **Date** | 2026-09-24 |
| **Related** | [Spec](./spec.md) · [Definition of Done](./definition-of-done.md) · [Research: tech stack](./research/tech-stack.md) · [Research: interaction design](./research/interaction-design.md) |

## 1. Approach

- **De-risk first.** M0 includes technical spikes on everything that could force a rewrite later:
  - the capability-gated bootstrap
  - the real R3F/drei bundle size
  - KTX2/Meshopt loading
  - the movement and collision math
  - Safari and assistive-technology availability
- **Walking skeleton next.** A character walking on the sphere inside `/play`, then layer feel, landmarks, escape hatch, accessibility, performance.
- **P0 gate.** P1/P2 items are **not** started until every P0 requirement in the [spec's requirements index](./spec.md#411-requirements-index) is green. They're grouped in M8, not mixed into earlier milestones.
- **Pure logic, thin rendering.** Sphere math, collision, proximity arbitration, input normalization, URL/history, content validation and capability decisions live in pure TypeScript with unit tests. R3F components render state.
- **Feel is tuned, not guessed.** Every constant is in `config.ts` and live-tunable through leva in dev. Leva is enabling infrastructure, so it's in P0 scope. One scheduled feel review with the owner.
- **Placeholder content, real structure.** Seven landmark Markdown files drive both modes.
- **Follow [AGENTS.md](../../AGENTS.md):** Microsoft npm proxy, exact pinned versions ([spec §5.1](./spec.md#51-stack-pinned-versions)), and no unpinned scaffolders.

## 2. Milestones

Estimates are focused working days for one developer using GitHub Copilot agent mode.

**P0 total ≈ 15–16 days, plus ~2 days buffer.** Add 2–3 days if M8 (P1) is pursued. Calendar time will be longer because of reviews, tester sessions and access to test hardware.

### M0: Setup & de-risking spikes (1.5 d)

| # | Task | Output |
|---|---|---|
| M0.1 | Hand-scaffold Astro: `package.json`, `astro.config.mjs`, `tsconfig.json` extending `astro/tsconfigs/strict`, and `src/pages/index.astro`. Then `npm i astro@7.3.3 @astrojs/react@6.0.6 react@19.2.8 react-dom@19.2.8 …` with exact versions. Commit the lockfile. | `npm run dev` works |
| M0.2 | Add Vitest 5.0.1; add Playwright 1.63.0 with the SwiftShader flags (`--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`); add `@axe-core/playwright` 4.13.0 | Empty suites run |
| M0.3 | Add scripts: `dev`, `build`, `build:test` (`--mode test`), `preview`, `check`, `test`, `e2e`, `assets`, `size` | Scripts in `package.json` |
| M0.4 | **Spike: gated bootstrap.** `play.astro` + `gate.ts` + dynamic `import("../game/mount")` rendering a spinning cube. Prove that `game-*` chunks are **not requested** when WebGL2 is stubbed out. | Passing E2E network assertion |
| M0.5 | **Spike: bundle size.** Measure the gzipped game chunk with R3F, the drei helpers we plan to use, and zustand/maath. Go/no-go against the 450 KB budget; if no-go, switch to the vanilla three runner-up **now**. | Size number recorded in §6 or the ADR |
| M0.6 | **Spike: assets.** Run one CC0 GLB through `gltf-transform` (Meshopt + KTX2) and load it with `useGLTF` + `KTX2Loader`. Check the `ktx` CLI is available. Confirm drei 10.7.8 works with three r186; if not, fall back to 0.185.1. | Model renders |
| M0.7 | **Spike: math.** Pure `sphere.ts` covering the rotate-planet step, `slideVelocity`, `resolvePenetration` and sub-stepping, with the review's test cases: sign, head-on, glancing, corner, high-dt, twist preservation. | Green unit tests |
| M0.8 | **Access check:** confirm there is a Mac with Safari 26, that NVDA and Narrator are available, and who the reference laptop is. Record the hardware profile. | Perf log header |
| M0.9 | `git init`, `.gitignore`, and the AGENTS.md conventions (already added) | First commit |

**Exit:** all spikes pass or have a decision recorded, and `check`, `test`, `build` and `e2e` are green.

### M1: Walking skeleton (1.5 d)

| # | Task | Req |
|---|---|---|
| M1.1 | `/play` shell: skip link, header with **Classic site**, loader, `<noscript>`, landmarks JSON | FR-40 (partial) |
| M1.2 | `mount.tsx` → `GameApp`: `<Canvas>` with the planet sphere, a "bean" character, sky color and fog | — |
| M1.3 | Keyboard intent (`event.code`, scoped to the focused game region, `preventDefault` only on handled keys, input cleared on blur/visibility) → movement system → planet rotation | FR-01, FR-04, FR-05, FR-50 |
| M1.4 | Fixed diorama camera following the spec's §4.6 conventions | FR-11 |
| M1.5 | **Start exploring** button that doesn't steal focus; `game:playable` mark | FR-50 |
| M1.6 | `window.__game` (dev and test build only) plus the first E2E: W changes `pLocal`, and pressing W with a HUD button focused does nothing | FR-70, FR-50 |

**Exit:** walk the whole planet with WASD/arrows with no pole flips; tests green.

### M2: Movement feel & character (2 d)

| # | Task | Req |
|---|---|---|
| M2.1 | Accel/decel, Shift to run, turn smoothing driven by **actual** velocity, pivot on reversal, `dt` clamp, sub-steps | FR-02, FR-04 |
| M2.2 | CC0 character plus idle/walk/run clips through the `assets` pipeline; CREDITS.md | FR-06, FR-72 |
| M2.3 | Speed-based blending with matched `timeScale`; blob shadow | FR-06 |
| M2.4 | Soft-lit bevelled "toy" materials, geometry kit, art pass (as built: see spec §4.12) | — |
| M2.5 | leva tuning panel (dev only) for every constant in the spec's §5.5 | FR-71 (infra) |
| M2.6 | Frame-rate independence test: 30 vs 120 fps distance within ±2 % | FR-04 |

**Exit:** internal feel check (snappy start/stop/turn, no foot sliding).

### M3: Landmarks, collision & proximity (2.5 d)

| # | Task | Req |
|---|---|---|
| M3.1 | `landmarks` collection with the full schema (spec §5.6) plus `superRefine` validation and a whole-collection unit test | FR-20 |
| M3.2 | Placement from lat/lon and `modelYawDeg`; variant renderers plus a **generic fallback** renderer; instanced props | FR-20 |
| M3.3 | Collision integration (landmarks and large props), visual debug overlay of colliders in dev | FR-07 |
| M3.4 | Proximity with global arbitration (switch margin, tie-break), a 150 ms interact buffer, and unit tests | FR-21, FR-22 |
| M3.5 | Landmark reaction, world label, **preview card**, live-region text | FR-21 |
| M3.6 | `LandmarkDialog`: structured `dialog` content, **Open full page ↗**, focus returned to the invoker, movement pause, render on demand | FR-22–24, FR-62 |
| M3.7 | Spawn at the Plaza facing the Workshop; E2E projection check that the Workshop's base is on screen | FR-30 |
| M3.8 | **Route test:** auto-walk from spawn to each approach point (fixed dt through the test hook) in ≤ 8 s of simulated time | FR-30 |

**Exit:** walk up to each landmark, open it, close it, and keep walking, keyboard only; route test green.

### M4: Escape hatch, classic mode, URL/history (2.5 d)

| # | Task | Req |
|---|---|---|
| M4.1 | Landing `/`: poster, two CTAs, emphasis on the last-used mode, zero 3D JS | FR-43, FR-60 |
| M4.2 | `/classic/` and `/classic/[id]` (full Markdown body) with **Explore in 3D** → `/play?at=<id>` | FR-42 |
| M4.3 | Context-preserving Classic button; `?mode=classic` override; saved preference | FR-40, FR-41, FR-43 |
| M4.4 | URL/history module (pure plus tests): `?at=`, `&open=1`, direct-open `replaceState`+`pushState`, back-only-if-owned, popstate close, refresh while open, invalid id → Plaza + status | FR-45 |
| M4.5 | Full `capabilities.ts` decision matrix (unit tests) plus the fallback, interstitial, error/timeout and context-lost UIs; no timed redirects | FR-44 |
| M4.6 | E2E: every row of the spec's [§4.10 table](./spec.md#410-escape-hatch--fallbacks), including the network assertions | FR-44 |

**Exit:** every escape-hatch path is demonstrated in E2E.

### M5: Wayfinding, onboarding & accessibility (2.5 d)

| # | Task | Req |
|---|---|---|
| M5.1 | Menu dialog: Landmarks, Controls, Settings (Reduce motion, Pause ambient motion), Classic site | FR-32, FR-40, FR-52 |
| M5.2 | Fast travel fly-over (≤ 1.2 s) and the reduced-motion opacity fade (≤ 200 ms); click or tap a landmark → fast travel | FR-32 |
| M5.3 | Click/tap-to-move with the arrival and blocked rules | FR-08 |
| M5.4 | First-visit hint that dismisses after 2 cumulative seconds of movement, can be reopened, and is remembered | FR-31 |
| M5.5 | Parallel landmark `<nav>` and live region | FR-51 |
| M5.6 | Global reduce-motion state wired to **every** animation source (beam, clouds, foliage, idles, particles, squash, lead) | FR-52 |
| M5.7 | HUD pass for WCAG 2.2 AA; axe scans in E2E | FR-53 |
| M5.8 | Screen-reader smoke tests (Narrator + Edge, NVDA + Firefox); decide between `role="region"` and `role="application"` | FR-51 |

**Exit:** keyboard-only and screen-reader walkthroughs pass; axe finds zero serious or critical issues.

### M6: Performance & loading polish (1.5 d)

| # | Task | Req |
|---|---|---|
| M6.1 | Loader with % progress and the Classic link; `compileAsync` before reveal | FR-61 |
| M6.2 | Asset budget pass, plus a texture-memory estimate in the `assets` script | FR-64 |
| M6.3 | `PerformanceMonitor` DPR stepping with no oscillation; pause when hidden | FR-62 |
| M6.4 | `size` script that fails the build on budget violations | FR-60, FR-64 |
| M6.5 | Run the spec's [§7 methodology](./spec.md#7-performance-budgets) on the reference hardware; record results in the perf log | FR-64 |
| M6.6 | Lighthouse on `/` and `/classic/` | FR-64 |

**Exit:** every budget is met or has an owner-signed waiver (§6).

### M7: Verification, feel review & demo (1.5 d)

| # | Task |
|---|---|
| M7.1 | Complete the E2E suite (§3) green on Chromium; smoke-test the DOM-only paths on Firefox and WebKit |
| M7.2 | Manual cross-browser pass on Edge, Chrome, Firefox and Safari 26, plus one touch device |
| M7.3 | **Usability and comfort sessions with ≥ 5 first-time testers.** Timer starts at `game:playable`. Measure: time to reach **and open** the first landmark without help; whether they recognized the preview card; motion-comfort rating (≥ 3 people must report no discomfort after 3 minutes) |
| M7.4 | **Feel review with the owner** (30–45 min): tune live, confirm `prompt` activation (D-3), freeze the values in `config.ts` and the spec's §5.5 |
| M7.5 | Record the 60–90 s demo video; write the README |
| M7.6 | Go through the [Definition of Done](./definition-of-done.md) checklist and get sign-off |

### M8: P1 stretch (optional, 2–3 d; only after every P0 item is green)

Juice (squash/stretch, lean, dust), follow lead, visited state, the `auto` activation experiment, run toggle, nipplejs joystick, gamepad, zoom stops, signposts and off-screen indicator, "I'm stuck", quality setting, preview deployment (D-6).

### Sequencing

```
M0 (spikes) ─► M1 ─► M2 ─┬─► M3 ─► M4 ─► M5 ─► M6 ─► M7 ─► (M8 optional)
                         └─ asset sourcing for M3 can run in parallel with M2
```

## 3. Test plan (summary)

| Layer | Tooling | Key cases |
|---|---|---|
| **Unit** | Vitest 5.0.1 | Rotation sign and magnitude; lat/lon round trip; arc distance; great-circle tangent, including the antipode fallback; `slideVelocity` (head-on → 0 with no NaN, glancing, corner); sub-stepping at high dt; twist preservation in push-out; proximity arbitration (overlap, equal-distance jitter, handoff, buffer 149/151 ms); input normalization; URL/history state machine; capability matrix; content-collection validation; preferences |
| **Scene** | `@react-three/test-renderer` 9.1.1 | One landmark per entry, including the generic variant; positions and yaw match the content |
| **E2E** (Chromium + SwiftShader, test build) | Playwright 1.63.0 + `window.__game` | Move with W/ArrowUp; W ignored when a HUD button is focused; teleport near the Workshop → card and live-region text within 100 ms; E opens the dialog → URL has `open=1`; Esc closes and focus goes back to the invoker; Back closes; direct `?at=library&open=1` then Back → dialog closes and you stay on the site; invalid `?at=` → Plaza plus status; route test to every landmark in ≤ 8 s; fast travel; Classic while near the Workshop → `/classic/workshop`; forced no-WebGL and `?mode=classic` → fallback **with zero `game-*` requests**; asset error or timeout → Retry/Classic; context lost → overlay; reduced motion → opacity fade; Tab order; production build has no `__game` |
| **Accessibility** | `@axe-core/playwright` 4.13.0 + manual | Zero serious or critical issues on every state; keyboard-only and screen-reader walkthroughs |
| **Performance** | stats-gl, DevTools, Lighthouse, `size` | Spec's §7 methodology; FPS only on real GPUs |

## 4. Decisions log

Defaults are assumed so work can start. The owner confirms or changes each one.

| # | Decision | Default assumed | Options | Decide by |
|---|---|---|---|---|
| D-1 | Planet / working name | "Planet ⟨TBD⟩" placeholder | Personal or playful name | M4 |
| D-2 | Landmark set & order | 7 landmarks, as in the spec's §4.3 | Add, remove or rename pillars | M3 start |
| D-3 | Activation mode | **`prompt`** (the P0 default and DoD baseline) | The `auto` experiment (P1, non-default) | M7 feel review |
| D-4 | Landing default | Neutral landing, last-used mode emphasized, no redirects except `?mode=` | Play-first or classic-first | M4 |
| D-5 | Touch & gamepad in POC | Tap-to-move is P0; joystick and gamepad are M8 | Promote to P0 (+1–1.5 d) | M5 start |
| D-6 | Preview hosting | Local only for the DoD; optionally Cloudflare Workers static assets or the Azure Static Web Apps free plan | Either | M7 |
| D-7 | Character | Original procedural "designer" avatar (as built); a rigged CC0 humanoid is optional later | Custom modelled avatar later | M2 |
| D-8 | Bundle strategy | R3F + drei (ADR-1) | Vanilla three runner-up if the M0.5 spike fails the budget | M0 |

## 5. Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-1 | The npm proxy is missing versions or has a wrong `latest` | High | Med | Exact pins (React 19.2.8 + R3F 9.7.0); lockfile; `npm view <pkg> versions` before any upgrade |
| R-2 | drei 10.7.8 is incompatible with three r186 | Low–Med | Med | M0.6 spike; fall back to three 0.185.1 |
| R-3 | Capability-gated chunk splitting fails (Vite/Astro hoists or inlines game code) | Med | High | M0.4 spike with a network assertion; named `game-*` chunks; keep `gate.ts` free of React and three |
| R-4 | Controller or collision instability (NaNs, tunneling, yaw jumps, corner jitter) | Med | High | M0.7 math spike; sub-stepping; iterative projection; twist-preserving push-out; debug collider overlay |
| R-5 | Content serialization and validation gaps (Markdown in React, bad approach points) | Med | Med | Structured `dialog` frontmatter; the body is classic-only; `superRefine` + collection test |
| R-6 | History and focus races (double close, stale invoker, focus stealing) | Med | Med | Pure history state machine with tests; invoker ref with an existence check; no autofocus unless the body has focus |
| R-7 | Headless WebGL (SwiftShader) is flaky or slow | Med | Med | Assert on DOM and hook state; fixed-dt `advance()`; few, tolerant canvas screenshots |
| R-8 | Safari 26 Mac or NVDA/Narrator unavailable when needed | Med | Med | M0.8 access check; borrow a device or use a cloud device lab early |
| R-9 | Motion sickness or disorientation | Med | High | Fixed camera; no bob, shake or blur; narrow FOV; reduced motion; comfort sessions in M7.3 |
| R-10 | Movement feels floaty or sluggish | Med | High | leva live tuning; owner feel review; reference implementations (Bruno Simon folio-2025, Glowin/messager) |
| R-11 | Late bundle-budget failure forces a rewrite | Med | High | Measured in the M0.5 spike, not M6; the `size` script runs from M1 on |
| R-12 | Asset licensing ambiguity | Low | High | CC0 only; CREDITS.md; no raw Mixamo files; primitive fallback |
| R-13 | Resemblance to Nintendo IP | Low | High | Original art, palette and fonts; no names or trademarks; review before any public share |
| R-14 | Scope creep into a "real game" | High | Med | Non-goals; P0 gate; M8 is optional |
| R-15 | Mobile performance or input | Med | Med | GPU-tier gate → offer classic; DPR clamp; tap-to-move as P0 input |
| R-16 | Accessibility regressions in overlays | Med | Med | axe on every E2E run; semantic HTML only; keyboard walkthrough in the DoD |
| R-17 | `detect-gpu` calls a third-party CDN for benchmarks | Med | Low | Self-host the benchmark data or skip the tier check (verify in M0) |

## 6. Budget waiver log

Budgets in the [spec §7](./spec.md#7-performance-budgets) are P0. Only a row here, signed off by the owner, allows a missed budget to pass the DoD.

| Date | Metric | Budget | Measured | Cause | Decision | Owner sign-off |
|---|---|---|---|---|---|---|
| 2026-09-24 | Draw calls / triangles per frame | ≤ 60 / ≤ 100 k | ≈ 100–106 / ≈ 570–590 k (high tier, all passes incl. shadows + post; the day–night sky — sun/moon discs, stars, lamp pools, fireflies — adds ≤ 7 calls: 106 at noon, 99 at night) | Detailed art pass (spec §4.12): kit-merged landmarks, leaf-card foliage, ~1 000 instanced props, post-processing passes. Lower-poly details cut the original 1.44 M; horizon culling was then **removed at the owner's request** (it caused pop-in), so the whole planet is always drawn | **Superseded** by the row below | — |
| 2026-09-24 | Draw calls / triangles per frame | ≤ 60 / ≤ 100 k | ≈ 98–99 / ≈ 690–700 k (high tier, spawn view, all passes incl. shadows + post: 99 / 691 k at noon, 98 / 700 k at night) | Landscape & wind pass (spec §4.14), which added about 110 k triangles. Contributors: the displaced ground at detail 56 (≈ 65 k, up from ≈ 40 k) so the river bed and hills stay smooth; faceted cliff walls; 29 shadow-casting boulders (≈ 55 k with the shadow pass); 90 pebbles; the river, waterfall and bridge. Draw calls stayed flat because every new prop kind is instanced or merged. **Texture pass (spec §4.15):** the grass clumps became alpha cards, which brought the total down to ≈ 96–98 calls / ≈ 650–675 k. The textures add samplers, not geometry: 13 WebP files, about 435 KB to download and about 11 MB of GPU memory with mipmaps (budget 32 MB) | **Proposed:** raise to ≤ 110 calls / ≤ 720 k triangles on `high`. This is still a light load for any current discrete or integrated GPU. Keep `low` as the fallback; if the reference laptop misses the frame-pacing budget, first drop the ground to detail 48 and turn off boulder shadows | ☐ pending |

## 7. Working agreements

- **Branches and commits:** one branch per milestone (`poc/m0-spikes`, `poc/m1-skeleton`, …) with small commits. Include the Copilot co-author trailer where applicable.
- **New packages:** check the version on the proxy, then pin it exactly. Never install `@latest`.
- **Visual changes:** before/after screenshot or GIF in the PR.
- **Tuning constants:** changes go into `config.ts` and the spec's §5.5, frozen at the feel review.
- **Done:** only when every box in the [Definition of Done](./definition-of-done.md) is ticked with evidence.

## 8. After the POC (not in scope)

Real content and case studies, bespoke landmark art, a custom avatar, audio, day/night, an NPC guide, privacy-respecting analytics, WebGPU/TSL once R3F v10 and drei v11 are stable, production deployment and SEO for the classic site, and a /colophon page telling the build story.
