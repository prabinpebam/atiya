/**
 * The floating stick (documentation/game-ui/touch.md §5.2): summoned where a finger lands, it maps the
 * finger's offset to a screen-relative move intent. Pure: no DOM, no three.
 */
export interface StickConfig {
  /** Knob travel from the centre to the rim, px. */
  range: number;
  /** Movement under this (px) does nothing, and a touch only becomes a stick past it. */
  deadZone: number;
  /** Fraction of the range where running starts, and where it stops again (hysteresis). */
  runOn: number;
  runOff: number;
  /** Intent length just past the dead zone (it ramps to 1 at `runOn`). */
  minWalk: number;
}

export const STICK: StickConfig = { range: 60, deadZone: 8, runOn: 0.85, runOff: 0.65, minWalk: 0.35 };

export interface StickIntent {
  /** Screen-relative: +x right, +y up the screen (away from the camera), length ≤ 1. */
  x: number;
  y: number;
  run: boolean;
}

export class Stick {
  /** The ring's centre (it follows the finger past the rim). */
  ox = 0;
  oy = 0;
  /** The finger. */
  fx = 0;
  fy = 0;
  /** Past the dead zone at least once since it began. */
  active = false;
  run = false;

  constructor(public cfg: StickConfig = STICK) {}

  begin(x: number, y: number): void {
    this.ox = this.fx = x;
    this.oy = this.fy = y;
    this.active = false;
    this.run = false;
  }

  /** Returns true on the move that first takes it past the dead zone. */
  move(x: number, y: number): boolean {
    const c = this.cfg;
    this.fx = x;
    this.fy = y;
    let dx = x - this.ox;
    let dy = y - this.oy;
    let d = Math.hypot(dx, dy);
    if (d > c.range) {
      // follow: the ring slides along so the finger stays on its rim
      const k = (d - c.range) / d;
      this.ox += dx * k;
      this.oy += dy * k;
      dx = x - this.ox;
      dy = y - this.oy;
      d = c.range;
    }
    const f = d / c.range;
    if (this.run ? f < c.runOff : f >= c.runOn) this.run = !this.run;
    if (!this.active && d > c.deadZone) {
      this.active = true;
      return true;
    }
    return false;
  }

  /** Knob offset from the ring's centre, px (never past the rim). */
  knob(): { x: number; y: number } {
    return { x: this.fx - this.ox, y: this.fy - this.oy };
  }

  intent(): StickIntent {
    const c = this.cfg;
    const dx = this.fx - this.ox;
    const dy = this.fy - this.oy;
    const d = Math.hypot(dx, dy);
    if (!this.active || d <= c.deadZone) return { x: 0, y: 0, run: false };
    const ramp = Math.min(1, (d - c.deadZone) / (c.runOn * c.range - c.deadZone));
    const len = this.run ? 1 : c.minWalk + (1 - c.minWalk) * ramp;
    return { x: (dx / d) * len, y: (-dy / d) * len, run: this.run };
  }
}
