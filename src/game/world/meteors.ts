/**
 * Shooting stars (pure): now and then on a clear night one streaks across the sky and burns out. The
 * wildlife chunk draws it (`ShootingStars.tsx`) in the camera's own frame, 61 u ahead, so it's always
 * in the sky above the planet, whatever the tilt.
 */

export const METEOR = {
  /** Only once the stars are well out (the sky's `night`, 0–1). */
  night: 0.6,
  /** Seconds between one and the next (a first one comes sooner once night falls). */
  gap: [7, 20] as const,
  first: [2, 6] as const,
  /** How long one lasts (s), how fast its head travels (u/s on the stars' plane) and its longest tail (u). */
  life: [0.55, 1.0] as const,
  speed: [26, 38] as const,
  tail: 7,
  /** Where one starts, in the camera's frame at 61 u (the view spans about ±31 u across and ±19 u up and
   * down there): the upper part of the view, where the sky is. */
  x: [-26, 26] as const,
  y: [7, 17] as const,
  /** Its heading: this far below the horizontal (rad), left or right. */
  dip: [0.35, 0.85] as const,
};

/** One in flight: its head, its heading (unit, x/y), how far along its life (0–1) and the tail's length (u) and brightness (0–1) now. */
export interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  t: number;
  tail: number;
  alpha: number;
}

const between = (r: readonly [number, number], u: number) => r[0] + (r[1] - r[0]) * u;

export class MeteorShower {
  private wait = -1;
  private life = 0;
  private age = 0;
  private speed = 0;
  private x0 = 0;
  private y0 = 0;
  readonly now: Meteor = { x: 0, y: 0, dx: 1, dy: 0, t: 0, tail: 0, alpha: 0 };
  /** Is one in the sky? */
  on = false;

  constructor(private readonly rand: () => number) {}

  /** Advance by `dt` s at this `night`. Returns the one in flight, or null. */
  step(dt: number, night: number): Meteor | null {
    if (night < METEOR.night) {
      // (by day nothing waits: the first one of the night comes a little after the stars are out)
      this.wait = -1;
      this.on = false;
      return null;
    }
    if (this.wait < 0 && !this.on) this.wait = between(METEOR.first, this.rand());
    if (!this.on) {
      this.wait -= dt;
      if (this.wait > 0) return null;
      this.launch();
    }
    this.age += dt;
    const m = this.now;
    m.t = Math.min(1, this.age / this.life);
    if (m.t >= 1) {
      this.on = false;
      this.wait = between(METEOR.gap, this.rand());
      return null;
    }
    const run = this.speed * this.age;
    m.x = this.x0 + m.dx * run;
    m.y = this.y0 + m.dy * run;
    // the tail grows as it flies and shrinks as it burns out; it brightens in, then fades
    m.tail = Math.min(METEOR.tail, run) * (1 - m.t * m.t);
    m.alpha = Math.max(0, Math.sin(Math.PI * Math.min(1, m.t * 1.15))) ** 0.7;
    return m;
  }

  private launch(): void {
    const r = this.rand;
    this.on = true;
    this.age = 0;
    this.life = between(METEOR.life, r());
    this.speed = between(METEOR.speed, r());
    this.x0 = between(METEOR.x, r());
    this.y0 = between(METEOR.y, r());
    // across and down, toward the middle of the sky rather than out of it
    const side = this.x0 > 0 ? -1 : 1;
    const dip = between(METEOR.dip, r());
    this.now.dx = side * Math.cos(dip);
    this.now.dy = -Math.sin(dip);
  }
}
