import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, tangentToward } from '../../src/game/math/sphere';
import { generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { createWildlife, meadowSpots, nearestThreat, stepWildlife, type WildEnv } from '../../src/game/world/animals';
import { BONES, BONE_INDEX, bindPositions, chopperGeometry, chopperStats, envelopeWeights, type BoneName } from '../../src/game/world/chopper/model';
import { CLIPS, ChopperAnim, type Clip, GAITS, LEGS, gaitAt, gaitWeights, pawOffset, solveLeg } from '../../src/game/world/chopper/anim';
import { ChopperBrain, DOG, pickIdle, type DogWorld, type Spot } from '../../src/game/world/chopper/brain';
import { chopperRig, PAW_H } from '../../src/game/world/chopper/model';
import { mulberry32 } from '../../src/game/world/layout';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);

function dogWorld(player = UP.clone() as Vector3, extra: Partial<DogWorld> = {}): DogWorld {
  const spots: Spot[] = [
    ...layout.hardwood.map((t, i) => ({ n: t.n, radiusU: 0.42 * t.scale, kind: 'tree' as const, key: `t${i}` })),
    ...layout.rocks.map((r, i) => ({ n: r.n, radiusU: 0.36 * r.scale, kind: 'rock' as const, key: `r${i}` })),
    ...layout.bushes.map((b, i) => ({ n: b.n, radiusU: 0.42 * b.scale, kind: 'bush' as const, key: `b${i}` })),
  ];
  const pond = layout.pond;
  return {
    R,
    player,
    playerFwd: tangentToward(player, new Vector3(0, 0, -1)) ?? new Vector3(1, 0, 0),
    playerVel: new Vector3(),
    obstacles,
    blocked: (n) => (pond ? d(n, pond.n) < terrain.pondShore(n) + 0.05 : false) || terrain.waterDepth(n) > 0.16,
    rabbits: [],
    spots,
    others: [],
    ...extra,
  };
}

const run = (b: ChopperBrain, w: DogWorld, seconds: number, each?: (t: number) => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    b.step(1 / 30, w);
    each?.(t);
  }
};

describe('Chopper: model', () => {
  it('binds every vertex to at most four bones of its own part, with weights summing to 1', () => {
    const bind = bindPositions();
    const p = new Vector3(0.07, 0.36, 0.17);
    const w = envelopeWeights(p, ['earL', 'earL2', 'head']);
    expect(w.length).toBeLessThanOrEqual(4);
    expect(w.reduce((s, x) => s + x[1], 0)).toBeCloseTo(1, 6);
    // a point on the ear never follows the jaw (not one of its bones)
    expect(w.some(([i]) => i === BONE_INDEX.jaw)).toBe(false);
    // the nearest segment dominates
    const paw = envelopeWeights(bind.wristL.clone().setY(0.02), ['elbowL', 'wristL']);
    expect(paw[0][0]).toBe(BONE_INDEX.wristL);
    expect(paw[0][1]).toBeGreaterThan(0.6);
  });

  it('builds one merged geometry: every part once, then the furry parts per shell', () => {
    const g = chopperGeometry(8);
    for (const a of ['position', 'normal', 'color', 'aFur', 'aGloss', 'aComb', 'aBind', 'aShell', 'skinIndex', 'skinWeight']) expect(g.getAttribute(a), a).toBeTruthy();
    const s = chopperStats(8);
    expect(s.baseTriangles).toBeGreaterThan(3000);
    expect(s.baseTriangles).toBeLessThan(12000);
    // the shells repeat the furry parts only (eyes, nose, collar, tag are bare)
    const perShell = (s.triangles - s.baseTriangles) / 8;
    expect(perShell).toBeLessThan(s.baseTriangles);
    expect(perShell).toBeGreaterThan(s.baseTriangles * 0.6);
    // budget (chopper.md §7): the world's 16 shells stay under ~110 k triangles
    expect(chopperStats(16).triangles).toBeLessThan(110_000);
    const w = g.getAttribute('skinWeight');
    for (let i = 0; i < w.count; i += 97) expect(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i)).toBeCloseTo(1, 4);
    const fur = g.getAttribute('aFur');
    let bare = 0;
    for (let i = 0; i < fur.count; i++) if (fur.getX(i) === 0) bare++;
    expect(bare).toBeGreaterThan(0);
  });

  it('has one bone per name, parents before children', () => {
    const seen = new Set<BoneName>();
    for (const b of BONES) {
      if (b.parent) expect(seen.has(b.parent)).toBe(true);
      seen.add(b.name);
    }
    expect(seen.size).toBe(BONES.length);
  });
});

describe('Chopper: gaits and IK', () => {
  it('uses the textbook footfall patterns', () => {
    // walk: lateral sequence, a quarter cycle apart; trot: diagonal pairs together
    expect(GAITS.walk.offset).toEqual({ hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 });
    expect(GAITS.trot.offset.hL).toBe(GAITS.trot.offset.fR);
    expect(GAITS.trot.offset.hR).toBe(GAITS.trot.offset.fL);
    expect(GAITS.walk.duty).toBeGreaterThan(0.5); // always 2+ paws down
    expect(GAITS.gallop.duty).toBeLessThan(0.5); // a moment of suspension
  });

  it('blends gaits by speed, and the weights sum to 1', () => {
    for (const v of [0, 0.5, 1, 1.5, 2.3, 3, 5]) {
      const w = gaitWeights(v);
      expect(w.walk + w.trot + w.gallop).toBeCloseTo(1, 6);
    }
    expect(gaitWeights(0.4).walk).toBeCloseTo(1, 6);
    expect(gaitWeights(1.6).trot).toBeGreaterThan(0.9);
    expect(gaitWeights(4).gallop).toBeCloseTo(1, 6);
    // the pure gaits' offsets survive the circular blend
    const trot = gaitAt(1.6).offset;
    expect(Math.abs(trot.hL - trot.fR)).toBeLessThan(0.05);
  });

  it('sweeps a planted paw back at body speed (no foot sliding) and lifts it in swing', () => {
    for (const v of [0.6, 1.6, 3.2]) {
      const g = gaitAt(v);
      const a = pawOffset(g, 0.05);
      const b = pawOffset(g, 0.1);
      expect(a.y).toBe(0);
      // dz / dt = −stride / (duty · period) = −speed
      expect((b.z - a.z) * g.freq / 0.05).toBeCloseTo(-v, 5);
      const mid = pawOffset(g, g.duty + (1 - g.duty) / 2);
      expect(mid.y).toBeCloseTo(g.lift, 6);
    }
  });

  it('reaches a paw target with two-bone IK, bending each joint the right way', () => {
    const r1: [number, number] = [-0.03, -0.08];
    const r2: [number, number] = [0.025, -0.08];
    const reach = (tz: number, ty: number, bend: 1 | -1) => {
      const [a1, a2] = solveLeg(tz, ty, r1, r2, bend);
      // a rotation about +X by a takes (z, y) to (z cos a + y sin a, y cos a − z sin a): + swings a leg back
      const rot = (v: [number, number], a: number): [number, number] => [v[0] * Math.cos(a) + v[1] * Math.sin(a), v[1] * Math.cos(a) - v[0] * Math.sin(a)];
      const k = rot(r1, a1);
      const e = rot(r2, a1 + a2);
      return { end: [k[0] + e[0], k[1] + e[1]], knee: k };
    };
    for (const [tz, ty] of [
      [0.0, -0.15],
      [0.05, -0.14],
      [-0.04, -0.12],
    ]) {
      const { end } = reach(tz, ty, -1);
      expect(end[0]).toBeCloseTo(tz, 4);
      expect(end[1]).toBeCloseTo(ty, 4);
    }
    // a front elbow bends back, a hind knee forward
    expect(reach(0, -0.13, -1).knee[0]).toBeLessThan(0);
    expect(reach(0, -0.13, 1).knee[0]).toBeGreaterThan(0);
  });

  it('poses every clip without NaNs, and eases between them', () => {
    const rig = chopperRig();
    const anim = new ChopperAnim(rig, mulberry32(3));
    for (const clip of Object.keys(CLIPS) as (keyof typeof CLIPS)[]) {
      for (let i = 0; i < 20; i++) anim.update(1 / 30, { speed: 0, turn: 0, clip, clipTime: i / 30, wag: 0.5, look: null, barkAge: 99, pant: 0, reduced: false });
      for (const b of Object.values(rig.bones)) {
        expect(Number.isFinite(b.rotation.x + b.rotation.y + b.rotation.z + b.position.y)).toBe(true);
      }
    }
    // running: the legs cycle
    const before = rig.bones.shoulderL.rotation.x;
    let changed = 0;
    for (let i = 0; i < 30; i++) {
      anim.update(1 / 60, { speed: 2, turn: 0, clip: 'stand', clipTime: i / 60, wag: 0.5, look: null, barkAge: 99, pant: 0, reduced: false });
      if (Math.abs(rig.bones.shoulderL.rotation.x - before) > 0.05) changed++;
    }
    expect(changed).toBeGreaterThan(5);
    expect(LEGS).toHaveLength(4);
  });
});

describe('Chopper: paws on the ground', () => {
  // the paws each pose lifts on purpose: one front paw raised to sniff high, a hind paw scratching
  const LIFTED: Partial<Record<Clip, string>> = { sniffHigh: 'wristL', scratch: 'hockR' };
  const PAWS = ['wristL', 'wristR', 'hockL', 'hockR'] as const;

  it('keeps every planted paw on the ground in every pose, barking or not (no floating, no dipping, no splaying out)', () => {
    const v = new Vector3();
    for (const clip of Object.keys(CLIPS) as Clip[]) {
      for (const barking of [false, true]) {
        const rig = chopperRig();
        const anim = new ChopperAnim(rig, mulberry32(3));
        const rest = bindPositions();
        anim.snap(clip);
        for (let t = 0; t < 4; t += 1 / 60) {
          anim.update(1 / 60, { speed: 0, turn: 0, clip, clipTime: t, wag: 0.5, look: null, barkAge: barking ? t % 0.8 : 99, pant: 0, reduced: false });
          if (t < 1.5) continue;
          rig.root.updateMatrixWorld(true);
          for (const paw of PAWS) {
            if (LIFTED[clip] === paw) continue;
            rig.bones[paw].getWorldPosition(v);
            expect(Math.abs(v.y - PAW_H), `${clip} ${paw} height${barking ? ' (barking)' : ''}`).toBeLessThan(0.004);
            expect(Math.abs(v.x - rest[paw].x), `${clip} ${paw} splay`).toBeLessThan(0.05);
          }
        }
      }
    }
  });

  it('in the play bow, a bark leaves the front paws where they are', () => {
    const rig = chopperRig();
    const anim = new ChopperAnim(rig, mulberry32(3));
    anim.snap('playBow');
    const v = new Vector3();
    const heights: number[] = [];
    for (let t = 0; t < 3; t += 1 / 60) {
      anim.update(1 / 60, { speed: 0, turn: 0, clip: 'playBow', clipTime: t, wag: 1, look: null, barkAge: t > 1.5 ? t - 1.5 : 99, pant: 0, reduced: false });
      rig.root.updateMatrixWorld(true);
      rig.bones.wristL.getWorldPosition(v);
      if (t > 1) heights.push(v.y);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.003);
  });
});

describe('Chopper: behaviour (utility AI)', () => {
  it('never repeats an idle straight away, and rests more when tired', () => {
    const rand = mulberry32(7);
    let last = pickIdle(null, 1, rand).clip;
    let lies = 0;
    for (let i = 0; i < 300; i++) {
      const next = pickIdle(last, 0.1, rand).clip;
      expect(next).not.toBe(last);
      if (next === 'lie' || next === 'pant') lies++;
      last = next;
    }
    expect(lies).toBeGreaterThan(60);
  });

  it('stays within the leash while the character stands still, and never under their feet', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(11));
    b.placeNear(w);
    const seen = new Set<string>();
    run(b, w, 240, () => {
      expect(d(b.n, w.player)).toBeLessThan(DOG.far + 1);
      expect(d(b.n, w.player)).toBeGreaterThan(DOG.minGap - 0.05);
      expect(w.blocked(b.n)).toBe(false);
      seen.add(b.behaviour);
    });
    // he does a variety of things on his own
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(seen.has('idle')).toBe(true);
  });

  it('comes back when the character is far, galloping past the far band', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(2));
    b.placeNear(w);
    // the character walks off 12 u away
    const away = moveAlong(w.player, w.playerFwd, 12 / R);
    w.player.copy(away);
    b.step(1 / 30, w);
    expect(b.behaviour).toBe('follow');
    let top = 0;
    let closest = Infinity;
    run(b, w, 8, () => {
      top = Math.max(top, b.speed);
      closest = Math.min(closest, d(b.n, w.player));
    });
    expect(top).toBeGreaterThan(DOG.speed.run);
    expect(closest).toBeLessThan(DOG.near + 0.1);
  });

  it('comes running when whistled, then heels by the character', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(5));
    b.placeNear(w);
    b.n.copy(moveAlong(w.player, w.playerFwd, 5 / R));
    b.hold('lie');
    b.whistle();
    expect(b.behaviour).toBe('whistled');
    run(b, w, 6);
    expect(['whistled', 'heel']).toContain(b.behaviour);
    expect(d(b.n, w.player)).toBeLessThan(2);
    run(b, w, 3);
    expect(b.behaviour).toBe('heel');
    expect(b.clip).toBe('sit');
  });

  it('warps back beside the character after a long separation (a fast travel)', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(9));
    b.placeNear(w);
    w.player.copy(new Vector3(0, -1, 0));
    w.playerFwd.copy(tangentToward(w.player, new Vector3(1, 0, 0))!);
    b.step(1 / 30, w);
    expect(d(b.n, w.player)).toBeLessThan(3);
    expect(b.clip).toBe('sit');
  });

  it('chases a nearby rabbit, never catches it, and barks after it', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(4));
    b.placeNear(w);
    const rabbit = { n: moveAlong(b.n, tangentToward(b.n, w.player)!.negate(), 3 / R) };
    w.rabbits = [rabbit];
    b.energy = 1;
    b.playful = 1;
    let chased = false;
    let barks = 0;
    run(b, w, 20, () => {
      if (b.behaviour === 'chase') chased = true;
      if (b.behaviour === 'chase' && b.stage === 0) expect(d(b.n, rabbit.n)).toBeGreaterThan(0.6);
      barks += b.events.filter((e) => e.type === 'bark').length;
      b.events.length = 0;
    });
    expect(chased).toBe(true);
    expect(barks).toBeGreaterThanOrEqual(2);
    // then he leaves rabbits alone for a while
    expect(b.cooldown.chase ?? 0).toBeGreaterThan(0);
  });

  it('runs ahead when the character walks steadily one way, then sits and waits', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(8));
    b.placeNear(w);
    w.playerVel.copy(w.playerFwd).multiplyScalar(2.2);
    let ahead = false;
    let sat = 0;
    run(b, w, 14, () => {
      // the character walks on (and the brain sees them move)
      w.player.copy(moveAlong(w.player, w.playerFwd, (2.2 / 30) / R));
      w.playerFwd.addScaledVector(w.player, -w.playerFwd.dot(w.player)).normalize();
      w.playerVel.copy(w.playerFwd).multiplyScalar(2.2);
      if (b.behaviour === 'runAhead' && b.stage === 1) {
        ahead = true;
        if (b.clip === 'sit') sat++;
      }
    });
    expect(ahead).toBe(true);
    expect(sat).toBeGreaterThan(5);
  });

  it('lays a scent trail clear of obstacles and water', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(12));
    b.placeNear(w);
    b.makeTrail(w);
    expect(b.trail.length).toBeGreaterThan(3);
    for (const p of b.trail) {
      expect(w.blocked(p)).toBe(false);
      for (const o of obstacles) if (o.n.dot(p) > 0.9) expect(d(p, o.n)).toBeGreaterThan(o.radiusU);
    }
  });

  it('commits to what he picked (no dithering between behaviours)', () => {
    const w = dogWorld();
    const b = new ChopperBrain(mulberry32(21));
    b.placeNear(w);
    let switches = 0;
    let last = b.behaviour;
    run(b, w, 120, () => {
      if (b.behaviour !== last) switches++;
      last = b.behaviour;
    });
    // at most a switch every couple of seconds on average
    expect(switches).toBeLessThan(60);
  });
});

describe('Chopper and the wildlife', () => {
  it('rabbits treat him as a threat, like the character', () => {
    const player = new Vector3(0, -1, 0);
    const env: WildEnv = {
      player,
      night: 0,
      obstacles,
      inWater: (n) => terrain.inWater(n),
      pond: layout.pond ? { n: layout.pond.n, shore: (n) => terrain.pondShore(n) } : null,
      river: layout.river,
      threats: [],
    };
    const spots = meadowSpots(env, layout.grass.map((g) => g.n), UP as Vector3);
    const w = createWildlife(env, spots);
    const r = w.rabbits[0];
    const dog = moveAlong(r.n, tangentToward(r.n, UP as Vector3)!, 1.5 / R);
    env.threats = [dog];
    expect(nearestThreat(r.n, env).at).toBe(dog);
    for (let i = 0; i < 20; i++) stepWildlife(w, env, 1 / 30);
    expect(r.state).toBe('flee');
  });
});
