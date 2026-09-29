# The furnace, clay, stone blocks, firewood and iron ingots (spec and plan: v1, critique, v2 as built)

> **TL;DR.** Behind the workyard, where the chest and the crafting table stand, a faint ghost of a stone furnace waits, like Chopper's house and the swing do. You build it from **stone blocks** (made at the crafting table from stones) and **clay**, dug from grey clay beds on the banks of the stream and the pond. Once it's built, the furnace smelts **iron ore** into **iron ingots**, burning **firewood** (made at the crafting table from logs). Its screen is the crafting screen's: the recipe, the ore and the firewood as its material slots, how many, and **Smelt**. While it smelts, fire roars in its mouth and smoke rises from its chimney, and it cools slowly after. **Nails** are now hammered from iron ingots, not from raw ore, so Chopper's house and the viewing deck need the furnace first. The yard keeps wide gaps between the chest, the table and the furnace, so walking between them is easy.

## 1. Research: how games smelt

| Game | What it does | What we take |
|---|---|---|
| **Minecraft** | A furnace crafted from eight cobblestone smelts ore into ingots, burning a fuel (coal, wood, logs). Clay balls come from clay found in shallow water and lake beds | Ore + fuel → ingot at a furnace you make; clay from the water's edge |
| **Stardew Valley** | The furnace is crafted from copper ore and stone, and smelts five ore and one coal into a bar | A furnace built from stone, taking a fuel with each batch |
| **Terraria** | The furnace is crafted at a work bench from stone blocks, wood and torches, and it's where bars are made | Stone *blocks*, a crafted intermediate, as the furnace's main material |
| **Valheim** | Ore is useless until a smelter turns it into bars; the gear that needs metal needs the bars | Iron things need the ingot, never the ore |
| **Animal Crossing: New Horizons** | Clay is a gathered material with its own look and icon, used in crafting | Clay as its own material, found in its own place |

**Pick:** Minecraft's furnace (ore + fuel in, ingot out, its own screen), built from Terraria's stone blocks and Minecraft's riverside clay, with Valheim's rule that metal things need the smelted metal.

## 2. Plan v1 (the owner's brief)

1. An iron or smelting furnace behind the chest and the crafting table, with gaps for walking in that space.
2. Not there by default: crafted from **stone blocks** and **clay** from the stream or the pond.
3. Stone blocks are crafted.
4. Clay collection spots are visually distinct, on the banks of the stream and the pond.
5. Once built, it smelts iron ore into **iron ingots**.
6. It needs **firewood** to work; firewood is crafted from logs.
7. Nails and other iron things are made only from iron ingots, not from iron ore.

## 3. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | "Behind" the yard isn't a place yet | The yard is laid out by a search; a hand-picked spot could land on a path, in a tree or too close to the chest | The layout picks it: out from the yard's centre, away from the plaza, clear of the paths, the buildings, the water and the cliff, and at least 2.4 u from the chest and the table (gaps of about 1.4 u between their edges) |
| 2 | How is it "crafted"? | A furnace isn't an item you carry | It's a **build site**, like Chopper's house and the swing: a ghost, a card of what it needs, a target that builds it (`missing` / `takeNeeds`) |
| 3 | What does it need? | "Stone blocks and clay" has no numbers | **6 stone blocks and 4 clay** (18 stones and two digs' worth of clay) |
| 4 | Stone block vs the stone slab | Two stone items could read as one | A block is **3 stones** and a thick cube; a slab is 2 stones and a flat tile. Their icons are painted to be told apart |
| 5 | How is clay collected? | A new gathering mechanic would be a new action | A clay bed is a target like a jute plant: **Dig clay** plays the existing gathering cycle, **2 clay** drop at your feet and the magnet brings them in; the bed is scooped out and fills back over 75 s |
| 6 | "Visually distinct" | Clay must not look like mud or a rock | A grey-blue patch with a dark wet rim, three smooth glossy lumps and scoop marks: a colour nothing else on the banks has. Dug, the lumps are gone and the hollow is darker, and they swell back as it refills |
| 7 | How many beds, and where? | Too few makes it a trek; on a path or a bridge they'd be in the way | **4 beds:** 2 on the stream's banks and 2 on the pond's, on dry bank ground within a step of the water, clear of paths, bridges, the home, every obstacle and every flower, and well apart |
| 8 | How is it used? | A new screen would be a new pattern | The **crafting screen**, with the furnace's recipe: the ore and the firewood are its material slots (have / need), quantity, **Smelt** (the backpack and hotbar below, as ever). Minecraft's furnace has its input and fuel slots; here they're the material slots |
| 9 | "Needs firewood to operate" | Fuel that burns in the background would need a furnace inventory, timers and saving | Each ingot burns **1 firewood** as it's smelted: the fuel is a material of the recipe |
| 10 | Is smelting instant? | Crafting is a short hammering | Smelting takes longer (1.4 s a batch), the fire roars while it does, and the furnace stays warm for 25 s after, then cools |
| 11 | Iron things from ingots only | Nails were made from ore; players may hold ore and no furnace | **Nails: 1 iron ingot → 6 nails.** The ore makes nothing at the table now. Every hint that sent you to the ore now sends you to the furnace |
| 12 | Its fire at night | The lamp lights are at `LAMP_MAX` | The fire is an unlit, self-coloured part (with sparks from the chimney), not a light: the light count doesn't change |
| 13 | A special target in a busy yard | Walking up to the chest could offer the furnace | It's a special target: flowers are kept out of `KEEP_CLEAR`, solids out of `KEEP_SOLID`, and the tests check that standing at each special from any side offers only it |
| 14 | The bundle budgets | The initial bundle had 0.5 KB left | Only the spot's search, the new target kind and the items are in the initial bundle; the furnace, the clay beds, the rules' screens and models are in the crafting chunk |

## 4. Spec v2 (as built)

### 4.1 Materials and recipes (`craft/recipes.ts`, `inventory/items.ts`)

| Item | Id | How you get it | At |
|---|---|---|---|
| Clay | `clay` | **Dig clay** at a clay bed: 2 a dig | The stream's and the pond's banks |
| Stone block | `block` | 3 stones → 1 | The crafting table |
| Firewood | `firewood` | 1 wood log → 3 | The crafting table |
| Iron ingot | `ingot` | 1 iron ore + 1 firewood → 1 (Smelt) | The furnace |
| Nails | `nails` | 1 iron ingot → 6 (was 1 iron ore) | The crafting table |

- Every icon is generated against the golden style set (`assets-src/icons/clay.png`, `block.png`, `firewood.png`, `ingot.png`).
- The furnace's recipes are `SMELTING` (one, the ingot); the table's are `RECIPES`. The same rules craft both (`craft`, `maxCraftable`, bulk up to 10).

### 4.2 The furnace's spot (`layout.ts`, `furnace`)

- From the yard's centre (between the chest and the table), straight out away from the plaza, the first spot from 2.2 u to 3.6 u out, turned up to ±0.35 rad either way, that:
  - is at least `FURNACE_GAP` (2.4 u) from the chest and from the table;
  - stays clear of every path by the furnace's radius and 0.9 u, of the buildings, the water, the river and the cliffs;
  - isn't on the plaza's furniture.
- It faces the plaza, so its mouth looks toward the yard.
- It's a **special**: flowers and solids are kept away from it, like the chest's and the table's, so nothing else offers itself there. The ground under it is a pad with a cobbled apron (added by the crafting chunk before the ground is built), and the grass is worn round it.

### 4.3 The clay beds (`craft/clay.ts`, pure)

- Candidates walk the stream's banks (both sides, along its length) and round the pond's shore, 0.3 u to 0.75 u out of the water, on dry ground.
- A bed needs:
  - no path within 0.8 u, no bridge or its rails within 1.4 u, nothing of the home's within its clearing, and out of every building's preview area (where E opens the building's card) by 0.6 u;
  - no obstacle within 0.5 u of its edge, and no flower or other target within 0.85 u;
  - at least 4 u from every other bed.
- The first two good spots along the stream and the first two round the pond are the beds; the order is fixed, so the planet is the same on every visit.
- A bed is 0.5 u across. **Dig clay** (the gathering cycle) drops 2 clay and scoops it out; it refills over `CLAY.regrow` (75 s), its lumps swelling back. While it's empty it offers nothing.

### 4.4 The site, the build and the built furnace

- **The ghost:** faint from 6 u, clear from 2 u (the house's `GHOST_FAR` / `GHOST_NEAR`), with a slow shimmer; it fades as the furnace goes up.
- **The card** (while its prompt is up): "A spot for a furnace", "The furnace", a line about it, the needs (have / need), and the hint: make stone blocks at the crafting table, dig clay on the banks of the stream and the pond.
- **The prompt:** **See what the furnace needs** (a toast lists what's short), **Build the furnace** once you have it all (a hammer icon), then **Use the furnace** (a fire icon). The prompt stays up while it rises, so it doesn't drop and re-announce over "You build the furnace!".
- **The build:** the materials are taken, three knocks, the furnace rises and settles (`BUILD_S`), with the build's dust puffs. It's saved (`site.furnace`) and becomes solid (radius `FURNACE_R`, 0.55 u); the route planners are told.
- **The model** (`craft/furnaceModels.ts`, the kit): a squat stone furnace on a plinth of cut blocks (masonry), a clay-daubed dome (plaster) with an arched mouth and a stone lintel, a brick chimney at the back, iron doors hinged open at the mouth, a stack of split firewood at its side and a small stone anvil block in front. About 1.1 u wide, 1 u deep and 1.5 u to the chimney's top.
- **The fire** (one unlit draw): a painted gradient in the mouth, a yellow-orange core low down fading to deep red at the arch. Its brightness is held below the tone mapper's white point, so it stays orange by day (brighter, it washed out to peach). Its level is the furnace's heat alone: black when cold (two charred logs lie in the mouth), and while smelting it flares and flickers, sparks rise from the chimney and the smoke thickens; after, it cools over 25 s. Under reduced motion it holds still at its level.
- **The glow:** an additive halo in front of the mouth (light in the air, not on a surface) and, at night, a warm lamp at the mouth (`addLamp`, range 1.8 u) that lights the ground and the anvil; both follow the heat and flicker, and are 0 when cold. The fire sits 12 mm in front of the mouth's soot face (it was in the same plane, which z-fought into flickering wedges).
- **Ready cue:** when the built furnace becomes what E would use, it shows the sparkles like the chest and the crafting table; the fire itself only burns while it's smelting.

### 4.5 The furnace screen

- **Use the furnace** opens the crafting screen titled **Furnace** (a fire icon), with the furnace's recipes: **Iron ingot**, its two material slots (iron ore, firewood; have / need, green or red), the quantity and **Smelt** <kbd>Enter</kbd>.
- It takes 1.4 s a batch (`SMELT_S`), with the progress bar; the ingots fly into the slots they land in, and it says so: "Smelted 3 iron ingots: in hotbar slot 4."
- Everything else is the crafting screen's: the backpack and hotbar in it, the keys, the help popover, E or Space to close.

### 4.6 What changes elsewhere

- The table's nails need an iron ingot; its status line says what's missing in words ("it takes 1 iron ingot").
- The hints that sent you to the ore (the deck's toast, Chopper's house and the deck's cards) now say: nails are hammered from iron ingots, smelted at the furnace behind the crafting table.
- The How to play page's tips mention the furnace.

### 4.7 Budgets

- Initial bundle: the spot's search in the layout, the `clay` target kind and the four items. The prompts reuse icons the game already ships (the hammer, the hand), except the fire: the icon module lives in the initial bundle, so every new icon costs it. To make room, the icon manifest is now a list of ids (every url is `/icons/<id>.webp`, and nothing read the sizes). The chunk writes its pad spec out rather than importing `groundPads` (a new importer re-splits the shared chunks). As built: **449.9 KB** initial (≤ 450).
- The crafting chunk: the furnace (rules, model, fire, screen, card), the clay beds (placement, model, targets): about 5 KB gz, giving **112.8 KB** on demand, over the 108 KB waiver; the waiver is proposed at ≤ 113 KB ([plan.md](./plan.md), pending the owner's OK).
- Draws: the furnace (its solid, glow and the ghost), the fire, the clay beds (one merged solid and one instanced draw for the lumps). No new lights.

## 5. Plan

| Step | What | Where |
|---|---|---|
| 1 | Items, icons (generated), recipes, `SMELTING`, `FURNACE_NEEDS`, nails from ingots | `items.ts`, `gen-icons.py`, `recipes.ts` |
| 2 | The furnace's spot and its keep-clear; the worn grass | `layout.ts`, `grass/zones.ts` |
| 3 | The clay beds (pure placement) and their targets | `craft/clay.ts`, `craft/furnace.tsx` |
| 4 | The site: ghost, card, build, save, obstacle, pad | `craft/furnace.tsx`, `craft/ui.tsx` |
| 5 | The model, the fire, the ready cue, the smoke | `craft/furnaceModels.ts`, `craft/furnace.tsx` |
| 6 | The furnace screen: the crafting screen with `SMELTING` and Smelt | `craft/ui.tsx`, `controller.openCraft('furnace')` |
| 7 | Hints and docs | `deck.tsx`, `ui.tsx`, this page, [crafting.md](./crafting.md), [viewing-deck.md](./viewing-deck.md) |
| 8 | Tests: unit (recipes, the spot, the beds, targets kept apart); E2E (dig clay, make blocks and firewood, build, smelt, make nails) | `tests/` |

## 6. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Clay, stone blocks, firewood and iron ingots exist, with generated icons | Unit (`furnace.test.ts`): the items and their icons in the manifest; the recipes' numbers | Done |
| 2 | Nails are made from ingots only | Unit: the nails recipe takes an ingot, and no recipe takes iron ore but the furnace's. E2E: the deck's test crafts its nails from an ingot | Done |
| 3 | The furnace's spot is behind the yard with room to walk round | Unit: farther from the plaza than the chest and the table, ≥ 2.4 u from each, off every path, dry, clear of every obstacle | Done |
| 4 | Clay beds are on the banks, easy to tell apart and out of the way | Unit: 2 by the stream, 2 by the pond, dry, next to the water, clear of paths, bridges, obstacles and flowers, well apart; a real-GPU look | Done: grey patches that read against the grass and the sand (1280 × 800, D3D11); first slate blue, made a soft warm grey with the icon at the owner's request |
| 5 | Nothing else takes E at the furnace or a clay bed | Unit: the specials test from every side, with the furnace's site and the clay beds | Done |
| 6 | Build it at its site from 6 blocks and 4 clay; it's saved and solid | E2E "the furnace…": the card's needs, the toast, the build, a reload | Done (E2E: dig clay, blocks and firewood at the table, the card, the toast, the build, a reload) |
| 7 | It smelts ore and firewood into ingots, and nails come from them | E2E: Smelt makes ingots (ore and firewood gone), nails at the table from an ingot | Done (E2E: 2 ore + 2 firewood → 2 ingots, the fire hot while it smelts, 6 nails from 1 ingot) |
| 8 | It looks like a furnace, and its fire shows when it works | A real-GPU look by day and at night, smelting and cold | Done: dark when cold (charred logs, no glow), a yellow-orange core, a halo and at night a lamp on the ground when hot; no flickering wedges (the z-fight with the mouth's soot face fixed) |
| 9 | Budgets met or a waiver proposed | `npm run verify:prod`: 449.9 KB initial, 112.8 KB on demand (waiver ≤ 113 KB proposed) | Done (waiver pending) |
