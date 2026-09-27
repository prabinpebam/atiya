# Crafting and Chopper's house: Definition of Done

This is the acceptance checklist for [crafting.md](./crafting.md). A box is ticked only with evidence: an automated test, or a real-GPU check.

## 1. Targets kept apart

- [x] **Near the chest:** no pickable flowers, and no shakeable tree or minable boulder, within the keep-clear distance of the storage chest.
  - The same holds round the crafting table and Chopper's house site.
  - A unit test checks every pair of usable targets.
  - *Evidence:* unit "keeps flowers, trees, bushes, rocks and boulders clear of the chest, the crafting table and the site" (flowers ≥ 1.5 u from each special's edge, trees and boulders ≥ 0.9 u less the scale margin, the specials ≥ 2 u apart).
- [x] **Unambiguous:** walking up to the chest, the crafting table or the site offers that target and nothing else.
  - *Evidence:* unit "offers only the special target when you stand at it" (from 8 sides of each); E2E: **Open chest**, **Use crafting table**, **See what Chopper's house needs** / **Build** / **Paint Chopper's house** prompts.

## 2. The crafting table

- [x] **Separate from the Workshop:** the Workshop's built-in workbench is gone.
  - A detailed crafting table stands on its own: a vise, a saw, a hammer, a chisel, a square, a pencil, clamps, a toolbox and shavings (plus a peg rail with a mallet, a hand drill and rope, and a shelf of spare planks).
  - It's placed ≥ 1.3 u beyond the Workshop's footprint, away from the chest and clear of obstacles and water.
  - *Evidence:* unit "stands the crafting table on its own…"; real-GPU renders (`screenshots/crafting-table.png`).
- [x] **Its own prompt:** walking up to it offers **Use crafting table** (E), even inside the Workshop's preview area.
  - *Evidence:* E2E "the crafting table…" (the Workshop is `nearby`, its card makes way, the prompt has E).

## 3. Crafting

- [x] **Recipes:** planks (1 log → 4), a wooden beam (2 logs → 1), a stone slab (2 stones → 1), and paint in each of the 7 bloom colours (any 3 flowers of that colour → 1).
  - *Evidence:* unit "has planks, a beam, a slab and a paint for each of the 7 bloom colours", "makes paint from any 3 flowers of a colour…".
- [x] **The screen (Animal Crossing style):**
  - a recipe list with icons and "can make N";
  - a detail pane with materials *have / need* (short ones marked);
  - a quantity stepper (1–10, capped by materials and room) and **Craft**.
  - *Evidence:* E2E (×12, 3 / 1 → 3 / 2, the short beam); unit "bulk crafting: 1 to 10…", "…capped by room for the result"; `screenshots/crafting-screen.png`.
- [x] **Crafting takes and gives the right counts:** the materials leave the backpack and the result goes in (or drops at your feet when full).
  - It's announced and saved with the inventory.
  - *Evidence:* unit "crafts…", "reports what did not fit…"; E2E (3 logs → 8 planks and 1 log; 4 stones → 1 slab and 2 stones).
- [x] **Keyboard and accessibility:** ↑ ↓, ← →, Enter and Esc work; the dialog is labelled; focus returns to the planet on close; axe finds no serious issues.
  - *Evidence:* E2E "the crafting table…" (keys, axe, focus back on the game region); the palette too (axe) in "Chopper's house…".
- [x] **Icons:** planks, beam, slab and the 7 paint pots have painted icons from the golden style set.
  - *Evidence:* unit "registers every result as an item with an icon from the golden-set manifest"; `assets-src/icons/contact-sheet.png` reviewed.

## 4. Chopper's house

- [x] **The ghost:** beside Rojina and Prabin's house there's a subtle ghost outline of Chopper's house. It grows more visible as you walk closer.
  - *Evidence:* E2E (visibility < 0.2 at 11 u, > 0.85 at 3 u); real-GPU renders at 11, 7, 4 and 2 u.
- [x] **The site card:** close by, a card explains in a fun, cute way that Chopper wants a house, with a checklist of what's needed (have / need).
  - *Evidence:* E2E (the card at 3 u, not at 11 u; 0 / 2, 0 / 2, 0 / 4, then 2 / 2, 2 / 2, 4 / 4); `screenshots/dog-house-site.png`.
- [x] **Building:**
  - Without everything, E says what's still missing and builds nothing.
  - With 2 stone slabs, 2 wooden beams, 4 planks and 6 nails (nails since the viewing deck), E builds it: the materials are taken, there's a build moment, and Chopper comes to it.
  - *Evidence:* unit "needs 2 stone slabs…", "building takes exactly the materials"; E2E (the toast, then the build; Chopper's behaviour is `house`); a real-GPU render of the build moment (dust, the house rising).
- [x] **Saved:** the house stays built after a reload. It's solid (you can't walk through it).
  - *Evidence:* E2E (reload; before the build you can stand in its spot, after it there's nowhere to stand inside it).
- [x] **Painting:** it starts in its default colour. With paint crafted from flowers you can recolour it at any time, which uses one pot. Original red is free. The colour is saved.
  - *Evidence:* unit "paints with one pot…", "reads its saved state defensively"; E2E (blue uses the pot and survives a reload; red is disabled without a pot); `screenshots/dog-house.png`.
- [x] **Chopper uses it:** once built, he sometimes naps in its doorway.
  - *Evidence:* unit "comes to sit in the doorway when it is built, facing out", "now and then naps there of his own accord, but never without a house".

## 4b. "Ready to use" cues (owner review; crafting.md §7)

- [x] **The chest shows it's ready:** as it becomes the target it wiggles (a crouch, a stretch, its lid rattling), then rests ajar with a warm glow inside and glints over it; it settles shut when you leave.
  - *Evidence:* unit `readyCue.test.ts`; E2E "the chest and the crafting table show they are ready…"; real-GPU frames of the wake and the steady state by day and night.
- [x] **The crafting table's tools come to life:** they hop up in a ripple across the bench and land, then keep moving while you stay (the hammer taps, the saw rocks, the mallet swings, the rest bob), with glints over it.
  - *Evidence:* the same unit and E2E tests; real-GPU frames.
- [x] **Reduced motion:** no motion, but the steady sign (the ajar, glowing chest; still glints) stays.
  - *Evidence:* unit "under reduced motion nothing moves, but the steady sign … still shows".

## 5. Engineering

- [x] **Tests:** unit and E2E suites pass; `astro check` is clean.
  - *Evidence:* 34 unit files (265 tests) and the full E2E suite; `npm run check`.
- [x] **Budgets:** initial game JS ≤ 450 KB gz; on-demand chunks within budget (waiver in plan §6); ≤ +8 draw calls at spawn; no NaN pixels; 60 fps on the reference GPU.
  - *Evidence:* `npm run verify:prod` (448.2 KB initial; 48.8 KB on demand, ≤ 60 KB with the waiver proposed in plan §6); real GPU: 192–193 calls at spawn (was ≈ 191), 16.7 ms median frames, 0 bad pixels in `hdrScan` at spawn, the table and the house by day and night.
- [x] **Docs:** crafting.md (as built), spec §4.20, README (feature, controls, DoD rows), AGENTS and CREDITS.
