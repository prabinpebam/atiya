import { describe, expect, it } from 'vitest';
import {
  PLAY_BYTES_MAX,
  lengthOf,
  mayMove,
  mayPlay,
  pausedBands,
  placeStyle,
  playing,
  seeAll,
  shouldLoad,
  shouldPlay,
  tileName,
  tileSizes,
  viewShare,
  withPaused,
} from '../../src/site/scripts/albumBandRules';
import { PLAY_MAX_BYTES, PLAY_MAX_TILES } from '../../src/site/content/schema';

const calm = { reducedMotion: false, saveData: false };

describe('album band: which tiles play (gallery spec §4.3)', () => {
  it('keeps to the content contract’s limits', () => {
    expect(PLAY_BYTES_MAX).toBe(PLAY_MAX_BYTES);
    expect(playing(Array.from({ length: 5 }, () => ({ kind: 'video' as const, play: true }))).size).toBe(PLAY_MAX_TILES);
  });

  it('only a video file or an animated picture set to play, within 10 MB; never an embed', () => {
    expect(mayPlay({ kind: 'video', play: true })).toBe(true);
    expect(mayPlay({ kind: 'animated', play: true, bytes: 2_000_000 })).toBe(true);
    expect(mayPlay({ kind: 'video' })).toBe(false);
    expect(mayPlay({ kind: 'embed', play: true })).toBe(false);
    expect(mayPlay({ kind: 'picture', play: true })).toBe(false);
    expect(mayPlay({ kind: 'drawing', play: true })).toBe(false);
    expect(mayPlay({ kind: 'video', play: true, bytes: PLAY_BYTES_MAX + 1 })).toBe(false);
  });

  it('the first two that may, in reading order', () => {
    const tiles = [
      { kind: 'embed' as const, play: true },
      { kind: 'video' as const, play: true },
      { kind: 'picture' as const },
      { kind: 'animated' as const, play: true },
      { kind: 'animated' as const, play: true },
    ];
    expect([...playing(tiles)]).toEqual([1, 3]);
  });
});

describe('album band: when a tile plays', () => {
  it('never under reduced motion or Save-Data', () => {
    expect(mayMove(calm)).toBe(true);
    expect(mayMove({ reducedMotion: true, saveData: false })).toBe(false);
    expect(mayMove({ reducedMotion: false, saveData: true })).toBe(false);
    expect(shouldPlay({ reader: { reducedMotion: true, saveData: false }, paused: false, share: 1 })).toBe(false);
    expect(shouldLoad({ reader: { reducedMotion: false, saveData: true }, near: true })).toBe(false);
  });

  it('only while at least half of it is in view, and not while its band is paused', () => {
    expect(shouldPlay({ reader: calm, paused: false, share: 0.5 })).toBe(true);
    expect(shouldPlay({ reader: calm, paused: false, share: 0.49 })).toBe(false);
    expect(shouldPlay({ reader: calm, paused: true, share: 1 })).toBe(false);
  });

  it('its file is fetched only once it comes near', () => {
    expect(shouldLoad({ reader: calm, near: false })).toBe(false);
    expect(shouldLoad({ reader: calm, near: true })).toBe(true);
  });

  it('a tile taller than the screen counts as in view when it fills half the screen', () => {
    expect(viewShare(0.6, 300, 800)).toBe(0.6);
    expect(viewShare(0.3, 600, 800)).toBe(0.75);
    expect(viewShare(0.2, 100, undefined)).toBe(0.2);
  });

  it('Pause is kept for the visit, band by band', () => {
    expect([...pausedBands(null)]).toEqual([]);
    expect([...pausedBands('not json')]).toEqual([]);
    expect([...pausedBands('{"a":1}')]).toEqual([]);
    const one = withPaused(null, 'summer', true);
    expect([...pausedBands(one)]).toEqual(['summer']);
    const two = withPaused(one, 'autumn', true);
    expect([...pausedBands(two)]).toEqual(['autumn', 'summer']);
    expect([...pausedBands(withPaused(two, 'summer', false))]).toEqual(['autumn']);
  });
});

describe('album band: names and words (§5, §10)', () => {
  it('a tile is named by its alt text, an animated one says so, a video by its title and length', () => {
    expect(tileName({ kind: 'picture', alt: 'A heron on the bank' })).toBe('A heron on the bank');
    expect(tileName({ kind: 'drawing', alt: 'A map of the valley' })).toBe('A map of the valley');
    expect(tileName({ kind: 'animated', alt: 'Leaves turning' })).toBe('Leaves turning, animated');
    expect(tileName({ kind: 'video', title: 'The bridge', duration: 140 })).toBe('Video: The bridge (2 minutes 20 seconds)');
    expect(tileName({ kind: 'embed', title: 'A talk' })).toBe('Video: A talk');
  });

  it('a length as a clock and in words', () => {
    expect(lengthOf(undefined)).toBeUndefined();
    expect(lengthOf(0)).toBeUndefined();
    expect(lengthOf(61)).toEqual({ clock: '1:01', spoken: '1 minute 1 second' });
    expect(lengthOf(45)).toEqual({ clock: '0:45', spoken: '45 seconds' });
    expect(lengthOf(120)).toEqual({ clock: '2:00', spoken: '2 minutes' });
  });

  it('"See all 21", named with its album; "Open the album" when everything is up front', () => {
    expect(seeAll(21, 5, 'Summer sketches')).toEqual({ text: 'See all 21', label: 'See all 21 in Summer sketches' });
    expect(seeAll(3, 3, 'Summer sketches')).toEqual({ text: 'Open the album', label: 'Open the album Summer sketches' });
  });
});

describe('album band: a tile’s place and sizes (§6)', () => {
  it('grid lines from 1, spans in cells, the phone’s four beside the wide four', () => {
    expect(placeStyle({ x: 0, y: 0, w: 6, h: 4 }, { x: 3, y: 4, w: 3, h: 2 })).toBe('--x: 1; --y: 1; --w: 6; --h: 4; --px: 4; --py: 5; --pw: 3; --ph: 2');
  });

  it('sizes from the responsive helper, never a written rem: the phone’s share, then the band’s', () => {
    expect(tileSizes(6, 3)).toBe('(max-width: 40rem) 46vw, (max-width: 76rem) 50vw, 38rem');
    expect(tileSizes(12)).toBe('(max-width: 40rem) 92vw, (max-width: 76rem) 100vw, 76rem');
  });
});
