// @ts-check
/**
 * The app's own stylesheets parse as intended (plan stage 7A): a selector list cut short by an edit swallows the
 * rule after it, and the browser drops both without a word (the bar's hover states were lost that way once).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const UI = join(import.meta.dirname, '..', 'src', 'ui');
const sheets = readdirSync(UI).filter((f) => f.endsWith('.css'));

describe("the app's stylesheets", () => {
  it.each(sheets)('%s: every rule has a whole selector list, and every at-rule stands on its own', (file) => {
    const root = postcss.parse(readFileSync(join(UI, file), 'utf8'), { from: file });
    /** @type {string[]} */
    const broken = [];
    root.walkRules((r) => {
      const parts = r.selector.split(',').map((s) => s.trim());
      if (r.selector.includes('@') || r.selector.includes('{') || parts.some((p) => !p)) broken.push(`line ${r.source?.start?.line}: ${r.selector.replace(/\s+/g, ' ').slice(0, 80)}`);
      if (!r.nodes.length) broken.push(`line ${r.source?.start?.line}: an empty rule (${r.selector.slice(0, 40)})`);
    });
    expect(broken).toEqual([]);
  });
});
