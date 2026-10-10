/**
 * The upload form's rules (src/site/editor/model/upload.ts; documentation/editor/spec.md §6): what the
 * server reads as it is, what the browser converts first, what a paste holds, a pasted picture's name and
 * the preview's line.
 */
import { describe, expect, it } from 'vitest';
import { clock, describePicture, describeVideo, formatLabel, isVideoFile, keptAsIs, MAX_GIF_BYTES, MAX_PICTURE_BYTES, MAX_VIDEO_BYTES, mayHaveAlpha, megabytes, needsConversion, pastedName, pictureOfPaste, pictureSizeIssue, pngName, posterTime, typeOf, videoSizeIssue, videoTypeOf } from '../../src/site/editor/model/upload';

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
