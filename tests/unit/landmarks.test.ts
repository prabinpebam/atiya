import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { UP, arcDistance } from '../../src/game/math/sphere';
import { arrivalOrientation, landmarkGeometry, segmentClearance, validateLandmarks } from '../../src/game/math/landmarks';
import { PlanetSim } from '../../src/game/systems/movement';
import { generateProps } from '../../src/game/world/layout';
import { PLACES } from '../../src/game/world/places';
import { LINES } from '../../src/game/world/home/family';
import { welcomeLines } from '../../src/game/world/home/welcome';
import { PLACE_IDS } from '../../src/site/content/schema';
import { content, placePages } from '../../src/site/content/repository';
import { FIXTURE_LANDMARKS } from './fixtures';

describe('the buildings (documentation/sections/spec.md §5)', () => {
  it("the world's seven buildings are the content contract's seven places, in fast-travel order", () => {
    expect(PLACES.map((p) => p.id)).toEqual([...PLACE_IDS]);
    expect(PLACES.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(FIXTURE_LANDMARKS.map((l) => l.id)).toEqual(PLACES.map((p) => p.id));
  });

  it('the planet structure gives each building its words once, and a section of the site', () => {
    const planet = content().planet!;
    expect(planet.places.map((p) => p.id).sort()).toEqual([...PLACE_IDS].sort());
    for (const p of planet.places) expect(p.site, p.id).toBeTruthy();
  });

  it("Prabin points only at buildings that hold something: every building his lines say has something of his holds a published page", () => {
    const planet = content().planet!;
    const lines = [...welcomeLines(null, false), ...welcomeLines(null, true), ...Object.values(LINES.prabin.greet).flat(), ...LINES.prabin.pool, ...Object.values(LINES.prabin.doing).flat()];
    const claims = lines.flatMap((l) => planet.places.filter((p) => new RegExp(`The ${p.title} (has|holds) my`).test(l)).map((p) => ({ line: l, place: p.id })));
    expect(claims.length).toBeGreaterThan(0);
    for (const c of claims) expect(placePages(c.place).length, `${c.place}: "${c.line}"`).toBeGreaterThan(0);
  });
});

describe('landmark content', () => {
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

  it('places a pond, plaza furniture and flower clumps without blocking any route', () => {
    const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
    const layout = generateProps(geos);
    const R = CONFIG.planetRadius;
    expect(layout.pond).not.toBeNull();
    for (const g of geos) {
      expect(arcDistance(layout.pond!.n, g.n, R)).toBeGreaterThan(g.footprintU + layout.pond!.radiusU);
    }
    expect(layout.furniture.length).toBeGreaterThanOrEqual(4);
    expect(layout.furniture.some((f) => f.kind === 'bench')).toBe(true);
    const flowers = layout.flowers.tulip.length + layout.flowers.cosmos.length + layout.flowers.pansy.length;
    expect(flowers).toBeGreaterThan(60);
    expect(layout.grass.length).toBeGreaterThan(300);
    // every blocking prop leaves every spawn→approach corridor passable
    for (const g of geos) {
      for (const o of layout.obstacles) expect(segmentClearance(UP.clone(), g.approach, o)).toBeGreaterThan(0);
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
