# Home and family: the house by the pond, and three NPCs (spec, as planned and built)

*Status: built (spec §4.19). Acceptance checklist: [family-dod.md](./family-dod.md). Unit tests in `tests/unit/family.test.ts`, E2E "home & family".*

*The owner's home on the little planet: a cosy cottage by the pond with a campsite, a picnic spot,
and his family living there: **Rojina** (his wife), **Laija** (9) and **Lingjel** (5). Walk up to
any of them and press E to chat.*

## 1. Research: what the industry does

| Topic | Established practice | Sources |
|---|---|---|
| Ambient NPC life | **Smart objects** advertise what they're for (a chair: "sit, read"; the pond's edge: "throw pebbles"; a mat: "paint, play"), and a **utility AI** scores them against the NPC's personality and state, with no-repeat memory and cooldowns so patterns don't show. Time-of-day **schedules** bias the choice | The Sims (smart objects / advertising); Stardew Valley and Animal Crossing schedules; Dave Mark's utility AI ([CenterConsulting on smart objects](https://www.centerconsulting.com/ai-library/concepts/smart-objects), [Ambient NPC Behavior Framework](https://github.com/EricBL3/ambient-npc-behavior-framework)) |
| NPC ↔ NPC life | Pairs meet and "talk" (face each other, gesture, speech-bubble barks), so the world looks social without any player involvement | Animal Crossing villagers chatting; Stardew Valley NPC pairs |
| Talking to an NPC | Walk up, a prompt appears; press the action button; the NPC **stops and turns to face you**; a **dialog box** with a **name plate** shows the line with a **typewriter reveal**; one press completes the line, the next press advances; a blinking "more" marker; the last press closes. Lines come from **preset pools**, context-aware (time of day, what they're doing), never repeating straight away | Animal Crossing: New Horizons, Stardew Valley, Zelda ([Unity dialogue system notes](https://uhiyama-lab.com/en/notes/unity/unity-dialogue-system/), [Stardew Dialogue Display Framework](https://www.nexusmods.com/stardewvalley/mods/11661)) |
| Accessibility of game dialog | Text stays until dismissed (no auto-advance), readable size and contrast, everything announced in a live region, Escape closes, the reveal is skippable (and instant under Reduce motion) | WCAG 2.2 (2.2.1 timing, 1.4.3 contrast); Game Accessibility Guidelines ("allow text to be skipped"; "don't auto-advance") |
| Characters on a shared rig | One rigged model, per-character **skins** on the same UV atlas, accessories parented to bones (hair, glasses), children by scaling the rig (with a slightly larger head) | Standard practice (Kenney's own skins; the project's Sunny) |
| Poses beyond the clips | Procedural bone aiming (the project's `aimBone`) over the idle/run clips: sit, read, lie, crawl, throw, crouch | The project's action and seat poses |
| Cosy dwellings at night | Warm window glow, a porch lantern, a campfire that's a real light source with a flicker, string lights; smoke by day, embers by night | Animal Crossing / cosy-game lighting; the project's lamplight system |

## 2. Site plan (`world/homestead.ts`, pure)

The pond sits on the far side of the planet from the plaza, the open meadow west of it is flat and
dry. Everything is laid out on a polar grid round the pond's centre (angle from its local north,
distance in u), **nicely spaced** (≥ 1.5 u between features) with room to walk between them:

| Feature | Where | Collision |
|---|---|---|
| **The house** (the owner's home) | 245°, 5.6 u, front door facing the pond | circle 1.25 u |
| **Rojina's reading chair** (a cushioned wooden armchair) and a side table with tea | on the lawn 3.6 u from the house, 62° off its front, facing the pond (moved out from 2.1 u so its levelled pad doesn't crease against the house's) | 0.3 u |
| **Picnic table** with two chairs | 211°, 3.7 u | table 0.46 u, chairs 0.22 u |
| **Picnic mat** (painted gingham blanket) with Lingjel's Lego and toy cars | 186°, 3.55 u | none (you walk on it) |
| **Campsite**: stone fire ring, two camp chairs, a log bench, the guitar leaning on a chair | 272°, 4.3 u | ring 0.5 u, chairs 0.3 u, log 0.3 u |
| **The old oak** (Laija's reading tree; bigger than the other hardwoods, with a long, level branch for the swing: [swing.md](./swing.md)) | 106°, 6.2 u | 0.5 u |
| **The swing** (built at the crafting table's call; its ghost until then) | under the oak's branch, 255° round from the oak's heading to the pond | 0.35 u once built |
| **The jute row** (five plants, picked for jute) | 4.75 u behind the house, outside the vegetable garden's back fence | none |
| **The ducks' nest** | on the far bank at 60°, the pond's radius + 0.42 u, facing the water | 0.24 u |
| **Pebble shore** | the pond's edge at 206° | none |
| **Pond bench** (a slatted park bench, feeding the ducks) | on the bank at 260°, the pond's radius + 1.45 u, facing the water | 0.5 u (as benches) |
| **String lights** from the house's corner to a post by the table | — | post 0.1 u |

Anything the random layout had put there (trees, bushes, rocks, flowers, grass, pebbles) is
removed after generation, so the rest of the planet doesn't move. A unit test checks every feature
is clear of other obstacles, the river and the pond, and ≥ 1.5 u from the others.

## 3. Models and day–night (`world/home/models.ts`, `Homestead.tsx`)

Built with the geometry kit, so every part gets its painted surface texture (plank siding, shingles,
plaster, stone, brick, canvas, metal):

- **House:** a cottage with cream plaster walls over a fieldstone plinth, a steep shingled gable
  roof with a brick chimney, a green front door with a porch light and four steps down to the
  ground (the house stands on its own levelled pad, see [ground.md](./ground.md)), lit windows with
  shutters and flower boxes, a small porch roof, potted plants, a welcome mat at the foot of the
  steps and a mailbox.
- **Campsite:** a ring of stones round crossed logs; **flames** (three glowing cones, flickering),
  a **real warm light** at night (lamplight system, flickering), smoke puffs by day, embers by
  night; two folding camp chairs (canvas), a log bench, an acoustic guitar leaning on a chair.
- **Picnic:** a wooden table with two chairs; food (a basket, plates, a jug, fruit) that appears
  when Rojina lays the table; the gingham **picnic mat** (generated texture, `picnic-mat`), with a
  small Lego tower and bricks and two toy cars on or by it; Laija's paper and crayons.
- **Round the house** (revision 3, `Yard` in `homestead.ts`; prabin-npc.md §6): a low rustic fence
  behind the house, open toward it; two raised vegetable beds (cabbages, staked tomatoes) and a
  watering can inside it; a tulsi vrindavan (a whitewashed pillar planter with a bushy holy basil of painted leaf cards and a diya)
  in front, on the door's axis 3.1 u out from the house's centre, on its own small round cobbled spot
  (`TULSI_SPOT`: a point pad, flat 0.32 u round it, cobbles to 0.6 u), its diya's niche facing the
  house; sandals on the step, a broom by the door, a woodpile at the side. The house's own cobbles stay
  a narrow 0.45 u band round its base (a wider paved yard levels too much ground and breaks the little
  planet's curve). All one kit in the house's frame, each item on its own ground.
- **The gable window** is set into the front gable wall (its face at the wall's plane) and high
  enough to clear the porch roof.
- **The pond** is a little bigger (nominal radius 1.8 u, up from 1.5) with a more irregular outline
  (four low harmonics, up to about ±25 %; `shoreRadius` in `world/pond.ts`). Its bank facing the house
  is kept open: no reeds or ferns within 0.8 rad of the house's direction, only a few irises, and
  nothing in the water in front of the pond bench (`HOUSE_BANK`, `BENCH_VIEW` in `world/pondPlants.ts`).
- **Water lilies** (`world/home/lilies.ts`, drawn by `HomeView.tsx`): modelled, not painted cards. Six
  clusters float on the pond, each four or five notched, veined pads with a turned-up rim and a
  red-bronze edge, and a pink or white bloom and/or a closed bud; three variants, one instanced draw
  each. They come with the home's chunk (the main bundle is at its budget).
- **Night:** windows glow (the kit's glow layer follows the day), the porch lantern and the fire
  light the scene through the shared lamplight list (the tulsi's diya too, a small flickering lamp), the string-light bulbs glow; by day the fire
  is small and smokes.

## 4. The family (looks)

All three share the project's CC0 Kenney rig and clips; each has its own skin on the same atlas
(`assets-src/characters/compose-family.py` → `public/models/skins/*.png`), plus accessories on the
Head bone:

| | Look | Height |
|---|---|---|
| **Rojina** | sage-teal T-shirt with a little white leaf, navy trousers, tan flats; dark hair in a **ponytail** (she wears the playable Sunny's model, whose ponytail and scrunchie take her atlas's hair and tee colours), **glasses** (thin dark frames) | 1.18 u (adult) |
| **Laija** (9) | coral-pink T-shirt with a white star, light-denim trousers, purple sneakers; dark hair in two little pigtails | 0.92 u |
| **Lingjel** (5) | bright blue T-shirt with a little red car, khaki shorts, green crocs; short dark hair | 0.74 u |

Children get a slightly larger head (×1.12 / ×1.2) for their age.

## 5. Behaviour (`world/home/family.ts`, pure)

Each NPC runs a small utility AI over **activities**, each tied to a smart object or a person.
They commit to an activity for its duration, don't repeat it straight away, cool down, and keep to
the home (within 7 u of it, never into the pond).

| Rojina | Laija | Lingjel |
|---|---|---|
| **Sit and read** in her chair (long) | **Wander**, walking or running | **Wander**, running more often |
| **Watch the kids** (stand, look at a child, now and then call over) | **Chase** a butterfly or a rabbit | **Chase** a butterfly or a rabbit |
| **Talk** to a child (walk over, face each other) | **Read under her tree** (sit against the trunk) | **Push his toy cars** (crawl on the grass, a car in hand) |
| **Lay the table** (fetch from the house, set food down) | **Paint** lying face-down on the grass, legs kicking | **Build with Lego** (sit on the mat, hands busy) |
| A short **stroll** | **Throw pebbles** into the pond (ripples) | **Talk** to Rojina or Laija |
| | **Crouch** to look at flowers or bugs | |
| | **Talk** to Rojina or Lingjel | |

- **The daily routine:** from 8 pm they walk to the front door (the children first, Rojina last) and go in; at 6 am they come out one by one and walk onto the lawn. When the clock is set by hand (a jump of more than 15 minutes), they wait 8 s before following it; when the time passes naturally, they respond at once. Loading the page at night finds them already inside. Indoors they're not drawn and can't be talked to.
- **Meals:** when Rojina has laid the table, everyone out comes to eat, each at their own chair (a third chair stands at the table's end), with a slow hand-to-mouth *eat* pose. After 22–32 s Rojina gathers it all into the basket and carries it in, and the children go back to playing. The next lunch comes at least two minutes later.
- **Pebbles:** Laija throws from a new spot on the pond's edge each time, anywhere along the home's side of the pond.
- **Feeding the ducks** (`ducks`, anyone, Prabin too): they walk to the family's end of the pond bench (a `bench` seat in `world/home/seats.ts`, 0.28 u along it; the visitor's seat is the other end, so both can sit together), sit, and toss a handful of crumbs every 2.4 s for 16–26 s. Each handful is a `feed` event that the home's view passes to `controller.duckFeed` (`systems/duckFeed.ts`), the same as the visitor's.
- **Watering the garden** (`water`, Rojina and Prabin): when the watering can is by the beds, at least three plants are thirsty and the visitor isn't within 2.5 u of the can (the visitor has priority), they walk to the can, pick it up, water the nearest thirsty plant from the house side of its bed (the fence side is tight), then the next, until none is thirsty, and put the can back where it was. A plant they can't reach within 20 s is skipped. If the activity is cut short (bedtime, a meal, a talk), the can goes straight back to its spot: nobody walks off with it. See §6.2.
- **The swing** (`swing`, the children, often; `swingGrown`, Rojina and Prabin, now and then; once it's built: [swing.md §6](./swing.md#6-riding-the-swing)): when nobody's on it, they walk to one of its entry points (in front of it, or to either side in front of the ropes; a `swing` seat in `world/home/seats.ts`), sit on the plank, and pump it for 14–24 s (the children harder), then let it die down and get off. If the visitor gets on first, they go and do something else; if someone stands on the entry point they chose, they take another.
- **Talking in pairs:** the one who starts walks over; both stop and face each other and a small
  speech bubble ("…") pops over whoever is speaking, alternating; 6–9 s.
- **Butterflies:** three live by the home (the kids chase them); rabbits nearby also get chased
  (and the kids scare them, like the character does).
- **Nobody walks through anybody:** the family keep hard minimum distances from each other (0.36 u), the character (0.55 u) and Chopper (0.42 u), and steer round them before that. The character collides with the family and Chopper as with any obstacle; Chopper steps round the family and never through them.
- **Route planning and steering:** (since [prabin-npc.md](./prabin-npc.md) §4.1 a cube-sphere grid over the whole planet, shared with Prabin and Chopper) a navigation grid (0.25 u cells, obstacles grown by the walker's radius plus a margin, the pond and deep water blocked; `world/home/nav.ts`) and 8-way A* with no corner cutting, smoothed by string-pulling into a few straight legs. They walk the route with seek and arrive, feelers as a local fallback, separation from each other and a personal space round the character; moving goals (a butterfly, one of the family) are re-planned at most every 0.4 s. Anyone who can't get anywhere for 1.5 s gives up and picks something else. Walk 1.0 u/s, kids run 2.3–2.5 u/s.

## 6. Talking to them (the interaction)

- **Prompt:** within 1.3 u, facing them: **Talk to Rojina** (E, a comment icon). Same target
  arbitration as the collection system. A gold ring glows round the one you'd talk to and follows
  them ([design system §6.5](../game-ui/design-system.md#65-target-tiers)).
- **Walking by:** someone on their way somewhere who becomes your target **notices you**: they stop,
  turn and look at you for up to 4 s (`Family.notice`, `FAMILY.noticeS`), then carry on if you
  don't talk. Someone busy (a chore, another conversation, a doorway) doesn't stop. They stay the
  target 0.5 u past their reach (`REACH.keepMoving`), so a step of theirs doesn't lose the prompt.
- **E:** the NPC pauses what they're doing (a sitter stays seated), turns to face you and gestures;
  the **dialog box** slides up at the bottom: the name plate, the line with a typewriter reveal
  (≈ 45 characters/s; instant under Reduce motion), and a blinking "more" marker.
  - **E, Enter, Space or a click:** completes the line if it's still typing, else the next line;
    after the last, it closes. **Esc** closes at any time. Movement is paused while talking.
  - A conversation is 2–3 lines: a greeting that fits the time of day, then one or two from the
    NPC's pool that fit what they were doing, no line repeating until the pool is used up.
  - Every line is announced in the live region; the box is a labelled, non-modal `role="dialog"`,
    and focus returns to the planet when it closes.
- The lines are **generic and preset** (as asked): friendly, family-flavoured, no invented facts.

### 6.1 The pond bench: sit and feed the ducks

- **Prompt:** in front of the pond bench, **Sit on the bench** (E), as on the bridge bench. The
  visitor sits on one end of it (`Furniture.sitSide`), the family on the other.
- **Seated there,** the focus lane shows two buttons: **Feed the ducks** (E, a bread-slice icon)
  and **Stand up** (Escape; a movement key also stands you up). The live region says so when you sit.
- **Feed the ducks:** a handful of crumbs arcs from the bench to the water (6 crumbs, landing well
  inside the pond, `FEED.inset` of the way in from the shore) with a ripple, then floats and fades
  over 5 s. At most one handful per 0.9 s per feeder. The first handful is announced.
- **The ducks:** the crumbs draw the duck for 14 s after the last handful (`WildEnv.feed`,
  `world/animals.ts`): she swims over, slows as she arrives and pecks at the water for them, head
  down and up with pauses to swallow, and her ducklings crowd round the crumbs and peck too. A seated visitor doesn't frighten her (`WildEnv.calm`); a walking one still
  does, at the usual distance.

### 6.2 Watering the garden

- **The can** stands by the beds. **Prompt:** in front of it, **Pick up the watering can** (E, a hand-and-droplet icon); holding it, **Put the can back**. It's there to pick up only while nobody else has it.
- **Holding it,** each of the 12 plants (8 cabbages, 4 tomatoes) offers **Water the cabbage** or **Water the tomato plant** (E, a droplet icon) while it's less than well watered, from either long side of its bed. E plays the fixed `water` cycle (`systems/actions.ts`, 1.6 s): a step up to the plant, the can tipped, a stream of drops from its spout onto the plant, a splash, and the soil round the plant darkens. The live region says what was watered, then the next prompt ("Watered the cabbage. Water the tomato plant: press E."), and says when every plant is watered.
- **Drying:** a plant dries from wet to dry over 5 minutes (thirsty below 35 %); the wet patch shrinks with it. Watering fills it to 100 %; a plant above 85 % offers no prompt.
- **Walking off:** a can carried more than 6 u from the beds, or on a trip to a landmark, is put back by the beds, with a toast that says so.
- **Rojina and Prabin** water the same plants with the same can (§5): the can shows in their right hand and tips as they pour, with the same stream and wet soil.
- **Code:** the rules are pure in `world/home/garden.ts` (`Garden`: the plants and their stands, wetness, who holds the can, the pours; unit-tested in `tests/unit/garden.test.ts` against the real layout); the family's activity is in `world/home/family.ts`; the can, the wet soil (one instanced draw) and the drops (one instanced draw) are drawn by `world/home/GardenView.tsx`. All of it is in the home chunk: its targets carry their own label, use, availability and icon, so the main bundle needs no garden code (it has the `can` and `plant` target kinds, the `water` cycle, and the registries `controller.cycles` and `controller.poses` the chunk fills in).
## 7. Budgets

| | Budget |
|---|---|
| Draw calls | ≤ 30 more at the spawn view (the home is on the far side, drawn anyway: nothing is culled) |
| Triangles | ≤ 90 k more (the NPCs share the character's mesh, ≈ 5 k each) |
| JS | the site plan in the initial bundle (≈ 1 KB); models, NPCs and dialog lines in their own chunk, loaded with the textures (≤ 25 KB) |
| Textures | three skins (≈ 130 KB PNG) and the picnic mat (13 KB) |

## 8. Tests

- **Unit:** the site plan is clear, dry, spaced and reachable; the brain keeps each NPC at home,
  out of the pond, varies activities without repeats, pairs talk facing each other, the kids chase
  a butterfly, and talking stops and faces the NPC; dialog picks never repeat until the pool is used.
  `tests/unit/ducks.test.ts`: the pond bench stands on the dry bank facing the water, its two seats
  are apart and at the bench's height, crumbs land well inside the water, the lure wears off, the duck
  swims to the crumbs (calm with the visitor seated, still fleeing a walking one), and a family member
  sits on the bench and tosses a handful every few seconds.
  `tests/unit/garden.test.ts`: the plants match the beds, every stand is clear and in reach, one holder at a time, drying, the pour, Rojina and Prabin water every thirsty plant and put the can back, never take it from or near the visitor, and bedtime puts it back.
- **E2E:** the three are there; walking up to Rojina offers **Talk to Rojina**; E opens the box with
  her name; E completes and advances the lines; Escape closes it and hands the keys back; axe passes. The visitor picks up the can, waters a plant (wet, announced) and puts the can back.
- **Real GPU:** close-ups of the house by day and night, the campsite, the picnic, and each NPC.

## 8b. As built

- **Numbers at the spawn view:** 164 → 191 draw calls and 823 k → 859 k triangles (≈ 208 calls / 840 k at the home), 60 fps on the reference GPU, 0 NaN pixels by day and night; ≤ 7 lamps lit at the home at night.
- **JS:** the site plan, the talk box and the controller glue in the initial bundle (449.4 KB of 450); the home's models, the family and their lines in their own chunk (≈ 15 KB), fetched with the textures.
- **Placement:** the first polar plan put the reading chair inside the house's circle and the mat against the table; the unit test caught both, and the chair now stands 2.1 u in front of the house, just off the door.
- **Rojina's look (owner's review):** first built with a shirt, jeans and a straight-hair shell; changed to Sunny's model with its ponytail, a T-shirt with short sleeves and trousers. The atlas's arm strips were mapped with a colour-coded test skin: along the arm in x (wrist at x 0 on the left strip, mirrored on the right), round it in y.
- **Accessories:** the Kenney mesh is authored in centimetres (Z-up) under a converted root, so the hair and glasses are authored in model units and moved onto the Head bone with one fixed matrix (`HEAD_SPACE`), measured from the head's skinned vertices.
- **Sitting:** seated poses shift the body back into the chair (`back`), so Rojina sits against the backrest rather than on its front edge.
- **Dialog:** the button reads **Next**, then **Bye** on the last line; the reveal is instant under Reduce motion.
- **Chopper's head vibration (owner's review):** the brain's heading can flick between frames as he steers round things, and a look target passing behind him flips from one side to the other; both went straight into his neck. His turn rate and look are now eased (a target right behind him isn't looked at), and his shake-off is gentler (4.5 Hz, a smaller head swing) and rarer. Measured: the head changes by at most 0.02 rad per frame.
- **The table:** as one circle it swallowed the chairs at its sides (nobody could reach them to eat); it's two circles along its length now.
- **Pose gallery (real GPU):** read in the armchair, paint face down, read against the tree, throw at the pond's edge, crouch among flowers, crawl with a toy car, Lego on the mat and the meal at the table all checked.
- **T-pose (owner's review):** the idle and run actions were started inside a memo, and React's development mount–unmount–mount check stopped them for good; they now start in an effect.
- **Scale (owner's review):** the family are short-legged characters (Rojina's hips about 0.38 u up), so the furniture and props are drawn at `PROP_SCALE` 0.72 (seats about 0.35 u, the table top about 0.5 u), the fire ring, Lego and toy cars at 0.85, with their collision circles to match.
- **Pose pipeline (owner's review: heads spinning, poses sticking):** the idle and run clips don't key every bone (not the head), so offsets applied on top of last frame's pose accumulated and the heads spun. Every frame now first undoes last frame's procedural offsets (restoring each bone to what the clips left), runs the clips, remembers their result, then applies the pose and the head's look-at turn (eased, clamped to ±0.8 rad, about the body's up in the head's frame) and nod (eased). (Resetting to the bind pose instead left a T-pose: the mixer only writes a bone whose value changed since it last wrote it.) An E2E check samples the heads frame by frame.
- **Ambient pause:** the family (and Chopper) hold perfectly still; the outline twins the player's avatar adds to the shared model are stripped from the family's clones.

## 9. Critique of the plan, and what changed

| Weak point | Why it matters | Improvement |
|---|---|---|
| New GLBs per NPC | 3 × 163 KB more to download | One GLB, three skins swapped at runtime |
| Placing the home by re-running the random layout | Every other prop on the planet would move (and tests with them) | Remove only what's in the way, after generation |
| NPCs as plain state machines | Repetitive, predictable loops | Utility AI with smart objects, no-repeat memory and cooldowns (as Chopper) |
| Auto-advancing dialog | Fails WCAG 2.2.1 and frustrates slow readers | Lines stay until you press; the reveal is skippable |
| One press both finishing and skipping the next line | Players miss lines | One press completes, the next advances |
| NPCs chatting with DOM overlays | Costly, and a second UI system | A small 3D bubble over the speaker's head |
| The kids wandering into the pond | Breaks belief (and the duck) | The pond is blocked; pebbles are thrown from the shore |
| The "leaning down and…" activity (the brief is cut off) | Unclear intent | Built as a crouch to look at flowers and bugs; to confirm with the owner |
| Bundle budget | The initial bundle is at 447 of 450 KB | All the home's code in its own chunk, loaded with the textures |
