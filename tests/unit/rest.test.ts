import { describe, expect, it } from 'vitest';
import { PlanetSim, JUMP } from '../../src/game/systems/movement';
import { JUMP_POSE, LAND_S, REST, jumpPose, restPose } from '../../src/game/world/craft/restPoses';
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

describe('the hop’s pose', () => {
  const V = JUMP.v;
  const same = (a: readonly number[], b: readonly number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));
  it('eases in at take-off with the arms up and knees tucked, spreads the arms and reaches down as it falls, and bends on landing', () => {
    expect(jumpPose(V, V, 0, -1)!.w).toBe(0);
    const up = jumpPose(V, V, 0.2, -1)!;
    expect(up.w).toBe(1);
    same(up.arms.l.upper, JUMP_POSE.rise.arms.l.upper);
    same(up.legs!.l.upper, JUMP_POSE.rise.legs.l.upper);
    const down = jumpPose(-V, V, 0.4, -1)!;
    same(down.arms.l.upper, JUMP_POSE.fall.arms.l.upper);
    // landing: from the fall into the bend at full weight (no snap), then it lets go, and it's over
    const touch = jumpPose(-V, V, 0, 0)!;
    expect(touch.w).toBe(1);
    same(touch.arms.l.upper, JUMP_POSE.fall.arms.l.upper);
    const bent = jumpPose(0, V, 0, 0.06)!;
    expect(bent.hip).toBeCloseTo(JUMP_POSE.land.hip, 6);
    expect(jumpPose(0, V, 0, LAND_S - 0.001)!.w).toBeLessThan(0.05);
    expect(jumpPose(0, V, 0, LAND_S)).toBeNull();
  });

  it('on the move, the legs keep the run cycle’s stride (no leg pose, no knee-bend), and the arms react more lightly', () => {
    const run = jumpPose(V, V, 0.2, -1, 1)!;
    expect(run.legs).toBeUndefined();
    expect(run.w).toBeCloseTo(0.6, 6);
    const landing = jumpPose(0, V, 0, 0.06, 1)!;
    expect(landing.legs).toBeUndefined();
    expect(landing.hip).toBe(0);
    // standing still, the legs tuck
    expect(jumpPose(V, V, 0.2, -1, 0)!.legs).toBeDefined();
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
