/**
 * Resting anywhere (docs: rest.md): sitting on the grass and lying back on it, as action poses the
 * avatar blends over its clip (`controller.restPose`, set by the crafting chunk). Pure.
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
