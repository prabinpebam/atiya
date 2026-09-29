/**
 * Pure helpers for native form controls. Astro components keep DOM work in their small bundled
 * scripts, and use these functions for value maths and labels.
 */

export type SliderFormat = 'number' | 'percent';

/** Clamp a numeric range value, even when min and max arrive in reverse order. */
export function clampRangeValue(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** The filled track percentage for a range input. */
export function sliderFillPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0;
  return clampRangeValue(((clampRangeValue(value, min, max) - min) / (max - min)) * 100, 0, 100);
}

function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** Visible value text for a slider's output. */
export function formatSliderValue(value: number, format: SliderFormat = 'number', unit = ''): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (format === 'percent') return `${compactNumber(safe)}%`;
  return `${compactNumber(safe)}${unit}`;
}
