import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Vector3 } from 'three';
import { AUDIO } from '../../src/game/audio/audioManifest';
import { MUSIC } from '../../src/game/audio/musicManifest';
import {
  WADE_SPLASH_U,
  birdsSing,
  contactPhase,
  crossedPhase,
  nextBirdDelay,
  pickVariant,
  streamLevel,
  surfaceAt,
  windMix,
} from '../../src/game/audio/audioLogic';
import { SoundEngine } from '../../src/game/audio/engine';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, pointArcDistance } from '../../src/game/math/sphere';
import { PLAZA_RADIUS_U, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const PUBLIC = join(__dirname, '..', '..', 'public');

/** Seeded PRNG so the randomised checks are repeatable. */
function rng(seed = 7): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Playing time of a CBR MPEG-1 Layer III file, by walking its frame headers (skips an ID3v2 tag and LAME's info frame). */
function mp3Seconds(file: string): number {
  const b = readFileSync(file);
  let i = 0;
  if (b.toString('latin1', 0, 3) === 'ID3') i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const SRS = [44100, 48000, 32000];
  let frames = 0;
  let sr = 44100;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff || (b[i + 1] & 0xfe) !== 0xfa) break;
    const kbps = RATES[b[i + 2] >> 4];
    sr = SRS[(b[i + 2] >> 2) & 3];
    const len = Math.floor((144000 * kbps) / sr) + ((b[i + 2] >> 1) & 1);
    if (!len) break;
    frames++;
    i += len;
  }
  return ((frames - 1) * 1152) / sr;
}

describe('audio manifest', () => {
  const files = Object.values(AUDIO).map((a) => join(PUBLIC, a.url));

  it('every file exists, is a small MP3 and the whole set stays under 800 KB', () => {
    let total = 0;
    for (const f of files) {
      const size = statSync(f).size;
      expect(size, f).toBeGreaterThan(10_000);
      total += size;
    }
    expect(total).toBeLessThan(800 * 1024);
  });

  it('loops sit inside their files with a padded run-in and run-out', () => {
    for (const key of ['stream', 'wind'] as const) {
      const m = AUDIO[key];
      const dur = mp3Seconds(join(PUBLIC, m.url));
      expect(m.loopStart, key).toBeGreaterThanOrEqual(0.5);
      expect(m.loopEnd - m.loopStart, key).toBeGreaterThan(15);
      expect(dur - m.loopEnd, key).toBeGreaterThan(0.5);
    }
  });

  it('sprite slots are in order, never overlap and fit in the file', () => {
    for (const key of ['steps', 'birds', 'ui'] as const) {
      const m = AUDIO[key];
      const dur = mp3Seconds(join(PUBLIC, m.url));
      const slots = Object.values(m.slots as Record<string, ReadonlyArray<readonly [number, number]>>)
        .flat()
        .sort((a, b) => a[0] - b[0]);
      let end = 0;
      for (const [start, len] of slots) {
        expect(len).toBeGreaterThan(0.08);
        // the engine reads 20 ms either side of a slot: keep that inside the silent gaps
        expect(start - 0.02).toBeGreaterThanOrEqual(end);
        end = start + len + 0.02;
      }
      expect(end, key).toBeLessThanOrEqual(dur + 0.03);
    }
  });

  it('has every sound the game asks for, with variations for the repeated ones', () => {
    for (const s of ['grass', 'wood', 'stone', 'water'] as const) expect(AUDIO.steps.slots[s].length).toBeGreaterThanOrEqual(4);
    expect(AUDIO.birds.slots.song.length).toBeGreaterThanOrEqual(4);
    for (const cue of ['chime', 'sparkle', 'doorOpen', 'doorClose', 'curtain'] as const) expect(AUDIO.ui.slots[cue].length).toBe(1);
  });
});

describe('sound rules', () => {
  it('never plays the same variation twice in a row, and uses them all', () => {
    const r = rng();
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const v = pickVariant(6, last, r);
      expect(v).not.toBe(last);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
      last = v;
    }
    expect(seen.size).toBe(6);
    expect(pickVariant(1, 0, r)).toBe(0);
  });

  it('the stream is full at the bank, fades with distance and is silent across the planet', () => {
    expect(streamLevel(0)).toBeCloseTo(1, 5);
    expect(streamLevel(-0.3)).toBeCloseTo(1, 5);
    let prev = 1;
    for (let d = 0.25; d < 16; d += 0.25) {
      const v = streamLevel(d);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
    expect(streamLevel(2.2)).toBeLessThan(0.5);
    expect(streamLevel(14)).toBe(0);
  });

  it('wind gets louder and brighter with gusts, within bounds', () => {
    const calm = windMix(0.3, 0);
    const gust = windMix(0.3, 1);
    const storm = windMix(1, 1);
    expect(gust.level).toBeGreaterThan(calm.level);
    expect(gust.cutoff).toBeGreaterThan(calm.cutoff);
    expect(storm.level).toBeLessThanOrEqual(1);
    expect(windMix(5, 5)).toEqual(storm);
    expect(calm.level).toBeGreaterThan(0);
  });

  it('birds sing by day and at dusk, not at night, every 5–16 s', () => {
    expect(birdsSing(0)).toBe(true);
    expect(birdsSing(0.3)).toBe(true);
    expect(birdsSing(0.6)).toBe(false);
    expect(birdsSing(1)).toBe(false);
    const r = rng(3);
    for (let i = 0; i < 100; i++) {
      const d = nextBirdDelay(r);
      expect(d).toBeGreaterThanOrEqual(5);
      expect(d).toBeLessThanOrEqual(16);
    }
  });

  it('finds when a foot lands in a cycle, and notices crossing it (including across the wrap)', () => {
    // a foot that is lowest from 0.5 to 0.7 of the cycle
    const h = Array.from({ length: 40 }, (_, i) => {
      const t = i / 40;
      return t >= 0.5 && t < 0.7 ? 0 : 1 - Math.cos(((t - 0.7 + (t < 0.5 ? 1 : 0)) / 0.8) * Math.PI * 2);
    });
    const p = contactPhase(h);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThanOrEqual(0.5);
    expect(crossedPhase(0.4, 0.55, [0.5])).toBe(true);
    expect(crossedPhase(0.5, 0.55, [0.5])).toBe(false);
    expect(crossedPhase(0.9, 0.1, [0.95])).toBe(true);
    expect(crossedPhase(0.9, 0.1, [0.05])).toBe(true);
    expect(crossedPhase(0.9, 0.1, [0.5])).toBe(false);
    expect(crossedPhase(0.3, 0.3, [0.3])).toBe(false);
  });
});

describe('footstep surfaces', () => {
  const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
  const layout = generateProps(geos);
  const terrain = new Terrain(geos, { river: layout.river, pond: layout.pond, bridges: layout.bridges, mesas: layout.mesas });

  it('stone on the plaza, at the landmarks and along the paths', () => {
    expect(surfaceAt(UP.clone(), geos, terrain, 0)).toBe('stone');
    for (const g of geos) {
      expect(surfaceAt(g.approach, geos, terrain, 0), g.id).toBe('stone');
    }
  });

  it('wood on the bridge deck, water when wading, grass elsewhere', () => {
    expect(layout.bridges.length).toBeGreaterThan(0);
    for (const b of layout.bridges) expect(surfaceAt(b.n, geos, terrain, 0)).toBe('wood');
    expect(surfaceAt(UP.clone(), geos, terrain, WADE_SPLASH_U + 0.01)).toBe('water');
    // an even spread of points: those clear of every path, cobble ring and the plaza are lawn
    const r = rng(11);
    let lawn = 0;
    for (let i = 0; i < 400; i++) {
      const p = new Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
      const clear =
        arcDistance(p, UP, R) > PLAZA_RADIUS_U + 0.1 &&
        geos.every((g) => arcDistance(p, g.n, R) > g.footprintU + 0.6 && pointArcDistance(p, UP, g.n, R) > 0.56) &&
        terrain.deckHeight(p) === -Infinity;
      if (!clear) continue;
      expect(surfaceAt(p, geos, terrain, 0)).toBe('grass');
      lawn++;
    }
    expect(lawn).toBeGreaterThan(100);
  });
});

describe('sound engine (no audio device)', () => {
  it('logs cues without playing until unlocked, and plays the right door sounds', () => {
    const e = new SoundEngine(true, rng());
    e.approach('door');
    e.leave('door');
    e.approach('curtain');
    e.leave('curtain');
    e.approach(null);
    e.open();
    e.step('wood', false);
    expect(e.events.map((x) => x.kind)).toEqual(['chime', 'doorOpen', 'doorClose', 'chime', 'curtain', 'curtain', 'chime', 'sparkle', 'step']);
    expect(e.events.at(-1)!.detail).toBe('wood');
    expect(e.events.every((x) => !x.played)).toBe(true);
    expect(e.state).toBe('none');
  });

  it('follows the wind and stream, and only schedules birds by day', () => {
    const e = new SoundEngine(true, rng());
    e.update(0.1, { strength: 0.3, gust: 1, stream: 0.4, streamPan: -0.5, night: 0 });
    expect(e.levels.stream).toBe(0.4);
    expect(e.levels.streamPan).toBe(-0.5);
    expect(e.levels.wind).toBeCloseTo(windMix(0.3, 1).level, 6);
    for (let t = 0; t < 60; t += 0.2) e.update(0.2, { strength: 0.3, gust: 0, stream: 0, streamPan: 0, night: 0 });
    const day = e.events.filter((x) => x.kind === 'bird').length;
    expect(day).toBeGreaterThanOrEqual(3);
    for (let t = 0; t < 60; t += 0.2) e.update(0.2, { strength: 0.3, gust: 0, stream: 0, streamPan: 0, night: 1 });
    expect(e.events.filter((x) => x.kind === 'bird').length).toBe(day);
  });
});

describe('background music', () => {
  it('is a two-track playlist of streamed MP3s, each within its budget', () => {
    expect(MUSIC.length).toBe(2);
    for (const t of MUSIC) {
      const size = statSync(join(PUBLIC, t.url)).size;
      expect(size, t.url).toBe(t.bytes);
      expect(size, t.url).toBeLessThan(3 * 1024 * 1024); // streamed after Start, one track at a time
      expect(t.seconds, t.url).toBeGreaterThan(60);
    }
  });

  it('stays silent and fetches nothing until unlocked, and remembers the music choice', () => {
    const engine = new SoundEngine(true, Math.random, false);
    expect(engine.musicState).toEqual({ on: false, playing: false, track: -1, url: null });
    engine.setMusic(true);
    // no audio context yet (no user gesture): nothing starts
    expect(engine.musicState.playing).toBe(false);
    expect(engine.musicState.on).toBe(true);
  });
});
