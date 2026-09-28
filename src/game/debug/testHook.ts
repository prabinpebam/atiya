import { HalfFloatType, Raycaster, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, arcDistance, moveAlong, orientationFor, tangentToward } from '../math/sphere';
import { rotateAbout } from '../math/steer';
import { riverDistance } from '../world/features';
import { gameTexture, textureStatus, tierTextures } from '../world/textures';
import { litLamps } from '../world/lampLights';
import { outlineMaterial } from '../player/outline';

export interface GameTestHook {
  getState(): Record<string, unknown>;
  landmarks(): string[];
  teleport(id: string): void;
  travelTo(id: string): void;
  setIntent(x: number, y: number, run?: boolean): void;
  clearIntent(): void;
  interact(): void;
  start(): void;
  pause(): void;
  resume(): void;
  advance(frames: number, dt?: number): void;
  autoWalkTo(id: string): void;
  distanceTo(id: string): number;
  projectLandmark(id: string, part?: 'base' | 'door'): { x: number; y: number; z: number } | null;
  setAdaptiveQuality(enabled: boolean): void;
  setDpr(dpr: number): void;
  /** Stand next to the pond (visual testing). */
  visitPond(): boolean;
  /** Stand ~2 u in front of prop `i` of a kind (visual testing). */
  visitProp(kind: 'hardwood' | 'fruit' | 'cedar' | 'bushes' | 'flowerBushes' | 'rocks' | 'boulders', i?: number): boolean;
  /** Stand near a terrain feature, facing it (visual testing). */
  visitFeature(kind: 'bridge' | 'waterfall' | 'mesa' | 'river', i?: number): boolean;
  /** Draw calls / triangles of the previous frame (all passes). */
  renderInfo(): { calls: number; triangles: number };
  /** Stand just behind a landmark, facing away from it, so the building sits between the camera and the player. */
  standBehind(id: string): boolean;
  /** Renderer and scene census for performance audits. */
  perfStats(): Record<string, unknown>;
  /** Render the scene into a half-float target (like the composer's) and report Inf/NaN pixels and what's under the first one. */
  hdrScan(width?: number, samples?: number): { bad: number; max: number; at: [number, number] | null; hit: string | null };
  /** The live renderer and scene (audits in the console / scripts). */
  __gfx(): GameController['gfx'];
  /** Ambient wildlife: each animal's state and distance (u) from the character. */
  wildlife(): { rabbits: { state: string; d: number; coat: string; kit: boolean }[]; duck: { state: string; d: number; toNest: number | null; rest: number; ducklingsToNest: number[] } | null; fish: { state: string; d: number; stream: boolean }[]; birds: { state: string; d: number; alt: number }[] };
  /** Where an animal (or the ducks' nest) is on screen (NDC), for close-up screenshots. */
  projectAnimal(kind: 'duck' | 'duckling' | 'nest' | 'rabbit', i?: number): { x: number; y: number } | null;
  /** Stand `u` away from an animal (visual testing and the wildlife E2E). */
  nearAnimal(kind: 'rabbit' | 'duck' | 'bird', i?: number, u?: number): boolean;
  /** Stand `u` in front of the plaza bench, facing it (bench E2E and visual testing). */
  nearBench(u?: number): boolean;
  /** Stand `u` from a usable target, facing it (from its front first, if it has one): a tree (`which` = hardwood / apple / orange / cedar), a boulder, a flower, the chest or the notice board. Returns its key. */
  nearTarget(kind: 'tree' | 'boulder' | 'flower' | 'chest' | 'craft' | 'site' | 'notice' | 'jute' | 'clay' | 'bench', which?: string, u?: number): string | null;
  /** Click-to-walk to a planet-local point (the viewing deck's route: `craft().deck.route`). */
  walkTo(p: [number, number, number]): void;
  /** Stand at a planet-local point at once, optionally turning the view by `yaw` rad (screenshots of the deck's steps). */
  placeAt(p: [number, number, number], yaw?: number): void;
  /** The crafting chunk (crafting.md): Chopper's house (built, colour, building), the ghost's visibility 0…1, and whether the site card is up. */
  craft(): ReturnType<import('../controller').CraftAttachment['state']> | null;
  /** Backpack (36), chest (27), the cursor stack and the hotbar selection, as `id:n` / null. */
  inventory(): { backpack: (string | null)[]; chest: (string | null)[]; held: string | null; selected: number };
  /** Put items straight into the backpack (tests). Returns the leftover. */
  giveItem(id: string, n: number): number;
  /** Items lying in the world: item, count, state and distance (u) from the character. */
  drops(): { item: string; count: number; state: string; d: number }[];
  /** Show or hide the character's occlusion outline (visual testing). */
  setOutline(on: boolean): void;
  /** Scene exposure (into the tone map) and the tilt-shift blend function name. */
  grading(): { exposure: number; tiltBlend: string };
  /** Force an adaptive-quality step (bypasses the warm-up/throttle). */
  adaptiveStep(dir: -1 | 1): void;
  /** Set and hold the planet clock (hours 0–24); `null` releases it. */
  setTime(hours: number | null): void;
  /** Force the gust level (0…1); `null` returns to the natural wind. */
  setWind(gust: number | null): void;
  /** Town-hall clock hand angles last drawn (radians clockwise from 12), or null. */
  clockHands(): { hour: number; minute: number; second: number } | null;
  /** Bridge lanterns: count, how lit they are (0…1) and their point lights' current intensity. */
  bridgeLamps(): { count: number; lit: number; intensity: number };
  /** How open each landmark's door (or curtain) is, 0 shut … 1 open. */
  doors(): Record<string, number>;
  /** How many lamps (plaza lamps, door and stage spots) are lighting the scene this frame. */
  lamps(): number;
  /** The chest's and the crafting table's "ready" cues: how ready they look (0…1), seconds since they woke, and how often. */
  readyCues(): Record<'chest' | 'craft', { on: number; since: number; wakes: number }>;
  /** The shared warm door light: which landmark it's shining from (null when dark) and its intensity. */
  doorLight(): { id: string | null; intensity: number };
  /** Sound: on/off, audio-context state, sprites loaded, ambience targets and the latest cues (newest last). */
  sound(): {
    enabled: boolean;
    state: string;
    loaded: number;
    total: number;
    levels: { stream: number; streamPan: number; wind: number; windCutoff: number; birds: boolean };
    lastSurface: string | null;
    events: Array<{ t: number; kind: string; detail?: string; played: boolean }>;
    /** Background music: on/off, playing, the current track and its URL. */
    music: { on: boolean; playing: boolean; track: number; url: string | null };
  };
  /** Ground under the player: smoothed lift, terrain height, walk height and distance to the river (u). */
  /** Chopper (chopper.md): distance (u) from the character, speed, behaviour, pose, moods, whistles so far. */
  chopper(): { d: number; speed: number; behaviour: string; stage: number; clip: string; wag: number; pant: number; energy: number; whistles: number; n: number[] };
  /** Whistle for Chopper (as F does). */
  whistle(): void;
  /** Make Chopper hold a pose (`sit`, `scratch`, `playBow`, …) for a while, or run a behaviour. */
  chopperDo(what: string): void;
  /** Stand `u` from Chopper, facing him. */
  nearChopper(u?: number): boolean;
  /** The family (family.md): each one's activity, pose, speed, whether they're talking with you, and distances (u) from you and from home. */
  family(): Array<{ id: string; activity: string; pose: string; speed: number; chatting: boolean; indoors: boolean; d: number; home: number; seat: string | null; link: string | null; held: string | null }>;
  /** How open the family's front door is (0 shut … 1 open). */
  homeDoor(): number;
  /** Put one of the family (or Prabin) at a point (planet-local unit vector), standing (visual checks). */
  npcPlace(id: string, n: [number, number, number]): boolean;
  /** Stand `u` from one of the family, facing them (`front`: in front of them, so the camera sees their face). */
  nearNpc(id: string, u?: number, front?: boolean): boolean;
  /** Make one of the family start (and keep at) an activity. */
  npcDo(id: string, activity: string): boolean;
  /** Stand at the home by the pond, facing the house. */
  visitHome(): boolean;
  /** Stand `u` in front of the pond bench, facing it (E then sits down). */
  nearPondBench(u?: number): boolean;
  /** The vegetable garden: who has the watering can, each plant's moisture, and how many are thirsty. */
  garden(): { holder: string | null; wet: number[]; plants: number } | null;
  /** Stands the character by the watering can, facing it. */
  nearCan(): boolean;
  /** Stands the character where it waters plant `i` (from side 0 or 1 of its bed), facing it. */
  nearPlant(i: number, side?: 0 | 1): boolean;
  /** Feeding the ducks: whether E feeds them now, handfuls tossed, crumbs in the air or afloat, and the duck (state, distance u to the crumbs). */
  ducks(): { canFeed: boolean; fed: number; tosses: number; spot: boolean; duck: string | null; toSpot: number | null };
  /** What the grass placed (null when the grass chunk is absent), and its knee-high meadows. */
  grass(): { stats: Record<string, number> | null; meadows: number };
  /** Progressive loading (progressive-loading.md): the tier, the groups revealed so far, and how many obstacles still wait for theirs. */
  loadStage(): { tier: string; revealed: string[]; held: number; marks: Record<string, number> };
  /** A loading tier's textures, and whether each has loaded. */
  tierTextures(tier: 1 | 2 | 3): { name: string; ready: boolean }[];
  /** Is the thing at this layout position out yet (a prop's birth has passed)? */
  summoned(kind: 'hardwood' | 'fruit' | 'cedar' | 'bushes' | 'boulders' | 'rocks', i: number): boolean;
  /** Stands the character in the i-th knee-high meadow. */
  visitMeadow(i?: number): boolean;
  groundInfo(): {
    lift: number;
    height: number;
    walk: number;
    riverD: number;
    riverHalfWidth: number;
    water: number;
    wade: number;
    speedFactor: number;
    ripples: number;
    collar: boolean;
  };
}

/** Non-production only (dev server and `astro build --mode test`). */
export function installTestHook(c: GameController): void {
  const hook: GameTestHook = {
    getState: () => {
      const s = c.store.getState();
      return {
        phase: s.phase,
        pLocal: c.sim.pLocal.toArray(),
        nearby: s.nearbyId,
        seatNear: s.target?.kind === 'bench' ? s.target.key : null,
        target: s.target,
        acting: s.acting,
        invScreen: s.invScreen,
        chopperOpen: s.chopperOpen,
        talk: s.talk,
        seated: s.seated,
        seatStage: c.seatMotion.stage,
        seatPose: c.seatMotion.pose,
        /** Resting on the grass (rest.md): sitting or lying, and the pose's blend; and a jump's height (u). */
        rest: c.rest.kind,
        restK: c.rest.k,
        jump: c.sim.jumpH,
        meteor: c.meteor,
        /** Arc distance (u) from the player to the nearest bench's centre. */
        benchD: c.seats.length ? Math.min(...c.seats.map((b) => Math.acos(Math.max(-1, Math.min(1, b.n.dot(c.sim.pLocal)))) * CONFIG.planetRadius)) : Infinity,
        open: s.openId,
        menuOpen: s.menuOpen,
        traveling: s.traveling,
        speed: c.sim.speed,
        heading: c.sim.heading,
        atSpawn: c.isAtSpawn(),
        autoWalk: Boolean(c.sim.autoWalk),
        dpr: s.dpr,
        quality: s.quality,
        postLevel: s.postLevel,
        postFx: c.postFx,
        avatar: c.avatar,
        character: s.character,
        avatarModel: c.avatarModel,
        outlines: c.outlines,
        hours: c.timeOfDay,
        night: c.sky.night,
        glow: c.sky.glow,
        timeMode: s.timeMode,
        pitch: c.view.pitch,
        /** Screen angle of map north, degrees clockwise from screen-up (0 = north-up). */
        north: (c.northAngle() * 180) / Math.PI,
        lift: c.lift,
        hover: c.sim.hover,
        wind: { ...c.wind },
        textures: textureStatus(),
        loadTier: c.summoner.tier,
      };
    },
    landmarks: () => c.landmarks.map((l) => l.id),
    teleport: (id) => c.teleport(id),
    travelTo: (id) => c.travelTo(id),
    setIntent: (x, y, run = false) => {
      c.keyboard.override = { x, y, run };
    },
    clearIntent: () => {
      c.keyboard.override = null;
    },
    interact: () => c.interact(),
    start: () => c.start(),
    pause: () => {
      c.paused = true;
    },
    resume: () => {
      c.paused = false;
    },
    advance: (frames, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) c.step(dt);
    },
    autoWalkTo: (id) => {
      const g = c.geoById.get(id);
      if (g) c.sim.startAutoWalk(g.approach);
    },
    walkTo: (p) => c.sim.startAutoWalk(new Vector3(...p).normalize()),
    placeAt: (p, yaw) => {
      c.sim.placeAt(new Vector3(...p).normalize());
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      if (yaw) c.sim.rotateView(yaw);
    },
    distanceTo: (id) => c.distanceTo(id),
    projectLandmark: (id, part = 'base') => {
      const g = c.geoById.get(id);
      if (!g || !c.camera) return null;
      const local = part === 'door' ? g.n.clone().addScaledVector(g.door, g.footprintU / CONFIG.planetRadius).normalize() : g.n.clone();
      const world = new Vector3().copy(local).multiplyScalar(CONFIG.planetRadius).applyQuaternion(c.sim.planetQ);
      c.camera.updateMatrixWorld();
      const ndc = world.project(c.camera);
      return { x: ndc.x, y: ndc.y, z: ndc.z };
    },
    projectAnimal: (kind, i = 0) => {
      const w = c.wildlife;
      const n = kind === 'nest' ? c.props.home?.duckNest.n : kind === 'duck' ? w?.duck?.n : kind === 'rabbit' ? w?.rabbits[i]?.n : w?.ducklings[i]?.n;
      if (!n || !c.camera) return null;
      const world = n.clone().multiplyScalar(CONFIG.planetRadius + 0.1).applyQuaternion(c.sim.planetQ);
      c.camera.updateMatrixWorld();
      const ndc = world.project(c.camera);
      return { x: ndc.x, y: ndc.y };
    },
    setAdaptiveQuality: (enabled) => c.store.setState({ adaptiveQuality: enabled }),
    setDpr: (dpr) => c.store.setState({ dpr }),
    visitPond: () => {
      const pond = c.props.pond;
      if (!pond) return false;
      const toward = tangentToward(pond.n, UP as Vector3) ?? new Vector3(0, 0, 1);
      const stand = moveAlong(pond.n, toward, (pond.radiusU + 1.2) / CONFIG.planetRadius);
      const face = tangentToward(stand, pond.n) ?? toward.clone().negate();
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    renderInfo: () => ({ ...c.lastRenderInfo }),
    standBehind: (id) => {
      const g = c.geoById.get(id);
      if (!g) return false;
      const back = g.door.clone().negate();
      const stand = moveAlong(g.n, back, (g.footprintU + 0.9) / CONFIG.planetRadius);
      const face = tangentToward(stand, g.n)?.negate() ?? back;
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    __gfx: () => c.gfx,
    hdrScan: (width = 320, samples = 0) => {
      const gfx = c.gfx;
      const cam = c.camera;
      if (!gfx || !cam) return { bad: 0, max: 0, at: null, hit: null };
      const { gl, scene } = gfx;
      const w = width;
      const h = Math.round((w * gl.domElement.height) / gl.domElement.width);
      const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples });
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      gl.setRenderTarget(prev);
      const buf = new Uint16Array(w * h * 4);
      gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      rt.dispose();
      let bad = 0;
      let max = 0;
      let at: [number, number] | null = null;
      const half = (v: number) => {
        const e = (v >> 10) & 31;
        const m = v & 1023;
        return e === 0 ? m * 2 ** -24 : (1 + m / 1024) * 2 ** (e - 15);
      };
      for (let i = 0; i < w * h; i++) {
        let broken = false;
        for (let k = 0; k < 3; k++) {
          const v = buf[i * 4 + k];
          if ((v & 0x7c00) === 0x7c00) broken = true;
          else max = Math.max(max, half(v));
        }
        if (broken) {
          bad++;
          at ??= [i % w, Math.floor(i / w)];
        }
      }
      let hit: string | null = null;
      if (at) {
        const ray = new Raycaster();
        ray.setFromCamera(new Vector2((at[0] + 0.5) / w * 2 - 1, (at[1] + 0.5) / h * 2 - 1), cam);
        const first = ray.intersectObject(scene, true)[0];
        if (first) {
          const names: string[] = [];
          for (let o: typeof first.object | null = first.object; o; o = o.parent) names.push(o.name || o.type);
          hit = `${names.join(' < ')} @${first.distance.toFixed(2)}`;
        }
      }
      return { bad, max, at, hit };
    },
    perfStats: () => {
      const gfx = c.gfx;
      if (!gfx) return {};
      const { gl, scene } = gfx;
      const materials = new Set<string>();
      const geometries = new Set<string>();
      const programs = new Map<string, number>();
      let meshes = 0;
      let instanced = 0;
      let instances = 0;
      let casters = 0;
      let transparent = 0;
      let vertices = 0;
      let skinned = 0;
      const lights: Record<string, number> = {};
      const shadowLights: string[] = [];
      const bigMeshes: Array<[string, number]> = [];
      scene.traverseVisible((o) => {
        const l = o as unknown as { isLight?: boolean; type: string; castShadow: boolean; shadow?: { mapSize: { x: number } } };
        if (l.isLight) {
          lights[l.type] = (lights[l.type] ?? 0) + 1;
          if (l.castShadow) shadowLights.push(`${l.type}:${l.shadow?.mapSize.x}`);
        }
        const m = o as unknown as {
          isMesh?: boolean;
          isInstancedMesh?: boolean;
          isSkinnedMesh?: boolean;
          count?: number;
          castShadow: boolean;
          name: string;
          geometry: { uuid: string; attributes: { position?: { count: number } }; index: { count: number } | null };
          material: { uuid: string; transparent: boolean; type: string; name: string } | Array<{ uuid: string; transparent: boolean; type: string; name: string }>;
        };
        if (!m.isMesh && !(o as { isPoints?: boolean }).isPoints) return;
        meshes++;
        if (m.isInstancedMesh) {
          instanced++;
          instances += m.count ?? 0;
        }
        if (m.isSkinnedMesh) skinned++;
        if (m.castShadow) casters++;
        geometries.add(m.geometry.uuid);
        const v = m.geometry.attributes.position?.count ?? 0;
        vertices += v * (m.isInstancedMesh ? (m.count ?? 1) : 1);
        bigMeshes.push([`${o.name || o.parent?.name || m.geometry.uuid.slice(0, 6)}${m.isInstancedMesh ? `×${m.count}` : ''}`, (m.geometry.index?.count ?? v) / 3 * (m.isInstancedMesh ? (m.count ?? 1) : 1)]);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          materials.add(mat.uuid);
          if (mat.transparent) transparent++;
          const key = `${mat.type}${mat.name ? `:${mat.name}` : ''}`;
          programs.set(key, (programs.get(key) ?? 0) + 1);
        }
      });
      bigMeshes.sort((a, b) => b[1] - a[1]);
      const info = gl.info;
      return {
        calls: c.lastRenderInfo.calls,
        triangles: c.lastRenderInfo.triangles,
        programs: info.programs?.length ?? 0,
        gpuGeometries: info.memory.geometries,
        gpuTextures: info.memory.textures,
        meshes,
        instanced,
        instances,
        skinned,
        casters,
        transparent,
        vertices,
        uniqueMaterials: materials.size,
        uniqueGeometries: geometries.size,
        lights,
        shadowLights,
        pixelRatio: gl.getPixelRatio(),
        drawingBuffer: [gl.domElement.width, gl.domElement.height],
        shadowAutoUpdate: gl.shadowMap.autoUpdate,
        shadowType: gl.shadowMap.type,
        materialKinds: Object.fromEntries([...programs.entries()].sort((a, b) => b[1] - a[1])),
        topTriangles: bigMeshes.slice(0, 15),
      };
    },
    wildlife: () => {
      const w = c.wildlife;
      const R = CONFIG.planetRadius;
      const d = (n: Vector3) => (Math.acos(Math.max(-1, Math.min(1, n.dot(c.sim.pLocal)))) * R);
      if (!w) return { rabbits: [], duck: null, fish: [], birds: [] };
      return {
        rabbits: w.rabbits.map((r) => ({ state: r.state, d: d(r.n), coat: r.coat, kit: Boolean(r.mum) })),
        duck: w.duck
          ? {
              state: w.duck.state,
              d: d(w.duck.n),
              toNest: c.props.home ? arcDistance(w.duck.n, c.props.home.duckNest.n, R) : null,
              rest: w.duck.rest,
              ducklingsToNest: c.props.home ? w.ducklings.map((k) => arcDistance(k.n, c.props.home!.duckNest.n, R)) : [],
            }
          : null,
        fish: w.fish.map((f) => ({ state: f.state, d: d(f.n), stream: f.stream })),
        birds: w.birds.map((b) => ({ state: b.state, d: d(b.n), alt: b.alt })),
      };
    },
    nearAnimal: (kind, i = 0, u = 1.2) => {
      const w = c.wildlife;
      const a = kind === 'rabbit' ? w?.rabbits[i] : kind === 'duck' ? w?.duck : w?.birds.find((b) => b.state === 'peck');
      if (!a) return false;
      // stand on dry ground `u` from the animal, facing it
      for (let k = 0; k < 16; k++) {
        const dir = tangentToward(a.n, new Vector3(Math.cos(k), Math.sin(k * 1.7), Math.sin(k)).normalize());
        if (!dir) continue;
        const stand = moveAlong(a.n, dir, u / CONFIG.planetRadius);
        if (c.terrain.inWater(stand) && kind !== 'duck') continue;
        const face = tangentToward(stand, a.n) ?? dir;
        c.sim.setOrientation(orientationFor(stand, face));
        return true;
      }
      return false;
    },
    nearTarget: (kind, which, u) => {
      const R = CONFIG.planetRadius;
      // reachable ones only (not on a mesa top): clear ground in front of it
      const list = c.targets.filter((t) => t.kind === kind && (!which || (kind === 'tree' ? t.tree === which : t.key === which)));
      for (const t of list) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const dir = k === 0 && t.facing ? t.facing.clone() : tangentToward(t.n, new Vector3(Math.cos(a), Math.sin(a * 1.3), Math.sin(a)).normalize());
          if (!dir) continue;
          const dist = u ?? t.edgeU + CONFIG.playerRadius + 0.12;
          const stand = moveAlong(t.n, dir, dist / R);
          if (c.terrain.inWater(stand) || c.sim.obstacles.some((o) => Math.acos(Math.max(-1, Math.min(1, o.n.dot(stand)))) * R < o.radiusU + CONFIG.playerRadius - 0.02)) continue;
          if (Math.abs(c.terrain.walkHeight(stand) - c.terrain.walkHeight(t.n)) > 0.4) continue;
          c.sim.setOrientation(orientationFor(stand, tangentToward(stand, t.n) ?? dir.clone().negate()));
          c.lift = c.terrain.walkHeight(c.sim.pLocal);
          return t.key;
        }
      }
      return null;
    },
    craft: () => c.craft?.state() ?? null,
    inventory: () => {
      const enc = (s: { id: string; n: number } | null) => (s ? `${s.id}:${s.n}` : null);
      const inv = c.inventory;
      return { backpack: inv.backpack.map(enc), chest: inv.chest.map(enc), held: enc(inv.held), selected: inv.selected };
    },
    giveItem: (id, n) => {
      const left = c.inventory.add(id as never, n);
      c.invChanged();
      return left;
    },
    drops: () => {
      const R = CONFIG.planetRadius;
      return c.drops.list.map((d) => ({ item: d.item, count: d.count, state: d.state, d: Math.acos(Math.max(-1, Math.min(1, d.p.clone().normalize().dot(c.sim.pLocal)))) * R }));
    },
    chopper: () => {
      const b = c.chopper as import('../world/chopper/brain').ChopperBrain;
      return { d: b.distanceTo(c.sim.pLocal, CONFIG.planetRadius), speed: b.speed, behaviour: b.behaviour, stage: b.stage, clip: b.clip, wag: b.wag, pant: b.pant, energy: b.energy, whistles: c.whistles, n: b.n.toArray() };
    },
    whistle: () => c.whistle(),
    chopperDo: (what) => {
      const b = c.chopper as unknown as { hold(clip: string, dur?: number): void; makeTrail(w: unknown): void };
      if (what === 'house') {
        (c.chopper as import('../world/chopper/brain').ChopperBrain).visitHouse(false);
        return;
      }
      if (what === 'scent') {
        b.makeTrail(c.dogWorld);
        (c.chopper as unknown as { behaviour: string }).behaviour = 'scent';
        return;
      }
      b.hold(what);
    },
    nearChopper: (u = 1.0) => {
      const R = CONFIG.planetRadius;
      const n = c.chopper.n;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const dir = tangentToward(n, new Vector3(Math.cos(a), Math.sin(a * 1.3), Math.sin(a)).normalize());
        if (!dir) continue;
        const stand = moveAlong(n, dir, u / R);
        if (c.terrain.inWater(stand) || c.sim.obstacles.some((o) => Math.acos(Math.max(-1, Math.min(1, o.n.dot(stand)))) * R < o.radiusU + CONFIG.playerRadius - 0.02)) continue;
        c.sim.setOrientation(orientationFor(stand, tangentToward(stand, n) ?? dir.clone().negate()));
        c.lift = c.terrain.walkHeight(c.sim.pLocal);
        return true;
      }
      return false;
    },
    family: () => c.home?.state() ?? [],
    homeDoor: () => c.home?.door() ?? 0,
    npcPlace: (id, n) => {
      const f = c.home?.family as { get(id: string): { n: import('three').Vector3; route: unknown; goal: unknown } } | undefined;
      if (!f) return false;
      const npc = f.get(id);
      npc.n.set(n[0], n[1], n[2]).normalize();
      npc.route = null;
      npc.goal = null;
      return true;
    },
    npcDo: (id, activity) => c.home?.hold(id, activity) ?? false,
    nearNpc: (id, u = 0.9, front = false) => {
      const p = c.home?.people.find((x) => x.id === id);
      if (!p) return false;
      const R = CONFIG.planetRadius;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const dir = front && p.dir ? rotateAbout(p.dir.clone(), p.n, (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25) : tangentToward(p.n, new Vector3(Math.cos(a), Math.sin(a * 1.3), Math.sin(a)).normalize());
        if (!dir) continue;
        const stand = moveAlong(p.n, dir, u / R);
        if (c.terrain.inWater(stand) || c.sim.obstacles.some((o) => Math.acos(Math.max(-1, Math.min(1, o.n.dot(stand)))) * R < o.radiusU + CONFIG.playerRadius - 0.02)) continue;
        c.sim.setOrientation(orientationFor(stand, tangentToward(stand, p.n) ?? dir.clone().negate()));
        c.lift = c.terrain.walkHeight(c.sim.pLocal);
        return true;
      }
      return false;
    },
    visitHome: () => {
      const h = c.props.home;
      if (!h) return false;
      const stand = moveAlong(h.centre, h.house.facing, 1.2 / CONFIG.planetRadius);
      c.sim.setOrientation(orientationFor(stand, tangentToward(stand, h.house.n) ?? h.house.facing));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
    nearBench: (u = 1.1) => {
      const b = c.seats[0];
      if (!b) return false;
      const stand = moveAlong(b.n, b.facing, u / CONFIG.planetRadius);
      c.sim.setOrientation(orientationFor(stand, tangentToward(stand, b.n) ?? b.facing.clone().negate()));
      return true;
    },
    nearPondBench: (u = 1.1) => {
      const b = c.seats.find((s) => s.byPond);
      if (!b) return false;
      const stand = moveAlong(b.n, b.facing, u / CONFIG.planetRadius);
      c.sim.setOrientation(orientationFor(stand, tangentToward(stand, b.n) ?? b.facing.clone().negate()));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
    garden: () => {
      const g = c.home?.garden;
      return g ? { holder: g.holder, wet: [...g.wet], plants: g.plants.length } : null;
    },
    nearCan: () => {
      const can = c.home?.garden.can;
      if (!can) return false;
      const stand = moveAlong(can.n, can.facing, 0.45 / CONFIG.planetRadius);
      c.sim.setOrientation(orientationFor(stand, tangentToward(stand, can.n) ?? can.facing.clone().negate()));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
    nearPlant: (i, side = 0) => {
      const p = c.home?.garden.plants[i];
      if (!p) return false;
      const s = p.stands[side];
      c.sim.setOrientation(orientationFor(s.n, tangentToward(s.n, p.n) ?? s.facing));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
    ducks: () => {
      const d = c.wildlife?.duck ?? null;
      const spot = c.duckFeed?.spot ?? null;
      return {
        canFeed: c.store.getState().canFeed,
        fed: c.duckFeed?.count.get('visitor') ?? 0,
        tosses: c.duckFeed?.tosses.length ?? 0,
        spot: Boolean(spot),
        duck: d?.state ?? null,
        toSpot: d && spot ? Math.acos(Math.max(-1, Math.min(1, d.n.dot(spot)))) * CONFIG.planetRadius : null,
      };
    },
    setOutline: (on) => {
      outlineMaterial().visible = on;
    },
    grading: () => ({ ...c.grading }),
    adaptiveStep: (dir) => c.adaptiveStep?.(dir, true),
    setTime: (hours) => {
      if (hours === null) {
        c.timeFrozen = false;
        return;
      }
      c.timeOfDay = ((hours % 24) + 24) % 24;
      c.timeFrozen = true;
    },
    setWind: (gust) => {
      c.windOverride = gust === null ? null : Math.min(1, Math.max(0, gust));
    },
    clockHands: () => (c.clockHands ? { ...c.clockHands } : null),
    bridgeLamps: () => ({ ...c.bridgeLamps }),
    doors: () => Object.fromEntries([...c.doors].map(([id, d]) => [id, d.open])),
    doorLight: () => ({ ...c.doorLight }),
    lamps: () => litLamps(),
    readyCues: () => {
      const q = (r: typeof c.chestCue) => ({ on: r.on, since: r.since, wakes: r.wakes });
      return { chest: q(c.chestCue), craft: q(c.craftCue) };
    },
    sound: () => ({
      enabled: c.sound.enabled,
      state: c.sound.state,
      loaded: c.sound.loaded,
      total: c.sound.total,
      levels: { ...c.sound.levels },
      lastSurface: c.lastStepSurface,
      events: c.sound.events.map((e) => ({ ...e })),
      music: c.sound.musicState,
    }),
    groundInfo: () => {
      const p = c.sim.pLocal;
      const river = c.props.river;
      const rd = river ? riverDistance(river, p) : { d: Infinity, i: 0 };
      return {
        lift: c.lift,
        height: c.terrain.height(p),
        walk: c.terrain.walkHeight(p),
        riverD: rd.d,
        riverHalfWidth: river ? river.halfWidth[rd.i] : 0,
        water: c.terrain.waterDepth(p),
        wade: c.wadeDepth,
        speedFactor: c.sim.speedFactor,
        ripples: c.wake.ripples,
        collar: c.wake.collar,
      };
    },
    grass: () => ({ stats: c.grassStats ? { ...c.grassStats } : null, meadows: c.grassMeadows.length }),
    loadStage: () => ({
      ...c.summoner.stage(),
      marks: Object.fromEntries(performance.getEntriesByType('mark').filter((m) => m.name.startsWith('game:')).map((m) => [m.name, Math.round(m.startTime)])),
    }),
    tierTextures: (tier) => tierTextures(tier).map((name) => ({ name, ready: gameTexture(name) !== null })),
    summoned: (kind, i) => {
      const it = c.props[kind][i];
      return Boolean(it) && c.summoner.isRevealed('props') && c.summoner.out(it.n);
    },
    visitMeadow: (i = 0) => {
      const m = c.grassMeadows[i % Math.max(1, c.grassMeadows.length)];
      if (!m) return false;
      const toward = tangentToward(m, UP as Vector3) ?? new Vector3(0, 0, 1);
      c.sim.setOrientation(orientationFor(m, toward.negate()));
      return true;
    },
    visitProp: (kind, i = 0) => {
      const list = c.props[kind];
      const item = list[i % Math.max(1, list.length)];
      if (!item) return false;
      const toward = tangentToward(item.n, UP as Vector3) ?? new Vector3(0, 0, 1);
      const stand = moveAlong(item.n, toward, 2.0 / CONFIG.planetRadius);
      const face = tangentToward(stand, item.n) ?? toward.clone().negate();
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    visitFeature: (kind, i = 0) => {
      const R = CONFIG.planetRadius;
      const { bridges, river, mesas } = c.props;
      let target: Vector3 | null = null;
      let stand: Vector3 | null = null;
      if (kind === 'bridge' && bridges[i]) {
        const b = bridges[i];
        target = b.n;
        stand = moveAlong(b.n, b.along, -(b.halfLengthU + 1.6) / R);
      } else if (kind === 'waterfall' && river && mesas[0]) {
        target = river.samples[0];
        const away = tangentToward(mesas[0].n, target) ?? mesas[0].east;
        const side = new Vector3().crossVectors(target, away).normalize();
        stand = moveAlong(moveAlong(target, away, 2.2 / R), side, 1.2 / R);
      } else if (kind === 'mesa' && mesas[i]) {
        const m = mesas[i];
        target = m.n;
        const out = tangentToward(m.n, UP as Vector3) ?? m.north;
        stand = moveAlong(m.n, out, (m.radiusU + 2.6) / R);
      } else if (kind === 'river' && river) {
        const k = Math.min(river.samples.length - 1, Math.floor(river.samples.length * (0.15 + 0.1 * i)));
        target = river.samples[k];
        const side = new Vector3().crossVectors(target, river.tangent[k]).normalize();
        stand = moveAlong(target, side, 2.2 / R);
      }
      if (!target || !stand) return false;
      const face = tangentToward(stand, target) ?? new Vector3(0, 0, -1);
      c.sim.setOrientation(orientationFor(stand, face));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
  };
  (window as unknown as { __game: GameTestHook }).__game = hook;
}
