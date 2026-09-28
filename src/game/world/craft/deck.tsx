/**
 * The viewing deck on the cliff near the home (docs: viewing-deck.md), in the crafting chunk: its
 * three builds (the steps up the lower cliff, the upper steps, the platform), each a site with a
 * ghost, a card and a target like the swing's; what a build changes (the cliff's obstacles, the walk
 * surfaces, the route planner's corridors, the family's seat); the bench you sit on; and the iron ore
 * on the boulders that carry it.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Color, DoubleSide, EdgesGeometry, Group, InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { faBinoculars, faStairs } from '@fortawesome/free-solid-svg-icons';
import { CONFIG } from '../../config';
import type { DeckState, GameController } from '../../controller';
import { arcDistance, clamp, type Obstacle } from '../../math/sphere';
import { selectReducedMotion } from '../../state/store';
import type { Target } from '../../systems/interactables';
import type { Seat } from '../../systems/seating';
import { KitModel } from '../KitModel';
import { DECK } from '../deckSpec';
import { BENCH } from '../parts';
import { BUILD_S, DECK_NEEDS, TARGET_REACH, listNeeds, missing, takeNeeds } from './recipes';
import { deckCorridors, deckObstacles, deckPlan, deckSurface, type DeckPlan, type Stage } from './deckPlan';
import { deckStageModel, ironNuggets } from './deckModels';
import { bonsaiModel } from './bonsaiModel';
import { deckDressing, type DeckDressing } from './deckDressing';
import { sharedPropMaterials } from '../materials';
import type { PropMaterials } from '../Props';
import type { CraftStore } from './index';

const KEY = 'site.deck';
const R = CONFIG.planetRadius;
/** The ghost of the next build: faint from this far (u), clear this close (it's a big one, seen from further than a doghouse). */
export const DECK_GHOST = { far: 10, near: 3 } as const;
const KNOCKS = [0.15, 0.5, 0.85, 1.2, 1.6];

/** Each build's prompt, toast, card and announcement (viewing-deck.md §4.4). */
export const DECK_STAGES = [
  {
    see: 'See what the steps need',
    build: 'Build the steps',
    what: 'The steps',
    built: 'You build the steps up the cliff! From the terrace, the upper steps can go up next.',
  },
  {
    see: 'See what the upper steps need',
    build: 'Build the upper steps',
    what: 'The upper steps',
    built: 'You build the upper steps! The top of the cliff is ready for its deck.',
  },
  {
    see: 'See what the deck needs',
    build: 'Build the deck',
    what: 'The viewing deck',
    built: 'You build the viewing deck! Sit on its bench and enjoy the view.',
  },
] as const;

function loadStage(): number {
  try {
    const v = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as { stage?: unknown } | null)?.stage;
    return typeof v === 'number' && Number.isInteger(v) ? clamp(v, 0, 3) : 0;
  } catch {
    return 0;
  }
}

function saveStage(stage: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ stage }));
  } catch {
    // private mode: it just won't be remembered
  }
}

export interface DeckAttachment {
  plan: DeckPlan;
  /** The planting round the cliff and the old pine (viewing-deck.md §4.6). */
  dressing: DeckDressing | null;
  View: () => ReactElement;
  /** Which build's card is up (1–3), from the target E would use; null for none. */
  near(key: string | undefined): 1 | 2 | 3 | null;
  step(dt: number): void;
  state(): DeckState;
}

export function attachDeck(controller: GameController, store: CraftStore): DeckAttachment | null {
  const site = controller.props.deck;
  if (!site) return null;
  const ground = (n: Vector3) => controller.terrain.height(n);
  const plan = deckPlan(site, ground, R);
  const m = site.mesa;
  // the planting round the cliff joins the props before they're drawn; its bushes and the pine block
  const dressing = deckDressing(controller.props, controller.geos, R, ground, (n) => controller.terrain.inWater(n));
  if (dressing) {
    const p = controller.props;
    p.bushes.push(...dressing.bushes);
    p.flowerBushes.push(...dressing.flowerBushes);
    p.sprigs.push(...dressing.sprigs);
    for (const k of Object.keys(dressing.flowers) as (keyof typeof p.flowers)[]) p.flowers[k].push(...dressing.flowers[k]);
    controller.replaceObstacles(() => false, dressing.obstacles);
  }
  const inv = controller.inventory;
  // the cliff's own obstacles as laid out (one big block and its rim), swapped out once the steps are up
  const plain = controller.staticObstacles.filter((o) => o.mesa && arcDistance(o.n, m.n, R) < m.radiusU + 0.6);
  let current = new Set<Obstacle>(plain);
  let surface: (() => void) | null = null;
  const apply = (stage: number) => {
    controller.navOpen = deckCorridors(plan, stage);
    const add = deckObstacles(plan, stage, R, plain);
    const old = current;
    controller.replaceObstacles((o) => old.has(o), add);
    current = new Set(add);
    surface?.();
    surface = stage > 0 ? controller.terrain.addSurface(deckSurface(plan, stage, R)) : null;
    controller.deckSeat = stage >= 3 ? plan.seats.family : null;
  };
  store.setState({ deckStage: loadStage(), deckBuilding: null });
  if (store.getState().deckStage > 0) apply(store.getState().deckStage);
  const link = { ghost: 0 };

  const build = (k: Stage) => {
    if (!takeNeeds(inv, DECK_NEEDS[k - 1])) return;
    controller.invChanged();
    store.setState({ deckStage: k, deckBuilding: 0 });
    saveStage(k);
    apply(k);
    controller.announce(DECK_STAGES[k - 1].built);
    controller.refreshTarget();
  };

  ([1, 2, 3] as const).forEach((k) => {
    const spot = plan.sites[k - 1];
    const S = DECK_STAGES[k - 1];
    const t: Target = {
      kind: 'site',
      key: `site:deck${k}`,
      n: spot.n,
      edgeU: 0.3,
      reachU: TARGET_REACH.site,
      standU: 0.75,
      index: k,
      facing: spot.facing,
      scale: 1,
      label: () => (missing(inv, DECK_NEEDS[k - 1]).length ? S.see : S.build),
      // only the next build, once the one before it is up (and not while one's going up)
      usable: () => store.getState().deckStage === k - 1 && store.getState().deckBuilding === null,
      use() {
        if (store.getState().deckStage !== k - 1 || store.getState().deckBuilding !== null) return;
        const miss = missing(inv, DECK_NEEDS[k - 1]);
        if (miss.length) {
          controller.showToast(`${S.what} still need${k === 3 ? 's' : ''} ${listNeeds(miss)}. Make them at the crafting table; nails come from the iron ore in the rust-streaked boulders.`);
          return;
        }
        build(k);
      },
      icon: () => (k === 3 ? faBinoculars : faStairs),
    };
    controller.targets.push(t);
  });

  // your end of the bench on the platform, facing the view
  const seat: Seat = {
    id: 'deck',
    n: plan.seats.visitor.n,
    facing: plan.seats.visitor.facing,
    sit: plan.seats.visitor.n,
    stand: plan.seats.stand,
    byPond: false,
    height: plan.deckH + BENCH.seatTop,
  };
  controller.targets.push({
    kind: 'bench',
    key: 'deck:bench',
    n: plan.seats.visitor.n,
    edgeU: 0.2,
    reachU: 0.9,
    standU: 0.6,
    index: 0,
    facing: plan.seats.visitor.facing,
    scale: 1,
    seat,
    usable: () => store.getState().deckStage >= 3,
  });

  return {
    plan,
    dressing,
    View: () => (
      <>
        <DeckView controller={controller} store={store} plan={plan} link={link} />
        {dressing && <Bonsai controller={controller} at={dressing.bonsai} />}
      </>
    ),
    near(key) {
      const k = key?.startsWith('site:deck') ? Number(key.slice(9)) : 0;
      return (k === 1 || k === 2 || k === 3) && store.getState().deckStage === k - 1 ? k : null;
    },
    step(dt) {
      const s = store.getState();
      const next = s.deckStage + 1;
      const d = next <= 3 ? arcDistance(controller.sim.pLocal, plan.sites[next - 1].n, R) : Infinity;
      link.ghost = next > 3 ? 0 : clamp((DECK_GHOST.far - d) / (DECK_GHOST.far - DECK_GHOST.near), 0, 1);
      if (s.deckBuilding !== null) {
        const reduced = selectReducedMotion(controller.store.getState());
        const t = reduced ? BUILD_S : s.deckBuilding + dt;
        for (const k of KNOCKS) if (s.deckBuilding < k && t >= k && !reduced) controller.sound.hit();
        if (t >= BUILD_S) {
          store.setState({ deckBuilding: null });
          controller.sound.pickup();
        } else store.setState({ deckBuilding: t });
      }
    },
    state() {
      const s = store.getState();
      const on = controller.seatMotion.seat === seat;
      const fam = controller.home?.state().find((p) => p.seat?.startsWith('deck:')) ?? null;
      const route = [...plan.pieces.map((p) => p.a), plan.pieces[plan.pieces.length - 1].b, plan.at(DECK.deck.entryX, 0.2), plan.seats.stand].map((v) => [v.x, v.y, v.z] as [number, number, number]);
      return { stage: s.deckStage, ghost: link.ghost, near: s.near?.startsWith('deck') ?? false, building: s.deckBuilding !== null, deckH: plan.deckH, bench: { visitor: on, family: fam?.id ?? null }, route, pine: dressing && { n: dressing.bonsai.n.toArray(), out: dressing.bonsai.out.toArray() } };
    },
  };
}

// ---------------------------------------------------------------------------
// drawing

const _m = new Matrix4();
const _q = new Quaternion();
const _y = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const Y = new Vector3(0, 1, 0);

function DeckView({ controller, store, plan, link }: { controller: GameController; store: CraftStore; plan: DeckPlan; link: { ghost: number } }) {
  const stage = useStore(store, (s) => s.deckStage);
  const building = useStore(store, (s) => s.deckBuilding !== null);
  const geos = useMemo(() => ([1, 2, 3] as const).map((k) => deckStageModel(plan, k, (n) => controller.terrain.height(n), R)), [plan, controller]);
  const ghosts = useMemo(() => geos.map((g) => (g.solid ? { fill: g.solid, edges: new EdgesGeometry(g.solid, 35) } : null)), [geos]);
  const mats = useMemo(
    () => ({
      fill: new MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, toneMapped: false }),
      line: new LineBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      ore: new MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.42, flatShading: true }),
    }),
    [],
  );
  const nugget = useMemo(() => ironNuggets(), []);
  useEffect(
    () => () => {
      for (const g of geos) for (const x of [g.solid, g.glow, g.glass]) x?.dispose();
      for (const g of ghosts) g?.edges.dispose();
      nugget.dispose();
    },
    [geos, ghosts, nugget],
  );
  const iron = useMemo(() => controller.props.boulders.filter((b) => b.iron), [controller]);
  const ore = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ore.current;
    if (!mesh) return;
    // on each boulder as the props draw it: upright on the ground, turned by its yaw, at its scale
    iron.forEach((b, i) => {
      _q.setFromUnitVectors(Y, b.n).multiply(_y.setFromAxisAngle(Y, b.yaw));
      mesh.setMatrixAt(i, _m.compose(_p.copy(b.n).multiplyScalar(R + (b.h ?? 0) - 0.02), _q, _s.setScalar(b.scale)));
      mesh.setColorAt(i, new Color('#ffffff'));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [iron]);
  const ghost = useRef<Group>(null);
  useFrame(({ clock }) => {
    const s = store.getState();
    const t = s.deckBuilding;
    const g = ghost.current;
    if (!g) return;
    const reduced = selectReducedMotion(controller.store.getState());
    const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(clock.elapsedTime * 2.1);
    // the next build's ghost, by how close you are; while one goes up, its ghost fades as it appears
    const k = t === null ? link.ghost : 1;
    const fade = t === null ? 1 : Math.max(0, 1 - t / (BUILD_S * 0.7));
    mats.line.opacity = (0.05 + 0.75 * Math.pow(k, 1.3)) * shimmer * fade;
    mats.fill.opacity = 0.14 * Math.pow(k, 1.6) * shimmer * fade;
    g.visible = mats.line.opacity > 0.004;
  });
  // the stage the ghost shows: the next one, or the one going up
  const shown = building ? stage : stage + 1;
  const gh = shown >= 1 && shown <= 3 ? ghosts[shown - 1] : null;
  return (
    <group name="viewing-deck">
      {geos.map((g, i) => (i + 1 < stage || (i + 1 === stage && !building) ? <KitModel key={i} geo={g} /> : null))}
      {building && stage >= 1 && <Rising geo={geos[stage - 1]} store={store} />}
      {gh && (
        <group ref={ghost} name="deck-ghost">
          <mesh geometry={gh.fill} material={mats.fill} renderOrder={3} />
          <lineSegments geometry={gh.edges} material={mats.line} renderOrder={4} />
        </group>
      )}
      {iron.length > 0 && <instancedMesh ref={ore} args={[nugget, mats.ore, iron.length]} castShadow receiveShadow frustumCulled={false} />}
    </group>
  );
}

/** The old pine on the upper rim, leaning out over it (viewing-deck.md §4.6): drawn with the trees' swaying bark and needle materials. */
function Bonsai({ controller, at }: { controller: GameController; at: DeckDressing['bonsai'] }) {
  const geo = useMemo(() => bonsaiModel(), []);
  const mats = useMemo(() => sharedPropMaterials<PropMaterials>(), []);
  useEffect(
    () => () => {
      geo.solid.dispose();
      geo.leaves.dispose();
    },
    [geo],
  );
  const meshes = useRef<Array<InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    const n = at.n;
    const x = at.out.clone().addScaledVector(n, -at.out.dot(n)).normalize();
    const z = new Vector3().crossVectors(x, n).normalize();
    _q.setFromRotationMatrix(_m.makeBasis(x, n, z));
    _m.compose(_p.copy(n).multiplyScalar(R + controller.terrain.height(n) - 0.03), _q, _s.setScalar(1));
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.setMatrixAt(0, _m);
      mesh.setColorAt(0, new Color('#ffffff'));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [at, controller]);
  return (
    <group name="deck-pine">
      <instancedMesh ref={(m) => void (meshes.current[0] = m)} args={[geo.solid, mats.tree, 1]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={(m) => void (meshes.current[1] = m)} args={[geo.leaves, mats.needle.material, 1]} castShadow receiveShadow customDepthMaterial={mats.needle.depth} frustumCulled={false} />
    </group>
  );
}

/** The build going up: it appears once the knocks are half done. */
function Rising({ geo, store }: { geo: ReturnType<typeof deckStageModel>; store: CraftStore }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const t = store.getState().deckBuilding;
    if (g.current) g.current.visible = t === null || t > BUILD_S * 0.45;
  });
  return (
    <group ref={g} visible={false}>
      <KitModel geo={geo} />
    </group>
  );
}
