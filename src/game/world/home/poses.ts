/**
 * The family's poses (docs: family.md §5), keyed like the character's action poses: each limb gets
 * a target direction in the NPC's own frame, [forward, up, out] (out = away from the midline on
 * that limb's side), which `aimBone` turns into bone rotations over the idle or run clip. The body
 * can also sink to a seat (`hip`, the hip joints' height in body heights) and tip about the hips
 * (`pitch`, rad: π/2 lies face down).
 */
import type { Dir, Limb } from '../../player/actionPoses';
import type { Held, NpcPose } from './family';

export interface BodyPose {
  /** Hip-joint height as a fraction of the standing height (standing ≈ 0.32). Null: as the clip has it. */
  hip: number | null;
  pitch: number;
  /** Shift the body back (u, in body heights) to sit deep in a chair or lean on a trunk. */
  back?: number;
  spine: Dir | null;
  chest: Dir | null;
  arms: { l: Limb; r: Limb } | null;
  legs: { l: Limb; r: Limb } | null;
  /** How much the head looks down (rad). */
  nod: number;
}

/** Standing hip height as a fraction of the character's height (measured on the Kenney rig). */
export const HIP_FRACTION = 0.32;

const both = (l: Limb, r: Limb = l) => ({ l, r });
const lim = (upper: Dir, lower: Dir): Limb => ({ upper, lower });
const S = Math.sin;

const SIT_LEGS = both(lim([1, -0.08, 0.08], [0.2, -1, 0]));
const READ_ARMS = both(lim([0.35, -0.85, 0.28], [0.85, 0.55, -0.45]));

export function bodyPose(pose: NpcPose, t: number, held: Held, moving: boolean): BodyPose {
  const none: BodyPose = { hip: null, pitch: 0, spine: null, chest: null, arms: null, legs: null, nod: 0 };
  switch (pose) {
    case 'sitChair':
      return { ...none, hip: 0.335, back: 0.07, spine: [-0.08, 1, 0], legs: SIT_LEGS, arms: both(lim([0.25, -1, 0.18], [0.9, -0.3, -0.1])) };
    case 'eat': {
      // at the table: one hand resting on it, the other bringing food up now and then
      const bite = Math.max(0, Math.sin(t * 2.4));
      return {
        ...none,
        hip: 0.335,
        back: 0.04,
        spine: [0.12, 1, 0],
        legs: SIT_LEGS,
        arms: { l: lim([0.7, -0.55, 0.22], [1, 0.05, -0.3]), r: lim([0.55, -0.6 + bite * 0.3, 0.25], [1 - bite * 0.8, 0.1 + bite * 0.9, -0.3 - bite * 0.3]) },
        nod: 0.12,
      };
    }
    case 'read':
      return { ...none, hip: 0.335, back: 0.07, spine: [-0.1, 1, 0], legs: SIT_LEGS, arms: READ_ARMS, nod: 0.35 + S(t * 0.3) * 0.05 };
    case 'readGround':
      return { ...none, hip: 0.07, back: 0.08, spine: [-0.3, 1, 0], legs: both(lim([1, 0.02, 0.12], [1, -0.08, 0.05])), arms: READ_ARMS, nod: 0.4 };
    case 'lego': {
      const a = S(t * 2.2) * 0.25;
      return {
        ...none,
        hip: 0.07,
        spine: [0.35, 1, 0],
        legs: both(lim([0.75, 0.05, 0.6], [0.35, -0.05, -1])),
        arms: { l: lim([0.55, -0.75, 0.25], [0.9, -0.45 + a, -0.3]), r: lim([0.55 + a, -0.75, 0.2], [0.9, -0.5 - a, -0.25]) },
        nod: 0.5,
      };
    }
    case 'paint': {
      // face down on the grass: legs bent up at the knees, kicking in turn; propped on the elbows
      const k = S(t * 2.6);
      const draw = S(t * 5) * 0.2;
      return {
        ...none,
        hip: 0.11,
        pitch: Math.PI / 2,
        spine: [1, 0.12, 0],
        chest: [1, 0.35, 0],
        legs: { l: lim([-1, 0.05, 0.12], [-0.35 - 0.3 * k, 1, 0]), r: lim([-1, 0.05, 0.12], [-0.35 + 0.3 * k, 1, 0]) },
        arms: { l: lim([0.45, -1, 0.35], [1, 0.1, -0.35]), r: lim([0.5, -1, 0.3], [1 + draw, 0.05, -0.2 + draw]) },
        nod: 0.2,
      };
    }
    case 'crawl': {
      // hands and knees, one hand pushing a car back and forth
      const s = moving ? S(t * 6) : S(t * 3) * 0.5;
      return {
        ...none,
        hip: 0.3,
        pitch: 1.25,
        spine: [1, 0.05, 0],
        chest: [1, 0.15, 0],
        legs: { l: lim([0.1 + s * 0.15, -1, 0.1], [-1, -0.1, 0]), r: lim([0.1 - s * 0.15, -1, 0.1], [-1, -0.1, 0]) },
        arms: { l: lim([0.15 - s * 0.2, -1, 0.15], [0.2, -1, 0]), r: lim([0.35 + s * 0.35, -1, 0.1], [0.5 + s * 0.4, -1, 0]) },
        nod: -0.3,
      };
    }
    case 'throw': {
      // a wind-up, the throw at 0.55 s, the follow-through (every 1.6 s)
      const c = t % 1.6;
      const r =
        c < 0.4 ? lim([-0.5, 0.75, 0.35], [-0.2, 1, 0]) : c < 0.7 ? lim([1, 0.45, 0.15], [1, 0.3, -0.1]) : c < 1.1 ? lim([0.7, -0.6, 0.2], [0.8, -0.5, -0.1]) : lim([0.1, -1, 0.15], [0.1, -1, 0]);
      return { ...none, spine: [c < 0.4 ? -0.1 : c < 0.8 ? 0.25 : 0.05, 1, 0], arms: { l: lim([0.2, -1, 0.3], [0.3, -1, 0]), r } };
    }
    case 'crouch':
      return {
        ...none,
        hip: 0.14,
        spine: [0.5, 1, 0],
        legs: both(lim([0.95, -0.55, 0.18], [-0.25, -1, 0])),
        arms: both(lim([0.45, -1, 0.15], [0.85, -0.55, -0.1])),
        nod: 0.6,
      };
    case 'talk': {
      const g = S(t * 3.1);
      return { ...none, arms: { l: lim([0.1, -1, 0.2], [0.2, -1, 0]), r: lim([0.35, -0.8, 0.35], [0.8, 0.35 + g * 0.25, 0.1 + g * 0.2]) }, nod: S(t * 4.3) * 0.08 };
    }
    case 'fetch':
      return { ...none, arms: both(lim([0.9, -0.1, 0.2], [1, 0.1, -0.15])) };
    case 'place':
      return { ...none, spine: [0.35, 1, 0], arms: both(lim([0.8, -0.5, 0.2], [1, -0.3, -0.25])), nod: 0.4 };
    case 'watch':
      return none;
    default:
      // carrying the picnic basket (while walking too)
      if (held === 'basket') return { ...none, arms: both(lim([0.35, -0.9, 0.22], [1, 0.1, -0.4])) };
      return none;
  }
}
