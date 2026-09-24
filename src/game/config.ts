/** Tuning constants for the planet POC. Keep in sync with spec §5.5. */
export const CONFIG = {
  planetRadius: 10,
  walkSpeed: 2.2,
  runSpeed: 5.0,
  /** Seconds to reach ~95 % of target speed. */
  accelTime: 0.12,
  /** Seconds to drop to ~5 % of speed. */
  decelTime: 0.08,
  turnHalfLife: 0.05,
  maxDt: 0.1,
  maxStep: 0.1,
  playerRadius: 0.35,
  skin: 0.02,
  proximityPadding: 1.75,
  exitFactor: 1.3,
  switchMargin: 0.25,
  interactBufferMs: 150,
  autoWalkArrive: 0.3,
  autoWalkBlockedWindow: 0.5,
  autoWalkBlockedMin: 0.05,
  fastTravelDuration: 1.2,
  reducedMotionFade: 0.2,
  onboardingDismissSeconds: 2,
  loadTimeoutMs: 15_000,
  maxSpawnArcU: 10,
  minFootprintGapU: 4,
  camera: {
    pitchDeg: 48,
    distance: 16,
    fov: 35,
    /** Look-at target = player's feet + this far ahead (screen-up) and up, so the player sits in the lower third. */
    lookAhead: 1.4,
    lookUp: 0.6,
    flyoverPitchDeg: 62,
    flyoverDistance: 22,
    /** User view controls: tilt limits, rates, button steps and drag sensitivity. */
    minPitchDeg: 30,
    maxPitchDeg: 78,
    rotateSpeed: 1.6,
    tiltSpeedDeg: 45,
    rotateStepDeg: 45,
    tiltStepDeg: 10,
    dragYawPerPx: 0.008,
    dragPitchPerPx: 0.25,
    dragThresholdPx: 6,
  },
} as const;

export type Config = typeof CONFIG;
