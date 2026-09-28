import { Vector3, Vector4 } from 'three';

/**
 * Wind model (pure). The wind circulates around a tilted axis, so it blows consistently across
 * the planet (screen-left at spawn) and is calm only at two out-of-the-way points. Its strength
 * breathes: a gentle breeze with occasional gusts lasting several seconds.
 */

export const WIND_AXIS = new Vector3(0.3, 0.15, 1).normalize();

/** Planet-local wind (tangent) at unit position `p`; its length (0…1) is the local exposure. */
export function windAt(p: Vector3, out = new Vector3()): Vector3 {
  return out.crossVectors(WIND_AXIS, p);
}

/** Smooth pseudo-random 0…1 signal (incommensurate sines, so it never visibly repeats). */
function breathe(t: number): number {
  return 0.5 + 0.24 * Math.sin(t * 0.21 + 0.4) + 0.16 * Math.sin(t * 0.53 + 1.3) + 0.08 * Math.sin(t * 0.9 + 2.1);
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Gust envelope 0…1 at time `t` (s): mostly 0, rising to 1 for a few seconds at a time. */
export function gustAt(t: number): number {
  return smoothstep(0.55, 0.9, breathe(t));
}

/** Overall wind strength at time `t`: a 0.3 breeze plus gusts up to 1. */
export function windStrength(t: number): number {
  return 0.3 + 0.7 * gustAt(t);
}

/** Shared shader uniforms (sway, leaf flutter). Advanced by the WindFx driver. */
export const windUniforms = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 0.3 },
  uWindAxis: { value: WIND_AXIS.clone() },
  /** The character's feet (planet-local, u) and whether it's on the ground (w): plants lean away from it (collision.md §3). */
  uPush: { value: new Vector4() },
};

/** GLSL snippet: planet-local wind at planet-local position `p` (uses uWindAxis). */
export const WIND_GLSL = /* glsl */ `
uniform float uWindTime;
uniform float uWindStrength;
uniform vec3 uWindAxis;
vec3 windAt(vec3 p) { return cross(uWindAxis, normalize(p)); }
`;
