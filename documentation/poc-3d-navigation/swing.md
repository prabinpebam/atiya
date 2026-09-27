# The old oak's swing, jute and rope (spec and plan: v1, critique, v2 as built)

> **TL;DR.** The home's reading tree grows into a big old oak with a long, level branch. Under the branch a faint ghost of a swing waits, like Chopper's house does. You build the swing, and its card says what it needs: 2 jute ropes and 3 planks. Rope is a new material made at the crafting table from a new raw material, jute, which grows in a row behind the vegetable garden: pick a plant for 2 bundles of jute, and 3 bundles make a rope. Once built, the swing sways in the wind; you can sit on it and pump it higher, and the family ride it too (the children often), one at a time, while you give them a push (§6). All of it follows the established patterns: a target kind plus an action cycle whose beats spawn drops, a recipe in `RECIPES`, a build site with a ghost, a card and a target, a seat with its own action, the family's smart-object activities, and everything in the crafting and home chunks.

## 1. Research: how games turn fibre into rope and rope into things

| Game | Fibre | Rope and what it builds | What we take |
|---|---|---|---|
| **Don't Starve** | Cut grass, picked from grass tufts that grow back | **Rope** is crafted from 3 cut grass. It's an ingredient in many builds | Rope from 3 of a plant fibre, and plants that regrow |
| **Stardew Valley** | **Fiber**, cut from weeds, is a common crafting material | Fences, paths and many small crafts | A cheap, renewable raw material gathered by hand |
| **Minecraft** | String, from cobwebs and spiders | Bows, leads, fishing rods and wool | A fibre as an intermediate for crafted things |
| **Animal Crossing: New Horizons** | Tree branches and weeds as common DIY materials | Outdoor furniture from DIY recipes | Garden furniture you craft and place for the family |
| Real world | **Jute** is the classic rope and twine fibre of India and Bangladesh: tall, slender stalks retted into long golden fibres | Rope, twine and sacking | Jute as the planet's rope fibre |

**Pick:** Don't Starve's chain (a plant that regrows → 3 fibres make a rope) with our existing crafting flow, so there's nothing new to learn: pick, craft, build.

## 2. Plan v1

1. **The tree:** make one of the home's trees (Laija's reading tree) bigger and more detailed, with a long horizontal branch fit for a swing.
2. **Hemp:** a new raw material, from hemp plants near the home.
3. **Rope:** a new recipe at the crafting table: 3 hemp → 1 rope.
4. **The swing site:** under the branch, a ghost of the swing, a card with what it needs (2 ropes and 3 planks), and E builds it, like Chopper's house.
5. **The built swing:** it hangs from the branch and sways in the wind.

## 3. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | Hemp's leaf is the cannabis leaf | On a professional portfolio its silhouette reads as cannabis, whatever it's for | **Jute** instead: the same use (rope), lance-shaped leaves and small yellow flowers, and the classic rope fibre of India. The item is **Jute**, the recipe **Jute rope** |
| 2 | Laija reads against that tree | A limb or a swing over her seat would break her activity and look wrong | Her seat stays on the pond side; the branch reaches out 255° round from it, over open, level lawn, clear of the picnic mat |
| 3 | A one-off tree could drift from the others' look | A second set of tree materials would sway, shade and cast shadows differently | The oak uses the planet's own tree materials (`propMaterials()` in `Props.tsx`: the bark detail, the sway, the leaf cards' shadow material), drawn as a one-instance `InstancedMesh` so the wind reads its position like every other tree's. The chunk gets them through `sharedPropMaterials()` (`materials.ts`), not by importing `Props.tsx`: that import pulled the props into the chunk's shared graph, re-split the initial bundle and cost 1.2 KB |
| 4 | The tree was a shakeable hardwood | Shaking the swing's tree, and its prompt competing with the swing's, would be confusing | The old oak is the home's tree, not a `hardwood`: it's an obstacle and it sways, but it isn't a shake target |
| 5 | A new source of items must not add to the backpack directly | AGENTS: items go through drops and the magnet | Jute plants are targets whose `pick` cycle's beat spawns 2 drops (a new `onBeat` on chunk targets). A picked plant is cut to stubble and regrows in 90 s |
| 6 | Where does jute grow? | A patch in the home's mown lawn, or on a path, would look odd | A planted row of five behind the vegetable garden's back fence, on the home's edge, where nothing else stands |
| 7 | Two usable things close together | The swing site, Laija's seat and the jute could offer each other's prompt | The swing site is a special with a keep-clear disc (`layout.ts`), ≥ 2 u from the other specials; the jute row is far from both |
| 8 | "Just like the doghouse" also means something happens once it's built | A swing nobody uses is dull | Phase 1: it sways in the wind, and **Push the swing** (E) sets it going, a damped pendulum. Phase 2: the children swing on it (§6) |
| 9 | The initial bundle has about 1 KB left | A new tree, plants, a recipe and a site would not fit | Everything is in the crafting chunk; the main bundle gets a target kind, a tier and the `onBeat` hook |

## 4. Spec v2 (as built)

### 4.1 Materials and the recipe

| Item | Where from | Stack |
|---|---|---|
| **Jute** (`jute`) | Picking a jute plant: 2 per plant | 64 |
| **Jute rope** (`rope`) | Crafting table: 3 jute → 1 rope | 64 |

- The recipe goes in `RECIPES` (`world/craft/recipes.ts`), after the slab: "Twist three bundles of jute into a strong rope."
- The icons are generated against the golden style set (`python scripts/gen-icons.py icon jute` and `rope`).

### 4.2 The jute row (`homestead.ts` `yard.jute`, the crafting chunk)

- **Where:** five plants in a row 4.75 u behind the house, outside the vegetable garden's back fence, 0.8 u apart, all facing the house.
- **The plant:** a clump of tall green stalks (about 1.3 u), lance-shaped leaves along them and a few small yellow flowers at the top. One instanced draw with the bushes' material (the same sway from the ground up, and lamplight), and one for the stubble.
- **Target:** kind `jute` (tier 0.1, like the flowers and the garden plants), prompt **Pick jute**, the `pick` cycle. Its beat cuts the plant and spawns 2 jute drops. A cut plant shows stubble, isn't usable, and grows back after 90 s.
- The grass round each plant is worn (trodden) and nothing else grows in the row.

### 4.3 The old oak (`homestead.ts` `tree`, `SWING`)

- Laija's reading tree is now the **old oak**: bigger than the other hardwoods (trunk base 0.46 u, crown to about 3.3 u), with five crown lobes, a stub, twigs and one long, near-level branch reaching 1.9 u out at about 1.6 u up, ending in its own small leafy lobe.
- **The branch's heading:** `SWING.deg` (255°) round from the tree's heading to the pond, so Laija's seat (on the pond side) and the picnic mat stay clear.
- It's an obstacle (radius `HOME_R.tree`), drawn by the crafting chunk with the planet's tree materials, and isn't a shake target.

### 4.4 The swing site

- **Where:** on the ground right under where the ropes hang: 1.2 u out along the branch in the oak's frame (`SWING.out`), where the branch is 1.64 u up (`SWING.branch`). The planet curves away under the branch, so that's `R·atan(out / (R + branch))` ≈ 1.03 u from the trunk. `swingFrame` (`craft/swing.ts`) finds the pivot above the seat and the ropes' length (about 1.2 u). The seat swings across the branch.
- **Ghost:** a translucent outline of the swing (two ropes and the seat), from faint (≥ 6 u) to clear (≤ 2 u), with the doghouse ghost's shimmer.
- **The card** (while the site is the target):
  - kicker "A spot for a swing";
  - title "The swing";
  - "This old oak's long, level branch is just right for a swing. Everyone at home would love one here.";
  - the needs, have / need: 2 jute ropes, 3 planks;
  - the hint: "Everything's here. Press E to build it!" or "Pick jute behind the vegetable garden and make rope and planks at the crafting table."
- **Target:** kind `site`, key `site:swing`. Prompt **See what the swing needs** / **Build the swing** (a tree icon). E with something short shows a toast that lists it; with everything, it builds: the materials go, a few knocks, the swing drops down from the branch on its ropes with a small overshoot, and it announces "You build the swing! It's ready for a push."
- **Saved** in `localStorage['site.swing']`.

### 4.5 The built swing

- Two ropes from the branch to a plank seat 0.42 u above the ground, 0.62 u wide.
- A damped pendulum (`world/craft/swing.ts`, pure): the wind nudges it a little (a few degrees at a full gust); **Push the swing** (E, a hand icon) plays the short `open` cycle (step up to it, face it) and on its beat gives it a push away from you (1.25 rad/s). It never swings past 0.9 rad, and a big swing settles in about 12 s (damping 0.6/s). Frozen while ambient motion is paused; under reduced motion a push is gentler (0.6×) and settles in a few seconds (damping 1.6/s).
- It's an obstacle (radius 0.35 at the seat) once built.
- Once built, its prompt is **Sit on the swing** (a chair icon), or **Push the swing** (a hand icon) while one of the family rides it. Riding it is §6.

### 4.6 Budgets

- Everything (the oak, the jute, the site, the swing, the card, the recipe's glue) is in the crafting chunk. The main bundle gets the `jute` target kind and its tier, the `onBeat` hook, the site plan's new spots, and the shared materials' hand-off.
- As built: 449.6 KB initial (≤ 450) and 94.4 KB on demand, over the 89 KB waiver, which is raised to 95 KB and proposed in [plan §6](./plan.md) (with the ducks' new models, moved out of the initial bundle into the wildlife chunk).
- With riding (§6): the main bundle also gets the seat's optional `height` and `action`, `controller.sitOn`, `controller.ride` and the avatars' riding pose; the chunks get the visitor's seat and the family's swing activities. To make room, the build drops the shaders' `//` comment lines from the minified chunks (`astro.config.mjs`, about 2 KB gz off the initial bundle): 448.3 KB initial and 95.3 KB on demand, under a 96 KB waiver proposed in [plan §6](./plan.md).
- Triangles: the oak about 1.9 k (880 trunk and branch, 1060 leaf cards), a jute plant about 1.4 k (five: about 7 k), the swing about 480.

## 5. Plan

| Step | What | Where |
|---|---|---|
| 1 | Items `jute`, `rope`; their icons | `inventory/items.ts`, `scripts/gen-icons.py` |
| 2 | Recipe `rope`; the swing's needs, missing, take (pure) | `world/craft/recipes.ts` |
| 3 | The old oak, the swing's place and the jute row in the site plan | `world/homestead.ts`, `world/layout.ts` |
| 4 | The pendulum (pure) | `world/craft/swing.ts` |
| 5 | Models: the oak, the jute plant and stubble, the swing, its ghost | `world/craft/swingModels.ts` (exports from `foliage.ts`) |
| 6 | Targets (jute, the swing site and the push), the build, saving | `world/craft/index.tsx`, `systems/interactables.ts`, `controller.ts` (`onBeat`) |
| 7 | Drawing: the oak, the jute, the ghost, the swing; the card | `world/craft/SwingView.tsx`, `world/craft/ui.tsx` |
| 8 | Tests: unit (recipe, needs, the site plan, the pendulum, jute regrowth, keep-clear); E2E (pick jute, craft rope, build and push the swing); one look on a real GPU | `tests/` |

## 6. Riding the swing

Phase 2, as built: the visitor and the family can sit on the swing and swing on it, one at a time.

- **One rider:** the swing's link (`SwingPlace` in `world/home/family.ts`, made by the crafting chunk and lent to the family as `controller.swing`) says who's on it (`rider`: `visitor`, one of the family, or nobody) and whether they're getting on or off (`boarding`: the pendulum brakes to a stop meanwhile, 6/s).
- **The visitor:** **Sit on the swing** (E) sits you on the plank facing the pond, through the same sit-down motion as a bench (`controller.sitOn` with the swing's own seat: its `height` is the plank's top, and you get off 0.75 u in front of it). Seated, the prompt shows **Swing higher** (E, the seat's `action`) and **Stand up** (Escape, or a movement key); it announces "On the swing. Press E to swing higher, or Escape to get off." (on touch: "On the swing. Tap Swing higher, or Stand up to get off.").
- **Pumping:** each **Swing higher** pumps the pendulum (`Pendulum.pump`): a kick of up to 0.42 rad/s along its motion, at most one every 0.45 s, within the 0.9 rad limit. Without pumping it dies down as before. While you ride, the wind doesn't move it, and it keeps swinging even while ambient motion is paused (you're pumping it).
- **The pose:** the whole body swings with the seat about the ropes' pivot on the branch (`controller.ride`: the tilt, the pivot's height and the pump, set each frame by the crafting chunk); the hands hold the ropes overhead, and the legs pump: out on the way forward, tucked under the seat on the way back. The family's riders are posed the same way in `FamilyView.tsx` (the `swing` pose in `world/home/poses.ts`).
- **The family:** the `swing` activity (Laija and Lingjel, weight 3, 14–24 s, a minute's cooldown) and `swingGrown` (Rojina and Prabin, weight 0.9): walk to an entry point (in front of the swing, or to either side in front of the ropes: behind it is the oak), sit, pump (the children harder), then stop pumping, and get off once it's swung down low. They don't start while someone else is on it, and they give up if the visitor gets on first.
- **Pushing:** while one of the family rides, the visitor's prompt is **Push the swing**: the same push as §4.5.

## 7. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | The old oak is bigger than the other hardwoods and has a long, level branch; Laija's seat and the mat stay clear | Unit (`crafting.test.ts`, "the swing, jute and rope"): the swing ≥ 1.3 u from her seat and ≥ 2.5 u from the mat, its arc clear; a real-GPU look | Done |
| 2 | Jute grows behind the vegetable garden; picking it drops 2 jute; it regrows | Unit: the row's placement; E2E "the swing: pick jute…": 2 jute collected, the plant cut (> 60 s to regrow) and its prompt gone | Done |
| 3 | 3 jute make a rope at the crafting table | Unit: the recipe; E2E: 6 jute → 2 ropes on the crafting screen | Done |
| 4 | The swing site shows a ghost and a card with have / need, and builds with 2 ropes and 3 planks | E2E: the ghost > 0.85 up close, the card's rows (2 / 2, 0 / 3), the prompts, the build takes exactly the materials; unit: needs and `takeNeeds` | Done |
| 5 | The built swing sways, can be pushed, and is saved | Unit: the pendulum (push, limit, wind, settling, reduced motion); E2E: a push swings it past 0.2 rad, it settles, and it's still built after a reload | Done |
| 6 | Walking up to any special offers only that one | Unit: "offers only the special target when you stand at it" (the swing site and the jute plants added) | Done |
| 7 | Budgets | `npm run verify:prod`: 448.3 KB initial; 95.3 KB on demand under the proposed 96 KB waiver | Waiver pending |
| 8 | The visitor can sit on the swing, pump it higher and get off | E2E "the swing: …ride it…": Sit on the swing puts the visitor on it (`rider` `visitor`), the prompt shows Swing higher and Stand up, 8 pumps swing it past 0.2 rad, Escape gets off; unit (`crafting.test.ts`): the pump's kick, its gap and the limit, the brake; a real-GPU look (the body swinging with the seat, hands on the ropes, legs pumping) | Done |
| 9 | The family ride it too, one at a time, and the visitor can push them | Unit (`family.test.ts`, "the swing (swing.md §6)"): a child walks over, gets on, pumps it and gets off; nobody gets on while the visitor rides; E2E: a child gets on (asked with `npcDo`, again after a meal) and the prompt offers Push the swing; a real-GPU look at Laija riding | Done |
| 10 | Nobody waits for good at a taken entry point | The visitor gets off in front of the swing, onto the family's front entry: they take a side entry instead (seen on a real GPU: Laija on it 11 s after being asked, with the visitor standing in front) | Done |
