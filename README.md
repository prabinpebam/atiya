# Personal site — "Little Planet" 3D navigation POC

A personal portfolio site with two ways in:

- **Classic site** (`/classic/`): normal, fast, accessible pages.
- **Game mode** (`/play/`): a cozy 3D tiny planet. You walk a character around with **WASD**; walking up to a landmark previews that part of the portfolio, and **E** opens it. The classic site is always one click away.

Design docs: [spec](documentation/poc-3d-navigation/spec.md) · [plan](documentation/poc-3d-navigation/plan.md) · [Definition of Done](documentation/poc-3d-navigation/definition-of-done.md) · [research](documentation/poc-3d-navigation/research/). Agent conventions: [AGENTS.md](AGENTS.md).

| Spawn | Proximity preview | Landmark dialog |
|---|---|---|
| ![Spawn view](documentation/poc-3d-navigation/screenshots/spawn.png) | ![Preview card](documentation/poc-3d-navigation/screenshots/proximity-preview.png) | ![Dialog](documentation/poc-3d-navigation/screenshots/landmark-dialog.png) |

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
| `npm test` | Vitest unit tests (sphere math, collision, proximity, URL, gate, content validation, route test) |
| `npm run e2e` | Playwright E2E + axe (builds the test bundle, headless Chromium with SwiftShader) |
| `npm run size` | Bundle budget report for the current `dist/` |
| `npm run verify:prod` | Production build + budgets + checks the test hook is absent |

First-time E2E setup: `npx playwright install chromium`. To use the installed Edge instead, set `PW_CHANNEL=msedge`.

## Controls

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Move | W A S D / arrow keys (screen-relative) | Click/tap the ground to walk there |
| Run | Hold Shift | — |
| Open a nearby place | E, Enter or Space | "Open" on the preview card |
| Travel directly | M (menu), then pick a place, or Tab to the hidden "Travel to a place" list | Click a building, or use Menu |
| Close / back | Esc, or the browser Back button | Close button / backdrop |
| Classic site | Skip link (first Tab stop), or the header **Classic site** button | Header button |

Game keys only work while the planet has focus, and Tab is never captured.

## How it works

- **Movement: rotate the planet, not the player** (spec §5.2). The character stays still at the top of the planet and input rotates the planet underneath. The camera is fixed, with no pole flips.
  - Collision is kinematic (no physics engine): circles on the sphere, sliding, sub-stepping, and a push-out that doesn't twist the planet.
  - Code: [src/game/math/sphere.ts](src/game/math/sphere.ts), [src/game/systems/movement.ts](src/game/systems/movement.ts).
- **Proximity:** one global "nearby" landmark, with hysteresis, a switch margin and a 150 ms interact buffer ([src/game/systems/proximity.ts](src/game/systems/proximity.ts)).
- **Content:** a single source of truth in [src/content/landmarks/](src/content/landmarks/).
  - Frontmatter drives the game (placement and dialog copy); the Markdown body drives the classic page.
  - Cross-entry validation runs at build time ([src/game/math/landmarks.ts](src/game/math/landmarks.ts)).
- **Capability-gated loading** (spec §5.9):
  - `/play/` runs a 2.6 KB gate ([src/game/platform/gate.ts](src/game/platform/gate.ts)) that checks WebGL2, software rendering and Data Saver.
  - Only if the check passes does it `import()` the game bundle ([src/game/game-mount.tsx](src/game/game-mount.tsx)).
  - Unsupported devices get the classic site and never download 3D code.
- **UI:** everything you can act on is semantic DOM (`<dialog>`, buttons, links), in [src/game/ui/](src/game/ui/). There's a parallel landmark list and an `aria-live` region for announcements. All rules live in [src/game/controller.ts](src/game/controller.ts).
- **Art:** original low-poly toon primitives; no third-party assets ([assets-src/CREDITS.md](assets-src/CREDITS.md)).
- **Stack (exact pins):** Astro 7.3.3, React 19.2.8, three 0.186.0 (WebGLRenderer), @react-three/fiber 9.7.0, @react-three/drei 10.7.8, zustand 5.0.15.

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
| Dialog: E opens, Esc/Back closes, URL `?at=&open=1`, focus returns to whatever opened it | E2E tests 8–10 |
| Deep links, invalid `?at=` → Plaza + status message | E2E tests 10–11 |
| Context-preserving classic switch, and back via Explore in 3D | E2E test 12 |
| Fast travel (menu, parallel nav), reduced-motion fade | E2E tests 13, 14, 16 |
| Gate: no WebGL2 → fallback with **zero game-bundle requests**; bundle load error → Retry/Classic; `?mode=classic` redirect + saved preference; context lost → Reload/Classic | E2E tests 3–5, 17 |
| Game keys ignored when HUD focused; Start button doesn't steal focus | E2E test 6 |
| axe: no serious/critical issues on landing, classic, fallback, dialog, menu | E2E tests 1, 2, 4, 8, 13 |
| Budgets: landing 0 KB 3D JS; gate 2.6 KB gz; game 304 KB gz (≤ 450); no `__game` in production | `npm run verify:prod` |
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
  - a CC0 animated character (a primitive "bean" stands in, which the spec allows as a fallback)
- [ ] P1/P2 backlog (M8): juice (squash, dust), follow-lead camera, visited state, `auto` activation experiment, run toggle, joystick, gamepad, zoom, "I'm stuck", quality setting, audio, key remapping, preview deployment.

## Known issues

- Headless Chromium reports software rendering, so E2E tests click **Continue anyway** on the interstitial. That's expected, and it exercises the "offer" path.
- The React/Astro renderer chunk (`client.*.js`, 0.9 KB) is emitted even though no page uses an Astro React island. It is never requested.
- `/play` has no Astro React island, so in dev the gate installs React Fast Refresh's preamble itself (`installDevRefreshPreamble` in `gate.ts`). Without it, dev throws `$RefreshSig$ is not defined`. It is stripped from production builds.
- The console warning `THREE.Clock: This module has been deprecated` comes from @react-three/fiber 9.7 internals and is harmless.
