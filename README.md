# Personal site — "Little Planet" 3D navigation POC

A personal portfolio site with two ways in:

- **Classic site** (`/classic/`): normal, fast, accessible pages.
- **Game mode** (`/play/`): a cozy 3D tiny planet. You walk a character around with **WASD**; walking up to a landmark previews that part of the portfolio, and **E** opens it. The classic site is always one click away.

Design docs: [spec](documentation/poc-3d-navigation/spec.md) · [plan](documentation/poc-3d-navigation/plan.md) · [Definition of Done](documentation/poc-3d-navigation/definition-of-done.md) · [performance audit](documentation/poc-3d-navigation/performance-audit.md) · [art direction](documentation/poc-3d-navigation/art-direction/README.md) · [research](documentation/poc-3d-navigation/research/). Agent conventions: [AGENTS.md](AGENTS.md).

| Spawn plaza | Proximity preview | Landmark dialog |
|---|---|---|
| ![Spawn view](documentation/poc-3d-navigation/screenshots/spawn.png) | ![Preview card](documentation/poc-3d-navigation/screenshots/proximity-preview.png) | ![Dialog](documentation/poc-3d-navigation/screenshots/landmark-dialog.png) |

| Lighthouse | Pond | Low quality tier |
|---|---|---|
| ![Lighthouse](documentation/poc-3d-navigation/screenshots/lighthouse.png) | ![Pond](documentation/poc-3d-navigation/screenshots/pond.png) | ![Low tier](documentation/poc-3d-navigation/screenshots/low-quality-tier.png) |

![Player character: walking toward the camera, from behind at the Workshop, running, idle](documentation/poc-3d-navigation/screenshots/character.png)

**Two characters.** Pick one at the top right: the Skater (red tee, jeans), or Sunny, a female version in the same casual style (yellow daisy tee, cream sleeves, jeans, pink sneakers) with a ponytail and scrunchie. The chosen one wears a thick ring, and the choice is remembered.

| Character picker, Sunny chosen | Skater and Sunny from behind; Sunny running and turning |
|---|---|
| ![The planet with Sunny on the plaza and the two-portrait character picker at the top right](documentation/poc-3d-navigation/screenshots/character-select.png) | ![Close-ups: the Skater from behind, Sunny from behind with her ponytail, and Sunny running](documentation/poc-3d-navigation/screenshots/character-female.png) |

**Never lost behind a building.** When a building, tree or rock hides the character, its outline shows through: a cream rim over a faint dark fill, readable by day and at night.

| Behind the Town Hall | Behind the Library at night |
|---|---|
| ![The character's cream outline showing through the Town Hall's blue roof](documentation/poc-3d-navigation/screenshots/character-occluded.png) | ![The character's outline showing through the Library's purple roof at night](documentation/poc-3d-navigation/screenshots/character-occluded-night.png) |

![Trees: leaf-card hardwoods (incl. fruit tree), cedars and leafy bushes](documentation/poc-3d-navigation/screenshots/trees.png)

**Chopper.** A tribute to the owner's Lhasa Apso, who passed away recently. He runs free near the character with a fluffy shell-fur coat, charcoal ears and his blue collar with the red bone tag, busy with his own dog business: sniffing trees and rocks, chasing (and barking at) the rabbits, following a scent, play-bowing at the bushes, running ahead to sit and wait for you, scratching, panting, lying down. Whistle (<kbd>F</kbd>, or the dog button by the backpack) and he comes running. Walk up to him and press <kbd>E</kbd> to meet him: his card shows his real photos beside a little 3D Chopper doing doggy things.

| Chopper close up | Meet Chopper |
|---|---|
| ![Chopper, a fluffy white Lhasa Apso with charcoal ears, standing, lying with his paws out, and play-bowing](documentation/poc-3d-navigation/screenshots/chopper.png) | ![Chopper's profile card: his photo, his details, and a 3D Chopper sitting beside them](documentation/poc-3d-navigation/screenshots/chopper-card.png) |

**View controls.** The compass (bottom-right) always points to map north. Drag the planet, or use the buttons around the compass, to rotate and tilt the view. Click the compass to face north again, or **Reset** to fly back to the plaza.

| Rotated 45° (north is up-right) | Tumbled to a top view |
|---|---|
| ![Rotated view](documentation/poc-3d-navigation/screenshots/view-rotated.png) | ![Top view after dragging](documentation/poc-3d-navigation/screenshots/view-tumbled-top.png) |

**Day–night cycle.** One planet day takes about 6 minutes. You can also choose *Match my local time* or *Always daytime* under Menu → Time of day. Whatever the mode, the Town Hall's clock shows the real time on your device.

| Dawn | Golden hour | Dusk |
|---|---|---|
| ![Dawn](documentation/poc-3d-navigation/screenshots/daynight-dawn.png) | ![Golden hour](documentation/poc-3d-navigation/screenshots/daynight-golden-hour.png) | ![Dusk: sun setting right, moon rising left](documentation/poc-3d-navigation/screenshots/daynight-dusk.png) |

| Night at the plaza | Lighthouse at night | Fireflies at the pond |
|---|---|---|
| ![Night: lamps, light pools, stars, moon](documentation/poc-3d-navigation/screenshots/daynight-night.png) | ![Lighthouse at night](documentation/poc-3d-navigation/screenshots/daynight-lighthouse-night.png) | ![Pond with fireflies](documentation/poc-3d-navigation/screenshots/daynight-pond-fireflies.png) |

**Doors.** Walk up to a building and its door swings open onto a small furnished room: the Workshop's workbench, the Town Hall's red carpet and lectern, the Library's bookcases, the Post Office counter, the Lighthouse's spiral stair. Walk away and it swings shut. After dusk the rooms are lamplit and warm light spills out of the doorway onto the steps and the character. The Amphitheater has no door, so its red festoon curtain rises and the stage spotlights come on.

**Sound.** Subtle, cosy sound effects start with the Start click: a forest breeze that swells with the gusts, a babbling stream that gets louder (and pans toward the water) as you near it, birds calling now and then by day, and footsteps that match the ground: stone on the plaza and paths, grass on the lawn, planks on the bridge, splashes when you wade. Walking up to a building plays a soft chime as its door creaks open (the Amphitheater's curtain swishes up), and the door thuds shut behind you. **Sound** in the header (or Menu → Sound effects) mutes it all and is remembered. Every clip is CC0 and was picked by analysing candidates (level, hum and tones, clipping, spectrograms, loop seams) — see spec §4.16 and [CREDITS](assets-src/CREDITS.md). Under it all, quiet background music (the owner's own "Mossy Window Nook", two versions that alternate) plays softly and dips a little while a dialog is open; Menu → Background music turns it off on its own.

| Workshop, door open | Town Hall at night | Library at night | Amphitheater: curtain up |
|---|---|---|---|
| ![Workshop with its double doors swung open onto a workbench, stool and rug](documentation/poc-3d-navigation/screenshots/doors-workshop.png) | ![Town Hall at night, its doors open, lamplight spilling down the steps](documentation/poc-3d-navigation/screenshots/doors-town-hall-night.png) | ![Library at night, the open door showing bookcases and a reading table](documentation/poc-3d-navigation/screenshots/doors-library-night.png) | ![Amphitheater at night with the curtain raised and spotlights on the stage](documentation/poc-3d-navigation/screenshots/doors-amphitheater-night.png) |

**Landscape & wind.** The land gently rolls. Rocky cliff mesas rise from it, and a stream runs from a waterfall down to the pond, passing under an arched plank bridge you can walk over. The stream flows straight into the pond: they share one water level and shader, so there's no rim or seam, and the pond's lobed shore is planted with painted reeds, cattails, irises, ferns and floating lily pads. You can wade through both: the character walks down onto the bed, slows to a knee-deep slosh, and leaves a foam collar and spreading wake rings. A breeze sways every tree, bush, flower and grass tuft; gusts blow leaves across the scene and now and then a soft wind swirl curls past.

| Bridge on the Greenhouse path | Waterfall mesa | Cliff mesa and boulders | Wading across the stream |
|---|---|---|---|
| ![Arched plank bridge over the stream](documentation/poc-3d-navigation/screenshots/landscape-bridge.png) | ![Waterfall pouring off a sandstone mesa](documentation/poc-3d-navigation/screenshots/landscape-waterfall.png) | ![Two-tier cliff mesa with boulders](documentation/poc-3d-navigation/screenshots/landscape-mesa.png) | ![Character wading knee-deep across the stream, with wake rings](documentation/poc-3d-navigation/screenshots/landscape-wading.png) |

| The stream | A gust: flying leaves and a swirl | Bridge lanterns at dusk | Waterfall at night |
|---|---|---|---|
| ![Meandering stream with pebbly banks](documentation/poc-3d-navigation/screenshots/landscape-river.png) | ![Leaves and a wind swirl blowing across the plaza](documentation/poc-3d-navigation/screenshots/wind-gust.png) | ![Bridge with glowing lanterns at dusk](documentation/poc-3d-navigation/screenshots/daynight-dusk-bridge.png) | ![Waterfall and stream at night](documentation/poc-3d-navigation/screenshots/daynight-night-waterfall.png) |

| Two-tier mesa: the upper tier sits inside a lower terrace, the lawn rolls over both rims, and the trees stand clear of the walls |
|---|
| ![Two-tier mesa with a lower terrace all the way round, trees on both levels clear of the cliff walls](documentation/poc-3d-navigation/screenshots/landscape-mesa-tiers.png) |

**Hand-painted textures.** The lawn, paths, cobbles, beach, riverbed, cliff strata, boulders, river caustics, leaf cards, conifer clumps and boughs, grass clumps, the moon, the compass-rose plaza and the buildings' materials (plank grain, roof shingles, brick, stone, plaster, metal and canvas) and the tree bark all use original, seamless or alpha textures generated with GPT Image 2.5, in the game's own palette. The landing page and social card use a painted key art of the planet.

| Painted compass-rose plaza, ground, cobbles and grass | Leaf-card trees | Cliff strata, boulders and caustics |
|---|---|---|
| ![Spawn plaza with the painted compass-rose decal and painted ground textures](documentation/poc-3d-navigation/screenshots/textures-spawn.png) | ![Hardwood trees with painted leaf clusters on low-poly trunks with painted bark and buttress roots](documentation/poc-3d-navigation/screenshots/textures-forest.png) | ![Waterfall mesa with painted strata, boulders and river](documentation/poc-3d-navigation/screenshots/textures-waterfall.png) |

| Organic cedars: grouped painted clumps and boughs | Painted moon at night | Landing page key art |
|---|---|---|
| ![Cedar trees built from grouped painted conifer clumps and drooping boughs](documentation/poc-3d-navigation/screenshots/textures-cedars.png) | ![Night sky with the painted moon](documentation/poc-3d-navigation/screenshots/textures-night-moon.png) | ![Landing page with the painted planet poster](documentation/poc-3d-navigation/screenshots/landing.png) |

| Per-surface materials: shingled roof, planked walls and doors, brick chimney, stone steps, timber bridge |
|---|
| ![Workshop with shingled roof, wooden siding and doors, brick chimney and stone steps, next to the timber bridge](documentation/poc-3d-navigation/screenshots/textures-surfaces.png) |

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
| `npm test` | Vitest unit tests (sphere math, collision, proximity, URL, gate, content validation, route test, day–night, compass, terrain, wind, texture manifest, sound) |
| `npm run e2e` | Playwright E2E + axe (builds the test bundle, headless Chromium with SwiftShader) |
| `npm run size` | Bundle budget report for the current `dist/` |
| `npm run verify:prod` | Production build + budgets + checks the test hook is absent |
| `npm run perf:audit` | Load, frame and scene stats against a running dev or test server, on the real GPU (`-- --cpu 4` throttles the CPU, `-- --swiftshader` uses software rendering). See the [performance audit](documentation/poc-3d-navigation/performance-audit.md) |
| `npm run build:portraits` | Render the character-picker portraits (`public/avatars/*.webp`) from the built GLBs in headless Chromium. Run after `build:character` |
| `npm run build:character` | Rebuild `public/models/character.glb` (Skater) and `character-female.glb` (Sunny, with her ponytail) from the Kenney FBX files. Needs FBX2glTF once: `npm install --prefix "%TEMP%\fbxconv" fbx2gltf@0.9.7`. Pass a skin name to swap outfits, e.g. `node scripts/build-character.mjs skaterFemaleA` |
| `python scripts/build-audio.py` | Rebuild the sound effects (`public/audio/*.mp3`) and `src/game/audio/audioManifest.ts` from their CC0 sources (downloaded to a git-ignored cache), and print a check of every output. Needs Python 3.10+ with numpy and scipy, and ffmpeg on PATH. The outputs are committed |
| `python scripts/build-music.py` | Rebuild the background music (`public/audio/music-*.mp3`) and `src/game/audio/musicManifest.ts` from `assets-src/audio/music/`: two-pass loudness normalisation to −16 LUFS / −1.5 dBTP, 96 kbps stereo MP3. Needs Python 3.10+ and ffmpeg on PATH. The outputs are committed |
| `python scripts/gen-icons.py golden\|slice\|icon <id>\|all\|build` | The item icons: the golden style set, generation of each icon image-to-image against it (GPT Image 2.5 via the `gpt-image-2-5` skill), and the build to `public/icons/*.webp` + `src/game/inventory/iconManifest.ts` + a contact sheet. Needs Python 3.10+ with Pillow and numpy. The outputs are committed |
| `python scripts/build-textures.py` | Rebuild `public/textures/*.webp`, the landing poster, the social card and `src/game/world/textureManifest.ts` from the generated sources in `assets-src/textures/`. Needs Python 3.10+ with Pillow and numpy. The outputs are committed |

First-time E2E setup: `npx playwright install chromium`. To use the installed Edge instead, set `PW_CHANNEL=msedge`.

## Controls

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Move | W A S D / arrow keys (screen-relative) | Click/tap the ground to walk there |
| Run | Hold Shift | — |
| Open a nearby place | E, Enter or Space | "Open" on the preview card |
| Shake a tree, mine a boulder, pick a flower, open the chest | Walk up to it, then E | The prompt's button |
| Hotbar & backpack | 1–9 select, Q / Ctrl+Q drop one / all, I opens the backpack; in a screen: click, right-click, Shift+click, double-click, drag, 1–9, Q (as in Minecraft), or arrows + Enter / Space / Shift+Enter | Mouse wheel; click a slot; the backpack button; tap / long-press |
| Sit on the plaza bench / stand up | By the bench, E sits; Esc, E or a movement key stands up | **Sit on the bench** / **Stand up** prompt |
| Whistle for Chopper / meet him | F whistles (he comes running); facing him close by, E opens his card, Esc closes it | The dog button by the backpack; **Meet Chopper** prompt |
| Travel directly | M (menu), then pick a place, or Tab to the hidden "Travel to a place" list | Click a building, or use Menu |
| Rotate the view | Hold `,` / `.` | Drag left/right, or ⟲ / ⟳ by the compass |
| Tilt the view | Hold Page Up / Page Down | Drag up/down, or ˄ / ˅ by the compass |
| Face north | N | Click the compass |
| Reset position & direction (back to the plaza, facing north) | H or Home | **Reset** under the compass |
| Close / back | Esc, or the browser Back button | Close button / backdrop |
| Change the time of day | Tab to the header time, then ← → (15 min) or Page Up/Down (1 h) | Drag the header time left/right (the pointer hides while you drag), or click its right/left half for ±1 h |
| Classic site | Skip link (first Tab stop), or the header **Classic site** button | Header button |

Game keys only work while the planet has focus, and Tab is never captured. A short tap on the ground walks there; a drag turns and tilts the view instead.

## How it works

- **Movement: rotate the planet, not the player** (spec §5.2). The character stays still at the top of the planet and input rotates the planet underneath. The camera is fixed, with no pole flips.
  - Collision is kinematic (no physics engine): circles on the sphere, sliding, sub-stepping, and a push-out that doesn't twist the planet.
  - Code: [src/game/math/sphere.ts](src/game/math/sphere.ts), [src/game/systems/movement.ts](src/game/systems/movement.ts).
- **Proximity:** one global "nearby" landmark, with hysteresis, a switch margin and a 150 ms interact buffer ([src/game/systems/proximity.ts](src/game/systems/proximity.ts)).
- **View controls & compass** ([ViewControls.tsx](src/game/ui/ViewControls.tsx), [compass.ts](src/game/math/compass.ts)):
  - Rotating the view spins the planet about the player's vertical axis (`PlanetSim.rotateView`), and tilting changes the camera pitch (30°–78°).
  - The compass shows *map north* from a stereographic grid centred on the plaza, which sits on the pole where true north is undefined. At the plaza it points toward the Workshop.
  - Reset flies back to the plaza facing north. Reset and fast travel share one fly-over (`flyoverProfile` in [movement.ts](src/game/systems/movement.ts)): the character hops up to 5.5 u (above the tallest tree and the Lighthouse), the planet turns only once it's up there, and over the destination it drops back to the ground, landing with a hop. Its cast shadow stays on the ground.
- **Content:** a single source of truth in [src/content/landmarks/](src/content/landmarks/).
  - Frontmatter drives the game (placement and dialog copy); the Markdown body drives the classic page.
  - Cross-entry validation runs at build time ([src/game/math/landmarks.ts](src/game/math/landmarks.ts)).
- **Capability-gated loading** (spec §5.9):
  - `/play/` runs a 2.6 KB gate ([src/game/platform/gate.ts](src/game/platform/gate.ts)) that checks WebGL2, software rendering and Data Saver.
  - Only if the check passes does it `import()` the game bundle ([src/game/game-mount.tsx](src/game/game-mount.tsx)).
  - Unsupported devices get the classic site and never download 3D code.
- **UI:** everything you can act on is semantic DOM (`<dialog>`, buttons, links), in [src/game/ui/](src/game/ui/). There's a parallel landmark list and an `aria-live` region for announcements. All rules live in [src/game/controller.ts](src/game/controller.ts).
- **Art:** original procedural models in a soft, bevelled "cozy life-sim" style (spec §4.12). A geometry kit merges vertex-coloured primitives into about 3 draw calls per model ([src/game/world/kit.ts](src/game/world/kit.ts), [parts.ts](src/game/world/parts.ts), [models.ts](src/game/world/models.ts), [propModels.ts](src/game/world/propModels.ts)). Trees and bushes use overlapping alpha-tested leaf cards over a dark canopy volume ([foliage.ts](src/game/world/foliage.ts)). The ground is a procedural shader layered with painted tiles ([planetMaterial.ts](src/game/world/planetMaterial.ts)).
- **Performance** ([audit](documentation/poc-3d-navigation/performance-audit.md)):
  - Every shader compiles in parallel before the first frame, behind the loading screen, so the page never freezes on load. Textures decode off the main thread.
  - Kit models are indexed exactly: identical vertices are shared, which cuts 59 % of the vertices and changes nothing on screen.
  - The canvas has no MSAA of its own, because the composer already multisamples the scene.
  - Time to playable: 1.5 s (was 2.9 s). `npm run perf:audit` measures load, frame and scene stats.
- **Collecting & inventory** ([collection-inventory.md](documentation/poc-3d-navigation/collection-inventory.md)): walk up to a tree and press E and the character grabs the trunk and shakes it. Every fruit on a fruit tree falls (it grows back later), plus a log and a couple of leaves. At a boulder, a pickaxe pops into the character's hand and three swings chip off three stones. Flowers are picked with a squat. Whatever falls lies on the ground as a small bobbing 3D item until you walk near, then it's pulled to you and lands in the **Minecraft-style hotbar** at the bottom. The **chest by the Workshop** opens with the same slot screen, and every Minecraft slot control works (Shift+click, right-click half, drag to spread, double-click, 1–9, Q), plus keyboard-only and touch equivalents. The backpack and chest are saved. The pure rules are in [inventory.ts](src/game/inventory/inventory.ts), [dropSim.ts](src/game/world/dropSim.ts), [interactables.ts](src/game/systems/interactables.ts) and [actions.ts](src/game/systems/actions.ts); the new animations are hand-keyed poses in [actionPoses.ts](src/game/player/actionPoses.ts).
- **Item icons** ([assets-src/icons/](assets-src/icons/README.md)): 26 painted icons generated with GPT Image 2.5 against a frozen **golden style set** (four exemplars painted together in one call from the key art), so every icon shares one outline, light direction and brush. The seven colours of each flower are re-tinted from one white-petalled painting.
- **Bench:** the plaza bench is a classic park bench (cast-iron side frames under wooden slats, the back slats on the front of the reclined uprights; `bench()` in [parts.ts](src/game/world/parts.ts)). Walk up to it and a **Sit on the bench** prompt appears: E sits, and Esc (or E, or walking) stands up. [seating.ts](src/game/systems/seating.ts) decides when the seat is offered and slides the character onto the seat and back off it. [Player.tsx](src/game/player/Player.tsx) poses the rigged character over its idle clip: it re-aims the leg and arm bones in world space so the hips rest on the seat, the feet dangle and swing, and the hands rest on the knees.
- **Wildlife** ([animals.ts](src/game/world/animals.ts), [Wildlife.tsx](src/game/world/Wildlife.tsx)): rabbits hop and graze in the meadows, a duck leads her ducklings round the pond, koi school in the pond and trout hold station facing upstream in the stream, and birds peck on the ground or fly as a flock. They use the standard game-AI recipe of steering behaviours and boids (Reynolds), with a small state machine per species tuned to how the real animals behave. Come close and they react as the real ones would: a rabbit freezes upright, then bolts in zigzag hops; the duck swims off with the brood hurrying behind; fish dart away; ground birds take off. Birds roost at night.
- **Chopper** ([chopper.md](documentation/poc-3d-navigation/chopper.md), spec §4.18): the companion dog. His mind is a small **utility AI** in [brain.ts](src/game/world/chopper/brain.ts): each behaviour (follow, idle, wander, sniff, chase a rabbit, scent trail, run ahead, play bow, answer the whistle, heel) scores itself from the situation and his moods, and he commits to the winner for a while, with cooldowns, so he's busy without dithering. His body is one skinned mesh of envelope-weighted blobs ([model.ts](src/game/world/chopper/model.ts)) under a **shell-fur** shader ([fur.ts](src/game/world/chopper/fur.ts)): the coat is drawn as stacked, alpha-tested shells in the same draw call, combed the way a Lhasa's coat falls, with a generated curly-fur tile for the locks. [anim.ts](src/game/world/chopper/anim.ts) animates him procedurally: walk, trot and gallop from per-leg phase offsets with IK paws, pose clips eased on springs, and bouncy ears and tail. Rabbits and ground birds shy away from him as from the character. His card ([ChopperCard.tsx](src/game/ui/ChopperCard.tsx)) makes its own small canvas only while open; its text is in [profile.ts](src/game/world/chopper/profile.ts) and holds only what the owner has said about him.
- **Doors & interiors** (spec §4.12): buildings with a door have hollow walls with the doorway cut out, and `door()` builds each leaf on its own so [Landmark.tsx](src/game/world/Landmark.tsx) can swing it about its hinge while you're nearby ([doors.ts](src/game/world/doors.ts) holds the pure motion and the Amphitheater's festoon-curtain shape). The rooms in [interiors.ts](src/game/world/interiors.ts) draw only while a door is open. After dusk one shared warm point light sits inside the open doorway, and a spot lamp lights the steps and path in front of it.
- **Sound** (spec §4.16): [engine.ts](src/game/audio/engine.ts) plays two ambience loops (wind, stream) and sprites (birds, footsteps, cues) with Web Audio, unlocked by the Start click. The pure rules in [audioLogic.ts](src/game/audio/audioLogic.ts) pick the footstep surface, the stream level by distance, the wind mix and the bird timing. The controller triggers the door cues from the store and ducks the ambience under dialogs. The rigged character's feet land at phases measured from its run clip. Background music streams from an `<audio>` element through its own gain (so a track is never decoded whole), at a subtle 0.2 of the master, alternating the two tracks.
- **Icons:** every icon is a Font Awesome Free solid icon drawn inline by [Icon.tsx](src/game/ui/Icon.tsx) (no icon font, no emojis), so only the icons used are bundled.
- **Player character:** the CC0 Kenney "Animated Characters: Protagonists" model ([Player.tsx](src/game/player/Player.tsx)). It is scaled to 1.25 u, and its idle and run clips are blended by speed with the stride matched to movement. It hops as a fast travel or Reset takes off and again when it lands. The procedural avatar ([Character.tsx](src/game/player/Character.tsx)) stands in while the model loads or if it fails. Credits are in [assets-src/CREDITS.md](assets-src/CREDITS.md).
- **Occlusion outline:** when a building, tree or rock stands between the camera and the character, its silhouette shows through as a cream rim over a faint dark fill ([outline.ts](src/game/player/outline.ts)). Each character mesh has a twin sharing its geometry and skeleton, drawn with an inverted depth test (`GreaterDepth`) after the scenery and before the character, so it never outlines the character through itself and costs no extra pass.
- **Day–night cycle** (spec §4.13):
  - The pure model in [timeOfDay.ts](src/game/world/timeOfDay.ts) keyframes the sky, fog, light and cloud palettes and computes the sun/moon arcs and cycle speed.
  - The clouds are painted sprites in the art direction's style ([Sky.tsx](src/game/world/Sky.tsx)): four generated cumulus paintings with true alpha and a derived normal map, so the sun and moon light their puffs (gold rims at dusk, lilac under the moon). They're one instanced draw of 54 quads, cheaper than the 3D puffs they replaced, which remain the fallback. They orbit the planet ([clouds.ts](src/game/world/clouds.ts)): rings concentric with the planet's outline as the camera sees it, rebuilt from the camera each frame, drifting clockwise over the top from left to right. An outer, sparser ring fills the sides of wide windows.
  - The rig in [DayNight.tsx](src/game/world/DayNight.tsx) drives the lights (so shadows move through the day), the sky texture, the sun, moon and stars, and the night extras: glowing lamps and windows, lamp light pools, the bridge's working lanterns (real warm point lights on the deck and anyone crossing, in [Landforms.tsx](src/game/world/Landforms.tsx)), fireflies and a brighter lighthouse beam.
  - In cycle mode the clock stops under Reduce motion or Pause ambient motion.
- **Landscape** (spec §4.14):
  - The pure height model [terrain.ts](src/game/world/terrain.ts) (`Terrain.height` / `walkHeight`) displaces the ground mesh, places every prop and lifts the character and camera. Collision stays 2D on the sphere, so the cliff walls and the bridge rails are ordinary obstacle circles. The stream and pond are **wadeable**: `waterDepth` lowers the character onto the bed (at most knee-deep), slows them down, and [WadeFx.tsx](src/game/world/WadeFx.tsx) adds a foam collar and wake rings.
  - [features.ts](src/game/world/features.ts) defines the river spline, the mesas and where bridges go.
  - [Landforms.tsx](src/game/world/Landforms.tsx) builds the cliffs (geometry in [cliffs.ts](src/game/world/cliffs.ts); each mesa's grassy cap is merged into the ground mesh, so its top is the same lawn as the land around it), the flowing water (one shader shared by the stream, the waterfall and a still-water pond variant; the stream cross-fades into the pond) and the bridge. [pond.ts](src/game/world/pond.ts) gives the pond its lobed shoreline and bowl, and [pondPlants.ts](src/game/world/pondPlants.ts) places its plants.
  - The ground shader ([planetMaterial.ts](src/game/world/planetMaterial.ts)) paints the lawn's soft mottling, clover, path edges, mossy cobbles, river banks and rock strata.
- **Lamplight** (spec §4.13): the plaza lamps, an open door and the stage spot are real lights in the surfaces' own shading ([lampLights.ts](src/game/world/lampLights.ts)). Each adds irradiance × albedo with windowed inverse-square falloff, N·L and optional spot cones, so the painted bricks and grass light up rather than being washed by an additive overlay. They share one small, range-tested light list, which is empty by day.
- **Wind** (spec §4.14): the pure model [windField.ts](src/game/world/windField.ts) (direction plus breathing gusts) feeds one set of shared shader uniforms. All the foliage sways and flutters on the GPU, and its shadows move with it ([Props.tsx](src/game/world/Props.tsx) `addSway`). [WindFx.tsx](src/game/world/WindFx.tsx) adds instanced flying leaves and a small pool of swirl ribbons. Everything stops under Reduce motion or Pause ambient motion.
- **Hand-painted textures** (spec §4.15):
  - The sources are original GPT Image 2.5 generations; each prompt is kept next to its source in [assets-src/textures/](assets-src/textures/). [build-textures.py](scripts/build-textures.py) turns them into about 1.1 MB of WebP plus a typed manifest.
  - [textures.ts](src/game/world/textures.ts) preloads them before the first render. Anything that fails falls back to the procedural look.
  - Ground tiles are sampled triplanar in planet-local space and normalised by their mean colour, so the palette and lighting don't change.
  - Cliff walls are UV-mapped so the strata stay horizontal, and boulders, rocks and pebbles get their own painted granite tile plus moss grown in the shader on their upward faces ([rockDetail.ts](src/game/world/rockDetail.ts)); their chiselled shapes come from [propModels.ts](src/game/world/propModels.ts).
  - Tree trunks are low-poly tubes whose polygons follow the stem and buttress roots (about 240 triangles per hardwood); a painted bark tile, wrapped round each tube along the grain, fakes the ridges and knots ([foliage.ts](src/game/world/foliage.ts)).
  - The leaf, conifer and grass sprites are tintable greyscale with real alpha. Cedars use a 2×2 atlas of four painted conifer sprites in grouped, irregular tiers, with three variants. The pond plants come from a full-colour 2×2 `pond-atlas` (lilies, reeds, irises, fern).
  - Buildings, the bridge and the plaza furniture have per-surface materials: each kit part is tagged `wood`, `roof`, `plaster`, `stone`, `brick`, `metal` or `canvas` and gets its own painted detail (luminance only, so the palette is kept) on box-projected UVs, with wood grain along each board. Plain painted trims keep a subtle brush grain.
  - The spawn plaza is a painted decal (brick rings and a compass rose that points to map north), feathered into the lawn.
- **Quality tiers:**
  - `high`: tilt-shift, bloom, vignette and neutral tone mapping, plus 2048² shadows.
  - Both tiers keep the frame in linear HDR and tone-map it once at the end. The tilt-shift replaces the image (NORMAL blend; the wrapper's default ADD doubled the exposure and blew out the highlights). Exposure comes from `sceneExposure` in [timeOfDay.ts](src/game/world/timeOfDay.ts): 1.3 by day, opening up to 1.7 at night.
  - `low`: a cheaper tilt-shift, no bloom or vignette, and 1024² shadows. Chosen automatically for software rendering, Data Saver or coarse pointers.
  - Adaptive quality never removes the tilt-shift. After a 10 s warm-up (counted from when the planet is playable, so loading never counts) it lowers resolution, then drops bloom and vignette, and steps back up when the frame rate recovers.
  - Everything on the planet is always drawn (no culling), so nothing pops into view.
  - In dev and test builds, `?quality=high|low` forces a tier.
- **Stack (exact pins):** Astro 7.3.3, React 19.2.8, three 0.186.0 (WebGLRenderer), @react-three/fiber 9.7.0, @react-three/drei 10.7.8, @react-three/postprocessing 3.1.1 + postprocessing 6.39.5, zustand 5.0.15.

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
| Dialog: E opens, Esc/Back closes, URL `?at=&open=1`, focus returns to whatever opened it | E2E: "proximity preview, open with E…", "preview-card Open returns focus…", "deep link opens the dialog…" |
| Deep links, invalid `?at=` → Plaza + status message | E2E: "deep link opens the dialog…", "invalid deep link falls back…" |
| Context-preserving classic switch, and back via Explore in 3D | E2E: "context-preserving switch to classic…" |
| Fast travel (menu, parallel nav), reduced-motion fade; the fly-over rises before the planet turns, glides at 5.5 u and drops only once it has arrived (Reset too) | `tests/unit/movement.test.ts`, E2E: "fast travel from the menu…", "reduced motion makes fast travel a short fade", "parallel landmark nav…", "the Reset button flies the character back…" |
| Gate: no WebGL2 → fallback with **zero game-bundle requests**; bundle load error → Retry/Classic; `?mode=classic` redirect + saved preference; context lost → Reload/Classic | E2E: "capability gate" group, "?mode=classic redirects…", "WebGL context loss…" |
| Game keys ignored when HUD focused; Start button doesn't steal focus | E2E: "start button, then WASD moves the player…" |
| axe: no serious/critical issues on landing, classic, fallback, dialog, menu | E2E: landing, classic, no-WebGL2, dialog and menu tests (axe scans) |
| Budgets: landing 0 KB 3D JS; gate 2.9 KB gz; game 447 KB gz initial (≤ 450, incl. the tree-shaken Font Awesome icons, the inventory and Chopper's mind) plus ≈ 13 KB on demand (Chopper's body, loaded alongside the textures, and his card; ≤ 40 KB, waiver proposed in plan §6); character model 163 KB; sound effects ≈ 750 KB (7 MP3s, fetched only after Start with sound on, ≤ 800 KB); Chopper's photos 47 + 39 KB (fetched when his card opens); music 2.2 + 2.6 MB (≤ 3 MB per track, streamed only after Start with sound and music on); item icons ≈ 78 KB (26 × 96 px WebP, fetched only when shown); generated textures ≈ 1.28 MB (28 WebP, incl. Chopper's fur tile; ≤ 1.5 MB); landing poster 104 KB (mobile) / 194 KB (desktop); no `__game` in production | `npm run verify:prod`, `tests/unit/textures.test.ts` |
| Lighthouse beam: 10 u long (was 3.4), brightest at the lamp and dissolving smoothly to nothing at its far end (no step, zero slope at the end), the shader fading with the same curve | `tests/unit/beam.test.ts` |
| Load and memory: every shader compiles before the first draw, time to playable 1.5 s (was 2.9 s; 4.0 s with 4× CPU throttling, was 8.7 s), heap 43 MB (was 93 MB), 57 programs (was 82); kit geometry indexed losslessly (bit-identical triangles, 0.49 M vertices instead of 1.19 M); the terrain's fast bounds match the full evaluation; the capability probe needs one context on a capable device; seven reference views are pixel-identical before and after; no shader can output NaN (every GLSL `pow()` has a clamped base, so the bloom can't black out the screen, which happened behind the Town Hall because of the lighthouse beam), and a real-GPU scan finds 0 Inf/NaN pixels | `tests/unit/indexing.test.ts`, `tests/unit/terrain.test.ts` ("fast bounds"), `tests/unit/url-capabilities.test.ts` ("capability probe"), `tests/unit/shaders.test.ts`, `npm run perf:audit`, [performance audit](documentation/poc-3d-navigation/performance-audit.md) |
| Render stats (all passes, everything always drawn): ≈ 96–106 draw calls / ≈ 650–670 k triangles on `high`, plus ≈ 9 calls for the swinging door leaves; after the art-direction pass ≈ 142 calls / ≈ 727 k at spawn (flowers and sprigs +95 k, painted clouds −48 k); with wildlife, the fruit meshes and the chest ≈ 161 calls / ≈ 746 k at spawn; with Chopper (12 fur shells, a base-only shadow caster) ≈ 164 calls / ≈ 823 k at spawn (60 fps on the reference GPU). **This exceeds the original 60 / 100 k target; a waiver is proposed in the plan's §6 and needs owner sign-off.** | `window.__game.renderInfo()` |
| Exposure and dynamic range: the tilt-shift replaces the image (NORMAL blend) on both tiers, the frame is tone-mapped once, day exposure 1.3 opens smoothly to 1.7 at night, and under 6 % of a midday frame clips to white (was ≈ 40 % when the tilt-shift was additive) | `tests/unit/timeOfDay.test.ts` ("scene exposure"), E2E "the tilt-shift replaces the image…", "the low quality tier still has the tilt-shift" |
| Textures: all 27 generated textures load (HTTP 200) before the planet appears, with no fallback. Every manifest entry is a power-of-two WebP (square, except the 2:1 cloud atlases) that matches its recorded size; sprites have real alpha; tiles export a mean colour; each kit surface has a detail mask with its mean; each source has its prompt. The total stays within budget (≈ 1.1 MB of 1.5 MB). Tree trunks stay within their triangle budget, wrap the bark tile without a seam, face outwards at the roots and are smooth-shaded. The landing key art loads with fixed dimensions, and the social card is served | `tests/unit/textures.test.ts`, `tests/unit/surfaces.test.ts`, `tests/unit/trunks.test.ts`, E2E "hand-painted textures all load…", "landing ships no game JS…" |
| Player character: rigged CC0 model loads (`character.glb` 200); procedural fallback when the model fails, still playable. Two characters with unique ids, models and portraits; both share the rig and clips; Sunny's ponytail is parented to the Head bone. In the browser: the picker has two radios, the Skater selected by default with the thick ring; choosing Sunny loads `character-female.glb`, she walks, and the choice survives a reload; arrow keys switch back; no serious axe issues; both avatars carry the occlusion outline, which shows through the Library's roof when the character stands behind it and changes nothing in the open | `tests/unit/characters.test.ts`, `tests/unit/outline.test.ts`, E2E: "player character" group |
| Collecting & inventory: backpack 36 (hotbar 9) and chest 27 slots, stacks of 64; pick-ups fill Minecraft-style (top up stacks, hotbar first); every screen control (click, right-click half/one, Shift+click both ways with chest → hotbar from the right, double-click gather, left/right-drag spread, 1–9 swap, Q / Ctrl+Q, close returns the cursor stack or drops the overflow); saved and validated. Drops fall, bounce, rest and merge; nothing is picked up before its delay (0.5 s, thrown 2 s); a nearby drop flies in and lands in the backpack; a full backpack leaves it on the ground. Targets: the one you face wins, with hysteresis; a flower needs you close near a landmark; every action is the same fixed cycle; you step in to a trunk and back out clear of it; the pickaxe is out for the whole mining cycle; fruit and flowers regrow. The chest stands by the Workshop, clear of every obstacle. In the browser: shaking an apple tree gives 6 apples, a log and 2 leaves in the hotbar (with icons); a second shake gives no fruit; mining gives 3 stones; picking gives that flower; the chest screen passes axe, Shift+click moves stacks both ways, right-click takes half, Escape returns it; I opens the backpack; 9 selects slot 9; Q throws one ahead; the inventory survives a reload | `tests/unit/inventory.test.ts`, `tests/unit/drops.test.ts`, `tests/unit/interactables.test.ts`, E2E "collecting & inventory" |
| Bench: the seat is offered in front of or beside the bench (not behind, not far away, with hysteresis); sitting slides smoothly onto the seat and the pose eases to 1; standing up (also from halfway down) ends in front of the bench, clear of every collision circle, and walking works again; everything snaps under reduced motion and fast travel drops the seat. In the browser: the prompt appears by the bench, E sits, Escape stands up without opening the menu, the prompt's button sits and hands focus back to the planet, and a movement key stands up and walks off | `tests/unit/seating.test.ts`, E2E "benches" |
| Wildlife: every species is there; rabbits stay on dry, open ground about their patch, freeze upright when the character is near and bolt away when it's close; the duck stays in the pond with the ducklings trailing in a line and swims off from the character; fish never leave the water, stream fish face upstream, and all dart from a close character; ground birds take off when approached, fly within their altitude band and land again away from the character; birds roost at night. In the browser: a rabbit flees, a pecking bird takes off and the duck swims off when the character walks up | `tests/unit/animals.test.ts`, E2E "wildlife" |
| Chopper: his skin weights sum to 1 on at most four of his own part's bones; the geometry is his parts once plus the furry parts per shell, within the triangle budget; walk, trot and gallop use the textbook footfalls and blend by speed; a planted paw sweeps back at exactly body speed and lifts in swing; the two-bone IK reaches its target with elbows bending back and knees forward; every clip poses without NaNs; idles never repeat back to back and he rests more when tired; he stays within the leash, clear of the pond and never under the character's feet, and does a variety of things; he gallops back when you're far, answers the whistle and heels, sits waiting after running ahead, warps to you after a fast travel, chases a rabbit without catching it and barks after it, lays scent trails clear of obstacles and water, and doesn't dither; rabbits flee from him. In the browser: he's beside you at the start and stays near through a minute of play; F (and the dog button) brings him and plays the whistle; facing him, **Meet Chopper** opens his card with his photo and its alt text, the second photo, and the 3D canvas; it passes axe; Escape closes it, not the menu, and the canvas is released. On a real GPU: close-ups of him standing, sitting, lying, scratching and play-bowing, his gallop, and his card; 0 NaN pixels | `tests/unit/chopper.test.ts`, E2E "Chopper", session renders |
| Doors: every house has swinging leaves, a room behind them, a light and a spill; with the leaves away the doorway sees deep into the building; shut, the leaves close it; open, they swing inside and clear it; openness takes 0.55 s, never overshoots and snaps under reduced motion; the Amphitheater curtain reaches the floor when shut and rises into scallops when open. In the browser: all doors start shut, the Workshop opens on arrival (no light by day), lamplight comes on at night, it shuts when you travel on while the Amphitheater's curtain rises and the light follows, and everything shuts when you leave | `tests/unit/doors.test.ts`, E2E "doors" |
| Sound: the seven MP3s exist, total < 800 KB, loops sit inside their files with padding, sprite slots are ordered, never overlap and fit; every sound the game asks for exists, with ≥ 4 variations for steps and birds; variations never repeat back to back; the stream fades with distance and is silent across the planet; wind gets louder and brighter with gusts; birds only by day, every 5–16 s; foot-contact phases; footstep surfaces (stone at the plaza, landmarks and paths, wood on the bridge, water when wading, grass elsewhere); cues are logged but not played until unlocked. In the browser: no audio before Start; after it the context runs and all seven load; walking plays stone steps; wind always, birds by day, the stream loud on its bank; arriving plays the chime + door, moving on plays the door closing and the curtain; opening a place plays the sparkle; the toggle suspends audio, is remembered, and a muted visit loads no audio at all; background music: each track ≤ 3 MB, starts only on unlock with sound and music on, pauses when muted or turned off; in the browser it plays after Start, and the Menu's *Background music* checkbox stops it and is remembered | `tests/unit/audio.test.ts`, E2E "sound" |
| Icons: Font Awesome Free solid icons (inline SVG via `ui/Icon.tsx`) for the time badge sun/moon, the Sound toggle, external links and the view controls; no emojis or text symbols as icons | E2E "day–night" (badge shows `[data-icon="moon"]`), `npm run check` |
| Day–night: continuous palette (incl. midnight wrap), sun↔moon handover at zero intensity, cycle timing; clock runs, night lights the lamps, badge shows the moon; the bridge lanterns are dark by day, light up (real lights) at night and go out again in the morning; "Always daytime" holds the day and is remembered; Pause ambient motion freezes the clock; dragging the header time winds the clock (↔ cursor on hover, pointer hidden while dragging, world follows at once, the cycle carries on afterwards without changing the saved mode), and its arrow keys, Page Up/Down and half-clicks step it; the Town Hall clock's hands show the device's local time (and follow it when it changes); the clouds orbit the planet on rings concentric with its outline (at any tilt and mid fly-over), drifting clockwise with no wrap or jump, never covering the planet, in front of the sun and moon, and filling a 16:9 view and the far sides of a 32:9 ultrawide; after dusk the plaza lamps, an open door and the stage spot light the surfaces in their own shading (none by day) | `tests/unit/timeOfDay.test.ts`, `tests/unit/clock.test.ts`, `tests/unit/clouds.test.ts`, `tests/unit/lamps.test.ts`, E2E "day–night" group |
| View controls: map north is a smooth unit tangent (Workshop north, Town Hall east, Library south, Post Office west of the plaza); rotating keeps the player in place and WASD screen-relative; rotate/compass buttons, tap-vs-drag, `,` `.` / PgUp PgDn / N / H keys, tilt limits, Reset back to the plaza facing north | `tests/unit/compass.test.ts`, E2E "view controls" group |
| Landscape & wind: the river runs from the waterfall cliff to the pond, stays clear of the plaza and every landmark, and crosses exactly one path (the Greenhouse path) under a bridge; the ground is flat at the plaza, landmark footprints and approaches, rolls mildly elsewhere, and the river bed sits below the water, which sits below the banks; the mesas are flat-topped and every cliff face faces outwards; the grassy caps face up, droop outwards over the rim and sit just above the ground; each upper tier leaves a lower terrace all the way round; tree crowns stay off the cliff walls and mesa-top trees stand on flat ground well inside their rim (clear of the tier wall); the bridge deck arches; mesas and boulders stay off the paths; the wind is tangent, breezy at the plaza and every landmark, and its gusts never exceed 1. The pond: its lobed shore relaxes to the nominal radius at the stream mouth; the bowl dips below the shared water level inside the shore and rises above it just outside; lilies float inside, ferns sit on the bank, nothing is placed in the mouth, and no other prop stands in the water. Wading: the stream and pond have depth (never more than knee-deep), dry hollows and bridges don't, deeper water is slower, and the character can walk straight across the stream and into the pond. In the browser: walking over the bridge lifts the character and still reaches the Greenhouse; you can wade straight across the stream (down onto the bed, slower, with a foam collar and ripples) and climb out on the far bank; gusts bring flying leaves and swirls, and Pause ambient motion hides them | `tests/unit/terrain.test.ts`, `tests/unit/cliffs.test.ts`, `tests/unit/wind.test.ts`, E2E "landscape & wind" group |
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
- [ ] P1/P2 backlog (M8): juice (squash, dust), follow-lead camera, visited state, `auto` activation experiment, run toggle, joystick, gamepad, zoom, "I'm stuck", quality setting, key remapping, preview deployment.

## Known issues

- Headless Chromium reports software rendering, so E2E tests click **Continue anyway** on the interstitial. That's expected, and it exercises the "offer" path.
- The React/Astro renderer chunk (`client.*.js`, 0.9 KB) is emitted even though no page uses an Astro React island. It is never requested.
- `/play` has no Astro React island, so in dev the gate installs React Fast Refresh's preamble itself (`installDevRefreshPreamble` in `gate.ts`). Without it, dev throws `$RefreshSig$ is not defined`. It is stripped from production builds.
- The console warning `THREE.Clock: This module has been deprecated` comes from @react-three/fiber 9.7 internals and is harmless.
- A browser tab that is hidden (for example a background tab, or the VS Code integrated browser while its pane isn't visible) pauses `requestAnimationFrame`, so the planet stays on "Loading…" until the tab is visible. This is expected browser behaviour.
- If the dev server shows `X is not defined` right after an edit, it probably caught a half-saved file. Re-save the file or restart `npm run dev`.
- `og:image` must be an absolute URL. Set `site` in `astro.config.mjs` when the site is deployed; until then the social-card URL is built from the request URL (e.g. localhost in dev).
- Windows file names are case-insensitive, so don't give two modules names that differ only in case (for example `daynight.ts` and `DayNight.tsx`). TypeScript reports an error, and Vite's dev cache may keep serving the old file until the dev server restarts.
