import { describe, expect, it } from 'vitest';
import { Box3, type BufferGeometry } from 'three';
import { Kit } from '../../src/game/world/kit';
import { flowerBox, potPlant, stoneUrn } from '../../src/game/world/planters';
import { landmarkModel } from '../../src/game/world/models';
import { FIXTURE_LANDMARKS } from './fixtures';

const tris = (g: BufferGeometry | null | undefined) => (g ? (g.index ? g.index.count : g.getAttribute('position').count) / 3 : 0);

describe('planters', () => {
  const build = (fn: (k: Kit) => void) => {
    const k = new Kit();
    fn(k);
    return k.build();
  };
  const planters = {
    pot: build((k) => potPlant(k, {}, '#ff6f7d')),
    shrub: build((k) => potPlant(k, {})),
    box: build((k) => flowerBox(k, {}, 0.46, ['#ff6f7d', '#ffd24d'])),
    urn: build((k) => stoneUrn(k, {}, ['#ff6f7d', '#ffd24d'])),
  };

  it('are planted with leaf cards and the meadow flowers, within a modest budget', () => {
    const budget = { pot: 1400, shrub: 1400, box: 3200, urn: 6000 };
    for (const [name, g] of Object.entries(planters)) {
      expect(g.leaves, name).toBeTruthy();
      expect(tris(g.leaves), name).toBeGreaterThan(10);
      expect(tris(g.solid) + tris(g.leaves), name).toBeLessThan(budget[name as keyof typeof budget]);
    }
  });

  it('the plants grow out of their planter: nothing floats off to the side or sinks below it', () => {
    const reach = { pot: 0.26, shrub: 0.26, box: 0.34, urn: 0.52 };
    for (const [name, g] of Object.entries(planters)) {
      const b = new Box3().setFromBufferAttribute(g.leaves!.getAttribute('position') as never);
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z), name).toBeLessThan(reach[name as keyof typeof reach]);
      expect(b.min.y, name).toBeGreaterThan(-0.2);
    }
  });

  it('every building with planters draws their leaves', () => {
    for (const l of FIXTURE_LANDMARKS) {
      const m = landmarkModel(l.variant, l.accent);
      if (['workshop', 'greenhouse', 'post-office'].includes(l.variant)) expect(tris(m.geo.leaves), l.variant).toBeGreaterThan(0);
    }
  });
});
