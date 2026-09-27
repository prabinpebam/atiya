/**
 * Seats as smart objects (docs: prabin-npc.md §4.3): each chair has its slot (where the body ends
 * up, with the seat's real height and the hips' place on it), a few entry points (where you walk
 * to first, so the chair itself stays solid) and one reservation. Sitting down and standing up are
 * short scripted moves between the entry point and the slot, as in Unreal's Smart Objects or The
 * Sims' routing slots. Pure: no rendering (unit-tested against the models' seat heights).
 */
import { Vector3 } from 'three';
import { moveAlong } from '../../math/sphere';
import { rotateAbout } from '../../math/steer';
import { POND_BENCH, PROP_SCALE, SWING, type HomeSpot, type Homestead } from '../homestead';
import { BENCH } from '../parts';

export type SeatKind = 'dining' | 'armchair' | 'camp' | 'bench' | 'swing';

export interface Seat {
  id: string;
  kind: SeatKind;
  /** The chair's centre, facing the way you sit. */
  spot: HomeSpot;
  /** The seat's top above the ground (u). */
  height: number;
  /** The hips sit this far behind the seat's centre (u). */
  back: number;
  /** Where to walk to first, facing the seat's way (the sit-down slides from here onto the seat). */
  entries: HomeSpot[];
  /** Who has it (reserved from the moment they head for it), or null. */
  user: string | null;
}

/**
 * Per kind: the seat's top in the model's own units (× PROP_SCALE when drawn: the dining chair's
 * cushion at 0.52, the armchair's at 0.51, the camp chair's canvas at 0.40; home/models.ts), the
 * hips' place behind the centre, and the entry points (degrees from the seat's facing, distance u).
 * A dining chair is pushed in at the table, so you step in beside it; the others from the front.
 */
export const SEAT_KINDS: Record<SeatKind, { top: number; back: number; entries: ReadonlyArray<readonly [number, number]> }> = {
  dining: { top: 0.52, back: 0.04, entries: [[90, 0.42], [-90, 0.42]] },
  armchair: { top: 0.51, back: 0.06, entries: [[0, 0.46], [45, 0.5], [-45, 0.5]] },
  camp: { top: 0.4, back: 0.05, entries: [[90, 0.42], [-90, 0.42], [0, 0.45]] },
  // the pond bench is drawn full size (parts.ts `bench`), so its top is given in PROP_SCALE units; you step up
  // to it from the front, clear of its collision circle
  bench: { top: BENCH.seatTop / PROP_SCALE, back: 0.04, entries: [[0, 0.8], [-20, 0.84]] },
  // the swing's plank (drawn full size, craft/swingModels.ts): you get on from in front of it, or from either
  // side in front of the ropes (behind it is the oak, and someone may be standing right in front)
  swing: { top: (SWING.seatY + SWING.seatT / 2) / PROP_SCALE, back: 0.02, entries: [[0, 0.75], [60, 0.7], [-60, 0.7]] },
};

/** Seconds to sit down (entry point → seat) and to stand up (seat → entry point). */
export const SIT_T = 0.6;

/** How far the hip joints sit above the seat (u): the body's own padding, a share of its height. */
export const hipAboveSeat = (bodyHeight: number) => 0.05 * bodyHeight;

/** Where the hip joints go on a seat (u above the ground). */
export const seatHip = (s: Seat, bodyHeight: number) => s.height + hipAboveSeat(bodyHeight);

function seat(id: string, kind: SeatKind, spot: HomeSpot, R: number): Seat {
  const k = SEAT_KINDS[kind];
  const entries = k.entries.map(([deg, u]) => {
    const d = rotateAbout(spot.facing.clone(), spot.n, (deg * Math.PI) / 180);
    return { n: moveAlong(spot.n, d, u / R), facing: spot.facing.clone() };
  });
  // the entry's facing is the seat's, carried over to where it stands
  for (const e of entries) {
    const f = e.facing.addScaledVector(e.n, -e.facing.dot(e.n));
    if (f.lengthSq() > 1e-12) f.normalize();
  }
  return { id, kind, spot, height: k.top * PROP_SCALE, back: k.back, entries, user: null };
}

/** Every seat round the home: the reading chair, the table's four chairs, the two camp chairs, the family's end of the pond bench, the swing (once it's built). */
export function homeSeats(home: Homestead, R: number): Seat[] {
  const b = home.pondBench;
  const along = new Vector3().crossVectors(b.n, b.facing).normalize();
  const pondN = moveAlong(b.n, along, POND_BENCH.side / R);
  return [
    seat('reading', 'armchair', home.readingChair, R),
    ...home.tableChairs.map((c, i) => seat(`table${i}`, 'dining', c, R)),
    ...home.campChairs.map((c, i) => seat(`camp${i}`, 'camp', c, R)),
    seat('pond', 'bench', { n: pondN, facing: b.facing.clone().addScaledVector(pondN, -b.facing.dot(pondN)).normalize() }, R),
    seat('swing', 'swing', home.swing, R),
  ];
}

/** The entry point to use, coming from `from`: the nearest one that's free (null if none is). */
export function pickEntry(s: Seat, from: Vector3, free: (n: Vector3) => boolean): HomeSpot | null {
  const byDistance = [...s.entries].sort((a, b) => a.n.distanceToSquared(from) - b.n.distanceToSquared(from));
  return byDistance.find((e) => free(e.n)) ?? null;
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Along the sit-down (k 0 → 1: entry point → seat), where the body is. */
export function sitPath(from: Vector3, to: Vector3, t: number, out = new Vector3()): Vector3 {
  const k = smooth(t / SIT_T);
  return out.copy(from).lerp(to, k).normalize();
}

/** Which way the seat faces at `n` (for turning while sitting down). */
export function seatFacing(s: Seat, n: Vector3): Vector3 {
  const f = s.spot.facing.clone().addScaledVector(n, -s.spot.facing.dot(n));
  return f.lengthSq() > 1e-12 ? f.normalize() : s.spot.facing.clone();
}
