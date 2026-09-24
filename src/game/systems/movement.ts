import { Quaternion, Vector3 } from 'three';
import { CONFIG, type Config } from '../config';
import type { MoveIntent } from '../types';
import {
  UP,
  arcDistance,
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
  | { type: 'autowalk-blocked' };

const SPAWN_HEADING = Math.PI; // facing −Z (screen-up)

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  private readonly collision: CollisionParams;
  private readonly events: SimEvent[] = [];

  constructor(
    public obstacles: Obstacle[],
    private readonly cfg: Config = CONFIG,
  ) {
    this.collision = { radius: cfg.planetRadius, playerRadius: cfg.playerRadius, skin: cfg.skin };
  }

  get speed(): number {
    return this.vel.length();
  }

  /** Travel progress 0..1 and mode, for camera fly-over / fade rendering. */
  get travelState(): { progress: number; mode: TravelMode } | null {
    if (!this.travel) return null;
    return { progress: Math.min(1, this.travel.elapsed / this.travel.duration), mode: this.travel.mode };
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
    const lambda = 3 / (desired.lengthSq() > 0 ? this.cfg.accelTime : this.cfg.decelTime);
    this.vel.set(damp(this.vel.x, desired.x, lambda, dt), 0, damp(this.vel.z, desired.z, lambda, dt));
    if (desired.lengthSq() === 0 && this.vel.length() < 1e-3) this.vel.set(0, 0, 0);

    this.integrate(dt);

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

    for (let k = 0; k < steps; k++) {
      invQ.copy(this.planetQ).invert();
      vLocal.copy(this.vel).applyQuaternion(invQ);
      slideVelocity(vLocal, this.pLocal, this.obstacles, this.collision, vSlide);
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

      const corrected = resolvePenetration(this.pLocal, this.obstacles, this.collision);
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
      this.planetQ.slerpQuaternions(t.from, t.to, easeInOutCubic(progress));
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
