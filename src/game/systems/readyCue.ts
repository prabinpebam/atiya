/**
 * "Ready to use" cues on the thing itself (docs: crafting.md §7): when the chest or the crafting
 * table becomes what E would use, it wakes with a one-shot animation (the chest wiggles and its lid
 * rattles; the tools hop to life) and then shows a steady sign while you stay (glints; the chest's
 * lid ajar with a warm glow inside). Pure: stepped by the controller, drawn by the views.
 */

/** Timings (s) and rates. */
export const CUE = {
  /** The chest's wiggle lasts this long. */
  wiggle: 0.85,
  /** Each tool's hop lasts this long, the next one starting `stagger` later. */
  hop: 0.5,
  stagger: 0.07,
  /** Easing rates (1/s) toward ready and back. */
  rise: 7,
  fall: 5,
} as const;

export class ReadyCue {
  /** 0…1, eased: how ready it looks (the steady sign). */
  on = 0;
  /** Seconds since it last woke (Infinity: never). */
  since = Infinity;
  /** Whether it's the target right now. */
  active = false;
  /** Times it has woken (for tests). */
  wakes = 0;

  step(dt: number, active: boolean): void {
    if (active && !this.active) {
      this.since = 0;
      this.wakes++;
    } else this.since += dt;
    this.active = active;
    const k = 1 - Math.exp(-(active ? CUE.rise : CUE.fall) * dt);
    this.on += ((active ? 1 : 0) - this.on) * k;
    if (Math.abs(this.on - (active ? 1 : 0)) < 1e-4) this.on = active ? 1 : 0;
  }
}

export interface ChestPose {
  /** Tilt side to side and front to back (rad), about the chest's base. */
  rollZ: number;
  pitchX: number;
  /** Squash and stretch (height scale; the width keeps the volume). */
  sy: number;
  /** The lid's lift (rad): a rattle while it wiggles, then resting ajar. */
  lid: number;
  /** How bright the glow inside is (0…1). */
  glow: number;
}

/** A decaying envelope: 1 at the start, easing to 0 at `len`. */
const env = (t: number, len: number) => (t >= 0 && t < len ? (1 - t / len) ** 2 : 0);

/** The chest's pose: `since` the wake, `on` the steady level; `still` for reduced motion. */
export function chestPose(since: number, on: number, still: boolean): ChestPose {
  if (still || !(since < CUE.wiggle)) return { rollZ: 0, pitchX: 0, sy: 1, lid: on * 0.13, glow: on };
  const e = env(since, CUE.wiggle);
  const w = Math.sin(since * Math.PI * 2 * 5.5);
  // a quick crouch then a stretch (anticipation, squash and stretch), riding on the wiggle
  const hop = since < 0.3 ? -Math.sin((since / 0.3) * Math.PI) * 0.1 : Math.sin(((since - 0.3) / 0.55) * Math.PI) * 0.07;
  return {
    rollZ: 0.14 * e * w,
    pitchX: 0.05 * e * Math.sin(since * Math.PI * 2 * 3.1 + 1),
    sy: 1 + hop,
    lid: on * 0.13 + 0.3 * e * Math.abs(w),
    glow: on,
  };
}

export interface ToolPose {
  /** Lift above its resting place (u). */
  lift: number;
  /** Rotations about its pivot (rad). */
  rx: number;
  ry: number;
  rz: number;
}

/** How each tool comes to life: how high it hops, how far it spins, and what it does after. */
export interface ToolMotion {
  hop: number;
  spin: number;
  idle: 'tap' | 'rock' | 'bob' | 'swing';
}

/**
 * A tool's pose: the `i`th hops `stagger` after the one before (a ripple across the bench), spins
 * a little in the air and lands; while you stay, it keeps a small idle motion (the hammer taps, the
 * saw rocks, the mallet swings on its peg, the rest bob). `time` is a free-running clock.
 */
export function toolPose(m: ToolMotion, i: number, since: number, on: number, time: number, still: boolean): ToolPose {
  if (still) return { lift: 0, rx: 0, ry: 0, rz: 0 };
  const t = since - i * CUE.stagger;
  const inHop = t >= 0 && t < CUE.hop;
  const u = inHop ? t / CUE.hop : 0;
  const up = inHop ? Math.sin(u * Math.PI) : 0;
  const spin = inHop ? Math.sin(u * Math.PI * 2) * m.spin : 0;
  // the idle starts once the hop is over, easing in
  const idleK = on * Math.min(1, Math.max(0, (t - CUE.hop) / 0.4));
  const ph = time * 2.2 + i * 1.7;
  let lift = m.hop * up;
  let rx = 0;
  const ry = spin;
  let rz = 0;
  if (m.idle === 'tap') {
    // lift and tap down, every 1.4 s
    const c = (time + i * 0.3) % 1.4;
    rz += idleK * (c < 0.35 ? Math.sin((c / 0.35) * Math.PI) * 0.5 : 0);
  } else if (m.idle === 'rock') rx += idleK * Math.sin(ph * 1.6) * 0.12;
  else if (m.idle === 'swing') rz += idleK * Math.sin(ph) * 0.3;
  else lift += idleK * (0.5 + 0.5 * Math.sin(ph)) * 0.025;
  return { lift, rx, ry, rz };
}

/** Where a twinkle is (in a unit box, −1…1) and how big (0…1) at `time`: it drifts up and fades, then starts again. */
export function sparkle(i: number, count: number, time: number, on: number, still: boolean): { x: number; y: number; z: number; s: number } {
  const a = (i / count) * Math.PI * 2 + i * 0.9;
  if (still) return { x: Math.cos(a) * 0.8, y: 0.2 + (i % 3) * 0.3, z: Math.sin(a) * 0.8, s: on * 0.8 };
  const period = 1.6 + (i % 3) * 0.35;
  const c = ((time + i * 0.47) % period) / period;
  return { x: Math.cos(a + c * 0.6) * 0.85, y: -0.2 + c * 1.4, z: Math.sin(a + c * 0.6) * 0.85, s: on * Math.sin(c * Math.PI) };
}
