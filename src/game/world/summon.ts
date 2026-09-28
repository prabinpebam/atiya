/**
 * Progressive loading (docs: poc-3d-navigation/progressive-loading.md §5.5, §5.7): the order the planet
 * is summoned in once it's live, the wave that times each object's appearance outward from the
 * character, and the pop each kind of thing makes as it appears. Pure: no three.js objects, no DOM.
 */

/** The summoned groups (T2), in the order they're mounted and revealed. */
export const SUMMON_GROUPS = ['prabin', 'props', 'home', 'grass', 'craft', 'wildlife', 'clouds'] as const;
export type SummonGroup = (typeof SUMMON_GROUPS)[number];

/** Where the load is: T1 until the planet is live, then summoning, then complete. */
export type LoadTier = 'loading' | 'live' | 'complete';

/** The wave's speed across the planet (u/s), and how many objects may start popping per frame. */
export const WAVE = { speed: 12, perFrame: 6, frameS: 1 / 60, usableNear: 4 } as const;

/** How long a pop takes (s) to settle. */
export const POP_S = 0.45;

/**
 * When each object starts to appear (s): `start` plus its distance from the character over the wave's
 * speed. Within `WAVE.usableNear` u, what can be used comes a little before what's only seen. No more
 * than `perFrame` objects start in any one frame, so the wave reads as a ripple rather than a flash.
 * Returns the times in the input's order.
 */
export function waveTimes(dists: readonly number[], start: number, usable?: readonly boolean[], o: { speed?: number; perFrame?: number; frameS?: number } = {}): number[] {
  const speed = o.speed ?? WAVE.speed;
  const perFrame = Math.max(1, o.perFrame ?? WAVE.perFrame);
  const frameS = o.frameS ?? WAVE.frameS;
  const eff = dists.map((d, i) => (usable?.[i] && d < WAVE.usableNear ? d * 0.5 : d));
  const order = eff.map((_, i) => i).sort((a, b) => eff[a] - eff[b] || a - b);
  const out = new Array<number>(dists.length);
  const starts: number[] = [];
  for (const i of order) {
    let t = start + Math.max(0, eff[i]) / speed;
    const k = starts.length - perFrame;
    if (k >= 0) t = Math.max(t, starts[k] + frameS);
    starts.push(t);
    out[i] = t;
  }
  return out;
}

/** The kinds of appearance (§5.5's table): one idea in several voices. */
export type PopKind = 'tree' | 'rock' | 'flower' | 'model' | 'fade';

export interface PopPose {
  /** Uniform scale (0 before it starts, 1 once settled). */
  scale: number;
  /** Extra vertical stretch (> 1 tall, < 1 squashed), on top of `scale`. */
  stretch: number;
  /** Tilt about the upright (rad): the wiggle. */
  wiggle: number;
  /** Height offset (u) above where it rests (a rock drops in). */
  drop: number;
  /** Opacity, for things that fade in (0…1). */
  alpha: number;
  /** True once the pop is over (nothing left to animate). */
  done: boolean;
}

const SETTLED: PopPose = Object.freeze({ scale: 1, stretch: 1, wiggle: 0, drop: 0, alpha: 1, done: true });
const UNBORN: PopPose = Object.freeze({ scale: 0, stretch: 1, wiggle: 0, drop: 0, alpha: 0, done: false });

/**
 * A damped spring from 0 to 1: it overshoots to about 1.12 and settles within `dur` (s). `t` is the
 * time since it started (s). Never NaN: anything non-finite or negative is "not started".
 */
export function spring(t: number, dur = POP_S): number {
  if (!(t > 0)) return 0;
  if (t >= dur) return 1;
  const x = t / dur;
  // under-damped: e^(−ζωt)·cos, tuned so the first peak is ≈ 1.12 and it's within 1 % at x = 1
  const v = 1 - Math.exp(-4.8 * x) * Math.cos(7.4 * x) * (1 - x * 0.35);
  return Math.min(1.2, Math.max(0, v));
}

/**
 * The pose of an object `t` s after its birth (negative: not born yet). `seed` (0…1) varies the wiggle's
 * direction and phase between objects. Under reduced motion there's no motion at all: it's simply there
 * from its birth.
 */
export function popPose(kind: PopKind, t: number, seed = 0, reduced = false): PopPose {
  if (!Number.isFinite(t) || t < 0) return UNBORN;
  if (reduced) return SETTLED;
  const dur = kind === 'flower' ? POP_S * 0.7 : kind === 'model' ? POP_S * 1.4 : kind === 'fade' ? POP_S * 1.6 : POP_S;
  if (t >= dur) return SETTLED;
  const x = t / dur;
  const s = spring(t, dur);
  const decay = Math.exp(-4 * x);
  const wiggle = Math.sin(t * 26 + seed * 6.283) * 0.1 * decay * (1 - x);
  switch (kind) {
    case 'rock': {
      // heavy: it drops the last bit onto the ground and squashes, then springs back
      const fall = Math.max(0, 1 - x * 3);
      const land = x > 0.33 ? Math.sin(Math.min(1, (x - 0.33) / 0.4) * Math.PI) * 0.18 * (1 - x) : 0;
      return { scale: Math.min(1, 0.6 + x * 3), stretch: 1 - land, wiggle: 0, drop: 0.5 * fall * fall, alpha: 1, done: false };
    }
    case 'flower':
      return { scale: s, stretch: 1, wiggle: wiggle * 0.6, drop: 0, alpha: 1, done: false };
    case 'model':
      // rises out of the ground as the builds do (scale in height first), with a small overshoot
      return { scale: Math.min(1, x * 4), stretch: s / Math.max(1e-3, Math.min(1, x * 4)), wiggle: 0, drop: 0, alpha: 1, done: false };
    case 'fade':
      return { scale: 1, stretch: 1, wiggle: 0, drop: 0, alpha: Math.min(1, Math.max(0, x * x * (3 - 2 * x))), done: false };
    default:
      return { scale: s, stretch: 1 + (s - Math.min(1, s)) * 0.8, wiggle, drop: 0, alpha: 1, done: false };
  }
}

/**
 * The grass's sprouting ripple: how grown (0…1) grass `d` u from the wave's centre is, `t` s after the
 * wave set off. It rises over `ramp` u behind the front.
 */
export function sproutAt(d: number, t: number, speed: number = WAVE.speed, ramp = 1.5): number {
  if (!(t > 0)) return 0;
  const v = (t * speed - d) / ramp;
  return v >= 1 ? 1 : v <= 0 ? 0 : v * v * (3 - 2 * v);
}
