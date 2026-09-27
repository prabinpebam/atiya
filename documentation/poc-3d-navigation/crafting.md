# Crafting, and Chopper's house (spec and plan: v1, critique, v2 as built)

*The first crafting goal: turn what you collect into building materials and paint, and build Chopper a house of his own beside the family's home. Acceptance checklist: [crafting-dod.md](./crafting-dod.md).*

## 1. Research: how popular games do it

| Game | Crafting | Building | What we take |
|---|---|---|---|
| **Animal Crossing: New Horizons** | The **DIY workbench**: a list of known recipes; the selected recipe shows the item, the materials with icons and *have / need* counts (short ones in red), and a big **Craft** button. You can bulk-craft up to 10. It uses the pocket inventory. A short hammering animation plays, then the item goes into your pockets. Customisation (recolouring) is done with a kit at the workbench or on the item itself | **Housing plots:** a marked plot, a sign listing what's needed, then "build" | The workbench layout and flow, bulk crafting, recolouring the built thing, and a marked plot with its requirements |
| **Stardew Valley** | The crafting menu is a grid of recipes; hovering one shows its materials; a click crafts it | **Community Center bundles:** item slots with what's still missing at a glance; completion rewards | A glanceable checklist of what's missing |
| **Valheim** | Build pieces come from a hammer menu | A translucent **ghost** of the piece in the world, the resources listed with missing ones in red, and placement blocked until you have them | The ghost in the world, and building only when you have everything |
| **Minecraft** | The crafting table grid: 1 log → 4 planks; stone → slabs | — | Recipe yields (1 log → 4 planks), and the crafting *table* as a place you use |
| **My Time at Portia / Coral Island** | Assembly stations; material checklists with "owned / needed" | Construction sites that stay ghosted until paid for | A construction site that turns real when you complete it |

**Pick:** **Animal Crossing's model**, because it fits a cosy walk-up-and-press-E game:
- a workbench screen with a recipe list and a detail pane with *have / need* and a Craft button, plus bulk crafting;
- a marked **construction site** with a sign that lists what's needed and builds when you have it;
- recolouring the built house with paint.

It borrows **Valheim's ghost** for the site: a faint outline that grows clearer as you come closer.

## 2. Plan v1

1. **Crafting table** at the Workshop, used with E, opens a crafting screen.
2. **Recipes:**
   - planks from logs;
   - beams from logs;
   - slabs from stones;
   - paint from flowers of a colour.
3. **Chopper's house:** a site beside the house needing slabs, beams and planks. E builds it once you have them. A ghost outline shows where.
4. **Paint:** craft paint, then use the house to recolour it.
5. **Separation:** remove interactable plants near the chest.

## 3. Critique of v1

| Problem in v1 | Why it matters | v2 |
|---|---|---|
| "Remove plants near the chest" alone | The same accidental activation happens at every special target (the bench, the new crafting table, the house site) | A **keep-clear radius round every special target** (the chest, the crafting table, the site). Flowers are cleared out of it, and trees, bushes and rocks too near are removed. A unit test holds the minimum separation for every pair of targets |
| The Workshop's own workbench doubling as the crafting table | You'd trigger the Workshop's preview or door instead; it's baked into the building's model | The bench leaves the Workshop model. A new, **detailed crafting table** (vise, saw, hammer, chisel, square, pencil, clamps, toolbox, shavings) stands on its own, ≥ 1.3 u beyond the footprint and on the side away from the chest |
| Paint from "corresponding colour flowers", one recipe per flower kind | 21 recipes clutter the list | One recipe per **colour**, taking **any 3 flowers of that colour** (tulip, cosmos or pansy mixed) |
| A building that needs a lot | Grinding on a portfolio site isn't fun | A small first goal: **2 stone slabs, 2 wooden beams and 4 planks**, which is 4 stones (two boulders) and 3 logs (three trees) |
| Rigid recipe amounts | Dull | Minecraft-style yields: 1 log → 4 planks, 2 logs → 1 beam, 2 stones → 1 slab, 3 flowers → 1 paint pot. Bulk craft up to 10, capped by what you have and by room in the backpack |
| A ghost that's always equally visible | Clutter from afar, or unnoticed up close | Opacity eases from nearly invisible (≥ 6 u) to clear (≤ 2 u), with a gentle shimmer. While the site is the target (in reach, in front of you), a **site card** shows the note and checklist |
| Plain requirement text | The brief asks for "a fun cute way" | The card is written from Chopper's side: "Chopper has been eyeing this sunny spot… he'd love a house of his own!", with a paw line and a live checklist |
| Pressing E with materials missing | Silent failure frustrates | The prompt says **See what's needed**; E announces what's still missing and pulses the checklist. With everything ready, the prompt becomes **Build Chopper's house** |
| An instant build | No payoff | A **build moment**: three hammer knocks, a dust puff, the house rising out of the ghost, a sparkle; then Chopper runs over, sits in the doorway and barks happily |
| Painting as a separate hidden menu | Discoverability | Once built, the prompt on the house reads **Paint Chopper's house**. A palette lists your paint pots (each costs one) and the free **Original red** |
| Chopper ignoring his house | It's for him | Once built, he sometimes naps in the doorway when you're nearby |
| Losing the house on reload | Progress lost | The house and its colour are saved (`site.dogHouse`); the materials go through the saved inventory |
| Bundle budget | The initial game bundle is at 449.6 of 450 KB | Everything new (the models, the crafting screen, the site card, the palette, the recipes) lives in its own chunk, loaded with the textures. The inventory screen moves to a lazy chunk to make room for the glue |

## 4. Spec v2 (as built)

### 4.1 Materials and recipes (`world/craft/recipes.ts`, pure)

| Craft | From | Yield |
|---|---|---|
| Planks | 1 wood log | 4 |
| Wooden beam | 2 wood logs | 1 |
| Stone slab | 2 stones | 1 |
| Paint (7 colours: red, pink, yellow, white, orange, purple, blue) | any 3 flowers of that colour | 1 |

- **Bulk crafting:** 1 to 10 at once, capped by the materials in the backpack and by room for the result.
- **Rules:** materials are taken from the backpack only. The results go into the backpack; anything that doesn't fit drops at your feet.
- **Icons:** the new items' icons are painted against the golden style set (planks, beam, slab, and a white paint pot re-tinted for each colour).

### 4.2 The crafting table

- **The model** (`world/craft/models.ts`, `craftingTableModel`): a sturdy workbench with a butcher-block top, a vise holding a plank, a saw, a hammer, a chisel, a try-square, a pencil, two red C-clamps, a blue toolbox, a peg rail with a mallet, a hand drill and a coil of rope, a lower shelf with spare planks and a log, and shavings on the top and on the ground. One kit mesh: 2 draw calls with its shadow.
- **Placement** (`world/layout.ts`): beside the Workshop, 1.3–2.2 u beyond its footprint, ≥ 1.3 u off the paths (the spawn–landmark lines), ≥ 2 u from the chest, ≥ 1 u from trees, bushes and rocks, clear of the river, the mesas and the other landmarks, facing the Workshop's approach. It's solid (a 0.5 u collision circle).
- **Prompt:** **Use crafting table** (E).
- **The screen** is Minecraft's layout, specified in [Crafting screen and HUD chrome](../game-ui/crafting-screen.md):
  - **Top:** the recipes as a grid of icons (names only in the detail and the tooltips; a ×n badge on what you can make now), and the selected recipe's detail: the result, its name and line, one slot per material (1 to `MAX_NEEDS` = 4) with *have / need* and a mark (green when there's enough, red when short), a quantity stepper (− / +) and **Craft**.
  - **Below:** your backpack and hotbar, with all the inventory screen's gestures ([collecting and inventory](./collection-inventory.md)).
  - **Keys:** ← → ↑ ↓ pick a recipe, − / + (or PgDn / PgUp) change the quantity, Enter crafts (Shift+Enter: as many as you can), Esc or E closes.
  - **Crafting:** a short hammering (0.6 s) with a knock and a progress bar, then the result flies from the detail into the slot it landed in, which pops, announced with where it went ("Crafted 8 planks: in hotbar slot 3."). Under reduced motion the slot only pops.
  - **Accessibility:** a labelled modal dialog; the recipe grid is a `listbox` with `aria-activedescendant`, focused on open, each option named with its recipe; the material slots, the stepper buttons and Craft have their own names; every selection and craft is announced; focus returns to the planet on close. Pointer: click a recipe, − / +, **Craft** (Shift+click: as many as you can), or click outside to close.

### 4.3 Chopper's house (the construction site)

- **The site** (`world/homestead.ts`, `dogHouse`): 3.4 u from the family's house, 108° off its front (moved out so its levelled pad stays clear of the house's; see [ground.md](./ground.md)), facing the pond; a 1.2 u disc is kept clear, and the family's `blocked` keeps them off it whether it's built or not.
- **The ghost:** a translucent pale-blue outline of the house, from nearly invisible (≥ 6 u) to clear (≤ 2 u), with a slow shimmer.
- **The site card** (while the site is the target, so it never shows while you use the crafting table or water the garden nearby; at the lower left, beside the scene rather than over the ghost and the character; centred above the prompt on narrow screens):
  - the title "Chopper's house";
  - a cute note from Chopper's side;
  - a checklist with icons and *have / need* ticks.
- **The prompt:**
  - **See what Chopper's house needs**: E shows (and announces) what's still missing, e.g. "Chopper's house still needs 2 wooden beams and 3 planks. Craft them at the crafting table by the Workshop."
  - **Build Chopper's house**, when you have everything.
- **Building:** takes the materials; the house is saved and solid at once, and the build moment plays (2.2 s): three knocks and ten dust puffs as the house rises out of the ghost with a little overshoot, then a sparkle. Chopper runs over, sits in the doorway facing out and barks (`ChopperBrain.visitHouse`). If you're standing in its footprint you're stepped out first.
- **The built house:**
  - **Look:** a little gabled doghouse on a stone-slab base, with a plank body and beam corners, a red roof (the default), a round doorway, a bone plaque over it and a food bowl.
  - **Collision:** solid.
  - **Chopper:** a `house` behaviour in his utility AI: when the house is near you and him, and more so when he's tired, he trots over and lies down in the doorway for 9–15 s (then a 70 s cooldown).
- **Painting:** **Paint Chopper's house** (E) opens a palette: Original red (free) and the seven paints, each with how many pots you have (the ones you have none of are disabled). Arrow keys move between them, Enter or a click paints (one pot), Esc closes. The roof, the barge boards and the door's arch change colour at once, and the colour is saved.

### 4.4 Keeping targets apart (`world/layout.ts`)

- **The keep-clear disc:** around each special target (the chest, the crafting table, the house site), 1.5 u. Flowers inside it are removed.
- **Solids:** trees, bushes, rocks and boulders whose edge comes within 0.9 u of the special's edge are removed.
- **Test:** the unit test checks that no other usable target is within the keep-clear distance of a special one.

### 4.5 Budgets

| | Budget |
|---|---|
| Initial game JS | ≤ 450 KB gz. The glue only: the targets, the store and the controller hooks. **As built: 448.2 KB** |
| On-demand JS | The crafting chunk (the models, the screens, the recipes); ≤ 60 KB for all on-demand chunks together (a waiver is proposed, since the home and crafting outgrew 40 KB). **As built: 48.8 KB in all; the crafting chunk is 8.8 KB** |
| Draw calls | ≤ +8 at the spawn view (the crafting table); the house or ghost ≤ 4. **As built: 192–193 at spawn (was ≈ 191; the Workshop's own bench is gone), 185–187 at the house; 60 fps on the reference GPU; 0 NaN pixels** |
| Icons | +10 WebP files (planks, beam, slab, 7 paints), ≈ 30 KB, fetched when shown. **As built: 36 icons, 108 KB in all** |

**Making room in the initial bundle:** the glue needed ≈ 3 KB. The inventory screen (`ui/InventoryPanel.tsx`) and the menu (`ui/MenuDialog.tsx`) now load on demand and are fetched in the background soon after start; the talk box moved into the home chunk (`world/home/TalkBox.tsx`, `HomeAttachment.Hud`); the wildlife is its own chunk (`controller.wildlifeView`), with the tangent-steering helpers it shares with Chopper and the family in `math/steer.ts`; and the prompt icons for the table and the site come from the crafting chunk (`CraftAttachment.promptIcon`). **Later (watering the garden):** the chunk now adds the table and site targets itself, each carrying its own label, use and icon (`Target.label / use / icon`), with their reach in `TARGET_REACH` (`world/craft/recipes.ts`); `CraftAttachment` no longer has `siteLabel`, `useSite` or `promptIcon`.

### 4.6 Tests

- **Unit:**
  - recipes: yields, bulk caps, room for the result, "any 3 of a colour";
  - inventory `remove`;
  - the keep-clear separation;
  - the house's requirements and the painting rules.
- **E2E:**
  - the crafting table prompt and screen: craft planks, the counts change, it passes axe, Esc closes;
  - the site: the ghost, the card, "See what's needed", then with materials given it builds, is saved and survives a reload;
  - painting.
- **As built:** `tests/unit/crafting.test.ts` (19 tests: the recipes and their icons, crafting counts, "any 3 of a colour" taking the most plentiful kind first, the bulk caps by materials and by room, overflow, `remove`, the house's needs and message, paint and the saved state, the table's and the site's placement, the keep-clear separation, "only that target from every side", and Chopper sitting in the doorway and napping there only once it exists). E2E "crafting & Chopper's house" (2 tests). Real-GPU renders of the table, the screen, the ghost at 11 / 7 / 4 / 2 u, the build moment, the painted house by day and night.
- **Test hooks:** `craft()` (built, colour, building, the ghost's visibility, whether the card is up) and `nearTarget('craft' | 'site', which, u)`.

## 7. "Ready to use" cues on the chest and the crafting table (owner review)

The owner asked for a sign on the chest and the table themselves that they're ready to use, with some
life in it: the tools coming to life as you come near, the chest giving a wiggle.

**Research.** Games tell you something can be used in two layers. A **wake** on approach: a short,
one-shot animation that catches the eye just as it becomes usable (Animal Crossing's presents and
fossil spots wobble, Genshin's chests glint and shiver, Zelda: Breath of the Wild's chests and shrines
light up as you come to them). And a **steady sign** while it stays usable (a glow, glints), so you know
it's still the one E will use. The wake follows the animation principles in "Juice it or lose it"
(Jonasson and Purho, GDC 2012) and Swink's *Game Feel*: anticipation (a crouch), squash and stretch, a
decaying wiggle, overlapping action (a ripple across several parts, not all at once), and settling. Under
reduced motion, the motion goes and the steady sign stays (WCAG 2.3.3; Apple's and Android's guidance).

**Spec (as built).**

- **When:** a cue wakes when its target becomes what E would use (the prompt appears: the controller's
  `target`), not on distance, so it never promises something E won't do. It wakes once per approach;
  staying doesn't retrigger it. `ReadyCue` (`systems/readyCue.ts`, pure) holds the edge-triggered wake
  time and an eased 0…1 level (in at 7/s, out at 5/s). The controller steps `chestCue` and `craftCue`
  every frame.
- **The chest:** a 0.85 s wiggle about its base (roll ±0.14 rad at 5.5 Hz with a decaying envelope, a
  little pitch), a crouch then a stretch (height ×0.9 → ×1.07, keeping its volume), and the lid rattling
  up to 0.3 rad. Then it **rests ajar** (0.13 rad) with a **warm glow inside**, seen through the gap (HDR,
  so it blooms), and glints drift up over it. Opening it (the chest screen) takes over from the ajar lid.
- **The crafting table:** the loose tools (the hammer, saw, chisel, square, pencil and the hanging mallet)
  are separate pieces about their own pivots. They **hop to life** in a ripple across the bench (each 0.5 s
  hop starting 0.07 s after the last, 11–16 cm up with a spin), land, and then keep an idle motion while
  you stay: the hammer lifts and taps down every 1.4 s (about the level axis across its handle), the saw
  rocks, the mallet swings on its peg, the rest bob. Glints drift up over the bench.
- **Glints** (`world/Sparkles.tsx`): small three-axis golden twinkles in the glow layer, one instanced
  draw with no instances while off; they drift up and fade in turn. Under reduced motion they hold still.
- **Reduced motion:** no wiggle, hop or idle; the chest still rests ajar and glows, and the glints show,
  still.
- **Budgets:** +6 draw calls at the workyard for the tool pieces, and one for the chest's glow plate; the
  glints draw nothing while off. About 1.2 KB gz in the initial bundle (447.0 of 450 KB).
- **Tests:** unit `tests/unit/readyCue.test.ts` (it wakes once per approach and eases in and out; the
  wiggle's range and its return to rest; reduced motion keeps only the steady sign; the tools' ripple,
  landing and idle, within bounds; the hammer's tap lifts its head; the glints stay in their box).
  E2E "the chest and the crafting table show they are ready…" (shut and dark at rest; walking up wakes the
  chest once, then it rests ajar, glowing, with glints; at the table the tools move and glint; the chest
  settles shut again). Test hook `readyCues()`.

