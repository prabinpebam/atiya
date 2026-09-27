/**
 * Which finger does what on the planet (documentation/game-ui/touch.md §5.1). Pure: the touch chunk
 * feeds it pointer positions and applies what it returns.
 *
 * - The first finger, while it's the only one, becomes the stick once it moves past the dead zone.
 * - A finger that lands while another is down turns the view; if the first hadn't become a stick yet,
 *   it turns the view too (two fingers together), and their movements are averaged.
 */
import { Stick, type StickConfig } from './stick';

export interface GestureStep {
  /** The stick just appeared. */
  start?: boolean;
  /** View drag this move, px (already shared between the fingers turning it). */
  view?: { dx: number; dy: number };
}

export class TouchGestures {
  readonly stick: Stick;
  /** The finger that is, or may become, the stick. */
  stickId: number | null = null;
  private readonly views = new Map<number, { x: number; y: number }>();

  constructor(cfg?: StickConfig) {
    this.stick = new Stick(cfg);
  }

  /** The stick is showing (a finger held past the dead zone). */
  get holding(): boolean {
    return this.stickId !== null && this.stick.active;
  }

  /** Fingers turning the view. */
  get viewing(): number {
    return this.views.size;
  }

  get idle(): boolean {
    return this.stickId === null && this.views.size === 0;
  }

  down(id: number, x: number, y: number): void {
    if (this.idle) {
      this.stickId = id;
      this.stick.begin(x, y);
      return;
    }
    if (this.stickId !== null && !this.stick.active) {
      // two fingers together: the first never becomes a stick
      this.views.set(this.stickId, { x: this.stick.fx, y: this.stick.fy });
      this.stickId = null;
    }
    this.views.set(id, { x, y });
  }

  move(id: number, x: number, y: number): GestureStep | null {
    if (id === this.stickId) return this.stick.move(x, y) ? { start: true } : null;
    const last = this.views.get(id);
    if (!last) return null;
    const n = this.views.size;
    const step = { view: { dx: (x - last.x) / n, dy: (y - last.y) / n } };
    last.x = x;
    last.y = y;
    return step;
  }

  /** A finger lifted (or was cancelled). Returns true if it was holding the stick. */
  up(id: number): boolean {
    if (id === this.stickId) {
      const held = this.stick.active;
      this.stickId = null;
      this.stick.active = false;
      this.stick.run = false;
      return held;
    }
    this.views.delete(id);
    return false;
  }

  /** Everything lifts at once (the page was hidden, the game paused). Returns true if the stick was held. */
  reset(): boolean {
    const held = this.holding;
    this.stickId = null;
    this.stick.active = false;
    this.stick.run = false;
    this.views.clear();
    return held;
  }
}
