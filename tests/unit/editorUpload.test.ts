/**
 * The upload form's rules (src/site/editor/model/upload.ts; documentation/editor/spec.md §6): what the
 * server reads as it is, what the browser converts first, what a paste holds, a pasted picture's name and
 * the preview's line.
 */
import { describe, expect, it } from 'vitest';
import { clock, describePicture, describeVideo, formatLabel, isVideoFile, keptAsIs, MAX_GIF_BYTES, MAX_PICTURE_BYTES, MAX_VIDEO_BYTES, mayHaveAlpha, megabytes, needsConversion, pastedName, pictureOfPaste, picturesOfPaste, pictureSizeIssue, pngName, posterTime, typeOf, videoSizeIssue, videoTypeOf } from '../../src/site/editor/model/upload';
import { APNG_NOTE, canKeepLarge, focusPercent, isApng, joinFocus, MAX_LARGE_SIDE, MAX_SIDE, refusedFormat, removedNote, svgChoices, SVG_DRAWING_MAX_BYTES, uploadOptions } from '../../src/site/editor/model/upload';
import { exifBlock, exifDay, locationFromTiff, locationOf, takenFromTiff, takenOf } from '../../src/site/editor/model/exif';
import sharp from 'sharp';

describe('the upload form', () => {
  it('knows a file by its type, or by its extension when the system gives none', () => {
    expect(typeOf({ type: 'image/PNG', name: 'a' })).toBe('image/png');
    expect(typeOf({ type: '', name: 'Scan.TIF' })).toBe('image/tiff');
    expect(typeOf({ type: '', name: 'photo.heic' })).toBe('image/heic');
    expect(typeOf({ type: '', name: 'notes.txt' })).toBe('');
  });

  it('sends what the server reads as it is, and converts the rest to PNG first', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff', 'image/svg+xml']) expect(needsConversion(t), t).toBe(false);
    for (const t of ['image/bmp', 'image/x-icon', 'image/heic']) expect(needsConversion(t), t).toBe(true);
    expect(mayHaveAlpha('image/png')).toBe(true);
    expect(mayHaveAlpha('image/jpeg')).toBe(false);
    expect(pngName('Logo.bmp')).toBe('Logo.png');
  });

  it("takes a pasted picture only when there's no text with it", () => {
    const shot = { type: 'image/png', name: 'image.png' };
    expect(pictureOfPaste([shot], '')).toBe(shot);
    expect(pictureOfPaste([shot], 'A table copied from a document')).toBeNull();
    expect(pictureOfPaste([{ type: 'text/plain', name: 'a.txt' }], '')).toBeNull();
    expect(pictureOfPaste([], '')).toBeNull();
  });

  it('takes every pasted picture and video file, in order, and none with text', () => {
    const a = { type: 'image/png', name: 'image.png' };
    const b = { type: 'video/mp4', name: 'clip.mp4' };
    const note = { type: 'text/plain', name: 'a.txt' };
    expect(picturesOfPaste([a, note, b], '')).toEqual([a, b]);
    expect(picturesOfPaste([a, b], 'words')).toEqual([]);
    expect(picturesOfPaste([note], '')).toEqual([]);
  });

  it('names a pasted screenshot by its date, and keeps a real name', () => {
    const day = new Date(2026, 9, 1);
    expect(pastedName('image.png', 'image/png', day)).toBe('pasted-picture-2026-10-01.png');
    expect(pastedName('', 'image/jpeg', day)).toBe('pasted-picture-2026-10-01.jpg');
    expect(pastedName('Team photo.jpg', 'image/jpeg', day)).toBe('Team photo.jpg');
  });

  it("describes the preview: its size, its format, its transparency, its crop", () => {
    expect(formatLabel('image/svg+xml')).toBe('SVG');
    expect(describePicture({ width: 1200, height: 800, type: 'image/png', alpha: true })).toBe('1200 × 800 px, PNG, transparent.');
    expect(describePicture({ width: 1200, height: 800, type: 'image/jpeg', alpha: false, crop: { width: 600, height: 400 } })).toBe('1200 × 800 px, JPEG. Cropped to 600 × 400 px.');
    expect(describePicture({ width: 16, height: 16, type: 'image/x-icon', alpha: true, converted: true })).toBe('16 × 16 px, ICO, transparent. Uploads as a PNG.');
    expect(describePicture({ width: 200, height: 300, type: 'image/gif', alpha: false, bytes: 9_354_419 })).toBe('200 × 300 px, GIF, 9.4 MB. Kept exactly as it is.');
    expect(describePicture({ width: 200, height: 300, type: 'image/gif', alpha: false, bytes: 60_000_000 })).toMatch(/Kept exactly as it is\. Over 50 MB: GitHub takes it/);
  });

  it('a GIF is kept as it is, so its limit is GitHub’s for a file; any other picture uploads at up to 20 MB', () => {
    expect(keptAsIs('image/gif')).toBe(true);
    expect(keptAsIs('image/png')).toBe(false);
    expect(MAX_GIF_BYTES).toBe(MAX_VIDEO_BYTES);
    expect(pictureSizeIssue('image/gif', 9_354_419)).toBeNull();
    expect(pictureSizeIssue('image/gif', MAX_GIF_BYTES - 1)).toBeNull();
    expect(pictureSizeIssue('image/gif', MAX_GIF_BYTES)).toMatch(/a GIF is kept as it is, so it must be under 100 MB/);
    expect(pictureSizeIssue('image/png', MAX_PICTURE_BYTES)).toBeNull();
    expect(pictureSizeIssue('image/png', MAX_PICTURE_BYTES + 1)).toMatch(/up to 20 MB/);
  });
});

describe('a video in the upload form (documentation/content/media.md §12)', () => {
  const file = (name: string, type = '') => ({ name, type });

  it('takes MP4, WebM and MOV (by type or extension), and knows other videos for what they are', () => {
    expect(videoTypeOf(file('demo.mp4', 'video/mp4'))).toBe('video/mp4');
    expect(videoTypeOf(file('demo.m4v'))).toBe('video/mp4');
    expect(videoTypeOf(file('demo.m4v', 'video/x-m4v'))).toBe('video/mp4');
    expect(videoTypeOf(file('demo.webm'))).toBe('video/webm');
    expect(videoTypeOf(file('IMG_0001.MOV', 'video/quicktime'))).toBe('video/quicktime');
    expect(videoTypeOf(file('demo.mkv', 'video/x-matroska'))).toBe('');
    expect(videoTypeOf(file('demo.avi'))).toBe('');
    expect([isVideoFile(file('demo.mkv')), isVideoFile(file('clip', 'video/ogg')), isVideoFile(file('pic.png', 'image/png'))]).toEqual([true, true, false]);
    // a copied video file is a paste the form takes, as a picture is; text still wins
    expect(pictureOfPaste([file('demo.mp4', 'video/mp4')], '')).toMatchObject({ name: 'demo.mp4' });
    expect(pictureOfPaste([file('demo.mp4', 'video/mp4')], 'words')).toBeNull();
  });

  it('refuses a video of 100 MB or more (GitHub refuses the file in a push), and says how to make it smaller', () => {
    expect(MAX_VIDEO_BYTES).toBe(100_000_000);
    expect(MAX_VIDEO_BYTES).toBeLessThan(100 * 1024 * 1024);
    expect(videoSizeIssue(MAX_VIDEO_BYTES - 1)).toBeNull();
    expect(videoSizeIssue(MAX_VIDEO_BYTES)).toMatch(/^It's 100 MB: a video must be under 100 MB, GitHub's limit for a file\. Make it shorter or smaller/);
    expect(videoSizeIssue(250_000_000)).toMatch(/^It's 250 MB/);
  });

  it('describes it in the preview: its size, format, length and weight, and warns past 50 MB', () => {
    expect(describeVideo({ width: 1920, height: 1080, type: 'video/mp4', duration: 83.4, bytes: 34_200_000 })).toBe('1920 × 1080 px, MP4, 1:23, 34 MB.');
    expect(describeVideo({ width: 1280, height: 720, type: 'video/webm', duration: 9.6, bytes: 2_400_000 })).toBe('1280 × 720 px, WebM, 0:10, 2.4 MB.');
    expect(describeVideo({ width: 1080, height: 1920, type: 'video/quicktime', duration: 30, bytes: 60_000_000 })).toBe('1080 × 1920 px, MOV, 0:30, 60 MB. Saved as an MP4. Over 50 MB: GitHub takes it, but warns about files this big.');
    expect([clock(0), clock(59.6), clock(3725), megabytes(999_999)]).toEqual(['0:00', '1:00', '1:02:05', '1.0 MB']);
  });

  it('takes its poster a second in, or a tenth of a short one', () => {
    expect([posterTime(60), posterTime(5), posterTime(0), posterTime(Number.NaN)]).toEqual([1, 0.5, 0, 0]);
  });
});

// ---------- gallery spec §4: formats, the date taken, the focus point, keeping it large, drawings ----------

describe('formats the site refuses, with what to do (gallery spec §4)', () => {
  it('refuses JPEG XL, camera RAW and Photoshop files, by name or type, saying to export them', () => {
    expect(refusedFormat({ type: '', name: 'shot.JXL' })).toMatch(/JPEG XL.*Export it as JPEG or PNG/);
    expect(refusedFormat({ type: 'image/jxl', name: 'a' })).toMatch(/JPEG XL/);
    for (const ext of ['cr2', 'CR3', 'nef', 'arw', 'dng', 'orf', 'rw2', 'raf']) expect(refusedFormat({ type: '', name: `IMG_1.${ext}` }), ext).toMatch(/camera RAW.*Export it as JPEG or PNG/);
    expect(refusedFormat({ type: 'image/x-canon-cr2', name: 'x' })).toMatch(/camera RAW/);
    expect(refusedFormat({ type: '', name: 'poster.psd' })).toMatch(/Photoshop.*Export it as PNG or JPEG/);
    expect(refusedFormat({ type: 'image/vnd.adobe.photoshop', name: 'x' })).toMatch(/Photoshop/);
  });

  it('refuses MKV, AVI, WMV and 3GP, saying to save them as MP4', () => {
    expect(refusedFormat({ type: '', name: 'clip.mkv' })).toBe("This MKV video is in a format the site can't keep. Save it as MP4 (HandBrake does it), then add it.");
    for (const ext of ['avi', 'wmv', '3gp', '3g2']) expect(refusedFormat({ type: '', name: `c.${ext}` }), ext).toMatch(/Save it as MP4/);
    expect(refusedFormat({ type: 'video/x-matroska', name: 'clip' })).toMatch(/^This video is in a format/);
  });

  it('keeps what it can: pictures, HEIC (converted in the browser), SVG, GIF, MP4, WebM and MOV', () => {
    for (const name of ['a.jpg', 'a.png', 'a.webp', 'a.avif', 'a.gif', 'a.tif', 'a.heic', 'a.svg', 'a.mp4', 'a.webm', 'a.mov']) expect(refusedFormat({ type: '', name }), name).toBeNull();
  });

  it('knows an animated PNG by its acTL chunk before the picture data, and says what happens to it', () => {
    const chunk = (type: string, data: number[] = []) => [0, 0, 0, data.length, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const ihdr = chunk('IHDR', new Array(13).fill(0));
    expect(isApng(new Uint8Array([...sig, ...ihdr, ...chunk('acTL', new Array(8).fill(0)), ...chunk('IDAT', [1]), ...chunk('IEND')]))).toBe(true);
    expect(isApng(new Uint8Array([...sig, ...ihdr, ...chunk('IDAT', [1]), ...chunk('acTL', new Array(8).fill(0)), ...chunk('IEND')]))).toBe(false);
    expect(isApng(new Uint8Array([...sig, ...ihdr, ...chunk('IDAT', [1]), ...chunk('IEND')]))).toBe(false);
    expect(isApng(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
    expect(APNG_NOTE).toMatch(/kept as a still picture.*GIF or an animated WebP/);
  });
});

describe('an SVG: a drawing or a picture (gallery spec §4.1)', () => {
  it('offers Keep it as a drawing up to 200 KB (the default then), and always Turn it into a picture', () => {
    expect(svgChoices(12_000)).toEqual({ drawing: true, default: 'drawing' });
    expect(svgChoices(SVG_DRAWING_MAX_BYTES)).toEqual({ drawing: true, default: 'drawing' });
    expect(svgChoices(SVG_DRAWING_MAX_BYTES + 1)).toEqual({ drawing: false, default: 'picture' });
  });
});

describe('keep it large (gallery spec §4)', () => {
  it('is offered only for a still raster picture bigger than 2560 px', () => {
    expect([MAX_SIDE, MAX_LARGE_SIDE]).toEqual([2560, 3840]);
    expect(canKeepLarge({ width: 4000, height: 3000, type: 'image/jpeg' })).toBe(true);
    expect(canKeepLarge({ width: 1200, height: 2561, type: 'image/png' })).toBe(true);
    expect(canKeepLarge({ width: 2560, height: 1440, type: 'image/jpeg' })).toBe(false);
    expect(canKeepLarge({ width: 4000, height: 3000, type: 'image/gif' })).toBe(false);
    expect(canKeepLarge({ width: 4000, height: 3000, type: 'image/svg+xml' })).toBe(false);
    expect(canKeepLarge({ width: 4000, height: 3000, type: 'image/webp', animated: true })).toBe(false);
  });
});

describe('the focus point from an attention crop (gallery spec §4)', () => {
  it('is the crop\'s centre, as percentages of the picture, whichever sign the offsets have', () => {
    expect(focusPercent({ width: 1000, height: 500 }, { left: -500, top: 0, width: 500, height: 500 })).toBe('75% 50%');
    expect(focusPercent({ width: 1000, height: 500 }, { left: 0, top: 0, width: 500, height: 500 })).toBe('25% 50%');
    expect(focusPercent({ width: 1000, height: 500 }, { left: 250, top: 0, width: 500, height: 500 })).toBe('50% 50%');
    expect(focusPercent({ width: 400, height: 800 }, { left: 0, top: -400, width: 400, height: 400 })).toBe('50% 75%');
  });

  it('stays within the picture, and is the middle of nothing measurable', () => {
    expect(focusPercent({ width: 100, height: 100 }, { left: -90, top: 0, width: 50, height: 200 })).toBe('100% 50%');
    expect(focusPercent({ width: 0, height: 0 }, { left: 0, top: 0, width: 0, height: 0 })).toBe('50% 50%');
  });

  it('joins a crop across (its x) with a crop down (its y)', () => {
    expect(joinFocus('30% 50%', '50% 80%')).toBe('30% 80%');
  });
});

// ---------- the date taken: EXIF fixtures built byte by byte ----------

/** A TIFF block (EXIF) with DateTime in IFD0 and DateTimeOriginal in the Exif IFD, either byte order. */
function tiff(o: { little?: boolean; dateTime?: string; original?: string }): Uint8Array {
  const little = o.little ?? true;
  const out: number[] = [];
  const u16 = (v: number) => (little ? out.push(v & 255, v >> 8) : out.push(v >> 8, v & 255));
  const u32 = (v: number) => (little ? out.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : out.push(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  const str = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  const n0 = (o.dateTime ? 1 : 0) + (o.original ? 1 : 0);
  const ifd0At = 8;
  const exifAt = ifd0At + 2 + n0 * 12 + 4;
  const dataAt = exifAt + (o.original ? 18 : 0);
  const dt = o.dateTime ? str(o.dateTime) : [];
  const dto = o.original ? str(o.original) : [];
  out.push(...(little ? [0x49, 0x49, 0x2a, 0] : [0x4d, 0x4d, 0, 0x2a]));
  u32(ifd0At);
  u16(n0);
  if (o.dateTime) {
    u16(0x0132), u16(2), u32(dt.length), u32(dataAt);
  }
  if (o.original) {
    u16(0x8769), u16(4), u32(1), u32(exifAt);
  }
  u32(0);
  if (o.original) {
    u16(1), u16(0x9003), u16(2), u32(dto.length), u32(dataAt + dt.length), u32(0);
  }
  out.push(...dt, ...dto);
  return new Uint8Array(out);
}
const EXIF = [0x45, 0x78, 0x69, 0x66, 0, 0];
const jpeg = (t: Uint8Array) => {
  const len = 2 + 6 + t.length;
  const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  return new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xe1, len >> 8, len & 255, ...EXIF, ...t, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
};
const pngChunk = (type: string, data: number[]) => [(data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
const png = (t: Uint8Array) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...pngChunk('IHDR', new Array(13).fill(0)), ...pngChunk('eXIf', [...t]), ...pngChunk('IEND', [])]);
const webp = (t: Uint8Array, withHeader = false) => {
  const riff = (type: string, data: number[]) => [...[...type].map((c) => c.charCodeAt(0)), data.length & 255, (data.length >> 8) & 255, (data.length >> 16) & 255, data.length >>> 24, ...data, ...(data.length & 1 ? [0] : [])];
  const body = [...[...'WEBP'].map((c) => c.charCodeAt(0)), ...riff('VP8X', new Array(10).fill(0)), ...riff('EXIF', [...(withHeader ? EXIF : []), ...t])];
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, body.length & 255, (body.length >> 8) & 255, (body.length >> 16) & 255, body.length >>> 24, ...body]);
};

describe('the date taken, read at upload (gallery spec §4)', () => {
  it('reads DateTimeOriginal before DateTime, in both byte orders', () => {
    for (const little of [true, false]) {
      const t = tiff({ little, dateTime: '2023:01:02 10:00:00', original: '2021:07:15 18:02:11' });
      expect(takenFromTiff(t), String(little)).toBe('2021-07-15');
      expect(takenFromTiff(tiff({ little, dateTime: '2023:01:02 10:00:00' }))).toBe('2023-01-02');
      expect(takenFromTiff(tiff({ little, original: '2020:02:29 00:00:00' }))).toBe('2020-02-29');
    }
  });

  it('finds the block in a JPEG, a PNG, a WebP, a TIFF and (by its header) a HEIC', () => {
    const t = tiff({ original: '2019:12:31 23:59:59' });
    expect(takenOf(jpeg(t))).toBe('2019-12-31');
    expect(takenOf(png(t))).toBe('2019-12-31');
    expect(takenOf(webp(t))).toBe('2019-12-31');
    expect(takenOf(webp(new Uint8Array([...t, 0]), true))).toBe('2019-12-31');
    expect(takenOf(t)).toBe('2019-12-31');
    const heic = new Uint8Array([0, 0, 0, 24, ...[...'ftypheic'].map((c) => c.charCodeAt(0)), 1, 2, 3, ...EXIF, ...t]);
    expect(takenOf(heic)).toBe('2019-12-31');
    expect(exifBlock(jpeg(t))).toEqual(t);
  });

  it('gives no date for one that has none, a camera\'s zeros, an impossible day or broken bytes', () => {
    expect(takenOf(jpeg(tiff({})))).toBeNull();
    expect(takenOf(jpeg(tiff({ original: '0000:00:00 00:00:00' })))).toBeNull();
    expect(takenOf(jpeg(tiff({ original: '2023:02:30 10:00:00' })))).toBeNull();
    expect(takenOf(jpeg(tiff({ original: '2023:02:30 10:00:00', dateTime: '2023:03:01 10:00:00' })))).toBe('2023-03-01');
    expect(takenOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, ...EXIF]))).toBeNull();
    const t = tiff({ original: '2019:12:31 23:59:59' });
    expect(takenOf(t.subarray(0, 30))).toBeNull();
    expect(takenOf(new Uint8Array(0))).toBeNull();
    expect([exifDay('2024-07-15'), exifDay('1799:01:01'), exifDay('not a date')]).toEqual(['2024-07-15', null, null]);
  });

  it('reads what a real encoder writes (sharp\'s EXIF in a JPEG and a WebP)', async () => {
    const base = sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } });
    const both = { IFD0: { DateTime: '2022:05:06 07:08:09' }, IFD2: { DateTimeOriginal: '2018:09:10 11:12:13' } };
    expect(takenOf(await base.clone().jpeg().withExif(both).toBuffer())).toBe('2018-09-10');
    expect(takenOf(await base.clone().webp().withExif(both).toBuffer())).toBe('2018-09-10');
    expect(takenOf(await base.clone().jpeg().withExif({ IFD0: { DateTime: '2022:05:06 07:08:09' } }).toBuffer())).toBe('2022-05-06');
    expect(takenOf(await base.clone().jpeg().toBuffer())).toBeNull();
  });
});

/** A TIFF block with only a GPS IFD: latitude and longitude as degrees, minutes, seconds (rationals) and their refs. */
function gpsTiff(o: { little?: boolean; lat: [number, number, number]; latRef: string; lon: [number, number, number]; lonRef: string; den?: number }): Uint8Array {
  const little = o.little ?? true;
  const out: number[] = [];
  const u16 = (v: number) => (little ? out.push(v & 255, v >> 8) : out.push(v >> 8, v & 255));
  const u32 = (v: number) => (little ? out.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : out.push(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  const gpsAt = 8 + 2 + 12 + 4;
  const ratAt = gpsAt + 2 + 4 * 12 + 4;
  const den = o.den ?? 100;
  out.push(...(little ? [0x49, 0x49, 0x2a, 0] : [0x4d, 0x4d, 0, 0x2a]));
  u32(8);
  u16(1), u16(0x8825), u16(4), u32(1), u32(gpsAt), u32(0);
  u16(4);
  u16(1), u16(2), u32(2), out.push(o.latRef.charCodeAt(0), 0, 0, 0);
  u16(2), u16(5), u32(3), u32(ratAt);
  u16(3), u16(2), u32(2), out.push(o.lonRef.charCodeAt(0), 0, 0, 0);
  u16(4), u16(5), u32(3), u32(ratAt + 24);
  u32(0);
  for (const v of [...o.lat, ...o.lon]) u32(Math.round(v * den)), u32(den);
  return new Uint8Array(out);
}

describe('where a picture was taken, read at upload and kept on this computer (gallery spec §9.8.2)', () => {
  it('reads the GPS latitude and longitude, south and west negative, in both byte orders', () => {
    for (const little of [true, false]) {
      expect(locationFromTiff(gpsTiff({ little, lat: [12, 58, 19.2], latRef: 'N', lon: [77, 35, 24], lonRef: 'E' })), String(little)).toEqual({ lat: 12.972, lon: 77.59 });
      expect(locationFromTiff(gpsTiff({ little, lat: [33, 52, 4], latRef: 'S', lon: [151, 12, 36], lonRef: 'W' }))).toEqual({ lat: -33.86778, lon: -151.21 });
    }
    expect(locationOf(jpeg(gpsTiff({ lat: [12, 58, 19.2], latRef: 'N', lon: [77, 35, 24], lonRef: 'E' })))).toEqual({ lat: 12.972, lon: 77.59 });
  });

  it('gives none without GPS, for a camera\'s 0,0, a broken ref or rational, or broken bytes', () => {
    expect(locationOf(jpeg(tiff({ original: '2019:12:31 23:59:59' })))).toBeNull();
    expect(locationFromTiff(gpsTiff({ lat: [0, 0, 0], latRef: 'N', lon: [0, 0, 0], lonRef: 'E' }))).toBeNull();
    expect(locationFromTiff(gpsTiff({ lat: [12, 0, 0], latRef: 'X', lon: [77, 0, 0], lonRef: 'E' }))).toBeNull();
    expect(locationFromTiff(gpsTiff({ lat: [12, 0, 0], latRef: 'N', lon: [77, 0, 0], lonRef: 'E', den: 0 }))).toBeNull();
    expect(locationFromTiff(gpsTiff({ lat: [95, 0, 0], latRef: 'N', lon: [77, 0, 0], lonRef: 'E' }))).toBeNull();
    expect(locationOf(gpsTiff({ lat: [12, 0, 0], latRef: 'N', lon: [77, 0, 0], lonRef: 'E' }).subarray(0, 40))).toBeNull();
    expect(locationOf(new Uint8Array(0))).toBeNull();
  });
});

describe('what an upload offers before saving (gallery spec §4, §4.1)', () => {
  it('offers an SVG its two ways, a drawing first up to 200 KB, and never Keep it large', () => {
    expect(uploadOptions({ type: 'image/svg+xml', bytes: 4_000, width: 5000, height: 3000 })).toEqual({ svg: { drawing: true, default: 'drawing' }, large: false });
    expect(uploadOptions({ type: 'image/svg+xml', bytes: SVG_DRAWING_MAX_BYTES + 1, width: 100, height: 100 })).toEqual({ svg: { drawing: false, default: 'picture' }, large: false });
  });
  it('offers Keep it large only to a still raster picture over 2560 px', () => {
    expect(uploadOptions({ type: 'image/jpeg', bytes: 5e6, width: 4000, height: 3000 })).toEqual({ svg: null, large: true });
    expect(uploadOptions({ type: 'image/jpeg', bytes: 5e6, width: 2560, height: 1440 })).toEqual({ svg: null, large: false });
    expect(uploadOptions({ type: 'image/gif', bytes: 5e6, width: 4000, height: 3000 }).large).toBe(false);
    expect(uploadOptions({ type: 'image/png', bytes: 5e6, width: 4000, height: 3000, animated: true }).large).toBe(false);
  });
  it('says what cleaning a drawing took out, or nothing', () => {
    expect(removedNote(undefined)).toBe('');
    expect(removedNote([])).toBe('');
    expect(removedNote(['scripts'])).toBe('Cleaned before saving: took out scripts.');
    expect(removedNote(['scripts', 'event handlers', 'comments'])).toBe('Cleaned before saving: took out scripts, event handlers and comments.');
  });
});
