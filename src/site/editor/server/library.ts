/**
 * Edit mode's parts library (documentation/editor/spec.md §10): its parts and kit pieces, as the dev-only
 * screen at /_edit/library/ shows them, read from their sources as the design library reads the website's
 * components (src/site/library/registry.ts): the doc comment's summary, accessibility notes and keys, the props
 * from `interface Props`, and the story in src/site/editor/stories/. Node only; nothing is kept by hand.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { docComment, frontmatter, propsOf, slugOf, type PropDoc } from '../../library/registry';
import { smart } from '../../design/typography';

/** Where a piece is: a part (src/site/editor/components) or a kit piece (src/site/editor/kit). */
export type PartTier = 'part' | 'kit';

export interface PartEntry {
  tier: PartTier;
  name: string;
  slug: string;
  /** Repository-relative path. */
  file: string;
  summary: string;
  a11y: string[];
  keys: { keys: string; action: string }[];
  props: PropDoc[];
  /** Its story's source, or null when it has none. */
  story: string | null;
}

export const PART_TIERS: { tier: PartTier; dir: string; title: string; blurb: string }[] = [
  { tier: 'kit', dir: 'src/site/editor/kit', title: 'Kit', blurb: 'The pieces several parts are made of: fundamentals, compounds and tier 0, never a part.' },
  { tier: 'part', dir: 'src/site/editor/components', title: 'Parts', blurb: "Edit mode's screens are composed of these: each made of the kit, the website's components and tier 0." },
];

const ROOT = process.cwd();
const STORIES = 'src/site/editor/stories';

/** Every part and kit piece, the kit first, then by name. Read afresh each time (it's a dev screen). */
export function partCatalog(): PartEntry[] {
  const out: PartEntry[] = [];
  for (const t of PART_TIERS) {
    const dir = join(ROOT, t.dir);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.astro')).sort()) {
      const name = f.replace(/\.astro$/, '');
      const fm = frontmatter(readFileSync(join(dir, f), 'utf8'));
      const doc = docComment(fm);
      const story = join(ROOT, STORIES, `${name}.stories.astro`);
      out.push({
        tier: t.tier,
        name,
        slug: slugOf(name),
        file: `${t.dir}/${f}`,
        summary: smart(doc.summary),
        a11y: doc.a11y.map(smart),
        keys: doc.keys.map((k) => ({ keys: k.keys, action: smart(k.action) })),
        props: propsOf(fm).props.map((p) => ({ ...p, description: smart(p.description) })),
        story: existsSync(story) ? readFileSync(story, 'utf8') : null,
      });
    }
  }
  return out;
}

export const findPart = (slug: string) => partCatalog().find((e) => e.slug === slug);
