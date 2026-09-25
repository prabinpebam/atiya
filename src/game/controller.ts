import type { ComponentType } from 'react';
import { Quaternion, Vector3, type Camera, type Scene, type WebGLRenderer } from 'three';
import { CONFIG } from './config';
import type { LandmarkData, MoveIntent } from './types';
import { arrivalOrientation, landmarkGeometry, type LandmarkGeometry } from './math/landmarks';
import { DEG, UP, arcDistance, clamp, damp, dampAngle, wrapAngle, type Obstacle } from './math/sphere';
import { northScreenAngle } from './math/compass';
import { PlanetSim } from './systems/movement';
import { InteractBuffer, updateProximity } from './systems/proximity';
import { SeatMotion, benchSeats, type Seat } from './systems/seating';
import { REACH, buildTargets, pickTarget, targetLabel, type Target } from './systems/interactables';
import { ActionRunner, actionFor, type BeatKind } from './systems/actions';
import { Inventory, type Stack } from './inventory/inventory';
import { BLOOM_COLOURS, flowerItem, itemDef, stackLabel, type ItemId } from './inventory/items';
import { Drops } from './world/dropSim';
import { Harvest } from './world/harvest';
import { FRUIT_SPOTS } from './world/foliage';
import { propPoint } from './world/propFrame';
import { generateProps, type PropLayout } from './world/layout';
import { Terrain, wadeSpeedFactor } from './world/terrain';
import { KeyboardInput, VIEW_HOLD_ACTIONS } from './input/keyboard';
import { createGameStore, selectAmbientPaused, selectReducedMotion, type GameStore } from './state/store';
import { ChopperBrain, type DogWorld, type Spot } from './world/chopper/brain';
import { buildPlaySearch, classicHrefFor, parsePlayUrl } from './platform/url';
import { prefs } from './platform/prefs';
import { DAY_HOURS, START_HOURS, localHours, wrapHours, type TimeMode } from './world/timeOfDay';
import { riverDistance } from './world/features';
import { SoundEngine } from './audio/engine';
import { streamLevel, surfaceAt, type Surface } from './audio/audioLogic';
import { characterById, type CharacterId } from './player/characters';

const PLAY_PATH = '/play/';
/** Travel id for "reset position" (the spawn plaza is not a landmark). */
const PLAZA = 'plaza';

const clampPitch = (deg: number) => clamp(deg, CONFIG.camera.minPitchDeg, CONFIG.camera.maxPitchDeg);
const _toStream = new Vector3();
const _camRight = new Vector3();
const _seatFacing = new Vector3();
const _fwd = new Vector3();
const _feet = new Vector3();
const _v = new Vector3();
const _side = new Vector3();
const _invQ = new Quaternion();
const NO_INTENT: MoveIntent = { x: 0, y: 0, run: false };

interface KeyEventLike {
  code: string;
  repeat: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target: EventTarget | null;
  preventDefault(): void;
}

export interface ShellElements {
  classicLinks: HTMLAnchorElement[];
  hudActions: HTMLElement | null;
}

/**
 * Owns simulation, input, proximity, history and focus. React components render its state;
 * all game rules live here or in the pure modules it calls.
 */
export class GameController {
  readonly store: GameStore;
  readonly sim: PlanetSim;
  readonly geos: LandmarkGeometry[];
  readonly geoById: Map<string, LandmarkGeometry>;
  readonly dataById: Map<string, LandmarkData>;
  readonly props: PropLayout;
  /** Ground height model (undulation, river bed, pond bowl, mesas, bridge deck). */
  readonly terrain: Terrain;
  /** Benches you can sit on, and the sit-down / stand-up motion (its `pose` drives the avatars). */
  readonly seats: Seat[];
  readonly seatMotion = new SeatMotion();
  /** Everything E can use (collection-inventory.md §3.1), the action cycle playing, and what's regrowing. */
  readonly targets: Target[];
  readonly action = new ActionRunner();
  readonly harvest = new Harvest();
  /** Items lying in the world, and the backpack + chest they go into. */
  readonly drops = new Drops();
  readonly inventory = new Inventory();
  /** Chopper, the companion dog (chopper.md): his mind, and the world as he sees it. */
  readonly chopper = new ChopperBrain();
  readonly dogWorld: DogWorld;
  /** His body in the scene (`world/Chopper.tsx`), loaded as its own chunk before the scene mounts; null if it failed. */
  chopperView: ComponentType<{ controller: GameController }> | null = null;
  /** Whistles so far (for tests), and when the last one was (ms). */
  whistles = 0;
  private whistleAt = -1e9;
  private chopperInvoker: HTMLElement | null = null;
  /** Mining hits so far (the boulder shudders on each). */
  mineHits = 0;
  /** How open the chest's lid is (0 shut … 1 open; eased by the Chest component). */
  chestLid = 0;
  private saveTimer: number | undefined;
  private fullWarned = false;
  /** Smoothed height of the ground under the player (u above the base sphere). */
  lift = 0;
  /** Smoothed depth of the water the player is wading in (u; 0 on land). */
  wadeDepth = 0;
  /** Wading effects, maintained by WadeFx: live wake rings and whether the leg foam shows. */
  readonly wake = { ripples: 0, collar: false };
  readonly keyboard = new KeyboardInput();
  readonly fadeEl: { current: HTMLDivElement | null } = { current: null };
  region: HTMLDivElement | null = null;
  camera: Camera | null = null;
  /** The ambient wildlife simulation (set by the Wildlife component; read by the test hook). */
  wildlife: import('./world/animals').Wildlife | null = null;
  /** Renderer and scene, for diagnostics (the test hook's `perfStats`). */
  gfx: { gl: WebGLRenderer; scene: Scene } | null = null;
  /** Totals for the previous frame (all passes: shadows, scene, post). */
  lastRenderInfo = { calls: 0, triangles: 0 };
  /** Hand angles last drawn on the town-hall clock (radians clockwise from 12), or null before the first frame. */
  clockHands: { hour: number; minute: number; second: number } | null = null;
  /** Bridge lanterns: how many there are, how lit they are (0 by day … 1 at night) and their point lights' peak intensity. */
  readonly bridgeLamps = { count: 0, lit: 0, intensity: 0 };
  /** Landmark doors (the amphitheater's curtain): how open each is (0 shut … 1 open) and where its warm light sits (planet space). */
  readonly doors = new Map<string, { open: number; light: Vector3 | null; curtain: boolean }>();
  /** The shared door light: the landmark it's shining from (null when dark) and its intensity. */
  readonly doorLight: { id: string | null; intensity: number } = { id: null, intensity: 0 };
  /** Sound effects (ambience, footsteps, cues); silent until the player starts with sound on. */
  readonly sound: SoundEngine;
  /** The surface under the last footstep (for tests). */
  lastStepSurface: Surface | null = null;
  /** Called when a fast travel lands (the avatar plays a little hop). */
  onArrive: (() => void) | null = null;
  /** Which avatar is on screen: the rigged model, or the procedural fallback (loading / failed). */
  avatar: 'model' | 'procedural' = 'procedural';
  /** Which character's model is on screen (null while the procedural stand-in shows). */
  avatarModel: CharacterId | null = null;
  /** Occlusion-outline meshes on the current avatar (diagnostics). */
  outlines = 0;
  /** Adaptive-quality step (set by the Adaptive component; exposed to tests). */
  adaptiveStep: ((dir: -1 | 1, force?: boolean) => void) | null = null;
  /** Active post-processing chain (for tests/diagnostics). */
  postFx = 'none';
  /** Final grade: scene exposure and how the tilt-shift image is blended (diagnostics). */
  grading = { exposure: 1, tiltBlend: '' };
  /** Planet clock in hours [0, 24), advanced by the DayNight rig. */
  timeOfDay: number;
  /** Test hook: hold the clock at `timeOfDay`. */
  timeFrozen = false;
  /** True while the visitor drags the time badge: the clock holds wherever they put it. */
  timeHeld = false;
  /** Latest day–night values shared with scene components (0 = day, 1 = night). */
  readonly sky = { night: 0, glow: 0.5 };
  /** Latest wind values (driven by WindFx): strength 0.3…1, gust 0…1, live leaf and swirl counts. */
  readonly wind = { strength: 0.3, gust: 0, time: 0, leaves: 0, swirls: 0 };
  /** Test hook: force the gust level (0…1); null follows the natural wind. */
  windOverride: number | null = null;
  /** User view: camera pitch (deg, eased toward `targetPitch`) and an animated yaw still to apply (rad). */
  readonly view = { pitch: CONFIG.camera.pitchDeg as number, targetPitch: CONFIG.camera.pitchDeg as number, yawPending: 0 };
  /** True once the current pointer gesture became a view drag (so its click doesn't walk). */
  viewDragged = false;
  private drag: { id: number; x: number; y: number; lastX: number; lastY: number; active: boolean } | null = null;
  paused = false;
  private readonly buffer = new InteractBuffer();
  private invoker: HTMLElement | null = null;
  private pendingOpen: string | null = null;
  private toastTimer: number | undefined;
  private announceToggle = false;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    readonly landmarks: LandmarkData[],
    private readonly shell: ShellElements,
    opts: { quality?: 'high' | 'low' } = {},
  ) {
    const sorted = [...landmarks].sort((a, b) => a.order - b.order);
    this.landmarks = sorted;
    this.geos = sorted.map((l) => landmarkGeometry(l));
    this.geoById = new Map(this.geos.map((g) => [g.id, g]));
    this.dataById = new Map(sorted.map((l) => [l.id, l]));
    this.props = generateProps(this.geos);
    this.terrain = new Terrain(this.geos, this.props);
    this.stampPropHeights();
    const obstacles: Obstacle[] = [...this.geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...this.props.obstacles];
    this.sim = new PlanetSim(obstacles);
    this.seats = benchSeats(this.props.furniture);
    this.targets = buildTargets(this.props, this.seats, this.props.chest, BLOOM_COLOURS.length);
    this.dogWorld = this.buildDogWorld(obstacles);
    // he moves, so his target is his own position vector (updated in place)
    this.targets.push({ kind: 'dog', key: 'dog', n: this.chopper.n, edgeU: 0, reachU: REACH.dog, standU: 0.8, index: 0, scale: 1 });
    this.inventory.load(prefs.getInventory());

    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const timeMode = prefs.getTimeMode();
    this.timeOfDay = timeMode === 'local' ? localHours() : timeMode === 'day' ? DAY_HOURS : START_HOURS;
    this.store = createGameStore({
      reducedMotionSystem: Boolean(mq?.matches),
      reducedMotionUser: prefs.getReduceMotion(),
      pauseAmbient: prefs.getPauseAmbient(),
      quality: opts.quality ?? 'high',
      timeMode,
      soundOn: prefs.getSound(),
      musicOn: prefs.getMusic(),
      character: prefs.getCharacter(),
    });
    this.sound = new SoundEngine(this.store.getState().soundOn, Math.random, this.store.getState().musicOn);
    if (mq) {
      const onChange = () => this.store.setState({ reducedMotionSystem: mq.matches });
      mq.addEventListener('change', onChange);
      this.cleanups.push(() => mq.removeEventListener('change', onChange));
    }

    this.cleanups.push(this.store.subscribe((s, prev) => {
      if (s.nearbyId !== prev.nearbyId || s.openId !== prev.openId) this.syncClassicLinks();
      // a landmark's door opens while you stand at it (not mid-travel): chime + door, and it shuts behind you
      const door = s.traveling ? null : s.nearbyId;
      const was = prev.traveling ? null : prev.nearbyId;
      if (door !== was) {
        if (was) this.sound.leave(this.doorKind(was));
        if (door) this.sound.approach(this.doorKind(door));
      }
      const duck = Boolean(s.openId || s.menuOpen || s.chopperOpen);
      if (duck !== Boolean(prev.openId || prev.menuOpen || prev.chopperOpen)) this.sound.setDucked(duck);
    }));
    this.initFromUrl();
    const onPop = () => this.onPopState();
    window.addEventListener('popstate', onPop);
    const onVis = () => {
      if (document.hidden) this.keyboard.clear();
      this.sound.setHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVis);
    // browsers only let audio start from a user gesture: any press once playing unlocks it
    const onGesture = () => {
      if (this.store.getState().phase === 'playing') this.sound.unlock();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    this.cleanups.push(
      () => window.removeEventListener('popstate', onPop),
      () => document.removeEventListener('visibilitychange', onVis),
      () => window.removeEventListener('pointerdown', onGesture, true),
      () => window.removeEventListener('keydown', onGesture, true),
    );
    this.syncClassicLinks();
    this.forwardLocal(this.dogWorld.playerFwd);
    this.chopper.placeNear(this.dogWorld);
  }

  dispose(): void {
    this.cleanups.forEach((c) => c());
    this.endDrag();
    this.sound.dispose();
  }

  private stampPropHeights(): void {
    const p = this.props;
    const lists = [p.hardwood, p.fruit, p.cedar, p.bushes, p.flowerBushes, p.rocks, p.boulders, p.pebbles, p.grass, ...Object.values(p.flowers)];
    for (const list of lists) for (const it of list) it.h = this.terrain.height(it.n);
  }

  get hudActions(): HTMLElement | null {
    return this.shell.hudActions;
  }

  // ---------- lifecycle ----------

  /** Called once the first frames have rendered (shaders compiled). */
  markReady(): void {
    if (this.store.getState().phase !== 'loading') return;
    performance.mark('game:playable');
    if (this.pendingOpen) {
      const id = this.pendingOpen;
      this.pendingOpen = null;
      this.store.setState({ phase: 'playing' });
      this.openLandmark(id, { push: false });
      return;
    }
    this.store.setState({ phase: 'ready' });
  }

  start(): void {
    if (this.store.getState().phase === 'playing') return;
    this.store.setState({ phase: 'playing', hintVisible: !prefs.getOnboardingSeen() });
    this.sound.unlock();
    this.focusRegion();
  }

  focusRegion(): void {
    this.region?.focus({ preventScroll: true });
  }

  // ---------- per-frame ----------

  tick(delta: number): void {
    if (this.paused) return;
    this.step(delta);
    this.updateSound(delta);
  }

  /** Ambience for this frame: wind from WindFx, the stream by distance (panned toward it), birds by day. */
  private updateSound(delta: number): void {
    const river = this.props.river;
    let stream = 0;
    let pan = 0;
    if (river) {
      const rd = riverDistance(river, this.sim.pLocal);
      const edge = rd.d - river.halfWidth[rd.i];
      stream = streamLevel(edge);
      if (stream > 0 && this.camera) {
        _toStream.copy(river.samples[rd.i]).sub(this.sim.pLocal).applyQuaternion(this.sim.planetQ);
        _camRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
        const len = _toStream.length();
        // centred once you're at (or in) the water
        if (len > 1e-6) pan = clamp(_toStream.dot(_camRight) / len, -1, 1) * 0.7 * clamp(edge / 1.5, 0, 1);
      }
    }
    this.sound.update(delta, { strength: this.wind.strength, gust: this.wind.gust, stream, streamPan: pan, night: this.sky.night });
    // Chopper's panting, only up close
    const ear = this.dogEar();
    const s = this.store.getState();
    const panting = !this.sim.travel && !selectAmbientPaused(s) && !s.chopperOpen ? this.chopper.pant : 0;
    this.sound.setPant(panting * ear.near * ear.near, ear.pan);
  }

  /** A foot touched the ground (called by the avatars): play the step for the surface underfoot. */
  footstep(): void {
    const s = this.store.getState();
    if (s.phase !== 'playing' || this.sim.travel || this.sim.speed < 0.3) return;
    const surface = surfaceAt(this.sim.pLocal, this.geos, this.terrain, this.wadeDepth);
    this.lastStepSurface = surface;
    this.sound.step(surface, this.sim.speed > CONFIG.walkSpeed + 0.5);
  }

  private doorKind(id: string): 'door' | 'curtain' | null {
    const d = this.doors.get(id);
    return d ? (d.curtain ? 'curtain' : 'door') : null;
  }

  /** Advance simulation + proximity by one step (also used by the test hook). */
  step(delta: number): void {
    const s = this.store.getState();
    const playing = s.phase === 'playing' && !s.openId && !s.menuOpen && !s.invScreen && !s.chopperOpen;
    const seat = this.seatMotion;
    const intent: MoveIntent = playing && !seat.stage && !this.action.busy ? this.keyboard.intent() : NO_INTENT;
    this.updateView(delta, playing, selectReducedMotion(s));
    const dt = Math.min(Math.max(delta, 0), CONFIG.maxDt);
    // wading: slower in deeper water (the sim eases toward the new speed)
    this.sim.speedFactor = wadeSpeedFactor(this.terrain.waterDepth(this.sim.pLocal));
    this.sim.step(delta, intent);
    this.stepSeat(dt, selectReducedMotion(s));
    this.stepAction(dt, selectReducedMotion(s));
    this.harvest.step(dt);
    this.stepDrops(dt, s);
    this.stepChopper(dt, s);
    // follow the ground (hills, the bridge deck, the stream bed when wading) with a little smoothing
    this.lift = damp(this.lift, this.terrain.walkHeight(this.sim.pLocal), 14, dt);
    this.wadeDepth = damp(this.wadeDepth, this.terrain.waterDepth(this.sim.pLocal), 14, dt);

    for (const e of this.sim.drainEvents()) {
      if (e.type === 'travel-complete') {
        this.store.setState({ traveling: null });
        this.focusRegion();
        this.onArrive?.();
        // he's there waiting when you land
        this.forwardLocal(this.dogWorld.playerFwd);
        this.chopper.placeNear(this.dogWorld);
        if (e.id === PLAZA) this.announce('Back at the plaza, facing north.');
      } else if (e.type === 'autowalk-blocked') {
        this.showToast("Can't get through that way — try another path.");
      }
    }
    this.updateFade();

    if (!this.sim.travel) {
      const next = updateProximity(s.nearbyId, this.sim.pLocal, this.geos);
      if (next !== s.nearbyId) this.setNearby(next);
      if (next && playing && this.buffer.consume(performance.now())) this.openLandmark(next);
      this.updateTarget(s, playing, Boolean(next));
    }

    if (s.hintVisible && this.sim.movingTime >= CONFIG.onboardingDismissSeconds) {
      prefs.setOnboardingSeen();
      this.store.setState({ hintVisible: false });
    }
  }

  private updateFade(): void {
    const el = this.fadeEl.current;
    if (!el) return;
    const t = this.sim.travelState;
    el.style.opacity = t && t.mode === 'fade' ? String(1 - Math.abs(2 * t.progress - 1)) : '0';
  }

  // ---------- view: rotate, tilt, compass ----------

  private updateView(delta: number, playing: boolean, reduced: boolean): void {
    const dt = Math.min(Math.max(delta, 0), CONFIG.maxDt);
    const C = CONFIG.camera;
    const v = this.view;
    if (playing) {
      const held = this.keyboard.viewIntent();
      if (held.rotate) this.sim.rotateView(held.rotate * C.rotateSpeed * dt);
      if (held.tilt) v.targetPitch = clampPitch(v.targetPitch + held.tilt * C.tiltSpeedDeg * dt);
    }
    if (this.sim.travel) v.yawPending = 0;
    else if (v.yawPending !== 0) {
      const step = reduced || Math.abs(v.yawPending) < 1e-3 ? v.yawPending : v.yawPending * (1 - Math.exp(-10 * dt));
      this.sim.rotateView(step);
      v.yawPending -= step;
    }
    v.pitch = reduced ? v.targetPitch : damp(v.pitch, v.targetPitch, 10, dt);
  }

  /** Screen angle of map north (rad, clockwise from screen-up), including any rotation still easing in. */
  northAngle(): number {
    return northScreenAngle(this.sim.planetQ, this.sim.pLocal);
  }

  private canUseView(): boolean {
    const s = this.store.getState();
    return s.phase === 'playing' && !s.openId && !s.menuOpen && !s.invScreen && !s.chopperOpen && !this.sim.travel;
  }

  /** Button step: +1 turns the scene counter-clockwise, −1 clockwise. */
  rotateViewStep(dir: 1 | -1): void {
    if (!this.canUseView()) return;
    this.view.yawPending += dir * CONFIG.camera.rotateStepDeg * DEG;
  }

  /** Button step: +1 tilts toward a top-down view, −1 toward a side view. */
  tiltViewStep(dir: 1 | -1): void {
    if (!this.canUseView()) return;
    this.view.targetPitch = clampPitch(this.view.targetPitch + dir * CONFIG.camera.tiltStepDeg);
  }

  /** Turn so north is screen-up, and restore the default tilt. The player stays put. */
  faceNorth(): void {
    if (!this.canUseView()) return;
    this.view.yawPending = wrapAngle(this.northAngle());
    this.view.targetPitch = CONFIG.camera.pitchDeg;
    this.announce('Facing north.');
  }

  /** Reset position and direction: travel back to the plaza, facing north, default tilt. */
  returnHome(): void {
    const s = this.store.getState();
    if (s.phase !== 'playing' || s.openId) return;
    const mode = selectReducedMotion(s) ? 'fade' : 'flyover';
    this.view.yawPending = 0;
    this.view.targetPitch = CONFIG.camera.pitchDeg;
    this.keyboard.clear();
    this.leaveSeat();
    this.cancelAction();
    this.store.setState({ menuOpen: false, nearbyId: null, target: null, traveling: mode });
    this.sim.startTravel(new Quaternion(), PLAZA, mode);
    this.focusRegion();
  }

  private dragView(dx: number, dy: number): void {
    const C = CONFIG.camera;
    this.view.yawPending = 0;
    this.sim.rotateView(dx * C.dragYawPerPx);
    this.view.targetPitch = clampPitch(this.view.targetPitch + dy * C.dragPitchPerPx);
  }

  /** Pointer down on the planet region: focus/start, and begin a possible drag-to-tumble gesture. */
  onRegionPointerDown = (e: { clientX: number; clientY: number; pointerId: number; button: number }): void => {
    this.focusRegion();
    if (this.store.getState().phase === 'ready') this.start();
    this.viewDragged = false;
    if (e.button !== 0 && e.button !== 2) return;
    this.endDrag();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false };
    window.addEventListener('pointermove', this.onDragMove);
    window.addEventListener('pointerup', this.onDragEnd);
    window.addEventListener('pointercancel', this.onDragEnd);
  };

  private onDragMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < CONFIG.camera.dragThresholdPx) return;
      d.active = true;
      this.viewDragged = true;
      this.sim.cancelAutoWalk();
      this.region?.classList.add('dragging');
    }
    if (this.canUseView()) this.dragView(e.clientX - d.lastX, e.clientY - d.lastY);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  private onDragEnd = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.id) this.endDrag();
  };

  private endDrag(): void {
    this.drag = null;
    this.region?.classList.remove('dragging');
    window.removeEventListener('pointermove', this.onDragMove);
    window.removeEventListener('pointerup', this.onDragEnd);
    window.removeEventListener('pointercancel', this.onDragEnd);
  }

  private setNearby(id: string | null): void {
    this.store.setState({ nearbyId: id });
    if (id) {
      const d = this.dataById.get(id)!;
      this.announce(`Near ${d.title} — ${d.kicker}. Press E to open.`);
    }
  }

  announce(text: string): void {
    // Toggle a trailing no-break space so repeated messages are re-announced.
    this.announceToggle = !this.announceToggle;
    this.store.setState({ announcement: text + (this.announceToggle ? '\u00a0' : '') });
  }

  showToast(text: string): void {
    this.store.setState({ toast: text });
    this.announce(text);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.store.setState({ toast: null }), 4000);
  }

  // ---------- input ----------

  onKeyDown = (e: KeyEventLike): void => {
    if (e.target !== this.region) return;
    const action = KeyboardInput.actionFor(e.code);
    if (!action) return;
    e.preventDefault();
    const s = this.store.getState();
    if (s.phase === 'ready' && (action === 'interact' || action === 'up' || action === 'down' || action === 'left' || action === 'right')) {
      this.start();
    }
    if (s.phase !== 'playing' && s.phase !== 'ready') return;
    if (action === 'interact') {
      if (e.repeat) return;
      this.interact();
      return;
    }
    if (action === 'menu') {
      if (e.repeat) return;
      if (e.code === 'Escape' && this.seatMotion.seated) this.standUp();
      else this.openMenu();
      return;
    }
    if (action === 'inventory') {
      if (!e.repeat && s.phase === 'playing') this.toggleInventory();
      return;
    }
    if (action === 'whistle') {
      if (!e.repeat && s.phase === 'playing') this.whistle();
      return;
    }
    if (action === 'drop') {
      if (s.phase === 'playing' && !this.action.busy) this.dropSelected(Boolean(e.ctrlKey || e.metaKey));
      return;
    }
    if (action.startsWith('slot')) {
      if (!e.repeat && s.phase === 'playing') this.selectSlot(Number(action.slice(4)) - 1);
      return;
    }
    if (action === 'faceNorth' || action === 'home') {
      if (e.repeat || s.phase !== 'playing') return;
      if (action === 'faceNorth') this.faceNorth();
      else this.returnHome();
      return;
    }
    if (this.seatMotion.seated && (action === 'up' || action === 'down' || action === 'left' || action === 'right')) {
      // a fresh press stands you up (a key still held from walking over doesn't)
      if (e.repeat) return;
      this.standUp();
    }
    this.keyboard.down(action);
    if (this.sim.autoWalk && action !== 'run' && !VIEW_HOLD_ACTIONS.has(action)) this.sim.cancelAutoWalk();
  };

  onKeyUp = (e: KeyEventLike): void => {
    const action = KeyboardInput.actionFor(e.code);
    if (action) this.keyboard.up(action);
  };

  onBlur = (): void => {
    this.keyboard.clear();
  };

  interact(): void {
    const { nearbyId, openId, phase } = this.store.getState();
    if (phase !== 'playing' || openId) return;
    if (this.seatMotion.seated) this.standUp();
    else if (this.action.busy || this.seatMotion.stage) return;
    else if (this.store.getState().target) this.useTarget();
    else if (nearbyId) this.openLandmark(nearbyId);
    else this.buffer.press(performance.now());
  }

  // ---------- benches ----------

  /** Sit on the bench you're standing by (E, or the prompt's button). */
  sitDown(): void {
    const s = this.store.getState();
    const t = this.targets.find((x) => x.key === s.target?.key);
    const seat = t?.seat;
    if (!seat || s.phase !== 'playing' || s.openId || s.menuOpen || s.invScreen || this.sim.travel || this.seatMotion.stage || this.action.busy) return;
    this.sim.cancelAutoWalk();
    this.keyboard.clear();
    this.buffer.clear();
    this.sim.vel.set(0, 0, 0);
    this.seatMotion.sit(seat, this.sim.pLocal);
    this.store.setState({ seated: true, target: null });
    this.announce('Sitting on the bench. Press Escape to stand up.');
  }

  /** Stand up from the bench (Escape, E, a movement key, a click, or the prompt's button). */
  standUp(): void {
    if (!this.seatMotion.seated) return;
    this.seatMotion.stand(this.sim.pLocal);
    this.store.setState({ seated: false });
  }

  /** Leave the seat at once (fast travel, reset). */
  private leaveSeat(): void {
    if (!this.seatMotion.stage) return;
    this.seatMotion.clear();
    this.store.setState({ seated: false });
  }

  /** Move the character along its sit-down / stand-up path, turning it to face out from the bench. */
  private stepSeat(dt: number, reduced: boolean): void {
    const m = this.seatMotion;
    const seat = m.seat;
    const sitting = m.seated;
    const at = m.step(dt, reduced);
    if (!at || !seat) return;
    this.sim.placeAt(at);
    if (sitting) {
      _seatFacing.copy(seat.facing).applyQuaternion(this.sim.planetQ);
      const target = Math.atan2(_seatFacing.x, _seatFacing.z);
      this.sim.heading = reduced ? target : dampAngle(this.sim.heading, target, 0.08, dt);
    }
  }

  // ---------- collecting (collection-inventory.md §3) ----------

  /** The character's forward direction as a planet-local tangent. */
  private forwardLocal(out = _fwd): Vector3 {
    _invQ.copy(this.sim.planetQ).invert();
    out.set(Math.sin(this.sim.heading), 0, Math.cos(this.sim.heading)).applyQuaternion(_invQ);
    return out.addScaledVector(this.sim.pLocal, -out.dot(this.sim.pLocal)).normalize();
  }

  /** Can this target be used right now? (A picked flower can't, until it grows back.) */
  private usable = (t: Target): boolean =>
    t.kind === 'flower' ? this.harvest.flowerHere(t.flower!, t.index) : t.kind === 'dog' ? this.chopper.speed < 1.2 && !this.sim.travel : true;

  private labelFor(t: Target): string {
    return targetLabel(t, t.kind === 'flower' ? itemDef(flowerItem(t.flower!, t.colour ?? 0)).name.toLowerCase() : undefined);
  }

  /** Pick what E would use (the prompt), unless sitting, acting or a screen is open. */
  private updateTarget(s: ReturnType<GameStore['getState']>, allowed: boolean, nearLandmark: boolean): void {
    const busy = !allowed || this.seatMotion.stage || this.action.busy;
    // a thing you're right at takes E over a landmark's area preview (whose card then hides)
    const t = busy ? null : pickTarget(this.sim.pLocal, this.forwardLocal(), this.targets, s.target?.key ?? null, this.usable, CONFIG.planetRadius, nearLandmark);
    if ((t?.key ?? null) === (s.target?.key ?? null)) return;
    this.store.setState({ target: t ? { kind: t.kind, key: t.key, label: this.labelFor(t) } : null });
    if (t) this.announce(t.kind === 'bench' ? 'Near a bench. Press E to sit down.' : t.kind === 'dog' ? 'Chopper is here. Press E to meet him.' : `${this.labelFor(t)}: press E.`);
  }

  /** E on the current target: sit, or play its action cycle. */
  useTarget(): void {
    const s = this.store.getState();
    const t = this.targets.find((x) => x.key === s.target?.key);
    if (!t || s.phase !== 'playing' || s.openId || s.menuOpen || s.invScreen || this.sim.travel || this.action.busy || this.seatMotion.stage) return;
    if (t.kind === 'bench') {
      this.sitDown();
      return;
    }
    if (t.kind === 'dog') {
      this.openChopper();
      return;
    }
    const kind = actionFor(t);
    if (!kind || !this.usable(t)) return;
    this.sim.cancelAutoWalk();
    this.keyboard.clear();
    this.buffer.clear();
    this.sim.vel.set(0, 0, 0);
    this.action.start(kind, t, this.sim.pLocal);
    this.store.setState({ acting: kind, target: null });
  }

  private cancelAction(): void {
    if (!this.action.busy) return;
    this.action.cancel();
    this.store.setState({ acting: null });
  }

  /** Walk the character through its action: step in, face the target, fire the beats. */
  private stepAction(dt: number, reduced: boolean): void {
    const a = this.action;
    const t = a.target;
    const kind = a.kind;
    if (!kind || !t) return;
    const r = a.step(dt, reduced);
    if (r.at) this.sim.placeAt(r.at);
    // face the target (world heading of the tangent from the character to it)
    const to = new Vector3().copy(t.n).addScaledVector(this.sim.pLocal, -t.n.dot(this.sim.pLocal));
    if (to.lengthSq() > 1e-12) {
      to.normalize().applyQuaternion(this.sim.planetQ);
      const h = Math.atan2(to.x, to.z);
      this.sim.heading = reduced ? h : dampAngle(this.sim.heading, h, 0.06, dt);
    }
    for (const b of r.beats) this.beat(kind, t, b);
    if (r.done) this.store.setState({ acting: null });
  }

  private rand = Math.random;

  /** A random sideways kick (planet-local tangent at `n`) of size `k`. */
  private scatter(n: Vector3, k: number, out = _side): Vector3 {
    out.set(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5);
    return out.addScaledVector(n, -out.dot(n)).normalize().multiplyScalar(k * (0.5 + this.rand() * 0.5));
  }

  /** Spawn a drop at planet-local point `p`, flung toward the character (`toward` 0…1) with an upward kick. */
  private spawnDrop(item: ItemId, count: number, p: Vector3, up: number, toward: number, side: number, thrown = false): void {
    const n = p.clone().normalize();
    const v = new Vector3().addScaledVector(n, up).add(this.scatter(n, side));
    const to = this.sim.pLocal.clone().addScaledVector(n, -this.sim.pLocal.dot(n));
    if (to.lengthSq() > 1e-12 && toward) v.addScaledVector(to.normalize(), toward);
    this.drops.spawn(item, count, p, v, { thrown });
  }

  private treeItem(t: Target) {
    return t.tree === 'cedar' ? this.props.cedar[t.index] : t.tree === 'hardwood' ? this.props.hardwood[t.index] : this.props.fruit[t.index];
  }

  /** A beat of an action cycle: things fall, chip off, get picked, or the chest opens. */
  private beat(kind: string, t: Target, b: BeatKind): void {
    const R = CONFIG.planetRadius;
    if (kind === 'shake') {
      const tree = this.treeItem(t);
      if (!tree) return;
      if (b === 'fruit' && (t.tree === 'apple' || t.tree === 'orange') && this.harvest.takeFruit(t.tree, t.index)) {
        // every fruit on the tree falls from where it hung
        for (const spot of FRUIT_SPOTS) this.spawnDrop(t.tree, 1, propPoint(tree, spot, R), 0.4, 0.2, 0.6);
      } else if (b === 'leaf') {
        const cedar = t.tree === 'cedar';
        for (let k = 0; k < 1; k++) {
          const spot: [number, number, number] = [(this.rand() - 0.5) * 1.4, cedar ? 1.2 + this.rand() * 1.2 : 1.7 + this.rand() * 0.6, (this.rand() - 0.5) * 1.4];
          this.spawnDrop('leaves', 1, propPoint(tree, spot, R), 0.3, 0.25, 0.8);
        }
      } else if (b === 'log') {
        this.spawnDrop('log', 1, propPoint(tree, [0, 1.3, 0], R), 0.6, 0.9, 0.5);
      }
      if (b === 'leaf') this.sound.rustle();
    } else if (kind === 'mine' && b === 'hit') {
      this.mineHits++;
      // a chip flies off the boulder's face toward the character
      const toMe = this.sim.pLocal.clone().addScaledVector(t.n, -this.sim.pLocal.dot(t.n)).normalize();
      const face = t.n.clone().addScaledVector(toMe, (t.edgeU * 0.9) / R).normalize().multiplyScalar(R + this.terrain.height(t.n) + 0.3 * t.scale);
      this.spawnDrop('stone', 1, face, 2.4, 1.1, 0.9);
      this.sound.hit();
    } else if (kind === 'pick' && b === 'pluck' && t.flower && this.harvest.pickFlower(t.flower, t.index)) {
      const at = t.n.clone().multiplyScalar(R + this.terrain.height(t.n) + 0.18);
      this.spawnDrop(flowerItem(t.flower, t.colour ?? 0), 1, at, 2.2, 0, 0.2);
    } else if (kind === 'open' && b === 'open') {
      this.openInventory('chest');
    }
  }

  /** The drops simulation, collecting into the backpack. */
  private stepDrops(dt: number, s: ReturnType<GameStore['getState']>): void {
    const R = CONFIG.planetRadius;
    const canCollect = s.phase === 'playing' && !this.sim.travel && !s.invScreen && !s.openId;
    const player = canCollect ? _feet.copy(this.sim.pLocal).multiplyScalar(R + this.lift) : null;
    this.drops.step(
      {
        R,
        ground: (n) => this.terrain.walkHeight(n) + this.terrain.waterDepth(n),
        player,
        room: (item, n) => this.inventory.room(item, n),
        collect: (item, n) => {
          this.inventory.add(item, n);
          this.invChanged();
          this.sound.pickup();
          this.announce(`Picked up ${stackLabel(item, n)}.`);
        },
        still: selectReducedMotion(s),
      },
      dt,
    );
    if (this.drops.blockedFull) {
      this.drops.blockedFull = false;
      if (!this.fullWarned) {
        this.fullWarned = true;
        this.showToast('Backpack full — store some in the chest by the Workshop.');
      }
    }
  }

  // ---------- inventory (collection-inventory.md §4) ----------

  /** Something in the backpack / chest changed: re-render and save (debounced). */
  invChanged(): void {
    this.store.setState({ invVersion: this.inventory.version });
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => prefs.setInventory(this.inventory.toJSON()), 250);
  }

  openInventory(screen: 'backpack' | 'chest'): void {
    const s = this.store.getState();
    if (s.phase !== 'playing' || s.openId || s.chopperOpen) return;
    this.keyboard.clear();
    this.sim.cancelAutoWalk();
    this.store.setState({ invScreen: screen, menuOpen: false });
    this.announce(screen === 'chest' ? 'Chest open.' : 'Backpack open.');
  }

  /** Close the screen: the cursor stack goes back into the backpack (what doesn't fit drops at your feet). */
  closeInventory(): void {
    if (!this.store.getState().invScreen) return;
    const left = this.inventory.returnHeld();
    if (left) this.throwStack(left, false);
    this.invChanged();
    this.store.setState({ invScreen: null });
    requestAnimationFrame(() => this.focusRegion());
  }

  toggleInventory(): void {
    if (this.store.getState().invScreen) this.closeInventory();
    else this.openInventory('backpack');
  }

  selectSlot(i: number): void {
    const before = this.inventory.selected;
    this.inventory.select(i);
    if (this.inventory.selected === before) return;
    this.invChanged();
    const st = this.inventory.backpack[this.inventory.selected];
    this.announce(`Slot ${this.inventory.selected + 1}: ${st ? stackLabel(st.id, st.n) : 'empty'}.`);
  }

  /** Mouse wheel over the planet or the hotbar: next / previous hotbar slot. */
  onWheel = (e: { deltaY: number }): void => {
    const s = this.store.getState();
    if (s.phase !== 'playing' || s.openId || s.menuOpen || s.invScreen || s.chopperOpen || !e.deltaY) return;
    this.selectSlot(this.inventory.selected + Math.sign(e.deltaY));
  };

  /** Q / Ctrl+Q: throw one (or the stack) of the selected hotbar item ahead of the character. */
  dropSelected(all: boolean): void {
    const st = this.inventory.dropSelected(all);
    if (!st) return;
    this.throwStack(st, true);
    this.invChanged();
  }

  /** Throw a stack into the world: ahead of the character (`thrown`, 2 s pick-up delay), or at its feet. */
  throwStack(st: Stack, thrown: boolean): void {
    const R = CONFIG.planetRadius;
    const fwd = this.forwardLocal(new Vector3());
    const n = this.sim.pLocal;
    const p = n.clone().multiplyScalar(R + this.lift + 0.7).add(_v.copy(fwd).multiplyScalar(0.3));
    const v = fwd.clone().multiplyScalar(thrown ? 3.2 : 0.8).addScaledVector(n, thrown ? 2.0 : 0.5);
    this.drops.spawn(st.id, st.n, p, v, { thrown: true });
  }

  /** Planet click/tap: walk to a world-space surface point. */
  walkToWorldPoint(point: Vector3): void {
    const s = this.store.getState();
    if (s.phase === 'ready') this.start();
    if (this.store.getState().phase !== 'playing' || s.openId || s.menuOpen || s.chopperOpen || this.sim.travel) return;
    if (this.seatMotion.stage) {
      this.standUp();
      return;
    }
    const local = point.clone().normalize().applyQuaternion(this.sim.planetQ.clone().invert());
    this.sim.startAutoWalk(local);
  }

  // ---------- Chopper (chopper.md) ----------

  /** What he knows of the world: the character, obstacles, the pond, rabbits, and things to sniff. */
  private buildDogWorld(obstacles: readonly Obstacle[]): DogWorld {
    const p = this.props;
    const R = CONFIG.planetRadius;
    const reachable = new Set(obstacles.map((o) => o.n));
    const spots: Spot[] = [];
    const add = (list: readonly { n: Vector3; scale: number }[], kind: Spot['kind'], radius: number, name: string) =>
      list.forEach((it, i) => {
        if (reachable.has(it.n)) spots.push({ n: it.n, radiusU: radius * it.scale, kind, key: `${name}:${i}` });
      });
    add(p.hardwood, 'tree', 0.42, 'hardwood');
    add(p.fruit, 'tree', 0.42, 'fruit');
    add(p.cedar, 'tree', 0.36, 'cedar');
    add(p.rocks, 'rock', 0.36, 'rock');
    add(p.boulders, 'rock', 0.4, 'boulder');
    add(p.bushes, 'bush', 0.42, 'bush');
    add(p.flowerBushes, 'bush', 0.42, 'flowerBush');
    const terrain = this.terrain;
    const pond = p.pond;
    return {
      R,
      player: this.sim.pLocal,
      playerFwd: new Vector3(0, 0, -1),
      playerVel: new Vector3(),
      obstacles,
      // he wades the stream but keeps out of the pond (and anything deep)
      blocked: (n) => (pond ? arcDistance(n, pond.n, R) < terrain.pondShore(n) + 0.05 : false) || terrain.waterDepth(n) > 0.16,
      rabbits: [],
      spots,
    };
  }

  private stepChopper(dt: number, s: ReturnType<GameStore['getState']>): void {
    const w = this.dogWorld;
    this.forwardLocal(w.playerFwd);
    _invQ.copy(this.sim.planetQ).invert();
    w.playerVel.copy(this.sim.vel).applyQuaternion(_invQ);
    w.rabbits = this.wildlife?.rabbits ?? [];
    // while ambient motion is paused he sits where he is (Chopper.tsx poses him)
    if (this.sim.travel || selectAmbientPaused(s) || s.phase === 'loading') return;
    this.chopper.step(dt, w);
    for (const e of this.chopper.events.splice(0)) {
      const { pan, near } = this.dogEar();
      this.sound.dog(e.type === 'sniff' ? 'sniff' : 'bark', pan, near);
    }
  }

  /** Where Chopper is for the ears: stereo pan (−1 left … 1 right on screen) and closeness (1 at your feet … 0 far). */
  dogEar(): { pan: number; near: number } {
    const R = CONFIG.planetRadius;
    const d = arcDistance(this.chopper.n, this.sim.pLocal, R);
    let pan = 0;
    if (this.camera) {
      _v.copy(this.chopper.n).sub(this.sim.pLocal).applyQuaternion(this.sim.planetQ);
      _camRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
      const len = _v.length();
      if (len > 1e-6) pan = clamp(_v.dot(_camRight) / len, -1, 1) * clamp(d / 2, 0, 1);
    }
    return { pan, near: clamp(1 - (d - 1.5) / 10, 0, 1) };
  }

  /** F, or the whistle button: he drops everything and comes (a 2 s cooldown). */
  whistle(): void {
    const s = this.store.getState();
    if (s.phase !== 'playing' || s.openId || s.chopperOpen || this.sim.travel) return;
    const now = performance.now();
    if (now - this.whistleAt < 2000) return;
    this.whistleAt = now;
    this.whistles++;
    this.sound.whistle();
    this.chopper.whistle();
    this.announce('You whistle. Chopper comes running.');
  }

  /** "Meet Chopper": his profile card (he sits by you while it's open). */
  openChopper(invoker?: HTMLElement | null): void {
    const s = this.store.getState();
    if (s.phase !== 'playing' || s.openId || s.chopperOpen) return;
    this.chopperInvoker = invoker ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.keyboard.clear();
    this.buffer.clear();
    this.sim.cancelAutoWalk();
    this.sim.vel.set(0, 0, 0);
    this.sound.open();
    this.chopper.attend(this.dogWorld);
    this.store.setState({ chopperOpen: true, menuOpen: false, target: null });
  }

  closeChopper(): void {
    if (!this.store.getState().chopperOpen) return;
    this.store.setState({ chopperOpen: false });
    const target = this.chopperInvoker;
    this.chopperInvoker = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected && target.getClientRects().length > 0 && target !== this.region) target.focus({ preventScroll: true });
      else this.focusRegion();
    });
  }

  // ---------- landmarks / dialog / history ----------

  openLandmark(id: string, opts: { push?: boolean; invoker?: HTMLElement | null } = {}): void {
    if (!this.geoById.has(id)) return;
    const s = this.store.getState();
    if (s.openId === id) return;
    this.invoker = opts.invoker ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.keyboard.clear();
    this.buffer.clear();
    this.sim.cancelAutoWalk();
    this.sim.vel.set(0, 0, 0);
    if (opts.push !== false) history.pushState({ gameOpen: id }, '', PLAY_PATH + buildPlaySearch(id, true));
    this.sound.open();
    this.store.setState({ openId: id, menuOpen: false });
  }

  /** Close via UI (Esc / close button): goes through history when the game owns the entry. */
  requestCloseLandmark(): void {
    const { openId } = this.store.getState();
    if (!openId) return;
    if ((history.state as { gameOpen?: string } | null)?.gameOpen === openId) {
      history.back(); // popstate performs the close
      return;
    }
    history.replaceState(null, '', PLAY_PATH + buildPlaySearch(openId));
    this.closeLandmarkLocal();
  }

  private closeLandmarkLocal(): void {
    if (!this.store.getState().openId) return;
    this.store.setState({ openId: null });
    const target = this.invoker;
    this.invoker = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected && target.getClientRects().length > 0) target.focus({ preventScroll: true });
      else this.focusRegion();
    });
  }

  private onPopState(): void {
    const url = parsePlayUrl(location.search);
    const { openId } = this.store.getState();
    if (url.open && url.at && this.geoById.has(url.at)) {
      if (openId !== url.at) this.openLandmark(url.at, { push: false });
    } else if (openId) {
      this.closeLandmarkLocal();
    }
  }

  private initFromUrl(): void {
    const url = parsePlayUrl(location.search);
    if (!url.at) return;
    const g = this.geoById.get(url.at);
    if (!g) {
      history.replaceState(null, '', PLAY_PATH);
      window.setTimeout(() => this.showToast("Couldn't find that place — you're at the Plaza."), 0);
      return;
    }
    this.sim.setOrientation(arrivalOrientation(g));
    if (url.open) {
      history.replaceState(null, '', PLAY_PATH + buildPlaySearch(g.id));
      history.pushState({ gameOpen: g.id }, '', PLAY_PATH + buildPlaySearch(g.id, true));
      this.pendingOpen = g.id;
    }
  }

  // ---------- travel ----------

  travelTo(id: string): void {
    const g = this.geoById.get(id);
    if (!g) return;
    const s = this.store.getState();
    if (s.phase !== 'playing') this.store.setState({ phase: 'playing' });
    const mode = selectReducedMotion(s) ? 'fade' : 'flyover';
    this.leaveSeat();
    this.cancelAction();
    this.closeInventory();
    this.store.setState({ menuOpen: false, nearbyId: null, target: null, traveling: mode });
    this.keyboard.clear();
    this.sim.startTravel(arrivalOrientation(g), id, mode);
    this.focusRegion();
  }

  teleport(id: string | 'plaza'): void {
    this.leaveSeat();
    this.cancelAction();
    if (id === 'plaza') {
      this.sim.setOrientation(this.sim.planetQ.clone().identity());
    } else {
      const g = this.geoById.get(id);
      if (g) this.sim.setOrientation(arrivalOrientation(g));
    }
    const next = updateProximity(null, this.sim.pLocal, this.geos);
    if (next !== this.store.getState().nearbyId) this.setNearby(next);
    this.forwardLocal(this.dogWorld.playerFwd);
    this.chopper.placeNear(this.dogWorld);
  }

  // ---------- menu / settings ----------

  openMenu(): void {
    const s = this.store.getState();
    if (s.openId || s.chopperOpen) return;
    if (s.invScreen) this.closeInventory();
    this.keyboard.clear();
    this.store.setState({ menuOpen: true });
  }

  closeMenu(): void {
    this.store.setState({ menuOpen: false });
  }

  setReduceMotion(v: boolean): void {
    prefs.setReduceMotion(v);
    this.store.setState({ reducedMotionUser: v });
  }

  setPauseAmbient(v: boolean): void {
    prefs.setPauseAmbient(v);
    this.store.setState({ pauseAmbient: v });
  }

  /** Switch the player character (remembered). */
  setCharacter(id: CharacterId): void {
    if (this.store.getState().character === id) return;
    prefs.setCharacter(id);
    this.store.setState({ character: id });
    this.announce(`Now playing as the ${characterById(id).label.toLowerCase()}.`);
  }

  setMusic(on: boolean): void {
    prefs.setMusic(on);
    this.sound.setMusic(on);
    this.store.setState({ musicOn: on });
  }

  setSound(on: boolean): void {
    prefs.setSound(on);
    this.sound.setEnabled(on);
    this.store.setState({ soundOn: on });
  }

  /**
   * Set the planet clock by hand (dragging or stepping the time badge). The day–night cycle carries
   * on from there, so a fixed mode (local time / always day) switches to the cycle for this visit;
   * the saved preference is left alone.
   */
  setTimeManually(hours: number): void {
    this.timeFrozen = false;
    this.timeOfDay = wrapHours(hours);
    if (this.store.getState().timeMode !== 'cycle') this.store.setState({ timeMode: 'cycle' });
  }

  setTimeMode(m: TimeMode): void {
    prefs.setTimeMode(m);
    this.timeFrozen = false;
    this.store.setState({ timeMode: m });
  }

  showControls(): void {
    this.store.setState({ hintVisible: true, menuOpen: false });
    this.sim.movingTime = 0;
  }

  // ---------- classic mode ----------

  classicHref(): string {
    const { openId, nearbyId } = this.store.getState();
    return classicHrefFor(openId ?? nearbyId);
  }

  private syncClassicLinks(): void {
    const href = this.classicHref();
    for (const a of this.shell.classicLinks) a.href = href;
  }

  /** Arc distance (u) from the player to a landmark's approach point — for tests and HUD. */
  distanceTo(id: string): number {
    const g = this.geoById.get(id);
    return g ? arcDistance(this.sim.pLocal, g.approach, CONFIG.planetRadius) : Infinity;
  }

  isAtSpawn(): boolean {
    return arcDistance(this.sim.pLocal, UP as Vector3, CONFIG.planetRadius) < 0.01;
  }
}
