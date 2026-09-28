import { describe, expect, it } from 'vitest';
import { PlanetSim, JUMP } from '../../src/game/systems/movement';
import { REST, restPose } from '../../src/game/world/craft/restPoses';
import { KEY_BINDINGS } from '../../src/game/input/keyboard';

const still = { x: 0, y: 0, run: false };
const ahead = { x: 0, y: 1, run: false };

describe('jumping (Space)', () => {
  it('a hop: up about a third of a unit and down again in under half a second, then a landing', () => {
    const sim = new PlanetSim([]);
    expect(sim.jump()).toBe(true);
    let peak = 0;
    let t = 0;
    for (; t < 2 && (t === 0 || sim.jumpH > 0); t += 1 / 60) {
      sim.step(1 / 60, still);
      peak = Math.max(peak, sim.jumpH);
    }
    expect(peak).toBeCloseTo((JUMP.v * JUMP.v) / (2 * JUMP.g), 1);
    expect(peak).toBeGreaterThan(0.25);
    expect(peak).toBeLessThan(0.45);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.5);
    expect(sim.jumpH).toBe(0);
    expect(sim.drainEvents().some((e) => e.type === 'landed')).toBe(true);
  });

  it('no second jump in the air, and it carries on the way you were going', () => {
    const sim = new PlanetSim([]);
    for (let i = 0; i < 60; i++) sim.step(1 / 60, ahead);
    const speed = sim.speed;
    const from = sim.pLocal.clone();
    expect(sim.jump()).toBe(true);
    sim.step(1 / 60, ahead);
    expect(sim.jump()).toBe(false);
    for (let i = 0; i < 20; i++) sim.step(1 / 60, ahead);
    expect(sim.speed).toBeCloseTo(speed, 1);
    expect(sim.pLocal.distanceTo(from)).toBeGreaterThan(0.05);
  });

  it('none while travelling, and travelling ends one', () => {
    const sim = new PlanetSim([]);
    sim.jump();
    sim.step(1 / 60, still);
    sim.startTravel(sim.planetQ.clone(), 'x', 'fade');
    expect(sim.jumpH).toBe(0);
    expect(sim.jump()).toBe(false);
  });
});

describe('resting anywhere (X sits, Z lies back)', () => {
  it('has its keys, and Space still goes back', () => {
    expect(KEY_BINDINGS.KeyX).toBe('sit');
    expect(KEY_BINDINGS.KeyZ).toBe('lie');
    expect(KEY_BINDINGS.Space).toBe('back');
  });

  it('eases in from standing, and lying down sits first, then leans back', () => {
    expect(restPose('sit', 0, 0).w).toBe(0);
    expect(restPose('sit', 1, 0).w).toBe(1);
    expect(restPose('sit', 1, 0).hip).toBe(REST.sit.hip);
    // the lie's first half is the sit (so going from one to the other never jumps)
    const half = restPose('lie', 0.5, 0);
    const sit = restPose('sit', 1, 0);
    expect(half.w).toBe(1);
    expect(half.spine).toEqual(sit.spine);
    expect(half.legs).toEqual(sit.legs);
    const lie = restPose('lie', 1, 0);
    lie.spine.forEach((v, i) => expect(v).toBeCloseTo(REST.lie.spine[i], 9));
    expect(lie.hip).toBe(REST.lie.hip);
  });

  it('sitting leans a little back with the knees up; lying, the spine points back along the ground and the legs out in front', () => {
    const sit = restPose('sit', 1, 0);
    expect(sit.spine[1]).toBeGreaterThan(0.8);
    expect(sit.spine[0]).toBeLessThan(0);
    expect(sit.legs!.l.upper[0]).toBeGreaterThan(0.7);
    expect(sit.legs!.l.upper[1]).toBeGreaterThan(0);
    const lie = restPose('lie', 1, 0);
    expect(lie.spine[0]).toBeLessThan(-0.9);
    expect(Math.abs(lie.spine[1])).toBeLessThan(0.3);
    expect(lie.legs!.l.upper[0]).toBeGreaterThan(0.9);
    // a slow breath, but never enough to move the pose about
    expect(Math.abs(restPose('lie', 1, 1).chest[1] - lie.chest[1])).toBeLessThan(0.05);
  });
});
