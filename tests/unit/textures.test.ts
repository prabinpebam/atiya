import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTURES } from '../../src/game/world/textureManifest';

const ROOT = resolve(__dirname, '../..');

function webpSize(buf: Buffer): { w: number; h: number; alpha: boolean } {
  // RIFF....WEBP then VP8X (extended, alpha flag), VP8L (lossless) or VP8 (lossy)
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const w = 1 + buf.readUIntLE(24, 3);
    const h = 1 + buf.readUIntLE(27, 3);
    return { w, h, alpha: (buf[20] & 0x10) !== 0 };
  }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, alpha: ((b >> 28) & 1) === 1 };
  }
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
}

describe('generated textures', () => {
  const entries = Object.entries(TEXTURES) as [string, { url: string; kind: string; bytes: number; mean?: readonly number[] }][];

  it('ships every ground layer, foliage sprite and the moon', () => {
    for (const name of ['grass', 'dirt', 'cobble', 'sand', 'riverbed', 'rock', 'water', 'leaf-broad', 'conifer-atlas', 'leaf-single', 'grass-card', 'moon']) {
      expect(TEXTURES).toHaveProperty(name);
    }
  });

  it('every manifest entry exists in public/ as a square, power-of-two WebP within budget', () => {
    let total = 0;
    for (const [name, e] of entries) {
      const file = resolve(ROOT, 'public', e.url.replace(/^\//, ''));
      expect(existsSync(file), name).toBe(true);
      const buf = readFileSync(file);
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
      const { w, h, alpha } = webpSize(buf);
      expect(w, name).toBe(h);
      expect(Math.log2(w) % 1, `${name} is ${w}px`).toBe(0);
      if (e.kind === 'tint' || e.kind === 'sprite') expect(alpha, `${name} has alpha`).toBe(true);
      expect(statSync(file).size).toBe(e.bytes);
      total += e.bytes;
    }
    // spec §7: initial 3D assets ≤ 2.5 MB in total (character model included)
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('colour tiles export a plausible mean linear colour for palette normalisation', () => {
    for (const [name, e] of entries.filter(([, e]) => e.kind === 'tile')) {
      expect(e.mean, name).toHaveLength(3);
      for (const v of e.mean!) {
        expect(v, name).toBeGreaterThan(0.02);
        expect(v, name).toBeLessThan(1);
      }
    }
  });

  it('keeps provenance: each source has its prompt', () => {
    for (const [name] of entries) {
      expect(existsSync(resolve(ROOT, 'assets-src/textures', `${name}.prompt.txt`)), name).toBe(true);
    }
  });
});
