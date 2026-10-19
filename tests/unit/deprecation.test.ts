/**
 * The deprecation rule for component props (documentation/site-ui/design-system-review.md DS2-10; rule:
 * documentation/site-ui/design-system.md §4). A prop marked with the JSDoc `@deprecated <what to use
 * instead>` tag in a component's `interface Props` keeps working for one release, the design library's
 * props table marks it, and no page or component passes it. Tokens follow the same rule
 * (tokenChangelog.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { frontmatter, importsOf, propsOf } from '../../src/site/library/registry';

const ROOT = join(__dirname, '../..');
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith('.astro') ? [p] : [];
  });
}

/** The website's components: fundamentals, compounds, layouts and edit mode's parts. */
const COMPONENT_DIRS = ['src/site/components', 'src/site/layouts', 'src/site/editor/components'];

type Deprecated = { file: string; component: string; prop: string; note: string };

/** A component's deprecated props, from its `interface Props` (through the library's own parser). */
function deprecatedProps(file: string, source: string): Deprecated[] {
  const component = file.split(/[\\/]/).pop()!.replace(/\.astro$/, '');
  return propsOf(frontmatter(source))
    .props.filter((p) => p.deprecated !== undefined)
    .map((p) => ({ file, component, prop: p.name, note: p.deprecated! }));
}

/**
 * The attribute names of every `<Name …>` opening tag in a source, read at the tag's top level: what's
 * inside `{…}` and quotes isn't an attribute.
 */
function attributesOf(src: string, name: string): string[][] {
  const out: string[][] = [];
  const open = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  for (const m of src.matchAll(open)) {
    let depth = 0;
    let quote = '';
    let top = '';
    for (let i = m.index! + m[0].length; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = '';
        continue;
      }
      if (c === '"' || c === "'" || (c === '`' && depth > 0)) {
        quote = c;
        if (depth === 0) top += ' ';
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && c === '>') break;
      else if (depth === 0) top += c;
    }
    out.push([...top.matchAll(/(?:^|\s)([\w:@.-]+)(?==|\s|\/|$)/g)].map((x) => x[1]));
  }
  return out;
}

/** The local names a source imports a component file under (`import Foo from './Foo.astro'`). */
function localNames(file: string, source: string, component: string): string[] {
  const fm = frontmatter(source);
  const specs = importsOf(fm)
    .filter((i) => i.component === component.split(/[\\/]/).pop()!.replace(/\.astro$/, ''))
    .filter((i) => !i.spec.startsWith('.') || resolve(dirname(file), i.spec) === resolve(component))
    .map((i) => i.spec);
  return specs.flatMap((s) => [...fm.matchAll(new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'))].map((m) => m[1]));
}

/** Where a source passes a deprecated prop: `[{ file, component, prop }]`. */
function deprecatedPasses(files: { file: string; source: string }[], deprecated: Deprecated[]) {
  const out: { file: string; component: string; prop: string }[] = [];
  for (const f of files) {
    for (const d of deprecated) {
      for (const local of localNames(f.file, f.source, d.file)) {
        for (const attrs of attributesOf(f.source, local)) if (attrs.includes(d.prop)) out.push({ file: rel(f.file), component: d.component, prop: d.prop });
      }
    }
  }
  return out;
}

describe('deprecated props (JSDoc @deprecated): marked, never passed', () => {
  const components = COMPONENT_DIRS.flatMap((d) => walk(join(ROOT, d))).map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  const deprecated = components.flatMap((c) => deprecatedProps(c.file, c.source));

  it('the library reads a prop’s @deprecated note (fixture)', () => {
    const fm = `interface Props {\n  /** How it looks. */\n  tone?: 'quiet' | 'loud';\n  /**\n   * How it looked.\n   * @deprecated Use tone: variant became tone.\n   */\n  variant?: string;\n}\nconst { tone = 'quiet', variant } = Astro.props;`;
    const props = propsOf(fm).props;
    expect(props.find((p) => p.name === 'variant')).toMatchObject({ description: 'How it looked.', deprecated: 'Use tone: variant became tone.' });
    expect(props.find((p) => p.name === 'tone')?.deprecated).toBeUndefined();
    expect(propsOf('interface Props {\n  /** @deprecated */\n  old?: string;\n}').props[0].deprecated).toBe('');
  });

  it('finds a page passing a deprecated prop, and only that (fixture)', () => {
    const button = join(ROOT, 'src/site/components/fundamentals/FixtureButton.astro');
    const dep: Deprecated[] = [{ file: button, component: 'FixtureButton', prop: 'variant', note: 'Use tone' }];
    const page = (body: string) => ({ file: join(ROOT, 'src/pages/fixture.astro'), source: `---\nimport Button from '../site/components/fundamentals/FixtureButton.astro';\n---\n${body}` });
    expect(deprecatedPasses([page('<Button variant="quiet">Go</Button>')], dep)).toEqual([{ file: 'src/pages/fixture.astro', component: 'FixtureButton', prop: 'variant' }]);
    expect(deprecatedPasses([page('<Button\n  tone="loud"\n  variant={v}\n/>')], dep)).toHaveLength(1);
    expect(deprecatedPasses([page('<Button variant />')], dep)).toHaveLength(1);
    for (const fine of ['<Button tone="loud" label="variant">Go</Button>', '<Button data={{ variant: 1 }} tone={x > 1 ? "a" : "b"}>variant=</Button>', '<ButtonGroup variant="x" />', '<Button tone={`variant=${a}`} />']) {
      expect(deprecatedPasses([page(fine)], dep), fine).toEqual([]);
    }
    // another file's component of the same name isn't this one
    const other = { file: join(ROOT, 'src/pages/other.astro'), source: `---\nimport Button from './FixtureButton.astro';\n---\n<Button variant="x" />` };
    expect(deprecatedPasses([other], dep)).toEqual([]);
  });

  it('no .astro file in src/ passes a deprecated prop', () => {
    const files = walk(join(ROOT, 'src')).map((file) => ({ file, source: readFileSync(file, 'utf8') }));
    expect(deprecatedPasses(files, deprecated)).toEqual([]);
    // the scan sees real uses: were Tag's tone deprecated, the pages passing it would be found
    const tag = join(ROOT, 'src/site/components/fundamentals/Tag.astro');
    const found = deprecatedPasses(files, [{ file: tag, component: 'Tag', prop: 'tone', note: 'Use kind' }]).map((x) => x.file);
    expect(found).toEqual(expect.arrayContaining(['src/site/components/compounds/ArticleHeader.astro', 'src/site/editor/components/ArticleTable.astro']));
  });

  it('a deprecated prop says what to use instead', () => {
    expect(deprecated.filter((d) => !d.note).map((d) => `${d.component}.${d.prop}`)).toEqual([]);
  });

  it('the design library’s props table marks a deprecated prop with a Deprecated tag and its note', () => {
    const table = readFileSync(join(ROOT, 'src/site/library/PropsTable.astro'), 'utf8');
    expect(importsOf(frontmatter(table)).map((i) => i.component)).toContain('Tag');
    expect(table).toMatch(/p\.deprecated !== undefined && \([\s\S]*?<Tag tone="negative" size="sm">Deprecated<\/Tag>/);
    expect(table).toMatch(/p\.deprecated && <span class="instead">\{p\.deprecated\}<\/span>/);
  });
});
