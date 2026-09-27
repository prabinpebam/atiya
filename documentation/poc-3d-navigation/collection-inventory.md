# Collection & inventory (as built)

Walk up to things, press **E**, and the planet gives you something: shake a tree, mine a boulder, pick a flower. What falls is pulled into your backpack as you walk by, and a **Minecraft-style hotbar** at the bottom of the screen shows what you carry. A **wooden chest** by the Workshop stores the overflow, with the same slot controls. Crafting comes later; the item model and slot rules here are built so it can plug in (see *Extending*).

This follows established patterns rather than inventing new ones:

- **Slots, stacks, the cursor stack and every shortcut:** Minecraft Java Edition ([Controls](https://minecraft.wiki/w/Controls), [Inventory](https://minecraft.wiki/w/Inventory)).
- **Shake a tree / pick a flower / stand at a thing and press one button:** Animal Crossing.
- **Pick-up "magnet":** the vacuum pick-up common to Stardew Valley, Terraria and Minecraft's own XP orbs.

## 1. Items

| Id | Name | Stack | Source |
|---|---|---|---|
| `log` | Wood log | 64 | Shaking any tree (1 per shake) |
| `leaves` | Leaves | 64 | Shaking any tree (2 per shake) |
| `apple`, `orange` | Apple, Orange | 64 | Shaking a fruit tree while its fruit is ripe (6 per shake; the fruit regrows in 90 s) |
| `stone` | Stone | 64 | Mining a boulder (1 per hit, 3 hits) |
| `tulip-<colour>`, `cosmos-<colour>`, `pansy-<colour>` | e.g. *Red tulip* | 64 | Picking a flower (the flower regrows in 60 s) |

Colours: red, pink, yellow, white, orange, purple, blue: the seven bloom colours the planet plants. That makes 26 items. Each has one icon (§6), and each colour is its own item, as in Minecraft and Animal Crossing, so stacks never mix colours.

The registry is `src/game/inventory/items.ts`: id, display name, max stack and icon key. A stack is `{ id, n }` with `1 ≤ n ≤ maxStack`; an empty slot is `null`.

## 2. Containers

| Container | Slots | Layout |
|---|---|---|
| **Backpack** | 36 | Slots 0–8 are the **hotbar** (always on screen), 9–35 the main inventory (3 rows of 9), exactly like Minecraft's player inventory |
| **Chest** | 27 | 3 rows of 9 (a Minecraft single chest) |

Both are saved in `localStorage` (`site.inventory`, versioned JSON; unknown ids and bad counts are dropped when loading), so a visit's haul is still there next time. The hotbar selection is saved too.

## 3. Collecting (the world side)

### 3.1 Targets and the action prompt

Standing near something you can use shows a single prompt at the bottom centre, above the hotbar, for example **Shake tree** <kbd>E</kbd>. The same prompt serves every target:

| Target | In range (from its centre) | Action | Cycle |
|---|---|---|---|
| Tree (hardwood, fruit, cedar) | trunk + 1.05 u | **Shake tree** | 1.7 s: grab the trunk, three shakes, let go |
| Boulder | its radius + 1.0 u (worked from a pickaxe's length away) | **Mine boulder** | 2.4 s: a pickaxe appears in the character's hand from a puff; three swings, one hit each; the pickaxe vanishes |
| Flower | 0.9 u | **Pick** *Red tulip* | 0.8 s: crouch, pluck, stand |
| Chest | 1.35 u | **Open chest** | the lid swings open and the chest screen opens |
| Bench | 1.45 u, front or ends | **Sit on the bench** | see the spec, §4.12 |
| Watering can (home chunk) | 0.8 u | **Pick up the watering can** / **Put the can back** | instant; see [family.md §6.2](./family.md#62-watering-the-garden) |
| Garden plant, holding the can | 0.8 u, from either long side of its bed | **Water the cabbage** / **Water the tomato plant** | 1.6 s: step up, tip the can, pour; no drops (nothing to collect) |

- **Choosing a target:** the prompt goes to the target you're **facing**, nearest first. The score is the distance past the target's edge, plus a penalty that grows with the angle off your heading. Targets behind you (more than 100° off) only count within arm's reach. A target keeps the prompt until you walk out of its range plus 0.25 u (hysteresis), so the prompt doesn't flicker between two flowers.
- **Priority:** landmarks preview from a wide area (the Workshop's covers the chest), so a thing you're **right at** wins. While a target has the prompt, E uses it and the landmark's preview card hides. Step away and the card returns. Near a landmark, a flower only takes E within 0.5 u, so walking up a flower-lined path to a door still shows the building's card.
- **Benches** are the exception to facing: they're offered by which side of the bench you're on (front or ends), since you stand up facing away from them.
- **Fixed cycles:** every activation plays the same timed cycle and yields the same things (the fruit only while ripe). You can't start another action mid-cycle, and movement is locked for its length, as in Animal Crossing. The character first steps to its working spot: at the trunk, at the boulder's face, or over the flower. It turns to face the target, then plays the cycle.
- **World feedback:** a shaken tree rocks on its base with a decaying wobble, and its fruit disappears until it regrows. A mined boulder shudders on each hit. A picked flower vanishes and grows back (scaling up) after 60 s.

### 3.2 Drops

What an action yields falls into the world as **drops**: small 3D items, as in Minecraft.

- **Spawning:** fruit falls from where it hung and leaves flutter down from the crown; the log tumbles from the lower crown, stones chip off the boulder's face towards you, and a picked flower pops up from the ground. Each drop starts with a small random outward and upward velocity.
- **Physics** (planet-local, radial gravity 9 u/s²): drops bounce (fruit and stone keep 30 % of their fall speed, logs 20 %, leaves don't bounce), skid to a stop with friction, then rest. Leaves fall slowly with air drag and a side-to-side flutter.
- **At rest** a drop bobs (±0.04 u) and spins slowly (Minecraft's idle item), so it reads as collectable.
- **Merging:** resting drops of the same item within 0.5 u merge into one drop of their combined count (Minecraft merges within 0.5 blocks). A drop shows up to 3 copies of its model for bigger counts.
- **Limit:** at most 160 drops exist; beyond that, the oldest resting drop is removed. Drops don't despawn otherwise.

### 3.3 Pick-up (the magnet)

- **Pick-up delay:** a new drop can't be picked up for 0.5 s (Minecraft's 10 ticks), and a thrown one (Q) for 2 s (Minecraft's 40 ticks). So a dropped item doesn't jump straight back.
- **Magnet:** once the delay is over, a drop within **1.6 u** of the character that fits in the backpack is attracted. It lifts off, accelerates towards the character's chest (up to 10 u/s) and shrinks away on arrival (0.12 s).
- **Collecting** adds the drop to the backpack, following Minecraft's rules for where it goes (§4.1), and plays a soft pop. If only part fits, the rest stays on the ground as a smaller drop.
- **Backpack full:** nothing is attracted. The first time it happens in a visit, a toast says *Backpack full*.

## 4. Inventory management

### 4.1 Where picked-up items go

Minecraft's `Inventory.add`:

1. Top up existing stacks of the same item that aren't full, hotbar first (0–8), then the main inventory (9–35).
2. Then take the first empty slot in the same order.

### 4.2 The hotbar (always on screen while playing)

| Input | Effect |
|---|---|
| <kbd>1</kbd>–<kbd>9</kbd> | Select that hotbar slot |
| Mouse wheel over the planet or the hotbar | Select the next / previous slot (wraps round) |
| Click a hotbar slot | Select it |
| <kbd>Q</kbd> | Drop one of the selected item: it's thrown 1.8 u ahead, with a 2 s pick-up delay |
| <kbd>Ctrl</kbd>+<kbd>Q</kbd> | Drop the selected slot's whole stack |
| <kbd>I</kbd> | Open the inventory (backpack) screen |

Changing the selection shows the item's name above the hotbar for 2 s, as Minecraft does. Screen readers hear it via the live region.

### 4.3 Inventory and chest screens

<kbd>I</kbd> (or the backpack button in the header) opens the **Backpack** screen: the main inventory (27) above the hotbar row (9). **Open chest** opens the **Chest** screen: the chest's 27 slots on top, then your backpack below. Only one screen is open at a time. While one is open the planet is paused for input (like the menu), and nothing else can be activated.

**Mouse (Minecraft Java):**

| Input | With nothing on the cursor | With a stack on the cursor |
|---|---|---|
| Left-click a slot | Pick up the whole stack | Put it all down; merge into the same item (the rest stays on the cursor); or swap with a different item |
| Right-click a slot | Pick up half (rounded up) | Put one down (empty slot or the same item); swap with a different item |
| <kbd>Shift</kbd>+click | Quick-move the stack to the other section (below) | The same (the cursor stack stays) |
| <kbd>Shift</kbd>+double-click | Quick-move **every stack of that item** from the clicked side: with a chest open, from the chest (or the whole backpack) to the other; in the backpack screen, gather them into the main inventory from its top-left (Minecraft Java) | — |
| <kbd>Shift</kbd>+drag across slots | Quick-move each slot passed over (Mouse Tweaks) | — |
| Double-click | — | Gather every stack of that item on screen onto the cursor, up to 64 (non-full stacks first) |
| Left-drag across slots | — | Spread the stack **evenly** over the slots dragged across (empty or the same item), at most one slot per item; the remainder stays on the cursor. While you drag, the slots show what they'll get and the cursor what's left |
| Right-drag across slots | — | Put **one** in each slot dragged across |
| Mouse wheel over a slot | Down: move one item to where Shift+click would send it; up: pull one of that item back into the slot (Mouse Tweaks) | — |
| Middle-click a slot, or <kbd>R</kbd> | **Sort** its section (below) | The same |
| <kbd>1</kbd>–<kbd>9</kbd> while hovering a slot | Swap that slot with hotbar slot N | — |
| <kbd>Q</kbd> / <kbd>Ctrl</kbd>+<kbd>Q</kbd> while hovering a slot | Drop one / the whole stack into the world | — |
| Click outside the panel | — | Left: throw the whole cursor stack; right: throw one |
| <kbd>Esc</kbd>, <kbd>E</kbd> or <kbd>I</kbd> | Close the screen | Close; the cursor stack goes back into the backpack (§4.1), and anything that doesn't fit is dropped at your feet |

Two Minecraft Java inputs have nothing to act on here: the planet has no off-hand (so no <kbd>F</kbd> swap) and no Creative mode (so no middle-click clone or middle-drag). The middle button sorts instead, as the Inventory Tweaks mod does.

**Organising** (not in vanilla Minecraft; the standard mods' and Terraria's shortcuts):

- **Sort** (a button on the chest and on the backpack, <kbd>R</kbd>, or middle-click): merges part stacks of the same item and lays them out from the first slot, in the item list's order (materials, crafted parts, flowers, paints). The hotbar keeps its order: sorting from it sorts the backpack above.
- **Take all** (chest screen): everything from the chest into the backpack, as Shift+click would place it.
- **Store all** (chest screen): everything in the backpack, the hotbar too, into the chest.
- **Store matching** (chest screen): only the items the chest already holds (Terraria's "quick stack").
- Each says what it did in the live region ("Stored 12 items in the chest."), or why nothing moved and what to do ("The chest is full: take something out first.").

**Quick-move (Shift+click) targets** (Minecraft's `quickMoveStack`):

- **Backpack screen:** hotbar → main inventory; main inventory → hotbar.
- **Chest screen:** backpack → chest; chest → backpack, filling the hotbar from its right-hand end first and then the main inventory from the bottom, as Minecraft does.
- Both passes top up same-item stacks first, then take empty slots. Whatever doesn't fit stays where it was.

**Keyboard only** (not in Minecraft, but needed for WCAG 2.1.1). The slot grid is one roving-tabindex grid:

| Key | Effect |
|---|---|
| Arrow keys | Move between slots (across the sections) |
| <kbd>Enter</kbd> | Left-click the focused slot |
| <kbd>Space</kbd> | Right-click the focused slot |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> | Quick-move |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> twice | Quick-move every stack of that item (as Shift+double-click) |
| <kbd>1</kbd>–<kbd>9</kbd>, <kbd>Q</kbd>, <kbd>Ctrl</kbd>+<kbd>Q</kbd>, <kbd>R</kbd> | As with the mouse, on the focused slot (or the hovered one) |
| <kbd>Tab</kbd> | Leaves the grid for the section tools (Sort, Take all, Store all, Store matching) |

- Each slot button's name reads, e.g., "Backpack slot 12: Apple, 5".
- The cursor stack is announced when it changes ("Holding Apple, 5").

**Touch** (Minecraft Pocket's gestures, plus drag-and-drop):

- **Tap** = left-click; **long-press** (450 ms) = right-click (half, or put one down).
- **Drag a stack** from one slot to another: it goes there (merging, or swapping, and what was there goes back where it came from).
- **Tap to pick up, then drag:** spread it evenly (the left-drag), with the same preview.
- **Long-press, then drag:** one in each slot (the right-drag).
- **Double-tap** with a stack held: gather.
- A **Move** toggle in the panel makes taps and drags quick-move instead (tap the same slot twice quickly: every stack of that item). The section tools grow to 44 px.
- The help line under the grid switches to these gestures on touch.

**Presentation:**
- **Slots:** square slots on a dark translucent panel, with an inset bevel, as in Minecraft. The count sits bottom-right in bold white with a dark drop shadow, and is hidden for 1.
- **Cursor and tooltip:** the cursor stack follows the pointer, and hovering a slot shows the item's name in a tooltip.
- **Selected hotbar slot:** a thick cream frame, slightly raised.
- **Layout:** the hotbar sits at the bottom centre, and the preview card, the action prompt and the seat prompt sit above it.
- **Reduced motion:** turns off the pop and slide animations.

## 5. Character actions (animation)

The Kenney character ships only idle, run and jump, and its rig's bone axes are arbitrary. So the new actions are **procedural**, like the sitting pose:

- **How it works:** keyframed poses in `player/actionPoses.ts` give target directions in the character's own frame (forward, up, left) for each limb and the spine, plus a hip drop. After the mixer runs, `aimBone` points each bone along its target, blended by the action's weight envelope (a short fade in and out, so an action blends out of idle or a walk).
- **Why not Mixamo:** Mixamo clips would need retargeting to this rig, need an Adobe login, and can't be redistributed as raw files (the spec's asset rules). A few hand-keyed poses read better at this camera distance anyway.
- **Shake:** reach both hands to the trunk, then three push-pull rocks with the body leaning into each.
- **Mine:** the pickaxe pops into the right hand (scale 0 → 1.15 → 1 with a small sparkle), then three overhead swings: wind-up behind the head, strike down at the boulder. The hit lands at the bottom of each swing. Then the pickaxe pops away.
- **Pick:** squat with the spine bent forward, reach down with the right hand, pluck, and stand.
- **Open:** lean in, both hands lift the lid.
- **Fallback avatar:** the procedural avatar swings its arms through the same beats.

## 6. Art: icons from a golden style set

Every icon is generated with GPT Image 2.5 by `scripts/gen-icons.py`, against a **frozen golden set**:

1. **The golden sheet:** four style exemplars (a toadstool, a wooden bucket, a crystal cluster and a clover), deliberately not game items, painted together in **one** call (image-to-image from the landing key art). One call makes them share one style.
2. **Golden references:** the sheet is sliced into `assets-src/icons/style/golden-1…4.png`. These are the only references ever used for icons; don't regenerate them without regenerating every icon.
3. **Items:** each item is generated image-to-image with all four golden references, a fixed style block and its own subject line. Only the subject changes between icons.
4. **Colour variants:** the 21 flower colours are *derived*, not generated. Each flower kind is painted with white petals, and `build` re-tints the petal pixels (light and nearly neutral), keeping their painted shading, as Minecraft does with tint layers. So all seven colours of a tulip share one drawing.
5. **Build:** `build` trims and centres each icon on a square, resizes it to 96 px WebP (for 40–48 px slots on 2× screens), snaps alpha, and writes `public/icons/*.webp`, `src/game/inventory/iconManifest.ts` and a contact sheet for review.

Icon readability rules, from game-UI practice:
- A distinct **silhouette** per item (a log lies sideways, the fruits are round but differ in stem and leaf, the stone is faceted, the tulip is a cup, the cosmos a star, the pansy a round face).
- A distinct dominant **colour** per item.
- One **light direction** (upper left) and one **outline** weight throughout.
- A 3/4 view.
- No text, and simplified detail that survives at 32 px.

## 7. Sound

The existing CC0 sprites, re-pitched in `audio/engine.ts`:

- **Pick-up:** a short bright pop, the sparkle at ×1.7.
- **Pickaxe hit:** a low stone knock, a stone footstep at ×0.75.
- **Shaken leaves:** a rustle, the cloth swish at ×1.25.

## 8. Code map

| File | What |
|---|---|
| `inventory/items.ts` | Item registry (names, stacks, icons, drop models) |
| `inventory/inventory.ts` | Containers, the cursor stack, picking up and taking out (pure; `tests/unit/inventory.test.ts`) |
| `inventory/screenOps.ts` | Everything the screen does to the slots: clicks, drags and their preview, Shift+double-click, the wheel, sorting and the chest shortcuts (pure; loads with the screen, not the game; `tests/unit/inventory.test.ts`) |
| `world/dropSim.ts`, `world/Drops.tsx` | Drop physics, merging, the magnet (pure; `tests/unit/drops.test.ts`), and their instanced models |
| `world/harvest.ts` | Fruit and flower regrowth |
| `systems/interactables.ts`, `systems/actions.ts` | Targets and prompt arbitration; the fixed cycles and their beats (`tests/unit/interactables.test.ts`) |
| `player/actionPoses.ts` | The hand-keyed action poses (the rigged character and the fallback avatar) |
| `world/Chest.tsx`, `layout.ts` (`chest`) | The chest model, its lid, and where it stands |
| `ui/Inventory.tsx` | The hotbar and the backpack / chest screens |
| `controller.ts` | Wiring: target selection, beats → drops, collecting, screens, the hotbar keys, saving |

Test hooks: `nearTarget(kind, which, u)`, `inventory()`, `giveItem(id, n)`, `drops()`, and `getState()`'s `target`, `acting` and `invScreen`. The E2E tests press real keys, then fast-forward the simulation with `pause()` / `advance()` / `resume()`, so they stay quick and deterministic under software rendering.

## 9. Extending

- **New item:** add it to `ITEMS` in `items.ts` and to `ITEMS` in `gen-icons.py`, then run `gen-icons.py icon <id>` and `build`.
- **New source:** add a target kind in `systems/interactables.ts` and a cycle in `systems/actions.ts`.
- **A target from a chunk** (the crafting table, the build site, the family, the watering can and the plants): the chunk pushes it onto `controller.targets` with its own `label`, `use`, `usable` and `icon`, so the main bundle needs no code for it. A chunk that plays a cycle calls `controller.startAction(kind, target)` and adds its pose to `controller.poses`; it reads cycles from `controller.cycles` rather than importing `systems/actions.ts` (a runtime import from a chunk re-splits the main bundle's shared chunks).
- **Crafting (later):** a recipe consumes stacks through the same container operations (`take`, `add`). A crafting grid is one more container on the screen, with Shift+click from its output.
