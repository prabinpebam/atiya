/**
 * The token changelogs and the deprecation rule (documentation/site-ui/design-system-review.md DS2-09,
 * DS2-10; rules: documentation/site-ui/design-system.md §2, documentation/game-ui/design-system.md §3).
 * Each token build records what changed against the last built set (token-history.json) and renders a
 * changelog page; `--check` fails when the tokens changed without a build. A `$deprecated` token is still
 * built and marked, and nothing may read it.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { classify, codeNames, compose, deprecatedReads, diff, historyJson, longDate, parseHistory, renderChangelog, snapshotOf, stateOf, update } from '../../scripts/lib/token-changelog.mjs';
import * as game from '../../scripts/build-tokens.mjs';
import * as site from '../../scripts/build-site-tokens.mjs';
import { flatten as siteFlatten } from '../../src/site/design/tokenModel';
import { siteTokens as siteTokensOf } from '../../src/site/design/tokens';

const ROOT = join(__dirname, '../..');
const read = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const name = (path: string) => `--${path.split('.').join('-')}`;
type State = { v: string; d?: string };
type History = { snapshot: Record<string, State>; entries: Array<{ date: string; baseline?: number; changes?: Record<string, [State | null, State | null]> }> };

describe('token changelogs: generated, and current', () => {
  it.each([
    ['the website', 'scripts/build-site-tokens.mjs'],
    ['the game UI', 'scripts/build-tokens.mjs'],
  ])("%s's --check passes (CSS, docs, history and changelog match the tokens)", (_, script) => {
    expect(() => execFileSync(process.execPath, [join(ROOT, script), '--check'], { stdio: 'pipe', cwd: ROOT })).not.toThrow();
  });

  it.each([
    ['site', site, 'documentation/site-ui/token-changelog.md', 'src/site/design/token-history.json'],
    ['game', game, 'documentation/game-ui/token-changelog.md', 'src/design/token-history.json'],
  ] as const)('the %s changelog page exists, is generated, and starts from a baseline', (_, mod, page, history) => {
    expect(existsSync(join(ROOT, page))).toBe(true);
    expect(existsSync(join(ROOT, history))).toBe(true);
    // with the tokens unchanged, the date a build runs on changes nothing
    const built = mod.buildChangelog(undefined, '2099-01-01');
    expect(read(join(ROOT, page))).toBe(built.page);
    expect(read(join(ROOT, history))).toBe(built.history);
    const text = read(join(ROOT, page));
    expect(text.match(/^# /gm)).toHaveLength(1);
    expect(text).toMatch(/^# .+\n\n> \*\*TL;DR\.\*\* /);
    expect(text).toMatch(/^## Baseline, \d{1,2} \w+ \d{4}: \d+ tokens$/m);
    const h = parseHistory(read(join(ROOT, history))) as History;
    expect(h.entries.at(-1)?.baseline).toBeGreaterThan(0);
    expect(h.entries.filter((e) => e.baseline !== undefined)).toHaveLength(1);
  });

  it('the pages are in the docs manifest, beside their tokens page', () => {
    const entries = JSON.parse(read(join(ROOT, 'documentation/docs-manifest.json'))).entries as Array<{ path: string; group: string; order: number; icon?: string }>;
    for (const sys of ['site-ui', 'game-ui']) {
      const tokens = entries.find((e) => e.path === `${sys}/tokens.md`)!;
      const log = entries.find((e) => e.path === `${sys}/token-changelog.md`);
      expect(log, sys).toBeDefined();
      expect(log!.group).toBe(tokens.group);
      expect(Math.abs(log!.order - tokens.order)).toBeLessThan(0.1);
      expect(log!.icon).toBeTruthy();
    }
  });
});

describe('token changelogs: the rules (fixtures)', () => {
  const before = snapshotOf([
    { path: ['space', '1'], value: '0.25rem' },
    { path: ['space', '2'], value: '0.5rem' },
    { path: ['c', 'card', 'thumb-w'], value: '4rem' },
    { path: ['c', 'card', 'gap'], value: 'var(--space-2)' },
    { path: ['c', 'card', 'old'], value: '1px' },
  ]) as Record<string, State>;
  const start = update(null, before, '2026-10-19') as History;

  it('starts with a baseline of the token count', () => {
    expect(start.entries).toEqual([{ date: '2026-10-19', baseline: 5 }]);
    expect(start.snapshot).toBe(before);
  });

  it('unchanged tokens add nothing, whatever the date (and reordering them changes nothing)', () => {
    const same = snapshotOf([...Object.keys(before)].reverse().map((k) => ({ path: k.split('.'), value: before[k].v })));
    expect(update(start, same, '2026-12-01')).toBe(start);
    expect(historyJson(update(start, same, '2026-12-01'))).toBe(historyJson(start));
  });

  it('records added, removed and changed-in-value tokens', () => {
    const after = { ...before, 'space.3': stateOf('0.75rem', undefined), 'space.2': stateOf('0.625rem', undefined) } as Record<string, State>;
    delete after['c.card.old'];
    const h = update(start, after, '2026-10-20') as History;
    expect(h.entries).toHaveLength(2);
    expect(h.entries[0].date).toBe('2026-10-20');
    const c = classify(h.entries[0].changes!, name);
    expect(c.added).toEqual([{ path: 'space.3', value: '0.75rem', note: undefined }]);
    expect(c.removed).toEqual([{ path: 'c.card.old', value: '1px', wasDeprecated: false }]);
    expect(c.changed).toEqual([{ path: 'space.2', from: '0.5rem', to: '0.625rem' }]);
    expect(c.renamed).toEqual([]);
  });

  it('calls a removed and an added token with the same value in the same group a rename, and only then', () => {
    const renamed = { ...before, 'c.card.thumb-width': stateOf('4rem', undefined) } as Record<string, State>;
    delete renamed['c.card.thumb-w'];
    const c = classify(diff(before, renamed), name);
    expect(c.renamed).toEqual([{ from: 'c.card.thumb-w', to: 'c.card.thumb-width', value: '4rem', alias: false }]);
    expect(c.added).toEqual([]);
    expect(c.removed).toEqual([]);
    // same value, another group: a removal and an addition
    const moved = { ...before, 'space.thumb': stateOf('4rem', undefined) } as Record<string, State>;
    delete moved['c.card.thumb-w'];
    const m = classify(diff(before, moved), name);
    expect(m.renamed).toEqual([]);
    expect(m.added.map((a) => a.path)).toEqual(['space.thumb']);
    expect(m.removed.map((r) => r.path)).toEqual(['c.card.thumb-w']);
    // a different value: not a rename
    const other = { ...before, 'c.card.thumb-width': stateOf('5rem', undefined) } as Record<string, State>;
    delete other['c.card.thumb-w'];
    expect(classify(diff(before, other), name).renamed).toEqual([]);
    // two candidates with one value: ambiguous, so not called a rename
    const two = { ...before, 'c.card.a': stateOf('4rem', undefined), 'c.card.b': stateOf('4rem', undefined) } as Record<string, State>;
    delete two['c.card.thumb-w'];
    expect(classify(diff(before, two), name).renamed).toEqual([]);
  });

  it('a rename through the deprecation rule: the old name aliases the new one and is deprecated', () => {
    const after = {
      ...before,
      'c.card.thumb-width': stateOf('4rem', undefined),
      'c.card.thumb-w': stateOf('var(--c-card-thumb-width)', 'Use --c-card-thumb-width'),
    } as Record<string, State>;
    const c = classify(diff(before, after), name);
    expect(c.renamed).toEqual([{ from: 'c.card.thumb-w', to: 'c.card.thumb-width', value: '4rem', alias: true, note: 'Use --c-card-thumb-width' }]);
    expect([c.added, c.changed, c.deprecated]).toEqual([[], [], []]);
    // a release later the alias goes: a removal of a deprecated token
    const later = { ...after } as Record<string, State>;
    delete later['c.card.thumb-w'];
    expect(classify(diff(after, later), name).removed).toEqual([{ path: 'c.card.thumb-w', value: 'var(--c-card-thumb-width)', wasDeprecated: true }]);
  });

  it('records deprecation, and ignores what isn\'t a value (owners and other $extensions)', () => {
    const after = { ...before, 'space.1': stateOf('0.25rem', true) } as Record<string, State>;
    const c = classify(diff(before, after), name);
    expect(c.deprecated).toEqual([{ path: 'space.1', note: '' }]);
    expect(c.changed).toEqual([]);
    expect(classify(diff(after, before), name).undeprecated).toEqual([{ path: 'space.1' }]);
    const tree = (owner: string) => ({ c: { card: { $extensions: { 'game.owner': owner }, gap: { $type: 'dimension', $value: { value: 1, unit: 'rem' }, $extensions: { 'game.owner': owner } } } } });
    const snap = (owner: string) => {
      const m = game.load(tree(owner));
      return snapshotOf(m.tokens.map((t: { path: string[]; deprecated?: string | boolean }) => ({ path: t.path, value: game.cssValue(t, m.byPath), deprecated: t.deprecated })));
    };
    expect(diff(snap('Card'), snap('Dialog'))).toEqual({});
  });

  it('merges a day\'s builds into one entry, and drops a change undone the same day', () => {
    const a = { ...before, 'space.2': stateOf('0.625rem', undefined) } as Record<string, State>;
    const day1 = update(start, a, '2026-10-20') as History;
    const b = { ...a, 'space.2': stateOf('0.75rem', undefined), 'space.3': stateOf('1rem', undefined) } as Record<string, State>;
    const day1b = update(day1, b, '2026-10-20') as History;
    expect(day1b.entries).toHaveLength(2);
    expect(day1b.entries[0].changes).toEqual({ 'space.2': [{ v: '0.5rem' }, { v: '0.75rem' }], 'space.3': [null, { v: '1rem' }] });
    const undone = update(day1b, before, '2026-10-20') as History;
    expect(undone.entries).toEqual(start.entries);
    // the next day gets its own entry; the baseline never absorbs a change
    expect((update(day1, b, '2026-10-21') as History).entries.map((e) => e.date)).toEqual(['2026-10-21', '2026-10-20', '2026-10-19']);
    expect((update(start, a, '2026-10-19') as History).entries).toHaveLength(2);
    expect(compose({ x: [{ v: '1' }, { v: '2' }] }, { x: [{ v: '2' }, { v: '1' }] })).toEqual({});
  });

  it('renders a page: one H1, a TL;DR, what is deprecated now and the entries newest first', () => {
    const after = {
      ...before,
      'c.card.thumb-width': stateOf('4rem', undefined),
      'c.card.thumb-w': stateOf('var(--c-card-thumb-width)', 'Use --c-card-thumb-width'),
    } as Record<string, State>;
    const h = update(start, after, '2026-10-20');
    const page = renderChangelog({ title: 'Fixture changelog', tldr: 'What changed.', about: [], history: h, name });
    expect(page.match(/^# /gm)).toHaveLength(1);
    expect(page).toContain('> **TL;DR.** What changed.');
    expect(page).toContain('| `--c-card-thumb-w` | `var(--c-card-thumb-width)` | Use `--c-card-thumb-width` |');
    expect(page.indexOf('## 20 October 2026')).toBeLessThan(page.indexOf('## Baseline, 19 October 2026: 5 tokens'));
    expect(page).toContain('- `--c-card-thumb-w` → `--c-card-thumb-width` (`4rem`); the old name stays for one release as a deprecated alias');
    expect(longDate('2026-01-05')).toBe('5 January 2026');
    expect(codeNames('Use --a-b or `--c`.')).toBe('Use `--a-b` or `--c`.');
  });
});

// ---------- DS2-10: deprecation ----------

function walk(dir: string, re: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === 'node_modules') return [];
    return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : [];
  });
}
const SRC = /\.(astro|tsx?|css|mjs|js|html)$/;
const GENERATED = /[\\/]src[\\/](site[\\/]styles[\\/](tokens|editor-tokens)\.css|site[\\/]design[\\/]responsive\.ts|styles[\\/]tokens\.css)$/;
const files = (dirs: string[]) =>
  dirs
    .flatMap((d) => walk(join(ROOT, d), SRC))
    .filter((f) => !GENERATED.test(f) && !f.includes(`${sep}apps${sep}desktop${sep}src${sep}ui${sep}site${sep}`))
    .map((f) => ({ file: relative(ROOT, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }));

type Tok = { path: string[]; name: string; value: unknown; deprecated?: boolean | string };
const siteModel = siteTokensOf();
const gameModel = game.load();
const siteTokens = siteModel.tokens as Tok[];
const gameTokens = gameModel.tokens as Tok[];

describe('deprecation (DTCG $deprecated): built, marked, never read', () => {
  it('reads $deprecated from a token or its group, in both systems (false on a token overrides its group)', () => {
    const tree = {
      a: { $value: '1px', $type: 'dimension', $deprecated: 'Use --b' },
      g: { $deprecated: true, x: { $value: '1px', $type: 'dimension' }, y: { $value: '1px', $type: 'dimension', $deprecated: false } },
      b: { $value: '1px', $type: 'dimension' },
    };
    for (const flat of [game.flatten, siteFlatten]) {
      const d = Object.fromEntries((flat(tree as never) as Tok[]).map((t) => [t.path.join('.'), t.deprecated]));
      expect(d).toEqual({ a: 'Use --b', 'g.x': true, 'g.y': undefined, b: undefined });
    }
  });

  it('a deprecated token keeps its custom property and is marked in tokens.md', () => {
    for (const [tokens, css, doc] of [
      [siteTokens, read(join(ROOT, 'src/site/styles/tokens.css')) + read(join(ROOT, 'src/site/styles/editor-tokens.css')), read(join(ROOT, 'documentation/site-ui/tokens.md'))],
      [gameTokens, read(join(ROOT, 'src/styles/tokens.css')), read(join(ROOT, 'documentation/game-ui/tokens.md'))],
    ] as const) {
      for (const t of tokens.filter((x) => x.deprecated !== undefined)) {
        expect(css, t.name).toMatch(new RegExp(`^\\s*${t.name}:`, 'm'));
        expect(doc, t.name).toMatch(new RegExp(`^\\| \`${t.name}\` \\|.*\\*\\*Deprecated\\*\\*`, 'm'));
      }
    }
    expect(game.useOf({ description: 'A gap', deprecated: 'Use --c-x' })).toBe('**Deprecated**: Use `--c-x`. A gap');
    expect(site.useOf({ description: '', deprecated: true })).toBe('**Deprecated**.');
  });

  it('finds a read of a deprecated name, whole names only (fixtures)', () => {
    const src = [
      { file: 'a.css', text: '.x { width: var(--c-card-thumb-w); }' },
      { file: 'b.css', text: '.x { width: var(--c-card-thumb-width); }' },
      { file: 'c.ts', text: "el.style.setProperty('--c-card-thumb-w', '1rem')" },
    ];
    expect(deprecatedReads(['--c-card-thumb-w'], src)).toEqual([
      { file: 'a.css', name: '--c-card-thumb-w' },
      { file: 'c.ts', name: '--c-card-thumb-w' },
    ]);
  });

  it('no source reads a deprecated token (its readers moved to the new name)', () => {
    const dep = (ts: Tok[]) => ts.filter((t) => t.deprecated !== undefined).map((t) => t.name);
    const live = (ts: Tok[]) => new Set(ts.filter((t) => t.deprecated === undefined).map((t) => t.name));
    const [siteDep, gameDep, siteLive, gameLive] = [dep(siteTokens), dep(gameTokens), live(siteTokens), live(gameTokens)];
    const reads = [
      ...deprecatedReads(siteDep, files(['src/site', 'apps/desktop/src/ui'])),
      ...deprecatedReads(gameDep, files(['src/styles', 'src/game'])),
      // pages and layouts may hold either system's names: a name the other system still uses isn't a read
      ...deprecatedReads([...siteDep.filter((n) => !gameLive.has(n)), ...gameDep.filter((n) => !siteLive.has(n))], files(['src/pages', 'src/layouts'])),
    ];
    expect(reads).toEqual([]);
  });

  it('no live token aliases a deprecated one', () => {
    for (const tokens of [siteTokens, gameTokens]) {
      const dep = new Set(tokens.filter((t) => t.deprecated !== undefined).map((t) => t.path.join('.')));
      const bad = tokens.filter((t) => t.deprecated === undefined && [...JSON.stringify(t.value).matchAll(/\{([^}]+)\}/g)].some((m) => dep.has(m[1]))).map((t) => t.name);
      expect(bad).toEqual([]);
    }
  });

  it('a real rename went through the rule end to end: recorded as a rename, the new name built, the old one deprecated or gone', () => {
    const renames: Array<{ from: string; to: string; tokens: Tok[] }> = [];
    for (const [file, tokens] of [
      ['src/site/design/token-history.json', siteTokens],
      ['src/design/token-history.json', gameTokens],
    ] as const) {
      const h = parseHistory(read(join(ROOT, file))) as History;
      for (const e of h.entries) if (e.changes) for (const r of classify(e.changes, name).renamed) if (r.alias) renames.push({ from: r.from, to: r.to, tokens });
    }
    // the first: the game's --c-chopper-thumb-w/-h → --c-chopper-thumb-width/-height (19 October 2026)
    expect(renames.map((r) => r.from)).toContain('c.chopper.thumb-w');
    for (const r of renames) {
      const to = r.tokens.find((t) => t.path.join('.') === r.to);
      const from = r.tokens.find((t) => t.path.join('.') === r.from);
      expect(to, r.to).toBeDefined();
      if (from) {
        expect(from.deprecated, r.from).toBeDefined();
        expect(from.value).toBe(`{${r.to}}`);
      }
    }
  });
});
