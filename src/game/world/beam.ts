/**
 * The lighthouse beam: a long open cone of light scattered in the air (additive, like the stage
 * beams). It is brightest at the lamp and dissolves smoothly toward its far end, and its
 * silhouette edges are soft, so it never ends in a hard rim.
 */

/** Length (u) of the beam and its radius at the far end. */
export const BEAM = { length: 10, radius: 1.75 } as const;

/** Exponent of the fade along the beam (> 1: the brightness reaches 0 with zero slope, no visible end). */
export const BEAM_FALLOFF = 2.2;

/** Brightness along the beam, from the lamp (t = 0) to the far end (t = 1). */
export function beamFalloff(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return Math.pow(1 - u, BEAM_FALLOFF);
}

export const BEAM_VERT = /* glsl */ `
uniform float uLength;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  vT = clamp(position.x / uLength, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

// Brightest where you look through the middle of the shaft; fading at its silhouette edges and along its length.
// NaN-safe: with MSAA a varying is extrapolated past its triangle at edge pixels (vT slightly
// above 1), and pow() of a negative base is NaN, which bloom then smears over the whole screen.
export const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = vN * inversesqrt(max(dot(vN, vN), 1e-12));
  vec3 v = vView * inversesqrt(max(dot(vView, vView), 1e-12));
  float edge = pow(clamp(abs(dot(n, v)), 0.0, 1.0), 2.0);
  float along = pow(clamp(1.0 - vT, 0.0, 1.0), ${BEAM_FALLOFF.toFixed(2)});
  gl_FragColor = vec4(uColor * (uOpacity * edge * along), 1.0);
}`;
