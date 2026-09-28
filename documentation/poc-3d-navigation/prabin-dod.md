# Prabin, navigation, seats, doors, Chopper's house and the plaza: Definition of Done

This is the acceptance checklist for [prabin-npc.md](./prabin-npc.md). A box is ticked only with evidence: an automated test, or a real-GPU check.

## 1. Chopper's house

- [x] **A real inside:** a plank floor, a padded bed, a bone toy, a blanket, a name plaque and a hanging lantern, seen through an open arched doorway at Chopper's scale.
  - *Evidence:* a real-GPU close-up (`screenshots/doghouse-night.png`: the bed, the plank floor, the lit room, the plaque); unit (the doorway is taller than Chopper, 0.56 u, and 0.42 u wide).
- [x] **Lit at night:** the lantern glows and is a real lamp at night (0 by day); the lamp count stays ≤ `LAMP_MAX`.
  - *Evidence:* E2E "Chopper's house at night" (more lamps lit at night, ≤ 10); real GPU: 8 lamps at night at spawn and at the home.
- [x] **Chopper goes inside:** he walks in, turns and sits or lies inside facing out, and walks out first when he's called away. He does this on the build moment and now and then on his own.
  - *Evidence:* unit "goes in when it is built, sits on his bed facing out, lifted onto the floor…" (and out through the doorway first when whistled); E2E; `screenshots/doghouse-night.png`.

## 2. The front door

- [x] **It opens and closes:** a hinged leaf swings open when someone goes in or out and shuts after them.
  - *Evidence:* unit "the front door…"; E2E "bedtime: the front door swings open…"; `screenshots/door-open.png` (Rojina on the steps, the room behind the open door).
- [x] **They climb in and come out:** up the steps and through the doorway, one at a time, then hidden; in the morning the reverse.
  - *Evidence:* unit (only one in the doorway at a time; the door ≥ 0.85 open while anyone passes; out again in the morning); the view lifts them along the steps' heights (`FamilyView.tsx` `STEPS`).

## 3. Navigation for everyone

- [x] **A planner for the whole planet:** a route between any two open points (seams included), round obstacles, never through the pond or deep water.
  - *Evidence:* unit "covers the whole sphere…", "plans across the planet round obstacles…", "plans round a walker standing in the way".
- [x] **Nobody walks through anybody:** the family, Prabin, Chopper and the character keep their minimum gaps; two walkers meeting head-on pass each other.
  - *Evidence:* unit "two walkers meeting head-on pass…", "over minutes of a whole day, nobody walks through anybody…", and the family's "nobody walks through anybody".
- [x] **Nobody stays stuck:** Chopper and the family get round a rock or a corner (a planned route, stuck repair).
  - *Evidence:* unit "a walker boxed behind a boulder gets round it…", "Chopper follows a planned route round a boulder…"; Chopper also drifts back instead of idling at the leash's end (the Chopper tests).

## 4. Seats

- [x] **A chair for Prabin** at the family table (four chairs).
  - *Evidence:* unit "four chairs at the table…"; the family's meal test (four on four different chairs).
- [x] **No walking through chairs:** they walk to an entry point, then sit down onto the seat; they stand up the same way.
  - *Evidence:* unit "every seat has entry points outside its chair…", "they walk to the entry point (never through the chair)…".
- [x] **Sitting properly:** the hips rest on the seat at its height, for every body size; the body doesn't sink into the chair.
  - *Evidence:* unit "the hips rest on each seat at its own height, for every body…"; `screenshots/family-table.png` (all four seated on their chairs).

## 5. Prabin

- [x] **Looks:** the playable Skater model with his own T-shirt, trousers, shoes and dark hair.
  - *Evidence:* `screenshots/prabin-hammer.png`; `public/models/skins/prabin.webp` from `compose-family.py`.
- [x] **Roams the whole planet** doing his activities: strolling, admiring a building, playing with Chopper (fetch), playing the guitar in the campfire chair, hammering at the crafting table; home for meals and the night.
  - *Evidence:* unit "finds a place to admire every building…", "works at the crafting table…", "plays the guitar in the campfire chair…", "plays fetch with Chopper…", "roams the whole planet…" (> 15 u from home; stroll, admire, hammer, fetch; home at night); real-GPU renders of hammering, admiring, the guitar and fetch.
- [x] **Talk to him:** facing him close by, **Talk to Prabin** (E) opens the dialog with preset lines through a `DialogueProvider`.
  - *Evidence:* E2E "Prabin: he starts by the crafting table; Talk to Prabin…".
- [x] **The visitor has priority** at the crafting table.
  - *Evidence:* unit "works at the crafting table, but gives it up to the visitor…".
- [x] **Visitors are the playable character:** the family's lines greet a visitor.
  - *Evidence:* the lines reviewed (Rojina now welcomes a visitor); unit "talks to the visitor as a host…".

## 6. The plaza

- [x] **The bench** stands by the Greenhouse bridge, on dry ground off the path; the one **notice board** is the Town Hall's, on its side toward the Lighthouse; no signposts.
  - *Evidence:* unit "puts the bench by the Greenhouse bridge…", "keeps pickable flowers off the bench too", pads "the base boxes still cover their models" (the Town Hall's box includes the board); real-GPU renders (the bench beside the bridge's plaza end, the Town Hall from the front and behind); E2E "benches".
- [x] **The chest and crafting table** stand between the Post Office and the Workshop, comfortably apart, clear of the paths and the buildings, with nothing else usable near them.
  - *Evidence:* unit "stands the chest and the crafting table side by side…", the chest and crafting-table placement tests and the keep-clear tests; E2E (the chest's and the table's prompts); a real-GPU render of the workyard from the plaza.

## 7. Revision 2 (owner review)

- [x] **The way to the workyard is open** (the plaza planter gone). *Evidence:* unit (layout), a real-GPU render.
- [x] **The home is spread out,** the reading chair off the door's path, the lawn in front of the door clear. *Evidence:* the site-plan unit tests; real-GPU renders from above and from the plaza side.
- [x] **Prabin doesn't get stuck:** zero 3-second stalls over 140 simulated minutes (14 seeds); five seeds in the regression test. *Evidence:* unit "never stalls…".
- [x] **The guitar is held:** both hands on it by IK; a synthesised strum sounds from it on each downstroke. *Evidence:* real-GPU close-ups; the sound log shows the strums (chords G, C, D, Em); unit (the synthesis).
- [x] **Revision 4 (the guitar and the children):** he never walks off with the guitar, plays it in his lap with both elbows bent (≈ 100°), isn't interrupted by the family while he plays, and walks over to chat with the children. *Evidence:* unit "leaves the guitar on its chair whenever he gets up…", "isn't drawn into a chat while he plays…", "goes over to the children for a chat…"; E2E "Prabin plays the guitar in his lap with both elbows bent…"; a real-GPU close-up from the front; 20-seed survey (chats with the children in 19).
- [x] **Chopper's black patch** on his right flank. *Evidence:* real-GPU renders of both sides.
- [x] **Paws on the ground** in every pose, the play bow's bark included. *Evidence:* unit "keeps every planted paw on the ground…", "in the play bow, a bark leaves the front paws where they are".

## 7b. Revision 3: the lived-in home

- [x] **No tree in front of the house** (the cedar by the door and the hardwood where the garden is are cleared). *Evidence:* unit "puts the tulsi on its own spot in front of the door… and no tree in front"; real-GPU renders of the front of the house and of the game view as you come to it.
- [x] **A fence behind the house,** low, walked round, not through. *Evidence:* unit "keeps the fence and the vegetable beds behind the house…"; real-GPU render of the yard.
- [x] **A vegetable garden:** a cabbage bed and a tomato bed, a watering can. *Evidence:* the same unit test; "can be walked into…"; real-GPU render.
- [x] **A tulsi vrindavan in front,** on the door's axis on its own small round cobbled spot, its diya's niche facing the house, the diya lit after dusk. *Evidence:* unit (family "puts the tulsi on its own spot…", pads "gives the tulsi its own small round cobbled spot…"); real-GPU renders by day and night; `lamps()` 8 at night (9 with Chopper's house).
- [x] **The gable window** sits in the front gable wall, clear of the porch roof. *Evidence:* real-GPU render of the house.
- [x] **The pond** is bigger (1.8 u) and more irregular, its bank facing the house open. *Evidence:* unit "has an organic shoreline…", "keeps the bank facing the house open…"; real-GPU render.
- [x] **The pond bench:** the visitor and the family sit on it and feed the ducks; E feeds, Escape stands up; the duck swims to the crumbs. *Evidence:* `tests/unit/ducks.test.ts`; a real-GPU run through the test hook (sat, 4 handfuls, the duck 0.1 u from the crumbs, both buttons shown, no page errors).
- [x] **Lived in:** sandals on the step, a broom by the door, a woodpile. *Evidence:* real-GPU renders.

## 8. Engineering

- [x] **Tests:** unit and E2E pass; `astro check` is clean.
  - *Evidence:* 35 unit files (287 tests; 295 after revision 3); the full E2E suite; `npm run check` (0 errors, 0 warnings, 0 hints).
- [x] **Budgets:** initial game JS ≤ 450 KB gz; on demand ≤ 70 KB (waiver proposed in plan §6); the navigation grid builds in ≤ 60 ms; no NaN pixels; 60 fps on the reference GPU.
  - *Evidence:* `npm run verify:prod` (444.9 KB initial, 61.3 KB on demand; after revision 3, 445.8 KB and 64.4 KB); the grid in ≈ 31 ms (unit timing); real GPU: 197 / 218 draw calls at spawn / the home by day (+4 / +10), 16.7 ms median frames, 0 bad pixels in `hdrScan`, 8 lamps at night.
- [x] **Docs:** this spec as built, spec §4.21, README (feature, screenshots, controls, DoD rows), AGENTS, CREDITS, family.md, plan §6.
