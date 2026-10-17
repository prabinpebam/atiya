// @ts-check
/** The themes panel's dock (documentation/site-ui/theming.md §8): its place beside the site, and the addresses that open it. */
import { describe, expect, it } from 'vitest';
import { DOCK_WIDTH, SITE_MIN, dockLayout, isDockPage, isThemeScreen } from '../src/core/dock.mjs';

const o = { margin: 16, inset: 8, top: 56 };

describe('the themes panel dock', () => {
  it('without the dock the site is the whole card', () => {
    expect(dockLayout({ width: 1440, height: 920 }, { ...o, open: false })).toEqual({ body: { x: 24, y: 72, width: 1392, height: 824 }, dock: null });
  });

  it('with it, the site narrows and the dock is a card on its right, a gap between them', () => {
    const l = dockLayout({ width: 1440, height: 920 }, { ...o, open: true });
    expect(l.dock).toEqual({ x: 24 + 1392 - DOCK_WIDTH, y: 72, width: DOCK_WIDTH, height: 824 });
    expect(l.body).toEqual({ x: 24, y: 72, width: 1392 - DOCK_WIDTH - 8, height: 824 });
  });

  it('a narrow window keeps the site its room: the dock gives way first', () => {
    const l = dockLayout({ width: 800, height: 600 }, { ...o, open: true });
    expect(l.body.width).toBeGreaterThanOrEqual(SITE_MIN);
    expect(l.body.width + 8 + (l.dock?.width ?? 0)).toBe(800 - 2 * 16 - 2 * 8);
  });

  it('edit mode’s Theme screen opens the dock; the dock’s own page is told apart', () => {
    const dev = 'http://localhost:4321';
    expect(isThemeScreen(`${dev}/_edit/theme/`, dev)).toBe(true);
    expect(isThemeScreen(`${dev}/_edit/theme`, dev)).toBe(true);
    expect(isThemeScreen(`${dev}/_edit/theme/?dock`, dev)).toBe(false);
    expect(isThemeScreen(`${dev}/_edit/settings/`, dev)).toBe(false);
    expect(isThemeScreen('http://elsewhere/_edit/theme/', dev)).toBe(false);
    expect(isDockPage(`${dev}/_edit/theme/?dock`, dev)).toBe(true);
    expect(isDockPage(`${dev}/_edit/theme/`, dev)).toBe(false);
  });
});
