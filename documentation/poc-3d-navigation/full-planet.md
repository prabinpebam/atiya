# Full planet, and the fog on a fast travel (spec and plan: v1, critique, v2 as built)

> **TL;DR.** The planet button in the header (<kbd>P</kbd>) shows the **whole planet**: the camera pulls back until all of it fits, sharp from rim to rim, and you turn it to look round it, by dragging or with the arrow keys, with no character to move. <kbd>P</kbd>, <kbd>Space</kbd> or the button again goes back, and the planet turns back as the camera returns. The **fog** now follows the camera out, in full planet and on a fast travel's fly-over, so the planet never disappears into it when the view pulls back.

## 1. Research: established patterns

| Game or app | What it does | What we take |
|---|---|---|
| **Google Earth, Apple Maps' globe** | Zoomed out, you grab the globe and turn it; the view always faces the centre | A drag turns the world as if grabbed, the camera looking at the planet's centre |
| **Super Mario Galaxy, Animal Crossing's map** | A separate map view of the whole world, out of play, and back to where you were | A mode of its own, with the character's controls off, that returns to exactly the view you left |
| **Cities: Skylines, SimCity's region view** | Pulling the camera far out lifts the distance fog and the depth of field so the whole map reads | The fog and the tilt-shift both open up as the camera pulls back |
| **Photo mode (Ghost of Tsushima, Forza)** | Hides the HUD, keeps the world running, leaves with the same key | No HUD for the character; the same key (and Space, the game's back key) leaves |

**Pick:** a globe you grab (Google Earth) in a mode of its own (a map view), with the far view's fog and focus opened up (city builders).

## 2. Plan v1 (the owner's brief)

1. A mode to see the full planet, with the fog range and the tilt-shift adjusted so the planet is in focus.
2. In it, only rotate the planet and inspect it; no character control.
3. An icon to turn it on.
4. On a fast travel the planet zooms out and the fog, unchanged, shrouds it: keep it visible.

## 3. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | Rotating the *camera* round the planet | The sun, the moon, the clouds and the sky gradient are placed in the camera's frame (AGENTS: never rotate the camera's yaw), so the far side would be lit from the wrong side, under a sky that doesn't move | The **world** turns (a group round the planet and the character, `controller.world`), the camera only pulls straight back. The sun keeps lighting the side in view |
| 2 | Turning with the game's view yaw (`PlanetSim.rotateView`) | It spins about the character's up axis only: the far side and the poles never come into view | The world turns about the screen's axes, as if grabbed, so any side can face you |
| 3 | One fixed fog range for "far" | The camera's distance differs with the window's shape (a tall phone frames the planet from further away) and on a fly-over it changes every frame | The fog's range scales with the distance to the planet's horizon (`fogScale`), against the character view's own: always exactly 1 there, and the horizon stays at the same depth in the fog wherever the camera is |
| 4 | Turning the tilt-shift off in full planet | It's part of the look and must always be on (AGENTS) | Its focus area widens to the whole planet (1.25 of the half-height), so only the frame's very edges soften |
| 5 | Its code in the main bundle | The critical JS is at its budget (450 KB gz) | Its own module, in the nature chunk (a new dynamic entry would re-split the shared chunks), attached once the planet is complete; the main bundle only gets the hooks (+0.2 KB) |
| 6 | Leaving the world turned when the mode ends | The character's view and the click-to-walk maths assume the world is still | The world turns back as the camera returns, from wherever it was left, and is exactly still once the mode is off |

## 4. Plan v2, as built

### 4.1 The mode

- **Turning it on:** the header's planet button (an icon button beside Menu, `aria-pressed` its state, named "View whole planet") or <kbd>P</kbd>. Not while loading, in a building or on a fast travel.
- **The view:** the camera eases (0.9 s; at once with reduced motion) from the character view straight back along its line of sight, until a ball of 15 u (the planet with its tallest crowns and the lighthouse's lamp) fits the narrower side of the window, and looks at the planet's centre (`overviewDistance`).
- **Turning:** a drag turns the world as if grabbed, the arrow keys and WASD turn it left, right, up and down, Page Up and Page Down tilt it, <kbd>,</kbd> and <kbd>.</kbd> roll it, and the menu's View buttons step it. <kbd>N</kbd> turns it back to the way the character sees it. A finger drags it too (the touch stick is off: there's no one to steer).
- **No character:** every key that would move or use the character is taken by the mode, a click doesn't walk, and the HUD that steers it (the focus lane, the aside, the hotbar, the compass and Reset, the character picker) is hidden. The world keeps living: the clock, the wind, the wildlife and the family carry on.
- **Leaving:** <kbd>P</kbd>, <kbd>Space</kbd>, <kbd>Escape</kbd> or the button again; a fast travel (<kbd>T</kbd>, its tiles, <kbd>H</kbd>) or a building opening leaves it too. The menu (<kbd>M</kbd>) opens over it.
- **Text twins:** turning it on and off is announced, with how to turn the planet and how to go back (touch copy for touch); How to play and the region's description list <kbd>P</kbd>.

### 4.2 The fog

`fogScale(dist, rest, R)` (`world/timeOfDay.ts`) is the ratio of the camera's distance to the planet's horizon, now and in the character's view at the current tilt. `DayNight` multiplies the fog's range (20–34 u) by it every frame, so:
- in the character's view it's exactly 1, at any tilt: nothing changes there;
- on a fast travel's fly-over (62°, 22 u) it opens by about a third, so the horizon sits as deep in the fog as when walking;
- in full planet it opens enough that the near side is unfogged and the rim only lightly hazed.

### 4.3 The tilt-shift

Full planet eases the tilt-shift's focus area from the game's 0.86 to 1.25 (`OVERVIEW.focusArea`) and back; it never turns it off, on either tier.

### 4.4 Code

- `camera/overviewMath.ts`: the pure rules (distance, easing, turning, which keys turn), unit-tested in `tests/unit/overview.test.ts` with `fogScale`.
- `camera/overview.ts`: the mode, exported by the nature chunk (`world/nature.ts`) and attached in `game-mount.tsx` once the planet is complete; it makes its own header button and imports nothing from the main bundle but types (its icon is Font Awesome Free's earth-asia path, inlined).
- The main bundle's hooks: `controller.overview` (`OverviewMode` in `types.ts`: `key`, `drag`, `nudge`, `frame`), `controller.world` (the `world` group in `Scene.tsx`), `controller.tiltShift`, the camera rig calling `overview.frame` after placing itself, and the <kbd>P</kbd> binding.
- The carried lantern's lamp takes the world's turn into account (`world/craft/gear.tsx`), so the light stays on the lantern.
- The grab cursor shows over the planet in full planet (`scripts/build-cursors.mjs`).

## 5. Definition of Done, with evidence

| # | Check | Evidence |
|---|---|---|
| 1 | The whole planet in view, sharp and unfogged | Seen in the browser (the dev server); E2E "full planet": camera > 50 u out, fog's near beyond the planet's near side, focus area > 1 |
| 2 | Turn it without moving the character | E2E: an arrow key turns the world > 0.2 rad and the character is still at the plaza; a drag doesn't walk |
| 3 | Back to exactly the character's view | E2E: after Space, the world is still, and the camera's distance, the fog and the focus area are what they were |
| 4 | The fog follows a fast travel's fly-over | E2E: the fog's far range opens by more than 15 % during a travel; unit: the horizon's depth in the fog matches the character view's |
| 5 | Fits a wide and a tall window | Unit: `overviewDistance` at 16:9, 1:1 and 9:19 |
| 6 | No cost to the planet's first load | `npm run verify:prod`: critical JS 449.7 KB gz (≤ 450), the mode in the nature chunk |
