/**
 * A video file's date (documentation/gallery/spec.md §3.3, §4.2, V50): the day it was made, read from the file
 * as it was uploaded. An MP4 or MOV says it in its movie header (`moov` → `mvhd`, `creation_time`: seconds since
 * 1904-01-01 UTC); a WebM in its segment's info (`DateUTC`: nanoseconds since 2001-01-01 UTC). Pure and without
 * a dependency, like the EXIF reader (exif.ts); the server keeps the day only when it's real and not after today.
 */

const MAC_EPOCH_S = 2082844800n; // seconds from 1904-01-01 to 1970-01-01
const WEBM_EPOCH_MS = Date.UTC(2001, 0, 1);

const dayOf = (ms: number): string | undefined => {
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1971) return undefined;
  return d.toISOString().slice(0, 10);
};

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** An ISO base media box's children between `start` and `end`: their type, where their content starts and ends. */
function* boxes(b: Uint8Array, start: number, end: number): Generator<{ type: string; body: number; end: number }> {
  const v = view(b);
  let at = start;
  while (at + 8 <= end) {
    let size = v.getUint32(at);
    const type = String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) return;
      const big = v.getBigUint64(at + 8);
      size = big > BigInt(end - at) ? end - at : Number(big);
      body = at + 16;
    } else if (size === 0) size = end - at;
    if (size < body - at) return;
    const next = Math.min(end, at + size);
    yield { type, body, end: next };
    at = next;
  }
}

/** An MP4's or MOV's `creation_time`, as a day, or undefined. */
function mp4Day(b: Uint8Array): string | undefined {
  for (const top of boxes(b, 0, b.length)) {
    if (top.type !== 'moov') continue;
    for (const box of boxes(b, top.body, top.end)) {
      if (box.type !== 'mvhd' || box.body + 4 > box.end) continue;
      const v = view(b);
      const version = b[box.body];
      let secs: bigint;
      if (version === 1) {
        if (box.body + 12 > box.end) return undefined;
        secs = v.getBigUint64(box.body + 4);
      } else {
        if (box.body + 8 > box.end) return undefined;
        secs = BigInt(v.getUint32(box.body + 4));
      }
      if (secs === 0n) return undefined;
      return dayOf(Number(secs - MAC_EPOCH_S) * 1000);
    }
    return undefined;
  }
  return undefined;
}

/** An EBML variable-length integer at `at`: its length and value (the marker bit kept for an ID, dropped for a size). */
function vint(b: Uint8Array, at: number, keepMarker: boolean): { length: number; value: number; unknown: boolean } | null {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || at + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let ones = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[at + i];
    if (b[at + i] !== 0xff) ones = false;
  }
  return { length, value, unknown: !keepMarker && ones };
}

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const DATE_UTC = 0x4461;

/** A WebM's (Matroska's) `DateUTC`, as a day, or undefined. */
function webmDay(b: Uint8Array): string | undefined {
  const walk = (start: number, end: number, depth: number): string | undefined => {
    let at = start;
    while (at < end) {
      const id = vint(b, at, true);
      if (!id) return undefined;
      const size = vint(b, at + id.length, false);
      if (!size) return undefined;
      const body = at + id.length + size.length;
      const stop = size.unknown ? end : Math.min(end, body + size.value);
      if (id.value === DATE_UTC && size.value === 8 && body + 8 <= b.length) {
        const ns = view(b).getBigInt64(body);
        return dayOf(WEBM_EPOCH_MS + Number(ns / 1_000_000n));
      }
      if ((id.value === SEGMENT || id.value === INFO) && depth < 2) {
        const found = walk(body, stop, depth + 1);
        if (found || id.value === INFO) return found;
      }
      // a segment of unknown size (a live recording) runs to the end: nothing follows it
      if (size.unknown) return undefined;
      at = stop;
    }
    return undefined;
  };
  return walk(0, b.length, 0);
}

/**
 * The day a video file was made (YYYY-MM-DD, UTC), from its own header, or undefined when it doesn't say (a
 * zero time, no header, another format). The caller keeps it only when it's not after today (V50).
 */
export function videoTakenOf(bytes: Uint8Array): string | undefined {
  try {
    if (bytes.length >= 4 && view(bytes).getUint32(0) === EBML) return webmDay(bytes);
    if (bytes.length >= 8) return mp4Day(bytes);
  } catch {
    return undefined;
  }
  return undefined;
}
