# Collision: hard and soft things, and making way

> **TL;DR.** The character used to collide as a 0.35 u disc against footprints that were bigger than what they looked like: a tree's roots' spread, a whole bush, a 0.2 u disc round Chopper and each of the family. So it stopped short of things it looked able to reach, and on the narrow deck steps anyone standing still was a wall. Now collision works the way game engines do it:
>
> - The character's body is its shoulders' size (0.24 u).
> - Everything it can touch is either **hard** (trunks, rocks, walls, rails, furniture), stopping it at what you see, or **soft** (bushes, the family, Chopper).
> - You can press into something soft: its leaves or personal space slow you, bushes and flowers lean away from you, and the family and Chopper step aside when nudged.
> - If you keep pressing on something soft that can't give way, you squeeze past it.
> - The route planners still keep the full footprints, so the family and Chopper walk round bushes as before.

## 1. How games do it

| Practice | Where it's from | What we take |
|---|---|---|
| **Collision responses per kind of object**: each collider blocks, overlaps (detects, lets through) or is ignored, per channel | Unreal Engine's collision responses (Block, Overlap, Ignore); Unity's layers and triggers | Hard things block; soft things let you in and respond; grass, flowers and sprigs are ignored |
| **Colliders fit what you touch, not what you see from above**: a tree is a trunk capsule, not its crown or its roots' spread; the character is a capsule about its shoulders' size | Common practice in character controllers (Unity's `CharacterController`, Unreal's `CapsuleComponent`) | The character's body is 0.24 u; each obstacle can have a `core` smaller than its footprint |
| **Interactive foliage**: plants bend away from what passes through them instead of stopping it | Unreal's interactive foliage; the grass here already parts round movers | Bushes, flowers and sprigs lean away from the character's feet in their sway shader |
| **Soft contact between characters**: characters don't hard-block each other; they push apart | Crowd separation in Recast/Detour; pawn pushing in character movement components | The family and Chopper are soft: you come right up to them and nudge them aside |
| **Companions never block the player**: they keep off the player's path, step aside when bumped, and where nothing else works the game bends the rules so the player passes | Naughty Dog's buddy AI in *The Last of Us* ([Game AI Pro 2, ch. 35, "Ellie: Buddy AI in The Last of Us"](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter35_Ellie_Buddy_AI_in_The_Last_of_Us.pdf)) | Keep off the line (existing avoidance), step aside when nudged, and squeeze past as the last resort |

## 2. What was wrong

| # | Problem | Why |
|---|---|---|
| 1 | You stopped short of trees, rocks and people | The character collided as a 0.35 u disc (its clearance for planning), against footprints sized for the planners: 0.42 u for a hardwood's trunk, which is 0.3 u across its roots |
| 2 | Bushes were walls | A bush blocked at its whole leafy radius, and nothing in it gives |
| 3 | Chopper and the family blocked narrow ways | Each was a hard 0.2 u disc; you stopped at 0.57 u from their centres, before their own keep-apart gap (0.55 u for the family, 0.6 u for Chopper) could push them. Standing, Chopper didn't keep apart at all. On the deck's steps, between rails, nobody could pass |

## 3. Hard and soft (as built)

- **The body:** `CONFIG.bodyRadius` is 0.24 u, what the character collides with (`PlanetSim`). `CONFIG.playerRadius` (0.35 u) stays the clearance the layout, the spawn and the planners keep.
- **Obstacles** (`math/sphere.ts` `Obstacle`) gain two optional fields:
  - `core`: what a body stops at, when less than the footprint (`radiusU`). The planners and the layout keep using `radiusU`.
  - `soft`: between `core` and the footprint the character presses in.
- **Hard** (no `soft`):

  | Thing | Footprint (planners) | Core (the body stops at) |
  |---|---|---|
  | Hardwood and fruit trees | 0.42 u × size | 0.3 u × size (the trunk and root flare) |
  | Cedars | 0.36 u × size | 0.22 u × size |
  | Rocks, boulders, furniture, walls, rails, rims, the landmarks | as before | the footprint (already within what you see) |

- **Soft:**

  | Thing | Footprint | Core |
  |---|---|---|
  | Bushes and flowering bushes (the layout's and the deck's cliff's) | 0.42 u × size | 0.18 u × size (the stems) |
  | Each of the family | 0.34 u | 0.16 u |
  | Chopper | 0.34 u | 0.14 u |

- **In something soft** (`PlanetSim.stepSoft`):
  - You slow as you press in, up to `softDrag` (45 %) at the core.
  - Pressing on against its core (walking into it) for `squeezeS` (0.4 s) lets you squeeze past: it stops blocking you until you're out of its footprint again, then it's solid as before.
  - Brushing past without walking into it never lets you through.
  - Something hard never gives way, however long you press on it.
- **Plants lean away** from the character's feet (the `uPush` uniform in `addSway`, `world/Props.tsx`): leaves and stems within 0.7 u bend out, most at the top, so walking through a bush, the flowers or the sprigs parts them. It's one uniform and a few vertex instructions on the sway materials already there (no new draw, no new material), and it stays on while ambient motion is paused, because it follows the character.
- **Walls stay closed:** every wall is a chain of circles (the cliffs' rings and rims, the bridges' rails, the fence, the deck's rails), and no gap between neighbours is wide enough for the smaller body.

## 4. Making way (as built)

A strategy in four layers, cheapest first; each covers what the one before can't.

1. **Keep off the character's line (existing):** walking, the family steer with predictive avoidance and keep a personal space; Chopper keeps off the line the character is walking.
2. **Step aside when nudged:** the body reaches someone's personal space before their core, so walking into them pushes them.
   - Each of the family keeps 0.55 u (`FAMILY.gapPlayer`) and Chopper 0.6 u (`DOG.minGap`) from the character, now whether they're walking or standing.
   - Nudged by the character walking at them, they move toward the side they're on (a small turn round the character each frame, so they slide aside rather than jump), not straight ahead of it.
   - Only onto open ground: never into the pond, a rail or a wall.
3. **Pushed along when boxed in:** in a narrow way (the deck's steps, between rails), there's no room to the side, so they're nudged along ahead of the character until the way opens out, and then step aside.
4. **Squeeze past:** if there's no room at all (a narrow way that's blocked ahead too), the character presses on and squeezes past them after 0.4 s (§3). You're never stuck behind anyone.

## 5. Tests

- `tests/unit/collision.test.ts`:
  - a trunk stops the body at its bark;
  - something hard never gives way;
  - a bush slows you, stops you at its stems, lets you push through it, and is solid again after;
  - brushing past a bush never takes you through it;
  - no wall has a gap a body fits through;
  - Chopper, lying in a narrow way, is nudged along and aside and the character gets through, and he's never pushed into a rail;
  - boxed in with no room at all, the character squeezes past.
- `tests/unit/deck.test.ts`: the visitor climbs the deck's lower steps past Prabin standing on the long flight: he's nudged aside or along, the climb finishes, and he's never pushed into a rail or the cliff.
- `tests/unit/movement.test.ts`: push-out and no tunnelling, with the body's radius.

## 6. Budgets

- **Initial bundle:** the soft contact in `PlanetSim`, the cores, and the plants' lean. To make room, the build step that drops the shaders' `//` comment lines from the built chunks now drops their lines' leading indentation too (GLSL doesn't need it; about 1 KB gz). 449.2 KB (≤ 450).
- **On demand:** Chopper's and the family's stepping aside. 105.9 KB (under the proposed 106 KB waiver in [plan §6](./plan.md)).
