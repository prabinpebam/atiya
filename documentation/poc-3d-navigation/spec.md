# POC Spec — "Little Planet" 3D Navigation UI

| | |
|---|---|
| **Status** | v0.3 — POC implemented (see [README](../../README.md) for build status against the DoD) |
| **Date** | 2026-09-24 |
| **Owner** | Prabin Pebam (Principal Design Manager) |
| **Related** | [Plan](./plan.md) · [Definition of Done](./definition-of-done.md) · [Research: tech stack](./research/tech-stack.md) · [Research: interaction design](./research/interaction-design.md) · [Seed spec](../seed-spec.md) |

---

## 1. Summary

A browser-based, cozy 3D "game mode" for the portfolio site. A small stylized character walks around a **tiny spherical planet** with **WASD**. Each **landmark** on the planet represents one key portfolio pillar. Walking **close** to a landmark activates it (it reacts, a preview card appears, and one key press opens the content). The **traditional website is always one click/keypress away**, and every landmark maps 1:1 to a classic page.

The feel is *inspired by* the navigation of cozy life-sim games (fixed-angle camera, walk/run, gentle curvature hiding the horizon, context prompts) — **no third-party IP** is used (see §13).

This POC proves the **navigation UI and interaction model**, not final art or content.

## 2. Goals & non-goals

### 2.1 Goals (what the POC must prove)

1. **Feel** — Movement and camera feel responsive, cozy, and non-nauseating on a tiny sphere (no pole flips, no disorientation).
2. **Findability** — A first-time visitor reaches their first landmark in **≤ 10 s** and can reach any landmark in **≤ 8 s** of running from spawn, or instantly via fast travel.
3. **Activation model** — Proximity-based activation is discoverable, never surprising, and works with keyboard, mouse/tap, and (stretch) gamepad/touch joystick.
4. **Escape hatch** — The classic site is reachable at every moment (loading, playing, dialog open, error), with context preserved (landmark → matching classic page).
5. **Architecture** — The 3D experience is a capability-gated, lazily loaded module on its own `/play` route inside the Astro site, driven by the **same content source** as the classic pages.
6. **Inclusive by default** — Keyboard-only and screen-reader users get equivalent access; WCAG 2.2 AA for all DOM UI; reduced-motion honored.
7. **Performance** — 60 fps on a mid-tier laptop iGPU; the landing page ships **zero** 3D JavaScript.

### 2.2 Non-goals (explicitly out of scope for the POC)

- Final portfolio content (placeholder copy is used), final art direction, custom character.
- NPCs, dialogue typing/voice, quests, achievements, multiplayer, day/night cycle, weather.
- Physics engine, jumping, swimming, terrain deformation.
- WebGPU renderer. (A small post-processing chain *is* used on the high quality tier — see §4.12.)
- Localization, analytics, CMS integration, production deployment hardening.
- Audio beyond a P2 stretch (muted-by-default ambient + footsteps).

## 3. Users & key scenarios

| Persona | Need | Scenario the POC must support |
|---|---|---|
| **Busy recruiter / hiring manager** | Scan impact fast | Lands on `/`, picks "Classic site" *or* enters planet, uses **fast travel** to "Case studies" in 2 clicks, jumps to classic page. |
| **Curious peer / design leader** | Delight, craft signal | Explores freely with WASD, discovers all landmarks, sees visited progress. |
| **Keyboard-only user** | Full access without mouse | Tabs through HUD, focuses game region, walks with arrows, opens landmarks with Enter, exits with Esc/Tab. |
| **Screen-reader user** | Equivalent content | Uses skip link or the parallel landmark list; hears "Near Workshop — Case studies. Press E to open." |
| **Motion-sensitive user** | No nausea | `prefers-reduced-motion` → no camera lag, no squash/particles, cut transitions. |
| **Low-end / no-WebGL device** | Not blocked | Detected up front → offered/redirected to classic site with a clear message. |
| **Mobile visitor** (stretch) | Works with thumbs | Tap-to-move (P0) and virtual joystick (P1). |

## 4. Experience specification

### 4.1 Site modes & routes

| Route | Purpose | Notes |
|---|---|---|
| `/` | Landing | Static HTML: name, role, one-liner, painted key-art poster of the planet (LCP; responsive WebP with fixed dimensions and `fetchpriority="high"`), two CTAs: **Explore the planet** (`/play`) and **Classic site** (`/classic/`). Last-used mode is visually primary. All pages advertise a 1200×630 social card (`og:image`). **No 3D JS.** |
| `/play` | Game mode | HTML shell (skip link, header w/ Classic button, loader, `<noscript>` link) + a **tiny capability gate script** (no React/three imports). The game bundle is **dynamically imported only after the gate passes** (§5.9). |
| `/play?at=<id>` | Deep link | Spawn at landmark `<id>`'s approach point. |
| `/play?at=<id>&open=1` | Deep link | Spawn + open landmark dialog. |
| `/classic/` | Classic home | Stub index of all landmarks (same content collection). |
| `/classic/<id>` | Classic page | Full page per landmark; header link **Explore in 3D** → `/play?at=<id>`. |
| `?mode=classic` | Override | On `/` or `/play` → go to classic and persist preference. |

**Preference:** `localStorage["site.mode"] = "play" | "classic"`, written only on an explicit user choice. The POC never auto-redirects from `/` or `/play` **unless an explicit `?mode=` query override is present** (avoids flash/jank); otherwise the preference only changes CTA emphasis.

**Invalid deep link:** `?at=<unknown-id>` spawns at the Plaza and posts a polite status message ("Couldn't find that place — you're at the Plaza"); the URL is replaced with `/play`.

### 4.2 The planet

- **Shape:** true sphere, radius **R = 10 u** (character height ≈ 1.3 u). A real sphere provides the "rolling log" curvature naturally; no bend shader needed.
- **Ground (as built):** smooth-shaded icosphere (detail 56) displaced by the terrain height model (§4.14), with a ground shader (`planetMaterial.ts`) that layers hand-painted seamless tiles (§4.15) over procedural detail, blended by per-vertex surface weights:
  - mottled, two-tone grass with anti-aliased blade strokes, clover patches and tiny flowers; worn, yellower grass along path edges
  - dirt paths from the plaza to every landmark, with noisy edges, scattered pebbles and a darker edge line
  - domed cobbles with mossy joints on the landmark forecourts
  - concentric brick rings with a compass-rose inlay on the spawn plaza
  - a sand rim around a pond whose organic, lobed shoreline sits in a basin
  - damp banks and a pebbly bed along the river; layered rock strata wherever the ground is steep
- **Landscape (as built, §4.14):** mild rolling hills, four rocky cliff mesas (one with a waterfall), a stream that runs from the waterfall to the pond, and an arched wooden bridge where the stream crosses the Greenhouse path.
- **Props (as built):** all instanced and always drawn — no culling, so nothing pops in (§5.8):
  - lobed hardwood trees, including apple and orange fruit trees
  - organic cedars: grouped clumps of painted conifer sprites in irregular, leaning tiers, in three variants
  - leafy bushes, some flowering
  - all tree and bush foliage built from overlapping alpha-tested leaf cards (§4.12)
  - rounded rocks, big mossy boulders and river pebbles
  - three kinds of flower clump (tulip, cosmos, pansy) with per-clump colour
  - about 650 grass tufts
  - a pond planted like a real one: floating lily-pad clusters, reeds with cattails in the shallows, irises at the waterline and ferns on the bank, all painted alpha sprites (§4.14)
  - butterflies
- **Sky & atmosphere:** opaque screen-space gradient sky, drifting puffy clouds in the sky band, light fog on the far limb — all driven by the **day–night cycle** (§4.13). A **wind system** (§4.14) sways the foliage and blows leaves and swirls across the scene.
- **Lighting:** a hemisphere light plus one directional light that is the sun by day and the moon by night, with a single shadow map (1024² on low, 2048² on high) covering the visible cap. Its direction, colour and intensity follow the time of day (§4.13). An always-directly-below **blob shadow** grounds the character.
- **Style:** soft-lit, bevelled "toy" materials (`MeshStandardMaterial` with vertex colours), with no outlines or toon ramp. See §4.12.

### 4.3 Landmarks (POC set, placeholder content)

Each landmark = one portfolio pillar with a distinct, tall silhouette and accent color. Positions are authored as latitude/longitude on the planet with the **Plaza** at the spawn point.

| id | Landmark | Pillar (placeholder) | Silhouette cue | Placement (as built: arc from spawn · bearing) |
|---|---|---|---|---|
| `plaza` | Signpost Plaza (spawn, not a content page) | Fast travel, settings, "Classic site" kiosk | One signpost per landmark beside its path, arrow in its accent colour | spawn (lat 90°) |
| `workshop` | Workshop | Selected case studies | Chimney + open doors | **33° · straight ahead** (lat 57, lon 0), inside the ≈ 39.7° forward horizon |
| `town-hall` | Town Hall | About me · How I lead | Clock tower | 33° · right (lat 57, lon 90) |
| `library` | Library | Writing | Stacked-book spire | 33° · behind (lat 57, lon 180) |
| `post-office` | Post Office | Contact · résumé | Mailbox with pop-up flag | 33° · left (lat 57, lon −90) |
| `greenhouse` | Greenhouse | Side projects & experiments | Glass dome | 65° · ahead-right (lat 25, lon 45) |
| `lighthouse` | Lighthouse | Vision & design leadership | Tallest structure, slow rotating beam (static under reduced motion) | 65° · behind-right (lat 25, lon 135) |
| `amphitheater` | Amphitheater | Talks & podcasts | Curved seating + stage lights | 65° · behind-left (lat 25, lon −135) |

Placement uses **two rings** (inner 33°, outer 65°) so every footprint stays ≥ 4 u apart while every approach point stays ≤ 10 u from spawn. Doors face the spawn pole (`modelYawDeg: 0`), so each outer-ring route runs between two inner-ring landmarks.

Placement angles are **arc angles from the spawn point** (degrees of great-circle separation); the authored `lat/lon` in content are derived from them.

Constraints:
- At spawn, the character faces the **Workshop** (case studies — highest recruiter value) and its **base and door are on screen** (asserted by an E2E projection check, not just "some pixels visible").
- Arc distance from Plaza to any landmark's **approach point** ≤ **10 u** (≈ 2 s run / 4.5 s walk); each landmark reachable from spawn in ≤ **8 s** of running along an obstacle-free route (validated by an automated route test); max landmark-to-landmark ≤ **πR ≈ 31 u** (≈ 6.3 s run).
- Minimum spacing between landmark footprints: 4 u. Each landmark's approach point must lie outside every expanded collider and inside its own enter radius (build-time validation).
- POC geometry: kitbashed primitives and/or CC0 kit pieces (Kenney, KayKit, Quaternius). Final bespoke models are out of scope.

### 4.4 Character

- **As built — rigged model:** Kenney "Animated Characters: Protagonists" (CC0), `characterMedium` with the `skaterMaleA` skin (`player/Player.tsx`).
  - **Pipeline** (`npm run build:character`, `scripts/build-character.mjs`):
    1. FBX2glTF converts the FBX files.
    2. The Idle, Run and Jump clips are merged into the model, matched by bone name.
    3. The skin texture and a soft non-metallic material are applied.
    4. Resample, dedup and prune produce `public/models/character.glb` (≈ 163 KB).
  - **Scale:** normalised at runtime from the skinned bounding box to **1.25 u**, about door height plus a head.
  - **Animation:** Idle/Run blended by speed. The Run clip's timeScale is `speed ÷ 2.5`, clamped to 0.6–1.7; 2.5 u/s is the planted-foot ground speed measured from the skeleton at 1×. A short Jump hop plays when a fast travel lands (off under reduced motion).
  - **Fetching:** the model is preloaded without Draco or Meshopt, so there are no decoder CDN requests.
- **Fallback — procedural avatar:** an original chibi "designer" built from procedural parts (`player/Character.tsx`, `ProceduralAvatar`). It shows while the GLB loads and permanently if the GLB fails (error boundary).
  - **Look:** a big head (≈ 45 % of height) with large blinking eyes, blush and round glasses; a swept fringe; a knit sweater with collar; a crossbody bag; sneakers.
  - **Animation:** procedural walk and run, idle breathing, and blinking.
- **Optional later:** swap in a rigged CC0 humanoid (e.g., KayKit Adventurers) with idle/walk/run clips (e.g., Quaternius Universal Animation Library, CC0), blended by speed via `crossFadeTo` (≈ 0.15 s) with `timeScale` matched to speed.
- Juice (P1, disabled under reduced motion): squash/stretch on start/stop (±5 %, 120 ms), dust puffs on run start and sharp turns (pooled sprites, ≤ 8 live).

### 4.5 Controls

| Action | Keyboard | Mouse / touch | Gamepad (P1) |
|---|---|---|---|
| Move | **W A S D** / **Arrow keys** (screen-relative: W/↑ = away from camera) | **Click/tap on ground** → auto-walk along great circle (P0); virtual joystick on coarse pointers (P1) | Left stick (analog speed) |
| Run | Hold **Shift** (setting: *Run toggle*, P1) | — (auto-walk uses run) | Hold B / right trigger |
| Interact / open | **E**, **Enter**, **Space** | Click/tap the preview card; click/tap a landmark (or its label) → **fast travel** to its approach point | A |
| Close / back | **Esc** (closes the open dialog/menu) | Close button / tap backdrop | B |
| Menu (fast travel, settings) | **M**, or **Esc** when no dialog/menu is open | Menu button (HUD) | Start |
| Rotate view (as built) | Hold **,** / **.** (the < > keys): counter-clockwise / clockwise | **Drag** the planet left/right (any button; touch drag); ⟲ / ⟳ buttons around the compass step 45° | Right stick X (P1) |
| Tilt view (as built) | Hold **Page Up** / **Page Down**: toward a top / side view (30°–78°) | **Drag** up/down; ˄ / ˅ buttons step 10° | Right stick Y (P1) |
| Face north (as built) | **N** | Click the **compass** | — |
| Reset position & direction (as built) | **H** or **Home** | **Reset** button under the compass | — |
| Zoom (P1) | **+ / −** | Mouse wheel / pinch | — |
| Classic site | HUD button (Tab to it), menu item | HUD button | Menu item |

Rules:
- Keys are matched by `KeyboardEvent.code` (layout-independent).
- Game keys are **only active while the game region has focus** (WCAG 2.1.4). **Tab is never intercepted**; Tab/Shift+Tab move between HUD controls, the game region, and out of the page. `preventDefault()` is called only for keys the game handles (arrows, Space, WASD, E, M, `,` `.`, Page Up/Down, N, H, Home, +/−) while the game region is focused.
- **Tap vs drag:** a pointer press that moves less than 6 px is a tap (walk to that spot / travel to a clicked building); anything longer is a view drag and never walks. Right-drag works too (the context menu is suppressed on the planet).
- Clicking a view button with a mouse hands focus back to the planet so WASD keeps working; keyboard activation keeps focus on the button.
- Diagonals are normalized; any movement key cancels an in-progress auto-walk or fast travel.
- **Held input is cleared** on `blur`, `visibilitychange`, dialog/menu open, and any capability/error transition (no "stuck key" walking).
- **Start & focus (no focus stealing):** when loading completes, the loader is replaced by a **Start exploring** button (also the user gesture that can unlock audio later). It receives focus **only if nothing else is focused** (`document.activeElement` is `body`). Activating it — or any pointer-down on the canvas — focuses the game region. The game region is a focusable wrapper (`tabindex="0"`, `role="region"`, `aria-label="Planet explorer — use arrow keys or WASD to move, E to open"`) with a visible `:focus-visible` indicator. `role="application"` is used only if Narrator/NVDA testing shows it's necessary.

### 4.6 Camera

- **Default: the Animal Crossing–style "diorama" camera**, which the player can now rotate and tilt (owner request, 2026-09-24). As built: **pitch 48°**, **distance 16 u**, **vertical FOV 35°**, look-at target **1.4 u ahead and 0.6 u above** the player's feet (so the player sits just below centre and more of the world ahead is visible). The first draft (50° / 13 u, target at the feet) cropped tall landmarks at the top of the frame.
  - **Conventions:** *pitch* = elevation of the camera above the player's local tangent plane; *distance* = straight-line distance from the camera to the player's feet at `(0, R, 0)`; the camera sits on the +Z side (screen-up = −Z).
  - Sanity check at R = 10 (as built): camera-to-centre ≈ 24.4 u, planet angular radius ≈ 24.2°, upper limb ≈ 18 % above screen centre → **≈ 40 % sky band** (matches screenshots). The forward horizon is ≈ **39.7° of arc** from spawn; anything further only shows above the limb if it's tall enough.
- **Rotate & tumble (as built):**
  - **Rotating the view spins the planet** about the player's vertical axis (ADR-4). The camera keeps its yaw, so the sky, sun and moon stay framed the same way (lighting is camera-relative, as in cozy life-sims). WASD stays screen-relative, and the character keeps facing the same way on the planet.
  - **Tilt** changes the camera pitch between **30°** (low, more sky) and **78°** (almost top-down), eased with λ = 10.
  - Button steps (45° / 10°) and **face north** ease in over about 0.3 s, and apply instantly under Reduce motion. Fast travel re-frames the view facing the destination.
  - **Reset** travels back to the plaza (fly-over, or a fade under Reduce motion) facing north at the default tilt.
- **Compass (map north):** the plaza sits on the planet's pole, where geographic north is undefined. The compass instead uses a **stereographic map grid centred on the plaza** (`math/compass.ts`). At the plaza, north points toward the Workshop, so the spawn view is north-up. From the plaza, Town Hall is east, the Library south and the Post Office west. The field is smooth everywhere except the unvisited far pole.
- **Zoom (P1):** three stops — *near* (35°, 11 u), *default* (48°, 16 u), *far* (60°, 22 u), eased with ~0.2 s half-life.
- **Follow feel (P1):** tiny visual lead of the character in the movement direction (≤ 0.3 u, ~0.12 s half-life) to emulate camera lag. **Off under reduced motion.**
- No camera shake, head-bob, or motion blur. FOV never exceeds 60°.

### 4.7 Proximity activation (core interaction)

A single **global** activation state (`nearbyId`, `openId`) — at most one landmark is ever `nearby` or `open` (arbitration rules in §5.4).

| Stage | Trigger | Feedback (all within 100 ms) |
|---|---|---|
| **Nearby** ("activate by getting closer") | Arc distance from player to landmark center < `enterRadius` (= footprint + 1.75 u) and it is the **nearest** qualifying landmark | Landmark reacts (bounce-in, outline thickens, accent glow); world-anchored name label; **preview card** slides up (bottom-center, non-modal): kicker, title, 1-line summary, `[Open · E]`, `[Classic page ↗]`; `aria-live="polite"` announcement "Near Workshop — Selected case studies. Press E to open." |
| **Leave** | Distance > `exitRadius` (= 1.3 × enterRadius) — hysteresis prevents flicker | Card slides out, landmark settles. |
| **Open** | Interact input while *nearby* (or within **150 ms** before entering — input buffer); click/tap on card or landmark | Native `<dialog>` (`showModal`) with the landmark's content and **Open full page (classic) ↗**; URL → `?at=<id>&open=1` (pushState); movement paused; render loop drops to on-demand. |
| **Close** | Esc / close button / backdrop / browser Back | Dialog closes; focus returns to the **invoker** if it still exists (preview-card button, parallel-nav button), otherwise to the game region; URL restored (see History below); movement resumes. |

- **History:** opening pushes `?at=<id>&open=1`; the close button/Esc call `history.back()` **only if the game pushed that entry**; the `popstate` handler performs the actual close. On a **direct load** of `?at=<id>&open=1`, the page first `replaceState`s to `?at=<id>` and then pushes the open entry, so Back closes the dialog instead of leaving the site. Refresh while open re-opens the dialog.
- **Default activation mode = `prompt`** (preview on approach, explicit input to open) — this is the P0 behavior and the DoD baseline. Rationale: avoids surprise modals when walking past (WCAG 3.2.1/3.2.2 by analogy, XAG 117 "let players control automatic changes"). `activationMode: "auto"` (open on arrival) is a **non-default P1 experiment** for the feel review (**Decision D-3**); making it the default would require revising FR-21/FR-22 and the DoD.
- Walking into a landmark footprint collides and slides (§5.3); the approach point is in front of its door/sign.
- Visited landmarks (P1) show a small flag and count toward "Visited 3/7" in the menu.

### 4.8 Wayfinding & onboarding

- **Spawn:** Plaza, facing Workshop, Workshop base visible.
- **First-visit hint** (P0): small overlay bottom-left — "WASD / arrows to move · Shift to run · E to open · M for map" + "Prefer a normal website? Classic site". Auto-dismisses after **2 cumulative seconds** of movement; re-openable via Menu → Controls; dismissal remembered.
- **Fast travel** (P0): Menu → *Landmarks* list (also the parallel DOM nav, §6) or click/tap a landmark. A short **fly-over**: the camera eases out to the far zoom, the planet rotates along the great circle to the landmark's approach point (collisions disabled during travel), and the camera eases back — total ≤ 1.2 s — ending with the character facing the landmark and its preview card shown. Under reduced motion: **≤ 200 ms opacity fade with no spatial motion** (fade out → teleport → fade in).
- **Signposts** at the Plaza pointing to each landmark (P1); **edge-of-screen indicator** toward the nearest unvisited landmark (P1); **"I'm stuck" → return to Plaza** (P1).

### 4.9 HUD (DOM overlay, not in-canvas)

```
┌──────────────────────────────────────────────────────────────┐
│ [Skip to classic site] (visually hidden until focused)       │
│ Planet · <name TBD>                  [Classic site] [☰ Menu] │
│                                                    [🔇] (P2) │
│                                                              │
│                        ( 3D canvas )                         │
│                                                              │
│ ┌ Controls hint (first visit) ┐   ┌──── Preview card ─────┐  │
│ │ WASD move · Shift run · E   │   │ CASE STUDIES          │  │
│ └─────────────────────────────┘   │ Workshop              │  │
│                                   │ One-line summary…     │  │
│                                   │ [Open · E] [Classic ↗]│  │
│                                   └───────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- All HUD elements are real HTML (`<button>`, `<a>`, `<dialog>`, `<nav>`), ≥ 24×24 CSS px targets, 4.5:1 text contrast on a solid/blurred backing, never obscuring the focused element (WCAG 2.4.11).
- **Menu** (`<dialog>`): Landmarks (fast travel + visited state), Controls, Settings (Reduce motion, Pause ambient motion, **Time of day** (cycle / local time / always day, §4.13), Run toggle (P1), Quality Auto/Low/High (P1), Sound (P2)), **Classic site**, Return to Plaza (P1). The action row (Show controls / Classic site / Close) stays pinned at the bottom when the menu scrolls.
- **Time badge** in the header next to Menu: planet time with a sun/moon glyph (hidden below 520 px wide).
- **View controls** (bottom-right; top-right below 720 px wide), a `role="group"` labelled "View":
  - a **compass** button that always points to map north. Its label says which way you face (e.g. "Compass: facing north-west. Face north (N)"), and activating it faces north.
  - ⟲ / ⟳ rotate and ˄ / ˅ tilt buttons around the compass, as single-pointer alternatives to dragging (WCAG 2.5.7).
  - a **Reset** button (back to the plaza, facing north).

### 4.10 Escape hatch & fallbacks

The classic site must be reachable **at all times** — this is a hard requirement.

| Situation | Behavior |
|---|---|
| Any time on `/play` | Skip link (first focusable), HUD **Classic site** button, Menu item, `?mode=classic`. |
| Near / inside a landmark | **Context-preserving switch**: Classic button goes to `/classic/<nearest-or-open-id>`; dialog has **Open full page ↗**. |
| JavaScript disabled | `<noscript>` message + link to `/classic/`. |
| WebGL2 unavailable | The gate never imports the 3D bundle; show "Your browser can't show the 3D planet" with the **Go to classic site** link focused. **No timed auto-redirect.** |
| Software rendering (`failIfMajorPerformanceCaveat` fails) or GPU tier 0 (`@pmndrs/detect-gpu`) or `navigator.connection.saveData` | Interstitial choice: **Continue anyway** / **Classic site** (classic focused). |
| Asset load error or > 15 s load | Error panel: **Retry** / **Classic site**. |
| `webglcontextlost` | Pause, overlay: **Reload planet** / **Classic site**. |
| Loading | Loader shows % progress (drei `useProgress`) and the Classic link. |

### 4.11 Requirements index

Priority: **P0** = required for the POC Definition of Done · **P1** = should, stretch within POC · **P2** = could, only if time allows.

| ID | Requirement | Pri | Spec § |
|---|---|---|---|
| **Movement & camera** | | | |
| FR-01 | WASD + arrow keys move the character screen-relative; diagonals normalized | P0 | 4.5 |
| FR-02 | Hold Shift to run | P0 | 4.5 |
| FR-03 | Run *toggle* setting (no held key required) | P1 | 4.5 |
| FR-04 | Accel/decel/turn per tuning table; frame-rate independent; `dt` clamped | P0 | 5.2, 5.5 |
| FR-05 | Continuous walking over the whole sphere with no seams, pole flips, or camera jumps | P0 | 5.2 |
| FR-06 | Character faces movement direction; idle/walk/run cross-fade by speed | P0 | 4.4 |
| FR-07 | Collision with landmarks/large props; slide along obstacles | P0 | 5.3 |
| FR-08 | Click/tap ground → auto-walk along the great circle **until arrived (≤ 0.3 u) or blocked**; if no progress for 0.5 s, stop and show a subtle "blocked" cue; retargeting allowed; any movement key cancels | P0 | 4.5, 5.2 |
| FR-09 | Virtual joystick on coarse pointers | P1 | 4.5 |
| FR-10 | Gamepad (standard mapping, analog speed, deadzone) | P1 | 4.5 |
| FR-11 | Diorama camera by default (sky band visible); the user can rotate and tilt it within limits, face north via the compass, and reset position and direction | P0 | 4.6 |
| FR-12 | Zoom stops (wheel / +− / right stick) | P1 | 4.6 |
| FR-13 | Follow lead/lag feel (off under reduced motion) | P1 | 4.6 |
| FR-14 | Juice: squash/stretch, lean, dust puffs | P1 | 4.4 |
| **Landmarks & activation** | | | |
| FR-20 | 7 content landmarks + Plaza from the content collection, placed by lat/lon, distinct silhouettes | P0 | 4.3, 5.6 |
| FR-21 | Proximity "nearby" state: reaction + label + preview card + live-region **DOM text update** ≤ 100 ms; hysteresis; global arbitration with switch margin | P0 | 4.7, 5.4 |
| FR-22 | Interact (E/Enter/Space/click/tap) opens dialog; 150 ms input buffer | P0 | 4.7 |
| FR-23 | Dialog: native `<dialog>`, Esc/Back closes, focus returns, movement paused | P0 | 4.7 |
| FR-24 | Dialog links to the matching classic page | P0 | 4.7 |
| FR-25 | Visited state + "Visited n/7" | P1 | 4.7 |
| FR-26 | `activationMode: "auto"` experiment flag (non-default; `prompt` stays the P0 default) | P1 | 4.7 |
| **Wayfinding** | | | |
| FR-30 | Spawn at Plaza facing Workshop (base visible); every approach point ≤ 10 u arc from Plaza and reachable in ≤ 8 s running | P0 | 4.3, 4.8 |
| FR-31 | First-visit controls hint; dismiss after 2 cumulative s of movement; re-openable; remembered | P0 | 4.8 |
| FR-32 | Fast travel from Menu / landmark click (fly-over ≤ 1.2 s; ≤ 200 ms opacity fade under reduced motion) | P0 | 4.8 |
| FR-33 | Plaza signposts, off-screen indicator, "I'm stuck" | P1 | 4.8 |
| **Escape hatch & modes** | | | |
| FR-40 | Classic site reachable at all times (skip link, HUD button, menu, `?mode=classic`) | P0 | 4.10 |
| FR-41 | Context-preserving switch to `/classic/<id>` | P0 | 4.10 |
| FR-42 | Classic pages link back "Explore in 3D" → `/play?at=<id>` | P0 | 4.1 |
| FR-43 | Mode preference persisted; landing emphasizes last-used mode | P0 | 4.1 |
| FR-44 | Capability gating (3D bundle never downloaded when gated out) & all fallbacks in §4.10 table | P0 | 4.10, 5.9 |
| FR-45 | Deep links `?at=` / `&open=1`; URL tracks dialog; Back closes dialog | P0 | 4.1, 4.7 |
| **Accessibility** | | | |
| FR-50 | Game keys scoped to focused game region; Tab never hijacked; no traps | P0 | 4.5, 6 |
| FR-51 | Parallel landmark nav + `aria-live` announcements | P0 | 6 |
| FR-52 | Reduced motion (media query + setting) | P0 | 6 |
| FR-53 | HUD/dialog meet WCAG 2.2 AA (contrast, target size, focus visible/not obscured, names/roles) | P0 | 4.9, 6 |
| FR-54 | Remappable keys | P2 | 6 |
| FR-55 | Audio (muted default, toggle, footsteps + ambient) | P2 | 2.2 |
| **Performance & platform** | | | |
| FR-60 | Landing ships zero 3D JS; game chunk lazy on `/play` | P0 | 5.9 |
| FR-61 | Loader with % progress + classic link | P0 | 5.9 |
| FR-62 | Adaptive DPR; render-on-demand when dialog open / tab hidden | P0 | 5.8 |
| FR-63 | Quality setting (Auto/Low/High) | P1 | 4.9 |
| FR-64 | Budgets in §7 **met, or waived in writing by the owner** (waiver log in the plan) | P0 | 7 |
| **Developer experience** | | | |
| FR-70 | `window.__game` test hook in non-production builds only | P0 | 5.10 |
| FR-71 | leva tuning panel in dev only | P1 | 5.5 |
| FR-72 | Optimized asset pipeline script (gltf-transform) + CREDITS.md | P0 | 5.1, 13 |
| **World & ambience (added after the POC scope)** | | | |
| FR-80 | Day–night cycle with cycle / local-time / always-day modes, persisted; readable at night | P1 | 4.13 |
| FR-81 | Rolling terrain, cliff mesas, boulders, a flowing stream with a waterfall, and a walkable arched bridge. Landmarks, plaza and paths stay flat and reachable; the cliffs block walking, while the stream and pond can be waded through (slower, knee-deep, with ripples) | P1 | 4.14, 5.3 |
| FR-82 | Wind: gust-driven foliage sway, flying leaves and occasional swirls, all stopped under reduced motion / pause ambient | P1 | 4.14 |

### 4.12 Art direction (as built)

The cozy life-sim look is achieved with **original** procedural models. The style cues below came from studying reference screenshots (see §13); no assets were copied.

| Cue | How it's implemented |
|---|---|
| Soft, bevelled "toy" forms | Every box is a rounded box; blobs are welded, smooth-shaded icospheres; no outlines, no hard toon ramp (`world/kit.ts`) |
| Architecture vocabulary | Reusable parts (`world/parts.ts`): stone plinths with blocks, corner pilasters, cornice bands, siding, gable roofs from overlapping shingle rows with trim boards, stepped hip roofs, panelled doors with brass handles, arched windows with mullions and sills, wall lanterns, awnings, bunting, flower boxes, steps, benches, barrels, crates, pot plants, sign boards |
| Landmark silhouettes | Workshop cabin with chimney smoke, workbench and log pile; Town Hall with portico, pediment, clock-tower cupola and waving flag; striped Lighthouse with gallery, lantern room and rotating beam; classical Library with columns, banners and a giant stacked-book sculpture; band-shell Amphitheater with bulbs, spotlights and bunting; glass-dome Greenhouse with plants inside; Post Office with awning, envelope sign and a mailbox whose flag pops up when you're near |
| Nature | **Trees** (`world/foliage.ts`): a dark inner canopy volume covered with overlapping, drooping leaf cards. The cards use **hand-painted, generated greyscale sprites** (§4.15): a three-leaf cluster for hardwoods and bushes, and a 2×2 conifer atlas (round clump, drooping bough, cloud of tufts, crown tip) for cedars. They are tinted per card from dark undersides to sunlit tops; canvas-drawn leaves are the fallback. Cards are lit with the canopy's volume normal so the tree shades as one soft mass, and alpha-tested depth materials cast leaf-shaped shadows. Hardwoods have five rounded lobes on a **low-poly faceted trunk** (`facetedTube`: an irregular 7-gon swept along a curved, tapering S-bent spine with flat-shaded facets, each in its own bark tone). It has five fin-like buttress roots diving into the ground, a limb curving up into each side lobe, a few twigs and broken-branch stubs (plus apple/orange variants). Cedars avoid the regular stacked-cone look. They have five or six irregular tiers, each a tapering shell of **grouped** foliage: at irregular angles (with occasional gaps), a drooping bough fan hangs from the rim, with round clumps and tufts spread over the group's patch (lighter outside, darker inside) around a small dark core. The axis leans slightly, and the tree ends in a clustered crown. Three seeded variants (blue-green, fresh green, yellow-green) are spread across the planet. The trunk is slimmer and faceted, with four roots. Bushes use the same leaf system. Also rounded rocks, clumps of tulips/cosmos/pansies, grass clumps (three crossed, painted alpha cards), a pond with lily pads and cattails, and butterflies; trees, bushes, grass and flowers sway in the wind (§4.14) |
| Ground | Hand-painted, seamless tiles (§4.15) for lawn, dirt paths, cobbled forecourts, beach sand and riverbed, layered over procedural clover, tiny flowers, worn path edges, damp banks and painted grit on steep ground. The brick-ring plaza with its compass rose stays procedural (`world/planetMaterial.ts`) |
| Rock and water | Cliff walls carry a painted sandstone-strata tile mapped around each mesa. Boulders, rocks and pebbles get painted stone detail. The river shows drifting painted caustics (§4.15) |
| Landscape | Gently rolling hills; faceted sandstone cliff mesas with grass lips; mossy boulders and river pebbles; a meandering stream with a waterfall, foam and flowing water; an arched plank bridge with lanterns (§4.14) |
| Wind | Gust-driven sway and leaf flutter on all foliage, tumbling leaves, and occasional hand-drawn-style swirl ribbons (§4.14) |
| Sky | Gradient sky, puffy drifting clouds, sun, moon and stars that follow the day–night cycle (§4.13) |
| Camera "diorama" feel | Fixed-angle camera (§4.6) + **tilt-shift** blur top and bottom, gentle bloom on lamps/windows, vignette, neutral tone mapping (`high` tier only) |
| Character | Chibi proportions — the rigged CC0 Kenney character (§4.4), with the original procedural "designer" (round glasses, knit sweater, crossbody bag) as its fallback |

All ambient animation (clouds, wind sway, flying leaves and swirls, flowing water, smoke, beam, flag, butterflies, fireflies, star twinkle, idle breathing, and the day–night clock in cycle mode) stops under **Reduce motion** or **Pause ambient motion**.

### 4.13 Day–night cycle (as built)

The planet has a cozy life-sim day: soft dawn pinks, a bright day, a warm golden hour, a lilac dusk, and a deep-blue starry night.

- **Clock:** hours 0–24, shown in a small header badge (e.g. "☀ 9:12 AM"; not a live region). Three modes, chosen in **Menu → Time of day** and remembered (`localStorage site.timeMode`):
  - **Day–night cycle** (default): starts at 9:00 AM. A full day takes about 6 minutes: the daytime (6 AM–7 PM) takes about 4.5 minutes and the night about 1.5 minutes, so visitors see a sunset without long stretches of darkness.
  - **Match my local time:** the visitor's own clock, the way life-sim games follow real time.
  - **Always daytime:** fixed at 10:30 AM.

  Changing the mode sweeps the sky forward to the new time in a couple of seconds, or instantly under Reduce motion. The sweep plays after the menu closes, because rendering idles while a dialog is open.
- **What changes:**
  - sky gradient, fog, hemisphere colours and intensity
  - sun/moon direction, colour and intensity, so shadows move through the day
  - cloud tint
  - lamp and window glow, below the bloom threshold by day and blooming at night
  - lighthouse beam brightness
  - warm light pools under the plaza lamps
  - daylight "lift" emissives (foliage, pond) fade at night
- **Sky objects:**
  - The sun and moon rise from behind the planet's limb at the left and set at the right. They are camera-facing discs with soft halos, drawn behind the clouds.
  - About 170 twinkling stars fade in after dusk.
  - Fireflies drift over the pond and flower beds at night, and butterflies go to sleep.
- **Readability:** night is deep blue rather than black: moonlight plus a blue hemisphere light keep the scene legible. All HUD text sits on solid cards, so its contrast doesn't depend on the time of day.
- **Motion:** in cycle mode the clock stops under Reduce motion or Pause ambient motion; the Menu says so. Local time still follows the clock, because that change is imperceptibly slow.
- **Implementation:**
  - `world/timeOfDay.ts` is a pure, unit-tested model: keyframed palettes, sun/moon arcs and cycle speed.
  - `world/DayNight.tsx` holds the rig: lights, sky texture, sun, moon and stars, plus `Fireflies` and `LampPools`.
  - The directional light fades to zero at the sun↔moon handover, so the shadow direction never visibly jumps.

### 4.14 Landscape & wind (as built)

The planet is no longer a smooth ball: the land gently rolls, rocky cliffs rise out of it, and a little stream runs through it under a cozy bridge. A light breeze keeps everything alive.

- **Rolling ground:** smooth value-noise hills up to about ±0.6 u. The ground stays flat on the plaza, landmark forecourts and approach points, the pond and the river banks, so nothing looks buried or floating. Paths keep 30 % of the roll so they follow the land.
- **Cliffs and rocks:**
  - Four flat-topped **mesas** with irregular outlines; two have a second tier. Their walls are faceted, flat-shaded rings of warm sandstone strata with a grass lip on top. The mesa tops have grass and a few trees.
  - Big mossy **boulders** cluster at the cliff feet, sit on the river banks and dot the open country. About 90 small **pebbles** line the banks, cliff feet and path edges.
  - Mesas and boulders are obstacles; pebbles are walk-through.
- **Stream:**
  - It springs from the foot of the tallest mesa as a **waterfall** with a plunge pool and foam, then meanders (Catmull-Rom spline, varying width) down to the pond.
  - The ground is carved into a river bed below the water line. The shader paints damp banks and a pebbly bed.
  - The water is a ribbon with a flow shader: scrolling ripples and sparkles, lighter shallows at the edges, and foam streaks. The waterfall sheet uses the same shader, falling faster. Water dims at night like the rest of the daylit materials.
  - The stream and pond are **wadeable** (see Wading below); the bridge keeps your feet dry.
- **Pond (where the stream ends):**
  - The pond **shares the stream's water level**, so the two are one body of water. Its bowl is part of the terrain height (`pondBasin` in `world/pond.ts`; where it meets the stream bed the deeper of the two wins), and the shoreline is wherever the ground rises through the water. There is no separate rim.
  - The shoreline is organic: `shoreRadius` adds a few low harmonics for a soft, lobed outline. It relaxes to the nominal radius at the stream mouth. The basin, sand rim, water mesh, plant zones and prop keep-out all follow it.
  - The pond water uses the river's shader in a still-water variant: slow wandering ripples, drifting caustics and broken shoreline foam. Where the stream flows in, the foam opens up and the channel's deeper colour carries into the pond. The river ribbon cross-fades out (a per-vertex fade in `aFlow.z`) before it ends, over pond water that runs out under the mouth, so there is no seam, lip or colour step.
  - Plants (`world/pondPlants.ts`, pure and unit-tested): six irregular shore groups grade from reeds wading in the shallows, to irises at the waterline, to ferns on the damp bank. Reeds flank the stream mouth, and lily-pad clusters float on the open water. Nothing is placed in the mouth itself. All of them are painted alpha sprites from the `pond-atlas` (§4.15), and the upright ones sway in the wind.
- **Bridge:** the stream crosses the Greenhouse path under an **arched plank bridge** with stringers, posts and rails, stone abutments and two lanterns that glow at night. The character walks up and over the arch: the camera and character follow the deck height. The rails are obstacles, so you can't step off the side of the deck; you can still wade across the stream beside the bridge.
- **Wading:**
  - The stream and the pond don't block walking. `Terrain.inWater(n)` / `waterDepth(n)` say where the water is and how deep. The stream is about 0.2 u deep; the pond is up to about 0.27 u.
  - The character walks down onto the stream bed or pond floor (`walkHeight`, never more than `WADE_MAX_U` = 0.3 u under the surface, about knee-deep), so the water hides their legs. The camera follows.
  - Wading is slower: `wadeSpeedFactor(depth)` eases the walk and run speed down to 55 % in deep water (`PlanetSim.speedFactor`, set by the controller each step). The run cycle slows with it.
  - Feedback (`world/WadeFx.tsx`, one instanced draw call while wading, none on land): a broken, bubbling **foam collar** hugs the legs at the waterline, and **wake rings** spread from each step. They come briskly while moving and as a slow ripple while standing, and they stay put on the planet, so walking leaves a trail. Under Reduce motion or Pause ambient motion the rings are hidden and the collar holds still.
  - Cliffs, boulders, trees and the bridge rails still block.
- **Wind:**
  - The wind circulates around a tilted axis, so it blows in one consistent direction across the visible cap (towards screen-left at spawn).
  - Its strength breathes between a 0.3 breeze and occasional multi-second gusts.
  - One set of shared shader uniforms drives all the sway. Trees, cedars and bushes lean downwind and ripple as gust waves roll across the planet, while leaf cards flutter. Grass and flowers bend, and leaf shadows move with the leaves.
  - Up to 30 **flying leaves** (warm, mixed colours) tumble across the scene near the character, spawning upwind; more fly during gusts.
  - Occasionally a soft **wind swirl** — a thin white ribbon that streaks along the wind and curls into a loop — draws itself and fades out over about 3 s. They appear more often during gusts, and at most three are shown at once.
- **Motion:** under Reduce motion or Pause ambient motion the wind clock freezes, the flying leaves and swirls are hidden, and the water stops flowing.
- **Implementation:**
  - `world/features.ts` defines the river spline, mesas and bridge placement.
  - `world/terrain.ts` holds `Terrain`, a pure, unit-tested height model: `height(n)` (including the stream bed and pond bowl), `deckHeight(n)`, `walkHeight(n)`, `inWater(n)` and `waterDepth(n)`. `world/pond.ts` holds the pond shape (frame, lobed shoreline, bowl).
  - `world/Landforms.tsx` builds `Cliffs`, `Water` and `Bridges`.
  - `world/windField.ts` is the pure wind model with its shared uniforms.
  - `world/WindFx.tsx` holds the driver, flying leaves and swirls. See §5.3 for collision and ADR-13/ADR-14.

### 4.15 Hand-painted textures (as built)

All textures and the landing art are **original**, generated for this project with GPT Image 2.5 (`gpt-image-2.5-sunburst`) at `high` quality. Every source and its exact prompt is in `assets-src/textures/` (ADR-15, credits in `assets-src/CREDITS.md`).

| Asset | Kind | Used by |
|---|---|---|
| `grass`, `dirt`, `cobble`, `sand`, `riverbed` | Seamless colour tiles, 512² | Ground shader layers (triplanar in planet-local space) |
| `rock` | Seamless strata tile, 512² | Cliff walls (UV-mapped around each mesa, so the strata stay horizontal); boulders, rocks and pebbles (object-space triplanar, luminance only, so moss caps keep their colour) |
| `water` | Seamless greyscale caustics mask, 512² | River flow shader (two layers drifting downstream) |
| `leaf-broad`, `leaf-single`, `grass-card` | Alpha sprites converted to tintable greyscale | Hardwood/bush leaf cards, flying leaves, grass clumps |
| `conifer-atlas` | 2×2 tintable atlas of four alpha sprites (clump, bough, tufts, crown), 512² | Cedar foliage cards (each card picks a cell; `Cards.add` takes a UV rect) |
| `pond-atlas` | 2×2 full-colour atlas of four alpha sprites (lily-pad cluster, reeds with cattails, irises, fern), 512² | Pond plants: flat floating lily cards and crossed upright cards for reeds, irises and ferns |
| `moon` | Alpha sprite | Night sky moon disc |
| `paint-grain` | Seamless greyscale brush-grain mask, 256² | Subtle painted surface on all kit models (landmarks, bridge, plaza furniture): object-space triplanar, luminance only, so every colour is kept. The kit has one shared material, so the grain is generic rather than per material (wood, stone, roof) |
| `landing-hero` | Key art (image-to-image from the spawn screenshot) | Landing poster (`public/poster/landing-{800,1200}.webp`) and the social card (`public/og-image.jpg`, 1200×630) |

- **Seamless tiles:** the skill's `tile` command rolls the image so the wrap seams meet in the middle, then repaints just the seams in two masked passes. The composite is tone-corrected and feathered outside the repainted area, so the result wraps exactly: seam scores are ≈ 1.0, i.e. indistinguishable from any interior column or row.
- **Palette preserved:** each ground layer is divided by the tile's mean colour and multiplied by the layer's original colour or vertex tint. The textures add painted detail without changing the scene's palette or the day–night lighting. Grass mixes two scales with a slow noise, so the tile never visibly repeats. Clover and tiny flowers stay procedural, so they're never tiled.
- **Tintable sprites:** foliage sprites are stored as normalised greyscale (0.55–1.0) with real alpha. Per-card and per-instance colours tint them exactly like the old canvas leaves, and they keep alpha-tested shadows. Alpha is snapped (≥ 250 → opaque, ≤ 4 → clear), and transparent pixels are colour-bled, so mipmaps never show halos.
- **Grass clumps** are three crossed cards with upward normals (so they shade like the lawn): 6 triangles instead of about 36 each. This saves about 20 k triangles.
- **Loading:** the 14 game textures are about 600 KB of WebP. `mountGame` preloads them before the first render (with a 10 s cap). Any texture that fails leaves its material on the procedural look, so the planet is always complete.
- **Pipeline:** `python scripts/build-textures.py` builds `public/textures/*.webp` from `assets-src/textures/*.png` and writes `src/game/world/textureManifest.ts` (URLs, kinds, byte sizes, mean linear colours). Its steps: wrap-safe resize for tiles; crop, fit, greyscale and bleed for sprites; the poster sizes and the social card. The outputs are committed.

## 5. Technical design

### 5.1 Stack (pinned versions)

Install via the Microsoft npm proxy per [AGENTS.md](../../AGENTS.md); always install exact versions (`npm i pkg@x.y.z`).

| Concern | Choice | Version | Why |
|---|---|---|---|
| Site framework | Astro | `7.3.3` (proxy; GitHub has 7.3.4) | Content-first, zero-JS by default, islands, content collections |
| React (game UI + JSX tooling) | `@astrojs/react` + React / ReactDOM | `6.0.6` + **`19.2.8`** | R3F 9.7.0 peer range is `react >=19 <19.3` — **do not** use React 19.3 yet |
| 3D engine | three (**`WebGLRenderer`**) | `0.186.0` (+ `@types/three@0.186.0`) | Official manual still labels `WebGPURenderer` experimental; drei helpers (Outlines, etc.) are WebGL-only |
| React renderer | `@react-three/fiber` | **`9.7.0`** | Proxy `latest` is a v10 canary — never use it |
| Helpers | `@react-three/drei` | `10.7.8` | KeyboardControls, Html (world labels), PerformanceMonitor, AdaptiveDpr, useProgress; (useGLTF/useAnimations if GLB assets are added later) |
| State | zustand | `5.0.15` | Tiny, works inside and outside React (`useFrame`) |
| Smoothing | maath | `0.10.8` | Frame-rate-independent `easing.damp*` |
| Touch joystick (P1) | nipplejs | `1.0.4` | TS rewrite (2026), ~6 KB gz, MIT |
| GPU tier | `@pmndrs/detect-gpu` | `6.0.22` | Low-end gating |
| Dev tuning (dev only) | leva | `0.10.1` | Live-tune movement/camera constants |
| Post-processing (high tier) | `@react-three/postprocessing` + postprocessing | `3.1.1` + `6.39.5` | Tilt-shift, bloom, vignette, neutral tone mapping (§4.12) |
| Character pipeline (dev) | `@gltf-transform/core`, `/functions`, `/extensions` + FBX2glTF (`fbx2gltf@0.9.7`, installed to a temp folder, not a project dependency) | `4.5.0` | FBX → merged, optimised GLB (`npm run build:character`) |
| Asset pipeline (dev) | `@gltf-transform/cli`, gltfjsx | `4.5.0`, `6.5.3` | Meshopt + KTX2 compression; typed JSX |
| Perf HUD (dev) | stats-gl | `4.2.3` | FPS / GPU timing |
| Unit tests | vitest, `@react-three/test-renderer` | `5.0.1`, `9.1.1` | Pure math + scene graph |
| E2E / a11y | `@playwright/test`, `@axe-core/playwright` | `1.63.0`, `4.13.0` | WebGL via SwiftShader flags; axe scans |
| Runtime | Node | ≥ 22.12 (local: 24.13) | Astro 7 engine requirement |

**Explicitly not used:** physics engines (Rapier/ecctrl — revisit only if jumping/complex colliders are needed; `ecctrl@2.0.2` supports spherical gravity), WebGPU/TSL, Babylon.js, PlayCanvas, Spline, Needle, Godot/Unity exports. Runner-up if React friction appears: vanilla three.js + camera-controls in a plain Astro `<script>` island. See [research/tech-stack.md](./research/tech-stack.md).

TypeScript & scaffolding: don't run an unpinned `npm create astro@latest` (it can pull unpinned versions via the proxy). Hand-scaffold a minimal project (`package.json`, `astro.config.mjs`, `tsconfig.json` extending `astro/tsconfigs/strict`, `src/pages/`), then `npm i astro@7.3.3 …` with exact versions. Use the TypeScript version Astro 7's `astro check` supports; do **not** adopt TypeScript 7 until verified (⚠️).

### 5.2 Movement model — "rotate the planet, not the player" (ADR-4)

The character is fixed at the planet's top `(0, R, 0)`; the camera is fixed relative to it; input **rotates the planet** underneath. This yields the fixed-yaw diorama camera with **no poles, no gimbal lock, no camera up-vector smoothing**, fixed lighting, and a cheap shadow map. Landmarks/props are children of the `planet` group.

Per frame (`dt = min(delta, 0.1)`). All vectors are explicit about their space: **world** (camera frame; the player's tangent plane is `y = 0`) or **planet-local** (rotates with the planet).

```ts
// 1. Desired velocity in WORLD space (tangent plane at the player). screen-right = +X, screen-up (W) = −Z
let desired: Vec3;
if (autoWalk.active) {
  // Target is stored in PLANET-LOCAL space; take the great-circle tangent at pLocal, then convert to world.
  const tLocal = tangentToward(pLocal, autoWalk.targetLocal); // normalize(pT − (pT·p)p); antipode/degenerate → current heading dir
  desired = planetQ.apply(tLocal).setY(0).normalize().multiplyScalar(RUN);
} else {
  const i = clampLength(intent.move, 1);                        // analog-ready; diagonals normalized
  desired = vec3(i.x, 0, -i.y).multiplyScalar(intent.run ? RUN : WALK);
}
vel = damp3(vel, desired, |desired| > 0 ? ACCEL_T : DECEL_T, dt); // maath easing, world space, y = 0

// 2. Sub-step so no step exceeds MAX_STEP (0.1 u) → no tunneling at RUN × dt-clamp (0.5 u)
const n = max(1, ceil(|vel| * dt / MAX_STEP));
for (let k = 0; k < n; k++) {
  const vLocal = planetQ.invert().apply(vel);                   // world → planet-local (tangent at pLocal)
  const vSlide = slideVelocity(vLocal, pLocal, obstacles);      // §5.3 (iterative projection)
  const speed = |vSlide|;
  if (speed < EPS) { vel.set(0, 0, 0); break; }                 // head-on / wedged: stop; never normalize a zero vector
  const dWorld = planetQ.apply(vSlide).normalize();             // lies in y = 0 plane
  const q = axisAngle(normalize(cross(dWorld, UP)), speed * (dt / n) / R);
  planetQ = normalize(q.multiply(planetQ));                     // premultiply: surface ahead comes to the top
  pLocal = planetQ.invert().apply(UP);
  resolvePenetration();                                         // §5.3; preserves twist
  vel = dWorld.multiplyScalar(speed);                           // keep only post-slide (tangential) velocity
}

// 3. Heading follows ACTUAL movement, not raw input
if (|vel| > EPS) heading = dampAngle(heading, atan2(vel.x, vel.z), TURN_T, dt); // model faces +Z
```

- `axis = dWorld × UP` with a **positive** angle `speed·dt/R` brings the point ahead of the player to the top (verified in review; unit-tested).
- **Auto-walk** (tap-to-move) stops when the arc distance to the target ≤ 0.3 u, or when progress < 0.05 u over 0.5 s ("blocked" cue; the user can retarget). No path-finding in the POC.
- **Fast travel** does not use this loop: it slerps `planetQ` from its current value to the destination orientation (approach point at the top, facing the landmark), with collisions disabled.
- All constants live in `src/game/config.ts` and are leva-tunable in dev.

### 5.3 Collision

- **Units:** obstacle sizes are authored in world units — `footprintU_j`, `PLAYER_RADIUS_U = 0.35`, `SKIN_U = 0.02`. The expanded angular radius is `β_j = (footprintU_j + PLAYER_RADIUS_U + SKIN_U) / R` (radians). Obstacle centers `n_j` are planet-local unit vectors.
- **Active contacts:** `angle(pLocal, n_j) ≤ β_j + ε`.
- **`slideVelocity` (iterative):** up to 4 passes; for each active contact compute the outward tangent *at the player* `t_j = normalize(pLocal (pLocal·n_j) − n_j)` (orthogonal to `pLocal`, pointing away from the obstacle) and, if `v·t_j < 0`, remove it: `v −= (v·t_j) t_j`. Stop when a pass changes nothing. If any `v·t_j < −ε` remains after 4 passes (wedged between obstacles), return zero.
- **Tunneling:** prevented by `MAX_STEP = 0.1 u` sub-steps (§5.2), which is well below the smallest expanded obstacle radius (≥ 0.67 u with the minimum 0.3 u footprint).
- **`resolvePenetration`:** if `angle(pLocal, n_j) < β_j`, rotate `pLocal` away from `n_j` along their great circle to angle `β_j` → `pCorrected`; let `c = setFromUnitVectors(pLocal, pCorrected)` (minimal rotation, planet-local); update `planetQ = normalize(planetQ · c⁻¹)` and assert `planetQ⁻¹·UP ≈ pCorrected`. This preserves the planet's twist about the player normal (no world-yaw jump).
- **Unit tests:** head-on (→ zero, no NaN), glancing (tangential speed preserved), two-obstacle corner, high-`dt` at RUN (no tunneling through the smallest obstacle), push-out twist preservation (a reference landmark's world yaw unchanged within 1e-4 rad).
- No physics engine. The collision loop is O(n) over about 300 obstacle circles per sub-step, which is negligible. The bridge rails and mesa walls are made of the same circles as the trees and landmarks. Water is not an obstacle: it only changes the height you stand at and your speed (§4.14 Wading).
- **Terrain is visual only (ADR-13):** collision and movement stay on the unit sphere. The character, camera and props are lifted by `Terrain.walkHeight` / `height` (§4.14). The lift is damped (λ ≈ 14), so walking over hills and the bridge arch is smooth. Obstacles block wherever the ground is too steep or wet to walk: the river (a chain of circles along the spline, left open where a path crosses on a bridge), the bridge rails, and each mesa (a core circle plus a ring along its rim). Mesa-top trees need no obstacle because you can't get up there.

### 5.4 Proximity system

- Each landmark has center `n_i`, `enterU_i = footprintU_i + 1.75`, `exitU_i = 1.3 · enterU_i`; arc distance `s_i = R · acos(clamp(pLocal · n_i, −1, 1))`.
- **Global arbitration** (one `nearbyId`):
  - If there is a current `c`: keep it while `s_c ≤ exitU_c`, **unless** another landmark `j` with `s_j < enterU_j` is closer by more than `SWITCH_MARGIN_U = 0.25` (`s_j + 0.25 < s_c`) → hand off to `j` immediately.
  - If `s_c > exitU_c`, release `c` and pick the best candidate with `s_i < enterU_i`.
  - Best candidate = smallest `s_i`; ties (|Δ| < 1e-3 u) are broken by content `order`, then `id`.
- While a dialog is open (`openId` set), proximity is frozen.
- On every `nearbyId` change: HUD preview card, landmark reaction, and **one** live-region text update ("Near Workshop — Selected case studies. Press E to open."). Leaving is silent (reduces chatter). The DoD's 100 ms target measures the **DOM text update**; when it is spoken depends on the browser and assistive technology.
- **Interact buffer:** store the timestamp of the last interact press; if `nearbyId` becomes non-null within 150 ms of it, open that landmark.
- **Unit tests:** overlapping ranges, equal-distance jitter, A in its exit band while B enters, immediate handoff, buffer edges (149 ms opens / 151 ms doesn't).

### 5.5 Tuning defaults (starting points — adjust during feel review)

| Parameter | Default | Tuning range | Source / note |
|---|---|---|---|
| Planet radius `R` | 10 u | 8–14 | Research: 8–12 h keeps traversal short |
| Character height | 1 u | — | Unit scale |
| Walk speed | 2.2 u/s | 1.8–2.6 | est. |
| Run speed | 5.0 u/s | 4.5–6.0 | est.; πR ≈ 6.3 s at run |
| Time to full speed | 0.12 s | 0.08–0.20 | est. "short ramp-up" |
| Time to stop | 0.08 s | 0.05–0.12 | est. "near-instant stops" |
| Turn smoothing | 0.05 s half-life | 0.03–0.10 | > 150° reversal → quick pivot + squash |
| Camera pitch / distance / vFOV / look-at offset | 48° / 16 u / 35° / 1.4 u ahead, 0.6 u up | 35–60° / 11–22 u / 30–45° | Tuned from screenshots (first draft 50°/13 u cropped tall landmarks) |
| Follow lead (P1) | ≤ 0.3 u, 0.12 s | 0–0.5 u | 0 under reduced motion |
| Proximity enter / exit | footprint + 1.75 u / ×1.3 | +1.25–2.5 u / ×1.2–1.4 | Bruno Simon uses 2.5 u |
| Proximity switch margin | 0.25 u | 0.1–0.5 u | Prevents flicker between neighbors |
| Player radius / skin | 0.35 u / 0.02 u | — | Collision (§5.3) |
| Movement sub-step (`MAX_STEP`) | 0.1 u | ≤ 0.2 u | No tunneling |
| Auto-walk arrival / blocked | 0.3 u / < 0.05 u progress in 0.5 s | — | FR-08 |
| Interact buffer | 150 ms | 100–200 ms | Celeste-style forgiveness |
| Fast travel | ≤ 1.2 s fly-over | 0.8–1.5 s | Reduced motion: ≤ 200 ms opacity fade, no spatial motion |
| `dt` clamp | 0.1 s | — | Avoid tab-switch jumps |
| Gamepad deadzone (P1) | 0.18 radial | 0.15–0.2 | |
| DPR clamp | desktop [1, 2], coarse pointer [1, 1.5] | — | Stepped down by `PerformanceMonitor` |

### 5.6 Content model (single source of truth)

`src/content/landmarks/<id>.md` via Astro content collections (Zod schema). The entry `id` comes from the filename.

```ts
{
  title: string;              // "Workshop"
  kicker: string;             // "Selected case studies"
  summary: string;            // ≤ 140 chars — preview card + classic index
  order: number;              // fast-travel, classic nav, proximity tie-break
  lat: number; lon: number;   // center in planet-local degrees; |lat| ≤ 85 (avoid pole-degenerate "north")
  modelYawDeg: number;        // rotation about the local up; 0 = door faces local north
  footprintU: number;         // collision radius (world units)
  approachDistanceU: number;  // approach point = center moved this far along the great circle in the door direction
  variant: string;            // visual variant key; unknown keys → generic landmark renderer (tinted tower + sign)
  accent: string;             // CSS color token
  dialog: {                   // short, plain-text, serializable → React dialog
    intro: string;
    highlights: string[];     // ≤ 5 bullets
  };
}
// Markdown body → full classic page only (server-rendered by Astro; never shipped to the game bundle)
```

- **Build-time validation** (Zod `superRefine` plus a unit test over the whole collection):
  - the approach point is outside every expanded collider and inside its own enter radius
  - footprints are ≥ 4 u apart
  - the arc from spawn to each approach point is ≤ 10 u
  - `|lat| ≤ 85`
- **Data flow:** `play.astro` serializes the frontmatter (not the body) into `<script type="application/json" id="landmarks-data">`, and the game reads it after the gate passes. `/classic/[id].astro` renders the same entries with the full Markdown body.
- One content edit updates both modes. A new entry with an existing **or** unknown `variant` appears in both modes without code changes; an unknown variant uses the generic renderer.

### 5.7 Project structure (proposed)

```
personal-site/
├─ AGENTS.md
├─ documentation/poc-3d-navigation/…
├─ astro.config.mjs · package.json · tsconfig.json · playwright.config.ts · vitest.config.ts
├─ public/
│  ├─ models/            # optimized .glb (meshopt/KTX2)
│  ├─ textures/          # generated, optimized WebP tiles and sprites (scripts/build-textures.py)
│  ├─ poster/            # landing key art (LCP image), 800w + 1200w WebP
│  └─ og-image.jpg       # 1200×630 social card
├─ assets-src/           # raw source models and generated textures + prompts (not shipped) + CREDITS.md
├─ src/
│  ├─ content.config.ts  # landmarks collection schema
│  ├─ content/landmarks/*.md
│  ├─ layouts/ClassicLayout.astro
│  ├─ pages/
│  │  ├─ index.astro     # landing
│  │  ├─ play.astro      # game shell + capability gate <script> + landmarks JSON
│  │  └─ classic/index.astro · classic/[id].astro
│  └─ game/
│     ├─ game-mount.tsx  # dynamically imported entry: createRoot → <GameApp/>
│     ├─ GameApp.tsx     # <Canvas>, providers, HUD
│     ├─ config.ts       # tuning constants
│     ├─ state/store.ts  # zustand: input, player, proximity, ui, settings(persist)
│     ├─ math/sphere.ts  # pure: latLon→vec, step, slide, arcDistance (unit-tested); compass.ts (map north)
│     ├─ systems/        # movement.ts, proximity.ts, autoWalk.ts (pure + thin hooks)
│     ├─ input/          # keyboard.ts, pointer.ts, gamepad.ts (P1), joystick.ts (P1)
│     ├─ world/          # kit.ts (merged vertex-coloured geometry), parts.ts (roofs, windows, doors, props),
│     │                  # models.ts (landmark models), propModels.ts (trees, flowers, rocks, clouds…),
│     │                  # layout.ts (scatter, pond, plaza furniture, obstacles), planetMaterial.ts (ground shader),
│     │                  # Planet.tsx, Props.tsx, Plaza.tsx, Landmark.tsx, KitModel.tsx, Sky.tsx (clouds), materials.ts,
│     │                  # timeOfDay.ts (pure day–night model), DayNight.tsx (lights, sky, sun/moon/stars, fireflies, lamp pools),
│     │                  # features.ts (river spline, mesas, bridges), terrain.ts (pure height model),
│     │                  # Landforms.tsx (cliffs, water, bridges), windField.ts (pure wind model + shared uniforms),
│     │                  # WindFx.tsx (wind driver, flying leaves, swirls), textures.ts (preload + triplanar GLSL),
│     │                  # textureManifest.ts (generated), rockDetail.ts (painted rock on cliffs and boulders),
│     │                  # pond.ts (pure: pond frame, lobed shoreline, bowl), pondPlants.ts (pure: plant placement),
│     ├─ player/         # Player.tsx (rigged Kenney model, idle/run blend, arrival hop), Character.tsx (procedural fallback avatar)
│     ├─ camera/         # DioramaCamera.tsx
│     ├─ ui/             # Hud.tsx, PreviewCard.tsx, LandmarkDialog.tsx, Menu.tsx, ViewControls.tsx (compass, rotate/tilt, reset),
│     │                  # Onboarding.tsx, LiveRegion.tsx, LandmarkNav.tsx, Loader.tsx, Fallback.tsx
│     ├─ platform/       # gate.ts (runs first; no react/three imports), capabilities.ts, url.ts, prefs.ts
│     └─ debug/testHook.ts # window.__game (non-production only)
└─ tests/
   ├─ unit/*.test.ts
   └─ e2e/*.spec.ts
```

### 5.8 Frame pipeline & rendering

- One ordered update in a single `useFrame`: **input → auto-walk → movement (sub-stepped, with collision) → proximity → character animation/juice → camera** (deterministic order; simulation logic in pure TS modules).
- `frameloop="always"` while playing; switch to `"demand"` when a dialog/menu is open or the tab is hidden (`visibilitychange`).
- `<PerformanceMonitor>` steps DPR down (2 → 1.5 → 1) on sustained drops and back up on recovery, changing at most once per 10 s (no oscillation); `<AdaptiveDpr>` optional. Adaptation can be disabled via the test hook for benchmarking.
- **Draw-call discipline:** props are instanced. Each landmark and the plaza are merged into one mesh per material layer (solid / glow / glass) with the geometry kit. There is one shadow-casting light.
- **No distance or horizon culling:** the whole planet (≈ 1 100 instanced props, 7 landmarks, plaza, cliffs, river and bridge) is always drawn, and the depth buffer hides the far side. Horizon culling was tried and removed: it saved about half the triangles but made objects pop in at the limb, which was distracting. With this little content the cost is acceptable, and `low` tier is the fallback.
- **Quality tiers:**
  - `high` (default on capable desktop GPUs) adds the post-processing chain and a 2048² shadow map.
  - `low` is used for software rendering (the "Continue anyway" path), Data Saver and coarse pointers. It keeps a cheaper tilt-shift (small kernel, 35 % resolution) but no bloom or vignette, and a 1024² shadow map.
  - **The tilt-shift is never switched off.** Adaptive quality waits 10 s after start (so shader-compile hitches don't count), then on sustained low FPS steps DPR down (2 → 1.5 → 1.25 → 1), and as a last step drops bloom and vignette. It never changes tier and steps back up when FPS recovers.
  - Non-production builds accept `?quality=high|low` for visual testing.
- **Sky objects** (clouds z ≈ −30…−38, sun/moon z = −50, stars z ≈ −62…−68) sit on planes behind the planet in the camera frame, inside the camera's far plane (130). The sky gradient is a small canvas texture set as `scene.background`, redrawn only when the clock has moved.
- **Wind and water in the vertex/fragment shaders:** all sway is done on the GPU. A single `windUniforms` object (time, strength, axis) is shared by every swaying material (and its depth material, so shadows match), so one driver update per frame animates all the foliage. Sway is computed in instance space (`transpose(mat3(instanceMatrix)) · wind`), so every instance leans downwind whatever its yaw. Shader locals use a `w*` prefix to avoid clashing with three.js chunk variables. Water uses one shared flow clock.

### 5.9 Loading strategy (capability-gated dynamic import)

A hydrated `client:only` island would import the game bundle as part of hydration, **before** any capability check. So `/play` does **not** use an island for the game.

1. The `/play` HTML shell paints immediately: skip link, header with Classic button, loader, noscript, and landmarks JSON.
2. `platform/gate.ts` runs first. It is bundled by Astro's `<script>`, targets < 5 KB gz, and has **no React or three imports**. It checks, in order:
   - a `?mode=classic` override → navigate to classic
   - WebGL2 support
   - `failIfMajorPerformanceCaveat`
   - `saveData`
   - GPU tier, via a lazily imported `@pmndrs/detect-gpu`. Its benchmark data must be self-hosted or the check skipped; it must not call a third-party CDN (⚠️ verify the default benchmark URL at M0).

   The result is *load*, *offer a choice*, or *fall back*.
3. Only on *load*, or when the user chooses **Continue anyway**, does it run `await import("../game/mount")`, which calls `createRoot(container).render(<GameApp/>)`. Game code is emitted as named chunks (`game-*`) so E2E tests can assert that no such request happens when the user is gated out.
4. GLBs load via `useGLTF` (with `KTX2Loader`/Meshopt via `extendLoader`), with progress from `useProgress`.
5. The generated textures (about 600 KB of WebP, §4.15) are preloaded before the first render; a texture that fails falls back to procedural. Shaders are precompiled (`renderer.compileAsync`). Then `performance.mark("game:playable")` fires when the loader is replaced by the **Start exploring** button and input is accepted.

`@astrojs/react` remains installed for JSX/TSX tooling, HMR, and any future classic-page islands.

### 5.10 Test hook (non-production only)

`window.__game` exists only in `astro dev` and in a separate **test build** (`astro build --mode test`, never deployed), gated on `import.meta.env.MODE !== "production"`. There is no runtime flag that enables it in production builds. An E2E check confirms it is absent from the production build.

```ts
{
  getState(): { pLocal: [x,y,z]; nearby: string | null; open: string | null; speed: number; fps: number };
  teleport(id: string): void;         // to landmark approach point
  setIntent(move: {x:number;y:number}, run?: boolean): void;
  interact(): void;
  pause(): void; resume(): void; advance(frames: number, fixedDt?: number): void;
  setAdaptiveQuality(enabled: boolean): void; setDpr(dpr: number): void;   // benchmarking
  setTime(hours: number | null): void;  // hold the day–night clock (visual tests); null releases it
  setWind(gust: number | null): void;   // hold the wind gust envelope 0–1 (visual/E2E tests); null releases it
  visitFeature(kind: 'bridge' | 'waterfall' | 'mesa' | 'river', i?: number): boolean; // teleport to a landscape feature
  groundInfo(): { lift: number; height: number; walk: number; riverD: number; riverHalfWidth: number };
}
```

`getState()` also reports `hours`, `night` (0–1), `glow` and `timeMode`, plus the view: `heading`, `pitch` (deg) and `north` (screen angle of map north in degrees, 0 = north-up). For the landscape it adds `lift` (the character's current height above the base sphere) and `wind` (`{ strength, gust, time, leaves, swirls }`, where `leaves` and `swirls` are the counts currently visible). `textures` is `{ loaded, failed, pending }` for the generated textures (§4.15).

## 6. Accessibility requirements

Targets: **WCAG 2.2 AA** for all DOM UI, plus **WCAG 2.3.3 Animation from Interactions (AAA) adopted as a product requirement**; relevant **Xbox Accessibility Guidelines** (107 Input, 109 Objective clarity, 112 UI navigation, 113 Focus handling, 117 Visual distractions & motion) and Game Accessibility Guidelines (basic + selected intermediate).

| Requirement | Implementation | Ref |
|---|---|---|
| Full keyboard operation, no traps | Arrows/WASD + E/Enter/Space; Esc closes the open dialog/menu (or opens the menu when none is open); Tab/Shift+Tab always move focus out of the game region | 2.1.1, 2.1.2 |
| Single-key shortcuts scoped | Game keys only when game region focused | 2.1.4 |
| Equivalent non-visual access | Parallel `<nav aria-label="Planet landmarks">` list of "Travel to …" buttons + `aria-live="polite"` region for proximity/state | 1.1.1, 4.1.2, 4.1.3 |
| Focus management | No focus stealing on load (Start button focused only if nothing is focused); dialogs via `showModal()`; focus returns to the invoker (fallback: game region); visible focus never obscured by HUD | 2.4.3, 2.4.7, 2.4.11, XAG 113 |
| Drag alternative | Tap/click-to-move and fast travel as alternatives to joystick drag | 2.5.7 |
| Target size & contrast | ≥ 24×24 px; text 4.5:1, UI glyphs 3:1 on solid/blurred backing | 2.5.8, 1.4.3, 1.4.11 |
| Motion | One global **Reduce motion** state (media query **or** in-game toggle) stops **every** decorative animation source: lighthouse beam, clouds, foliage wind, landmark idle bobs, particles, squash, follow lead. Transitions become opacity-only (≤ 200 ms). Menu → **Pause ambient motion** is available even without reduced motion. Never: shake, head-bob, motion blur, flashing. | 2.2.2 (A), 2.3.1 (A), 2.3.3 (AAA, adopted), XAG 117 |
| Predictable | Approaching shows a preview only; opening requires explicit input (default mode) | 3.2.1, 3.2.2 |
| Objectives/help | Controls re-openable; Classic & Contact in consistent places; visited checklist (P1) | 3.2.6, XAG 109 |
| Audio (P2) | Muted by default; visible toggle; no information conveyed by sound alone | 1.4.2 |
| Settings remembered | `localStorage` (mode, reduce motion, run toggle, onboarding seen) | GAG basic |

## 7. Performance budgets

Budgets are **P0**. A miss is acceptable only with a **written owner waiver** recorded in the plan's [waiver log](./plan.md#6-budget-waiver-log): metric, measured value, cause, decision.

| Metric | Budget | Method |
|---|---|---|
| Landing `/` 3D JS | **0 KB** | `size` script over build output, plus network panel |
| Landing Lighthouse (mobile preset) | Perf ≥ 95, A11y = 100, LCP ≤ 2.0 s, CLS ≤ 0.1 | Lighthouse, median of 3 runs |
| Gated-out devices | **0 requests** for `game-*` chunks or 3D assets | E2E network assertion (forced no-WebGL, `?mode=classic`) |
| Game JS (all chunks loaded by `/play`, gz) | ≤ **450 KB** | `size` script |
| Initial 3D assets (GLB + textures, transferred) | ≤ **2.5 MB** (total ≤ 4 MB) | Network panel |
| Estimated GPU texture memory | ≤ **32 MB** | Asset script: Σ width × height × bytes-per-pixel of the GPU format × 1.33 (mips) |
| Time to playable | ≤ **3.0 s** median of 5 cold-cache runs | `game:playable` mark minus navigation start. Chrome DevTools custom profile: 50 Mbps down / 10 Mbps up / 20 ms RTT, cache disabled, no CPU throttling |
| Frame pacing | rAF interval **median ≤ 16.7 ms** and **≥ 95 % of intervals ≤ 20 ms** | 60 s scripted walk loop (test build, minified). DPR forced to 1.5, adaptive quality off, 1920×1080 viewport, 60 Hz display, on AC power. CPU frame time and GPU time (stats-gl) reported separately |
| Draw calls / triangles | ≤ 60 / ≤ 100 k (original target) — **as built with no culling, after the art, landscape & wind, and texture passes: ≈ 96–106 calls / ≈ 650–670 k triangles per frame on high (all passes incl. shadows + post). The grass cards saved about 20 k. The biggest items are the displaced ground (≈ 65 k) and shadow-casting landmarks, trees and boulders, which are counted twice. Proposed waiver pending owner sign-off (plan §6)** | `renderInfo()` test hook (`renderer.info`, accumulated across passes) at the spawn view |
| Memory stability | ≤ 10 MB growth | Post-GC heap snapshots at t = 0 and t = 5 min of scripted play |
| Input → visible response | ≤ 50 ms | `keydown` timestamp to the first rendered frame with player displacement > 0 (performance marks, test build) |
| Adaptive quality | Steps down within 3 s under forced load; recovers; ≤ 1 change per 10 s | Test hook forcing a low-fps condition |

**Reference hardware** (recorded in the perf log *before* measuring: device model, CPU, GPU, RAM, OS build, browser version, display resolution and refresh rate, power state):
- **Primary:** the owner's Windows 11 laptop (integrated or entry-level discrete GPU).
- **Secondary (P1):** one Apple Silicon Mac.
- **Mobile (P1):** a mid-tier Android and an iPhone 13 or newer, target ≥ 30 fps using the same method.

## 8. Browser & device support

| Tier | Browsers | Expectation |
|---|---|---|
| **P0** | Edge & Chrome latest (Windows 11), Firefox latest, Safari 26 (macOS) | Full game mode |
| **P1** | iOS Safari 26, Android Chrome latest | Tap-to-move + joystick; may default to classic on GPU tier 0 |
| Any other / no WebGL2 | — | Classic site via fallback |

## 9. Telemetry

None in the POC (privacy-first). Optional P2: local-only debug overlay showing time-to-first-landmark for the feel review.

## 10. Architecture decisions (ADR-lite)

| # | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| ADR-1 | React Three Fiber 9 + drei, mounted by the `/play` gate | Vanilla three.js; Babylon.js 9; PlayCanvas 2; Threlte/TresJS | Largest ecosystem & Copilot familiarity; drei covers ~70 % of needs; `@astrojs/react` provides JSX tooling |
| ADR-2 | `WebGLRenderer` | `WebGPURenderer` (+TSL) | Official docs still "experimental"; drei WebGPU port in alpha; WebGL2 is universal |
| ADR-3 | No physics engine (kinematic) | Rapier + ecctrl (spherical gravity) | Saves ~800 KB gz WASM; no jumping/complex collisions needed |
| ADR-4 | Rotate the planet under a fixed player/camera | Move player in tangent frame + follow cam | Exact diorama feel; no poles; cheap shadows; simplest camera. User view rotation is also a planet spin about the player's vertical axis, so the camera rig, sky and lighting stay unchanged and WASD remains screen-relative |
| ADR-5 | Distance-based proximity with hysteresis | Physics sensors | Trivial math on a sphere; testable; no physics dependency |
| ADR-6 | DOM overlay for all actionable UI | In-canvas UI (uikit/Html) | Accessibility, focus, contrast, testability; drei `<Html>` only for world labels |
| ADR-7 | Astro content collection as single source | Hard-coded game data | Game & classic stay in sync; future CMS-ready |
| ADR-8 | `/play` route with a **capability-gated dynamic import** (not a hydrated island); landing has no 3D | Game on `/`; `client:only` island | Protects LCP/SEO and recruiter speed; gated-out devices never download 3D code; classic always first-class |
| ADR-9 | **Procedural, kit-merged models** (vertex-coloured primitives merged per material layer) | CC0 glTF kits; bespoke Blender models | Zero asset licensing risk; no GLB loading; tiny download; each landmark = ~3 draw calls; everything tweakable in code |
| ADR-10 | **No culling** — everything on the planet is always drawn | Horizon culling (dot-product test per instance/landmark); LOD | Horizon culling halved triangles but caused visible pop-in at the limb; the scene is small enough to draw in full, and nothing ever appears suddenly (owner decision, 2026-09-24) |
| ADR-11 | **Two quality tiers; tilt-shift on both** | Post only on `high`; always-full post | The tilt-shift *is* the diorama look, so it's always on (cheaper on `low`); bloom and vignette are the optional extras that adaptive quality may drop. An earlier version switched tiers at runtime and made the tilt-shift vanish after a few seconds |
| ADR-12 | **Compressed day–night cycle by default; local time and always-day as options** | Real local time only; static day | Local time only means most visitors never see dusk or night; a ~6-minute day (short night) shows the whole cycle during a typical visit. The keyframed palette model is pure TS (testable), and sky objects live in the camera frame like the clouds, which suits the rotate-the-planet model (ADR-4) |
| ADR-13 | **Terrain as a pure height function over the sphere; collision stays 2D** | Heightfield physics / raycast ground; separate terrain mesh per feature | One `Terrain.height(n)` feeds the ground mesh, prop placement, the character/camera lift and the tests, so everything agrees. Movement, sliding and proximity keep the proven unit-sphere maths (ADR-3/ADR-4). Unwalkable ground (cliffs, rails) is expressed as ordinary obstacle circles; water is wadeable, so `Terrain` reports its depth (`waterDepth`) and the character stands on the bed. Heights are mild enough that no slope limits are needed |
| ADR-14 | **Wind as shared GPU uniforms, plus a small pool of CPU-driven effects** | Per-object CPU animation; particle library | One uniform update animates ~1 000 swaying instances, and their shadows, for free. Flying leaves are a single instanced mesh, and swirls are a pool of three ribbons, so the cost is a handful of draw calls. The pure `windField.ts` keeps the direction and gusts testable and consistent between the shader and the effects |
| ADR-15 | **Generated, hand-painted textures as detail over the procedural look** (GPT Image 2.5, sources and prompts committed) | Keep fully procedural; CC0 texture packs; hand-painting in an art tool | The tiles add painterly detail (blades, stones, pebbles, strata, caustics, brush grain) that procedural noise can't match, in exactly the game's palette: the image-to-image references are the game's own screenshots, and the shader normalises by each tile's mean colour. Original output means no licensing risk. About 600 KB. The procedural shader remains the fallback, so a failed load never breaks the planet. Triplanar/UV mapping means the kit geometry needs no UVs |

## 11. Risks (summary — full register in [plan](./plan.md#5-risk-register))

Proxy version gaps & peer ranges; drei 10.7.8 vs three r186 compatibility; capability-gated chunk splitting; controller/collision stability; content serialization; history/focus races; headless WebGL flakiness in CI; Safari/assistive-tech hardware availability; motion sickness; asset licensing; scope creep into "real game"; mobile performance; late bundle-budget failure.

## 12. Open questions / decisions (defaults assumed — see [plan](./plan.md#4-decisions-log))

D-1 planet/working name · D-2 landmark set & order · D-3 activation mode (`prompt` default; `auto` is a P1 experiment) · D-4 landing default · D-5 touch/gamepad in POC (tap-to-move P0; joystick/gamepad P1) · D-6 preview deployment target · D-7 character · D-8 bundle strategy (R3F vs vanilla three, decided by the M0 spike).

## 13. Legal, brand & compliance

- **No Nintendo (or other) IP:** no characters/lookalikes, names, trademarks in titles/SEO/metadata, music, SFX, fonts (e.g., no Seurat/Nook-style UI), or distinctive UI. Game mechanics/feel are not protected by copyright; say "inspired by cozy life-sim games" in prose if needed.
- **Assets:** CC0 or original only; every third-party asset listed in `assets-src/CREDITS.md` with source URL and license. Avoid Mixamo for anything redistributed as raw files. As built, all 3D assets are original procedural geometry except the CC0 Kenney player character.
- **Style references:** Animal Crossing: New Horizons screenshots (Nookipedia) were studied **only** for general style cues — proportions, bevelled forms, roof/door/window vocabulary, tree and flower shapes, tilt-shift look. They are not stored in the repository and nothing was traced or copied. No Nintendo characters, logos (e.g. the leaf emblem), buildings, names, text or UI appear in the site.
- **Microsoft employee considerations:** POC uses placeholder content only; no Microsoft logos/brand assets or confidential work; final content subject to the Trust Code and internal Social Media / Outside Work policies (review before publishing).
