/**
 * The upload form's rules (src/site/editor/model/upload.ts; documentation/editor/spec.md §6): what the
 * server reads as it is, what the browser converts first, what a paste holds, a pasted picture's name and
 * the preview's line.
 */
import { describe, expect, it } from 'vitest';
import { describePicture, formatLabel, mayHaveAlpha, needsConversion, pastedName, pictureOfPaste, pngName, typeOf } from '../../src/site/editor/model/upload';

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
  });
});
