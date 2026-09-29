import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { LEAF_HUE_JITTER } from '../../src/game/world/foliage';
import { cedar, hardwood } from '../../src/game/world/trees';

/** Hue (0…1) of each leaf card (its four corners share one colour). */
function cardHues(tree: ReturnType<typeof hardwood>): number[] {
  const col = tree.leaves.getAttribute('color');
  const hsl = { h: 0, s: 0, l: 0 };
  const c = new Color();
  const out: number[] = [];
  for (let i = 0; i < col.count; i += 4) out.push(c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHSL(hsl).h);
  return out;
}

describe('leaf colour', () => {
  it('varies the hue a little from card to card, and stays green', () => {
    expect(LEAF_HUE_JITTER).toBeGreaterThan(0);
    expect(LEAF_HUE_JITTER).toBeLessThan(0.06); // mild: within about ±10°
    for (const tree of [hardwood(), cedar(0)]) {
      const hues = cardHues(tree);
      const mean = hues.reduce((a, b) => a + b, 0) / hues.length;
      const sd = Math.sqrt(hues.reduce((a, h) => a + (h - mean) ** 2, 0) / hues.length);
      expect(sd).toBeGreaterThan(0.004);
      for (const h of hues) {
        expect(h).toBeGreaterThan(0.17); // not yellow-orange
        expect(h).toBeLessThan(0.5); // not blue (the first cedar variant is blue-green)
      }
    }
  });

  it('is stable: the same tree gets the same colours', () => {
    expect(cardHues(hardwood())).toEqual(cardHues(hardwood()));
  });
});
