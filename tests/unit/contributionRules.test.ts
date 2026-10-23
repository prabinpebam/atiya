import { describe, expect, it } from 'vitest';
import { calendarKey, columnAt, columnHeight, contributionScene, ISOMETRIC, readableMonths, returnOrientation, tumble, TUMBLE } from '../../src/site/scripts/contributionRules';
import type { GitHubDay } from '../../src/site/content/github';

const days: GitHubDay[] = Array.from({ length: 365 }, (_, i) => ({ date: new Date(Date.UTC(2025, 9, 24 + i)).toISOString().slice(0, 10), count: i % 23, level: (i % 5) as GitHubDay['level'] }));
describe('contribution calendar geometry and interaction', () => {
  it('uses a true isometric projection and bounds both tumble axes', () => {
    expect(ISOMETRIC.pitch).toBeCloseTo(0.6154797);
    const max = tumble(1e6, 1e6, 600);
    const min = tumble(-1e6, -1e6, 600);
    expect(max.yaw).toBe(ISOMETRIC.yaw + TUMBLE.yaw);
    expect(max.pitch).toBe(ISOMETRIC.pitch + TUMBLE.pitch);
    expect(min.yaw).toBe(ISOMETRIC.yaw - TUMBLE.yaw);
    expect(min.pitch).toBe(ISOMETRIC.pitch - TUMBLE.pitch);
    expect(tumble(0, 0, 0)).toEqual(ISOMETRIC);
  });
  it('returns to exactly the original isometric orientation', () => {
    const from = tumble(100, -100, 500);
    expect(returnOrientation(from, 0)).toEqual(from);
    expect(returnOrientation(from, 1)).toEqual(ISOMETRIC);
    expect(returnOrientation(from, 10)).toEqual(ISOMETRIC);
    expect(Math.abs(returnOrientation(from, 0.5).yaw - ISOMETRIC.yaw)).toBeLessThan(Math.abs(from.yaw - ISOMETRIC.yaw));
  });
  it.each(['2d', '3d'] as const)('%s projects every date inside the chart, even on a phone', (mode) => {
    for (const [w, h] of [[280, 240], [800, 416]]) {
      const scene = contributionScene(days, w, h, mode);
      expect(scene.columns).toHaveLength(365);
      expect(new Set(scene.columns.map((c) => c.index)).size).toBe(365);
      for (const p of scene.columns.flatMap((c) => c.faces.flat())) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeLessThanOrEqual(h);
      }
    }
  });
  it('flat cells can all be hit and gaps select no day', () => {
    const scene = contributionScene(days, 800, 300, '2d');
    for (const c of scene.columns) {
      const face = c.faces[0];
      const centre = { x: face.reduce((v, p) => v + p.x, 0) / 4, y: face.reduce((v, p) => v + p.y, 0) / 4 };
      expect(columnAt(scene, centre)).toBe(c.index);
    }
    expect(columnAt(scene, { x: 0, y: 0 })).toBeNull();
  });
  it('the frontmost cuboid face wins overlapping hit tests', () => {
    const face = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(columnAt({ width: 10, height: 10, months: [], columns: [{ index: 1, level: 1, depth: 2, faces: [face] }, { index: 2, level: 2, depth: 1, faces: [face] }] }, { x: 5, y: 5 })).toBe(2);
  });
  it.each(['2d', '3d'] as const)('%s labels every month at the start of its calendar week, inside the canvas', (mode) => {
    for (const [w, h] of [[280, 240], [800, 416]]) {
      const scene = contributionScene(days, w, h, mode);
      expect(scene.months.map((m) => m.label)).toEqual(['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
      for (const month of scene.months) {
        expect(month.date.endsWith('-01')).toBe(true);
        expect(month.x).toBeGreaterThan(0);
        expect(month.x).toBeLessThan(w);
        expect(month.y).toBeGreaterThan(0);
        expect(month.y).toBeLessThan(h);
      }
    }
  });
  it.each(['2d', '3d'] as const)('%s never overlaps month names on a narrow canvas', (mode) => {
    for (const width of [214, 280, 800]) {
      const scene = contributionScene(days, width, width === 800 ? 416 : 240, mode);
      const months = readableMonths(scene.months, 28, 20, 4);
      expect(months.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < months.length; i++) {
        expect(Math.abs(months[i].x - months[i - 1].x) >= 32 || Math.abs(months[i].y - months[i - 1].y) >= 24).toBe(true);
      }
      if (width === 800) expect(months).toHaveLength(12);
    }
  });
  it('draws far columns first and only the two camera-facing sides throughout the tumble range', () => {
    for (const view of [ISOMETRIC, tumble(-10000, -10000, 800), tumble(10000, 10000, 800)]) {
      const scene = contributionScene(days, 800, 416, '3d', view);
      expect(scene.columns.map((c) => c.depth)).toEqual(scene.columns.map((c) => c.depth).sort((a, b) => a - b));
      for (const col of scene.columns) {
        expect(col.faces).toHaveLength(3);
        const area = (face: typeof col.faces[number]) => face.reduce((s, p, i) => {
          const q = face[(i + 1) % face.length];
          return s + p.x * q.y - q.x * p.y;
        }, 0);
        expect(area(col.faces[0]) * area(col.faces[2])).toBeGreaterThan(0);
        expect(area(col.faces[1]) * area(col.faces[2])).toBeGreaterThan(0);
      }
    }
  });
  it('height tracks actual counts monotonically while zero stays flat', () => {
    expect(columnHeight(0, 100)).toBeLessThan(columnHeight(1, 100));
    expect(columnHeight(1, 100)).toBeLessThan(columnHeight(50, 100));
    expect(columnHeight(50, 100)).toBeLessThan(columnHeight(100, 100));
    expect(Number.isFinite(columnHeight(0, 0))).toBe(true);
  });
  it('keyboard exploration uses calendar weeks, clamps boundaries and leaves other keys alone', () => {
    expect(calendarKey(100, 'ArrowLeft', 365)).toBe(93);
    expect(calendarKey(100, 'ArrowRight', 365)).toBe(107);
    expect(calendarKey(100, 'ArrowUp', 365)).toBe(99);
    expect(calendarKey(100, 'ArrowDown', 365)).toBe(101);
    expect(calendarKey(100, 'Home', 365)).toBe(0);
    expect(calendarKey(100, 'End', 365)).toBe(364);
    expect(calendarKey(0, 'ArrowLeft', 365)).toBe(0);
    expect(calendarKey(364, 'ArrowRight', 365)).toBe(364);
    expect(calendarKey(100, 'Tab', 365)).toBeNull();
  });
});
