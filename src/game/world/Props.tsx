import { useLayoutEffect, useMemo, useRef } from 'react';
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
import { kitMaterials } from './materials';
import { WIND_GLSL, windUniforms } from './windField';
import { cedar, foliageMaterials, hardwood, leafyBush } from './foliage';
import { boulder, butterflyWing, flatCard, flowerBlooms, flowerStems, grassCards, grassTuft, lilyPad, pebble, reeds, rock, uprightCards } from './propModels';
import { pondPlants } from './pondPlants';
import { RIVER_WATER_U } from './terrain';
import { Fireflies } from './DayNight';
import { withRockDetail } from './rockDetail';
import { gameTexture } from './textures';

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
 * it as waves. `flutter` adds a fast per-vertex rustle (leaf cards).
 */
function addSway(material: Material, strength: number, from: number, key: string, flutter = 0): void {
  material.onBeforeCompile = (shader) => {
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
  material.customProgramCacheKey = () => `wind-${key}-${strength}-${from}-${flutter}`;
}

function swayMaterial(base: Material, strength: number, from: number, key = 'solid'): Material {
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
}: {
  geometry: BufferGeometry;
  material: Material;
  items: readonly PropInstance[];
  colorFor?: (p: PropInstance) => Color;
  shadow?: boolean;
  lift?: number;
  /** Shadow-pass material (alpha-tested foliage casts leaf-shaped shadows). */
  depthMaterial?: Material;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (ref.current) writeInstances(ref.current, items, colorFor, lift);
  }, [items, colorFor, lift]);

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

const BLOOM_COLORS = ['#ff5a6a', '#ff9ec4', '#ffd84d', '#ffffff', '#ff9a4d', '#a98cff', '#7fb2ff'].map((c) => new Color(c));
const vary = (p: PropInstance, amount = 0.14) => new Color(1, 1, 1).multiplyScalar(1 - amount / 2 + p.tint * amount);

function PondView({ controller, pond }: { controller: GameController; pond: Pond }) {
  const atlas = gameTexture('pond-atlas');
  const parts = useMemo(() => {
    if (!atlas) {
      // fallback (atlas missing): the simple modelled lily pads and reeds
      const q = new Quaternion().setFromUnitVectors(Y, pond.n);
      const tangent = new Vector3(1, 0, 0).applyQuaternion(q);
      const bitangent = new Vector3().crossVectors(pond.n, tangent);
      const at = (a: number, b: number) => pond.n.clone().addScaledVector(tangent, a / R).addScaledVector(bitangent, b / R).normalize();
      const padItems: PropInstance[] = [
        [0.35, 0.2],
        [-0.4, 0.3],
        [0.1, -0.45],
      ].map(([a, b], i) => ({ n: at(a * pond.radiusU, b * pond.radiusU), scale: 0.9 + i * 0.15, yaw: i * 2.1, tint: 0.5, h: RIVER_WATER_U + 0.05 }));
      const reedItems: PropInstance[] = [0.4, 1.3, 2.2, 3.9, 4.6, 5.5].map((ang, i) => {
        const r = pond.radiusU + 0.08;
        return { n: at(Math.cos(ang) * r, Math.sin(ang) * r), scale: 0.9 + (i % 3) * 0.2, yaw: ang, tint: 0.5 };
      });
      return { fallback: { pads: lilyPad(), padItems, reedGeo: reeds(), reedItems } };
    }
    const plants = pondPlants(pond, controller.props.river, controller.terrain);
    const cellUV = (i: number): [number, number, number, number] => [(i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) * 0.5, (i % 2) * 0.5 + 0.5, 1 - Math.floor(i / 2) * 0.5];
    const mat = new MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: DoubleSide, roughness: 0.8, metalness: 0 });
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: atlas, alphaTest: 0.5, side: DoubleSide });
    // reeds and irises rustle in the wind (lily pads sit at y = 0, so they don't sway)
    addSway(mat, 0.32, 0.0, 'pond-plants', 0.01);
    addSway(depth, 0.32, 0.0, 'pond-plants-depth');
    return {
      plants,
      mat,
      depth,
      geo: {
        lilies: flatCard(0.9, cellUV(0)),
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
        <Instanced geometry={fb.pads} material={kitMaterials().solid} items={fb.padItems} shadow={false} lift={0} />
        <Instanced geometry={fb.reedGeo} material={kitMaterials().solid} items={fb.reedItems} shadow={false} lift={-0.03} />
      </group>
    );
  }
  const { plants, mat, depth, geo } = parts as Exclude<typeof parts, { fallback: unknown }>;
  const tint = (p: PropInstance) => vary(p, 0.2);
  return (
    <group name="pond">
      <Instanced geometry={geo.lilies} material={mat} items={plants.lilies} shadow={false} colorFor={tint} lift={0} />
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
      rock: rock(),
      boulder: boulder(),
      pebble: pebble(),
      grass: gameTexture('grass-card') ? grassCards() : grassTuft(),
      stems: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerStems(k)])),
      blooms: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerBlooms(k)])),
    }),
    [],
  );
  const mats = useMemo(() => {
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
    const grassCard = gameTexture('grass-card');
    let grass: Material;
    if (grassCard) {
      grass = new MeshStandardMaterial({ vertexColors: true, map: grassCard, alphaTest: 0.5, side: DoubleSide, roughness: 0.9, metalness: 0 });
      addSway(grass, 0.9, 0.0, 'grass-card');
    } else {
      grass = swayMaterial(base, 0.9, 0.0, 'grass');
    }
    return {
      tree: swayMaterial(base, 0.016, 1.2, 'tree'),
      bush: swayMaterial(base, 0.06, 0.1, 'bush'),
      grass,
      flower: swayMaterial(base, 0.55, 0.0, 'flower'),
      // painted rock detail (object-space, luminance only, so moss and tints keep their colour)
      rock: withRockDetail((base as MeshStandardMaterial).clone(), 'object', 0.7, 1.7),
      broad,
      needle,
      broadBush,
    };
  }, []);

  const apples = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 0), [layout]);
  const oranges = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 1), [layout]);
  const bloomColor = useMemo(() => (p: PropInstance) => BLOOM_COLORS[Math.floor(p.tint * BLOOM_COLORS.length) % BLOOM_COLORS.length], []);
  const tint = useMemo(() => (p: PropInstance) => vary(p), []);

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
          <Instanced geometry={g.solid} material={mats.tree} items={items} colorFor={tint} />
          <Instanced geometry={g.leaves} material={mats.broad.material} depthMaterial={mats.broad.depth} items={items} colorFor={tint} />
        </group>
      ))}
      {geo.cedars.map((g, v) => {
        const items = layout.cedar.filter((_, i) => i % geo.cedars.length === v);
        return (
          <group key={`cedar-${v}`}>
            <Instanced geometry={g.solid} material={mats.tree} items={items} colorFor={tint} />
            <Instanced geometry={g.leaves} material={mats.needle.material} depthMaterial={mats.needle.depth} items={items} colorFor={tint} />
          </group>
        );
      })}
      <Instanced geometry={geo.bush.solid} material={mats.bush} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.bush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.solid} material={mats.bush} items={layout.flowerBushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.flowerBushes} colorFor={tint} />
      <Instanced geometry={geo.rock} material={mats.rock} items={layout.rocks} colorFor={tint} />
      <Instanced geometry={geo.boulder} material={mats.rock} items={layout.boulders} colorFor={tint} />
      <Instanced geometry={geo.pebble} material={mats.rock} items={layout.pebbles} colorFor={tint} shadow={false} lift={-0.03} />
      <Instanced geometry={geo.grass} material={mats.grass} items={layout.grass} colorFor={tint} shadow={false} />
      {FLOWER_KINDS.map((k) => (
        <group key={k}>
          <Instanced geometry={geo.stems[k]} material={mats.flower} items={layout.flowers[k]} shadow={false} />
          <Instanced geometry={geo.blooms[k]} material={mats.flower} items={layout.flowers[k]} colorFor={bloomColor} shadow={false} />
        </group>
      ))}
      {layout.pond && <PondView controller={controller} pond={layout.pond} />}
      <Butterflies controller={controller} />
      <Fireflies controller={controller} />
    </group>
  );
}
