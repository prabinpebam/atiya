import { describe, expect, it } from 'vitest';
import { CUE, ReadyCue, chestPose, sparkle, toolPose, type ToolMotion } from '../../src/game/systems/readyCue';
import { craftingTableModel } from '../../src/game/world/craft/models';

const run = (c: ReadyCue, seconds: number, active: boolean) => {
  for (let t = 0; t < seconds; t += 1 / 60) c.step(1 / 60, active);
};

describe('ready cues: the chest and the crafting table show they can be used', () => {
  it('wakes once as it becomes the target, eases to ready, and back when you leave', () => {
    const c = new ReadyCue();
    run(c, 1, false);
    expect(c.on).toBe(0);
    expect(c.wakes).toBe(0);
    c.step(1 / 60, true);
    expect(c.wakes).toBe(1);
    expect(c.since).toBe(0);
    run(c, 0.4, true);
    expect(c.on).toBeGreaterThan(0.9);
    run(c, 2, true);
    expect(c.on).toBe(1);
    expect(c.wakes).toBe(1); // staying doesn't wake it again
    run(c, 2, false);
    expect(c.on).toBe(0);
    c.step(1 / 60, true);
    expect(c.wakes).toBe(2);
  });

  it('the chest wiggles, its lid rattling, then rests ajar with a glow; at rest it is still and shut', () => {
    const rest = chestPose(Infinity, 0, false);
    expect(rest).toEqual({ rollZ: 0, pitchX: 0, sy: 1, lid: 0, glow: 0 });
    let roll = 0;
    let lid = 0;
    let sy = [1, 1];
    for (let t = 0; t < CUE.wiggle; t += 1 / 120) {
      const p = chestPose(t, 1, false);
      roll = Math.max(roll, Math.abs(p.rollZ));
      lid = Math.max(lid, p.lid);
      sy = [Math.min(sy[0], p.sy), Math.max(sy[1], p.sy)];
      expect(Math.abs(p.rollZ)).toBeLessThan(0.15);
    }
    expect(roll).toBeGreaterThan(0.1);
    expect(lid).toBeGreaterThan(0.3);
    expect(sy[0]).toBeLessThan(0.96); // crouch
    expect(sy[1]).toBeGreaterThan(1.02); // stretch
    const after = chestPose(CUE.wiggle + 0.5, 1, false);
    expect(after.rollZ).toBe(0);
    expect(after.sy).toBe(1);
    expect(after.lid).toBeCloseTo(0.13);
    expect(after.glow).toBe(1);
  });

  it('under reduced motion nothing moves, but the steady sign (lid ajar, glow, glints) still shows', () => {
    for (const t of [0, 0.1, 0.3, 0.6]) {
      const p = chestPose(t, 1, true);
      expect(p.rollZ).toBe(0);
      expect(p.pitchX).toBe(0);
      expect(p.sy).toBe(1);
      expect(p.lid).toBeCloseTo(0.13);
      expect(p.glow).toBe(1);
      expect(toolPose({ hop: 0.08, spin: 1, idle: 'tap' }, 0, t, 1, t, true)).toEqual({ lift: 0, rx: 0, ry: 0, rz: 0 });
    }
    const a = sparkle(2, 6, 1, 1, true);
    const b = sparkle(2, 6, 5, 1, true);
    expect(a).toEqual(b);
    expect(a.s).toBeGreaterThan(0);
  });

  it('the tools hop to life in a ripple across the bench, land, then keep a small idle motion', () => {
    const { tools } = craftingTableModel();
    expect(tools.map((t) => t.name).sort()).toEqual(['chisel', 'hammer', 'mallet', 'pencil', 'saw', 'square']);
    for (const t of tools) expect(t.geo.solid).toBeTruthy();
    const m: ToolMotion = { hop: 0.08, spin: 0.5, idle: 'bob' };
    // the first tool is up before the third starts
    expect(toolPose(m, 0, CUE.hop / 2, 1, 0, false).lift).toBeCloseTo(0.08, 2);
    expect(toolPose(m, 3, 3 * CUE.stagger + 0.05, 1, 0, false).lift).toBeGreaterThan(0);
    expect(toolPose(m, 3, 0.05, 1, 0, false).lift).toBe(0);
    for (const tool of tools) {
      for (let t = 0; t < 4; t += 1 / 60) {
        const p = toolPose(tool.motion, 2, t, 1, t, false);
        expect(p.lift).toBeGreaterThanOrEqual(0);
        expect(p.lift).toBeLessThan(0.2);
        expect(Math.abs(p.rz)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(p.rx)).toBeLessThanOrEqual(0.12);
      }
    }
    // the hammer taps while you stay; nothing moves once you've gone and it has settled
    const hammer = tools.find((t) => t.name === 'hammer')!;
    let tap = 0;
    for (let t = 2; t < 4; t += 1 / 60) tap = Math.max(tap, toolPose(hammer.motion, 1, t, 1, t, false).rz);
    expect(tap).toBeGreaterThan(0.45);
    expect(toolPose(hammer.motion, 1, 10, 0, 10.1, false)).toEqual({ lift: 0, rx: 0, ry: 0, rz: 0 });
  });

  it('the hammer tap lifts its head (the tap axis is level, across the handle)', () => {
    const hammer = craftingTableModel().tools.find((t) => t.name === 'hammer')!;
    const [ax, ay, az] = hammer.axis;
    expect(ay).toBe(0);
    // the head lies toward −x, +z from the pivot; a positive turn about the axis must raise it
    const head = [0.19 - hammer.pivot[0], 0, 0.2 - hammer.pivot[2]];
    const up = az * head[0] - ax * head[2]; // (axis × head).y
    expect(up).toBeGreaterThan(0);
  });

  it('glints stay in their box and vanish when the cue is off', () => {
    for (let i = 0; i < 6; i++) {
      for (let t = 0; t < 5; t += 0.1) {
        const s = sparkle(i, 6, t, 1, false);
        expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(0.86);
        expect(s.y).toBeGreaterThanOrEqual(-0.2);
        expect(s.y).toBeLessThanOrEqual(1.2);
        expect(s.s).toBeGreaterThanOrEqual(0);
        expect(sparkle(i, 6, t, 0, false).s).toBe(0);
      }
    }
  });
});
