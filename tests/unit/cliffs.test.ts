import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance, moveAlong } from '../../src/game/math/sphere';
import { buildCliffs, buildMesaCaps, plateaus } from '../../src/game/world/cliffs';
import { TIER_TERRACE_U, mesaDir, mesaPolar, mesaRadius, tierEdge, tierPolar } from '../../src/game/world/features';
import { canopyBottom, canopyRadius, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const features = { river: layout.river, pond: layout.pond, bridges: layout.bridges, mesas: layout.mesas };
const rings = layout.mesas.flatMap((m) => plateaus(m));

/** The plateau whose outline is nearest to `dir`, and the outward tangent from its centre. */
function nearestRing(dir: Vector3) {
  const off = (pl: (typeof rings)[number]) =>
    Math.abs(arcDistance(dir, pl.center, R) - pl.edge(mesaPolar({ n: pl.center, north: pl.m.north, east: pl.m.east }, dir).angle));
  const ring = rings.reduce((best, r) => (off(r) < off(best) ? r : best));
  const d = new Vector3().subVectors(dir, ring.center);
  return { ring, outward: d.addScaledVector(dir, -dir.dot(d)).normalize() };
}

describe('cliff walls', () => {
  const geo = buildCliffs(layout.mesas)!;
  const pos = geo.getAttribute('position');
  const faces = Array.from({ length: pos.count / 3 }, (_, f) => {
    const [a, b, c] = [0, 1, 2].map((i) => new Vector3().fromBufferAttribute(pos, f * 3 + i));
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    const dir = a.clone().add(b).add(c).divideScalar(3).normalize();
    return { normal, ...nearestRing(dir) };
  });

  it('winds every rock face so it points out of the mesa (front faces are visible from outside)', () => {
    expect(faces.length).toBeGreaterThan(1000);
    const outward = faces.filter((f) => f.normal.dot(f.outward) > 0.2).length;
    expect(outward / faces.length).toBeGreaterThan(0.99);
  });

  it('keeps each upper tier inside its mesa, with a lower terrace all the way round', () => {
    const tiered = layout.mesas.filter((m) => m.tier);
    expect(tiered.length).toBeGreaterThan(0);
    for (const m of tiered) {
      for (let k = 0; k < 256; k++) {
        const a = (k / 256) * Math.PI * 2;
        // the tier wall's foot bulges ≈ 0.15 u past its outline
        const p = moveAlong(m.tier!.n, mesaDir(m, m.tier!.n, a), (tierEdge(m.tier!, a) + 0.15) / R);
        const { r, angle } = mesaPolar(m, p);
        expect(mesaRadius(m.radiusU, m.seed, angle) - r).toBeGreaterThan(TIER_TERRACE_U - 0.2);
      }
    }
  });
});

describe('mesa caps', () => {
  const caps = buildMesaCaps(layout.mesas)!;
  const pos = caps.getAttribute('position');
  const droop = caps.getAttribute('aDroop');
  const index = caps.getIndex()!;
  const terrain = new Terrain(geos, features);

  it('winds the cap to face up, and its drooping rim to face out', () => {
    let tops = 0;
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((i) => new Vector3().fromBufferAttribute(pos, index.getX(t + i)));
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
      const dir = a.clone().add(b).add(c).divideScalar(3).normalize();
      const rim = [0, 1, 2].some((i) => droop.getX(index.getX(t + i)) > 0.5);
      if (rim) expect(normal.dot(dir.clone().add(nearestRing(dir).outward))).toBeGreaterThan(0);
      else {
        expect(normal.dot(dir)).toBeGreaterThan(0.5);
        tops++;
      }
    }
    expect(tops).toBeGreaterThan(1000);
  });

  it('sits just above the ground everywhere on the plateau tops, so the lawn never pokes through', () => {
    const h = caps.getAttribute('aH');
    for (let i = 0; i < pos.count; i++) {
      if (droop.getX(i) > 0.5) continue;
      const n = new Vector3().fromBufferAttribute(pos, i).normalize();
      // the lower cap runs on under its upper tier, where the tier's own cap covers it
      const hidden = layout.mesas.some((m) => {
        if (!m.tier || h.getX(i) > m.heightU + m.tier.heightU - 0.1) return false;
        const q = tierPolar(m, n);
        return q.r < tierEdge(m.tier, q.angle) + 0.1;
      });
      if (hidden) continue;
      expect(h.getX(i) - terrain.height(n), `vertex ${i}`).toBeGreaterThan(0.005);
    }
  });
});

describe('trees near cliffs', () => {
  const kinds = [
    ...layout.hardwood.map((t) => ({ t, cedar: false })),
    ...layout.fruit.map((t) => ({ t, cedar: false })),
    ...layout.cedar.map((t) => ({ t, cedar: true })),
  ];

  it('keeps every crown off the cliff walls, and mesa-top trunks well inside the rims', () => {
    let onTop = 0;
    for (const { t, cedar } of kinds) {
      for (const m of layout.mesas) {
        const { r, angle } = mesaPolar(m, t.n);
        const e = r - mesaRadius(m.radiusU, m.seed, angle);
        if (e > 0) {
          expect(e, 'crown clear of the base wall').toBeGreaterThan(canopyRadius(cedar) * t.scale);
          continue;
        }
        onTop++;
        expect(e, 'trunk inside the rim').toBeLessThan(-0.55);
        if (!m.tier) continue;
        const q = tierPolar(m, t.n);
        const te = q.r - tierEdge(m.tier, q.angle);
        if (te < 0) expect(te, 'trunk inside the tier rim').toBeLessThan(-0.55);
        else if (canopyBottom(cedar) * t.scale > m.tier.heightU + 0.15) expect(te, 'trunk clear of the tier wall').toBeGreaterThan(0.45);
        else expect(te, 'crown clear of the tier wall').toBeGreaterThan(canopyRadius(cedar) * t.scale);
      }
    }
    expect(onTop).toBeGreaterThanOrEqual(layout.mesas.length);
  });

  it('plants mesa-top trees on flat ground (never on a rim slope)', () => {
    const terrain = new Terrain(geos, features);
    for (const { t } of kinds) {
      const m = layout.mesas.find((mm) => mesaPolar(mm, t.n).r < mesaRadius(mm.radiusU, mm.seed, mesaPolar(mm, t.n).angle));
      if (!m) continue;
      const h = terrain.height(t.n);
      const onTier = m.tier && tierPolar(m, t.n).r < tierEdge(m.tier, tierPolar(m, t.n).angle);
      const flat = m.heightU + (onTier ? m.tier!.heightU : 0);
      expect(Math.abs(h - flat)).toBeLessThan(0.05);
    }
  });
});
