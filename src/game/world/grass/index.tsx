import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { Matrix4, Vector3, Vector4, type Mesh, type Texture } from 'three';
import type { GameController } from '../../controller';
import { placeGrassSteps, vertexGrassSteps, type GrassOptions } from './field';
import { MOVERS, grassMaterial, packTextures, templateGeometry, type GrassDrawEnv, type GrassKind, type GrassUniforms } from './draw';
import { grassRules, type GrassWorld } from './zones';

/**
 * Blade grass, meadow flowers and knee-high tufts (docs: documentation/poc-3d-navigation/vegetation/).
 * Loaded in the `nature` chunk with the wildlife (world/nature.ts), attached before the scene mounts (game-mount.tsx) and drawn right after the ground,
 * whose mesh it grows on (Planet sets `controller.ground`). It imports only types from the main
 * bundle; the rest comes in the environment (world/grassEnv.ts; zones.ts says why).
 */

export interface GrassEnv extends GrassDrawEnv, Pick<GrassWorld, 'noise' | 'padDistance' | 'segmentDistance'> {
  R: number;
  plazaU: number;
  /** Is unit vector `n` within a mesa's footprint (whose cap covers the sphere there)? */
  underMesa(n: Vector3): boolean;
  /** The tuft sprites and their cells' opaque rects (null: no tufts). */
  tuftAtlas(): { map: Texture; rects: ReadonlyArray<readonly number[]> } | null;
  /** The summoning's wave (u/s): the grass sprouts behind it (progressive-loading.md §5.5). */
  waveSpeed: number;
}

/** Per tier: high on desktops, low on phones and weak GPUs. */
const TIERS: Record<'high' | 'low', GrassOptions> = {
  high: { seed: 7, bladesPerU2: 320, maxBlades: 140_000, flowersPerU2: 22, maxFlowers: 9_000, tuftsPerU2: 60, maxTufts: 8_000, cells: 8 },
  low: { seed: 7, bladesPerU2: 160, maxBlades: 70_000, flowersPerU2: 14, maxFlowers: 5_000, tuftsPerU2: 34, maxTufts: 4_000, cells: 8 },
};

const _inv = new Matrix4();
const _n = new Vector3();

/**
 * Dev and test builds only: `localStorage['game.test.grassDensity']` (0…1) thins the grass before it's
 * placed, so E2E tests that aren't about it run at a quarter of its cost under software rendering.
 */
function testDensity(): number {
  if (import.meta.env.MODE === 'production') return 1;
  try {
    const d = Number(localStorage.getItem('game.test.grassDensity') ?? 1);
    return d > 0 && d <= 1 ? d : 1;
  } catch {
    return 1;
  }
}

export function grassView(env: GrassEnv): ComponentType<{ controller: GameController }> {
  return function Grass({ controller }) {
    return <GrassField controller={controller} env={env} />;
  };
}

type Built = { draws: Array<{ kind: GrassKind; geometry: ReturnType<typeof templateGeometry>; material: ReturnType<typeof grassMaterial> }>; shared: GrassUniforms } | null;
const prepared = new WeakMap<GameController, Built>();

/**
 * Places the grass in slices of a frame's spare time before it mounts (the summoner runs it:
 * progressive-loading.md §5.7), so building it never blocks the planet. (A local runner, like
 * summoner.ts's: this chunk imports only types from the main bundle.)
 */
export async function prepareGrass(controller: GameController, env: GrassEnv): Promise<void> {
  if (prepared.has(controller)) return;
  const steps = buildGrass(controller, env);
  let t0 = performance.now();
  for (;;) {
    const r = steps.next();
    if (r.done) {
      prepared.set(controller, r.value);
      return;
    }
    // (all at once in tests, where the pops are off: software rendering's frames are slow)
    if (performance.now() - t0 > (controller.summoner.instant ? Infinity : 8)) {
      await new Promise<void>((res) => requestAnimationFrame(() => res()));
      t0 = performance.now();
    }
  }
}

/** The grass's build (the field placed on the ground, packed and drawn), as a resumable generator. */
function* buildGrass(controller: GameController, env: GrassEnv): Generator<void, Built> {
  const R = env.R;
  const quality = controller.store.getState().quality;
  const ground = controller.ground;
  if (!ground) return null;
  const t0 = performance.now();
  const pos = ground.getAttribute('position').array as Float32Array;
  const sphereTris: number = ground.userData.sphereTris ?? Infinity;
  const index = ground.getIndex()!.array;
  // the displaced sphere under a mesa is covered by the mesa's cap (which carries its own grass)
  const underMesa = (t: number) => {
    if (t >= sphereTris) return false;
    const i = index[t * 3];
    return env.underMesa(_n.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).normalize());
  };
  const mesh = {
    pos,
    color: ground.getAttribute('color').array as Float32Array,
    surf: ground.getAttribute('aSurf').array as Float32Array,
    surf2: ground.getAttribute('aSurf2').array as Float32Array,
    index,
    skip: underMesa,
  };
  const rules = grassRules({
    R,
    geos: controller.geos,
    layout: controller.props,
    pads: controller.terrain.pads,
    plazaU: env.plazaU,
    pondShore: (n) => controller.terrain.pondShore(n),
    noise: env.noise,
    padDistance: env.padDistance,
    segmentDistance: env.segmentDistance,
  });
  const tier = TIERS[quality === 'low' ? 'low' : 'high'];
  const thin = testDensity();
  const opt: GrassOptions = { ...tier, bladesPerU2: tier.bladesPerU2 * thin, maxBlades: Math.round(tier.maxBlades * thin), flowersPerU2: tier.flowersPerU2 * thin, maxFlowers: Math.round(tier.maxFlowers * thin), tuftsPerU2: tier.tuftsPerU2 * thin, maxTufts: Math.round(tier.maxTufts * thin) };
  const vg = yield* vertexGrassSteps(mesh, rules);
  const field = yield* placeGrassSteps(mesh, vg, opt);
  const shared: GrassUniforms = { movers: Array.from({ length: MOVERS }, () => new Vector4()), camLocal: new Vector3(), sprout: new Vector4(0, 1, 0, 1e6) };
  const atlas = env.tuftAtlas() ?? undefined;
  const draws: Array<{ kind: GrassKind; geometry: ReturnType<typeof templateGeometry>; material: ReturnType<typeof grassMaterial> }> = [];
  for (const kind of ['blade', 'flower', 'tuft'] as const) {
    const packed = kind === 'blade' ? field.blades : kind === 'flower' ? field.flowers : field.tufts;
    if (!packed.count || (kind === 'tuft' && !atlas)) continue;
    const tex = packTextures(packed);
    draws.push({ kind, geometry: templateGeometry(kind, packed.padded), material: grassMaterial(kind, tex, shared, R, env, kind === 'tuft' ? atlas : undefined) });
  }
  const ms = performance.now() - t0;
  const arc = (a: Vector3, b: Vector3) => Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * R;
  // the knee-high meadows' centres (for the test hook's visits): tufts ≥ 4 u apart
  const meadows: Vector3[] = [];
  const tr = field.tufts.root;
  for (let i = 0; i < field.tufts.count && meadows.length < 12; i += 7) {
    const q = new Vector3(tr[i * 3], tr[i * 3 + 1], tr[i * 3 + 2]).normalize();
    if (meadows.every((m) => arc(m, q) > 4)) meadows.push(q);
  }
  controller.grassMeadows = meadows;
  controller.grassStats = {
    blades: field.blades.count,
    flowers: field.flowers.count,
    tufts: field.tufts.count,
    triangles: field.blades.count * 3 + field.flowers.count * 7 + field.tufts.count * 2,
    draws: draws.length,
    density: thin,
    ms: Math.round(ms * 10) / 10,
  };
  return { draws, shared };
}

function GrassField({ controller, env }: { controller: GameController; env: GrassEnv }) {
  const R = env.R;
  const ref = useRef<Mesh>(null);
  const built = useMemo(() => {
    if (prepared.has(controller)) return prepared.get(controller) ?? null;
    const steps = buildGrass(controller, env);
    for (;;) {
      const r = steps.next();
      if (r.done) return r.value;
    }
  }, [controller, env]);
  const sprout = useRef<{ from: Vector3; at: number } | null>(null);

  useEffect(
    () => () => {
      for (const d of built?.draws ?? []) {
        d.geometry.dispose();
        d.material.dispose();
      }
    },
    [built],
  );

  useFrame(({ camera }) => {
    if (!built) return;
    const { movers, camLocal, sprout: sp } = built.shared;
    // summoned: it sprouts in a ripple outward from the character (progressive-loading.md §5.5)
    const summoner = controller.summoner;
    const at = summoner.revealed.get('grass');
    if (at !== undefined && sp.w < 1e5) {
      const st = controller.store.getState();
      sprout.current ??= { from: controller.sim.pLocal.clone(), at };
      const w = summoner.instant || st.reducedMotionSystem || st.reducedMotionUser ? 1e6 : ((performance.now() - at) / 1000) * env.waveSpeed;
      const f = sprout.current.from;
      sp.set(f.x, f.y, f.z, w > R * Math.PI + 2 ? 1e6 : w);
    }
    let k = 0;
    const put = (n: Vector3, r: number, scale = 1) => {
      if (k < MOVERS) movers[k++].set(n.x * scale, n.y * scale, n.z * scale, r);
    };
    // feet flatten the grass under them (so they stay visible) and part it round them
    put(controller.sim.pLocal, 0.42);
    put(controller.chopper.n, 0.34);
    for (const p of controller.home?.people ?? []) put(p.n, 0.38);
    // resting drops lie on flattened grass, never hidden in it
    const drops = controller.drops.list.filter((d) => d.state === 'rest');
    if (drops.length > MOVERS - k) {
      const feet = _n.copy(controller.sim.pLocal).multiplyScalar(R);
      drops.sort((a, b) => a.p.distanceToSquared(feet) - b.p.distanceToSquared(feet));
    }
    for (const d of drops) put(d.p, 0.3, 1 / Math.max(1e-6, d.p.length()));
    while (k < MOVERS) movers[k++].set(0, 1, 0, 0);
    const parent = ref.current?.parent;
    if (parent) camLocal.copy(camera.position).applyMatrix4(_inv.copy(parent.matrixWorld).invert());
  });

  if (!built) return null;
  return (
    <group name="grass">
      {built.draws.map((d, i) => (
        <mesh key={d.kind} ref={i === 0 ? ref : undefined} geometry={d.geometry} material={d.material} frustumCulled={false} receiveShadow name={`grass-${d.kind}`} />
      ))}
    </group>
  );
}
