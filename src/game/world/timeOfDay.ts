import { Color, Vector3 } from 'three';

/**
 * Day–night model (pure). Time is in hours [0, 24). Keyframes define the look at key hours;
 * everything in between is interpolated. World space = camera frame (screen-left = −X).
 */

export type TimeMode = 'cycle' | 'local' | 'day';

export interface SkyState {
  hours: number;
  /** 0 = full day, 1 = full night. */
  night: number;
  skyTop: Color;
  skyMid: Color;
  skyBottom: Color;
  fog: Color;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  /** The directional light follows whichever body is brighter (sun or moon). */
  lightDir: Vector3;
  lightColor: Color;
  lightIntensity: number;
  sunUp: number;
  /** Sun / moon progress across the sky, 0 (rise) .. 1 (set); negative/over 1 when below the horizon. */
  sunArc: number;
  moonArc: number;
  cloudTint: Color;
  /** Multiplier for lamp/window glow (below 1 by day so it doesn't bloom). */
  glow: number;
}

interface Key {
  h: number;
  top: string;
  mid: string;
  bottom: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunI: number;
  moonI: number;
  night: number;
  cloud: string;
}

const KEYS: Key[] = [
  { h: 0, top: '#0b1636', mid: '#16264f', bottom: '#27386e', fog: '#1f2e5e', hemiSky: '#5a6ea8', hemiGround: '#1f2c3c', hemi: 0.7, sun: '#ffffff', sunI: 0, moonI: 0.55, night: 1, cloud: '#4a5680' },
  { h: 4.8, top: '#16214a', mid: '#2d3a70', bottom: '#5b5a8c', fog: '#434d7e', hemiSky: '#6a74a8', hemiGround: '#28333f', hemi: 0.75, sun: '#ffb070', sunI: 0, moonI: 0.35, night: 0.85, cloud: '#6a6e98' },
  { h: 6.2, top: '#5b8fd8', mid: '#f1b3a2', bottom: '#ffd6a6', fog: '#f0c7ae', hemiSky: '#f6d3c0', hemiGround: '#7d8f5a', hemi: 1.05, sun: '#ffab6e', sunI: 1.2, moonI: 0, night: 0.12, cloud: '#ffd6c8' },
  { h: 8.5, top: '#7cc6ff', mid: '#b9e3ff', bottom: '#e8f7ff', fog: '#d6eeff', hemiSky: '#e3f3ff', hemiGround: '#86ad63', hemi: 1.45, sun: '#fff1dc', sunI: 2.3, moonI: 0, night: 0, cloud: '#ffffff' },
  { h: 15.5, top: '#78c2ff', mid: '#b7e1ff', bottom: '#eaf6ff', fog: '#d8eeff', hemiSky: '#e6f3ff', hemiGround: '#88ad63', hemi: 1.45, sun: '#fff0d6', sunI: 2.3, moonI: 0, night: 0, cloud: '#ffffff' },
  { h: 17.6, top: '#6aa3e6', mid: '#ffd2a0', bottom: '#ffe3b6', fog: '#f5d5b2', hemiSky: '#ffe2c7', hemiGround: '#8d9d5e', hemi: 1.25, sun: '#ffc07a', sunI: 1.9, moonI: 0, night: 0.05, cloud: '#ffe2c4' },
  { h: 19.0, top: '#3a4e98', mid: '#e3888a', bottom: '#f6ae88', fog: '#c78e98', hemiSky: '#d8a5b8', hemiGround: '#5a6b52', hemi: 0.95, sun: '#ff8a5c', sunI: 0.55, moonI: 0, night: 0.38, cloud: '#f2a6a0' },
  { h: 20.4, top: '#15224f', mid: '#353b76', bottom: '#63578b', fog: '#3a4374', hemiSky: '#6c76b0', hemiGround: '#28333f', hemi: 0.75, sun: '#ff8a5c', sunI: 0, moonI: 0.4, night: 0.88, cloud: '#565c8a' },
  { h: 24, top: '#0b1636', mid: '#16264f', bottom: '#27386e', fog: '#1f2e5e', hemiSky: '#5a6ea8', hemiGround: '#1f2c3c', hemi: 0.7, sun: '#ffffff', sunI: 0, moonI: 0.55, night: 1, cloud: '#4a5680' },
];

const MOON_COLOR = new Color('#a9bcff');

export const SUNRISE = 6;
export const SUNSET = 19;

/**
 * Scene exposure (a linear multiplier on HDR radiance, applied once in the final tone map).
 * Night opens up a little, like an eye (or a camera's auto-exposure) adapting to the dark.
 */
export const EXPOSURE = { day: 1.3, night: 1.7 } as const;

export function sceneExposure(night: number): number {
  const n = Math.min(1, Math.max(0, night));
  return EXPOSURE.day + (EXPOSURE.night - EXPOSURE.day) * n;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

export function wrapHours(h: number): number {
  return ((h % 24) + 24) % 24;
}

/** Direction to a body that rises at screen-left and sets at screen-right, arcing over the scene. */
export function bodyDirection(arc: number, out = new Vector3()): Vector3 {
  const a = Math.min(1, Math.max(0, arc)) * Math.PI;
  const up = Math.sin(a);
  // keep a minimum elevation so shadows never become endless streaks
  return out.set(-Math.cos(a) * 0.85, 0.28 + up * 0.72, 0.45 + up * 0.15).normalize();
}

export function sampleSky(hours: number): SkyState {
  const h = wrapHours(hours);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth((h - a.h) / (b.h - a.h));
  const c = (x: string, y: string) => new Color(x).lerp(new Color(y), t);
  const n = (x: number, y: number) => x + (y - x) * t;

  const sunArc = (h - SUNRISE) / (SUNSET - SUNRISE);
  const nightLen = 24 - (SUNSET - SUNRISE);
  const moonArc = wrapHours(h - SUNSET) / nightLen;
  const sunI = n(a.sunI, b.sunI);
  const moonI = n(a.moonI, b.moonI);
  const useSun = sunI >= moonI;
  const lightDir = bodyDirection(useSun ? sunArc : moonArc);
  const lightColor = useSun ? c(a.sun, b.sun) : MOON_COLOR.clone();
  const night = n(a.night, b.night);

  return {
    hours: h,
    night,
    skyTop: c(a.top, b.top),
    skyMid: c(a.mid, b.mid),
    skyBottom: c(a.bottom, b.bottom),
    fog: c(a.fog, b.fog),
    hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround),
    hemiIntensity: n(a.hemi, b.hemi),
    lightDir,
    lightColor,
    // dips to 0 where sun and moon hand over, so the shadow direction never visibly jumps
    lightIntensity: Math.abs(sunI - moonI),
    sunUp: sunI > 0.01 ? 1 : 0,
    sunArc,
    moonArc,
    cloudTint: c(a.cloud, b.cloud),
    glow: 0.5 + night * 1.0,
  };
}

/** Cycle speed: the daytime (6:00–19:00) takes ~4.5 min, the night ~1.5 min, so one day ≈ 6 min. */
export const CYCLE_DAY_SECONDS = 270;
export const CYCLE_NIGHT_SECONDS = 90;

export function advanceHours(hours: number, dtSeconds: number): number {
  const h = wrapHours(hours);
  const isDay = h >= SUNRISE && h < SUNSET;
  const rate = isDay ? (SUNSET - SUNRISE) / CYCLE_DAY_SECONDS : (24 - (SUNSET - SUNRISE)) / CYCLE_NIGHT_SECONDS;
  return wrapHours(h + dtSeconds * rate);
}

export function localHours(date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export const DAY_HOURS = 10.5;
export const START_HOURS = 9;

export function formatHours(hours: number): string {
  const h = wrapHours(hours);
  let hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const pm = hh >= 12;
  hh = hh % 12 || 12;
  return `${hh}:${String(mm).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}
