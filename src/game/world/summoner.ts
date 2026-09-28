/**
 * The summoner (docs: poc-3d-navigation/progressive-loading.md §5.7): once the planet is live, it brings
 * in the rest of it, group by group (world/summon.ts has the order and the pop). For each group it
 * waits for the group's textures and prepares its geometry in slices of a frame's spare time, mounts it
 * hidden, compiles its programs on their own, and reveals it: its objects appear outward from the
 * character, and each becomes solid and usable only as it does. When every group is out: complete.
 */
import {
  BackSide,
  DoubleSide,
  FrontSide,
  MeshDepthMaterial,
  VSMShadowMap,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
  type ShaderMaterial,
  type Side,
  type SkinnedMesh,
  type Texture,
  type Vector3,
  type WebGLRenderer,
} from 'three';
import type { Obstacle } from '../math/sphere';
import type { Target, TargetKind } from '../systems/interactables';
import { SUMMON_GROUPS, type LoadTier, type SummonGroup } from './summon';

/** The textures the object's materials use (render targets' aside). */
function texturesOf(root: Object3D, extra: readonly Material[] = []): Texture[] {
  const seen = new Set<Texture>();
  const add = (m: Material) => {
    for (const v of Object.values(m)) if ((v as Texture | null)?.isTexture) seen.add(v as Texture);
    const uniforms = (m as ShaderMaterial).uniforms;
    if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as Texture | null)?.isTexture) seen.add(u.value as Texture);
  };
  root.traverse((o) => {
    const mat = (o as Mesh).material as Material | Material[] | undefined;
    if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) add(m);
  });
  extra.forEach(add);
  return [...seen].filter((t) => !(t as { isRenderTargetTexture?: boolean }).isRenderTargetTexture);
}

/** Upload every texture the object's materials use (`initTexture`), so none waits for its first draw. */
export function uploadTextures(gl: WebGLRenderer, root: Object3D): void {
  for (const t of texturesOf(root)) gl.initTexture(t);
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
/** How much work a slice may do before it waits for the next frame (ms): unbounded in tests without the pops. */
const SLICE = { ms: 8 };

const SHADOW_SIDE: Record<Side, Side> = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };
/** Stand-ins for the shadow map's own depth materials, kept so the programs they compile stay alive for it. */
const depthStandIns = new Map<string, MeshDepthMaterial>();

/**
 * The material the shadow pass will draw this mesh's material with (as three's WebGLShadowMap picks it:
 * the mesh's `customDepthMaterial`, or a plain depth material, set up from the material), so its program
 * can be compiled ahead: `compile` only sees the meshes' own materials, and a shadow program compiled at
 * its first draw stalls that frame. Programs are shared by their key, so the shadow map's own copy picks
 * up the one compiled here.
 */
export function shadowDepthMaterial(mesh: Mesh, m: Material, vsm: boolean): Material {
  const side = m.shadowSide ?? (vsm ? m.side : SHADOW_SIDE[m.side]);
  const mm = m as Material & { map?: Texture | null; alphaMap?: Texture | null; displacementMap?: Texture | null; displacementScale?: number };
  const custom = mesh.customDepthMaterial as (Material & { map?: Texture | null; alphaMap?: Texture | null }) | undefined;
  const alphaTest = m.alphaToCoverage ? 0.5 : m.alphaTest;
  let d: Material & { map?: Texture | null; alphaMap?: Texture | null };
  if (custom) d = custom;
  else {
    const key = `${side}|${mm.map ? 1 : 0}|${mm.alphaMap ? 1 : 0}|${alphaTest > 0 ? 1 : 0}|${mm.displacementMap && mm.displacementScale ? 1 : 0}`;
    let s = depthStandIns.get(key);
    if (!s) depthStandIns.set(key, (s = new MeshDepthMaterial()));
    d = s;
    if (mm.displacementMap && mm.displacementScale) Object.assign(d, { displacementMap: mm.displacementMap, displacementScale: mm.displacementScale });
  }
  d.side = side;
  d.alphaTest = alphaTest;
  d.map = mm.map ?? null;
  d.alphaMap = mm.alphaMap ?? null;
  return d;
}

/**
 * Runs a resumable build (a generator that yields between pieces of work) a slice at a time: as much as
 * fits in `budgetMs` each frame, then it waits for the next frame. So a big build never blocks input.
 */
export async function runSliced<T>(steps: Generator<unknown, T>, budgetMs = SLICE.ms): Promise<T> {
  let t0 = performance.now();
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    if (performance.now() - t0 > budgetMs) {
      await frame();
      t0 = performance.now();
    }
  }
}

/** Which group brings a chunk's target (props' targets are timed one by one, by the wave). */
const TARGET_GROUP: Partial<Record<TargetKind, SummonGroup>> = { dog: 'prabin', can: 'home', plant: 'home', craft: 'craft', site: 'craft', jute: 'craft', clay: 'craft' };

export interface SummonHost {
  gfx: { gl: WebGLRenderer; scene: Object3D } | null;
  camera: Camera | null;
  store: { setState(p: { mounted?: readonly SummonGroup[]; loadTier?: LoadTier }): void; getState(): { mounted: readonly SummonGroup[] } };
  /** The character's collision list (things join it as they appear). */
  simObstacles: Obstacle[];
}

export class Summoner {
  tier: LoadTier = 'loading';
  /** When each group was revealed (performance.now(), ms). */
  readonly revealed = new Map<SummonGroup, number>();
  /** When each summoned object appears (ms), keyed by its position vector (the props' items, their obstacles and targets share it). */
  readonly bornAt = new Map<Vector3, number>();
  /** Where things were summoned from (the character, planet-local), and when the wave set off (ms). */
  origin: Vector3 | null = null;
  /** A burst of sparkles where something appeared (planet-local position, height above the ground (u), when (ms)). */
  readonly bursts: Array<{ n: Vector3; h: number; t: number }> = [];
  /** Each group's preparation (textures, geometry in slices), run before it mounts. */
  readonly prepare = new Map<SummonGroup, () => Promise<void>>();
  /** Called at a group's reveal (it times its objects: the props' wave). */
  readonly onReveal = new Map<SummonGroup, (now: number) => void>();
  /** Obstacles of things not out yet, and the group (or the position) they wait for. */
  private held: Array<{ o: Obstacle; group: SummonGroup }> = [];
  /** What's summoned, by position: the props' items and the home's pieces (with their obstacles and targets). */
  private pending: ReadonlyMap<Vector3, SummonGroup> = new Map();
  private readonly groups = new Map<SummonGroup, Object3D | null>();
  private readonly waiting = new Map<SummonGroup, (o: Object3D | null) => void>();
  /** Set by tests: skip the pops and build without slicing (the order stays the same). */
  get instant(): boolean {
    return SLICE.ms === Infinity;
  }
  set instant(on: boolean) {
    SLICE.ms = on ? Infinity : 8;
  }
  /** Resolves once the planet is complete. */
  readonly done: Promise<void>;
  private finish: () => void = () => {};

  constructor(private readonly host: SummonHost) {
    this.done = new Promise((r) => (this.finish = r));
  }

  /**
   * Holds back what isn't out yet: obstacles whose position a group's objects have (`pending`), taken
   * out of the character's collision until they appear.
   */
  hold(pending: ReadonlyMap<Vector3, SummonGroup>): void {
    this.pending = pending;
    const list = this.host.simObstacles;
    for (let i = list.length - 1; i >= 0; i--) {
      const g = pending.get(list[i].n);
      if (g === undefined) continue;
      this.held.push({ o: list[i], group: g });
      list.splice(i, 1);
    }
  }

  /** A group's root has mounted (Scene's `Summoned`), hidden. */
  mounted(g: SummonGroup, root: Object3D | null): void {
    this.groups.set(g, root);
    this.waiting.get(g)?.(root);
    this.waiting.delete(g);
  }

  group(g: SummonGroup): Object3D | null {
    return this.groups.get(g) ?? null;
  }

  isRevealed(g: SummonGroup): boolean {
    return this.revealed.has(g);
  }

  /** Is a thing at `n` out yet (a prop by its birth; anything not summoned is always out)? */
  out(n: Vector3, now = performance.now()): boolean {
    const b = this.bornAt.get(n);
    return b === undefined ? true : now >= b;
  }

  /** May this target be used yet (seen, and so solid and usable)? */
  available(t: Target, now = performance.now()): boolean {
    if (this.tier === 'complete') return true;
    const b = this.bornAt.get(t.n);
    if (b !== undefined) return now >= b;
    const p = this.pending.get(t.n);
    if (p) return this.revealed.has(p);
    const g = t.kind === 'npc' ? (t.who === 'prabin' ? 'prabin' : 'home') : TARGET_GROUP[t.kind];
    return g ? this.revealed.has(g) : true;
  }

  /** Each frame while summoning: what has appeared since becomes solid. */
  step(now = performance.now()): void {
    if (!this.held.length) return;
    for (let i = this.held.length - 1; i >= 0; i--) {
      const h = this.held[i];
      const b = this.bornAt.get(h.o.n);
      const ready = b !== undefined ? now >= b : this.revealed.has(h.group);
      if (!ready) continue;
      this.host.simObstacles.push(h.o);
      this.held.splice(i, 1);
    }
  }

  /** Runs the groups in order; resolves when the planet is complete. A group that fails is skipped. */
  async run(from: Vector3): Promise<void> {
    this.tier = 'live';
    this.origin = from.clone();
    this.host.store.setState({ loadTier: 'live' });
    const prepare = async (g: SummonGroup) => {
      try {
        await this.prepare.get(g)?.();
      } catch (err) {
        console.warn(`The planet's ${g} couldn't be prepared.`, err);
      }
    };
    const reveal = (g: SummonGroup, root: Object3D | null) => {
      this.revealed.set(g, performance.now());
      if (root) root.visible = true;
      try {
        this.onReveal.get(g)?.(performance.now());
      } catch (err) {
        console.warn(`The planet's ${g} couldn't be revealed.`, err);
      }
      performance.mark(`game:group:${g}`);
    };
    if (this.instant) {
      // (tests: every group at once, in the same order, with no pops: software rendering's frames are slow)
      await Promise.all(SUMMON_GROUPS.map(prepare));
      const roots = await Promise.all(SUMMON_GROUPS.map((g) => this.mount(g)));
      for (const root of roots) if (root) await this.compile(root);
      SUMMON_GROUPS.forEach((g, i) => reveal(g, roots[i]));
    } else
      for (const g of SUMMON_GROUPS) {
        await prepare(g);
        const root = await this.mount(g);
        if (root) await this.compile(root);
        reveal(g, root);
      }
    // everything held by a group that never came is released (it can't be seen, but it can't wait forever)
    for (const h of this.held.splice(0)) this.host.simObstacles.push(h.o);
    this.tier = 'complete';
    this.host.store.setState({ loadTier: 'complete' });
    performance.mark('game:complete');
    this.finish();
  }

  private mount(g: SummonGroup): Promise<Object3D | null> {
    if (this.groups.has(g)) return Promise.resolve(this.groups.get(g) ?? null);
    return new Promise((resolve) => {
      // (a group with nothing to draw never mounts: it's given up after a few frames)
      const timer = window.setTimeout(() => {
        this.waiting.delete(g);
        resolve(null);
      }, 3000);
      this.waiting.set(g, (o) => {
        window.clearTimeout(timer);
        resolve(o);
      });
      this.host.store.setState({ mounted: [...this.host.store.getState().mounted, g] });
    });
  }

  /** The group's programs, compiled on their own (in parallel where the driver can) before it's first drawn. */
  private async compile(root: Object3D): Promise<void> {
    const gfx = this.host.gfx;
    const camera = this.host.camera;
    if (!gfx || !camera || !gfx.gl.compileAsync) return;
    const { gl, scene } = gfx;
    // (the scene draws into the composer's linear buffer: compile for a render target, as the warm-up does)
    const prev = gl.getRenderTarget();
    const target = new WebGLRenderTarget(1, 1);
    gl.setRenderTarget(target);
    const compiling: Promise<unknown>[] = [];
    // (the shadow casters' depth programs too: each mesh briefly wears the material its shadow is drawn with)
    const worn: Array<[Mesh, Material | Material[]]> = [];
    try {
      compiling.push(gl.compileAsync(root, camera, scene as never));
      const vsm = gl.shadowMap.type === VSMShadowMap;
      // (only what will cast a shadow when the group appears: a model hidden until it's built compiles its own later)
      const shown = root.visible;
      root.visible = true;
      root.traverseVisible((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || !mesh.castShadow || !gl.shadowMap.enabled) return;
        worn.push([mesh, mesh.material]);
      });
      root.visible = shown;
      const casters = new Set(worn.map(([m]) => m));
      for (const [mesh] of worn) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => shadowDepthMaterial(mesh, m, vsm)) : shadowDepthMaterial(mesh, mesh.material, vsm);
      // (everything else wears nothing meanwhile, so its own programs aren't compiled again without the fog)
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.material || casters.has(m)) return;
        worn.push([m, m.material]);
        m.material = [];
      });
      // (the shadow pass draws without the scene's fog: its programs are keyed without it)
      const fog = (scene as { fog?: unknown }).fog;
      (scene as { fog?: unknown }).fog = null;
      try {
        if (casters.size) compiling.push(gl.compileAsync(root, camera, scene as never));
      } finally {
        (scene as { fog?: unknown }).fog = fog;
      }
    } finally {
      for (const [mesh, m] of worn) mesh.material = m;
      gl.setRenderTarget(prev);
    }
    // the textures go up while the driver compiles, a few a frame (an upload can take a few ms)
    let t0 = performance.now();
    for (const t of texturesOf(root)) {
      gl.initTexture(t);
      if (performance.now() - t0 > SLICE.ms) {
        await frame();
        t0 = performance.now();
      }
    }
    await Promise.race([Promise.all(compiling).catch(() => undefined), new Promise((r) => setTimeout(r, 4000))]);
    target.dispose();
    // and each new program's uniforms are looked up now (a program does it on its first use), and the
    // skinned meshes' bounds measured (on their first frustum test): a few a frame, not all in one
    t0 = performance.now();
    const slice = async () => {
      if (performance.now() - t0 < SLICE.ms) return;
      await frame();
      t0 = performance.now();
    };
    for (const p of (gl.info.programs ?? []) as unknown as Array<{ getUniforms(): unknown; isReady(): boolean }>) {
      if (!p.isReady()) continue;
      p.getUniforms();
      await slice();
    }
    const skinned: SkinnedMesh[] = [];
    root.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && (o as SkinnedMesh).boundingSphere === null && skinned.push(o as SkinnedMesh));
    for (const m of skinned) {
      m.computeBoundingSphere();
      await slice();
    }
  }

  /** For tests and diagnostics (`__game.loadStage()`). */
  stage(): { tier: LoadTier; revealed: SummonGroup[]; held: number } {
    return { tier: this.tier, revealed: [...this.revealed.keys()], held: this.held.length };
  }
}
