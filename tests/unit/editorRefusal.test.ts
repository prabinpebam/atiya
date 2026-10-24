/**
 * A refused change in words (game and site copy rule: an error says what happened and how to fix it): one
 * rule, `refusal` in model/feedback.ts, reached by every editor script through `refused` in scripts/client.ts.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeIssue, refusal } from '../../src/site/editor/model/feedback';

describe('a refused change in words', () => {
  it("says the server's words when it gave any", () => {
    expect(refusal([{ path: 'title', message: 'Give it a title.' }], 'The album wasn’t saved.')).toBe('title: Give it a title.');
    expect(refusal([{ message: 'One.' }, { message: 'Two.' }], 'x', { sep: '; ' })).toBe('One.; Two.');
  });

  it('else says what happened and how to put it right', () => {
    expect(refusal(undefined, 'The album wasn’t saved.')).toBe('The album wasn’t saved. Try again.');
    expect(refusal([], 'That video wasn’t added. Check the address and try again.')).toBe('That video wasn’t added. Check the address and try again.');
  });

  it('leads with what happened when asked', () => {
    expect(refusal([{ path: 'slug', message: 'already used' }], 'It wasn’t changed.', { lead: true })).toBe('It wasn’t changed: slug: already used');
    expect(refusal(undefined, 'It wasn’t changed.', { lead: true })).toBe('It wasn’t changed. Try again.');
  });

  it('describes one issue with its place', () => {
    expect(describeIssue({ path: 'a.b', message: 'm' })).toBe('a.b: m');
    expect(describeIssue({ message: 'm' })).toBe('m');
  });

  it('no editor script joins the issues itself', () => {
    const root = join(process.cwd(), 'src/site/editor');
    const offenders = ['scripts', 'components', 'kit', 'pages'].flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((f) => /\.(ts|astro)$/.test(f))
        .filter((f) => /\.map\(describeIssue\)/.test(readFileSync(join(root, dir, f), 'utf8')))
        .map((f) => `${dir}/${f}`),
    );
    expect(offenders, 'use refused(reply, what happened) from scripts/client.ts').toEqual([]);
  });
});
