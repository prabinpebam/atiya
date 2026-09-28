import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { kitMaterials } from './materials';
import { DUCK_NECK, birdBody, birdWing, duck, duckHead, duckNest, duckling, fishModel, rabbit } from './wildlifeModels';
import { RIVER_WATER_U } from './terrain';
import { birdsOut, createWildlife, meadowSpots, stepWildlife, type Rabbit, type WildEnv, type Wildlife as World } from './animals';

const R = CONFIG.planetRadius;
/** Fish swim this far under the water surface (u): just under it, so they show through. */
const FISH_DEPTH = 0.035;
/** Display scale per species: a little larger than life, so they read at the diorama's distance. */
const SIZE = { rabbit: 1.4, duck: 1.3, fish: 1.35, bird: 1.4 } as const;
const KOI = ['#ff8a2a', '#ffffff', '#ffb23c', '#e8583a', '#ffd9a8'].map((c) => new Color(c));
const TROUT = ['#6f7d6a', '#8a8f78', '#5f6f66'].map((c) => new Color(c));

const _m = new Matrix4();
const _b = new Matrix4();
const _x = new Vector3();
const _z = new Vector3();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _tilt = new Quaternion();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const _flipY = new Matrix4().makeRotationY(Math.PI);
const _root = new Matrix4();
const _head = new Matrix4();
const _e = new Euler(0, 0, 0, 'YXZ');
const _z0 = new Vector3(0, 0, 1);
/** How high the duck stands on land (her feet at the model's y ≈ −0.062, × her size), and a duckling. */
const DUCK_LEGS = 0.08;
const DUCKLING_FEET = 0.026;
/** A kit hops lower than an adult (u at the top of its arc). */
const KIT_HOP = 0.07;

/** Which rabbit model: an adult of a coat lying low or sitting up, or a kit of a coat. */
const rabbitModel = (r: Rabbit, upright: boolean) => (r.mum ? `kit-${r.coat}` : `rabbit-${r.coat}${upright ? '-up' : ''}`);

/** Matrix for a model standing at unit `n` (height `h` above the base sphere), facing tangent `dir`. */
function place(out: Matrix4, n: Vector3, dir: Vector3, h: number, scale = 1, pitch = 0, yaw = 0, roll = 0): Matrix4 {
  _x.crossVectors(n, dir).normalize();
  _z.copy(dir);
  out.makeBasis(_x, n, _z);
  _q.setFromRotationMatrix(out);
  if (yaw) _q.multiply(_tilt.setFromAxisAngle(UP as Vector3, yaw));
  if (pitch) _q.multiply(_tilt.setFromAxisAngle(_x.set(1, 0, 0), pitch));
  if (roll) _q.multiply(_tilt.setFromAxisAngle(_z0, roll));
  _p.copy(n).multiplyScalar(R + h);
  return out.compose(_p, _q, _s.setScalar(scale));
}

function Herd({ geometry, material, count, onMesh, shadow = true }: { geometry: BufferGeometry; material: Material; count: number; onMesh: (m: InstancedMesh | null) => void; shadow?: boolean }) {
  return <instancedMesh ref={onMesh} args={[geometry, material, Math.max(1, count)]} castShadow={shadow} receiveShadow frustumCulled={false} />;
}

/**
 * Ambient wildlife (`world/wildlife.ts`): rabbits in the meadows, a duck and ducklings on the pond,
 * fish in the pond and the stream, and a few birds. The pure simulation runs each frame (frozen
 * while ambient motion is paused); this draws it with a handful of instanced low-poly models.
 */
export function Wildlife({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const { env, world } = useMemo(() => {
    const layout = controller.props;
    const terrain = controller.terrain;
    const e: WildEnv = {
      player: controller.sim.pLocal.clone(),
      // Chopper and the children: rabbits bolt from them and ground birds take off, as from the character
      threats: controller.threats,
      night: 0,
      obstacles: [...controller.geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles],
      inWater: (n) => terrain.inWater(n),
      pond: layout.pond ? { n: layout.pond.n, shore: (n) => terrain.pondShore(n) } : null,
      river: layout.river,
      nest: layout.home?.duckNest.n ?? null,
    };
    const spots = meadowSpots(e, layout.grass.map((g) => g.n), UP as Vector3);
    return { env: e, world: createWildlife(e, spots) };
  }, [controller]);
  controller.wildlife = world;

  // the rabbits' models: every coat that's out there, lying low and sitting up, and the kits'
  const rabbitGeo = useMemo(() => {
    const out: Record<string, { geometry: BufferGeometry; count: number; kit: boolean }> = {};
    for (const r of world.rabbits)
      for (const up of r.mum ? [false] : [false, true]) {
        const key = rabbitModel(r, up);
        out[key] ??= { geometry: rabbit(r.coat, r.mum ? 'kit' : up ? 'up' : 'down'), count: 0, kit: Boolean(r.mum) };
        out[key].count++;
      }
    return out;
  }, [world]);
  const geo = useMemo(() => ({ duck: duck(), duckHead: duckHead(), duckling: duckling(), nest: duckNest(), fish: fishModel(), bird: birdBody(), wing: birdWing() }), []);
  const nest = controller.props.home?.duckNest ?? null;
  const mat = useMemo(() => kitMaterials().solid, []);
  const meshes = useRef<Record<string, InstancedMesh | null>>({});
  const set = (k: string) => (m: InstancedMesh | null) => {
    meshes.current[k] = m;
  };
  const clock = useRef(0);

  // Every mesh gets an instance colour (white unless tinted), like the other props: the kit material
  // is shared, and meshes with and without instance colours would flip its program every draw.
  // Fish: koi in the pond, trout in the stream.
  useLayoutEffect(() => {
    const white = new Color('#ffffff');
    for (const [k, m] of Object.entries(meshes.current)) {
      if (!m) continue;
      for (let i = 0; i < m.count; i++) m.setColorAt(i, k === 'fish' ? (world.fish[i]?.stream ? TROUT[i % TROUT.length] : KOI[i % KOI.length]) : white);
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [world]);
  // ground height under each animal, recomputed only once it has moved (the terrain maths isn't free)
  const heights = useMemo(() => new WeakMap<object, { n: Vector3; h: number }>(), []);
  const groundAt = (key: object, n: Vector3) => {
    let e = heights.get(key);
    if (!e) heights.set(key, (e = { n: n.clone(), h: controller.terrain.walkHeight(n) }));
    else if (e.n.distanceToSquared(n) > 1e-6) {
      e.n.copy(n);
      e.h = controller.terrain.walkHeight(n);
    }
    return e.h;
  };

  useFrame((_, dt) => {
    const M = meshes.current;
    env.player.copy(controller.sim.pLocal);
    env.night = controller.sky.night;
    env.feed = controller.duckFeed?.spot ?? null;
    env.calm = controller.seatMotion.seated;
    if (!paused) {
      stepWildlife(world, env, dt);
      clock.current += Math.min(dt, 0.1);
    }
    const t = clock.current;
    // rabbits: hop arcs with a little squash and stretch; sitting up swaps to the upright pose. Each
    // model's visible instances are packed first and the rest aren't drawn, so a pose nobody's in
    // costs no draw call
    const used: Record<string, number> = {};
    for (const r of world.rabbits) {
      const air = r.hop >= 0 ? 4 * r.hop * (1 - r.hop) : 0;
      const high = r.mum ? KIT_HOP : r.state === 'flee' ? 0.2 : 0.12;
      const h = groundAt(r, r.n) + air * high;
      const pitch = r.hop >= 0 ? (0.5 - r.hop) * (r.mum ? 0.8 : 0.6) : 0;
      const key = rabbitModel(r, r.upright && r.hop < 0);
      const i = (used[key] = (used[key] ?? 0) + 1) - 1;
      M[key]?.setMatrixAt(i, place(_m, r.n, r.dir, h, SIZE.rabbit, pitch));
    }
    for (const key of Object.keys(rabbitGeo)) {
      const m = M[key];
      if (!m) continue;
      m.count = used[key] ?? 0;
      m.visible = m.count > 0;
    }
    // duck: bobbing on the water, standing (and waddling) on the bank, sitting in the nest; dabbling
    // tips her tail up; her head pecks at crumbs, looks about, and tucks back under her wing asleep
    const water = RIVER_WATER_U;
    if (world.duck && M.duck) {
      const d = world.duck;
      const ground = groundAt(d, d.n) + DUCK_LEGS - 0.025 * d.rest;
      const swim = water + Math.sin(t * 2.1) * 0.008 * (1 - d.rest);
      const dry = ground > swim;
      const tip = d.state === 'dabble' ? 1.05 : 0;
      const roll = dry && d.speed > 0.02 ? Math.sin(t * 11) * 0.12 : 0;
      M.duck.setMatrixAt(0, place(_m, d.n, d.dir, Math.max(ground, swim) - tip * 0.04, SIZE.duck, tip, 0, roll));
      const look = Math.sin(t * 0.37) * 0.35 * (1 - d.rest) * (1 - d.peck);
      _e.set(d.peck * 1.05 + d.rest * 0.55, look + d.rest * 2.75, 0);
      _head.makeRotationFromEuler(_e).setPosition(DUCK_NECK[0], DUCK_NECK[1] - 0.03 * d.rest, DUCK_NECK[2] - 0.06 * d.rest);
      M.duckHead?.setMatrixAt(0, _head.premultiply(_m));
    }
    world.ducklings.forEach((k, i) => {
      const ground = groundAt(k, k.n) + DUCKLING_FEET + (world.duck?.state === 'nest' ? 0.02 : 0);
      const swim = water + Math.sin(t * 3 + i * 1.7) * 0.006;
      const dry = ground > swim;
      const roll = dry && k.speed > 0.03 ? Math.sin(t * 14 + i) * 0.14 : 0;
      M.duckling?.setMatrixAt(i, place(_m, k.n, k.dir, Math.max(ground, swim), SIZE.duck, k.peck * 0.55, 0, roll));
    });
    if (nest && M.nest) M.nest.setMatrixAt(0, place(_m, nest.n, nest.facing, groundAt(nest, nest.n) - 0.005, SIZE.duck));
    // fish: a tail-wag wiggle that quickens with speed
    world.fish.forEach((f, i) => {
      const wag = Math.sin(t * (6 + f.speed * 14) + i * 2.3) * (0.12 + f.speed * 0.25);
      M.fish?.setMatrixAt(i, place(_m, f.n, f.dir, water - FISH_DEPTH, SIZE.fish, 0, wag));
    });
    // birds: pecking dips the body; flying beats the wings (and glides now and then)
    const out = birdsOut(env);
    world.birds.forEach((b, i) => {
      if (!out) {
        M.bird?.setMatrixAt(i, HIDDEN);
        M.wing?.setMatrixAt(i * 2, HIDDEN);
        M.wing?.setMatrixAt(i * 2 + 1, HIDDEN);
        return;
      }
      const h = groundAt(b, b.n) + b.alt;
      place(_b, b.n, b.dir, h, SIZE.bird, b.state === 'peck' ? b.peck * 0.6 : -b.climb * 0.08);
      M.bird?.setMatrixAt(i, _b);
      const beat = b.state === 'peck' ? -0.15 : Math.sin(b.flap) * 0.95 * b.flapAmp + 0.1;
      for (const side of [1, -1]) {
        _m.makeRotationZ(side * beat);
        if (side < 0) _m.premultiply(_flipY);
        _m.premultiply(_root.makeTranslation(side * 0.025, 0.055, 0));
        M.wing?.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), _m.premultiply(_b));
      }
    });
    for (const k of Object.keys(M)) if (M[k]) M[k]!.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="wildlife">
      {/* (the kits are tiny and close by their mothers: they skip the shadow pass) */}
      {Object.entries(rabbitGeo).map(([key, g]) => (
        <Herd key={key} geometry={g.geometry} material={mat} count={g.count} onMesh={set(key)} shadow={!g.kit} />
      ))}
      {/* on the water (and the wings, paper-thin) a shadow shows little: they skip the shadow pass */}
      {world.duck && <Herd geometry={geo.duck} material={mat} count={1} onMesh={set('duck')} shadow={false} />}
      {world.duck && <Herd geometry={geo.duckHead} material={mat} count={1} onMesh={set('duckHead')} shadow={false} />}
      {nest && <Herd geometry={geo.nest} material={mat} count={1} onMesh={set('nest')} />}
      <Herd geometry={geo.duckling} material={mat} count={world.ducklings.length} onMesh={set('duckling')} shadow={false} />
      <Herd geometry={geo.fish} material={mat} count={world.fish.length} onMesh={set('fish')} shadow={false} />
      <Herd geometry={geo.bird} material={mat} count={world.birds.length} onMesh={set('bird')} />
      <Herd geometry={geo.wing} material={mat} count={world.birds.length * 2} onMesh={set('wing')} shadow={false} />
    </group>
  );
}

export type { World as WildlifeWorld };
