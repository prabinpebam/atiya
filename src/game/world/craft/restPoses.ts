/**
 * Resting anywhere and jumping (docs: rest.md): sitting on the grass, lying back on it and the hop, as
 * action poses the avatar blends over its idle and run clips (applied by the crafting chunk). Pure.
 */
import type { ActionPose, Dir, Limb } from '../../player/actionPoses';

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixDir = (a: Dir, b: Dir, t: number): Dir => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mixLimb = (a: Limb, b: Limb, t: number): Limb => ({ upper: mixDir(a.upper, b.upper, t), lower: mixDir(a.lower, b.lower, t) });
const both = (l: Limb, r: Limb = l) => ({ l, r });

/** Directions in the character's own frame: [forward, up, out]. */
export const REST = {
  /** On the grass, knees up, leaning back a little on both hands: the hips drop to a hand's breadth off the ground. */
  sit: {
    hip: 0.3,
    spine: [-0.22, 1, 0] as Dir,
    chest: [-0.1, 1, 0] as Dir,
    arms: both({ upper: [-0.45, -0.85, 0.25], lower: [-0.3, -0.95, 0.08] }),
    legs: both({ upper: [0.88, 0.32, 0.14], lower: [0.3, -0.95, 0.04] }),
  },
  /** Flat on the back, hands behind the head, one knee up. */
  lie: {
    hip: 0.31,
    spine: [-0.97, 0.22, 0] as Dir,
    chest: [-1, 0.12, 0] as Dir,
    arms: both({ upper: [-0.55, 0.25, 0.8], lower: [-0.3, 0.35, -0.9] }),
    legs: { l: { upper: [1, 0.05, 0.08] as Dir, lower: [1, -0.08, 0.03] as Dir }, r: { upper: [0.78, 0.6, 0.1] as Dir, lower: [0.4, -0.92, 0.05] as Dir } },
  },
} as const;

/**
 * The resting pose at blend `k` (0 standing … 1 there) and time `t` (s): the sit eases in; lying
 * down sits first (its first half is the sit), then leans back. A slow breath lifts the chest.
 */
export function restPose(kind: 'sit' | 'lie', k: number, t: number): ActionPose {
  const S = REST.sit;
  const L = REST.lie;
  const breath = Math.sin(t * 1.5) * 0.025;
  if (kind === 'sit' || k <= 0.5) {
    const w = smooth(kind === 'sit' ? k : k * 2);
    return { w, hip: S.hip, spine: S.spine, chest: [S.chest[0] - breath, S.chest[1], 0], arms: S.arms, legs: S.legs, pickaxe: 0 };
  }
  const u = smooth((k - 0.5) * 2);
  return {
    w: 1,
    hip: lerp(S.hip, L.hip, u),
    spine: mixDir(S.spine, L.spine, u),
    chest: mixDir(S.chest, [L.chest[0], L.chest[1] + breath, 0], u),
    arms: { l: mixLimb(S.arms.l, L.arms.l, u), r: mixLimb(S.arms.r, L.arms.r, u) },
    legs: { l: mixLimb(S.legs.l, L.legs.l, u), r: mixLimb(S.legs.r, L.legs.r, u) },
    pickaxe: 0,
  };
}

/**
 * The hop (Space): take-off with the arms swinging up and the knees tucked, the arms spreading for
 * balance and the legs reaching down as it falls, and a knee-bend on landing. Posed over the idle and
 * run clips, which keep their full weight (the rig's own jump clip keys only 12 bones, and blending it
 * in let the rest fall back to the bind pose: a T-pose).
 */
export const JUMP_POSE = {
  rise: { hip: 0, spine: [0.14, 1, 0] as Dir, chest: [0.08, 1, 0] as Dir, arms: both({ upper: [0.45, 0.75, 0.3], lower: [0.35, 0.9, 0.05] }), legs: both({ upper: [0.6, -0.78, 0.1], lower: [-0.4, -0.9, 0.02] }) },
  fall: { hip: 0, spine: [0.05, 1, 0] as Dir, chest: [0, 1, 0] as Dir, arms: both({ upper: [0.1, 0.25, 0.95], lower: [0.25, 0.55, 0.8] }), legs: both({ upper: [0.22, -0.97, 0.08], lower: [-0.08, -1, 0.02] }) },
  land: { hip: 0.09, spine: [0.3, 1, 0] as Dir, chest: [0.15, 1, 0] as Dir, arms: both({ upper: [0.35, -0.9, 0.3], lower: [0.6, -0.7, 0.05] }), legs: both({ upper: [0.65, -0.75, 0.1], lower: [-0.45, -0.88, 0.02] }) },
} as const;
/** How long the landing's knee-bend lasts (s), and the take-off's blend in (s). */
export const LAND_S = 0.24;
const TAKEOFF_S = 0.07;

type Pose = (typeof JUMP_POSE)[keyof typeof JUMP_POSE];
const mixPose = (a: Pose, b: Pose, t: number): Omit<ActionPose, 'w' | 'pickaxe'> => ({
  hip: lerp(a.hip, b.hip, t),
  spine: mixDir(a.spine, b.spine, t),
  chest: mixDir(a.chest, b.chest, t),
  arms: { l: mixLimb(a.arms.l, b.arms.l, t), r: mixLimb(a.arms.r, b.arms.r, t) },
  legs: { l: mixLimb(a.legs.l, b.legs.l, t), r: mixLimb(a.legs.r, b.legs.r, t) },
});

/**
 * The hop's pose: in the air from its vertical speed `v` (`vMax` at take-off, −`vMax` at landing) and
 * the time `air` since take-off; `land` s after landing (or −1 if it hasn't); null once it's over.
 * `moving` (0 standing … 1 walking or running): on the move the legs keep the run cycle's stride
 * through the hop (they'd stiffen otherwise), and only the arms and the body react, more lightly.
 */
export function jumpPose(v: number, vMax: number, air: number, land: number, moving = 0): ActionPose | null {
  const J = JUMP_POSE;
  let p: ActionPose;
  if (land >= 0) {
    if (land >= LAND_S) return null;
    // from the fall straight into the bend (quick), then up out of it (slower) as the weight lets go
    const w = land < 0.06 ? 1 : 1 - smooth((land - 0.06) / (LAND_S - 0.06));
    p = { w, pickaxe: 0, ...mixPose(J.fall, J.land, Math.min(1, land / 0.06)) };
  } else {
    const u = smooth((vMax - v) / (2 * vMax));
    p = { w: smooth(air / TAKEOFF_S), pickaxe: 0, ...mixPose(J.rise, J.fall, u) };
  }
  if (moving > 0.3) {
    p.legs = undefined;
    p.hip *= 1 - moving;
    p.w *= 1 - 0.4 * moving;
  }
  return p;
}
