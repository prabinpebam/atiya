import { Vector3, type Camera } from 'three';
import { CONFIG } from './config';
import type { LandmarkData, MoveIntent } from './types';
import { arrivalOrientation, landmarkGeometry, type LandmarkGeometry } from './math/landmarks';
import { UP, arcDistance, type Obstacle } from './math/sphere';
import { PlanetSim } from './systems/movement';
import { InteractBuffer, updateProximity } from './systems/proximity';
import { generateProps, type PropLayout } from './world/layout';
import { KeyboardInput } from './input/keyboard';
import { createGameStore, selectReducedMotion, type GameStore } from './state/store';
import { buildPlaySearch, classicHrefFor, parsePlayUrl } from './platform/url';
import { prefs } from './platform/prefs';
import { DAY_HOURS, START_HOURS, localHours, type TimeMode } from './world/timeOfDay';

const PLAY_PATH = '/play/';

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
  readonly keyboard = new KeyboardInput();
  readonly fadeEl: { current: HTMLDivElement | null } = { current: null };
  region: HTMLDivElement | null = null;
  camera: Camera | null = null;
  /** Totals for the previous frame (all passes: shadows, scene, post). */
  lastRenderInfo = { calls: 0, triangles: 0 };
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
    });
    if (mq) {
      const onChange = () => this.store.setState({ reducedMotionSystem: mq.matches });
      mq.addEventListener('change', onChange);
      this.cleanups.push(() => mq.removeEventListener('change', onChange));
    }

    this.cleanups.push(this.store.subscribe((s, prev) => {
      if (s.nearbyId !== prev.nearbyId || s.openId !== prev.openId) this.syncClassicLinks();
    }));
    this.initFromUrl();
    const onPop = () => this.onPopState();
    window.addEventListener('popstate', onPop);
    const onVis = () => document.hidden && this.keyboard.clear();
    document.addEventListener('visibilitychange', onVis);
    this.cleanups.push(() => window.removeEventListener('popstate', onPop), () => document.removeEventListener('visibilitychange', onVis));
    this.syncClassicLinks();
  }

  dispose(): void {
    this.cleanups.forEach((c) => c());
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
    this.focusRegion();
  }

  focusRegion(): void {
    this.region?.focus({ preventScroll: true });
  }

  // ---------- per-frame ----------

  tick(delta: number): void {
    if (this.paused) return;
    this.step(delta);
  }

  /** Advance simulation + proximity by one step (also used by the test hook). */
  step(delta: number): void {
    const s = this.store.getState();
    const playing = s.phase === 'playing' && !s.openId && !s.menuOpen;
    const intent: MoveIntent = playing ? this.keyboard.intent() : { x: 0, y: 0, run: false };
    this.sim.step(delta, intent);

    for (const e of this.sim.drainEvents()) {
      if (e.type === 'travel-complete') {
        this.store.setState({ traveling: null });
        this.focusRegion();
        this.onArrive?.();
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
    this.keyboard.down(action);
    if (this.sim.autoWalk && action !== 'run') this.sim.cancelAutoWalk();
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
