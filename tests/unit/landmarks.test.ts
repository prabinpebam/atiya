import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG } from '../../src/game/config';
import { UP, arcDistance } from '../../src/game/math/sphere';
import { arrivalOrientation, landmarkGeometry, validateLandmarks } from '../../src/game/math/landmarks';
import { PlanetSim } from '../../src/game/systems/movement';
import { generateProps } from '../../src/game/world/layout';
import { FIXTURE_LANDMARKS } from './fixtures';

const CONTENT_DIR = join(process.cwd(), 'src', 'content', 'landmarks');

function frontmatterNumber(src: string, key: string): number {
  const m = src.match(new RegExp(`^${key}:\\s*(-?[\\d.]+)`, 'm'));
  if (!m) throw new Error(`missing ${key}`);
  return Number(m[1]);
}

describe('landmark content', () => {
  it('fixture mirrors the content collection placement data', () => {
    const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
    expect(files.length).toBe(FIXTURE_LANDMARKS.length);
    for (const f of files) {
      const id = f.replace(/\.md$/, '');
      const src = readFileSync(join(CONTENT_DIR, f), 'utf8');
      const fx = FIXTURE_LANDMARKS.find((l) => l.id === id);
      expect(fx, id).toBeDefined();
      expect(frontmatterNumber(src, 'lat')).toBe(fx!.lat);
      expect(frontmatterNumber(src, 'lon')).toBe(fx!.lon);
      expect(frontmatterNumber(src, 'footprintU')).toBe(fx!.footprintU);
      expect(frontmatterNumber(src, 'approachDistanceU')).toBe(fx!.approachDistanceU);
      expect(frontmatterNumber(src, 'order')).toBe(fx!.order);
    }
  });

  it('passes cross-entry validation', () => {
    expect(validateLandmarks(FIXTURE_LANDMARKS)).toEqual([]);
  });

  it('rejects overlapping, unreachable and badly placed entries', () => {
    const bad = [
      ...FIXTURE_LANDMARKS,
      { ...FIXTURE_LANDMARKS[0], id: 'clash', order: 99 }, // same spot as workshop
      { ...FIXTURE_LANDMARKS[0], id: 'far', lat: -60, order: 100 },
      { ...FIXTURE_LANDMARKS[0], id: 'inside', lat: 20, lon: -45, approachDistanceU: 0.5, order: 101 },
    ];
    const errors = validateLandmarks(bad).join('\n');
    expect(errors).toMatch(/clash\/workshop|workshop\/clash/);
    expect(errors).toMatch(/far: approach is/);
    expect(errors).toMatch(/inside: approach point is inside its own collider/);
  });

  it('keeps the Workshop inside the forward horizon (≈ 39.8° of arc) at spawn', () => {
    const w = landmarkGeometry(FIXTURE_LANDMARKS.find((l) => l.id === 'workshop')!);
    const arcDeg = (arcDistance(UP.clone(), w.n, 1) * 180) / Math.PI;
    expect(arcDeg).toBeLessThan(35.5);
    expect(w.n.z).toBeLessThan(0); // straight ahead of the camera
    expect(Math.abs(w.n.x)).toBeLessThan(1e-9);
  });

  it('route test: every approach point is reachable from spawn in ≤ 8 s of running (with props)', () => {
    const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
    const props = generateProps(geos);
    const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...props.obstacles];
    for (const g of geos) {
      const sim = new PlanetSim(obstacles);
      sim.startAutoWalk(g.approach);
      let t = 0;
      let arrived = false;
      while (t < 8 && !arrived) {
        sim.step(1 / 60, { x: 0, y: 0, run: false });
        t += 1 / 60;
        const ev = sim.drainEvents();
        if (ev.some((e) => e.type === 'autowalk-blocked')) throw new Error(`${g.id} blocked at t=${t.toFixed(2)}`);
        arrived = ev.some((e) => e.type === 'autowalk-arrived');
      }
      expect(arrived, `${g.id} not reached in 8 s`).toBe(true);
    }
  });

  it('generates a deterministic prop layout that keeps clear of landmarks and spawn', () => {
    const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
    const a = generateProps(geos);
    const b = generateProps(geos);
    expect(a.trees.length).toBeGreaterThan(30);
    expect(a.trees.map((t) => t.n.x)).toEqual(b.trees.map((t) => t.n.x));
    for (const t of a.trees) {
      expect(arcDistance(t.n, UP.clone(), CONFIG.planetRadius)).toBeGreaterThan(3.4);
      for (const g of geos) expect(arcDistance(t.n, g.n, CONFIG.planetRadius)).toBeGreaterThan(g.footprintU + 1.9);
    }
  });

  it('arrival orientation puts the player on the approach point facing the landmark', () => {
    for (const l of FIXTURE_LANDMARKS) {
      const g = landmarkGeometry(l);
      const q = arrivalOrientation(g);
      const center = g.n.clone().applyQuaternion(q);
      const player = g.approach.clone().applyQuaternion(q);
      expect(player.distanceTo(UP)).toBeLessThan(1e-6);
      expect(center.z).toBeLessThan(0); // landmark is ahead (screen-up)
      expect(Math.abs(center.x)).toBeLessThan(1e-6);
    }
  });
});
