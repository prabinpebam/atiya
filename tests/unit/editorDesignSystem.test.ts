/**
 * Edit mode on the design system (documentation/editor/spec.md §10; design-system-review.md DS2-07, DS2-11 to
 * DS2-14). Its parts (src/site/editor/components), its kit (src/site/editor/kit) and its layout draw every
 * control through the site's fundamentals and compounds, build their shared pieces once (the kit, two website
 * compounds and a recipe stylesheet), stay short enough to change safely, read only the token groups they own or
 * share, and document themselves with a story each, shown on the dev-only parts library. The tier rules
 * themselves (what a part may import, its doc comment) are in siteDesignSystem.test.ts's "edit mode" block; this
 * file holds what the review added.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path';
import { siteTokens, SOURCES } from '../../src/site/design/tokens';
import { docComment, frontmatter, importsOf, propsOf, scriptImports } from '../../src/site/library/registry';
import { copiedBlocks, sharedClassNames } from '../../scripts/lib/cssCopies.mjs';

const ROOT = join(__dirname, '../..');
const EDITOR = join(ROOT, 'src/site/editor');
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');
const read = (f: string) => readFileSync(f, 'utf8');
const astro = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.astro')).map((f) => join(dir, f)) : []);
const nameOf = (f: string) => f.split(sep).pop()!.replace(/\.(astro|ts)$/, '');

const PARTS = astro(join(EDITOR, 'components'));
const KIT = astro(join(EDITOR, 'kit'));
const LAYOUT = join(EDITOR, 'EditorLayout.astro');
const ALL = [...PARTS, ...KIT, LAYOUT];

/** The markup a file writes: what's left without its styles and scripts (a self-closing data script first, so it never swallows the markup after it). */
const markup = (s: string) =>
  s
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script\b[^>]*\/>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');

describe('edit mode: controls only through the fundamentals (DS2-11)', () => {
  // a control no fundamental or compound can draw, with its reason (add one only with the reason it can't be)
  const ALLOWED: Record<string, string> = {
    'src/site/editor/components/MediaDetails.astro: <button class="hit"':
      "the focus point's target: a transparent button laid over the whole picture, where a click sets the point and the arrow keys move it; no fundamental draws an invisible target the size of a picture",
  };

  it('a self-closing data script hides no markup from the check', () => {
    expect(markup('<script is:inline type="application/json" set:html={s} />\n<button>\n<script>x</script>')).toContain('<button>');
  });

  it('found the parts, the kit and the layout', () => {
    expect(PARTS.length).toBeGreaterThanOrEqual(30);
    expect(KIT.length).toBeGreaterThanOrEqual(6);
  });

  it('no part, kit piece or the layout writes a <button>, <input>, <select>, <textarea> or <dialog>: Button, IconButton, RowButton, TileButton, MenuItem, TextField, Checkbox, Radio, RadioCard, Switch, Select, ColorField, FileField, HiddenField, Slider, Dialog and the rest do', () => {
    const raw = ALL.flatMap((f) =>
      [...markup(read(f)).matchAll(/<(button|input|select|textarea|dialog)\b[^>]*>/g)]
        .map((m) => `${rel(f)}: ${m[0].slice(0, 80)}`)
        .filter((where) => !Object.keys(ALLOWED).some((k) => where.startsWith(k))),
    );
    expect(raw).toEqual([]);
  });

  it('every allowed exception still exists and says why', () => {
    for (const [where, why] of Object.entries(ALLOWED)) {
      expect(why.length, where).toBeGreaterThan(20);
      expect(existsSync(join(ROOT, where.split(':')[0])), where).toBe(true);
    }
  });
});

describe('edit mode: parts short enough to change safely (DS2-07)', () => {
  it('markup and script at most 350 lines (logic beyond wiring lives in model/ or scripts/, and a big part is split into parts the page composes), the whole file at most 650', () => {
    const lines = (s: string) => s.split('\n').length;
    const long = ALL.map((f) => {
      const src = read(f);
      const total = lines(src);
      const rest = total - [...src.matchAll(/<style[\s\S]*?<\/style>/g)].reduce((n, m) => n + lines(m[0]), 0);
      return { f, total, rest };
    })
      .filter((x) => x.rest > 350 || x.total > 650)
      .map((x) => `${rel(x.f)}: ${x.total} lines, ${x.rest} without its styles`);
    expect(long).toEqual([]);
  });
});

describe("edit mode: the kit, the pieces several parts are made of (src/site/editor/kit)", () => {
  const specs = (src: string) => [...importsOf(frontmatter(src)).map((x) => x.spec), ...scriptImports(src)];

  it.each(KIT.map((f) => [nameOf(f), f] as const))('kit %s uses fundamentals, compounds, tier 0 and the editor model only (never a part or another kit piece)', (_, f) => {
    const ok = (i: string) =>
      /^\.\.\/\.\.\/components\/(fundamentals|compounds)\/[A-Z]\w*\.astro$/.test(i) || /^\.\.\/\.\.\/(design|scripts|styles)\/[\w./-]+$/.test(i) || /^\.\.\/model\/[\w-]+$/.test(i);
    expect(specs(read(f)).filter((i) => !ok(i))).toEqual([]);
  });

  it.each(KIT.map((f) => [nameOf(f), f] as const))('kit %s documents itself (a summary, @tier kit, @a11y, a comment on every prop)', (_, f) => {
    const fm = frontmatter(read(f));
    const doc = docComment(fm);
    expect(doc.summary.length).toBeGreaterThan(40);
    expect(doc.tier).toBe('kit');
    expect(doc.a11y.length).toBeGreaterThan(0);
    expect(propsOf(fm).props.filter((p) => p.name !== 'data-*' && !p.description).map((p) => p.name)).toEqual([]);
  });

  it('only parts use the kit: never a page, the layout, a script or anything outside edit mode', () => {
    const users = [...astro(join(EDITOR, 'pages')), LAYOUT, ...readdirSync(join(EDITOR, 'scripts')).map((f) => join(EDITOR, 'scripts', f))].filter((f) => /\/kit\//.test(read(f)));
    expect(users.map(rel)).toEqual([]);
  });
});

describe("edit mode: its tokens owned by the parts that read them (DS2-14)", () => {
  type Group = { $extensions?: Record<string, unknown> } & Record<string, unknown>;
  const C = SOURCES['tokens.json'].c as Record<string, Group>;
  const editorGroups = Object.keys(C).filter((g) => g === 'editor' || g.startsWith('editor-'));
  const ownerOf = (g: string) => C[g].$extensions?.['site.owner'] as string | undefined;
  const partNames = new Set([...PARTS, LAYOUT].map(nameOf));
  const model = siteTokens();
  const editorTokens = model.tokens.filter((t) => t.path[0] === 'c' && (t.path[1] === 'editor' || t.path[1].startsWith('editor-')));

  it('one shared group (c.editor) for what several parts or scripts read; every other editor group is owned by the one part that reads it', () => {
    expect(editorGroups.filter((g) => ownerOf(g) === 'shared')).toEqual(['editor']);
    expect(editorGroups.length).toBeGreaterThan(1);
    expect(editorGroups.filter((g) => g !== 'editor' && !partNames.has(ownerOf(g) ?? '')).map((g) => `${g}: ${ownerOf(g)}`)).toEqual([]);
    // and a part owns only edit mode's groups
    expect(Object.keys(C).filter((g) => !editorGroups.includes(g) && partNames.has(ownerOf(g) ?? ''))).toEqual([]);
  });

  it('a part reads only the shared group and its own; a script (it owns nothing) reads only the shared group', () => {
    const groupOf = (name: string) => editorGroups.filter((g) => name === g || name.startsWith(`${g}-`)).sort((a, b) => b.length - a.length)[0];
    const readers = [...ALL, ...readdirSync(join(EDITOR, 'scripts')).map((f) => join(EDITOR, 'scripts', f)), ...readdirSync(join(EDITOR, 'model')).map((f) => join(EDITOR, 'model', f))];
    const bad: string[] = [];
    for (const f of readers) {
      for (const m of read(f).matchAll(/--c-(editor[\w-]*)/g)) {
        const g = groupOf(m[1]);
        if (!g) {
          bad.push(`${rel(f)} reads --c-${m[1]}, which no editor group defines`);
          continue;
        }
        const o = ownerOf(g);
        if (o !== 'shared' && o !== nameOf(f)) bad.push(`${rel(f)} reads --c-${m[1]} (${g} is ${o}'s)`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("every editor token is written to editor-tokens.css alone, named --c-editor-… (the production check's sentinel), never to the site's tokens.css", () => {
    const site = read(join(ROOT, 'src/site/styles/tokens.css'));
    const editor = read(join(ROOT, 'src/site/styles/editor-tokens.css'));
    expect(editorTokens.length).toBeGreaterThanOrEqual(25);
    for (const t of editorTokens) {
      expect(t.name, t.path.join('.')).toMatch(/^--c-editor-/);
      expect(editor.includes(`${t.name}:`), t.name).toBe(true);
    }
    expect(site).not.toMatch(/--c-editor/);
  });

  it('only edit mode imports editor-tokens.css', () => {
    const importers = [...astro(join(ROOT, 'src/site/layouts')), ...astro(join(ROOT, 'src/site/components/fundamentals')), ...astro(join(ROOT, 'src/site/components/compounds')), ...astro(join(ROOT, 'src/pages'))].filter((f) => /editor-tokens\.css/.test(read(f)));
    expect(importers.map(rel)).toEqual([]);
  });
});

describe("edit mode: its shared pieces built once (DS2-12)", () => {
  const sources = [...PARTS, ...KIT].map((f) => ({ name: nameOf(f), src: read(f) }));
  // the pieces the review found rebuilt part by part, and the old classes of the pieces that replaced them
  const VOCABULARY = ['issue', 'actions', 'split', 'form', 'row', 'list', 'card', 'grip', 'rich', 'items', 'checking', 'drafts'];

  it('the helper finds what it should (fixtures)', () => {
    const block = '{\n    color: var(--color-text-muted);\n    font: var(--type-hint);\n  }';
    expect(copiedBlocks([{ name: 'A', src: `<style>.a ${block}</style>` }, { name: 'B', src: `<style>.b ${block}</style>` }, { name: 'C', src: '<style>.c { color: red }</style>' }])).toHaveLength(1);
    const three = ['A', 'B', 'C'].map((name) => ({ name, src: '<style>.row { display: flex }</style>' }));
    expect(sharedClassNames(three).map((c) => c.name)).toEqual(['row']);
    expect(sharedClassNames(three.slice(0, 2))).toEqual([]);
  });

  it('no vocabulary class is defined in the styles of 3 or more parts and kit pieces: the issue note, the action bar, the list-and-details layout, the form, its rows and lists are components (IssueNote, ActionBar, SplitView, Form, PlainList, ListLink…)', () => {
    const rebuilt = sharedClassNames(sources).filter((c) => VOCABULARY.includes(c.name));
    expect(rebuilt.map((c) => `.${c.name}: ${c.files.join(', ')}`)).toEqual([]);
  });

  it("fewer than 10 identical declaration blocks (60 characters or more, a `prop: value` body) are copied between edit mode's parts and kit (62 on 19 October 2026)", () => {
    const copies = copiedBlocks(sources);
    expect(copies.length, copies.map((c) => `${c.files.join(', ')}: ${c.block.slice(0, 100)}`).join('\n')).toBeLessThan(10);
  });

  it('the shared pieces are where the decision put them (review §9): the list-and-details layout and the action bar are website compounds, with their stories; the rest are the kit', () => {
    for (const name of ['SplitView', 'ActionBar']) {
      expect(existsSync(join(ROOT, 'src/site/components/compounds', `${name}.astro`)), name).toBe(true);
      expect(existsSync(join(ROOT, 'src/site/stories', `${name}.stories.astro`)), `${name}'s story`).toBe(true);
    }
    for (const name of ['IssueNote', 'Form', 'FormFoot', 'Panel', 'PanelGrid', 'ListPane', 'ListLink', 'PlainList', 'Grip', 'RichField', 'ChoiceTiles', 'StatusNote', 'Fieldset']) expect(KIT.map(nameOf), name).toContain(name);
    // the Access, Recommendations and Sections screens lay out their list and details with SplitView
    for (const name of ['AccessManager', 'RecommendationsManager', 'SectionManager']) expect(read(join(EDITOR, 'components', `${name}.astro`)), name).toMatch(/<SplitView\b/);
  });

  it("a script finds a shared piece by a data attribute, never by a class the piece doesn't draw", () => {
    const scripts = readdirSync(join(EDITOR, 'scripts')).map((f) => join(EDITOR, 'scripts', f));
    const bad = scripts.flatMap((f) => [...read(f).matchAll(/['"`](?:[^'"`\n]*[\s>,])?\.(issue|actions|split|form|section-name|card|grip)\b[^'"`\n]*['"`]/g)].map((m) => `${rel(f)}: ${m[0]}`));
    expect(bad).toEqual([]);
  });
});

describe("edit mode: its recipes written once (editor-recipes.css)", () => {
  const RECIPES = read(join(ROOT, 'src/site/styles/editor-recipes.css'));
  const TOKENS = read(join(ROOT, 'src/site/styles/tokens.css'));

  it('holds the busy line, the drop line and a rich field\'s paragraphs, keyed by data attributes; no part writes them again', () => {
    for (const key of ['[data-busy-line]', "[data-drop-line='flush']", "[data-drop-line='close']", "[data-drop-line='spaced']", '[data-rich-input] > *']) expect(RECIPES, key).toContain(key);
    const own = [...PARTS, ...KIT].filter((f) => /region-busy|\[data-drop='before'\]::before|:global\(\* \+ \*\)/.test(read(f))).map(rel);
    expect(own).toEqual([]);
  });

  it('reads tokens only: no raw length, colour or time, and every custom property it reads exists', () => {
    const values = [...RECIPES.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1].replace(/var\(--[\w-]+\)/g, ''));
    // what's left: keywords, 0, percentages of a gradient's stops, and the factors a calc() turns a token by (-1, /-2)
    expect(values.filter((v) => /\d+(\.\d+)?(px|rem|em|ms|s)\b|#[0-9a-f]{3,8}\b|rgb|hsl/i.test(v))).toEqual([]);
    for (const m of RECIPES.matchAll(/var\((--[\w-]+)\)/g)) expect(TOKENS.includes(`${m[1]}:`), m[1]).toBe(true);
  });

  it('only edit mode imports it (its layout), like editor-tokens.css', () => {
    const importers = [...astro(join(ROOT, 'src/site/layouts')), ...astro(join(ROOT, 'src/site/components/fundamentals')), ...astro(join(ROOT, 'src/site/components/compounds')), ...astro(join(ROOT, 'src/pages'))].filter((f) => /editor-recipes\.css/.test(read(f)));
    expect(importers.map(rel)).toEqual([]);
    expect(read(LAYOUT)).toMatch(/import '\.\.\/styles\/editor-recipes\.css';/);
  });
});
describe('edit mode: its parts and kit documented like components (DS2-13)', () => {
  const STORIES = join(EDITOR, 'stories');
  const PIECES = [...PARTS.map((f) => ({ f, tier: 'editor' })), ...KIT.map((f) => ({ f, tier: 'kit' }))];
  const storyOf = (name: string) => {
    const p = join(STORIES, `${name}.stories.astro`);
    return existsSync(p) ? read(p) : '';
  };

  it.each(PIECES.map((p) => [`${p.tier} ${nameOf(p.f)}`, p] as const))('%s: a summary, its tier, @a11y, a comment on every prop, @key for its keys, and a story of examples', (_, p) => {
    const src = read(p.f);
    const fm = frontmatter(src);
    const doc = docComment(fm);
    expect(doc.summary.length, 'a summary').toBeGreaterThan(40);
    expect(doc.tier, '@tier').toBe(p.tier);
    expect(doc.a11y.length, '@a11y notes').toBeGreaterThan(0);
    expect(propsOf(fm).props.filter((x) => x.name !== 'data-*' && !x.description).map((x) => x.name), 'every prop has a JSDoc comment').toEqual([]);
    if (/addEventListener\(\s*'keydown'/.test(src)) expect(doc.keys.length, '@key lines').toBeGreaterThan(0);
    expect(storyOf(nameOf(p.f)), 'a story in src/site/editor/stories/').toMatch(/<Example\b[^>]*title="/);
  });

  it('no story without a part or kit piece (samples.ts holds their sample data)', () => {
    const names = new Set(PIECES.map((p) => nameOf(p.f)));
    const files = readdirSync(STORIES);
    expect(files.filter((f) => f.endsWith('.stories.astro')).map((f) => f.replace('.stories.astro', '')).filter((n) => !names.has(n))).toEqual([]);
    expect(files.filter((f) => !f.endsWith('.stories.astro') && f !== 'samples.ts')).toEqual([]);
  });

  it("every story shows each choice a prop offers: every value of a union prop (the website's rule)", () => {
    const shows = (s: string, v: string) => s.includes(`'${v}'`) || s.includes(`"${v}"`);
    // HTML semantics, not a look: the element (as), a button's or field's type, and ARIA states scripts set
    const SEMANTIC = /^(as|type|aria-[\w-]+)$/;
    const missing: string[] = [];
    for (const { f } of PIECES) {
      const own = storyOf(nameOf(f));
      for (const prop of propsOf(frontmatter(read(f))).props) {
        const type = prop.type.replace(/\s+/g, ' ').trim();
        if (SEMANTIC.test(prop.name) || !/^('[^']*' \| )+'[^']*'$/.test(type)) continue;
        const def = prop.default?.replace(/^['"]|['"]$/g, '');
        const elsewhere = /\bshown in ([A-Z]\w+)/.exec(prop.description ?? '')?.[1];
        const s = elsewhere ? storyOf(elsewhere) : own;
        for (const v of [...type.matchAll(/'([^']*)'/g)].map((m) => m[1])) if (v !== def && !shows(s, v)) missing.push(`${nameOf(f)}: ${prop.name}="${v}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the stories use sample data only: the parts, the kit, the samples and the design system, never the content or the server that reads it', () => {
    const ok = (i: string) =>
      /^\.\.\/(components|kit)\/[A-Z]\w*\.astro$/.test(i) ||
      i === './samples' ||
      i === '../../library/Example.astro' ||
      /^\.\.\/\.\.\/components\/(fundamentals|compounds)\/[A-Z]\w*\.astro$/.test(i) ||
      /^\.\.\/\.\.\/(design|theme)\/[\w./-]+$/.test(i) ||
      /^\.\.\/model\/[\w-]+$/.test(i);
    // a type may come from anywhere (the samples are typed as the content is); a value only from these
    const files = readdirSync(STORIES).map((f) => join(STORIES, f));
    const bad = files.flatMap((f) => [...read(f).matchAll(/^import\s+(?!type\b)(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]).filter((i) => !ok(i)).map((i) => `${rel(f)}: ${i}`));
    expect(bad).toEqual([]);
  });

  it("nothing outside edit mode imports a story or the samples, and only the parts library's page imports the stories: dev-only routes, so they never reach a build", () => {
    const walkAll = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walkAll(join(dir, f)) : /\.(astro|ts|tsx|mjs|js)$/.test(f) ? [join(dir, f)] : [])) : []);
    const sources = [...walkAll(join(ROOT, 'src')), ...walkAll(join(ROOT, 'integrations')), ...walkAll(join(ROOT, 'scripts'))].filter((f) => !f.startsWith(STORIES + sep));
    // what a file imports (statically, dynamically or through import.meta.glob), resolved to where it points
    const specs = (f: string) => [...read(f).matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|import\.meta\.glob[\s\S]*?)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => resolvePath(dirname(f), m[1]));
    const importers = sources.filter((f) => specs(f).some((t) => t.startsWith(STORIES + sep) || t === STORIES)).map(rel);
    expect(importers).toEqual(['src/site/editor/pages/libraryPart.astro']);
    // the library's routes are edit mode's own, injected in dev alone (integrations/editor.mjs), never on a managed site's
    const integration = read(join(ROOT, 'integrations/editor.mjs'));
    expect(integration).toMatch(/\['\/_edit\/library', 'library\.astro'\]/);
    expect(integration).toMatch(/\['\/_edit\/library\/\[slug\]', 'libraryPart\.astro'\]/);
    expect(integration).toMatch(/features\.managed && \(pattern === '\/_edit\/tests' \|\| pattern\.startsWith\('\/_edit\/library'\)\)/);
  });

  it('the parts library lists every part and kit piece with its story (server/library.ts)', async () => {
    const { partCatalog } = await import('../../src/site/editor/server/library');
    const entries = partCatalog();
    expect(entries.map((e) => e.name).sort()).toEqual(PIECES.map((p) => nameOf(p.f)).sort());
    expect(entries.filter((e) => !e.story).map((e) => e.name)).toEqual([]);
    expect(entries.find((e) => e.name === 'ListLink')).toMatchObject({ tier: 'kit', slug: 'list-link', file: 'src/site/editor/kit/ListLink.astro' });
  });
});