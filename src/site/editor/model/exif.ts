/**
 * The day a picture was taken, read from its own bytes (gallery spec §4, "Read at upload"): the EXIF
 * `DateTimeOriginal`, else `DateTime`, as YYYY-MM-DD; and where, from its GPS (§9.8.2: kept only on this
 * computer, never in a sidecar). Pure and small, for the server (before the master is
 * written without its metadata) and the browser (a HEIC it turns into a PNG first, which loses the EXIF).
 * It finds the EXIF block in a JPEG (APP1), a PNG (`eXIf`), a WebP (`EXIF`), a TIFF (the file itself), and
 * in a HEIC or AVIF by its "Exif" header; every offset is checked, so a broken file gives no date, never
 * an error. Nothing is guessed from the file's own times.
 */

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LATITUDE_REF = 0x0001;
const TAG_GPS_LATITUDE = 0x0002;
const TAG_GPS_LONGITUDE_REF = 0x0003;
const TAG_GPS_LONGITUDE = 0x0004;
const ASCII = 2;
const LONG = 4;
const RATIONAL = 5;

const startsWith = (b: Uint8Array, at: number, sig: readonly number[]) => at + sig.length <= b.length && sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, n: number) => (at + n <= b.length ? String.fromCharCode(...b.subarray(at, at + n)) : '');

/** A TIFF header ("II*\0" or "MM\0*") at `at`. */
const isTiff = (b: Uint8Array, at: number) => startsWith(b, at, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, at, [0x4d, 0x4d, 0x00, 0x2a]);

/** The TIFF block (the EXIF data, from its byte-order mark) inside a file, or null. */
export function exifBlock(bytes: Uint8Array): Uint8Array | null {
  const b = bytes;
  // TIFF: the file is the block
  if (isTiff(b, 0)) return b;
  // JPEG: segments until the picture data; APP1 holding "Exif\0\0"
  if (b[0] === 0xff && b[1] === 0xd8) {
    let at = 2;
    while (at + 4 <= b.length) {
      if (b[at] !== 0xff) return null;
      const marker = b[at + 1];
      if (marker === 0xff) {
        at += 1;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        at += 2;
        continue;
      }
      const len = (b[at + 2] << 8) | b[at + 3];
      if (len < 2 || at + 2 + len > b.length) return null;
      if (marker === 0xe1 && startsWith(b, at + 4, EXIF_HEADER)) return b.subarray(at + 10, at + 2 + len);
      at += 2 + len;
    }
    return null;
  }
  // PNG: chunks until IEND; eXIf holds the block as it is
  if (startsWith(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    let at = 8;
    while (at + 8 <= b.length) {
      const len = ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
      const type = ascii(b, at + 4, 4);
      if (at + 12 + len > b.length) return null;
      if (type === 'eXIf') {
        const data = b.subarray(at + 8, at + 8 + len);
        return startsWith(data, 0, EXIF_HEADER) ? data.subarray(6) : data;
      }
      if (type === 'IEND') return null;
      at += 12 + len;
    }
    return null;
  }
  // WebP: RIFF chunks (padded to even); EXIF holds the block, sometimes after "Exif\0\0"
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    let at = 12;
    while (at + 8 <= b.length) {
      const type = ascii(b, at, 4);
      const len = (b[at + 4] | (b[at + 5] << 8) | (b[at + 6] << 16) | (b[at + 7] << 24)) >>> 0;
      if (at + 8 + len > b.length) return null;
      if (type === 'EXIF') {
        const data = b.subarray(at + 8, at + 8 + len);
        return startsWith(data, 0, EXIF_HEADER) ? data.subarray(6) : data;
      }
      at += 8 + len + (len & 1);
    }
    return null;
  }
  // HEIC, AVIF and the rest: the first "Exif\0\0" followed by a TIFF header
  for (let at = 0; at + 10 <= b.length; at += 1) {
    if (b[at] === 0x45 && startsWith(b, at, EXIF_HEADER) && isTiff(b, at + 6)) return b.subarray(at + 6);
  }
  return null;
}

/** "2024:07:15 18:02:11" as "2024-07-15", or null when it isn't a real day (cameras write zeros when unset). */
export function exifDay(value: string): string | null {
  const m = /^\s*(\d{4})[:\-](\d{2})[:\-](\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1800) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** An IFD entry: its type, count and where its value is (inline when it fits in four bytes). */
type Entry = { type: number; count: number; value: number };

/** Reads a TIFF block's numbers in its byte order, and its IFDs (tag → entry); every offset is checked. */
function tiffReader(t: Uint8Array) {
  const little = t[0] === 0x49;
  const u16 = (at: number) => (at >= 0 && at + 2 <= t.length ? (little ? t[at] | (t[at + 1] << 8) : (t[at] << 8) | t[at + 1]) : -1);
  const u32 = (at: number) => (at >= 0 && at + 4 <= t.length ? (little ? (t[at] | (t[at + 1] << 8) | (t[at + 2] << 16) | (t[at + 3] << 24)) >>> 0 : ((t[at] << 24) | (t[at + 1] << 16) | (t[at + 2] << 8) | t[at + 3]) >>> 0) : -1);
  const ifd = (at: number) => {
    const entries = new Map<number, Entry>();
    const n = u16(at);
    if (n < 0 || n > 1000 || at + 2 + n * 12 > t.length) return entries;
    for (let i = 0; i < n; i += 1) {
      const e = at + 2 + i * 12;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = type === ASCII ? count : type === LONG ? count * 4 : type === RATIONAL ? count * 8 : 0;
      entries.set(u16(e), { type, count, value: size > 4 ? u32(e + 8) : e + 8 });
    }
    return entries;
  };
  /** The IFD a pointer tag in IFD0 leads to (the Exif IFD, the GPS IFD), or an empty one. */
  const sub = (ifd0: Map<number, Entry>, ifd0At: number, tag: number) => {
    const p = ifd0.get(tag);
    if (p?.type !== LONG || p.count !== 1) return new Map<number, Entry>();
    const at = u32(p.value);
    return at >= 8 && at !== ifd0At ? ifd(at) : new Map<number, Entry>();
  };
  return { u16, u32, ifd, sub };
}

/** The day a TIFF block says the picture was taken: DateTimeOriginal (in the Exif IFD), else DateTime (IFD0). */
export function takenFromTiff(t: Uint8Array): string | null {
  if (!isTiff(t, 0)) return null;
  const { u32, ifd, sub } = tiffReader(t);
  const text = (e: Entry | undefined) => {
    if (!e || e.type !== ASCII || e.count < 10 || e.value < 0 || e.value + e.count > t.length) return null;
    return exifDay(ascii(t, e.value, Math.min(e.count, 32)).replace(/\0.*$/, ''));
  };
  const ifd0At = u32(4);
  if (ifd0At < 8) return null;
  const ifd0 = ifd(ifd0At);
  return text(sub(ifd0, ifd0At, TAG_EXIF_IFD).get(TAG_DATE_TIME_ORIGINAL)) ?? text(ifd0.get(TAG_DATE_TIME));
}

/** Where a picture was taken: its GPS latitude and longitude in degrees (south and west negative). */
export interface PictureLocation {
  lat: number;
  lon: number;
}

/** Where a TIFF block says the picture was taken (its GPS IFD), or null: no GPS, a broken entry, or 0,0 (cameras write it when unset). */
export function locationFromTiff(t: Uint8Array): PictureLocation | null {
  if (!isTiff(t, 0)) return null;
  const { u32, ifd, sub } = tiffReader(t);
  const ifd0At = u32(4);
  if (ifd0At < 8) return null;
  const gps = sub(ifd(ifd0At), ifd0At, TAG_GPS_IFD);
  const ref = (tag: number) => {
    const e = gps.get(tag);
    return e?.type === ASCII && e.count >= 1 ? ascii(t, e.value, 1) : '';
  };
  const degrees = (tag: number) => {
    const e = gps.get(tag);
    if (e?.type !== RATIONAL || e.count !== 3) return null;
    let d = 0;
    for (let i = 0; i < 3; i += 1) {
      const num = u32(e.value + i * 8);
      const den = u32(e.value + i * 8 + 4);
      if (num < 0 || den <= 0) return null;
      d += num / den / 60 ** i;
    }
    return d;
  };
  const lat = degrees(TAG_GPS_LATITUDE);
  const lon = degrees(TAG_GPS_LONGITUDE);
  const latRef = ref(TAG_GPS_LATITUDE_REF);
  const lonRef = ref(TAG_GPS_LONGITUDE_REF);
  if (lat === null || lon === null || !/^[NS]$/.test(latRef) || !/^[EW]$/.test(lonRef) || lat > 90 || lon > 180 || (lat === 0 && lon === 0)) return null;
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return { lat: round(latRef === 'S' ? -lat : lat), lon: round(lonRef === 'W' ? -lon : lon) };
}

/** Where a picture file was taken, from its EXIF GPS, or null when it doesn't say. */
export function locationOf(bytes: Uint8Array): PictureLocation | null {
  try {
    const block = exifBlock(bytes);
    return block ? locationFromTiff(block) : null;
  } catch {
    return null;
  }
}

/** The day a picture file was taken (YYYY-MM-DD), from its EXIF, or null when it doesn't say. */
export function takenOf(bytes: Uint8Array): string | null {
  try {
    const block = exifBlock(bytes);
    return block ? takenFromTiff(block) : null;
  } catch {
    return null;
  }
}
