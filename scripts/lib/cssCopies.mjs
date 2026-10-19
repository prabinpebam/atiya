/**
 * The copied-CSS measures the design-system review takes (documentation/site-ui/design-system-review.md §7), written
 * once for the audit script (scripts/design-system-audit.mjs) and the unit tests that hold them
 * (tests/unit/editorDesignSystem.test.ts). Pure: each takes the files as `{ name, src }`.
 */

/** A component file's styles: what's inside its `<style>` blocks. @param {string} src */
export const stylesOf = (src) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/**
 * Identical declaration blocks (60 or more characters between the braces, a `prop: value` body, not a type's
 * fields) found in 2 or more files, each with the files it's in.
 * @param {{ name: string, src: string }[]} files
 * @returns {{ block: string, files: string[] }[]}
 */
export function copiedBlocks(files) {
  /** @type {Map<string, Set<string>>} */
  const seen = new Map();
  for (const f of files) {
    for (const m of f.src.matchAll(/\{([^{}]{60,})\}/g)) {
      const b = m[1].replace(/\s+/g, ' ').trim();
      if (!/:\s/.test(b) || /^\s*\w+\??:\s*(string|number|boolean)/.test(b)) continue;
      if (!seen.has(b)) seen.set(b, new Set());
      /** @type {Set<string>} */ (seen.get(b)).add(f.name);
    }
  }
  return [...seen.entries()].filter(([, s]) => s.size >= 2).map(([block, s]) => ({ block, files: [...s] }));
}

/**
 * Class names defined in the styles of `min` or more files (3 by default), each with the files that define it.
 * @param {{ name: string, src: string }[]} files
 * @param {number} [min]
 * @returns {{ name: string, files: string[] }[]}
 */
export function sharedClassNames(files, min = 3) {
  /** @type {Map<string, string[]>} */
  const by = new Map();
  for (const f of files) {
    for (const c of new Set([...stylesOf(f.src).matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]))) {
      if (!by.has(c)) by.set(c, []);
      /** @type {string[]} */ (by.get(c)).push(f.name);
    }
  }
  return [...by.entries()].filter(([, fs]) => fs.length >= min).map(([name, fs]) => ({ name, files: fs }));
}
