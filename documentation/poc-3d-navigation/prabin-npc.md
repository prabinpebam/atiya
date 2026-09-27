# Prabin as an NPC; navigation, seats, doors, Chopper's house and the plaza (spec and plan: v1, critique, v2 as built)

*Prabin (the owner) becomes an NPC who roams the whole planet. Visitors to the site are the playable character. With him come the shared fixes this needs: route planning and avoidance for everyone, seats that are used properly, a front door that opens, Chopper's house with a real inside, and a re-laid plaza. Acceptance checklist: [prabin-dod.md](./prabin-dod.md).*

## 1. Research: how established games and engines do it

| Problem | Established pattern | Where it's from | What we take |
|---|---|---|---|
| Sitting on a chair without walking through it | **Smart-object slots with entry points**: a seat has a slot (where the body ends up) and one or more *entry points* (where the character walks to, facing a set way). The character paths to the nearest free entry point, then a short *enter* animation carries it onto the slot; *exit* reverses it. A slot is **reserved** by one user at a time | Unreal Engine Smart Objects (`FindEntranceLocationForSlot`, slot reservation); The Sims' routing slots | Each seat gets entry points (in front, or beside it for a dining chair pulled in at a table), a reservation, and scripted sit-down / stand-up transitions. The chair stays solid |
| Sitting at the right height | The pose is aligned to the object's **seat anchor**: the pelvis goes to the seat height and depth of *that* chair, not to a fixed fraction of the body | Animation alignment / motion warping to a marker (Unreal Motion Warping, Unity Match Target) | The seat carries its seat height, depth and back position; the body is placed on it, whatever the character's size |
| Walking through a doorway | **Off-mesh links** (Recast/Detour): a special edge (a door, a ladder, a jump) traversed by a scripted move, not by steering. Doors open **automatically** for NPCs as they approach and close behind them | Recast/Detour off-mesh connections; Unreal Smart Links; the auto-doors of countless RPGs | The house's front door is a link: wait at the step, the door swings open, climb the steps through the doorway, and hide once inside; close it after. Coming out plays it in reverse |
| Getting across a whole world | **Global planning plus local steering**: A* on a navigation graph for the route, then steering along it; replan when the goal moves or the route is blocked | Standard in every engine (NavMesh + path following); Reynolds' path following | A navigation grid over the **whole planet** (a cube-sphere grid), A* with string-pulling, used by the family, Prabin and Chopper |
| Not walking through each other | **Predictive local avoidance**: each agent looks at when it would collide with each neighbour (*time to collision*) and steers away more strongly the sooner that is; agents pass on one side by convention | Karamouzas, Skinner and Guy, "Universal power law governing pedestrian interactions" (2014); RVO/ORCA (van den Berg et al.); Detour crowd | Time-to-collision avoidance between the family, Prabin, Chopper and the character, with a keep-right bias, on top of the hard minimum-distance rule |
| Getting stuck behind a rock or at a corner | **Stuck detection and repair**: if an agent makes no progress along its route for a moment, replan (with the blocking agent treated as an obstacle); if that fails too, give up on that goal and pick another | Detour crowd's corridor repair and "topology optimisation"; common NPC practice | Progress monitoring for everyone: replan after 0.8 s without progress; a new goal after 3 s; Chopper plans a route whenever the straight line to his goal is blocked |
| A living character who roams the world | **Schedules and points of interest**: villagers stroll between spots, stop to look at things, sit, play an instrument, work at a bench, and talk when you walk up | Animal Crossing villagers (strolling, singing, bug-watching); Stardew Valley NPC schedules; Red Dead Redemption 2 ambient "scenarios" | Prabin's utility AI with points of interest across the planet: stroll, admire a building, play fetch with Chopper, play the guitar at the campfire, hammer at the crafting table; home for meals and the night |
| Sharing an object with the player | **The player has priority**: an NPC doesn't take an object the player is about to use, and gives it up when the player comes to it | Smart-object reservations; AC villagers stepping aside | Prabin doesn't start work at the crafting table while you're near it, and stops and steps away if you walk up |
| Playing fetch | A throw, the dog runs to the landing spot, picks up, returns, drops at the thrower's feet, play bow; repeat | Nintendogs; Fable II's dog; RDR2 | A fetch behaviour in Chopper's mind: Prabin throws a stick, Chopper fetches it back, two or three times |
| Talking to an NPC now, an AI later | A **dialogue provider** interface: the conversation asks a provider for lines given context (who, what they're doing, time of day), so a scripted provider can be swapped for a generative one | Common in games with LLM prototypes (e.g., Inworld / Convai integrations) | `DialogueProvider` with the preset `LinePicker` as its first implementation |

## 2. Plan v1

1. Prabin: another family member drawn on the Skater model with his own skin; wanders anywhere; talk with E.
2. Chairs: add a fourth chair at the table; fix the sitting height.
3. Door: swing the door when someone goes in or out.
4. Navigation: make the home's navigation grid bigger; add a stuck timer.
5. Chopper's house: make it bigger, add a cushion inside, a lamp at night; Chopper sits in it.
6. Plaza: move the bench and notice board next to the bridge; put the chest and table between the Post Office and the Workshop.

## 3. Critique of v1

| Problem in v1 | Why it matters | v2 |
|---|---|---|
| "Make the home grid bigger" | Prabin roams the whole planet; a flat 18 u grid around the home can't cover a sphere (distortion grows, the far side is unreachable) | A **cube-sphere navigation grid** over the whole planet (≈ 24 k cells of 0.25 u), built once while loading, with A* and string-pulling. It replaces the home grid, so there's one planner for everyone |
| Chopper has no planner at all | He gets stuck behind rocks and in corners (reactive steering has local minima) | Chopper asks the planner for a route whenever the straight line to his goal is blocked or he stops making progress. The planner comes with the home chunk and is handed to his mind as `DogWorld.plan` (his mind stays small, in the main bundle) |
| A stuck timer that only gives up | Giving up leaves the visitor watching someone bump into a rock and turn away | **Detect, repair, then give up**: after 0.8 s without progress, replan treating whoever blocks the way as an obstacle; after 3 s, choose something else |
| Separation forces only | Two agents meeting head-on push against each other and stall | **Time-to-collision avoidance** (anticipatory, strongest just before a collision) with a keep-right bias, applied to the family, Prabin and Chopper, with the character treated as someone who doesn't give way |
| "Fix the sitting height" with another constant | The children are shorter than the chair is high: a fraction of body height sinks them into the seat | Every seat is a **smart object** with its seat height, seat depth and back; the pelvis is placed on it, whatever the body's size |
| Walking straight to the chair's centre | That's how they walk through the chair (its obstacle is ignored for its user) | Walk to an **entry point** (in front of an armchair or camp chair; beside a dining chair at the table), then a scripted 0.6 s sit-down onto the seat; stand up the same way. The chair's obstacle stays for everyone |
| Door swings but they still pop in at the step | The request is that they climb in and come out | The door is an **off-mesh link**: wait at the step; the door opens; walk up the steps, through the doorway, a little way into the room, then they're inside. Coming out plays it in reverse; the door shuts behind them. One at a time; the others wait nearby |
| Nothing behind the door | An open door shows a hollow shell | A small room behind it: floorboards, a rug, a dresser, a picture and a warm glow at night |
| Chopper "sits in the doorway" | The request is to go inside | The house is rebuilt at Chopper's scale (door 0.42 × 0.56 u, walls 0.62 u): a plank floor, a padded bed, a bone toy, a name plaque and a hanging lantern (a real lamp at night). He walks in, turns round and sits or lies inside, facing out; when he's called away he walks out first |
| Prabin wanders anywhere, like the kids | A wandering adult with nothing to do reads as a bug | **Points of interest** across the planet: he admires a building (off its path, facing it), plays fetch with Chopper, plays the guitar at the campfire, hammers at the crafting table, strolls between them, and comes home for meals and the night |
| Prabin uses the crafting table the visitor needs | He'd stand where the visitor stands | The visitor has priority: he doesn't start there while you're within 4 u, and stops and steps back when you come within 2.2 u |
| Only preset lines | The owner wants an AI agent later | A `DialogueProvider` interface with the preset lines as its implementation; the talk UI already handles any number of lines |
| The family talks to the visitor as if it's Prabin | Visitors are now the playable character | The lines greet a visitor, and now and then mention Prabin |
| Moving the bench "next to the bridge" | Next to a bridge is next to a path and a river | The bench sits on the bank beside the plaza-side end of the Greenhouse bridge, facing the water, on dry ground off the path; the notice board stands at the bridge's entrance on the other side of the path, facing the path |
| Chest and table "between the Post Office and the Workshop" | Both near a path or a building's preview area invites mistakes | A **workyard** in the open ground between the two paths: the chest and the table side by side, 2.4 u apart, facing the plaza, each ≥ 1.3 u off the paths and clear of both buildings; the keep-clear rule removes flowers and solids round them |
| Bundle budget | The initial game bundle is at 448.3 of 450 KB | All new code lives in the home chunk (the planner, Prabin, the seats, the door); the main bundle gets only Chopper's new behaviours (fetch, going inside, route following) and nothing else. If it doesn't fit, Chopper's mind moves into his own chunk |

## 4. Spec v2 (as built)

### 4.1 The planet's navigation (`world/home/nav.ts`, pure)

- **Grid:** a cube-sphere grid (six faces, equal-angle, 63 × 63 cells each: ≈ 0.25 u per cell). Each cell knows its eight neighbours (across face seams too) and the arc length to each.
- **Blocked cells:** inside an obstacle grown by the walker's clearance (0.28 u), in the pond, or in water deeper than 0.12 u. The obstacles are rasterised by a flood fill from their centre cell, so building costs about the obstacles' area, not cells × obstacles.
- **Paths:** A* (8-way, no cutting blocked corners, the great-circle distance ×1.1 as the heuristic), from the nearest free cell to the nearest free cell of the goal, then string-pulling along great circles. Temporary blocks (another agent in the way) can be passed per query. When the goal sits in a pocket the grown obstacles seal off (the front door's step, between the house and the reading chair), the route is a **partial path** to the reachable cell nearest the goal, as Detour returns, and the walker covers the last bit on its own. A failed plan is retried after a while, never every step.
- **Users:** the family and Prabin (routes to every goal), and Chopper (through `DogWorld.plan`, when the straight line to his goal is blocked).
- **As built:** 23 814 cells (0.249 u), 6 079 of them blocked on the real layout; built in ≈ 31 ms while loading (22 ms of it the water test); a path across the planet in ≤ 8.5 ms (8 000 cells expanded), across the home in < 0.1 ms.

### 4.2 Moving among each other (`world/home/family.ts`, `world/chopper/brain.ts`)

- **Avoidance:** each walker looks up to 2.5 s ahead at the others (the family, Prabin, Chopper and the character). It steers away with a strength that rises as the time to collision falls. When two meet head-on, both bear right.
- **Hard rule:** nobody's centre comes within the minimum gap of anyone else's (the character 0.55 u; Chopper 0.42 u; each other 0.36 u).
- **Stuck repair:** no progress toward the next waypoint for 0.8 s → replan, blocking the cells round whoever is in the way; 3 s → choose another activity (a routine step waits instead).
- **Standing still:** the minimum gaps hold for walkers who are standing too (two who end up too close step apart), and nobody is ever pushed into the pond or an obstacle.
- **Chopper, drifting back:** when he's wandered near the end of the leash with nothing to do there, he trots back rather than idling far off.
- **Chopper:** when the straight line to his goal crosses a blocked cell, or he makes no progress for 0.6 s, he asks for a route and follows it; he replans when the goal moves more than 0.6 u.

### 4.3 Seats as smart objects (`world/home/seats.ts`, pure)

- **A seat** has its spot (centre and facing), its seat height and depth (from its model at `PROP_SCALE`), where the back is, its entry points and one reservation.
- **Entries:** in front for the reading armchair and the camp chairs; beside, on either side, for the table's chairs (pushed in at the table).
- **Using one:** walk to the nearest free entry point (the chair stays solid), face the way the transition starts, then **sit down** (0.6 s: the body slides onto the seat and turns to face the seat's way while the hips lower to the seat height). **Standing up** reverses it, back to the entry point, before anything else happens. A seat belongs to the activity it was taken for: any other activity (a chat excepted) stands them up first.
- **As built:** seat tops 0.374 u (dining, cushioned), 0.367 u (armchair), 0.288 u (camp chair); the hips sit 5 % of the body's height above the seat. Rojina lays the picnic from a corner of the table now (its end has Prabin's chair).
- **The body on the seat:** the hips sit at the seat's height plus a small cushion depth, a little behind its centre; the thighs lie along the seat and the shins hang down. Nobody intersects the chair (unit-tested against the models' seat heights for all four body sizes).
- **The table** gets a fourth chair (the far end), for Prabin.

### 4.4 The front door (`world/home/family.ts` door link, `HomeView.tsx`)

- **The leaf** is a separate model, hinged on its left, and swings 100° into the house (eased, 0.5 s).
- **Going in:** walk to the step, wait there until the door is open (only one person at a time holds the doorway; the others wait close by), then walk up the two steps (rising to the floor height), through the doorway and 0.4 u into the room, then they're inside. The door shuts once the doorway is clear.
- **Coming out:** the door opens, they appear just inside, walk down the steps to the lawn, and the door shuts behind them.
- **Used by:** bedtime and waking; Rojina fetching the picnic and taking it back.
- **Behind it:** a room: floorboards, a rug, a dresser with a lamp, a framed picture and a coat hook, lit warm at night.

### 4.5 Chopper's house, inside (`world/craft/models.ts`, `CraftView.tsx`, `brain.ts`)

- **Scale:** 0.96 × 1.08 u, walls 0.62 u, the doorway 0.42 × 0.56 u (arched), so Chopper (1.25× life size) walks in upright. The collision radius grows to 0.62 u and the site's clearing to 1.5 u.
- **Inside:** a plank floor, a padded bed, a bone toy, a small blanket, a name plaque over the door ("CHOPPER" on a bone-shaped plaque), and a lantern hanging from the ridge (glow, and a real lamp at night: `addLamp`, range 1.1 u, 0 by day).
- **Him:**
  - he walks to the doorway and in (a scripted link, like the family's door), turns round and sits or lies on the bed, facing out, lifted to the floor;
  - when called away (a whistle, the leash) he walks out first;
  - on the build moment he goes straight in and barks from inside;
  - on his own he naps inside now and then.

### 4.6 Prabin (`world/home/family.ts`, `FamilyView.tsx`, `world/home/prabin.ts`)

- **Look:** the Skater model (1.28 u) with his own skin (`assets-src/characters/compose-family.py`): black hair, a mustard T-shirt with a small pencil, charcoal trousers and brown shoes.
- **Where:** the whole planet. He starts at the crafting table and comes home for meals and the night like the rest of the family.
- **Activities** (the same utility AI, with points of interest):
  - **Stroll** to a point of interest (a landmark's surroundings, the plaza, the bridge, home) at a walk, pausing to look around.
  - **Admire a building:** stand 1.2–2 u off its path, 3–4 u from its front, facing it: hands on hips, looking up (10–16 s).
  - **Play with Chopper:** walk over when Chopper is free; throw a stick 2.5–3.5 u; Chopper fetches it back and drops it at his feet (2–3 throws); he crouches to pat him at the end.
  - **Play the guitar:** sit in the campfire chair with the guitar (the leaning one is picked up), strumming (20–30 s).
  - **Hammer at the crafting table:** a birdhouse on the table, the hammer in his hand, a knock every 0.8 s (a quiet cue when you're close). The visitor has priority (§1).
  - **Meals** (his chair at the table) and **the night** (home by 8 pm; if he's far away he walks home briskly).
- **Talking:** facing him within 1.3 u, **Talk to Prabin** (E). He stops and faces you. The lines come from a `DialogueProvider` (preset now): a greeting for the time of day, one about what he's doing, one about the site. The lines are generic (no invented personal facts).

### 4.7 The plaza (`world/layout.ts`)

- **The bench** moves to the plaza end of the Greenhouse bridge, on the bank beside the path facing the water, on dry ground, ≥ 0.9 u off the path's centre line, clear of the rails. The plaza keeps its lamps and planters, and a planter takes the bench's old place.
- **The notice board** (owner review): it first stood across the bridge path, and the Town Hall had a second one partly inside its front-left corner. Only one is kept now, the Town Hall's own, moved to its side toward the Lighthouse (in the model, `townHall` in `world/models.ts`, behind the side window and turned a little to the front).
- **No signposts** (owner review): every building is plainly visible from the plaza, so the arrow signposts beside each path are gone.
- **The workyard:** between the Post Office's and the Workshop's paths, the chest and the crafting table side by side (2.4 u apart), both facing the plaza, each ≥ 1.3 u off both paths, ≥ 1.2 u outside both buildings' footprints, and clear of water. The keep-clear rule (flowers ≥ 1.5 u, solids ≥ 0.9 u) applies round both.

### 4.8 Budgets

| | Budget |
|---|---|
| Initial game JS | ≤ 450 KB gz (only Chopper's new behaviours are added there) |
| On-demand JS | ≤ 70 KB (the planner, Prabin, seats and the door are in the home chunk; the waiver in plan §6 is raised from 60 KB) |
| Navigation grid | ≤ 60 ms to build while loading; a path in ≤ 8 ms (typically < 2 ms) |
| Draw calls | ≤ +12 at the home (Prabin, the door leaf, the room, the doghouse lantern) |
| Lamps | ≤ `LAMP_MAX` (10) at night |

**As built:** initial game JS 444.9 KB (Chopper's mind moved into his own chunk to make room: the controller keeps a stand-in until `attachChopper`); on demand 61.2 KB; the grid builds in ≈ 31 ms; lamps at night 8 with Chopper's lantern; draw calls and frame rate in the DoD.

### 4.9 Tests

- **Unit:**
  - the planner (coverage of the whole sphere, seams, paths round obstacles, no path through water, string-pulling);
  - avoidance (two walkers head-on pass without overlapping or stalling; a walker boxed in by a rock gets round it);
  - seats (entries are free and outside the chair; the body's hips at the seat height for every body; the sit-down and stand-up transitions);
  - the door link (in and out; one at a time; the door opens before anyone passes);
  - Prabin (every activity reachable from the real layout; he yields the crafting table; he comes home at night);
  - Chopper (goes inside and comes out; follows a planned route round a boulder; fetch);
  - the plaza (the bench and board by the bridge; the workyard's spacing and clearance).
- **E2E:** talk to Prabin; the door opens at bedtime and they go in; Chopper's house lit at night with him inside; the plaza's new spots (prompts at the chest and the table).

## 5. Revision 2 (owner review, 2026-09-26)

| Report | Cause | Fix (and the pattern it follows) |
|---|---|---|
| A flower pot blocks the way to the crafting table | The plaza's planter stood in the widest gap between the paths, which is the way out to the workyard | That gap keeps only its lamp |
| The home is congested; the chair in front of the house blocks the door | Everything was packed within ≈ 4 u of the pond, and the reading chair stood on the door's path | The home is spread across the open ground round the pond (house, table, mat, campsite and Laija's tree now 2.2 u or more apart, zone to zone); the reading chair stands beside the house; the lawn in front of the door and the middle of the home ground are cleared of random props |
| Prabin still gets stuck in corners | Found by simulating hours of his day and logging every stall: (1) periodic replans of a still goal flipped between two routes of about the same length round the planet; (2) the visitor standing by a signpost made a pocket the plan didn't know of; (3) a walker squeezed between the visitor and an obstacle; (4) a sit-down timed out at the end of a long walk; (5) a seat's reservation and entry point carried over to the next seat | **Route hysteresis:** a route is replanned only when its goal moves, when the repair asks, or when someone new comes near (never on a timer). **Dynamic obstacles in the plan:** the visitor and Chopper close by are blocked for the query (not when they're right beside the walker). **Agent-aware steps:** a step may not bring anyone inside the minimum gaps; the gap push tries sideways when straight back is blocked, the visitor's gap resolved last. Longer sit timeouts for Prabin; reservations released when the activity changes; standing up waits for a clear entry point; "someone's on the spot" arrival is only as close as their room allows. A regression test simulates 50 minutes (five seeds) and fails on any 3 s stall |
| The hands don't hold the guitar | The arms were posed by fixed directions | **Two-bone IK** for both arms to points on the guitar: the right hand strumming over the sound hole (a quick downstroke, a slower lift), the left hand on the neck |
| A strumming sound from the guitar | — | **Karplus–Strong plucked-string synthesis** (1983): a downstroke across the strings of G, C, D and Em (four strums each), made once per chord in the audio engine, panned to where the guitar is on screen and softer with distance (`SoundEngine.strum`; `audioLogic.ts` `pluck` / `strumSamples`). No asset to download |
| A black patch on Chopper's right side | — | A charcoal patch with a soft, uneven edge on his right flank (vertex colour: the shell fur reads it too) |
| The play bow's front paws glitch when he barks | The leg's splay was `atan2(x, −y)`: with the chest that low the paw target was level with the shoulder, the angle flipped to ±π and the legs swung out, and a bark's bounce flipped it back and forth | The splay is measured against the leg's length in its own plane, so it can't flip. And, as in Unity's and Unreal's foot IK, a **pelvis adjustment**: where a planted paw is out of reach (the chest held high in a sit, a bark's bounce), the body lowers just enough that it reaches. A unit test holds every planted paw within 4 mm of the ground in every pose, barking or not |

## 6. Revision 3: the lived-in home (owner review)

The owner asked for the tree in front of the house to go, a fence behind it, a small vegetable garden, a
tulsi (holy basil) planter in front (as Hindu households keep one), and a lived-in feel round the house.
What cosy life-sims do (Stardew Valley's farmhouse, Animal Crossing's yards, A Short Hike's cabins) is
**set dressing**: a few small, readable props that tell you somebody lives there, kept off the paths.
The yard follows that, and the home's layout rules: laid out in `homestead.ts`, cleared of random props,
with collision only where you'd bump into something.

| Asked for | As built |
|---|---|
| Remove the tree in front of the house | The tall cedar that stood before the house on the table's side (it hid the door as you came up from the table) is cleared, and so is the hardwood that stood where the garden now is. A unit test keeps any tree out of the ground in front of the house |
| A fence at the back, for looks | A low rustic fence (weathered posts about 0.5 u apart, two rails) in a U behind the house, open toward it. The arm on the table's side is shorter, so the way round the dog house stays open. Only its posts collide (small circles), so you and the family walk round the ends, never through; the nav grid sees the same posts |
| A vegetable garden behind the house | Two raised plank beds inside the fence: eight cabbages (a pale heart in cupped leaves) and four staked tomato plants with red and green fruit, with a watering can set down on the path between them. Each bed is two collision circles, with at least 0.5 u to walk round it |
| A tulsi pot in front of the house | A **tulsi vrindavan**: a whitewashed square pillar planter with ochre bands, a niche and a clay diya on a ledge before it, and a bushy basil with purple flower spikes. It stands beside the path from the door, off it. After dusk the diya is lit: a small, flickering lamp (`DIYA_LAMP`) in the shared lamplight list |
| Lived-in texture | Sandals left on the top step (shoes off at the door), a broom leaning by the door, and a woodpile stacked against the side wall |

- **One draw call:** the yard is one kit, built in the house's frame from each item's own spot and ground
  height (the planet curves away under it), so it adds no draw calls beyond its own layers.
- **Lamps:** the diya makes 8 at night, 9 with Chopper's house built; with an open door's light that's
  the list's 10 (`LAMP_MAX`), so a new night light needs a lamp retired or `LAMP_MAX` raised.
- **Tests:** unit "keeps the fence and the vegetable beds behind the house…", "puts the tulsi in front of
  the house, off the path from the door, and no tree in front", "can be walked into…"; the stall and
  gap tests re-run on the new layout.

