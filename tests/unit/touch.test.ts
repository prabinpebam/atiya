/** The floating stick and the touch gestures (documentation/game-ui/touch.md §5.1–5.2). */
import { describe, expect, it } from 'vitest';
import { STICK, Stick } from '../../src/game/input/stick';
import { TouchGestures } from '../../src/game/input/gestures';
import { TOUCH_COPY, forTouch } from '../../src/game/input/touchCopy';

const len = (i: { x: number; y: number }) => Math.hypot(i.x, i.y);

describe('stick', () => {
  it('does nothing inside the dead zone, and starts once past it', () => {
    const s = new Stick();
    s.begin(100, 100);
    expect(s.move(105, 104)).toBe(false);
    expect(s.active).toBe(false);
    expect(s.intent()).toEqual({ x: 0, y: 0, run: false });
    expect(s.move(110, 100)).toBe(true);
    expect(s.move(111, 100)).toBe(false); // only the first move past it reports the start
    expect(s.active).toBe(true);
  });

  it('is screen-relative: up the screen is +y (away from the camera), right is +x', () => {
    const s = new Stick();
    s.begin(0, 0);
    s.move(0, -30);
    const up = s.intent();
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeGreaterThan(0);
    s.move(30, 0);
    const right = s.intent();
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeCloseTo(0, 6);
  });

  it('walks slowly just past the dead zone, faster further out, and runs from 85 % of the range', () => {
    const s = new Stick();
    s.begin(0, 0);
    s.move(STICK.deadZone + 1, 0);
    const slow = s.intent();
    expect(slow.run).toBe(false);
    expect(len(slow)).toBeGreaterThanOrEqual(STICK.minWalk);
    expect(len(slow)).toBeLessThan(0.4);
    s.move(STICK.range * 0.6, 0);
    const mid = s.intent();
    expect(mid.run).toBe(false);
    expect(len(mid)).toBeGreaterThan(len(slow));
    expect(len(mid)).toBeLessThan(1);
    s.move(STICK.range * 0.86, 0);
    expect(s.intent()).toMatchObject({ run: true });
    expect(len(s.intent())).toBeCloseTo(1, 6);
  });

  it('keeps running until the knob comes back under 65 % (no flicker at the threshold)', () => {
    const s = new Stick();
    s.begin(0, 0);
    s.move(0, -STICK.range * 0.9);
    expect(s.run).toBe(true);
    s.move(0, -STICK.range * 0.7);
    expect(s.run).toBe(true);
    s.move(0, -STICK.range * 0.6);
    expect(s.run).toBe(false);
    s.move(0, -STICK.range * 0.8);
    expect(s.run).toBe(false);
  });

  it('follows the finger past the rim, so reversing is instant', () => {
    const s = new Stick();
    s.begin(0, 0);
    s.move(200, 0);
    expect(s.knob().x).toBeCloseTo(STICK.range, 6);
    expect(s.ox).toBeCloseTo(200 - STICK.range, 6);
    // pull back a little: the knob goes back from the moved centre, not the old one
    s.move(200 - STICK.range, 0);
    expect(s.knob().x).toBeCloseTo(0, 6);
    expect(s.intent()).toEqual({ x: 0, y: 0, run: false });
    s.move(200 - STICK.range * 2, 0);
    expect(s.intent().x).toBeLessThan(-0.99);
  });

  it('never puts the knob past the rim, and the intent is never longer than 1', () => {
    const s = new Stick();
    s.begin(50, 50);
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      s.move(50 + Math.cos(a) * 500, 50 + Math.sin(a) * 500);
      expect(len(s.knob())).toBeLessThanOrEqual(STICK.range + 1e-9);
      expect(len(s.intent())).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('touch copy', () => {
  it('rewords the announcements that name keys', () => {
    expect(forTouch('Near the Library — Books. Press E to open.')).toBe('Near the Library — Books. Tap Open.');
    expect(forTouch('Sitting on the bench by the pond. Press E to feed the ducks, or Escape to stand up.')).toBe(
      'Sitting on the bench by the pond. Tap Feed the ducks, or Stand up.',
    );
    expect(forTouch('On the swing. Press E to swing higher, or Escape to get off.')).toBe('On the swing. Tap Swing higher, or Stand up to get off.');
    expect(forTouch('Sitting on the bench. Press Escape to stand up.')).toBe('Sitting on the bench. Tap Stand up to get up.');
    expect(forTouch('Near a bench. Press E to sit down.')).toBe('Near a bench. Tap the prompt to sit down.');
    expect(forTouch('Shake the tree: press E.')).toBe('Shake the tree: tap the prompt.');
    expect(forTouch('Back at the plaza.')).toBe('Back at the plaza.');
  });

  it('never names a key', () => {
    for (const t of TOUCH_COPY.hint) expect(t).not.toMatch(/\b(press|W A S D|Shift|Esc|E key)\b/i);
  });
});

describe('touch gestures', () => {
  it('a tap never becomes a stick', () => {
    const g = new TouchGestures();
    g.down(1, 100, 100);
    expect(g.move(1, 103, 102)).toBeNull();
    expect(g.holding).toBe(false);
    expect(g.up(1)).toBe(false);
    expect(g.idle).toBe(true);
  });

  it('one finger dragged is the stick; lifting ends it', () => {
    const g = new TouchGestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 80)).toEqual({ start: true });
    expect(g.holding).toBe(true);
    expect(g.stick.intent().y).toBeGreaterThan(0);
    expect(g.up(1)).toBe(true);
    expect(g.holding).toBe(false);
    expect(g.idle).toBe(true);
  });

  it('a second finger while the stick is held turns the view, and the stick keeps walking', () => {
    const g = new TouchGestures();
    g.down(1, 100, 500);
    g.move(1, 100, 470);
    g.down(2, 300, 300);
    expect(g.viewing).toBe(1);
    expect(g.move(2, 320, 310)).toEqual({ view: { dx: 20, dy: 10 } });
    expect(g.holding).toBe(true);
    expect(g.stick.intent().y).toBeGreaterThan(0);
    // the view finger lifts: the stick carries on; the stick lifts: nothing is left
    expect(g.up(2)).toBe(false);
    expect(g.holding).toBe(true);
    g.up(1);
    expect(g.idle).toBe(true);
  });

  it('two fingers together turn the view (averaged) and never make a stick', () => {
    const g = new TouchGestures();
    g.down(1, 100, 300);
    g.down(2, 200, 300);
    expect(g.holding).toBe(false);
    expect(g.viewing).toBe(2);
    expect(g.move(1, 140, 300)).toEqual({ view: { dx: 20, dy: 0 } });
    expect(g.move(2, 240, 300)).toEqual({ view: { dx: 20, dy: 0 } });
    // one lifts: the other alone still turns the view (it doesn't turn into a stick mid-gesture)
    g.up(1);
    expect(g.move(2, 250, 300)).toEqual({ view: { dx: 10, dy: 0 } });
    expect(g.holding).toBe(false);
    g.up(2);
    expect(g.idle).toBe(true);
  });

  it('a new finger after the stick lifts, while a view finger stays, turns the view too', () => {
    const g = new TouchGestures();
    g.down(1, 100, 500);
    g.move(1, 100, 470);
    g.down(2, 300, 300);
    g.up(1);
    g.down(3, 120, 500);
    expect(g.move(3, 120, 450)).toEqual({ view: { dx: 0, dy: -25 } });
    expect(g.holding).toBe(false);
  });

  it('reset (the page hidden, a system gesture) drops everything', () => {
    const g = new TouchGestures();
    g.down(1, 100, 500);
    g.move(1, 100, 400);
    g.down(2, 300, 300);
    expect(g.reset()).toBe(true);
    expect(g.idle).toBe(true);
    expect(g.stick.run).toBe(false);
    expect(g.move(2, 330, 300)).toBeNull();
  });
});
