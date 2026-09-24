/** Pure door and curtain motion (no three.js scene state), shared by the landmark and the tests. */

/** How far a door leaf swings in (radians), and how long a door takes to open or close (s). */
export const DOOR = { swing: 1.45, seconds: 0.55 } as const;

export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Moves a door's openness (0 shut … 1 open) toward `want` at a steady rate; reduced motion snaps. */
export function stepOpen(open: number, want: 0 | 1, dt: number, reduced: boolean): number {
  if (reduced) return want;
  const step = dt / DOOR.seconds;
  return want > open ? Math.min(want, open + step) : Math.max(want, open - step);
}

/** The festoon curtain's hem on the floor when shut (local y). */
export const CURTAIN_FLOOR = 0.03;

/**
 * One column of the amphitheater's festoon curtain at `u` (0…1 across the arch) for eased
 * openness `e`: its x, top (following the arch) and hem. Open, the hem rises on five lift cords
 * into scallops that hang between them.
 */
export function curtainColumn(u: number, e: number, r: number, baseY: number): { x: number; top: number; bottom: number } {
  const x = (u * 2 - 1) * r;
  const top = baseY + Math.sqrt(Math.max(0, r * r - x * x));
  const f = (u * 5) % 1;
  const raised = Math.max(CURTAIN_FLOOR, top - 0.12 - 0.16 * Math.sin(Math.PI * f));
  return { x, top, bottom: CURTAIN_FLOOR + (raised - CURTAIN_FLOOR) * e };
}
