import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { UP, angleBetween, arcDistance, latLonToVec, tangentToward, type Obstacle } from '../../src/game/math/sphere';
import { PlanetSim, flyoverProfile } from '../../src/game/systems/movement';
import type { MoveIntent } from '../../src/game/types';

const NONE: MoveIntent = { x: 0, y: 0, run: false };
const R = CONFIG.planetRadius;

function run(sim: PlanetSim, intent: MoveIntent, seconds: number, fps: number) {
  const dt = 1 / fps;
  for (let t = 0; t < seconds - 1e-9; t += dt) sim.step(dt, intent);
}

function travelled(fps: number, intent: MoveIntent, seconds = 3): number {
  const sim = new PlanetSim([]);
  run(sim, intent, seconds, fps);
  return arcDistance(UP.clone(), sim.pLocal, R);
}

describe('PlanetSim movement', () => {
  it('W moves the player toward lon 0 (ahead of the camera)', () => {
    const sim = new PlanetSim([]);
    run(sim, { x: 0, y: 1, run: false }, 1, 60);
    expect(sim.pLocal.z).toBeLessThan(0);
    expect(Math.abs(sim.pLocal.x)).toBeLessThan(1e-6);
  });

  it('D moves the player toward screen-right (+X)', () => {
    const sim = new PlanetSim([]);
    run(sim, { x: 1, y: 0, run: false }, 1, 60);
    expect(sim.pLocal.x).toBeGreaterThan(0);
  });

  it('diagonal movement is not faster than straight movement', () => {
    const straight = travelled(60, { x: 0, y: 1, run: false });
    const diagonal = travelled(60, { x: 1, y: 1, run: false });
    expect(diagonal).toBeLessThanOrEqual(straight * 1.001);
  });

  it('reaches walk and run speeds', () => {
    const sim = new PlanetSim([]);
    run(sim, { x: 0, y: 1, run: false }, 1, 60);
    expect(sim.speed).toBeCloseTo(CONFIG.walkSpeed, 2);
    run(sim, { x: 0, y: 1, run: true }, 1, 60);
    expect(sim.speed).toBeCloseTo(CONFIG.runSpeed, 2);
    run(sim, NONE, 0.5, 60);
    expect(sim.speed).toBe(0);
  });

  it('is frame-rate independent (30 vs 120 fps within ±2 %)', () => {
    const a = travelled(30, { x: 0, y: 1, run: true });
    const b = travelled(120, { x: 0, y: 1, run: true });
    expect(Math.abs(a - b) / b).toBeLessThan(0.02);
  });

  it('walks all the way around the planet with no NaN or drift', () => {
    const sim = new PlanetSim([]);
    run(sim, { x: 0.3, y: 1, run: true }, (2 * Math.PI * R) / CONFIG.runSpeed + 1, 60);
    expect(Number.isFinite(sim.pLocal.x + sim.pLocal.y + sim.pLocal.z)).toBe(true);
    expect(sim.pLocal.length()).toBeCloseTo(1, 6);
    expect(sim.planetQ.length()).toBeCloseTo(1, 6);
  });

  it('clamps dt so a tab switch does not teleport the player', () => {
    const sim = new PlanetSim([]);
    run(sim, { x: 0, y: 1, run: true }, 1, 60);
    const before = sim.pLocal.clone();
    sim.step(5, { x: 0, y: 1, run: true });
    expect(arcDistance(before, sim.pLocal, R)).toBeLessThanOrEqual(CONFIG.runSpeed * CONFIG.maxDt + 1e-6);
  });

  it('does not tunnel through a small obstacle at run speed with max dt', () => {
    const o: Obstacle = { n: latLonToVec(90 - (1.2 / R) * (180 / Math.PI), 0), radiusU: 0.3 };
    const sim = new PlanetSim([o]);
    run(sim, { x: 0, y: 1, run: true }, 0.2, 60);
    for (let i = 0; i < 40; i++) sim.step(CONFIG.maxDt, { x: 0, y: 1, run: true });
    const beta = (0.3 + CONFIG.playerRadius + CONFIG.skin) / R;
    expect(angleBetween(sim.pLocal, o.n)).toBeGreaterThanOrEqual(beta - 1e-6);
    // Still on the near side (did not pass through).
    expect(sim.pLocal.z).toBeGreaterThan(o.n.z);
  });

  it('slides along an obstacle and faces the actual movement direction', () => {
    const o: Obstacle = { n: latLonToVec(90 - (1.2 / R) * (180 / Math.PI), 0.0), radiusU: 0.6 };
    const sim = new PlanetSim([o]);
    run(sim, { x: 0.25, y: 1, run: false }, 3, 60);
    const beta = (0.6 + CONFIG.playerRadius + CONFIG.skin) / R;
    expect(angleBetween(sim.pLocal, o.n)).toBeGreaterThanOrEqual(beta - 1e-6);
    expect(sim.pLocal.x).toBeGreaterThan(0.05); // slid sideways around it
    expect(Number.isFinite(sim.heading)).toBe(true);
  });

  it('push-out preserves the planet twist (no world-yaw jump)', () => {
    const o: Obstacle = { n: UP.clone(), radiusU: 0.5 };
    const sim = new PlanetSim([o]);
    // Start inside the obstacle, slightly ahead of its centre.
    const start = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.01);
    sim.setOrientation(start);
    const ref = latLonToVec(0, 90); // a far-away reference landmark
    const refBefore = ref.clone().applyQuaternion(sim.planetQ);
    sim.step(1 / 60, { x: 0, y: 1, run: false });
    const refAfter = ref.clone().applyQuaternion(sim.planetQ);
    const yawBefore = Math.atan2(refBefore.x, refBefore.z);
    const yawAfter = Math.atan2(refAfter.x, refAfter.z);
    expect(Math.abs(yawAfter - yawBefore)).toBeLessThan(0.05);
    const beta = (0.5 + CONFIG.playerRadius + CONFIG.skin) / R;
    expect(angleBetween(sim.pLocal, o.n)).toBeGreaterThanOrEqual(beta - 1e-6);
  });

  it('auto-walk arrives at a target and reports it', () => {
    const sim = new PlanetSim([]);
    const target = latLonToVec(60, 45);
    sim.startAutoWalk(target);
    const events: string[] = [];
    for (let i = 0; i < 60 * 10 && sim.autoWalk; i++) {
      sim.step(1 / 60, NONE);
      events.push(...sim.drainEvents().map((e) => e.type));
    }
    expect(events).toContain('autowalk-arrived');
    expect(arcDistance(sim.pLocal, target, R)).toBeLessThan(CONFIG.autoWalkArrive + 0.3);
  });

  it('auto-walk reports blocked when an obstacle sits in the way', () => {
    const target = latLonToVec(60, 0);
    const wall: Obstacle = { n: latLonToVec(90 - (1.5 / R) * (180 / Math.PI), 0), radiusU: 0.8 };
    const sim = new PlanetSim([wall]);
    sim.startAutoWalk(target);
    const events: string[] = [];
    for (let i = 0; i < 60 * 10 && sim.autoWalk; i++) {
      sim.step(1 / 60, NONE);
      events.push(...sim.drainEvents().map((e) => e.type));
    }
    expect(events).toContain('autowalk-blocked');
  });

  it('any movement input cancels auto-walk', () => {
    const sim = new PlanetSim([]);
    sim.startAutoWalk(latLonToVec(0, 0));
    sim.step(1 / 60, { x: 1, y: 0, run: false });
    expect(sim.autoWalk).toBeNull();
  });

  it('fast travel completes at the destination orientation', () => {
    const sim = new PlanetSim([]);
    const dest = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.8);
    sim.startTravel(dest, 'x', 'flyover');
    const events: string[] = [];
    for (let i = 0; i < 200 && sim.travel; i++) {
      sim.step(1 / 60, NONE);
      events.push(...sim.drainEvents().map((e) => e.type));
    }
    expect(events).toContain('travel-complete');
    expect(sim.planetQ.angleTo(dest)).toBeLessThan(1e-6);
    expect(tangentToward(UP.clone(), sim.pLocal)).not.toBeNull();
  });

  it('the fly-over rises before the planet turns, glides at full height, and drops only once it has arrived', () => {
    const sim = new PlanetSim([]);
    const dest = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 2.5);
    sim.startTravel(dest, 'x', 'flyover');
    const dt = 1 / 120;
    let frames = 0;
    let peak = 0;
    while (sim.travel && frames < 1000) {
      const p = sim.travelState!.progress;
      const moved = sim.planetQ.angleTo(new Quaternion());
      const h = sim.hover;
      peak = Math.max(peak, h);
      // wherever the planet has turned (and so the character is away from the start), it is up high
      if (moved > 0.01 && sim.planetQ.angleTo(dest) > 0.01) expect(h).toBeCloseTo(CONFIG.travelHoverU, 6);
      if (p < CONFIG.travelRise) expect(moved).toBeLessThan(1e-9);
      sim.step(dt, NONE);
      frames++;
    }
    expect(peak).toBeCloseTo(CONFIG.travelHoverU, 6);
    expect(frames * dt).toBeCloseTo(CONFIG.fastTravelDuration, 1);
    expect(sim.hover).toBe(0);
    expect(sim.planetQ.angleTo(dest)).toBeLessThan(1e-6);
  });

  it('fly-over profile: continuous, rises with an ease-out, and falls faster and faster', () => {
    const { travelRise: a, travelDrop: b } = CONFIG;
    expect(flyoverProfile(0, a, b)).toEqual({ glide: 0, hover: 0 });
    expect(flyoverProfile(1, a, b)).toEqual({ glide: 1, hover: 0 });
    let prev = flyoverProfile(0, a, b);
    for (let p = 0.001; p <= 1; p += 0.001) {
      const cur = flyoverProfile(p, a, b);
      expect(Math.abs(cur.hover - prev.hover)).toBeLessThan(0.02);
      expect(cur.glide).toBeGreaterThanOrEqual(prev.glide - 1e-12);
      prev = cur;
    }
    // ease-out rise: half height well before half the rise; accelerating drop: still high half-way down
    expect(flyoverProfile(a * 0.25, a, b).hover).toBeGreaterThan(0.5);
    expect(flyoverProfile(1 - b / 2, a, b).hover).toBeCloseTo(0.75, 6);
  });

  it('reduced-motion fade never flies', () => {
    const sim = new PlanetSim([]);
    sim.startTravel(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1), 'x', 'fade');
    sim.step(0.05, NONE);
    expect(sim.hover).toBe(0);
  });

  it('reduced-motion fade travel completes within the fade duration', () => {
    const sim = new PlanetSim([]);
    sim.startTravel(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1), 'x', 'fade');
    let frames = 0;
    while (sim.travel && frames < 100) {
      sim.step(1 / 60, NONE);
      frames++;
    }
    expect(frames / 60).toBeLessThanOrEqual(CONFIG.reducedMotionFade + 1 / 60);
  });
});
