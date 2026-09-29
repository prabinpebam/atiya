/**
 * The design library's catalogue (docs: documentation/site-ui/design-system.md §6). Build-time only:
 * it reads every component's source and says what the library shows about it: its tier, the doc
 * comment's summary, accessibility notes and keys, its props (from `interface Props`, through the
 * TypeScript compiler), the tokens its styles read, what it uses and what uses it, and its story.
 * Nothing here is hand-kept: add a component and a story, and the library has its page.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { smart } from '../design/typography';

export type Tier = 'fundamental' | 'compound' | 'layout';

export const TIERS: { tier: Tier; dir: string; route: string; title: string; blurb: string }[] = [
  { tier: 'fundamental', dir: 'src/site/components/fundamentals', route: 'fundamentals', title: 'Fundamentals', blurb: 'Built from tokens only: the controls, the type, the media.' },
  { tier: 'compound', dir: 'src/site/components/compounds', route: 'compounds', title: 'Compounds', blurb: "The site's own reusable pieces, built from fundamentals." },
  { tier: 'layout', dir: 'src/site/layouts', route: 'layouts', title: 'Layouts', blurb: 'Whole pages, built from compounds and fundamentals, defined once.' },
];

export interface PropDoc {
  name: string;
  type: string;
  optional: boolean;
  default?: string;
  description: string;
}

export interface TypeDoc {
  name: string;
  props: PropDoc[];
}

export interface Entry {
  tier: Tier;
  name: string;
  slug: string;
  /** Repository-relative path. */
  file: string;
  summary: string;
  a11y: string[];
  keys: { keys: string; action: string }[];
  props: PropDoc[];
  types: TypeDoc[];
  tokens: string[];
  /** Components this one is built from (by name). */
  uses: string[];
  usedBy: string[];
  /** Imports from tier 0 (design data, behaviour, styles). */
  foundations: string[];
  hasScript: boolean;
  story: string | null;
  source: string;
}

const ROOT = process.cwd();

export const slugOf = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function frontmatter(src: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  return m ? m[1] : '';
}

export function styles(src: string): string {
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

/** The doc comment at the top of the frontmatter: summary, @tier, @a11y and @key tags. */
export function docComment(fm: string): { summary: string; tier?: string; a11y: string[]; keys: { keys: string; action: string }[] } {
  const m = /\/\*\*([\s\S]*?)\*\//.exec(fm);
  const out = { summary: '', tier: undefined as string | undefined, a11y: [] as string[], keys: [] as { keys: string; action: string }[] };
  if (!m) return out;
  const lines = m[1].split(/\r?\n/).map((l) => l.replace(/^\s*\*\s?/, ''));
  const blocks: { tag: string; text: string }[] = [{ tag: '', text: '' }];
  for (const l of lines) {
    const t = /^@(\w+)\s*(.*)$/.exec(l.trim());
    if (t) blocks.push({ tag: t[1], text: t[2] });
    else blocks[blocks.length - 1].text += ` ${l.trim()}`;
  }
  for (const b of blocks) {
    const text = b.text.replace(/\s+/g, ' ').trim();
    if (b.tag === '') out.summary = text;
    else if (b.tag === 'tier') out.tier = text;
    else if (b.tag === 'a11y') out.a11y.push(text);
    else if (b.tag === 'key') {
      const i = text.indexOf(':');
      out.keys.push({ keys: text.slice(0, i).trim(), action: text.slice(i + 1).trim() });
    }
  }
  return out;
}

const jsdoc = (node: ts.Node): string =>
  ts
    .getJSDocCommentsAndTags(node)
    .map((d) => (typeof d.comment === 'string' ? d.comment : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

function members(decl: ts.InterfaceDeclaration, defaults: Map<string, string>): PropDoc[] {
  const out: PropDoc[] = [];
  for (const m of decl.members) {
    if (ts.isPropertySignature(m)) {
      const name = m.name.getText().replace(/^['"]|['"]$/g, '');
      out.push({ name, type: m.type ? m.type.getText().replace(/\s+/g, ' ') : 'unknown', optional: !!m.questionToken, default: defaults.get(name), description: jsdoc(m) });
    } else if (ts.isIndexSignatureDeclaration(m)) {
      const key = m.parameters[0]?.type?.getText() ?? '';
      if (key.includes('data-')) out.push({ name: 'data-*', type: 'string', optional: true, description: 'Data attributes pass through to the root element.' });
    }
  }
  return out;
}

/** Props and exported types, from the frontmatter's TypeScript. */
export function propsOf(fm: string): { props: PropDoc[]; types: TypeDoc[] } {
  const sf = ts.createSourceFile('frontmatter.ts', fm, ts.ScriptTarget.Latest, true);
  const defaults = new Map<string, string>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && n.initializer?.getText() === 'Astro.props' && ts.isObjectBindingPattern(n.name)) {
      for (const el of n.name.elements) {
        const key = (el.propertyName ?? el.name).getText().replace(/^['"]|['"]$/g, '');
        if (el.initializer && !el.dotDotDotToken) defaults.set(key, el.initializer.getText());
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  let props: PropDoc[] = [];
  const types: TypeDoc[] = [];
  for (const s of sf.statements) {
    if (!ts.isInterfaceDeclaration(s)) continue;
    if (s.name.text === 'Props') props = members(s, defaults);
    else if (s.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) types.push({ name: s.name.text, props: members(s, new Map()) });
  }
  return { props, types };
}

export function tokensOf(src: string): string[] {
  const css = styles(src) + [...src.matchAll(/style=\{?[`'"]([^`'"]*)/g)].map((m) => m[1]).join('\n');
  return [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))].sort();
}

export interface ImportRef {
  spec: string;
  /** The imported component's name, when it's a component. */
  component?: string;
}

export function importsOf(fm: string): ImportRef[] {
  const out: ImportRef[] = [];
  for (const m of fm.matchAll(/import\s+(?:type\s+)?(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    const c = /\/([A-Z]\w*)\.astro$/.exec(spec);
    out.push({ spec, component: c ? c[1] : undefined });
  }
  return out;
}

export function scriptImports(src: string): string[] {
  return [...src.matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => [...m[1].matchAll(/import\s+[^'"]*['"]([^'"]+)['"]/g)].map((x) => x[1]));
}

/** The examples in a story file: each <Example title="…"> block's source, dedented. */
export function examplesOf(story: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of story.matchAll(/<Example\b([^>]*)>([\s\S]*?)<\/Example>/g)) {
    const title = /\btitle="([^"]+)"/.exec(m[1])?.[1];
    if (!title) continue;
    out[title] = dedent(m[2]);
  }
  return out;
}

export function dedent(s: string): string {
  const lines = s.replace(/^\s*\n/, '').replace(/\n\s*$/, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join('\n');
}

let cache: Entry[] | null = null;

/** Every component and layout, in tier order, then by name. */
export function catalog(): Entry[] {
  // cached for the build; in dev, read afresh so a new component shows up without a restart
  if (cache && import.meta.env?.PROD) return cache;
  const entries: Entry[] = [];
  for (const t of TIERS) {
    const dir = join(ROOT, t.dir);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.astro')).sort()) {
      const name = f.replace(/\.astro$/, '');
      const source = readFileSync(join(dir, f), 'utf8');
      const fm = frontmatter(source);
      const doc = docComment(fm);
      const { props, types } = propsOf(fm);
      const imports = importsOf(fm);
      const storyFile = join(ROOT, 'src/site/stories', `${name}.stories.astro`);
      entries.push({
        tier: t.tier,
        name,
        slug: slugOf(name),
        file: `${t.dir}/${f}`,
        summary: smart(doc.summary),
        a11y: doc.a11y.map(smart),
        keys: doc.keys.map((k) => ({ keys: k.keys, action: smart(k.action) })),
        props: props.map((p) => ({ ...p, description: smart(p.description) })),
        types: types.map((x) => ({ ...x, props: x.props.map((p) => ({ ...p, description: smart(p.description) })) })),
        tokens: tokensOf(source),
        uses: imports.filter((i) => i.component).map((i) => i.component!),
        usedBy: [],
        foundations: [...imports.filter((i) => !i.component).map((i) => i.spec), ...scriptImports(source)],
        hasScript: /<script(?![^>]*is:inline)/.test(source),
        story: existsSync(storyFile) ? readFileSync(storyFile, 'utf8') : null,
        source,
      });
    }
  }
  for (const e of entries) e.usedBy = entries.filter((x) => x.uses.includes(e.name)).map((x) => x.name);
  cache = entries;
  return entries;
}

export const byTier = (tier: Tier) => catalog().filter((e) => e.tier === tier);
export const find = (name: string) => catalog().find((e) => e.name === name);
export const routeOf = (e: Pick<Entry, 'tier' | 'slug'>) => `/design/${TIERS.find((t) => t.tier === e.tier)!.route}/${e.slug}/`;
