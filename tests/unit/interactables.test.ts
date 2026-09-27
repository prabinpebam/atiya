import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance, moveAlong, rotateTangent, tangentToward } from '../../src/game/math/sphere';
import { generateProps } from '../../src/game/world/layout';
import { benchSeats } from '../../src/game/systems/seating';
import { REACH, buildTargets, pickTarget, standSpot, type Target } from '../../src/game/systems/interactables';
import { ActionRunner, CYCLES, MINE_SWINGS, PICKAXE, actionFor } from '../../src/game/systems/actions';
import { Harvest, REGROW } from '../../src/game/world/harvest';
import { actionPose } from '../../src/game/player/actionPoses';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const seats = benchSeats(layout.furniture);
const targets = buildTargets(layout, seats, layout.chest);
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const of = (kind: Target['kind']) => targets.filter((t) => t.kind === kind);
/** Stand `u` from target `t` (past its edge), and the forward tangent facing it. */
const facing = (t: Target, u: number, turn = 0) => {
  const out = rotateTangent(tangentToward(t.n, new Vector3(0.3, 0.9, 0.1).normalize()) ?? tangentToward(t.n, new Vector3(1, 0, 0))!, t.n, 0.3);
  const p = moveAlong(t.n, out, (t.edgeU + u) / R);
  const fwd = rotateTangent(tangentToward(p, t.n)!, p, turn);
  return { p, fwd };
};

describe('interactables', () => {
  it('lists every tree (by kind), boulder, flower, the chest and the bench, with unique keys', () => {
    expect(of('tree').length).toBe(layout.hardwood.length + layout.fruit.length + layout.cedar.length);
    expect(of('tree').filter((t) => t.tree === 'apple').length + of('tree').filter((t) => t.tree === 'orange').length).toBe(layout.fruit.length);
    expect(of('boulder').length).toBe(layout.boulders.length);
    expect(of('flower').length).toBe(layout.flowers.tulip.length + layout.flowers.cosmos.length + layout.flowers.pansy.length);
    expect(of('chest').length).toBe(1);
    expect(of('bench').length).toBe(seats.length);
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length);
    for (const f of of('flower')) expect(f.colour).toBeGreaterThanOrEqual(0);
  });

  it('the chest stands in the workyard between the Post Office and the Workshop, clear of every other obstacle, and nothing grows through it', () => {
    const ws = geos.find((g) => g.id === 'workshop')!;
    const po = geos.find((g) => g.id === 'post-office')!;
    const chest = layout.chest!;
    expect(chest).toBeTruthy();
    // between the two (nearer them than any other building), clear of both
    const near = geos.map((g) => ({ id: g.id, e: d(chest.n, g.n) - g.footprintU })).sort((a, b) => a.e - b.e);
    expect(near.slice(0, 2).map((x) => x.id).sort()).toEqual(['post-office', 'workshop']);
    for (const g of [ws, po]) expect(d(chest.n, g.n) - g.footprintU).toBeGreaterThan(0.8 + 0.4 - 1e-6);
    for (const o of layout.obstacles) if (d(o.n, chest.n) > 1e-6) expect(d(o.n, chest.n)).toBeGreaterThan(o.radiusU + 0.4 - 1e-6);
    for (const p of [...layout.grass, ...layout.sprigs, ...layout.flowers.tulip, ...layout.flowers.cosmos, ...layout.flowers.pansy]) expect(d(p.n, chest.n)).toBeGreaterThan(0.55);
  });

  it('offers what you face, nearest first; not what is behind you unless within arm’s reach', () => {
    const tree = of('tree').find((t) => t.tree === 'hardwood')!;
    const { p, fwd } = facing(tree, 0.5);
    expect(pickTarget(p, fwd, targets, null)?.key).toBe(tree.key);
    const away = facing(tree, 0.5, Math.PI);
    expect(pickTarget(away.p, away.fwd, targets, null)?.key).not.toBe(tree.key);
    const close = facing(tree, 0.3, Math.PI);
    expect(pickTarget(close.p, close.fwd, targets, null)?.key).toBe(tree.key);
    const far = facing(tree, REACH.tree + 0.2);
    expect(pickTarget(far.p, far.fwd, targets, null)?.key).not.toBe(tree.key);
  });

  it('keeps the current target a little past its reach (hysteresis) and skips what is used up', () => {
    const b = of('boulder')[0];
    const { p, fwd } = facing(b, REACH.boulder + 0.15);
    expect(pickTarget(p, fwd, targets, null)?.key).not.toBe(b.key);
    expect(pickTarget(p, fwd, targets, b.key)?.key).toBe(b.key);
    const f = of('flower')[0];
    const at = facing(f, 0.4);
    expect(pickTarget(at.p, at.fwd, targets, null, (t) => t.key !== f.key)?.key).not.toBe(f.key);
  });

  it('someone on the move stays the target for a step or two past their reach, but not from afar', () => {
    const npc: Target = { kind: 'npc', key: 'npc:x', n: of('tree')[0].n.clone(), edgeU: 0, reachU: 1.3, standU: 0.8, index: 0, scale: 1 };
    const tree: Target = { ...npc, kind: 'tree', key: 'tree:x' };
    for (const [t, keep] of [[npc, REACH.keepMoving], [tree, REACH.keep]] as const) {
      const step = facing(t, t.reachU + keep - 0.05);
      expect(pickTarget(step.p, step.fwd, [t], null)).toBeNull();
      expect(pickTarget(step.p, step.fwd, [t], t.key)).toBe(t);
      const gone = facing(t, t.reachU + keep + 0.05);
      expect(pickTarget(gone.p, gone.fwd, [t], t.key)).toBeNull();
    }
    expect(REACH.keepMoving).toBeGreaterThan(REACH.keep);
  });

  it('the ring that marks a tree or a rock clears its trunk or its stone', () => {
    for (const t of [...of('tree'), ...of('boulder')]) expect(t.markU!).toBeGreaterThan(t.edgeU + 0.2);
  });

  it('near a landmark, a flower needs you right at it', () => {
    const f = of('flower')[0];
    const mid = facing(f, 0.7);
    expect(pickTarget(mid.p, mid.fwd, [f], null)).toBe(f);
    expect(pickTarget(mid.p, mid.fwd, [f], null, undefined, R, true)).toBeNull();
    const at = facing(f, 0.4);
    expect(pickTarget(at.p, at.fwd, [f], null, undefined, R, true)).toBe(f);
  });

  it('actions map to targets, and a boulder is worked from a pickaxe’s length away', () => {
    expect(actionFor(of('tree')[0])).toBe('shake');
    expect(actionFor(of('boulder')[0])).toBe('mine');
    expect(actionFor(of('flower')[0])).toBe('pick');
    expect(actionFor(of('chest')[0])).toBe('open');
    expect(actionFor(of('bench')[0])).toBeNull();
    const b = of('boulder')[0];
    expect(d(standSpot(b, facing(b, 0.8).p), b.n)).toBeCloseTo(b.standU, 5);
    expect(b.standU - b.edgeU).toBeGreaterThan(0.5);
  });
});

describe('action cycles', () => {
  const run = (kind: 'shake' | 'mine' | 'pick' | 'open', t: Target, instant = false) => {
    const a = new ActionRunner();
    const start = facing(t, 0.6).p;
    a.start(kind, t, start);
    const beats: { t: number; beat: string }[] = [];
    const path: Vector3[] = [];
    let time = 0;
    while (a.busy && time < 5) {
      const r = a.step(1 / 60, instant);
      time += 1 / 60;
      for (const b of r.beats) beats.push({ t: time, beat: b });
      if (r.at) path.push(r.at.clone());
    }
    return { a, beats, path, time, start };
  };

  it('every activation plays the same fixed cycle (same beats, same length)', () => {
    const tree = of('tree').find((t) => t.tree === 'apple')!;
    const one = run('shake', tree);
    const two = run('shake', tree);
    expect(one.beats.map((b) => b.beat)).toEqual(['fruit', 'leaf', 'fruit', 'log', 'leaf']);
    expect(two.beats.map((b) => b.beat)).toEqual(one.beats.map((b) => b.beat));
    expect(one.time).toBeCloseTo(CYCLES.shake.duration, 1);
    const mine = run('mine', of('boulder')[0]);
    expect(mine.beats.map((b) => b.beat)).toEqual(['hit', 'hit', 'hit']);
    expect(run('pick', of('flower')[0]).beats.map((b) => b.beat)).toEqual(['pluck']);
    expect(run('open', of('chest')[0]).beats.map((b) => b.beat)).toEqual(['open']);
  });

  it('steps in to the trunk, then back out clear of the tree', () => {
    const tree = of('tree').find((t) => t.tree === 'hardwood')!;
    const r = run('shake', tree);
    const closest = Math.min(...r.path.map((p) => d(p, tree.n)));
    expect(closest).toBeCloseTo(tree.standU, 3);
    expect(closest).toBeLessThan(tree.edgeU + CONFIG.playerRadius);
    expect(d(r.path[r.path.length - 1], tree.n)).toBeGreaterThanOrEqual(tree.edgeU + CONFIG.playerRadius);
  });

  it('the pickaxe is out for the whole mining cycle, and each swing lands on its hit', () => {
    for (const s of MINE_SWINGS) {
      expect(s.start).toBeGreaterThan(PICKAXE.in);
      expect(s.hit).toBeLessThan(PICKAXE.out);
      expect(actionPose('mine', s.hit - 0.001).pickaxe).toBeGreaterThan(0.9);
    }
    expect(actionPose('mine', 0.05).pickaxe).toBe(0);
    expect(actionPose('mine', PICKAXE.out + 0.05).pickaxe).toBe(0);
    // the pose blends in and out (no snap from idle)
    for (const k of ['shake', 'mine', 'pick', 'open'] as const) {
      expect(actionPose(k, 0).w).toBeLessThan(0.05);
      expect(Math.max(...[0.3, 0.45, 0.6, 0.9].map((t) => actionPose(k, t).w))).toBeGreaterThan(0.9);
    }
    expect(actionPose('pick', 0.4).hip).toBeGreaterThan(0.1);
  });
});

describe('harvest', () => {
  it('fruit is taken once, then grows back with a pop', () => {
    const h = new Harvest();
    expect(h.takeFruit('apple', 2)).toBe(true);
    expect(h.takeFruit('apple', 2)).toBe(false);
    expect(h.ripe('apple', 2)).toBe(false);
    expect(h.fruitScale('apple', 2)).toBe(0);
    h.step(REGROW.fruit + REGROW.pop * 0.5);
    expect(h.fruitScale('apple', 2)).toBeGreaterThan(0.3);
    h.step(REGROW.pop);
    expect(h.ripe('apple', 2)).toBe(true);
    expect(h.fruitScale('apple', 2)).toBe(1);
  });

  it('a picked flower is gone until it regrows, and changes bump the version', () => {
    const h = new Harvest();
    const v = h.version;
    expect(h.pickFlower('tulip', 5)).toBe(true);
    expect(h.flowerHere('tulip', 5)).toBe(false);
    expect(h.flowerHere('tulip', 6)).toBe(true);
    expect(h.version).toBe(v + 1);
    h.step(REGROW.flower - 1);
    expect(h.flowerHere('tulip', 5)).toBe(false);
    h.step(1 + REGROW.pop + 0.01);
    expect(h.flowerHere('tulip', 5)).toBe(true);
    expect(h.version).toBeGreaterThan(v + 1);
  });
});
