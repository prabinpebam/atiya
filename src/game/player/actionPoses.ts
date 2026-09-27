import { CYCLES, MINE_SWINGS, PICKAXE, type ActionKind } from '../systems/actions';

/**
 * Hand-keyed action poses (docs: collection-inventory.md §5). Each limb gets a target direction in
 * the character's own frame: [forward, up, out] (out = away from the body's midline on that
 * limb's side), which `aimBone` turns into bone rotations over whatever the mixer played. The
 * rig's own bone axes never matter.
 */
export type Dir = readonly [number, number, number];

export interface Limb {
  upper: Dir;
  lower: Dir;
}

export interface ActionPose {
  /** Overall blend weight (a short fade in and out). */
  w: number;
  /** How far the hips drop (u). */
  hip: number;
  /** Direction of the spine (Spine → Chest) and of the upper chest (Chest → UpperChest). */
  spine: Dir;
  chest: Dir;
  arms: { l: Limb; r: Limb };
  /** Legs, only where they bend (the squat). */
  legs?: { l: Limb; r: Limb };
  /** The pickaxe's scale (0 hidden … 1, with a pop). */
  pickaxe: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixDir = (a: Dir, b: Dir, t: number): Dir => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mixLimb = (a: Limb, b: Limb, t: number): Limb => ({ upper: mixDir(a.upper, b.upper, t), lower: mixDir(a.lower, b.lower, t) });
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Fade in from `a` to `b`, hold, fade out from `c` to `d`. */
const envelope = (t: number, a: number, b: number, c: number, d: number) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));

const both = (l: Limb, r: Limb = l) => ({ l, r });

// ---------- shake a tree: grab the trunk, three push-pull rocks, let go ----------
const GRAB: Limb = { upper: [0.9, 0.05, 0.22], lower: [1, 0.15, -0.3] };
const PUSH: Limb = { upper: [1, 0.12, 0.2], lower: [1, 0.05, -0.22] };
const PULL: Limb = { upper: [0.55, -0.35, 0.28], lower: [1, 0.35, -0.3] };

function shake(t: number): ActionPose {
  const c = CYCLES.shake;
  const w = envelope(t, c.approach - 0.05, c.approach + 0.14, c.duration - c.retreat - 0.12, c.duration - c.retreat + 0.06);
  const t0 = c.approach + 0.14;
  const t1 = c.duration - c.retreat - 0.14;
  const rock = t > t0 && t < t1 ? Math.sin((t - t0) * Math.PI * 2 * 2.7) : 0;
  const push = clamp01(rock * 0.5 + 0.5);
  const arm = t < t0 ? GRAB : mixLimb(PULL, PUSH, push);
  return {
    w,
    hip: 0.02 + 0.015 * Math.abs(rock),
    spine: [lerp(-0.1, 0.28, push) * (t > t0 ? 1 : 0.5), 1, 0],
    chest: [lerp(-0.05, 0.22, push), 1, 0],
    arms: both(arm),
    pickaxe: 0,
  };
}

// ---------- mine a boulder: the pickaxe pops in, three overhead swings, it pops away ----------
const READY: Limb = { upper: [0.55, -0.6, 0.08], lower: [0.9, 0.1, -0.35] };
const WINDUP: Limb = { upper: [-0.15, 1, 0.12], lower: [-0.45, 0.8, -0.3] };
const STRIKE: Limb = { upper: [1, -0.3, 0.06], lower: [0.85, -0.55, -0.25] };

function mine(t: number): ActionPose {
  const c = CYCLES.mine;
  const w = envelope(t, c.approach - 0.08, c.approach + 0.12, c.duration - 0.2, c.duration);
  let arm = READY;
  let lean = 0.05;
  let hip = 0.02;
  for (const s of MINE_SWINGS) {
    const up = s.hit - 0.14;
    if (t >= s.start && t < up) {
      // wind up behind the head
      const k = smooth((t - s.start) / (up - s.start));
      arm = mixLimb(READY, WINDUP, k);
      lean = lerp(0.05, -0.18, k);
    } else if (t >= up && t < s.hit) {
      // strike down onto the rock (fast)
      const k = (t - up) / (s.hit - up);
      arm = mixLimb(WINDUP, STRIKE, k * k);
      lean = lerp(-0.18, 0.38, k);
      hip = 0.02 + 0.04 * k;
    } else if (t >= s.hit && t < s.hit + 0.14) {
      // recoil back to ready
      const k = smooth((t - s.hit) / 0.14);
      arm = mixLimb(STRIKE, READY, k);
      lean = lerp(0.38, 0.05, k);
      hip = 0.06 - 0.04 * k;
    }
  }
  // the pickaxe appears (a pop past full size) and disappears the same way
  const pin = clamp01((t - PICKAXE.in) / 0.16);
  const pout = clamp01((PICKAXE.out - t) / 0.12);
  const pop = (k: number) => (k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15);
  return {
    w,
    hip,
    spine: [lean, 1, 0],
    chest: [lean * 0.7, 1, 0],
    // both hands on the handle: the left a little lower and nearer the midline
    arms: { l: { upper: [arm.upper[0], arm.upper[1] - 0.08, 0.02], lower: [arm.lower[0], arm.lower[1], -0.5] }, r: arm },
    pickaxe: t < PICKAXE.in || t > PICKAXE.out ? 0 : Math.min(pop(pin), pout < 1 ? pout : 1),
  };
}

// ---------- pick a flower: squat, reach down, pluck, stand ----------
const STAND_ARM: Limb = { upper: [0.1, -1, 0.15], lower: [0.25, -1, 0] };
const REACH: Limb = { upper: [0.7, -0.75, 0.08], lower: [0.55, -0.85, -0.1] };
const KNEE: Limb = { upper: [0.35, -0.95, 0.28], lower: [0.7, -0.6, -0.1] };
const SQUAT_LEG: Limb = { upper: [0.6, -0.8, 0.12], lower: [-0.35, -0.95, 0] };

function pick(t: number): ActionPose {
  const c = CYCLES.pick;
  const down = smooth((t - c.approach + 0.04) / 0.22) * (1 - smooth((t - 0.5) / 0.26));
  const w = envelope(t, c.approach - 0.06, c.approach + 0.08, c.duration - 0.12, c.duration);
  const pluck = t > 0.42 ? smooth((t - 0.42) / 0.12) : 0;
  const right = mixLimb(STAND_ARM, REACH, down);
  return {
    w,
    hip: 0.13 * down,
    spine: [0.55 * down, 1, 0],
    chest: [0.35 * down, 1, 0],
    arms: { l: mixLimb(STAND_ARM, KNEE, down), r: { upper: right.upper, lower: [right.lower[0], right.lower[1] + pluck * 0.5, right.lower[2]] } },
    legs: both(mixLimb({ upper: [0.02, -1, 0.05], lower: [0.02, -1, 0] }, SQUAT_LEG, down)),
    pickaxe: 0,
  };
}

// ---------- open the chest: lean in, both hands lift the lid ----------
const LID_LOW: Limb = { upper: [0.9, -0.45, 0.2], lower: [0.9, -0.25, -0.15] };
const LID_UP: Limb = { upper: [0.95, -0.05, 0.2], lower: [0.75, 0.45, -0.15] };

function open(t: number): ActionPose {
  const c = CYCLES.open;
  const w = envelope(t, c.approach - 0.06, c.approach + 0.06, c.duration - 0.02, c.duration + 0.25);
  const lift = smooth((t - 0.26) / 0.2);
  return { w, hip: 0.04, spine: [0.3 - 0.2 * lift, 1, 0], chest: [0.2 - 0.1 * lift, 1, 0], arms: both(mixLimb(LID_LOW, LID_UP, lift)), pickaxe: 0 };
}

/** Poses a chunk registers for its own action cycles (the home chunk: water). */
export const EXTRA_POSES: Partial<Record<ActionKind, (t: number) => ActionPose>> = {};

/** The pose for action `kind` at `t` seconds into its cycle. */
export function actionPose(kind: ActionKind, t: number): ActionPose {
  switch (kind) {
    case 'shake':
      return shake(t);
    case 'mine':
      return mine(t);
    case 'pick':
      return pick(t);
    case 'open':
      return open(t);
    default:
      return EXTRA_POSES[kind]!(t);
  }
}

