import { describe, expect, it } from 'vitest';
import { clampRangeValue, formatSliderValue, sliderFillPercent } from '../../src/site/scripts/controls';

describe('site control helpers', () => {
  it('clamps range values inside either min/max order', () => {
    expect(clampRangeValue(120, 0, 100)).toBe(100);
    expect(clampRangeValue(-10, 0, 100)).toBe(0);
    expect(clampRangeValue(4, 10, 2)).toBe(4);
    expect(clampRangeValue(Number.NaN, 2, 10)).toBe(2);
  });

  it('turns a range value into a filled-track percentage', () => {
    expect(sliderFillPercent(50, 0, 100)).toBe(50);
    expect(sliderFillPercent(150, 0, 100)).toBe(100);
    expect(sliderFillPercent(-20, 0, 100)).toBe(0);
    expect(sliderFillPercent(5, 5, 5)).toBe(0);
  });

  it('formats slider values with compact labels', () => {
    expect(formatSliderValue(75, 'percent')).toBe('75%');
    expect(formatSliderValue(7.5, 'number', ' min')).toBe('7.5 min');
    expect(formatSliderValue(7.125, 'number')).toBe('7.13');
  });
});
