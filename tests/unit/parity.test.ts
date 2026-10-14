import { describe, expect, it } from 'vitest';
import { buildIdOf, compareBuilds, describe as words, normalise } from '../../scripts/lib/parity.mjs';

const enc = new TextEncoder();
const f = (path: string, text: string) => ({ path, bytes: () => enc.encode(text) });
const page = (build: string, kid: string, body: string, media: string) =>
  `<meta name="site-build" content="${build}"><template data-sealed="main" data-kid="${kid}">${body}</template><img src="/_sealed/${build}/${media}.bin">`;

describe('the parity check (desktop plan stage 10)', () => {
  it('equal builds are the same', () => {
    const a = [f('index.html', '<h1>Hi</h1>'), f('_astro/a.js', 'x')];
    const r = compareBuilds(a, a);
    expect(r).toMatchObject({ ok: true, same: 2, differ: [], onlyInSource: [], onlyInEngine: [] });
  });

  it('finds a changed, a missing and an extra file, by path', () => {
    const r = compareBuilds([f('index.html', 'a'), f('about/index.html', 'x'), f('docs/index.html', 'd')], [f('index.html', 'b'), f('new.js', 'n')]);
    expect(r.ok).toBe(false);
    expect(r.differ).toEqual(['index.html']);
    expect(r.onlyInSource).toEqual(['about/index.html']);
    expect(r.onlyInEngine).toEqual(['new.js']);
    expect(r.allowed).toEqual({ 'docs/': 1 });
  });

  it('allows only docs/ to be missing from the engine build', () => {
    const r = compareBuilds([f('index.html', 'a'), f('docs/a.html', 'd'), f('docs/b.css', 'c')], [f('index.html', 'a')]);
    expect(r).toMatchObject({ ok: true, allowed: { 'docs/': 2 } });
    expect(words(r)).toContain('the same, but for docs/');
  });

  it("normalises only the sealer's random parts: same plaintext length is the same, a different length isn't", () => {
    const one = [f('work/x/index.html', page('B1', 'k1', 'AAAA', 'm1')), f('_sealed/B1/m1.bin', 'xxxx'), f('_access/B1/l1.json', '{}')];
    const two = [f('work/x/index.html', page('B2', 'k2', 'BBBB', 'm2')), f('_sealed/B2/m9.bin', 'yyyy'), f('_access/B2/l7.json', '[]')];
    expect(compareBuilds(one, two).ok).toBe(true);
    const longer = [f('work/x/index.html', page('B2', 'k2', 'BBBBBB', 'm2')), f('_sealed/B2/m9.bin', 'yyyy'), f('_access/B2/l7.json', '[]')];
    expect(compareBuilds(one, longer)).toMatchObject({ ok: false, hiddenDiffer: 1, differ: [] });
    const bigger = [f('work/x/index.html', page('B2', 'k2', 'BBBB', 'm2')), f('_sealed/B2/m9.bin', 'yyyyy'), f('_access/B2/l7.json', '[]')];
    expect(compareBuilds(one, bigger)).toMatchObject({ ok: false, sealed: { same: false } });
    expect(normalise(page('B1', 'k1', 'AAAA', 'm1'), 'B1')).toBe(normalise(page('B2', 'k2', 'ZZZZ', 'm7'), 'B2'));
    expect(buildIdOf(['index.html', '_sealed/B1/m1.bin'])).toBe('B1');
  });

  it("never names a private page or a sealed file, only counts them", () => {
    const secret = 'notes/s3cr3t-t0ken/index.html';
    const r = compareBuilds([f(secret, page('B1', 'k', 'AA', 'm')), f('_sealed/B1/m.bin', 'x')], [f('_sealed/B2/n.bin', 'xy')]);
    const said = words(r);
    expect(r.ok).toBe(false);
    expect(said).not.toContain('s3cr3t');
    expect(said).not.toContain('_sealed');
    expect(said).toContain('1 private pages are in one build only (not named)');
    expect(said).toContain('NOT the same shapes');
  });

  it('compares binary files byte for byte', () => {
    const png = (b: number[]) => ({ path: 'a.webp', bytes: () => new Uint8Array(b) });
    expect(compareBuilds([png([1, 2, 3])], [png([1, 2, 3])]).ok).toBe(true);
    expect(compareBuilds([png([1, 2, 3])], [png([1, 2, 4])]).differ).toEqual(['a.webp']);
  });
});
