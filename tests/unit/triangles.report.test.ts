import { describe, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { landmarkModel } from '../../src/game/world/models';
import { cedar, hardwood, leafyBush } from '../../src/game/world/foliage';
import { cloud, flowerBlooms, flowerStems, grassTuft, reeds, rock } from '../../src/game/world/propModels';

const tris = (g: BufferGeometry | null) => (g ? (g.index ? g.index.count : g.getAttribute('position').count) / 3 : 0);

describe.skip('triangle budget report (manual)', () => {
  it('prints triangle counts', () => {
    const rows: Record<string, number> = {};
    for (const v of ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office']) {
      const m = landmarkModel(v, '#888888');
      rows[`landmark:${v}`] = tris(m.geo.solid) + tris(m.geo.glow) + tris(m.geo.glass);
    }
    const t2 = (g: { solid: BufferGeometry; leaves: BufferGeometry }) => tris(g.solid) + tris(g.leaves);
    rows.hardwood = t2(hardwood());
    rows.cedar = t2(cedar());
    rows.bush = t2(leafyBush());
    rows.rock = tris(rock());
    rows.grass = tris(grassTuft());
    for (const k of ['tulip', 'cosmos', 'pansy'] as const) rows[`flower:${k}`] = tris(flowerStems(k)) + tris(flowerBlooms(k));
    rows.cloud = tris(cloud());
    rows.reeds = tris(reeds());
    console.table(rows);
  });
});
