import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BEAM_FRAG } from '../../src/game/world/beam';
import { outlineMaterial } from '../../src/game/player/outline';

/** Every .ts/.tsx source under src/game. */
function sources(dir = 'src/game'): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

/** The base (first argument) of each GLSL `pow(` call (JS `Math.pow` excluded). */
function powBases(src: string): string[] {
  const out: string[] = [];
  const re = /(?<![.\w])pow\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 4;
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if ((ch === ',' && depth === 0) || depth < 0) break;
    }
    out.push(src.slice(start, i).trim());
  }
  return out;
}

describe('shaders are NaN-safe', () => {
  // A NaN in the HDR buffer is spread over the whole screen by the bloom's blur (the frame turns
  // black). GPUs return NaN for pow() of a negative base, and with MSAA a varying can be
  // extrapolated just outside its triangle at edge pixels (so a value "known" to be in 0…1 isn't).
  it('clamps the base of every GLSL pow() to be non-negative', () => {
    const unsafe: string[] = [];
    for (const file of sources()) {
      for (const base of powBases(readFileSync(file, 'utf8'))) {
        // (an empty base is a `pow()` mentioned in a comment)
        if (base && !/^(clamp|abs|max|saturate)\(/.test(base)) unsafe.push(`${file}: pow(${base}, …)`);
      }
    }
    expect(unsafe).toEqual([]);
  });

  it('keeps the lighthouse beam and the occlusion outline safe at their edges', () => {
    expect(BEAM_FRAG).toContain('pow(clamp(1.0 - vT, 0.0, 1.0)');
    expect(BEAM_FRAG).toContain('inversesqrt(max(');
    expect(outlineMaterial().fragmentShader).toContain('pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0)');
  });
});
