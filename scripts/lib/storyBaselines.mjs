// Which story examples have no screenshot baseline, and which baselines no longer have an example: the website's
// stories (tests/e2e/visual.spec.ts, one image per example per mode and width; a layout's story is one page) and edit
// mode's parts (tests/e2e/visual-editor.spec.ts, one per example canvas). Read by the design system audit (DS2-01)
// and tests/unit/storyBaselines.test.ts, so a story can't change without its pictures.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const slug = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const SITE_TIERS = ['src/site/components/fundamentals', 'src/site/components/compounds', 'src/site/layouts'];
const EDITOR_DIRS = ['src/site/editor/kit', 'src/site/editor/components'];

/** The parts the editor's visual spec leaves out on purpose, read from the spec so there's one list. */
function editorSkips(root) {
  const spec = readFileSync(join(root, 'tests/e2e/visual-editor.spec.ts'), 'utf8');
  const m = /const SKIP = new Set\(\[([^\]]*)\]\)/.exec(spec);
  return new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []);
}

/** The example numbers (1-based) that have at least one baseline, for an image name prefix. */
function shotIndexes(files, prefix) {
  const out = new Set();
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const n = Number.parseInt(f.slice(prefix.length), 10);
    if (Number.isInteger(n)) out.add(n);
  }
  return out;
}

const examples = (file) => (readFileSync(file, 'utf8').match(/<Example\b/g) ?? []).length;

/**
 * Every story's gaps: `missing` are examples with no baseline, `stale` baselines past the last example.
 * @param {string} root the repository root
 * @returns {{ story: string, examples: number, missing: number[], stale: number[] }[]} the stories with a gap
 */
export function storyBaselineGaps(root) {
  const shots = join(root, 'tests/e2e/__screenshots__');
  const list = (d) => (existsSync(join(shots, d)) ? readdirSync(join(shots, d)) : []);
  const site = list('visual.spec.ts');
  const editor = list('visual-editor.spec.ts');
  const out = [];
  const check = (story, count, have) => {
    const missing = [];
    for (let i = 1; i <= count; i++) if (!have.has(i)) missing.push(i);
    const stale = [...have].filter((i) => i > count).sort((a, b) => a - b);
    if (missing.length || stale.length) out.push({ story, examples: count, missing, stale });
  };

  for (const f of readdirSync(join(root, 'src/site/stories')).filter((x) => x.endsWith('.stories.astro'))) {
    const name = f.replace('.stories.astro', '');
    const tier = SITE_TIERS.find((d) => existsSync(join(root, d, `${name}.astro`)));
    if (!tier) continue;
    const count = tier.endsWith('layouts') ? 1 : examples(join(root, 'src/site/stories', f));
    check(name, count, shotIndexes(site, `${slug(name)}-`));
  }

  const skip = editorSkips(root);
  for (const dir of EDITOR_DIRS)
    for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith('.astro'))) {
      const name = f.replace('.astro', '');
      const story = join(root, 'src/site/editor/stories', `${name}.stories.astro`);
      if (skip.has(name) || !existsSync(story)) continue;
      check(`editor ${name}`, examples(story), shotIndexes(editor, `editor-${slug(name)}-`));
    }
  return out;
}
