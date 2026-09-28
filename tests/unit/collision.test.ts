import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { UP, arcDistance, latLonToVec, moveAlong, tangentToward, type Obstacle } from '../../src/game/math/sphere';
import { PlanetSim } from '../../src/game/systems/movement';
import { ChopperBrain, DOG, type DogWorld } from '../../src/game/world/chopper/brain';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { bridgeRailObstacles, generateProps } from '../../src/game/world/layout';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
/** A point `u` ahead of the spawn (the way `y: 1` walks), `side` u to its right. */
const ahead = (u: number, side = 0) => {
  const p = latLonToVec(90 - (u / R) * (180 / Math.PI), 0);
  if (!side) return p;
  const lat = new Vector3().crossVectors(p, tangentToward(p, UP)!).normalize();
  return moveAlong(p, lat, side / R);
};
const walk = (sim: PlanetSim, s: number, y = 1, x = 0, each?: () => void) => {
  for (let t = 0; t < s; t += 1 / 60) {
    sim.step(1 / 60, { x, y, run: false });
    each?.();
  }
};

describe('collision: hard and soft things (collision.md)', () => {
  it('a trunk stops the body at its bark, not at the spread its planners keep clear of', () => {
    const o: Obstacle = { n: ahead(1.2), radiusU: 0.42, core: 0.3 };
    const sim = new PlanetSim([o]);
    walk(sim, 3);
    const gap = d(sim.pLocal, o.n);
    expect(gap).toBeGreaterThan(0.3 + CONFIG.bodyRadius);
    expect(gap).toBeLessThan(0.3 + CONFIG.bodyRadius + CONFIG.skin + 0.02);
  });

  it('something hard never gives way, however long you press on it', () => {
    const o: Obstacle = { n: ahead(1.2), radiusU: 0.3 };
    const sim = new PlanetSim([o]);
    walk(sim, 6);
    expect(d(sim.pLocal, o.n)).toBeGreaterThan(0.3 + CONFIG.bodyRadius);
    expect(sim.passing.size).toBe(0);
  });

  it('a bush: its leaves slow you, its stems stop you, and pressing on you push through it; then it’s solid again', () => {
    const o: Obstacle = { n: ahead(1.5), radiusU: 0.5, core: 0.2, soft: true };
    const sim = new PlanetSim([o]);
    let slowest = Infinity;
    let squeezed = false;
    walk(sim, 5, 1, 0, () => {
      if (d(sim.pLocal, o.n) < 0.5 + CONFIG.bodyRadius && sim.speed > 0) slowest = Math.min(slowest, sim.speed);
      squeezed ||= sim.passing.has(o);
    });
    expect(slowest).toBeLessThan(CONFIG.walkSpeed * 0.75);
    expect(squeezed).toBe(true);
    // through it and out the far side, and it blocks again
    expect(d(sim.pLocal, UP)).toBeGreaterThan(d(o.n, UP) + 0.5);
    expect(sim.passing.size).toBe(0);
    walk(sim, 3, -1);
    expect(d(sim.pLocal, o.n)).toBeGreaterThan(0.2 + CONFIG.bodyRadius);
  });

  it('walking by a bush without pressing on it never takes you through it', () => {
    // (it's beside the way, touching its leaves: you brush past)
    const o: Obstacle = { n: ahead(1.5, 0.55), radiusU: 0.5, core: 0.2, soft: true };
    const sim = new PlanetSim([o]);
    let minGap = Infinity;
    walk(sim, 3, 1, 0, () => (minGap = Math.min(minGap, d(sim.pLocal, o.n))));
    expect(minGap).toBeGreaterThan(0.2 + CONFIG.bodyRadius);
    expect(d(sim.pLocal, UP)).toBeGreaterThan(2.5);
  });

  it('no wall has a gap a body fits through: the cliffs’ rings, the bridges’ rails, the fence', () => {
    const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
    const layout = generateProps(geos);
    const walls: Obstacle[][] = [layout.obstacles.filter((o) => o.mesa && o.radiusU < 1), bridgeRailObstacles(layout.bridges), layout.home!.obstacles.filter((o) => o.radiusU === 0.06)];
    const body = 2 * (CONFIG.bodyRadius + CONFIG.skin);
    for (const list of walls) {
      expect(list.length).toBeGreaterThan(4);
      for (const o of list) {
        const gap = Math.min(...list.filter((q) => q !== o).map((q) => d(o.n, q.n) - o.radiusU - q.radiusU));
        expect(gap).toBeLessThan(body);
      }
    }
  });
});

describe('making way (collision.md §4)', () => {
  it('Chopper, lying in a narrow way, is nudged along it and aside, and the character gets through', () => {
    // a corridor 1.1 u wide, from 0.5 u to 4 u ahead, with rails of posts either side
    const rails: Obstacle[] = [];
    for (let u = 0.5; u <= 4; u += 0.13) for (const s of [-0.55, 0.55]) rails.push({ n: ahead(u, s), radiusU: 0.06 });
    const brain = new ChopperBrain(() => 0.5, ahead(2));
    const sim = new PlanetSim([...rails, { n: brain.n, radiusU: 0.34, core: 0.14, soft: true }]);
    const w: DogWorld = {
      R,
      player: sim.pLocal.clone(),
      playerFwd: tangentToward(UP, ahead(1))!,
      playerVel: new Vector3(),
      obstacles: rails,
      blocked: () => false,
      rabbits: [],
      spots: [],
      others: [],
    };
    brain.hold('lie');
    let closest = Infinity;
    for (let t = 0; t < 8 && d(sim.pLocal, UP) < 4.6; t += 1 / 60) {
      sim.step(1 / 60, { x: 0, y: 1, run: false });
      w.player.copy(sim.pLocal);
      w.playerVel.copy(sim.vel).applyQuaternion(sim.planetQ.clone().invert());
      brain.step(1 / 60, w);
      closest = Math.min(closest, d(brain.n, sim.pLocal));
      // never pushed into a rail
      for (const r of rails) expect(d(brain.n, r.n)).toBeGreaterThan(r.radiusU + DOG.radius - 0.02);
    }
    expect(d(sim.pLocal, UP)).toBeGreaterThan(4.5);
    // (he's nudged ahead of the character, never walked over)
    expect(closest).toBeGreaterThan(0.3);
  });

  it('boxed in with no room at all, the character squeezes past', () => {
    // someone who can't move, filling a narrow way
    const rails: Obstacle[] = [];
    for (let u = 0.5; u <= 3; u += 0.13) for (const s of [-0.5, 0.5]) rails.push({ n: ahead(u, s), radiusU: 0.06 });
    const stuck: Obstacle = { n: ahead(1.8), radiusU: 0.34, core: 0.16, soft: true };
    const sim = new PlanetSim([...rails, stuck]);
    walk(sim, 5);
    expect(d(sim.pLocal, UP)).toBeGreaterThan(3);
  });
});
