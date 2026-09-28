# Jumping, resting anywhere, the lantern and shooting stars (spec and plan: v1, critique, v2 as built)

> **TL;DR.** <kbd>Space</kbd> jumps when there's nothing to go back from: a short hop, on the way you were going. <kbd>X</kbd> sits on the grass and <kbd>Z</kbd> lies back on it, anywhere. The same key again, <kbd>Space</kbd>, <kbd>E</kbd> or a step gets you up, and the menu's **Rest** group has both for the mouse and touch. The visitor starts with a **lantern** in the backpack. It's held in the left hand while it's the selected hotbar slot, set down beside you while you rest, and at night it's a real lamp that lights the ground round you. On a clear night, **shooting stars** now and then streak across the sky. Rabbits no longer run through Chopper's house, or anything else built after the planet loads.

## 1. Research: established patterns

| Game | What it does | What we take |
|---|---|---|
| **Nearly every action and adventure game** (Zelda, Mario, Minecraft) | <kbd>Space</kbd> jumps on a keyboard; a jump carries your run on | Space jumps, with momentum |
| **World of Warcraft** | <kbd>X</kbd> sits down anywhere, and moving stands you up | X sits; any step stands you up |
| **PUBG, Battlefield** | <kbd>Z</kbd> goes prone | Z lies down (on the back here, to look at the sky) |
| **Animal Crossing: New Horizons** | Reactions (sit, lie down) from a wheel; the pocket's tools are equipped from a ring | A menu group for the poses, where the pointer and touch reach them |
| **Minecraft** | The selected hotbar slot is the item in your hand; a held torch lights the way (Dynamic Lights) | The lantern is held while it's selected; its light follows you |
| **Fortnite, Minecraft Bedrock** | An emote wheel on <kbd>B</kbd> for many emotes | Not taken: a wheel suits six or more choices, and here there are two |

**Pick:** WoW's sit key and the prone key for the two poses, with a menu group rather than a two-item wheel, and Minecraft's held item for the lantern.

## 2. Plan v1 (the owner's brief)

1. A rabbit ran through the dog house: fix it.
2. Occasional shooting stars at night.
3. A jump animation, with Space to jump.
4. A lantern in the inventory, to equip and light things at night.
5. Sit down, or lie flat on the back, at any point, through good shortcuts or a radial menu, following established patterns.

## 3. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | The rabbits steered round a copy of the obstacles made when the planet loaded | Anything built later (Chopper's house, the swing, the furnace) wasn't in it | They use the live list (`controller.staticObstacles`); one caught where something went up hops its way out |
| 2 | Space already goes back (design system §6.7) | One press mustn't close something *and* jump | Going back wins: stand up, get off, stop an action; only with nothing to go back from does it jump |
| 3 | "Equip" needs a slot or a screen | A new equipment screen is a new pattern | Minecraft's held item: the lantern is in your hand while its hotbar slot is selected (1–9, the wheel, a tap) |
| 4 | A new light at night | The lamp list is fixed-size (`LAMP_MAX`), and a lamp beyond it is dropped | `LAMP_MAX` goes to 11, and the lantern's lamp is packed first, so it's never the one left out |
| 5 | A radial menu for two poses | A wheel with two slices is a detour | Keys (X, Z), the same key again to get up, and the menu's Rest group for the mouse and touch |
| 6 | Resting while holding the lantern | The hand's busy on the grass | It's set down beside you, and picked up again when you stand |
| 7 | The initial bundle was at 449.9 of 450 KB | Everything new costs it | The poses, the lantern, the rest logic and the action poses load with the crafting chunk (it's attached before the scene); the main bundle keeps the state, the jump and small hooks |
| 8 | Shooting stars in the sky | Night effects must freeze or hide under paused ambient motion, and they're pure motion | Hidden while ambient motion is paused and under reduced motion |

## 4. Spec v2 (as built)

### 4.1 Jumping

- **Space** with nothing to go back from calls `controller.jump()` → `PlanetSim.jump()`: take-off at `JUMP.v` (3.2 u/s) under `JUMP.g` (16 u/s²), about 0.32 u up and 0.4 s in the air. The run carries on; there's no second jump in the air, none while travelling, and a fast travel ends one.
- The body rises by `sim.jumpH`, not the camera, so the view stays steady. The Kenney rig's **jump** clip plays, sped up to the time in the air, and a footstep sounds on landing (the `landed` event).
- Not while seated, resting or in an action.

### 4.2 Resting anywhere

- **X** sits on the grass: knees up, leaning back a little on both hands. **Z** lies back: flat on the back, hands behind the head, one knee up. Both are action poses (`world/craft/restPoses.ts`, pure) blended over the idle clip, with the hips lowered to the ground and a slow breath.
- Lying down goes on from the sit (its first half is the sit), and from lying, X sits up again the same way; nothing snaps.
- `controller.rest` holds the kind, the blend (0–1) and where it's heading. Resting reuses `seated`, so the prompt offers **Stand up** <kbd>Space</kbd>, and E, Space, Escape, the same key again, a movement key or a click on the planet get you up. You can't walk while the pose eases out.
- Not while travelling, seated on a bench, in an action or in the air. A fast travel ends it at once.
- The menu has a **Rest** group (**Sit down** <kbd>X</kbd>, **Lie down** <kbd>Z</kbd>), for the mouse and touch. The announcement is "Sitting on the grass. Press Space to stand up." (on touch: "Tap Stand up to get up.").

### 4.3 The lantern

- A new item, **Lantern** (`lantern`, stack of 1, a generated icon). The visitor is given one once (`game.lantern` in local storage); it goes through the saved backpack after that.
- **Held** while it's the selected hotbar slot and you're not travelling: in the left hand, the arm a little forward, swinging gently as you walk. While you rest, it's set down on the grass at your left.
- **Light:** a lamp (`lampLights.ts`, range 2.6 u) at the lantern's middle, at `2.4 × lampsOn(night)`: dark by day, lit at night. It's `first: true`, packed before the other lamps; `LAMP_MAX` is 11. The glass and flame are the glow layer.
- Put it away by picking another slot. <kbd>Q</kbd> drops it like any item.
- How to play and Prabin's welcome mention it.

### 4.4 Shooting stars

- `world/meteors.ts` (pure): once the night is at least 0.6, the first comes 2–6 s later, then one every 7–20 s. Each lasts 0.55–1 s, starts among the stars and streaks across and down toward the middle of the sky, its tail growing and then burning out.
- `world/ShootingStars.tsx` draws it as one additive quad on the stars' plane (camera frame, 61 u back), bright at its head and fading down its tail. It's in the wildlife chunk, mounted with the scene so it compiles with it. It's hidden by day, while ambient motion is paused and under reduced motion.

### 4.5 Rabbits and what gets built

- The wildlife steers round `controller.staticObstacles`, the live list that every build adds to.
- A rabbit already standing where something goes up takes any hop that gets it further out (`planHop`), so it's never stuck inside.

### 4.6 Budgets

- Initial bundle: the jump, the rest state, the hooks, the item and two keys. To make room, the action poses moved into the crafting chunk (`controller.actionPose`), which took 0.9 KB off: **449.4 KB** (≤ 450).
- The crafting chunk: the rest poses and logic, the lantern, and the action poses. The wildlife chunk: the shooting stars. **118.3 KB** on demand, over the 115 KB waiver; the waiver is proposed at ≤ 119 KB ([plan.md](./plan.md), pending the owner's OK).

## 5. Plan

| Step | What | Where |
|---|---|---|
| 1 | Rabbits on the live obstacle list; hop out if caught | `world/Wildlife.tsx`, `world/animals.ts` |
| 2 | Shooting stars | `world/meteors.ts`, `world/ShootingStars.tsx` |
| 3 | The jump: physics, Space, the clip, the landing | `systems/movement.ts`, `controller.ts`, `player/Player.tsx` |
| 4 | Resting: keys, state, poses, the menu group | `input/keyboard.ts`, `controller.ts`, `world/craft/restPoses.ts`, `world/craft/gear.tsx`, `ui/MenuDialog.tsx` |
| 5 | The lantern: item, icon, holding, the lamp | `inventory/items.ts`, `scripts/gen-icons.py`, `world/craft/gear.tsx`, `world/lampLights.ts` |
| 6 | The action poses into the crafting chunk | `player/actionPoses.ts` (via `controller.actionPose`) |
| 7 | Tests and docs | `tests/`, this page, the design system §6.7, How to play |

## 6. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Rabbits keep out of what's built later, and get out if caught | Unit (`animals.test.ts`): a house built on a rabbit's patch, and one built on a kit | Done |
| 2 | Shooting stars now and then at night, never by day | Unit (`meteors.test.ts`): timing, life, direction. E2E: one within the night, none by day. A real-GPU look | Done |
| 3 | Space jumps, only with nothing to go back from | Unit (`rest.test.ts`): the hop's height and time, no double jump, momentum. E2E: a hop that opens nothing; Space stands up rather than jumps | Done |
| 4 | Sit and lie anywhere, with keys and the menu, and get up | Unit: the poses (sit first, then lie). E2E: X, Z, the key again, Space, a step, the menu's Rest group. A real-GPU look | Done |
| 5 | A lantern to hold that lights the night | Unit: the item. E2E: given once, held in slot 1, lit at night, dark by day, put away by another slot. A real-GPU look | Done |
| 6 | Budgets met or a waiver proposed | `npm run verify:prod`: 449.4 KB initial; 118.3 KB on demand (waiver ≤ 119 KB proposed) | Done (waiver pending) |
