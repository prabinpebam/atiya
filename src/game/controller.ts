import { Quaternion, Vector3, type Camera } from 'three';
import { CONFIG } from './config';
import type { LandmarkData, MoveIntent } from './types';
import { arrivalOrientation, landmarkGeometry, type LandmarkGeometry } from './math/landmarks';
import { DEG, UP, arcDistance, clamp, damp, wrapAngle, type Obstacle } from './math/sphere';
import { northScreenAngle } from './math/compass';
import { PlanetSim } from './systems/movement';
import { InteractBuffer, updateProximity } from './systems/proximity';
import { generateProps, type PropLayout } from './world/layout';
import { Terrain, wadeSpeedFactor } from './world/terrain';
import { KeyboardInput, VIEW_HOLD_ACTIONS } from './input/keyboard';
import { createGameStore, selectReducedMotion, type GameStore } from './state/store';
import { buildPlaySearch, classicHrefFor, parsePlayUrl } from './platform/url';
import { prefs } from './platform/prefs';
import { DAY_HOURS, START_HOURS, localHours, type TimeMode } from './world/timeOfDay';
import { riverDistance } from './world/features';
import { SoundEngine } from './audio/engine';
import { streamLevel, surfaceAt, type Surface } from './audio/audioLogic';

const PLAY_PATH = '/play/';
/** Travel id for "reset position" (the spawn plaza is not a landmark). */
const PLAZA = 'plaza';

const clampPitch = (deg: number) => clamp(deg, CONFIG.camera.minPitchDeg, CONFIG.camera.maxPitchDeg);
const _toStream = new Vector3();
const _camRight = new Vector3();

interface KeyEventLike {
  code: string;
  repeat: boolean;
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
  /** Adaptive-quality step (set by the Adaptive component; exposed to tests). */
  adaptiveStep: ((dir: -1 | 1, force?: boolean) => void) | null = null;
  /** Active post-processing chain (for tests/diagnostics). */
  postFx = 'none';
  /** Planet clock in hours [0, 24), advanced by the DayNight rig. */
  timeOfDay: number;
  /** Test hook: hold the clock at `timeOfDay`. */
  timeFrozen = false;
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
    });
    this.sound = new SoundEngine(this.store.getState().soundOn);
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
      const duck = Boolean(s.openId || s.menuOpen);
      if (duck !== Boolean(prev.openId || prev.menuOpen)) this.sound.setDucked(duck);
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
    const playing = s.phase === 'playing' && !s.openId && !s.menuOpen;
    const intent: MoveIntent = playing ? this.keyboard.intent() : { x: 0, y: 0, run: false };
    this.updateView(delta, playing, selectReducedMotion(s));
    const dt = Math.min(Math.max(delta, 0), CONFIG.maxDt);
    // wading: slower in deeper water (the sim eases toward the new speed)
    this.sim.speedFactor = wadeSpeedFactor(this.terrain.waterDepth(this.sim.pLocal));
    this.sim.step(delta, intent);
    // follow the ground (hills, the bridge deck, the stream bed when wading) with a little smoothing
    this.lift = damp(this.lift, this.terrain.walkHeight(this.sim.pLocal), 14, dt);
    this.wadeDepth = damp(this.wadeDepth, this.terrain.waterDepth(this.sim.pLocal), 14, dt);

    for (const e of this.sim.drainEvents()) {
      if (e.type === 'travel-complete') {
        this.store.setState({ traveling: null });
        this.focusRegion();
        this.onArrive?.();
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
    return s.phase === 'playing' && !s.openId && !s.menuOpen && !this.sim.travel;
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
    this.store.setState({ menuOpen: false, nearbyId: null, traveling: mode });
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
      if (!e.repeat) this.openMenu();
      return;
    }
    if (action === 'faceNorth' || action === 'home') {
      if (e.repeat || s.phase !== 'playing') return;
      if (action === 'faceNorth') this.faceNorth();
      else this.returnHome();
      return;
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
    if (nearbyId) this.openLandmark(nearbyId);
    else this.buffer.press(performance.now());
  }

  /** Planet click/tap: walk to a world-space surface point. */
  walkToWorldPoint(point: Vector3): void {
    const s = this.store.getState();
    if (s.phase === 'ready') this.start();
    if (this.store.getState().phase !== 'playing' || s.openId || s.menuOpen || this.sim.travel) return;
    const local = point.clone().normalize().applyQuaternion(this.sim.planetQ.clone().invert());
    this.sim.startAutoWalk(local);
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
    this.store.setState({ menuOpen: false, nearbyId: null, traveling: mode });
    this.keyboard.clear();
    this.sim.startTravel(arrivalOrientation(g), id, mode);
    this.focusRegion();
  }

  teleport(id: string | 'plaza'): void {
    if (id === 'plaza') {
      this.sim.setOrientation(this.sim.planetQ.clone().identity());
    } else {
      const g = this.geoById.get(id);
      if (g) this.sim.setOrientation(arrivalOrientation(g));
    }
    const next = updateProximity(null, this.sim.pLocal, this.geos);
    if (next !== this.store.getState().nearbyId) this.setNearby(next);
  }

  // ---------- menu / settings ----------

  openMenu(): void {
    const s = this.store.getState();
    if (s.openId) return;
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

  setSound(on: boolean): void {
    prefs.setSound(on);
    this.sound.setEnabled(on);
    this.store.setState({ soundOn: on });
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
