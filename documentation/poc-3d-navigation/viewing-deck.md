# The viewing deck, iron ore and nails (spec and plan: v1, critique, v2 as built)

> **TL;DR.** The two-tier cliff nearest the home is redesigned into a bigger cliff with a wide lower terrace on the home's side. Up its side you can build, in three stages, a winding way to a viewing deck on top. First come stone steps from the meadow and two wooden flights with a landing, round the lower cliff and over its rim. Then two more flights round the upper cliff, and across the top's lawn. Last, a wooden platform on braced posts, with a railing, a bench facing the home and little lanterns on its corners (more light the landings and the foot). Every build is a site with a ghost, a card and a target, like the swing and Chopper's house. Once built, the steps and the platform are really walkable: the character, Prabin and Rojina climb them and sit on the bench. The builds need **nails**, a new crafted item made from **iron ore**. One boulder in three now carries rusty ore nuggets, and mining it gives iron ore with the stones. Chopper's house needs nails too.

## 1. Research: how games gate a climb and how they walk NPCs up it

| Game | What it does | What we take |
|---|---|---|
| **Animal Crossing: New Horizons** | Inclines and stairs are built projects that open cliffs to the player; until then a cliff is a wall | A cliff you can't climb until you build the way up |
| **Stardew Valley** | Community-centre bundles and multi-stage buildings: each stage asks for its own materials | Three builds, each with its own needs, each unlocking the next |
| **Minecraft** | Iron ore is a distinct-looking stone (rusty flecks), mined, then turned into iron things; nails don't exist, but iron is a gate to better builds | Ore that reads at a glance as "not plain stone", and an intermediate made from it |
| **The Legend of Zelda: Breath of the Wild** | Ore deposits: dark rock with glinting coloured veins among ordinary boulders | Ore on some boulders, not a separate prop |
| **Unity / Unreal NPC navigation** | Stairs are walkable surfaces on the navigation mesh; narrow ones are kept open by off-mesh links or corridor overrides | Walk surfaces for the height, and corridors the route planner keeps open |

**Pick:** Animal Crossing's gated cliff, built in Stardew's stages, with Minecraft's ore-to-iron chain (ore → nails) and Breath of the Wild's ore on ordinary boulders.

## 2. Plan v1

1. **The deck:** a wooden platform on top of the two-tier cliff near the picnic mat, with a railing, a bench and small lights, on wooden supports.
2. **The steps:** stone, plank and beam steps winding up the cliff: one set to the lower tier, one to the top.
3. **Three builds:** the first steps, the second steps, the platform, each built at its own site like the swing.
4. **Walking it:** the character and the NPCs climb it and sit on the bench; the NPCs go there now and then.
5. **Iron and nails:** iron ore stuck on some boulders; nails made from iron, needed for Chopper's house and the deck.

## 3. Critique of v1

| # | Problem | Why it matters | v2 |
|---|---|---|---|
| 1 | The old cliff was too small (1.9 u in radius, with a 1 u upper tier) | Its terrace was 0.55 u wide in places: no room for a flight along it, and no room on top for a platform with a way round it | The cliff is redesigned: 3.2 u in radius and 1.1 u high, with an upper tier 1.9 u in radius and 0.8 u higher, offset away from the home so the lower terrace is widest (up to 1.9 u) on the home's side |
| 2 | Collision is 2D (circles on the sphere) | Stairs can't be a height check: anything you can walk under would snap you up onto it | A flight never passes over anything walkable: the steps hug the walls and run outside them, rails close their sides, and the platform stands wholly on the top. Heights come from **walk surfaces** (`Terrain.addSurface`) on the built stages only |
| 3 | The cliff blocks with one big circle | Once the steps are up, the terrace and the top must be walkable, and nothing else must change | The build swaps the cliff's own obstacles for small circles just inside each rim, with a gap where the steps cross it, plus the rails (`deckObstacles`). Unbuilt, the cliff is exactly as before |
| 4 | The route planner's clearance (0.32 u) closes a 1 u flight between rails | The family couldn't plan up it | The built steps are **corridors** the planner keeps open (`SphereNav.reblock`), like an off-mesh link |
| 5 | "Winding" stairs usually double back over themselves | Impossible with 2D collision | They wind *round* the cliff instead: the lower steps round a third of the lower wall with a landing that juts out, the upper steps back round the upper wall |
| 6 | A platform at the cliff's front edge | The top's rim leaves no way round its sides (0.2 u) | The platform stands at the back of the top, facing the view over the top's lawn; you come up the steps onto the lawn and in through a gap in its front rail |
| 7 | Trees on the old cliff and at its foot would stand in the way | A crown through a flight looks broken | The layout clears everything from the steps' and platform's footprint (crowns included), keeps any trees left on the cliff as obstacles (it can be climbed now), and plants a tree beside the steps' foot to frame the way up |
| 8 | Ore as a new prop | Another model and draw per rock | Ore is nuggets on the boulders that carry it: one instanced draw, rusty and dark metal, in the crafting chunk; the prompt says **Mine iron ore** |
| 9 | Lights on the platform | The lamp lights are at `LAMP_MAX` | The lanterns are glow parts (the kit's glow layer brightens them at night); they cast no light, so the light count is unchanged |
| 10 | The initial bundle had 1.7 KB left | Three builds' models, a plan and rules wouldn't fit | Everything but the footprint (`deckSpec.ts`), the walk surfaces' hook, the obstacle swap and the iron flag is in the crafting chunk |

## 4. Spec v2 (as built)

### 4.1 Materials and recipes

- **Iron ore** (`iron`): one boulder in three (`layout.ts`, every boulder whose index is 1 mod 3) carries it, shown as twelve rusty and dark metal nuggets on its main lump. Its prompt is **Mine iron ore**, and every third hit of the pickaxe drops a lump of iron ore with the stones.
- **Nails** (`nails`): 1 iron ore → 6 nails at the crafting table. *Since [the furnace](./furnace.md):* 1 iron ingot → 6 nails; the ore is smelted into ingots first.
- Both icons are generated against the golden style set (`assets-src/icons/iron.png`, `nails.png`).
- **Chopper's house** now needs 6 nails too (2 stone slabs, 2 wooden beams, 4 planks, 6 nails).

### 4.2 The cliff and the route (`world/features.ts`, `world/deckSpec.ts`, pure)

- **The cliff:** `MESA_SPECS[3]` (`deck: true`), 11 u from the picnic mat.
- **The view:** `DECK.face` (160° in the cliff's frame) points at the home.
- **The lower steps** (stage 1), given as [angle from `face`, distance out from the rim]:
  - stone steps up from the meadow;
  - a wooden flight along the wall, 0.7 u out;
  - a landing that juts out;
  - a second flight;
  - a short landing that cuts the corner;
  - a landing in over the rim onto the terrace, square to the wall, that ends flush with the rim (nothing of it sticks into the cliff).
  - Every bend is obtuse (126° or more): the turn from the second flight into the rim, a right angle less the curve of the wall (76°), is two bends with a short landing between them.
  - They climb about 1.3 u over 4 u.
- **The upper steps** (stage 2), in the upper tier's frame:
  - a stepping-stone path across the terrace that meets the upper flight square on;
  - from the terrace, two flights along the upper wall (0.58 u out) with a landing between them;
  - a short landing that cuts the corner, then a landing in over its rim (the same fix: the turn in was 84°, now two bends of about 121° and 126°);
  - a path across the top's lawn to the platform's steps.
  - They climb 0.8 u over 3 u.
- **The platform** (stage 3):
  - 2.0 × 1.4 u, 0.45 u above the highest ground under it, standing back 0.35 u from the upper tier's middle;
  - its front faces the view, with a gap in the front rail and three steps up from the lawn.
- **The footprint** (`deckFootprint`): discs over all of it, which the layout keeps clear.

### 4.3 What each build is (`craft/deckPlan.ts` rules, `craft/deckModels.ts` models)

- **Heights:** each chain rises from the ground at its start to the ground at its end over its stone steps and flights, and is flat on the landings. It never goes into the ground (flights stay ≥ 0.05 u above it) and never gets steeper than about 30°.
- **Walk surface** (`deckSurface`): on a built piece, the height of the piece whose centreline is nearest; the platform's floor inside its outline; −∞ elsewhere. `Terrain.walkHeight` takes the higher of it and the ground, so the character, the family, Chopper and the drops all stand on it.
- **Obstacles** (`deckObstacles`):
  - stage 0 is the cliff as laid out (one big circle and its rim);
  - from stage 1, small circles just inside each rim (0.2 u), with a gap where a built piece crosses it;
  - the rails of each built run, open at both ends, and none within reach of a walkway's centreline;
  - on the platform, its railing (open at its front gap) and the bench's two ends.
- **Corridors** (`deckCorridors`): the built pieces' centrelines, 0.2 u each side, kept open in the route planner.
- **Models:** one kit per stage, laid out in the planet's frame with every part upright on the ground under it.
  - **One unit, not parts:** each run of flights and landings is modelled along one ribbon (`ribbon()` / `runs()` in `deckPlan.ts`): its centreline by arc length, with mitred edges at the bends. The stringers, the handrails and the landings' boards follow the ribbon without a break, each tread's top sits at the middle of its rise, so nothing clips into its neighbour, and the rails open where a run meets the lawn, the terrace or the platform.
  - Flat stepping stones every 0.36 u along the lawn crossings between runs (`steppingStones()`).
  - Stone blocks for the stone steps.
  - Open plank treads on two stringers, and posts with cross beams and X braces down to the ground where the flight is tall.
  - Plank landings on framed posts, a round pad at each bend, and handrails (posts, a top rail, a mid rail) on both sides.
  - The platform's boards on a beam frame with joists, on six posts with X braces on each side, and its railing. The plan's x / z are arcs on the base sphere, so up on the cliff everything placed through them is (R + H) / R bigger (about 1.24×): the boards are scaled with it, so they cover the whole frame out to the railing. They were once sized in plain units and covered only its middle, with gaps between them. Each board is laid in lengths butted end to end, staggered from board to board, so the floor follows the planet: a single board across would lift about 6 cm off the walking height at its ends. A unit test casts rays down over the floor: at least 90% of it has a board's top within 1.2 cm of the deck's height, and the rest are the hairline gaps between boards.
  - The park bench (`parts.ts` `bench`).
  - **Lanterns:** an iron cage round a glow bulb, on the platform's four corners, at the two jutting landings and on a post beside the foot.

### 4.4 The builds

- **Sites:**

  | Build | Site | Card kicker, title |
  |---|---|---|
  | The steps | the steps' foot on the meadow | "A way up the cliff", "The steps" |
  | The upper steps | the upper steps' foot on the terrace | "Higher still", "The upper steps" |
  | The viewing deck | the platform's steps on the lawn | "A place to look out", "The viewing deck" |

- **Needs:**
  - the steps: 4 stone slabs, 6 planks, 3 wooden beams and 12 nails;
  - the upper steps: 2 slabs, 6 planks, 2 beams and 12 nails;
  - the deck: 8 planks, 4 beams and 18 nails.
- **Order:** only the next build's target is usable, and only its ghost shows (faint from 10 u, clear at 3 u, with the swing's shimmer).
- **Prompts:** **See what the steps need** / **Build the steps**, and the same for the upper steps and the deck (stairs and binoculars icons). The toast lists what's short and where nails come from.
- **Building:** E with everything takes the materials, knocks five times, fades the ghost and the build appears, and announces:
  - "You build the steps up the cliff! From the terrace, the upper steps can go up next."
  - "You build the upper steps! The top of the cliff is ready for its deck."
  - "You build the viewing deck! Sit on its bench and enjoy the view."
- **Saved** in `localStorage['site.deck']` (`{ stage }`).

### 4.5 Using it

- **The visitor:** walks up (by keys, taps or clicks) and sits on the bench with **Sit on the bench** (E). The bench is a chunk seat (`Seat.height` is the platform's floor plus the bench's seat), and you stand up 0.6 u in front of it.
- **The family:** activity `deck` (Prabin and Rojina, weight 0.9, 25–40 s, a four-minute cooldown), a seat activity at the family's end of the bench (seat kind `deck`, entry points in front of it on the platform). They route there on the planet's grid with the steps' corridors open.
- **The route grid:** a build stamps it again (`controller.replaceObstacles` → `obstacleWatch` → `Family.obstaclesChanged`, and everyone plans afresh).
- **The grass:** bare under the stone steps, worn at the foot, across the terrace and on the lawn, and short under the platform (`grass/zones.ts`).

### 4.6 Planting and the old pine (`craft/deckDressing.ts`, `craft/bonsaiModel.ts`)

- **Planting** (pure, seeded, in the crafting chunk, added to the props before the scene mounts):
  - leafy and flowering bushes hugging the foot of the lower wall, and a few on the terrace;
  - flower clumps (tulips, cosmos, pansies) and flowering sprigs round the foot, along the terrace and round the platform on the top;
  - it keeps off the footprint, the build site at the foot (bushes 2 u, flowers 0.9 u), the paths, the landmarks, the home, the water, the other trees, bushes and stones, and the rims;
  - the bushes are obstacles (0.42 u × their size); none blocks the way up at any stage.
- **Knee-high grass:** a meadow ring round the cliff (its rim + 1.2 → + 2.8 u) grows tall grass in its noise patches, except on the steps' corridors, worn or mown ground and the tracks (`grass/zones.ts`).
- **The old pine:** a very old, windswept, bonsai-like pine on the top, 0.3 u in from the rim beside the platform (`BONSAI`, at −1.7 rad round from the view, where the platform leaves the most room), leaning out over the terrace and past the lower rim. It's 2.1× the first one (`PINE_SCALE`), about 3.4 u tall and reaching about 4 u out, and its trunk 1.2× thicker again for its age.
  - A low-poly bark trunk along a bent spine; ten full, domed needle pads (a green core under a ring of leaf lobes and a raised top layer) that fill out the crown, the cascade at the tip and the pads hanging under it; limbs; two bleached deadwood spikes, moss along the top of the level trunk and a moss cushion and stones at its foot (only where there's ground under them).
  - **Rooted in the real cliff:** the model is built against the cliff round it (`PineCliff`, from `pineCliff` in `deckDressing.ts`: the ground's height in the tree's own frame, the cap's on the top rather than the ground's ramp under the rim, the upper wall's edge and outward direction on each tier ray, and the planet's curve). Thirteen roots (`pineRoots`, pure) leave the trunk as buttresses, run half-sunk over the top and, where they reach the rim, bend over its grassy lip and cling down the wall's face just clear of its ledges, wandering a little across it, to the terrace, where the longest run on and stop short of its edge. The stem flares at its foot and dives back into the cliff, so where it stands over the rim it bulges out of the wall's top rather than floating. No grass grows round it (a 0.62 u bare disc).
  - **Creepers:** two wind up the trunk and let go; strands hang from the pads, the branches and the level trunk, and festoons loop between the trunk and its pads. They hang toward the planet's centre (so out past the rim, where the ground curves away, they splay a little, as anything hanging would), with a slight curl, and stop well above head height over the top's lawn. Stems are thin bark tubes; the leaves are small cards in pairs along them.
  - Drawn with the trees' shared swaying bark, needle and leaf materials (three instanced draws, with the leaves' depth materials for shadows); its trunk is an obstacle. About 8.6 k triangles of bark, 13.5 k of needles and 3.9 k of creeper leaves.
- **Tests** (`deck.test.ts`): nothing in the footprint or the water, planting on all three levels, the build site open, the way up clear, and the pine on the top leaning out past the rim, over 3 u tall and hung with creepers; its roots follow the real cliff (on the top never floating, on the face just outside the wall, continuous, ending on the ground, and at least three reaching down the wall).

### 4.7 Budgets

- **Main bundle:** the footprint and route spec, the layout's clearing, the iron flag and its drop and label, the walk-surface hook, `replaceObstacles`, the two items and their icons.
- **Crafting chunk:** everything else (plan, models, sites, bench, ore).
- **As built:** 449.8 KB initial (≤ 450) and 102.0 KB on demand, over the 96 KB waiver, which is raised to 103 KB and proposed in [plan §6](./plan.md). With the planting and the pine (§4.6): 449.8 KB initial and 105.6 KB on demand, under a proposed 106 KB waiver. With the old pine grown, rooted in the cliff and hung with creepers: 121.8 KB on demand, under a proposed 122 KB waiver.
- **Triangles:** the three builds are a few thousand each (`tests/unit/deck.test.ts` keeps each under 20 k).

## 5. Plan

| Step | What | Where |
|---|---|---|
| 1 | Items `iron`, `nails`, their icons; recipe `nails`; nails in Chopper's house; `DECK_NEEDS` | `inventory/items.ts`, `scripts/gen-icons.py`, `world/craft/recipes.ts` |
| 2 | The cliff redesigned; the route and platform in its frame; the footprint cleared, the trees framing it | `world/features.ts`, `world/deckSpec.ts`, `world/layout.ts` |
| 3 | Heights, walk surfaces, obstacles per stage, corridors, sites, seats, lanterns (pure) | `world/craft/deckPlan.ts` |
| 4 | `Terrain.addSurface`; `controller.replaceObstacles`, `obstacleWatch`, `navOpen`, `deckSeat`; `SphereNav.reblock` | `world/terrain.ts`, `controller.ts`, `world/home/nav.ts` |
| 5 | The models (the three builds, the ore nuggets) | `world/craft/deckModels.ts` |
| 6 | The builds' sites, cards, targets, saving, the bench, the view | `world/craft/deck.tsx`, `world/craft/ui.tsx`, `world/craft/index.tsx` |
| 7 | Iron boulders: the flag, the drop, the prompt | `world/layout.ts`, `controller.ts`, `systems/interactables.ts` |
| 8 | The family's `deck` activity and seat | `world/home/family.ts`, `world/home/seats.ts`, `world/home/index.tsx` |
| 9 | Tests: unit (`deck.test.ts`, crafting, inventory, grass); E2E (iron, nails, the three builds, the climb, the bench); a look on a real GPU | `tests/` |

## 6. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | The deck stands on the two-tier cliff near the home and faces it | Unit (`deck.test.ts`): the cliff within 18 u of the home, `face` within 25° of it | Done |
| 2 | The steps fit: outside the lower wall and on the terrace, clear of both rims; the platform on the top | Unit: rim distances along every piece, the platform's corners inside the upper rim, the path across the lawn clear of the platform | Done |
| 3 | The steps climb steadily from the meadow to the platform, never into the ground and never steeper than about 30° | Unit: heights along every piece, the foot at the ground | Done |
| 4 | It's really walkable | Unit: the walk height has no jump over 0.08 u from the meadow to the bench. The character walks it with collisions (`PlanetSim`), leg by leg, to the bench's front at the platform's height. Rails close the sides. E2E: the climb by click-to-walk to the platform's height. A real-GPU run to the top | Done |
| 5 | The family can route up once it's built, and not before; Prabin goes and sits on the bench | Unit: routes at each stage, none before, and Prabin seated on the bench within 90 s | Done |
| 6 | Built in three stages, each with its site, ghost, card and needs; each unlocks the next; saved | E2E: each stage's card and prompt, the builds, the announcement, the stage after a reload | Done |
| 7 | Iron ore on some boulders, visibly different; mining gives iron ore; nails from it; Chopper's house needs nails | Unit: one boulder in three, some near the crafting table, the recipes. E2E: **Mine iron ore**, the ore in the backpack, 6 nails crafted, the house's card and toast with nails. A real-GPU look | Done |
| 8 | Lanterns on the platform that glow at night | Unit: the platform's model has a glow layer. A real-GPU look at 9 pm | Done |
| 9 | Nothing on the steps or the platform; a tree frames the foot | Unit: the footprint is clear of trees (crowns), rocks, bushes and flowers; a tree near the foot; any tree on the cliff blocks | Done |
| 10 | Budgets | `npm run verify:prod`: 449.8 KB initial; 105.6 KB on demand under the proposed 106 KB waiver | Waiver pending |
| 11 | The steps read as one unit: no part clips into another, the rails never block the way, the lower landing ends flush with the rim | Unit: the walk has no jump over 0.08 u, the way up is clear, the lower landing's end within 0.08 u inside the rim. A real-GPU look at each run | Done |
| 12 | The cliff is lush: bushes, flowers, sprigs and knee-high grass on its levels, and an old pine over the upper rim | Unit (§4.6 tests). A real-GPU look from the meadow and the terrace | Done |
| 13 | No wedge-shaped corners: every bend of every run is obtuse | Unit: each bend wider than 115° (the tightest is about 121°) | Done |
