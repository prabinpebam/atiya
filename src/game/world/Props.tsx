import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { tangentToward } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { FLOWER_KINDS, type Pond, type PropInstance } from './layout';
import { kitMaterials, registerDaylit } from './materials';
import { cedar, foliageMaterials, hardwood, leafyBush } from './foliage';
import { butterflyWing, flowerBlooms, flowerStems, grassTuft, lilyPad, reeds, rock } from './propModels';
import { Fireflies } from './DayNight';

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
    p.copy(it.n).multiplyScalar(R + lift);
    s.setScalar(it.scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (colorFor) mesh.setColorAt(i, colorFor(it));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Wind sway (ambient motion; paused under reduced motion). Mutates `material`, sharing `uniform`. */
function addSway(material: Material, strength: number, from: number, uniform: { value: number }, key: string): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9 + instanceMatrix[3].y * 0.5;
#else
  float ph = 0.0;
#endif
  float k = max(0.0, transformed.y - ${from.toFixed(2)});
  float sw = sin(uTime * 1.4 + ph) * ${strength.toFixed(3)} * k * k;
  transformed.x += sw;
  transformed.z += sw * 0.6;`,
      );
  };
  material.customProgramCacheKey = () => `sway-${key}-${strength}-${from}`;
}

function swayMaterial(base: Material, strength: number, from: number): { material: Material; uniform: { value: number } } {
  const material = (base as MeshStandardMaterial).clone();
  const uniform = { value: 0 };
  addSway(material, strength, from, uniform, 'solid');
  return { material, uniform };
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

function PondView({ pond }: { pond: Pond }) {
  const { water, rim, pads, padItems, reedGeo, reedItems } = useMemo(() => {
    const cap = pond.radiusU / R;
    const waterGeo = new SphereGeometry(R - 0.06, 48, 6, 0, Math.PI * 2, 0, cap);
    const rimGeo = new SphereGeometry(R - 0.04, 48, 1, 0, Math.PI * 2, cap - 0.012, 0.018);
    const q = new Quaternion().setFromUnitVectors(Y, pond.n);
    waterGeo.applyQuaternion(q);
    rimGeo.applyQuaternion(q);
    const tangent = new Vector3(1, 0, 0).applyQuaternion(q);
    const bitangent = new Vector3().crossVectors(pond.n, tangent);
    const at = (a: number, b: number) => pond.n.clone().addScaledVector(tangent, a / R).addScaledVector(bitangent, b / R).normalize();
    const items: PropInstance[] = [
      [0.35, 0.2],
      [-0.4, 0.3],
      [0.1, -0.45],
    ].map(([a, b], i) => ({ n: at(a * pond.radiusU, b * pond.radiusU), scale: 0.9 + i * 0.15, yaw: i * 2.1, tint: 0.5 }));
    const reedsAt: PropInstance[] = [0.4, 1.3, 2.2, 3.9, 4.6, 5.5].map((ang, i) => {
      const r = pond.radiusU + 0.08;
      return { n: at(Math.cos(ang) * r, Math.sin(ang) * r), scale: 0.9 + (i % 3) * 0.2, yaw: ang, tint: 0.5 };
    });
    return { water: waterGeo, rim: rimGeo, pads: lilyPad(), padItems: items, reedGeo: reeds(), reedItems: reedsAt };
  }, [pond]);
  const waterMat = useMemo(
    () =>
      registerDaylit(
        new MeshStandardMaterial({ color: '#4fc0e6', emissive: '#1d7fa6', emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92 }),
      ),
    [],
  );
  const rimMat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, side: DoubleSide, transparent: true, opacity: 0.8 }), []);
  return (
    <group name="pond">
      <mesh geometry={water} material={waterMat} receiveShadow />
      <mesh geometry={rim} material={rimMat} />
      <Instanced geometry={pads} material={kitMaterials().solid} items={padItems} shadow={false} lift={-0.05} />
      <Instanced geometry={reedGeo} material={kitMaterials().solid} items={reedItems} shadow={false} lift={-0.03} />
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
        return { n: p.n, tangent, bitangent: new Vector3().crossVectors(p.n, tangent), phase: i * 1.7 };
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
      r.root.position.copy(n).multiplyScalar(R + h);
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
  const paused = useStore(controller.store, selectAmbientPaused);
  const geo = useMemo(
    () => ({
      hardwood: hardwood(),
      apple: hardwood('#e8453c'),
      orange: hardwood('#ff9a2e'),
      cedar: cedar(),
      bush: leafyBush(),
      flowerBush: leafyBush('#ff7fa8'),
      rock: rock(),
      grass: grassTuft(),
      stems: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerStems(k)])),
      blooms: Object.fromEntries(FLOWER_KINDS.map((k) => [k, flowerBlooms(k)])),
    }),
    [],
  );
  const mats = useMemo(() => {
    const base = kitMaterials().solid;
    const tree = swayMaterial(base, 0.016, 1.2);
    const bush = swayMaterial(base, 0.06, 0.1);
    const broad = foliageMaterials('broad');
    const needle = foliageMaterials('needle');
    const broadBush = foliageMaterials('broad');
    // foliage shares the solid parts' wind so leaves and core move together
    addSway(broad.material, 0.016, 1.2, tree.uniform, 'broad');
    addSway(needle.material, 0.016, 1.2, tree.uniform, 'needle');
    addSway(broadBush.material, 0.06, 0.1, bush.uniform, 'broad-bush');
    return { tree, bush, broad, needle, broadBush, grass: swayMaterial(base, 0.9, 0.0) };
  }, []);
  useFrame((_, dt) => {
    if (paused) return;
    mats.tree.uniform.value += dt;
    mats.bush.uniform.value += dt;
    mats.grass.uniform.value += dt;
  });

  const apples = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 0), [layout]);
  const oranges = useMemo(() => layout.fruit.filter((_, i) => i % 2 === 1), [layout]);
  const bloomColor = useMemo(() => (p: PropInstance) => BLOOM_COLORS[Math.floor(p.tint * BLOOM_COLORS.length) % BLOOM_COLORS.length], []);
  const tint = useMemo(() => (p: PropInstance) => vary(p), []);
  const solidMat = kitMaterials().solid;

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
          <Instanced geometry={g.solid} material={mats.tree.material} items={items} colorFor={tint} />
          <Instanced geometry={g.leaves} material={mats.broad.material} depthMaterial={mats.broad.depth} items={items} colorFor={tint} />
        </group>
      ))}
      <Instanced geometry={geo.cedar.solid} material={mats.tree.material} items={layout.cedar} colorFor={tint} />
      <Instanced geometry={geo.cedar.leaves} material={mats.needle.material} depthMaterial={mats.needle.depth} items={layout.cedar} colorFor={tint} />
      <Instanced geometry={geo.bush.solid} material={mats.bush.material} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.bush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.bushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.solid} material={mats.bush.material} items={layout.flowerBushes} colorFor={tint} />
      <Instanced geometry={geo.flowerBush.leaves} material={mats.broadBush.material} depthMaterial={mats.broadBush.depth} items={layout.flowerBushes} colorFor={tint} />
      <Instanced geometry={geo.rock} material={solidMat} items={layout.rocks} colorFor={tint} />
      <Instanced geometry={geo.grass} material={mats.grass.material} items={layout.grass} colorFor={tint} shadow={false} />
      {FLOWER_KINDS.map((k) => (
        <group key={k}>
          <Instanced geometry={geo.stems[k]} material={solidMat} items={layout.flowers[k]} shadow={false} />
          <Instanced geometry={geo.blooms[k]} material={solidMat} items={layout.flowers[k]} colorFor={bloomColor} shadow={false} />
        </group>
      ))}
      {layout.pond && <PondView pond={layout.pond} />}
      <Butterflies controller={controller} />
      <Fireflies controller={controller} />
    </group>
  );
}
