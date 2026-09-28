import { Quaternion, Vector3 } from 'three';
import { CONFIG, type Config } from '../config';
import type { MoveIntent } from '../types';
import {
  UP,
  arcDistance,
  clamp,
  damp,
  dampAngle,
  playerLocal,
  resolvePenetration,
  slideVelocity,
  tangentToward,
  wrapAngle,
  type CollisionParams,
  type Obstacle,
} from '../math/sphere';

export type TravelMode = 'flyover' | 'fade';

interface Travel {
  from: Quaternion;
  to: Quaternion;
  elapsed: number;
  duration: number;
  mode: TravelMode;
  id: string;
}

interface AutoWalk {
  target: Vector3;
  windowStart: Vector3;
  windowElapsed: number;
}

export type SimEvent =
  | { type: 'travel-complete'; id: string }
  | { type: 'autowalk-arrived' }
  | { type: 'autowalk-blocked' }
  | { type: 'landed' };

const SPAWN_HEADING = Math.PI; // facing −Z (screen-up)

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * The fly-over in three phases, from its progress (0..1): rise straight up (ease-out), glide over
 * the planet at full height, then drop onto the ground (accelerating, like a fall). `glide` is the
 * eased share of the planet's turn; `hover` is the height as a share of `travelHoverU`. The planet
 * stays still while the character rises and drops, so it never sweeps through anything low.
 */
export function flyoverProfile(progress: number, rise: number, drop: number): { glide: number; hover: number } {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return { glide: 1, hover: 0 };
  if (p < rise) return { glide: 0, hover: 1 - Math.pow(1 - p / rise, 3) };
  if (p > 1 - drop) {
    const f = (p - (1 - drop)) / drop;
    return { glide: 1, hover: 1 - f * f };
  }
  return { glide: easeInOutCubic((p - rise) / Math.max(1e-6, 1 - rise - drop)), hover: 1 };
}

/** A jump (Space): its take-off speed (u/s) and gravity (u/s²): about a third of a unit up, 0.4 s in the air. */
export const JUMP = { v: 3.2, g: 16 };

/**
 * Kinematic "rotate the planet under a fixed player" simulation (spec §5.2–5.3).
 * Pure: no rendering, no DOM. World space = camera frame; the player stands at (0, R, 0).
 */
export class PlanetSim {
  readonly planetQ = new Quaternion();
  /** World-space velocity in the player's tangent plane (y = 0). */
  readonly vel = new Vector3();
  heading = SPAWN_HEADING;
  readonly pLocal = new Vector3(0, 1, 0);
  /** Cumulative seconds spent moving (onboarding dismissal). */
  movingTime = 0;
  travel: Travel | null = null;
  autoWalk: AutoWalk | null = null;
  /** Multiplier on walk/run speed, set by the controller each step (e.g. slower while wading). */
  speedFactor = 1;
  /** A jump: how high the feet are off the ground (u) and how fast they're rising (u/s). It carries on the way you were going. */
  jumpH = 0;
  jumpV = 0;
  /** Soft things the character is squeezing past (collision.md §3), and how long it's pressed on each. */
  readonly passing = new Set<Obstacle>();
  private readonly press = new Map<Obstacle, number>();
  private readonly collision: CollisionParams;
  private readonly events: SimEvent[] = [];

  constructor(
    public obstacles: Obstacle[],
    private readonly cfg: Config = CONFIG,
  ) {
    this.collision = { radius: cfg.planetRadius, playerRadius: cfg.bodyRadius, skin: cfg.skin };
  }

  get speed(): number {
    return this.vel.length();
  }

  /** Travel progress 0..1 and mode, for camera fly-over / fade rendering. */
  get travelState(): { progress: number; mode: TravelMode } | null {
    if (!this.travel) return null;
    return { progress: Math.min(1, this.travel.elapsed / this.travel.duration), mode: this.travel.mode };
  }

  /** How high the character is flying (u above the ground): only during a fly-over. */
  get hover(): number {
    const t = this.travelState;
    if (!t || t.mode !== 'flyover') return 0;
    return flyoverProfile(t.progress, this.cfg.travelRise, this.cfg.travelDrop).hover * this.cfg.travelHoverU;
  }

  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  setOrientation(q: Quaternion, heading = SPAWN_HEADING): void {
    this.planetQ.copy(q).normalize();
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.travel = null;
    this.autoWalk = null;
    playerLocal(this.planetQ, this.pLocal);
  }

  startTravel(to: Quaternion, id: string, mode: TravelMode): void {
    this.autoWalk = null;
    this.vel.set(0, 0, 0);
    this.jumpH = this.jumpV = 0;
    const duration = mode === 'fade' ? this.cfg.reducedMotionFade : this.cfg.fastTravelDuration;
    this.travel = { from: this.planetQ.clone(), to: to.clone().normalize(), elapsed: 0, duration, mode, id };
  }

  startAutoWalk(targetLocal: Vector3): void {
    if (this.travel) return;
    this.autoWalk = { target: targetLocal.clone().normalize(), windowStart: this.pLocal.clone(), windowElapsed: 0 };
  }

  cancelAutoWalk(): void {
    this.autoWalk = null;
  }

  /** Jump, if on the ground (not already in the air, not travelling). */
  jump(): boolean {
    if (this.travel || this.jumpH > 0 || this.jumpV > 0) return false;
    this.jumpV = JUMP.v;
    return true;
  }

  /**
   * Put the player at planet-local `p` by the smallest turn of the planet (so the view keeps its
   * yaw, as when walking), ignoring collision: used to sit on and stand up from benches.
   */
  placeAt(p: Vector3): void {
    const c = new Quaternion().setFromUnitVectors(this.pLocal, p.clone().normalize());
    this.planetQ.multiply(c.invert()).normalize();
    playerLocal(this.planetQ, this.pLocal);
    this.vel.set(0, 0, 0);
  }

  /**
   * Rotate the view about the player's vertical axis (world +Y) by `angle` rad — positive turns the
   * scene counter-clockwise on screen. The player's spot is unchanged; heading and velocity turn
   * with the world so the character keeps facing the same way on the planet. Ignored mid-travel.
   */
  rotateView(angle: number): void {
    if (this.travel || angle === 0) return;
    const q = new Quaternion().setFromAxisAngle(UP, angle);
    this.planetQ.premultiply(q).normalize();
    this.vel.applyQuaternion(q);
    this.heading = wrapAngle(this.heading + angle);
    playerLocal(this.planetQ, this.pLocal);
  }

  step(rawDt: number, intent: MoveIntent): void {
    const dt = Math.min(Math.max(rawDt, 0), this.cfg.maxDt);
    if (dt === 0) return;

    if (this.travel) {
      this.stepTravel(dt);
      return;
    }

    const inputLen = Math.hypot(intent.x, intent.y);
    if (inputLen > 0.001 && this.autoWalk) this.autoWalk = null;

    const desired = this.desiredVelocity(intent, inputLen, dt);
    desired.multiplyScalar(this.stepSoft(desired, dt));
    const lambda = 3 / (desired.lengthSq() > 0 ? this.cfg.accelTime : this.cfg.decelTime);
    this.vel.set(damp(this.vel.x, desired.x, lambda, dt), 0, damp(this.vel.z, desired.z, lambda, dt));
    if (desired.lengthSq() === 0 && this.vel.length() < 1e-3) this.vel.set(0, 0, 0);

    this.integrate(dt);
    if (this.jumpV > 0 || this.jumpH > 0) {
      this.jumpV -= JUMP.g * dt;
      this.jumpH += this.jumpV * dt;
      if (this.jumpH <= 0) {
        this.jumpH = this.jumpV = 0;
        this.events.push({ type: 'landed' });
      }
    }

    if (this.vel.length() > 1e-3) {
      this.heading = dampAngle(this.heading, Math.atan2(this.vel.x, this.vel.z), this.cfg.turnHalfLife, dt);
      if (this.vel.length() > 0.2) this.movingTime += dt;
    }
  }

  private desiredVelocity(intent: MoveIntent, inputLen: number, dt: number): Vector3 {
    const desired = new Vector3();
    if (this.autoWalk) {
      const aw = this.autoWalk;
      if (arcDistance(this.pLocal, aw.target, this.cfg.planetRadius) <= this.cfg.autoWalkArrive) {
        this.autoWalk = null;
        this.events.push({ type: 'autowalk-arrived' });
        return desired;
      }
      aw.windowElapsed += dt;
      if (aw.windowElapsed >= this.cfg.autoWalkBlockedWindow) {
        const progress = arcDistance(aw.windowStart, this.pLocal, this.cfg.planetRadius);
        if (progress < this.cfg.autoWalkBlockedMin) {
          this.autoWalk = null;
          this.events.push({ type: 'autowalk-blocked' });
          return desired;
        }
        aw.windowStart.copy(this.pLocal);
        aw.windowElapsed = 0;
      }
      const tLocal =
        tangentToward(this.pLocal, aw.target) ??
        new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)).applyQuaternion(this.planetQ.clone().invert());
      desired.copy(tLocal).applyQuaternion(this.planetQ).setY(0);
      if (desired.lengthSq() < 1e-12) return desired.set(0, 0, 0);
      return desired.normalize().multiplyScalar(this.cfg.runSpeed * this.speedFactor);
    }
    if (inputLen <= 0.001) return desired;
    const scale = Math.min(1, inputLen) / inputLen;
    return desired.set(intent.x * scale, 0, -intent.y * scale).multiplyScalar((intent.run ? this.cfg.runSpeed : this.cfg.walkSpeed) * this.speedFactor);
  }

  /**
   * Soft things (collision.md §3): their leaves (or personal space) slow the character, most at the
   * core; pressing on against a core for `squeezeS` lets it squeeze past, until it's out of the leaves.
   * Returns the speed factor.
   */
  private stepSoft(desired: Vector3, dt: number): number {
    const R = this.cfg.planetRadius;
    const body = this.collision.playerRadius + this.collision.skin;
    const want = desired.clone().applyQuaternion(this.planetQ.clone().invert());
    const wl = want.length();
    let drag = 1;
    for (const o of this.obstacles) {
      if (!o.soft) continue;
      const d = arcDistance(this.pLocal, o.n, R);
      const out = o.radiusU + body;
      if (d > out) {
        this.passing.delete(o);
        this.press.delete(o);
        continue;
      }
      const core = (o.core ?? o.radiusU) + body;
      drag = Math.min(drag, 1 - this.cfg.softDrag * clamp((out - d) / Math.max(1e-3, out - core), 0, 1));
      const to = wl > 0 && d < core + 0.04 ? tangentToward(this.pLocal, o.n) : null;
      const t = Math.max(0, (this.press.get(o) ?? 0) + (to && to.dot(want) > 0.3 * wl ? dt : -dt));
      this.press.set(o, t);
      if (t > this.cfg.squeezeS) this.passing.add(o);
    }
    return drag;
  }

  private integrate(dt: number): void {
    const speed0 = this.vel.length();
    if (speed0 < 1e-6) return;
    const steps = Math.max(1, Math.ceil((speed0 * dt) / this.cfg.maxStep));
    const subDt = dt / steps;
    const R = this.cfg.planetRadius;
    const invQ = new Quaternion();
    const vLocal = new Vector3();
    const vSlide = new Vector3();
    const dWorld = new Vector3();
    const axis = new Vector3();
    const q = new Quaternion();
    const obs = this.passing.size ? this.obstacles.filter((o) => !this.passing.has(o)) : this.obstacles;

    for (let k = 0; k < steps; k++) {
      invQ.copy(this.planetQ).invert();
      vLocal.copy(this.vel).applyQuaternion(invQ);
      slideVelocity(vLocal, this.pLocal, obs, this.collision, vSlide);
      const speed = vSlide.length();
      if (speed < 1e-6) {
        this.vel.set(0, 0, 0);
        return;
      }
      dWorld.copy(vSlide).applyQuaternion(this.planetQ).setY(0).normalize();
      axis.crossVectors(dWorld, UP).normalize();
      q.setFromAxisAngle(axis, (speed * subDt) / R);
      this.planetQ.premultiply(q).normalize();
      playerLocal(this.planetQ, this.pLocal);

      const corrected = resolvePenetration(this.pLocal, obs, this.collision);
      if (corrected) {
        const c = new Quaternion().setFromUnitVectors(this.pLocal, corrected);
        this.planetQ.multiply(c.invert()).normalize();
        playerLocal(this.planetQ, this.pLocal);
      }
      this.vel.copy(dWorld).multiplyScalar(speed);
    }
  }

  private stepTravel(dt: number): void {
    const t = this.travel!;
    t.elapsed += dt;
    const progress = Math.min(1, t.elapsed / t.duration);
    if (t.mode === 'flyover') {
      this.planetQ.slerpQuaternions(t.from, t.to, flyoverProfile(progress, this.cfg.travelRise, this.cfg.travelDrop).glide);
      this.heading = dampAngle(this.heading, SPAWN_HEADING, 0.15, dt);
    } else if (progress >= 0.5) {
      this.planetQ.copy(t.to);
      this.heading = SPAWN_HEADING;
    }
    playerLocal(this.planetQ, this.pLocal);
    if (progress >= 1) {
      this.planetQ.copy(t.to).normalize();
      playerLocal(this.planetQ, this.pLocal);
      this.heading = SPAWN_HEADING;
      this.travel = null;
      this.events.push({ type: 'travel-complete', id: t.id });
    }
  }
}
