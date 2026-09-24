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
- WebGPU renderer, post-processing pipeline.
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
| `/` | Landing | Static HTML: name, role, one-liner, poster image of the planet (LCP), two CTAs: **Explore the planet** (`/play`) and **Classic site** (`/classic/`). Last-used mode is visually primary. **No 3D JS.** |
| `/play` | Game mode | HTML shell (skip link, header w/ Classic button, loader, `<noscript>` link) + a **tiny capability gate script** (no React/three imports). The game bundle is **dynamically imported only after the gate passes** (§5.9). |
| `/play?at=<id>` | Deep link | Spawn at landmark `<id>`'s approach point. |
| `/play?at=<id>&open=1` | Deep link | Spawn + open landmark dialog. |
| `/classic/` | Classic home | Stub index of all landmarks (same content collection). |
| `/classic/<id>` | Classic page | Full page per landmark; header link **Explore in 3D** → `/play?at=<id>`. |
| `?mode=classic` | Override | On `/` or `/play` → go to classic and persist preference. |

**Preference:** `localStorage["site.mode"] = "play" | "classic"`, written only on an explicit user choice. The POC never auto-redirects from `/` or `/play` **unless an explicit `?mode=` query override is present** (avoids flash/jank); otherwise the preference only changes CTA emphasis.

**Invalid deep link:** `?at=<unknown-id>` spawns at the Plaza and posts a polite status message ("Couldn't find that place — you're at the Plaza"); the URL is replaced with `/play`.

### 4.2 The planet

- **Shape:** true sphere, radius **R = 10 u** (character height = 1 u). A real sphere provides the "rolling log" curvature naturally; no bend shader needed.
- **Surface:** low-poly, gently noised grass sphere (vertex colors / palette atlas), a few paths (decals or vertex-painted) leading from the plaza to each landmark.
- **Props:** instanced trees, rocks, flowers/grass tufts (~150–250 instances, ≤ 6 draw calls total).
- **Sky & atmosphere:** soft vertical gradient background, light fog to fade the far limb, a few slow clouds (P2).
- **Lighting:** fixed hemisphere light + one directional "sun" with a single 1024² shadow map covering only the visible cap (the camera never moves relative to the sun — see §5.2), plus an always-directly-below **blob shadow** under the character for grounding.
- **Style:** toon shading (`MeshToonMaterial`, 3-step gradient map with `NearestFilter`), inverted-hull outlines (drei `<Outlines>`) on character and landmarks, one shared palette texture.

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

- CC0 low-poly humanoid (e.g., KayKit Adventurers) with **idle / walk / run** clips (from the pack or Quaternius Universal Animation Library, CC0, retargeted). **Fallback:** primitive "bean" character with procedural bob, so the POC is never blocked on assets.
- Animation blending by speed: idle ↔ walk ↔ run via `crossFadeTo` (≈ 0.15 s), walk/run `timeScale` scaled with actual speed to avoid foot sliding.
- Juice (disabled under reduced motion): squash/stretch on start/stop (±5 %, 120 ms), small forward lean when running, dust puffs on run start and sharp turns (pooled sprites, ≤ 8 live).

### 4.5 Controls

| Action | Keyboard | Mouse / touch | Gamepad (P1) |
|---|---|---|---|
| Move | **W A S D** / **Arrow keys** (screen-relative: W/↑ = away from camera) | **Click/tap on ground** → auto-walk along great circle (P0); virtual joystick on coarse pointers (P1) | Left stick (analog speed) |
| Run | Hold **Shift** (setting: *Run toggle*, P1) | — (auto-walk uses run) | Hold B / right trigger |
| Interact / open | **E**, **Enter**, **Space** | Click/tap the preview card; click/tap a landmark (or its label) → **fast travel** to its approach point | A |
| Close / back | **Esc** (closes the open dialog/menu) | Close button / tap backdrop | B |
| Menu (fast travel, settings) | **M**, or **Esc** when no dialog/menu is open | Menu button (HUD) | Start |
| Zoom (P1) | **+ / −** | Mouse wheel / pinch | Right stick Y |
| Classic site | HUD button (Tab to it), menu item | HUD button | Menu item |

Rules:
- Keys are matched by `KeyboardEvent.code` (layout-independent).
- Game keys are **only active while the game region has focus** (WCAG 2.1.4). **Tab is never intercepted**; Tab/Shift+Tab move between HUD controls, the game region, and out of the page. `preventDefault()` is called only for keys the game handles (arrows, Space, WASD, E, M, +/−) while the game region is focused.
- Diagonals are normalized; any movement key cancels an in-progress auto-walk or fast travel.
- **Held input is cleared** on `blur`, `visibilitychange`, dialog/menu open, and any capability/error transition (no "stuck key" walking).
- **Start & focus (no focus stealing):** when loading completes, the loader is replaced by a **Start exploring** button (also the user gesture that can unlock audio later). It receives focus **only if nothing else is focused** (`document.activeElement` is `body`). Activating it — or any pointer-down on the canvas — focuses the game region. The game region is a focusable wrapper (`tabindex="0"`, `role="region"`, `aria-label="Planet explorer — use arrow keys or WASD to move, E to open"`) with a visible `:focus-visible` indicator. `role="application"` is used only if Narrator/NVDA testing shows it's necessary.

### 4.6 Camera

- **Fixed yaw, fixed pitch** — no user orbit (the Animal Crossing–style "diorama" camera). As built: **pitch 48°**, **distance 16 u**, **vertical FOV 35°**, look-at target **1.4 u ahead and 0.6 u above** the player's feet (so the player sits just below centre and more of the world ahead is visible). The first draft (50° / 13 u, target at the feet) cropped tall landmarks at the top of the frame.
  - **Conventions:** *pitch* = elevation of the camera above the player's local tangent plane; *distance* = straight-line distance from the camera to the player's feet at `(0, R, 0)`; the camera sits on the +Z side (screen-up = −Z).
  - Sanity check at R = 10 (as built): camera-to-centre ≈ 24.4 u, planet angular radius ≈ 24.2°, upper limb ≈ 18 % above screen centre → **≈ 40 % sky band** (matches screenshots). The forward horizon is ≈ **39.7° of arc** from spawn; anything further only shows above the limb if it's tall enough.
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
- **Menu** (`<dialog>`): Landmarks (fast travel + visited state), Controls, Settings (Reduce motion, Pause ambient motion, Run toggle (P1), Quality Auto/Low/High (P1), Sound (P2)), **Classic site**, Return to Plaza (P1).

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
| FR-11 | Fixed-yaw/pitch diorama camera, sky band visible, no orbit | P0 | 4.6 |
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

## 5. Technical design

### 5.1 Stack (pinned versions)

Install via the Microsoft npm proxy per [AGENTS.md](../../AGENTS.md); always install exact versions (`npm i pkg@x.y.z`).

| Concern | Choice | Version | Why |
|---|---|---|---|
| Site framework | Astro | `7.3.3` (proxy; GitHub has 7.3.4) | Content-first, zero-JS by default, islands, content collections |
| React (game UI + JSX tooling) | `@astrojs/react` + React / ReactDOM | `6.0.6` + **`19.2.8`** | R3F 9.7.0 peer range is `react >=19 <19.3` — **do not** use React 19.3 yet |
| 3D engine | three (**`WebGLRenderer`**) | `0.186.0` (+ `@types/three@0.186.0`) | Official manual still labels `WebGPURenderer` experimental; drei helpers (Outlines, etc.) are WebGL-only |
| React renderer | `@react-three/fiber` | **`9.7.0`** | Proxy `latest` is a v10 canary — never use it |
| Helpers | `@react-three/drei` | `10.7.8` | KeyboardControls, useGLTF, useAnimations, Outlines, Html, PerformanceMonitor, AdaptiveDpr, useProgress, Instances |
| State | zustand | `5.0.15` | Tiny, works inside and outside React (`useFrame`) |
| Smoothing | maath | `0.10.8` | Frame-rate-independent `easing.damp*` |
| Touch joystick (P1) | nipplejs | `1.0.4` | TS rewrite (2026), ~6 KB gz, MIT |
| GPU tier | `@pmndrs/detect-gpu` | `6.0.22` | Low-end gating |
| Dev tuning (dev only) | leva | `0.10.1` | Live-tune movement/camera constants |
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
- No physics engine; O(n) over ≤ 50 obstacles per sub-step is negligible.

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
│  └─ poster/planet.avif # landing LCP image
├─ assets-src/           # raw source models (not shipped) + CREDITS.md
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
│     ├─ math/sphere.ts  # pure: latLon→vec, step, slide, arcDistance (unit-tested)
│     ├─ systems/        # movement.ts, proximity.ts, autoWalk.ts (pure + thin hooks)
│     ├─ input/          # keyboard.ts, pointer.ts, gamepad.ts (P1), joystick.ts (P1)
│     ├─ world/          # Planet.tsx, Props.tsx (instanced), Landmark.tsx, landmarks/*.tsx
│     ├─ player/         # Character.tsx (animations, juice), BlobShadow.tsx
│     ├─ camera/         # DioramaCamera.tsx
│     ├─ ui/             # Hud.tsx, PreviewCard.tsx, LandmarkDialog.tsx, Menu.tsx,
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
- Instancing for props; merged static geometry per landmark; ≤ 1 shadow-casting light.

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
5. Shaders are precompiled (`renderer.compileAsync`). Then `performance.mark("game:playable")` fires when the loader is replaced by the **Start exploring** button and input is accepted.

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
}
```

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
| Draw calls / triangles | ≤ 60 / ≤ 100 k | `renderer.info.render` at the spawn view and at the busiest landmark |
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
| ADR-4 | Rotate the planet under a fixed player/camera | Move player in tangent frame + follow cam | Exact fixed-yaw diorama feel; no poles; cheap shadows; simplest camera |
| ADR-5 | Distance-based proximity with hysteresis | Physics sensors | Trivial math on a sphere; testable; no physics dependency |
| ADR-6 | DOM overlay for all actionable UI | In-canvas UI (uikit/Html) | Accessibility, focus, contrast, testability; drei `<Html>` only for world labels |
| ADR-7 | Astro content collection as single source | Hard-coded game data | Game & classic stay in sync; future CMS-ready |
| ADR-8 | `/play` route with a **capability-gated dynamic import** (not a hydrated island); landing has no 3D | Game on `/`; `client:only` island | Protects LCP/SEO and recruiter speed; gated-out devices never download 3D code; classic always first-class |

## 11. Risks (summary — full register in [plan](./plan.md#5-risk-register))

Proxy version gaps & peer ranges; drei 10.7.8 vs three r186 compatibility; capability-gated chunk splitting; controller/collision stability; content serialization; history/focus races; headless WebGL flakiness in CI; Safari/assistive-tech hardware availability; motion sickness; asset licensing; scope creep into "real game"; mobile performance; late bundle-budget failure.

## 12. Open questions / decisions (defaults assumed — see [plan](./plan.md#4-decisions-log))

D-1 planet/working name · D-2 landmark set & order · D-3 activation mode (`prompt` default; `auto` is a P1 experiment) · D-4 landing default · D-5 touch/gamepad in POC (tap-to-move P0; joystick/gamepad P1) · D-6 preview deployment target · D-7 character · D-8 bundle strategy (R3F vs vanilla three, decided by the M0 spike).

## 13. Legal, brand & compliance

- **No Nintendo (or other) IP:** no characters/lookalikes, names, trademarks in titles/SEO/metadata, music, SFX, fonts (e.g., no Seurat/Nook-style UI), or distinctive UI. Game mechanics/feel are not protected by copyright; say "inspired by cozy life-sim games" in prose if needed.
- **Assets:** CC0 or original only; every third-party asset listed in `assets-src/CREDITS.md` with source URL and license. Avoid Mixamo for anything redistributed as raw files.
- **Microsoft employee considerations:** POC uses placeholder content only; no Microsoft logos/brand assets or confidential work; final content subject to the Trust Code and internal Social Media / Outside Work policies (review before publishing).
