/** Pure cloud-band layout and fading (shared by the Clouds component and the tests). */

/**
 * The cloud band spans x ∈ [−SPAN/2, SPAN/2] (world units, the camera sits at x = 0). It is much
 * wider than a 16:9 view (about ±28 u at the clouds' depth), so ultrawide (32:9) and short, wide windows
 * still see clouds all the way across; one cloud per ~7 u keeps the density of the original band.
 */
export const CLOUD_SPAN = 170;
export const CLOUD_COUNT = 24;
/** Clouds fade out over this many units before the wrap (and back in after it), so none ever pops. */
export const CLOUD_FADE_U = 18;

/** Height and depth range of the band (world units, behind the planet). */
export const CLOUD_BAND = { y: [-10, -2], z: [-38, -30] } as const;

/** Opacity of a cloud at `x`: 1 across the band, easing to 0 at the wrap edges (±span/2). */
export function cloudFade(x: number, span = CLOUD_SPAN, fade = CLOUD_FADE_U): number {
  const t = Math.min(1, Math.max(0, (span / 2 - Math.abs(x)) / fade));
  return t * t * (3 - 2 * t);
}
