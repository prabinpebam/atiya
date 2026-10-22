/**
 * An album's band, its rules (tier 0; documentation/gallery/spec.md §4.3, §5, §6, §10): which tiles may play in
 * the band and when they do, the Pause button's state kept for the visit, a tile's name and place, the words
 * of "See all" and a tile's picture sizes. Pure: the component and its script (albumBand.ts) read them.
 */
import { sizes, type Width } from '../design/responsive';
import type { PictureSource } from '../design/pictures';

/** A tile's place on a grid, in cells from 0. */
export interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One tile of a band, as the AlbumBand compound draws it (built from an album by content/bands.ts). */
export interface BandTile {
  /** The item's ID: its address on the album page is #item-<id>. */
  id: string;
  /** What it holds. */
  kind: TileKind;
  /** Its name for a screen reader (tileName). */
  name: string;
  /** Where it goes: the item on the album page. */
  href: string;
  /** Its place on the wide band's 12 columns. */
  place: Place;
  /** Its place on the phone's 6 columns; left out, it isn't shown on phones. */
  phone?: Place;
  /** How the picture is shown in its tile (gallery spec §6.5): left out, fill (a drawing: fit). */
  display?: 'fill' | 'fit' | 'actual' | 'tile';
  /** The part a fill keeps ("50% 30%"): the tile's own, else the picture's. */
  focus?: string;
  /** The still it shows: the picture, an animated picture's still, a video's or an embed's poster. Left out, a quiet tile with its badge. */
  still?: PictureSource & { dark?: PictureSource };
  /** What plays in the band, only on a tile that plays (playing()): a video file, or an animated picture and its dark version. */
  motion?: { kind: 'video'; src: string; type: string } | { kind: 'animated'; src: string; srcset?: string; dark?: string };
  /** A video's or an embed's length on its badge ("2:20"). */
  length?: string;
  /** For the lightbox (G4): the item's full-size file, its dark version, its caption and its alt text. */
  full?: { src: string; dark?: string; thumb?: string; thumbDark?: string; caption?: string; alt?: string };
  /** The item's place in the album (0-based), so the lightbox's counter reads "7 of 21" before the album arrives. */
  index?: number;
}

/** What can sit in a tile. */
export type TileKind = 'picture' | 'animated' | 'drawing' | 'video' | 'embed';

/** At most this many tiles play in a band (V48). */
export const PLAY_MAX = 2;
/** Each at most this many bytes (V48). */
export const PLAY_BYTES_MAX = 10 * 1024 * 1024;
/** A tile plays while at least this share of it is in view. */
export const PLAY_SHARE = 0.5;
/** A tile's file is fetched when it comes this near the screen (an IntersectionObserver's rootMargin). */
export const NEAR = '50% 0px';
/** Where the visit's paused bands are kept (sessionStorage). */
export const PAUSED_KEY = 'site.albumBand.paused';

/** Whether a tile asked to play may (§4.3): a video file or an animated picture, within the size limit. Never an embed. */
export const mayPlay = (t: { kind: TileKind | undefined; play?: boolean; bytes?: number }): boolean =>
  !!t.play && (t.kind === 'video' || t.kind === 'animated') && (t.bytes === undefined || t.bytes <= PLAY_BYTES_MAX);

/** The tiles that play in a band, by index in reading order: those that may, the first PLAY_MAX of them. */
export function playing(tiles: readonly { kind: TileKind | undefined; play?: boolean; bytes?: number }[]): Set<number> {
  const out = new Set<number>();
  tiles.forEach((t, i) => {
    if (out.size < PLAY_MAX && mayPlay(t)) out.add(i);
  });
  return out;
}

/** What the reader's browser asks for. */
export interface Reader {
  /** prefers-reduced-motion: reduce. */
  reducedMotion: boolean;
  /** Save-Data (navigator.connection.saveData). */
  saveData: boolean;
}

/** Whether anything in a band may move for this reader: never under reduced motion or Save-Data (the poster stays). */
export const mayMove = (r: Reader): boolean => !r.reducedMotion && !r.saveData;

/** Whether a tile plays now: it may move, its band isn't paused, and at least half of it is in view. */
export const shouldPlay = (s: { reader: Reader; paused: boolean; share: number }): boolean => mayMove(s.reader) && !s.paused && s.share >= PLAY_SHARE;

/**
 * How much of a tile is in view, from an IntersectionObserver's entry: its own share, or, for a tile taller than
 * the screen, the share of the screen it fills (so a tall tile filling the view still counts as half in view).
 */
export function viewShare(ratio: number, visibleHeight: number, viewHeight: number | undefined): number {
  return Math.max(ratio, viewHeight ? visibleHeight / viewHeight : 0);
}

/** Whether a tile's file should be fetched: once it has come near the screen, and only if it may ever move. */
export const shouldLoad = (s: { reader: Reader; near: boolean }): boolean => mayMove(s.reader) && s.near;

/** The bands paused this visit, from what sessionStorage holds (anything unreadable: none). */
export function pausedBands(raw: string | null): Set<string> {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** What to keep after a band is paused or played again. */
export function withPaused(raw: string | null, band: string, paused: boolean): string {
  const set = pausedBands(raw);
  if (paused) set.add(band);
  else set.delete(band);
  return JSON.stringify([...set].sort());
}

/** A length in seconds as a clock ("2:20") and in words ("2 minutes 20 seconds"), as the video block shows it. */
export function lengthOf(seconds: number | undefined): { clock: string; spoken: string } | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const s = Math.round(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  const spoken = [mins && `${mins} minute${mins === 1 ? '' : 's'}`, secs && `${secs} second${secs === 1 ? '' : 's'}`].filter(Boolean).join(' ');
  return { clock: `${mins}:${String(secs).padStart(2, '0')}`, spoken };
}

/**
 * A tile's name (§10): its item's alt text, ", animated" added for an animated picture; "Video: title" and
 * its length for a video or an embed. The badge's words are part of it.
 */
export function tileName(t: { kind: TileKind | undefined; alt?: string; title?: string; duration?: number }): string {
  if (t.kind === 'video' || t.kind === 'embed') {
    const len = lengthOf(t.duration);
    return `Video: ${t.title || t.alt || 'untitled'}${len ? ` (${len.spoken})` : ''}`;
  }
  const alt = t.alt || t.title || 'Picture';
  return t.kind === 'animated' ? `${alt}, animated` : alt;
}

/** "See all 21", named "See all 21 in Summer sketches"; "Open the album" when every item is up front. */
export function seeAll(total: number, upFront: number, title: string): { text: string; label: string } {
  return upFront >= total ? { text: 'Open the album', label: `Open the album ${title}` } : { text: `See all ${total}`, label: `See all ${total} in ${title}` };
}

/** A tile's place as its local custom properties (§6.2): grid lines from 1, spans in cells, wide then phone. */
export function placeStyle(wide: { x: number; y: number; w: number; h: number }, phone?: { x: number; y: number; w: number; h: number }): string {
  const p = phone ?? { x: 0, y: 0, w: 6, h: 2 };
  return `--x: ${wide.x + 1}; --y: ${wide.y + 1}; --w: ${wide.w}; --h: ${wide.h}; --px: ${p.x + 1}; --py: ${p.y + 1}; --pw: ${p.w}; --ph: ${p.h}`;
}

/**
 * A tile's `sizes` (§6.2): its share of the phone's 6 columns across the screen up to the compose width, and its
 * share of the band's 12 columns at the page's wide width beyond.
 */
export function tileSizes(w: number, pw = 6): string {
  const vw = (share: number): Width => `${Math.ceil(share * 100)}vw`;
  return sizes(['sm', vw((pw / 6) * 0.92)], ['wide', vw(w / 12)], { share: 'wide', of: 12 / w });
}
