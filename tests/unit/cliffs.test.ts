import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance } from '../../src/game/math/sphere';
import { buildCliffs } from '../../src/game/world/cliffs';
import { mesaPolar, mesaRadius } from '../../src/game/world/features';
import { generateProps } from '../../src/game/world/layout';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const layout = generateProps(FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l)));

describe('cliff walls', () => {
  const geo = buildCliffs(layout.mesas)!;
  const pos = geo.getAttribute('position');
  const ruv = geo.getAttribute('aRockUV');
  // each wall ring belongs to a mesa or its upper tier: pick the ring whose outline is nearest
  const rings = layout.mesas.flatMap((m) => [
    { m, n: m.n, radius: m.radiusU, seed: m.seed },
    ...(m.tier ? [{ m, n: m.tier.n, radius: m.tier.radiusU, seed: m.seed + 2.2 }] : []),
  ]);
  const faces = Array.from({ length: pos.count / 3 }, (_, f) => {
    const [a, b, c] = [0, 1, 2].map((i) => new Vector3().fromBufferAttribute(pos, f * 3 + i));
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    const dir = centroid.clone().normalize();
    const ring = rings.reduce((best, r) => {
      const off = (o: typeof r) => Math.abs(arcDistance(dir, o.n, R) - mesaRadius(o.radius, o.seed, mesaPolar({ ...o.m, n: o.n }, dir).angle));
      return off(r) < off(best) ? r : best;
    });
    const outward = new Vector3().subVectors(dir, ring.n).addScaledVector(dir, -dir.dot(new Vector3().subVectors(dir, ring.n))).normalize();
    return { normal, up: dir, outward, rock: ruv.getZ(f * 3) > 0.5 };
  });

  it('winds every rock face so it points out of the mesa (front faces are visible from outside)', () => {
    const rock = faces.filter((f) => f.rock);
    expect(rock.length).toBeGreaterThan(1000);
    const outward = rock.filter((f) => f.normal.dot(f.outward) > 0.2).length;
    expect(outward / rock.length).toBeGreaterThan(0.99);
  });

  it('winds the grassy lip to face up (top) and out (drooping edge)', () => {
    const lip = faces.filter((f) => !f.rock);
    expect(lip.length).toBeGreaterThan(100);
    for (const f of lip) expect(f.normal.dot(f.up.clone().add(f.outward))).toBeGreaterThan(0);
  });
});
