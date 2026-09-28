# Chopper: companion dog (spec, as planned and built)

*Status: built (spec §4.18). Unit tests in `tests/unit/chopper.test.ts`, E2E "Chopper".*

Chopper was the owner's Lhasa Apso, who passed away recently. This is a tribute: he runs free on the little planet, busy with his own dog business, always coming back to the character. Walk up to him and press E to see his profile, with his real photo and a 3D Chopper beside it doing little doggy things. The bar is **cute, playful, believably doggy**, and able to pass a close-up look.

## 1. Research: what the industry does

| Topic | Established practice | Sources |
|---|---|---|
| Companion following | A **leash**: comfortable band round the player (idle inside it, trot back when outside it, run when far), **personal space** (never under the player's feet, never blocking the way), and a discreet **warp** when hopelessly separated (off-screen, behind the player) | Fable II dog, Fallout 4 Dogmeat ([thegame.cloud](https://thegame.cloud/the-canine-companion-conundrum-why-fable-s-dog-was-cut-and-w), [DualShockers](https://www.dualshockers.com/fallout-4-best-dogmeat-skills/)) |
| Behaviour choice | **Utility AI**: every behaviour scores itself from the situation (distance to the player, rabbits nearby, time since last done, the dog's "mood" needs), and the dog commits to the winner for a minimum time. Randomness in the scores, and cooldowns, keep it organic without dithering. A player command (the whistle) overrides everything | The Last Guardian (Trico), Dave Mark's *Infinite Axis Utility System* (GDC AI Summit); Fallout 4 companions |
| "Run ahead and wait" | Pick a point ahead along the player's movement, go there, then look back and sit or wait until the player arrives, with a timeout | Fable II dog leading, Dogmeat scouting |
| Idle variety | **Weighted random idles, no immediate repeats**, contextual ones near objects (sniff a tree, play-bow at a bush), and occasional check-ins with the player | Fable II (animations from real dogs), Nintendogs |
| Locomotion | Procedural gaits from **per-leg phase offsets and duty factors**, one oscillator driving the cycle, speed-matched stride. **Walk**: 4-beat lateral sequence (LH 0, LF 0.25, RH 0.5, RF 0.75), duty ≈ 0.6. **Trot**: diagonal pairs (LH+RF 0, RH+LF 0.5), duty ≈ 0.5. **Gallop** (small-dog zoomies): rotary gallop with a suspension phase, duty ≈ 0.35. Body bob, pitch and spine flex follow the legs | [RobotForge gait diagrams](https://robotforge.org/tutorials/mobile-legged/quadruped-gaits), [CPG procedural animation](https://link.springer.com/article/10.1007/s11042-019-7641-1), [ADAPTIK](https://github.com/itspixxel/ADAPTIK) |
| Secondary motion | Floppy ears and a plumed tail on **damped springs** ("jiggle bones") driven by the head's and hips' acceleration | Standard in engines (Unreal AnimDynamics, Unity spring bones) |
| Fur | **Shell texturing**: the mesh drawn N times, each shell pushed out along the normal, with a per-shell alpha test against a strand/clump noise. Strands taper, the roots are darkened (fake AO), and gravity bends the outer shells. It's cheap, and holds up close for stylised fur | Viva Piñata; [knt5/fur-shader](https://github.com/knt5/fur-shader), [piellardj/fur-threejs](https://github.com/piellardj/fur-threejs) |
| Skinning without an authoring tool | **Envelope skinning**: each vertex is weighted to the nearest bones by distance to their segments with a smooth falloff (top 4, normalised). It's how early rigging tools auto-bound meshes, and it gives smooth bends at joints | Maya/3ds Max envelopes, Blender's envelope deform |

## 2. Look and model (`world/chopper/model.ts`)

**Reference:** his two photos (`assets-src/chopper/`) and a GPT Image 2.5 model sheet painted from them in the game's style (`chopper-model-sheet.png`).

- **Proportions:** a Lhasa Apso, small (≈ 0.62 u long and 0.46 u to the top of the head, beside a 1.25 u character: roughly knee-high, like a real one next to a person), with a long body, short legs, a round head and a short muzzle. In the world he's drawn 1.25× life size, like the wildlife, so he reads at the diorama's distance.
- **Markings** (exactly his):
  - a fluffy, slightly curly cream-white coat, with a **black patch on his right flank** (from the owner, 2026-09-26);
  - long hanging ears, charcoal-black with grey-white feathered tips, framing the face;
  - a white face with soft grey-tan shading round the eyes and the crown;
  - big round dark-brown eyes with a bright catch-light, peeking out under a light fringe;
  - a small glossy black button nose;
  - a white moustache and beard;
  - round fluffy white paws with dark pads;
  - a plumed white tail curled up over his back;
  - a thin **blue collar with a small red bone-shaped tag**, as in the photo.
- **Construction:**
  - **Parts:** gently lumpy ellipsoids and capsules, merged into **one skinned mesh** (one draw call) on a **30-bone skeleton**:
    - body: root → hips → spine → chest → neck → head (jaw → tongue, two eyes, two ears with two bones each);
    - tail: four bones;
    - legs: four, each with three bones (shoulder / elbow / wrist, hip / knee / hock).
  - **Eyes** have their own bones, so a blink scales them shut; the fur thins right round them so they peek out under the fringe, as in his photos. Each is a little almond, dark brown with a brown iris round the pupil, a dark rim and a small catch-light.
  - **The face,** after his photos: a broad black nose with two matte nostrils; the mouth line runs down from the nose (the philtrum) and curves out to each side under the moustache, with the muzzle's fur thinned along it so it reads; the moustache is longer at its sides. Under it, a dark lower lip and a dark inside to the mouth, seen when the jaw drops, and the beard is short round the lower lip. The pink tongue has a crease down its middle and comes forward over the lower lip as he pants.
  - **Skin weights:** envelope skinning, restricted per part to its own chain plus its parent, so ears never follow the jaw.
  - **Non-fur parts** (eyes, nose, pads, tongue, collar, tag): the same mesh, with fur length 0 and their own gloss.
- **Fur** (`world/chopper/fur.ts`):
  - **Shells:** 12 in the world (8 on `low`), 20 in the profile view, with fur length per vertex. It's long on the ears, beard, tail and belly skirt; short on the muzzle and paws; none on the eyes, nose, pads, tongue, collar and tag.
  - **Combing:** each vertex has a comb direction (`aComb`, skinned with the mesh): the coat parts along the spine and falls down each side toward the tail, the head fur falls to the sides, the beard and ears hang down, the tail plume falls to one side. Each strand leaves the skin along the normal and bends that way toward its tip (plus a little gravity and a breath of breeze).
  - **Strand mask:** from 3D cellular noise on the **bind-pose** position, so strands stay put as he moves. The cell size gives curly clumps, and a per-cell random height makes the ends uneven.
  - **Shading:** each strand tapers to a point, the roots are darkened (AO), the tips lightened, and gravity droops the outer shells.
  - **Detail:** a generated, seamless **curly-fur tile** (`chopper-fur`) adds the painted locks, sampled triplanar in bind-pose space.
  - **Shadows:** cast by a stand-in that shares his vertex buffers and skeleton but draws only the base (the index's first part), and writes nothing in the main pass.
  - **Material:** lamplight-aware, like the character.

## 3. Animation (`world/chopper/anim.ts`)

All procedural, on the skeleton, in layers:

1. **Locomotion:** one oscillator; each leg has a phase offset and duty factor per gait (walk / trot / gallop, blended by speed). Stance sweeps the paw back along the ground at body speed, so it doesn't slide; the swing lifts it (elbow and hock fold) and brings it forward.
   - **Body:** it bobs twice per trot cycle; in the gallop it pitches and the spine flexes and extends.
   - **Head:** it counters the bob, to keep the gaze steady.
2. **Poses** (target joint angles, blended with critically damped springs, so every transition is smooth):

| Pose / clip | What it looks like |
|---|---|
| `stand` | Weight shifts, looking about now and then |
| `sit` | Hips down, front legs straight, tail sweeping the ground |
| `lie` | Chest down, front paws forward, head up, like photo 1 |
| `sniffGround` | Nose to the ground with quick sniffs (the nose and head twitch), tail wagging slowly; used on trails too |
| `sniffHigh` | Stretching up to a tree or rock, nose working |
| `scratch` | Sitting, a hind leg scratches fast behind the ear, head tilted into it, eyes half-closed |
| `pant` | Mouth open, tongue out, quick chest heave |
| `bark` | A snap of the jaw with a head jerk and a little front-paw bounce (the "woof" pose), timed to the sound |
| `playBow` | Front down and rear up, tail going fast, bouncing on the front paws, barking |
| `headTilt` | The cute quizzical tilt (on arrival after a whistle, and in the profile view) |
| `shake` | A full-body shake-off, from head to tail |

3. **Additive layers:**
   - **Tail wag:** its rate and amplitude follow his mood: slow while sniffing, fast when playing or greeting.
   - **Breathing:** slow at rest, fast while panting.
   - **Look-at:** head and neck turn toward what interests him (a rabbit, the character, a bush).
   - **Blinks.**
4. **Secondary:** ears and tail on damped springs, driven by the head's and hips' motion, so they flop when he runs and settle when he stops.

Under Reduce motion, he still moves and poses, but the springs are stiff and nothing bounces. While ambient motion is paused, he sits still.

## 4. Behaviour (`world/chopper/brain.ts`, pure)

A utility-AI selector over the behaviours below. Each scores itself 0…1 from the situation, plus a little noise; each has a minimum commitment time, a cooldown, and an interrupt rule. The whistle overrides all of them.

| Behaviour | When it scores | What he does | Ends |
|---|---|---|---|
| **Follow** | Farther than 6 u from the character (steeply higher past 9 u) | Trots, or gallops past 9 u, to a spot 1.6 u to the character's side-back | Within 2.5 u |
| **Idle near** | Close to the character, nothing better to do | A random idle from `stand`, `sit`, `lie`, `scratch`, `pant`, `headTilt`, `shake` (weighted, no repeats) | 4–9 s |
| **Wander** | Close and settled, for a while | Walks or trots to a random open spot 3–7 u from the character | Arrives, or 8 s |
| **Sniff** | A tree, rock or boulder within 6 u that he hasn't sniffed recently | Goes to it, then `sniffHigh` (trees) or `sniffGround` (rocks) for 2.5–4 s; a 50 % chance of a `shake` after | Done, or the character leaves |
| **Chase rabbit** | A rabbit within 7 u and not chased for 25 s | Gallops after it (the rabbit flees from him as from the character). When he loses it (it's 3 u ahead after 5 s, or 10 u away), he stops and **barks** at it 2–4 times | Loses it, 7 s, or too far from the character |
| **Scent trail** | Random, now and then (cooldown 40 s) | Nose down, trots along a wiggly trail he "found" (a smooth random walk 6–10 u long, clear of obstacles), stops to sniff twice, then `shake` or `headTilt` | Trail ends, or too far |
| **Run ahead** | The character has been walking steadily for 4 s, facing a clear direction (cooldown 30 s) | Gallops to 5 u ahead of the character along their path, turns, **sits and waits** expectantly, tail wagging | The character arrives (within 2 u), or 8 s pass |
| **Play bow** | A bush within 6 u, playful mood (cooldown 45 s) | Trots to 1 u from it, `playBow` with barks, a hop sideways, a second bow | 4–6 s |
| **Whistled** | The player whistles (F, or the button) | Stops whatever he's doing, looks up, gallops to the character, `headTilt`, then **heels**: follows closely (within 1–2.5 u) and sits when the character stops | 12 s after arriving |

- **Steering:** Reynolds' seek and arrive plus obstacle avoidance on the planet's collision circles, as for the wildlife.
  - **Water:** he wades the stream, but never enters the pond.
  - **Personal space:** a 0.9 u bubble round the character that he slides round, never through.
  - **Paths:** it keeps off the line the character walks along.
- **Warp:** more than 16 u from the character (after a fast travel or Reset), he reappears 2 u behind the character, out of view. After a fly-over, he's there waiting when you land.
- **Mood:** `energy` (drops while running, recovers resting), `playful`, `curious`. They bias the scores, so after zoomies he rests (pant, lie), and after a rest he's curious again.

## 5. Interaction

- **Meet Chopper:** within 1.2 u of him (0.8 u near a landmark), facing him within 65°, and while he isn't running, the prompt shows **Meet Chopper** (<kbd>E</kbd>, a paw icon). It's a target in the collection system, so it follows the same arbitration.
- **The profile card** (`ui/ChopperCard.tsx`):
  - **Layout:** a dialog with his real photo (photo 1, plus photo 2 as a thumbnail you can switch to), his name, breed and coat, what he loved, and an *in loving memory* line.
  - **The 3D Chopper:** beside it, in its own small canvas (created only while the card is open), cycling through the idle clips in random order with no repeats: `sit`, `scratch`, `pant`, `sniffGround`, `headTilt`, `lie`, `shake`, `playBow`, tail wagging. You can drag to turn him.
  - **Behaviour:** Space, Esc or Close closes it, and focus returns as for other dialogs. It has a text alternative for everything shown.
- **The whistle:** <kbd>F</kbd> or the whistle button beside the backpack. It plays the whistle sound, and he answers with a bark and comes. There's a 2 s cooldown.
- **Rabbits:** they treat him as a second threat, with the same flee rules as for the character.

## 6. Sound

Freesound CC0 recordings, cut by `scripts/build-audio.py` into one `dog.mp3` sprite:

- **Barks:** small-dog yaps, 4–6 variations.
- **Sniffs:** 3.
- **Pant:** one seamless loop.
- **Whistle:** a two-note come-here whistle.

**Candidates** (licence checked on each page on 2026-09-25):
- **Barks:** #630648, #813120, #361544, #452180, #351876.
- **Pant:** #827433, #841349, #511319.
- **Sniff:** #353107, #118965, #390857, #595826.
- **Whistle:** #551960, #533057.

Each is analysed before use: pitch (a small dog's bark is high), clipping, noise and level.

**Mix:** he's placed in the stereo field by where he is on screen and fades with distance. Barks have a cooldown; the pant is audible only close by.

## 7. Budgets

| | Budget |
|---|---|
| Draw calls | 3 in the world (the fur mesh, the shadow stand-in in the main pass and in the shadow pass); the profile canvas is separate. As built: 161 → 164 calls at spawn |
| Triangles | ≈ 6.7 k base + ≈ 4.7 k per shell: ≈ 63 k with 12 shells, + 6.7 k for the shadow. As built: 746 k → 823 k at spawn, 60 fps, 0 NaN pixels |
| Textures | The fur tile, 256² WebP (32 KB) |
| JS | His mind in the initial bundle (≈ 5 KB); his body in its own chunk loaded alongside the textures, so its shader compiles with the scene (≈ 10 KB); the card on first open (≈ 3 KB) |
| CPU | Brain and animation < 0.2 ms per frame |
| Sound | `dog.mp3` 103 KB (6 barks, 4 sniffs, 2 whistles) + `pant.mp3` 22 KB, fetched with the other sounds |
| Photos | Two 900 px WebP, 47 + 39 KB, fetched only when the card opens |

## 8. Tests

- **Unit** (`tests/unit/chopper.test.ts`):
  - **Gaits:** phase offsets per gait.
  - **Stance:** a paw in stance moves backward at body speed.
  - **Skin weights:** they sum to 1 and each part is bound to its own chain.
  - **Brain:** the utility selector commits and cools down; the follow score rises with distance; the whistle overrides; warp when far; personal space; run-ahead sits ahead of the player; the chase ends; the scent trail keeps clear of obstacles; the idle picker never repeats.
- **E2E** (`tests/e2e/planet.spec.ts`, "Chopper"):
  - **In the world:** he is there, stays within the far band through a minute of play, and F (and the dog button) plays the whistle and brings him to heel.
  - **The card:** "Meet Chopper" opens it, with the photo (loaded, with alt text), the second photo and the 3D view; it passes axe; Esc closes it (not the menu), focus goes back to the planet, and the canvas is released.
- **Real-GPU look:** close-ups of the face, side, running, sitting, scratching and play-bowing, checked against the photos.

## 8b. As built: what changed while building

- **Steering round obstacles:** Reynolds' side-push alone left him pressing into a tree or a building's footprint. He now uses **feelers**: if the step ahead is blocked, he tries turning a little more each way (on the side he's been going, so he doesn't dither) and takes the first free step.
- **Running ahead:** a fixed spot 5 u ahead was often reached with the character already there. The spot now moves with the character until he's close to it, then he sits and waits (up to 8 s, or until they're within 1.6 u).
- **The chase** eases off from 2.2 u, so he stops about 1 u short of the rabbit.
- **Fur:** alpha-to-coverage was tried for softer strand edges, but outside the composer's MSAA it drew dark contours; the strands use a plain alpha test. A `sqrt(0)` in the root shading gave NaNs on the D3D11 backend: every such base is clamped.
- **Meet Chopper** needs you to face him within 65° (not just the usual reach), so a dog trotting beside you doesn't take <kbd>E</kbd>; near a landmark he must be within 0.8 u.
- **Whistle cooldown:** 2 s.

---

## 9. Critique of the plan, and what changed

| Weak point | Why it matters | Improvement (built) |
|---|---|---|
| Rigid parts per bone, as for the wildlife | Seams at the joints show in a close-up; about 12 draw calls | One **skinned** mesh with **envelope** weights: smooth bends and one draw call |
| Shells drawn N times as N meshes | N× draw calls and sorting trouble | All shells **merged into the one geometry** with a shell-index attribute, alpha-tested (no sorting) |
| Every shell casting a shadow | 12× the shadow cost for no visible gain | A base-only shadow stand-in sharing his buffers and skeleton (a depth material that collapsed the shells still paid for their vertices) |
| 2D UV noise for strands | The generated kit geometry has no clean UVs, so strands would swim or stretch | **3D** cellular noise on the bind-pose position, and triplanar sampling of the fur tile |
| Behaviours that re-decide every frame | Dithering, a dog that can't make up its mind | A minimum commitment per behaviour, hysteresis on the leash, and **cooldowns** |
| The dog stealing E from buildings | His prompt could hide a landmark's card as he trots past | "Meet Chopper" only within 1.2 u (0.8 u near a landmark) *and* while facing him within 65° |
| The dog blocking the character | Frustrating, the most common companion complaint | A personal-space bubble in steering, and he keeps off the character's path |
| A second WebGL context for the card | Browsers cap live contexts, and GPU memory | Created only while the card is open and disposed on close; a smaller canvas, DPR ≤ 1.5, shadows off; a static render of his photo if WebGL isn't available |
| Barks every few seconds | Grating | Barks only in context (rabbit, play bow, answering the whistle), per-behaviour caps and a global 3 s cooldown |
| Random idles repeating | Feels canned | A weighted shuffle with no immediate repeat, plus per-clip cooldowns |
| Rabbits never escaping | The chase would be cruel and endless | The chase caps at 7 s; he never catches one (he stops 1 u short); a playful bark to end it |
| Lost after fast travel | Breaks the illusion | Warp: he's there when you land (behind you, out of view) |
| Reduced motion | Motion sensitivity | No bounces or springs; transitions still smooth; ambient pause sits him down |
| Content invented about him | It's a tribute: facts must be the owner's | The card's text lives in one data file (`chopper/profile.ts`), holding only what the owner said (breed, coat, what he did). Anything else is left for the owner to add |
