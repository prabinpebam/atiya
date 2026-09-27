import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Quaternion,
  RGBADepthPacking,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { tangentToward } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { FLOWER_KINDS, type Pond, type PropInstance } from './layout';
import { kitMaterials, providePropMaterials } from './materials';
import { WIND_GLSL, windUniforms } from './windField';
import { cedar, flowerSprig, foliageMaterials, hardwood, leafyBush } from './foliage';
import { boulder, butterflyWing, flowerBlooms, flowerStems, pebble, reeds, rock, uprightCards } from './propModels';
import { pondPlants } from './pondPlants';
import { Fireflies } from './DayNight';
import { withStoneDetail, withSurfaceDetail } from './rockDetail';
import { withLampLights } from './lampLights';
import { gameTexture } from './textures';
import { propMatrix } from './propFrame';
import { BLOOM_COLOURS } from '../inventory/items';
import { CYCLES } from '../systems/actions';

const R = CONFIG.planetRadius;
const Y = new Vector3(0, 1, 0);

function writeInstances(mesh: InstancedMesh, items: readonly PropInstance[], colorFor?: (p: PropInstance) => Color, lift = -0.02) {
  const m = new Matrix4();
  const q = new Quaternion();
  const yaw = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  items.forEach((it, i) => {
    q.setFromUnitVectors(Y, it.n);
    yaw.setFromAxisAngle(Y, it.yaw);
    q.multiply(yaw);
    p.copy(it.n).multiplyScalar(R + (it.h ?? 0) + lift);
    s.setScalar(it.scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (colorFor) mesh.setColorAt(i, colorFor(it));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/**
 * Wind sway (ambient motion; frozen under reduced motion). Mutates `material`. Everything that
 * sways shares the wind uniforms, so the whole planet leans the same way and gusts travel across
 * it as waves. `flutter` adds a fast per-vertex rustle (leaf cards). Chains onto any shader patch
 * the material already has (e.g. the kit's surface detail on the tree trunks).
 */
function addSway(material: Material, strength: number, from: number, key: string, flutter = 0): void {
  const prev = material.onBeforeCompile.bind(material);
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 wIP = instanceMatrix[3].xyz;
  mat3 wIM = mat3(instanceMatrix);
#else
  vec3 wIP = vec3(0.0, 1.0, 0.0);
  mat3 wIM = mat3(1.0);
#endif
  vec3 wWP = windAt(wIP);
  float wExp = 0.35 + 0.65 * length(wWP);
  vec3 wWL = transpose(wIM) * wWP;
  vec2 wDir = normalize(wWL.xz + vec2(1e-5));
  float wPh = dot(wIP, vec3(0.7, 0.5, 0.9));
  // gust waves roll downwind across the planet
  float wWave = sin(uWindTime * 1.3 - dot(wIP, normalize(wWP + 1e-5)) * 0.45 + wPh * 0.25);
  float wK = max(0.0, transformed.y - ${from.toFixed(2)});
  float wAmp = ${strength.toFixed(3)} * wK * wK * wExp;
  float wLean = wAmp * uWindStrength * 0.9;
  float wSw = wAmp * (0.35 + uWindStrength) * (0.65 * wWave + 0.35 * sin(uWindTime * 2.7 + wPh));
  transformed.xz += wDir * (wLean + wSw) + vec2(-wDir.y, wDir.x) * wAmp * 0.2 * sin(uWindTime * 1.9 + wPh * 1.3);
  ${
    flutter > 0
      ? `transformed += objectNormal * sin(uWindTime * 9.0 + dot(position, vec3(9.1, 6.3, 7.7)) + wPh) * ${flutter.toFixed(3)} * (0.3 + uWindStrength) * min(1.0, wK);`
      : ''
  }`,
      );
  };
  material.customProgramCacheKey = () => `wind-${key}-${strength}-${from}-${flutter}|${prevKey()}`;
}

export function swayMaterial(base: Material, strength: number, from: number, key = 'solid'): Material {
  const material = (base as MeshStandardMaterial).clone();
  addSway(material, strength, from, key);
  return material;
}

/** All instances are always drawn (the scene is small; no culling means nothing ever pops in). */
function Instanced({
  geometry,
  material,
  items,
  colorFor,
  shadow = true,
  lift,
  depthMaterial,
  register,
}: {
  geometry: BufferGeometry;
  material: Material;
  items: readonly PropInstance[];
  colorFor?: (p: PropInstance) => Color;
  shadow?: boolean;
  lift?: number;
  /** Shadow-pass material (alpha-tested foliage casts leaf-shaped shadows). */
  depthMaterial?: Material;
  /** Receives the mesh (per-instance effects: wobble, shudder, regrowth). */
  register?: (mesh: InstancedMesh | null) => void;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (ref.current) writeInstances(ref.current, items, colorFor, lift);
    register?.(ref.current);
    return () => register?.(null);
  }, [items, colorFor, lift, register]);

  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={shadow}
      receiveShadow
      customDepthMaterial={depthMaterial}
    />
  );
}

const BLOOM_COLORS = BLOOM_COLOURS.map((c) => new Color(c.hex));
const vary = (p: PropInstance, amount = 0.14) => new Color(1, 1, 1).multiplyScalar(1 - amount / 2 + p.tint * amount);

function PondView({ controller, pond }: { controller: GameController; pond: Pond }) {
  const atlas = gameTexture('pond-atlas');
  const parts = useMemo(() => {
    if (!atlas) {
      // fallback (atlas missing): the simple modelled reeds (the water lilies are modelled anyway, drawn by the home)
      const q = new Quaternion().setFromUnitVectors(Y, pond.n);
      const tangent = new Vector3(1, 0, 0).applyQuaternion(q);
      const bitangent = new Vector3().crossVectors(pond.n, tangent);
      const at = (a: number, b: number) => pond.n.clone().addScaledVector(tangent, a / R).addScaledVector(bitangent, b / R).normalize();
      const reedItems: PropInstance[] = [0.4, 1.3, 2.2, 3.9, 4.6, 5.5].map((ang, i) => {
        const r = pond.radiusU + 0.08;
        return { n: at(Math.cos(ang) * r, Math.sin(ang) * r), scale: 0.9 + (i % 3) * 0.2, yaw: ang, tint: 0.5 };
      });
      return { fallback: { reedGeo: reeds(), reedItems } };
    }
    const plants = pondPlants(pond, controller.props.river, controller.terrain, controller.props.home);
    const cellUV = (i: number): [number, number, number, number] => [(i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) * 0.5, (i % 2) * 0.5 + 0.5, 1 - Math.floor(i / 2) * 0.5];
    const mat = new MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: DoubleSide, roughness: 0.8, metalness: 0 });
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: atlas, alphaTest: 0.5, side: DoubleSide });
    // reeds and irises rustle in the wind (the water lilies are modelled: home/lilies.ts, drawn by the home)
    addSway(mat, 0.32, 0.0, 'pond-plants', 0.01);
    addSway(depth, 0.32, 0.0, 'pond-plants-depth');
    return {
      plants,
      mat,
      depth,
      geo: {
        reeds: uprightCards(0.62, 0.95, cellUV(1), 3),
        irises: uprightCards(0.6, 0.68, cellUV(2), 2),
        ferns: uprightCards(0.7, 0.5, cellUV(3), 2, 0.9),
      },
    };
  }, [atlas, controller, pond]);
  if ('fallback' in parts && parts.fallback) {
    const fb = parts.fallback;
    return (
      <group name="pond">
        <Instanced geometry={fb.reedGeo} material={kitMaterials().solid} items={fb.reedItems} shadow={false} lift={-0.03} />
      </group>
    );
  }
  const { plants, mat, depth, geo } = parts as Exclude<typeof parts, { fallback: unknown }>;
  const tint = (p: PropInstance) => vary(p, 0.2);
  return (
    <group name="pond">
      <Instanced geometry={geo.reeds} material={mat} depthMaterial={depth} items={plants.reeds} colorFor={tint} lift={0} />
      <Instanced geometry={geo.irises} material={mat} depthMaterial={depth} items={plants.irises} colorFor={tint} lift={0} />
      <Instanced geometry={geo.ferns} material={mat} depthMaterial={depth} items={plants.ferns} colorFor={tint} shadow={false} lift={0} />
    </group>
  );
}

/** A few butterflies fluttering over flower clumps (ambient; hidden when ambient motion is paused). */
function Butterflies({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const refs = useRef<Array<{ root: Group | null; l: Group | null; r: Group | null }>>([]);
  const t = useRef(0);
  const { wing, spots, mats } = useMemo(() => {
    const kinds = controller.props.flowers;
    const picks = [kinds.cosmos[0], kinds.tulip[0], kinds.pansy[0], kinds.cosmos[kinds.cosmos.length - 1]].filter(Boolean);
    const colors = ['#ffd84d', '#ffffff', '#8fc6ff', '#ffb3d1'];
    return {
      wing: butterflyWing(),
      spots: picks.map((p, i) => {
        const tangent = (tangentToward(p.n, Y) ?? new Vector3(1, 0, 0)).clone();
        return { n: p.n, h: p.h ?? 0, tangent, bitangent: new Vector3().crossVectors(p.n, tangent), phase: i * 1.7 };
      }),
      mats: colors.map((c) => {
        const m = (kitMaterials().solid as MeshStandardMaterial).clone();
        m.color.set(c);
        m.side = DoubleSide;
        return m;
      }),
    };
  }, [controller]);

  useFrame((_, dt) => {
    if (paused) return;
    t.current += dt;
    // butterflies go to sleep at night (fireflies take over)
    const awake = controller.sky.night < 0.5;
    spots.forEach((s, i) => {
      const r = refs.current[i];
      if (!r?.root) return;
      r.root.visible = awake;
      if (!awake) return;
      const tt = t.current * 0.6 + s.phase;
      const a = Math.sin(tt) * 0.55;
      const b = Math.sin(tt * 2) * 0.3;
      const h = 0.45 + Math.sin(tt * 3.1) * 0.12;
      const n = s.n.clone().addScaledVector(s.tangent, a / R).addScaledVector(s.bitangent, b / R).normalize();
      r.root.position.copy(n).multiplyScalar(R + s.h + h);
      r.root.quaternion.setFromUnitVectors(Y, n);
      r.root.rotateY(tt * 0.8);
      const flap = Math.sin(t.current * 16 + s.phase) * 0.9;
      if (r.l) r.l.rotation.z = flap;
      if (r.r) r.r.rotation.z = -flap;
    });
  });

  if (paused) return null;
  return (
    <group name="butterflies">
      {spots.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = { ...(refs.current[i] ?? { l: null, r: null }), root: el };
          }}
        >
          <mesh position={[0, 0, 0]} material={mats[i]}>
            <capsuleGeometry args={[0.012, 0.06, 2, 6]} />
          </mesh>
          <group
            ref={(el) => {
              refs.current[i] = { ...(refs.current[i] ?? { root: null, r: null }), l: el };
            }}
          >
            <mesh geometry={wing} material={mats[i]} />
          </group>
          <group
            ref={(el) => {
              refs.current[i] = { ...(refs.current[i] ?? { root: null, l: null }), r: el };
            }}
            scale={[-1, 1, 1]}
          >
            <mesh geometry={wing} material={mats[i]} />
          </group>
        </group>
      ))}
    </group>
  );
}

const _fx = new Matrix4();

/** Which instanced meshes (and which instance in them) draw tree `kind` #`i` of its layout list. */
function treeInstances(kind: string, i: number): { keys: string[]; inst: number } {
  if (kind === 'apple') return { keys: ['apple:solid', 'apple:leaves', 'apple:fruit'], inst: i / 2 };
  if (kind === 'orange') return { keys: ['orange:solid', 'orange:leaves', 'orange:fruit'], inst: (i - 1) / 2 };
  if (kind === 'cedar') return { keys: [`cedar${i % 3}:solid`, `cedar${i % 3}:leaves`], inst: Math.floor(i / 3) };
  return { keys: ['hardwood:solid', 'hardwood:leaves'], inst: i };
}

/**
 * Per-instance effects on the props: a shaken tree rocks on its base (a decaying wobble), a mined
 * boulder shudders on each hit, and shaken fruit and picked flowers vanish and pop back as they regrow.
 */
function useHarvestFx(controller: GameController, apples: readonly PropInstance[], oranges: readonly PropInstance[]) {
  const meshes = useRef(new Map<string, InstancedMesh>());
  const regs = useRef(new Map<string, (m: InstancedMesh | null) => void>());
  const reg = useCallback((key: string) => {
    let f = regs.current.get(key);
    if (!f) {
      f = (m: InstancedMesh | null) => {
        if (m) meshes.current.set(key, m);
        else meshes.current.delete(key);
      };
      regs.current.set(key, f);
    }
    return f;
  }, []);
  const st = useRef({ shake: null as null | { kind: string; i: number; t: number }, hits: 0, hitT: 9, boulder: -1, harvest: -1, fruitScale: new Map<string, number>(), flowerScale: new Map<string, number>() });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const m = meshes.current;
    const a = controller.action;
    const layout = controller.props;
    const harvest = controller.harvest;
    const R = CONFIG.planetRadius;
    const calm = selectAmbientPaused(controller.store.getState());
    const touched = new Set<InstancedMesh>();
    const put = (key: string, inst: number, it: PropInstance, lift: number | undefined, tiltX = 0, tiltZ = 0, k = 1) => {
      const mesh = m.get(key);
      if (!mesh || inst < 0 || inst >= mesh.count) return;
      mesh.setMatrixAt(inst, propMatrix(it, R, lift ?? -0.02, _fx, tiltX, tiltZ, k));
      touched.add(mesh);
    };
    const treeItem = (kind: string, i: number) => (kind === 'cedar' ? layout.cedar[i] : kind === 'hardwood' ? layout.hardwood[i] : layout.fruit[i]);

    // regrowth: shaken fruit and picked flowers (rewritten when something changes, animated while popping)
    if (harvest.version !== s.harvest || harvest.popping) {
      s.harvest = harvest.version;
      const fruitSets = [
        ['apple', apples, 0],
        ['orange', oranges, 1],
      ] as const;
      for (const [kind, list, off] of fruitSets) {
        list.forEach((it, j) => {
          const i = 2 * j + off;
          const k = harvest.fruitScale(kind, i);
          const key = `${kind}:${i}`;
          if ((s.fruitScale.get(key) ?? 1) === k) return;
          s.fruitScale.set(key, k);
          put(`${kind}:fruit`, j, it, undefined, 0, 0, k);
        });
      }
      for (const kind of FLOWER_KINDS) {
        layout.flowers[kind].forEach((it, i) => {
          const k = harvest.flowerScale(kind, i);
          const key = `${kind}:${i}`;
          if ((s.flowerScale.get(key) ?? 1) === k) return;
          s.flowerScale.set(key, k);
          put(`${kind}:stems`, i, it, undefined, 0, 0, k);
          put(`${kind}:blooms`, i, it, undefined, 0, 0, k);
        });
      }
    }

    // a shaken tree rocks on its base while the character shakes it, then settles
    if (a.kind === 'shake' && a.target?.tree && (!s.shake || s.shake.kind !== a.target.tree || s.shake.i !== a.target.index)) {
      s.shake = { kind: a.target.tree, i: a.target.index, t: a.t };
    }
    if (s.shake) {
      const sh = s.shake;
      sh.t += dt;
      const start = CYCLES.shake.approach + 0.1;
      const t = sh.t - start;
      const end = CYCLES.shake.duration - CYCLES.shake.retreat - start;
      const amp = (calm ? 0.02 : 0.055) * (t < 0 ? 0 : t < end ? Math.min(1, t / 0.12) : Math.exp(-(t - end) * 5));
      const w = amp * Math.sin(Math.max(0, t) * Math.PI * 2 * 2.7);
      const done = t > end + 0.9;
      const it = treeItem(sh.kind, sh.i);
      if (it) {
        const { keys, inst } = treeInstances(sh.kind, sh.i);
        const fruitK = sh.kind === 'apple' || sh.kind === 'orange' ? harvest.fruitScale(sh.kind, sh.i) : 1;
        for (const key of keys) put(key, inst, it, undefined, done ? 0 : w, done ? 0 : w * 0.5, key.endsWith(':fruit') ? fruitK : 1);
      }
      if (done) s.shake = null;
    }

    // a mined boulder shudders on each hit
    if (controller.mineHits !== s.hits) {
      s.hits = controller.mineHits;
      s.hitT = 0;
      s.boulder = a.target?.kind === 'boulder' ? a.target.index : s.boulder;
    }
    if (s.boulder >= 0 && s.hitT < 0.3) {
      s.hitT += dt;
      const k = Math.max(0, 1 - s.hitT / 0.25);
      const it = layout.boulders[s.boulder];
      if (it) put('boulder', s.boulder, it, undefined, (calm ? 0.004 : 0.025) * Math.sin(s.hitT * 75) * k, 0, 1 - 0.025 * k);
    }

    for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
  });
  return { reg };
}

/** The props' shared materials (the trees', bushes', flowers' and rocks'), made once: the crafting chunk's old oak uses the same (swing.md §4.3). */
let propMats: ReturnType<typeof makePropMaterials> | null = null;
export const propMaterials = () => (propMats ??= makePropMaterials());
export type PropMaterials = ReturnType<typeof propMaterials>;
providePropMaterials(propMaterials);

function makePropMaterials() {
  const base = kitMaterials().solid;
  const broad = foliageMaterials('broad');
  const needle = foliageMaterials('needle');
  const broadBush = foliageMaterials('broad');
  // leaves share the trunk's sway (so canopy and core move together) plus a leafy rustle;
  // the shadow-pass materials sway too, so leaf shadows dance with the wind
  addSway(broad.material, 0.016, 1.2, 'broad', 0.02);
  addSway(needle.material, 0.016, 1.2, 'needle', 0.012);
  addSway(broadBush.material, 0.06, 0.1, 'broad-bush', 0.018);
  addSway(broad.depth, 0.016, 1.2, 'broad-depth');
  addSway(needle.depth, 0.016, 1.2, 'needle-depth');
  addSway(broadBush.depth, 0.06, 0.1, 'broad-bush-depth');
  // trunks keep the kit's surface detail (the painted bark tile) under the sway
  const tree = withSurfaceDetail((base as MeshStandardMaterial).clone(), 0.36, 1.1);
  addSway(tree, 0.016, 1.2, 'tree');
  // the ground-level props near lamps also receive the lamplight (the leaf cards don't need it)
  return {
    tree: withLampLights(tree),
    bush: withLampLights(swayMaterial(base, 0.06, 0.1, 'bush')),
    flower: withLampLights(swayMaterial(base, 0.55, 0.0, 'flower')),
    // painted stone grain (object-space, luminance only, so tints keep their colour) + shader moss
    rock: withLampLights(withStoneDetail((base as MeshStandardMaterial).clone(), 0.7, 1.4)),
    broad,
    needle,
    broadBush,
  };
}

export function Props({ controller }: { controller: GameController }) {
  const layout = controller.props;
  const geo = useMemo(
    () => ({
      hardwood: hardwood(),
      apple: hardwood('#e8453c'),
      orange: hardwood('#ff9a2e'),
      cedars: [cedar(0), cedar(1), cedar(2)],
      bush: leafyBush(),
      flowerBush: leafyBush('#ff7fa8'),
      sprigs: [flowerSprig('#fff6e8'), flowerSprig('#ffd84d', '#f59b2a')],
      rock: rock(),
      boulder: boulder(),
      pebble: pebble(),
      stems: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerStems(k)])),
      blooms: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerBlooms(k)])),
    }),
    [],
  );
  const mats = useMemo(propMaterials, []);

  const apples = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 0), [layout]);
  // daisy-white sprigs outnumber the yellow ones, as in the art direction
  const sprigSets = useMemo(() => [layout.sprigs.filter((p) => p.tint < 0.62), layout.sprigs.filter((p) => p.tint >= 0.62)], [layout]);
  const oranges = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 1), [layout]);
  const bloomColor = useMemo(() => (p: PropInstance) => BLOOM_COLORS[Math.floor(p.tint * BLOOM_COLORS.length) % BLOOM_COLORS.length], []);
  const tint = useMemo(() => (p: PropInstance) => vary(p), []);
  const fx = useHarvestFx(controller, apples, oranges);

  return (
    <group name="props">
      {(
        [
          ['hardwood', geo.hardwood, layout.hardwood],
          ['apple', geo.apple, apples],
          ['orange', geo.orange, oranges],
        ] as const
      ).map(([key, g, items]) => (
        <group key={key}>
          <Instanced geometry={g.solid} material={mats.tree} items={items} colorFor={tint} register={fx.reg(`${key}:solid`)} />
          <Instanced geometry={g.leaves} material={mats.broad.material} depthMaterial={mats.broad.depth} items={items} colorFor={tint} register={fx.reg(`${key}:leaves`)} />
          {g.fruit && <Instanced geometry={g.fruit} material={mats.tree} items={items} colorFor={tint} register={fx.reg(`${key}:fruit`)} />}
        </group>
      ))}
      {geo.cedars.map((g, v) => {
        const items = layout.cedar.filter((_, i) => i % geo.cedars.length === v);
        return (
          <group key={`cedar-${v}`}>
            <Instanced geometry={g.solid} material={mats.tree} items={items} colorFor={tint} register={fx.reg(`cedar${v}:solid`)} />
            <Instanced geometry={g.leaves} material={mats.needle.material} depthMaterial={mats.needle.depth} items={items} colorFor={tint} register={fx.reg(`cedar${v}:leaves`)} />
          </group>
        );
      })}
      <Instanced geometry={geo.bush.solid} material={mats.bush} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.bush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.solid} material={mats.bush} items={layout.flowerBushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.flowerBushes} colorFor={tint} />
      {geo.sprigs.map((g, v) => (
        <group key={`sprig-${v}`}>
          {/* too low to cast a shadow worth its shadow-pass cost */}
          <Instanced geometry={g.solid} material={mats.flower} items={sprigSets[v]} colorFor={tint} shadow={false} />
          <Instanced geometry={g.leaves} material={mats.broadBush.material} items={sprigSets[v]} colorFor={tint} shadow={false} />
        </group>
      ))}
      <Instanced geometry={geo.rock} material={mats.rock} items={layout.rocks} colorFor={tint} />
      <Instanced geometry={geo.boulder} material={mats.rock} items={layout.boulders} colorFor={tint} register={fx.reg('boulder')} />
      <Instanced geometry={geo.pebble} material={mats.rock} items={layout.pebbles} colorFor={tint} shadow={false} lift={-0.03} />
      {FLOWER_KINDS.map((k) => (
        <group key={k}>
          <Instanced geometry={geo.stems[k]} material={mats.flower} items={layout.flowers[k]} shadow={false} register={fx.reg(`${k}:stems`)} />
          <Instanced geometry={geo.blooms[k]} material={mats.flower} items={layout.flowers[k]} colorFor={bloomColor} shadow={false} register={fx.reg(`${k}:blooms`)} />
        </group>
      ))}
      {layout.pond && <PondView controller={controller} pond={layout.pond} />}
      <Butterflies controller={controller} />
      <Fireflies controller={controller} />
    </group>
  );
}
