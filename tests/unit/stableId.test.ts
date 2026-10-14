import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { stableId } from '../../src/site/design/stableId';

describe('stable element IDs (desktop plan stage 10: two builds of one page are the same)', () => {
  it('the same component with the same props on a page gets the same ID in every build', () => {
    const first = stableId({ props: { label: 'Name' }, request: {} }, 'TextField');
    const again = stableId({ props: { label: 'Name' }, request: {} }, 'TextField');
    expect(first).toBe(again);
    expect(first).toMatch(/^[0-9a-z]{6}$/);
  });

  it('differs by kind and by props, and counts repeats on one page', () => {
    const page = {};
    const a = stableId({ props: { label: 'Name' }, request: page }, 'TextField');
    expect(stableId({ props: { label: 'Name' }, request: page }, 'TextField')).toBe(`${a}-2`);
    expect(stableId({ props: { label: 'Name' }, request: page }, 'TextField')).toBe(`${a}-3`);
    expect(stableId({ props: { label: 'Email' }, request: page }, 'TextField')).not.toMatch(new RegExp(`^${a}`));
    expect(stableId({ props: { label: 'Name' }, request: page }, 'Select')).not.toMatch(new RegExp(`^${a}`));
    // a new page starts counting again
    expect(stableId({ props: { label: 'Name' }, request: {} }, 'TextField')).toBe(a);
  });

  it('survives props it cannot write out', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(stableId({ props: loop, request: {} }, 'Tabs')).toMatch(/^[0-9a-z]{6}$/);
  });

  it("no site component makes an ID from a random number", () => {
    const files = execFileSync('git', ['ls-files', 'src/site/components', 'src/site/layouts', 'src/site/content'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.astro'));
    const random = files.filter((f) => /Math\.random\(\)/.test(readFileSync(f, 'utf8')));
    expect(random).toEqual([]);
  });
});
