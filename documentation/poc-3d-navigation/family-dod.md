# Home and family: Definition of Done

This is the acceptance checklist for the home by the pond and the family NPCs ([family.md](./family.md)). It covers the original brief, the owner's later revisions (which override the brief where they conflict), and the routine, continuity and collision requirements. Every box is ticked only with evidence: an automated test, or a real-GPU check recorded in [family.md §8b](./family.md#8b-as-built).

**Owner revisions to the brief:**
- **Rojina's look:** "jeans and shirt with medium-length straight dark hair" became *a ponytail like the playable female character, a T-shirt and trousers*. Glasses were kept.
- **Laija's "leaning down and…":** the brief was cut off here. It is built as crouching to look at flowers and bugs, and is to be confirmed.

## 1. The home

- [x] **House:** a cosy house (the owner's home) stands near the pond on dry, level-enough ground.
  - Built from painted kit surfaces: plaster, shingles, stone, brick, wood.
  - *Evidence:* unit "home by the pond: the site plan"; E2E "the family lives by the house…"; real-GPU renders by day and night.
- [x] **Campsite:** a stone fire ring, camp chairs, a log bench and a guitar, near the house.
  - *Evidence:* site-plan test (features and spacing); renders.
- [x] **Picnic:** an outdoor table with a chair for each of the family, and a painted picnic mat on the grass.
  - *Evidence:* site-plan test (three table chairs); renders.
- [x] **Spacing:** the big features are ≥ 1.4 u apart, and each is clear of every other obstacle, the river and the pond.
  - *Evidence:* site-plan test.
- [x] **Scale:** the furniture and props are scaled to the characters: seats about 0.35 u, the table top about 0.5 u.
  - *Evidence:* renders (Rojina sits in her armchair; the children at the table).
- [x] **Textures:** generated or painted textures throughout. The kit surfaces, the gingham mat (GPT Image 2.5) and the family's skins.
  - *Evidence:* textures unit test (the manifest entry and its prompt); renders.
- [x] **Day and night:**
  - Lit windows, the porch lantern and the fire are real lights at night.
  - String lights glow.
  - Smoke by day, embers and bigger flames by night.
  - *Evidence:* real-GPU night renders; ≤ 10 lamps lit.
- [x] **Surroundings:** nothing else on the planet moved (the rest of the layout is unchanged).
  - *Evidence:* the site-plan test (only the home's discs are cleared); all other E2E tests pass.

## 2. The family: looks

- [x] **Rojina:** ponytail and scrunchie (Sunny's model), glasses, a teal T-shirt with short sleeves, navy trousers, tan flats. Adult height.
  - *Evidence:* renders.
- [x] **Laija (9):** a pink star T-shirt, trousers, purple sneakers, pigtails. Child height, with a slightly larger head.
  - *Evidence:* renders.
- [x] **Lingjel (5):** a blue T-shirt with a red car ("loves cars"), khaki shorts, green crocs. Smaller still.
  - *Evidence:* renders.

## 3. The family: what they do

- [x] **Rojina:**
  - sits in her chair reading;
  - looks at the kids;
  - talks to the kids;
  - puts food down on the picnic table.
  - *Evidence:* unit behaviour tests ("does a variety of things", "Rojina lays the table"); pose renders.
- [x] **Laija:** every item in the brief.
  - walks or runs about;
  - chases butterflies and rabbits;
  - reads under a tree;
  - talks to Rojina or Lingjel;
  - paints lying face down;
  - throws pebbles into the pond, from a **different spot along the shore each time**;
  - crouches to look at flowers.
  - *Evidence:* unit tests ("variety", "pebbles land in the pond", "different spots along the shore"); pose renders.
- [x] **Lingjel:**
  - walks or runs about;
  - chases butterflies and rabbits;
  - crawls pushing toy cars;
  - plays with Lego;
  - talks to Rojina or Laija.
  - *Evidence:* unit behaviour test; pose renders.
- [x] **Variety:** each one does ≥ 3 different things over 7 minutes, never the same thing twice running (an interruption may be resumed).
  - *Evidence:* unit "does a variety of things…".
- [x] **Talking in pairs:** two of them meet, face each other, and a speech bubble shows over whoever is speaking.
  - *Evidence:* unit test (bubbles seen).

## 4. Routine and continuity

- [x] **Night:** from **8 pm** they walk to the front door and go inside (not drawn, not talkable). They come out one by one at **6 am**.
  - *Evidence:* unit "go in at 8 pm and come out at 6 am…"; E2E "the routine…".
- [x] **Delay after a manual clock change:** after the clock is set by hand (a jump of more than 15 minutes), they wait **8 s** before following it.
  - When the time passes 8 pm or 6 am naturally, they respond at once.
  - Loading the page at night finds them already inside.
  - *Evidence:* the same unit test (nothing happens within the delay); E2E.
- [x] **Meals:** when Rojina puts food on the table, everyone comes to eat, each at their own chair.
  - After a while Rojina gathers it into the basket and carries it in, and the children go back to playing.
  - There is no food left behind, and nobody sits at an empty table.
  - *Evidence:* unit "when lunch is on the table everyone comes to eat…"; real-GPU render of the meal.
- [x] **Stuck:** anyone who can't make progress for 1.5 s picks something else (the routine and meals excepted: they carry on).
  - *Evidence:* unit behaviour test (never stuck ≥ 2 s).

## 5. Movement, avoidance and collision

- [x] **Route planning:** A* on a navigation grid over the home ground, round the house, furniture, trees and the pond, smoothed into straight legs.
  - *Evidence:* unit "plans a route round the house…" (every leg clear of obstacles and water, the detour < 2× the straight line).
- [x] **Nobody walks through anybody:**
  - The family keep ≥ 0.36 u from each other, ≥ 0.55 u from the character and ≥ 0.42 u from Chopper.
  - The character collides with the family and with Chopper.
  - Chopper steps round the family.
  - *Evidence:* unit "nobody walks through anybody…"; Chopper's unit tests (leash, gaps); E2E suite (walking still works everywhere).
- [x] **Home ground:** they keep to the home and out of the pond.
  - *Evidence:* unit behaviour test.

## 6. Animation quality

- [x] **Clips play:** walking and running play their clips, so there's no frozen T-pose.
  - *Evidence:* E2E (each one's arm swings while walking).
- [x] **Heads stay steady:** they turn at most a little from the neck, with no spinning.
  - *Evidence:* E2E head sampling; a real-GPU measurement (≤ 0.07 rad per frame).
- [x] **Poses:** read, sit, eat, read against the tree, paint face down, crawl with a car, Lego, throw, crouch, talk, fetch and place all hold and ease in and out.
  - *Evidence:* real-GPU pose gallery (family.md §8b).
- [x] **Chopper:** his head no longer vibrates; his look and turn are eased, and his shake-off is gentler and rarer.
  - *Evidence:* real-GPU measurement (worst change 0.02 rad per frame); Chopper's unit tests.

## 7. Talking to them

- [x] **Prompt:** facing one of them within 1.3 u shows **Talk to …** (E).
  - *Evidence:* E2E "talk to Rojina…".
- [x] **Box:** they stop and face you; the dialog box has a name plate and types the line.
  - E completes the line, then goes on; Esc ends it and hands the keys back.
  - Movement is paused while talking.
  - *Evidence:* E2E (all of it); unit "stops and turns to the character…".
- [x] **Lines:** preset, generic lines — a greeting for the time of day, one about what they're doing, one from their pool — never repeating until the pool is used up, and no invented personal facts.
  - *Evidence:* unit "never repeats a line…".
- [x] **Accessibility:**
  - every line is announced in the live region;
  - the box is a labelled `role="dialog"`;
  - the reveal is instant under Reduce motion;
  - axe finds no serious issues.
  - *Evidence:* E2E (live region, axe).

## 8. Engineering

- [x] **Tests:** unit and E2E suites all pass; `astro check` is clean.
- [x] **Performance:** at the spawn view, ≤ 30 more draw calls and ≤ 90 k more triangles, 60 fps, and no NaN pixels by day or night.
  - *Evidence:* family.md §8b.
- [x] **Bundle:** initial game JS ≤ 450 KB gz; on-demand chunks ≤ 40 KB. The home is its own chunk, loaded with the textures.
  - *Evidence:* `npm run verify:prod` (waiver proposed in plan §6).
- [x] **Docs:** family.md (spec, critique, as built), spec §4.19, README, AGENTS and CREDITS are up to date.
