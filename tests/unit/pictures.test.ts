/**
 * The order pictures are fetched in (src/site/scripts/pictures.ts): nearest the view first, a picture in
 * view (any part of it) before any other, ties in page order.
 */
import { describe, expect, it } from 'vitest';
import { distanceFromView, nearestFirst, RETRY_MS } from '../../src/site/scripts/pictures';

const view = { width: 1000, height: 800 };
const box = (top: number, left = 0, h = 100, w = 200) => ({ top, bottom: top + h, left, right: left + w });

describe('fetching pictures nearest the view first', () => {
  it('measures how far a box is from the view: 0 when any of it shows', () => {
    expect(distanceFromView(box(100), view)).toBe(0);
    expect(distanceFromView(box(-50), view)).toBe(0);
    expect(distanceFromView(box(750), view)).toBe(0);
    expect(distanceFromView(box(1000), view)).toBe(200);
    expect(distanceFromView(box(-400), view)).toBe(300);
    // off to the side (a carousel's next slides) counts its sideways gap too
    expect(distanceFromView(box(100, 1300), view)).toBe(300);
    expect(distanceFromView(box(1100, 1300), view)).toBe(Math.hypot(300, 300));
  });

  it('orders what is in view first, then the nearest, above or below, ties in page order', () => {
    const items = [
      { id: 'far below', b: box(3000) },
      { id: 'in view', b: box(200) },
      { id: 'just above', b: box(-300) },
      { id: 'just below', b: box(900) },
      { id: 'also in view', b: box(500) },
      { id: 'slide beside', b: box(200, 1100) },
    ];
    expect(nearestFirst(items, (i) => i.b, view).map((i) => i.id)).toEqual(['in view', 'also in view', 'just below', 'slide beside', 'just above', 'far below']);
  });

  it('tries a failed picture twice more, waiting longer each time', () => {
    expect(RETRY_MS).toHaveLength(2);
    expect(RETRY_MS[1]).toBeGreaterThan(RETRY_MS[0]);
  });
});
