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
  { h: 0, top: '#0c1a40', mid: '#1b2d5c', bottom: '#2e4178', fog: '#243564', hemiSky: '#6c82c8', hemiGround: '#27383f', hemi: 0.95, sun: '#ffffff', sunI: 0, moonI: 0.65, night: 1, cloud: '#6b76ad' },
  { h: 4.8, top: '#17234e', mid: '#2f3d74', bottom: '#5d5c8e', fog: '#454f80', hemiSky: '#727cb4', hemiGround: '#2c3842', hemi: 0.9, sun: '#ffb070', sunI: 0, moonI: 0.45, night: 0.85, cloud: '#7478a6' },
  { h: 6.2, top: '#5b8fd8', mid: '#f1b3a2', bottom: '#ffd6a6', fog: '#f0c7ae', hemiSky: '#f6d3c0', hemiGround: '#7d8f5a', hemi: 1.05, sun: '#ffab6e', sunI: 1.2, moonI: 0, night: 0.12, cloud: '#ffd6c8' },
  { h: 8.5, top: '#4f9ef2', mid: '#9fd0ff', bottom: '#e0f2ff', fog: '#d2eaff', hemiSky: '#d6eaff', hemiGround: '#9aac5a', hemi: 1.25, sun: '#ffe6bd', sunI: 2.6, moonI: 0, night: 0, cloud: '#ffffff' },
  { h: 15.5, top: '#4d9bf0', mid: '#9dceff', bottom: '#e2f2ff', fog: '#d4eaff', hemiSky: '#d8ebff', hemiGround: '#9cac5a', hemi: 1.25, sun: '#ffe4b8', sunI: 2.6, moonI: 0, night: 0, cloud: '#fffaf2' },
  { h: 17.6, top: '#5e9ae4', mid: '#ffd09a', bottom: '#ffe1b0', fog: '#f5d3ae', hemiSky: '#ffdcbc', hemiGround: '#94a656', hemi: 1.1, sun: '#ffc672', sunI: 2.3, moonI: 0, night: 0.05, cloud: '#ffdcb8' },
  { h: 19.0, top: '#3a4e98', mid: '#e98c86', bottom: '#f8b284', fog: '#cf9496', hemiSky: '#e0aab4', hemiGround: '#6a7a52', hemi: 0.95, sun: '#ffa062', sunI: 1.1, moonI: 0, night: 0.38, cloud: '#ffb49c' },
  { h: 20.4, top: '#172654', mid: '#383f7a', bottom: '#66598c', fog: '#3d4678', hemiSky: '#7482c0', hemiGround: '#2b3a42', hemi: 0.95, sun: '#ff8a5c', sunI: 0, moonI: 0.6, night: 0.88, cloud: '#6a70a6' },
  { h: 24, top: '#0c1a40', mid: '#1b2d5c', bottom: '#2e4178', fog: '#243564', hemiSky: '#6c82c8', hemiGround: '#27383f', hemi: 0.95, sun: '#ffffff', sunI: 0, moonI: 0.65, night: 1, cloud: '#6b76ad' },
];

const MOON_COLOR = new Color('#a9bcff');

export const SUNRISE = 6;
export const SUNSET = 19;

/** The sun and moon travel on a plane behind the planet (camera frame), behind the clouds. */
export const SKY_Z = -50;

/** Position on the sky plane for a body at `arc` (0 rise … 1 set): rises bottom-left, sets bottom-right. */
export function skyPosition(arc: number, out = new Vector3()): Vector3 {
  const a = arc * Math.PI;
  return out.set(-Math.cos(a) * 30, -29.5 + Math.sin(a) * 19.5, SKY_Z);
}

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
