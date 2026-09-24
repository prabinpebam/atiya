# Definition of Done — "Little Planet" 3D Navigation POC

| | |
|---|---|
| **Status** | Draft v0.2 (updated after design review) |
| **Date** | 2026-09-24 |
| **Related** | [Spec](./spec.md) · [Plan](./plan.md) |

The POC is **Done** when **every box below is ticked with evidence**: a test name, a screenshot or video, a measurement, or a reviewer's initials. P1 and P2 items in the [requirements index](./spec.md#411-requirements-index) are **not** required, but any that were built must not break an item on this list.

Evidence types: **[U]** unit test · **[E]** Playwright E2E test (test build) · **[A]** axe scan · **[M]** manual check (who, when, browser) · **[P]** performance measurement (method from [spec §7](./spec.md#7-performance-budgets)) · **[D]** document or artifact

---

## 1. Core experience

### Navigation
- [ ] **WASD and arrow keys** move the character relative to the screen. Moving diagonally is not faster than moving straight. (FR-01) **[U][E]**
- [ ] Holding **Shift** makes the character run; letting go returns it to walking. (FR-02) **[E][M]**
- [ ] Acceleration, deceleration and turning use the §5.5 values and don't depend on frame rate: a simulated 30 fps run and a 120 fps run cover the same distance to within ±2 %. The character's facing follows where it **actually moves** (including when sliding), not the raw key input. (FR-04) **[U]**
- [ ] The character can **walk continuously around the whole planet in any direction** with no seam, flip, jitter or camera jump. (FR-05) **[U][M]**
- [ ] Movement and collision unit tests pass for:
  - rotation sign
  - head-on stop (no NaN)
  - glancing slide (the speed along the wall is kept)
  - two-obstacle corner
  - no tunneling at run speed with the maximum `dt`
  - push-out that keeps the planet's twist unchanged

  (FR-05, FR-07) **[U]**
- [ ] The character faces its movement direction, and idle, walk and run blend without visible foot sliding. (FR-06) **[M]**
- [ ] The character can't pass through landmark footprints or large props, and slides along them when approaching at an angle. (FR-07) **[U][M]**
- [ ] **Clicking or tapping the ground** walks the character there. It stops on arrival (≤ 0.3 u) or shows a "blocked" cue after 0.5 s without progress. Any movement key cancels it. (FR-08) **[U][E]**
- [ ] The camera has a fixed yaw and pitch (the §4.6 conventions), shows a sky band above the horizon, and the user can't orbit it. (FR-11) **[M]**

### Landmarks & activation
- [ ] All **7 landmarks** are built from the `landmarks` content collection; the Plaza is built in.
  - Adding a `.md` entry with an existing **or unknown** `variant` makes it appear in both modes with no code changes (unknown variants use the generic renderer).
  - Invalid entries fail the build validation.

  (FR-20) **[U][M]**
- [ ] Walking into range triggers, within 100 ms: the landmark reaction, its label, the **preview card**, and the **live-region text update**. Walking out past the exit radius dismisses them, without flicker at the edge of the range. (FR-21) **[U][E]**
- [ ] At most **one** landmark is ever "nearby". Arbitration passes its tests: overlapping ranges, equal distances, handoff with the switch margin, and tie-break by order. (FR-21) **[U]**
- [ ] **E / Enter / Space / click / tap** opens the landmark dialog. A press made up to 150 ms before arriving still counts; one made 151 ms before does not. (FR-22) **[U][E]**
- [ ] The dialog is a native modal:
  - focus moves into it and stays there
  - **Esc**, the close button or browser **Back** closes it
  - focus returns to **whatever opened it** (or the game region)
  - movement is paused while it's open

  (FR-23) **[E]**
- [ ] Every dialog shows its structured intro and highlights, plus a working **Open full page ↗** link to `/classic/<id>`. (FR-24) **[E]**

### Wayfinding
- [ ] The game starts at the Plaza with the **Workshop's base and door on screen**, checked by an E2E projection test. (FR-30) **[E]**
- [ ] **Route test:** from spawn, auto-walk reaches every landmark's approach point in ≤ 8 s of simulated running time. (FR-30) **[E]**
- [ ] The controls hint appears on the first visit and dismisses after **2 seconds of movement in total**. It can be reopened from the Menu and stays dismissed after a reload. (FR-31) **[E]**
- [ ] **Fast travel** from the Menu, or by clicking a landmark, reaches every landmark:
  - a fly-over of ≤ 1.2 s normally
  - under reduced motion, an opacity fade of ≤ 200 ms with **no** spatial motion
  - it ends facing the landmark with its preview card showing

  (FR-32) **[E]**
- [ ] **Usability:** at least 4 of 5 first-time testers **reach and open** a landmark within **10 s** of `game:playable`, without help. Every tester recognizes the preview card as something they can act on. (Goals 2–3) **[M]**
- [ ] **Comfort:** at least 3 testers report no motion discomfort after 3 minutes of free play. (Goal 1, R-9) **[M]**

## 2. Escape hatch (hard requirement)

- [ ] **The classic site can be reached from every state:** loading, the Start button, playing, a dialog open, the Menu open, and every error or fallback screen. There is one test per path. (FR-40) **[E]**
- [ ] **Skip to classic site** is the first focusable element on `/play`. (FR-40) **[E]**
- [ ] Switching to classic while near or inside landmark X goes to `/classic/X`; switching from anywhere else goes to `/classic/`. (FR-41) **[E]**
- [ ] Every classic page has **Explore in 3D** → `/play?at=<id>`, which starts the player at that landmark. (FR-42, FR-45) **[E]**
- [ ] The mode preference survives a reload and the landing page emphasizes the last-used mode. **There are no redirects** except an explicit `?mode=` override, which is respected. (FR-43) **[E]**
- [ ] Deep links and history work:
  - `/play?at=library` starts at the Library
  - `/play?at=library&open=1` opens its dialog, and **Back closes the dialog without leaving the site**
  - refreshing while the dialog is open reopens it
  - repeated open/close cycles leave a clean history
  - an invalid `?at=` falls back to the Plaza with a status message

  (FR-45) **[U][E]**
- [ ] Every fallback in the spec's [§4.10 table](./spec.md#410-escape-hatch--fallbacks) has been demonstrated, with **no timed redirect**:
  - no JavaScript
  - no WebGL2 (forced)
  - software rendering or GPU tier 0 (stubbed detector)
  - an asset error or a load longer than 15 s (network blocked)
  - WebGL context lost (`WEBGL_lose_context`)

  (FR-44) **[E][M]**
- [ ] **Gated-out devices never download the game.** With no WebGL2, or with `?mode=classic`, there are **zero** requests for `game-*` chunks or 3D assets (network assertion). (FR-44) **[E]**

## 3. Accessibility

- [ ] **Keyboard-only walkthrough:** from `/`, enter the planet, visit and open all 7 landmarks, fast travel, change a setting, and leave to the classic site, all without a mouse and without getting trapped. (FR-50, WCAG 2.1.1/2.1.2) **[M]**
- [ ] Game keys work **only while the game region has focus**. Pressing W with a HUD button focused does nothing. Tab is never intercepted, and the page doesn't scroll from arrow keys or Space while the game has focus. (FR-50, WCAG 2.1.4) **[E]**
- [ ] **No focus stealing:** when loading finishes, focus moves to the Start button only if nothing else had focus. Held keys are cleared on blur, when the tab is hidden, and when a dialog or menu opens. (FR-50) **[E]**
- [ ] **Screen-reader smoke test** passes with **Narrator + Edge** and **NVDA + Firefox**:
  - the parallel landmark list lets you travel
  - proximity changes are announced
  - dialogs have the correct name and role
  - the `region` vs `application` role decision is recorded

  (FR-51) **[M]**
- [ ] **Reduced motion** (the OS setting or the in-game toggle) stops **every** decorative animation: lighthouse beam, clouds, foliage, idle bobs, particles, squash, follow lead. Transitions become opacity-only (≤ 200 ms). **Pause ambient motion** works even with reduced motion off. There is never camera shake, head-bob, motion blur or flashing. (FR-52, WCAG 2.2.2/2.3.1 (A), 2.3.3 (AAA, adopted)) **[E][M]**
- [ ] **axe** finds zero serious or critical issues on `/`, on `/play` (Start button, HUD, preview card, dialog, Menu, fallback screens) and on `/classic/*`. (FR-53) **[A]**
- [ ] Text contrast is at least 4.5:1 and UI glyph contrast at least 3:1 over the 3D scene; targets are at least 24×24 CSS px; the focus ring is always visible and never covered by the HUD. (FR-53, WCAG 1.4.3/1.4.11/2.5.8/2.4.11) **[A][M]**

## 4. Performance

Each metric uses the method and reference hardware in [spec §7](./spec.md#7-performance-budgets), with the hardware profile recorded first. A budget that is missed passes **only** with an owner-signed row in the [waiver log](./plan.md#6-budget-waiver-log).

- [ ] The landing page `/` ships **0 KB of 3D JS**, enforced by the `size` script. (FR-60) **[P]**
- [ ] Lighthouse (mobile preset) on `/`, median of 3 runs: Performance ≥ 95, Accessibility = 100, LCP ≤ 2.0 s, CLS ≤ 0.1. **[P]**
- [ ] Game JS is at most **450 KB gz** (`size` script). (FR-64) **[P]**
- [ ] Initial 3D assets transfer at most **2.5 MB** (4 MB total). Estimated GPU texture memory is at most **32 MB** (asset script). **[P]**
- [ ] Time to playable, the median of 5 cold-cache runs, is at most **3.0 s**. The loader shows % progress and the Classic link. (FR-61) **[P][M]**
- [ ] Frame pacing over a 60 s scripted walk (DPR fixed at 1.5, adaptive quality off): rAF interval **median ≤ 16.7 ms** and **at least 95 % of intervals ≤ 20 ms**. CPU and GPU times are reported separately. **[P]**
- [ ] At most 60 draw calls and 100 k triangles at the spawn view and at the busiest landmark. **[P]**
- [ ] Post-GC heap growth over 5 minutes is at most **10 MB**. Rendering switches to on-demand while a dialog is open and pauses in a hidden tab. (FR-62) **[P][M]**
- [ ] Input to visible response is at most **50 ms**. **[P]**
- [ ] Adaptive quality: under forced load, DPR steps down within 3 s, recovers afterwards, and changes at most once per 10 s. (FR-62) **[P]**

## 5. Compatibility

- [ ] The full P0 experience has been checked by hand on **Edge**, **Chrome** and **Firefox** (latest, Windows 11) and on **Safari 26** (macOS). **[M]**
- [ ] Tap-to-move works on at least one touch device (iOS Safari or Android Chrome), or that device is correctly offered the classic site. **[M]**

## 6. Engineering quality

- [ ] `npm ci` succeeds from the committed lockfile through the **Microsoft npm proxy**. Every dependency is pinned to an exact version (no `^`, `~` or `latest`). **[D]**
- [ ] `npm run check`, `npm test` and `npm run e2e` all pass with **zero failures** on a clean run. **[U][E]**
- [ ] The browser console shows no errors or warnings during a 5-minute session. Any third-party deprecation notices are listed. **[M]**
- [ ] These are **pure modules with unit tests:** sphere math, collision, proximity arbitration, input normalization, URL/history, content validation and the capability decision. **[U]**
- [ ] `window.__game` exists only in dev and the `--mode test` build. It is **absent from the production build**, checked by E2E against `preview`. (FR-70) **[E]**
- [ ] All tuning constants live in `src/game/config.ts`, and the final values from the feel review are copied into the spec's §5.5. **[D]**
- [ ] The code follows the spec's §5.7 structure; any deviation is noted in the README. **[D]**

## 7. Content, legal & compliance

- [ ] **Placeholder content only.** No confidential or unreleased Microsoft work, and no Microsoft logos or brand assets. **[M]**
- [ ] **No third-party game IP:** no Nintendo (or other) names, trademarks, characters or lookalikes, music, sound effects, fonts or distinctive UI anywhere in the assets, UI copy, page titles or metadata. **[M]**
- [ ] Every third-party asset is CC0 or original and is listed in `assets-src/CREDITS.md` with its source URL and license. The `assets` script rebuilds `public/models/*` from `assets-src/`. No third-party CDN calls at runtime, including `detect-gpu` benchmarks. (FR-72) **[D][E]**

## 8. Documentation & handoff

- [ ] The README covers:
  - prerequisites (Node ≥ 22.12, proxy setup per AGENTS.md)
  - install, dev, the build and test builds, preview
  - tests and the asset pipeline
  - the test hook and the tuning panel
  - the perf log

  **[D]**
- [ ] AGENTS.md conventions still match the code (pinned versions, R3F v9, WebGL only, DOM-overlay UI, gated bootstrap, no third-party IP). **[D]**
- [ ] The spec is updated to what was built: the plan's decisions log (D-1 to D-8) is resolved and the tuning values are final. **[D]**
- [ ] A **60–90 s demo video** shows: landing → Start → walk and run → two landmarks activated → fast travel → switch to classic with context kept → return via Explore in 3D. **[D]**
- [ ] Known issues and the P1/P2 backlog are listed in the README. **[D]**

## 9. Sign-off

- [ ] **Feel review** with the owner: movement, camera and activation feel are accepted, and `prompt` activation is confirmed (D-3). **[M]**
- [ ] **Owner sign-off:** the POC is accepted as the basis for building the production experience. **[M]**

---

### Explicitly *not* required for Done

Final art or content, a custom avatar, anything in M8 (P1): juice, follow lead, visited state, the `auto` activation experiment, run toggle, joystick, gamepad, zoom, signposts, "I'm stuck", quality setting, preview deployment. Also not required: audio and key remapping (P2), WebGPU, physics, analytics, localization.
