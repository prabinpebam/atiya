/**
 * The editor's performance work (documentation/engineering/performance-report.md R1, R4, R10; editor spec
 * §2.2, §3.6): one cached git status, region fragments, targeted live updates, the feedback words and the
 * optimistic views' arithmetic.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changes, filesOf, forgetChanges, parseStatusV2, peekChanges } from '../../src/site/editor/server/git';
import { ALWAYS, regionsAsked, regionsHeader, wants } from '../../src/site/editor/model/regions';
import { articleOf, liveRegions, mediaIdOf, pageShows, screenShows } from '../../src/site/editor/model/live';
import { cssTime, elapsedText, taskLine, underWay } from '../../src/site/editor/model/feedback';
import { isStructural, originsOf, renameIndex, renameTree, targetsOf } from '../../src/site/editor/model/optimistic';
import * as ops from '../../src/site/editor/model/ops';
import type { Block } from '../../src/site/content/schema';

describe('git status, read once (R1)', () => {
  it('reads porcelain v2: the branch, its upstream, how far ahead, the head, and every kind of entry', () => {
    const out = [
      '# branch.oid 0123456789abcdef0123456789abcdef01234567',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 aaa bbb content/site.json',
      '1 D. N... 100644 000000 000000 aaa bbb content/articles/gone.json',
      '2 R. N... 100644 100644 100644 aaa bbb R100 content/articles/new name.json',
      'content/articles/old.json',
      '? content/media/shared/new.webp',
      '1 .M SC.. 160000 160000 160000 aaa bbb private-pages',
      '',
    ].join('\0');
    const s = parseStatusV2(out);
    expect(s).toMatchObject({ branch: 'main', upstream: 'origin/main', ahead: 2, head: '0123456789abcdef0123456789abcdef01234567' });
    expect(s.entries.map((e) => e.path)).toEqual(['content/site.json', 'content/articles/gone.json', 'content/articles/new name.json', 'content/media/shared/new.webp', 'private-pages']);
    expect(filesOf(s.entries, 'content', '/content/')).toEqual([
      { key: '/content/site.json', status: 'changed' },
      { key: '/content/articles/gone.json', status: 'deleted' },
      { key: '/content/articles/new name.json', status: 'changed' },
      { key: '/content/media/shared/new.webp', status: 'added' },
    ]);
  });

  it('a detached head has no branch, and no upstream means nothing ahead', () => {
    expect(parseStatusV2(['# branch.oid (initial)', '# branch.head (detached)', ''].join('\0'))).toMatchObject({ branch: null, upstream: null, ahead: 0, head: null });
  });

  describe('the cache', () => {
    let dir: string;
    const saved = { content: process.env.CONTENT_ROOT, priv: process.env.PRIVATE_ROOT };
    const g = globalThis as typeof globalThis & { __siteContent?: { generation: number; writes: Map<string, string> } };
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'git-cache-'));
      mkdirSync(join(dir, 'content'));
      writeFileSync(join(dir, 'content', 'site.json'), '{}');
      git('init', '-q', '-b', 'main');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'add', '.');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'first');
      process.env.CONTENT_ROOT = join(dir, 'content');
      process.env.PRIVATE_ROOT = join(dir, 'none');
      g.__siteContent = { generation: 0, writes: new Map() };
      forgetChanges();
    });
    afterEach(() => {
      delete g.__siteContent;
      forgetChanges();
      process.env.CONTENT_ROOT = saved.content;
      process.env.PRIVATE_ROOT = saved.priv;
      if (saved.content === undefined) delete process.env.CONTENT_ROOT;
      if (saved.priv === undefined) delete process.env.PRIVATE_ROOT;
      rmSync(dir, { recursive: true, force: true });
    });

    it('keeps the answer until the content generation moves, and shares it', async () => {
      const a = await changes();
      expect(a.files).toEqual([]);
      expect(await changes()).toBe(a);
      expect(await peekChanges()).toBe(a);
      writeFileSync(join(dir, 'content', 'site.json'), '{"x":1}');
      g.__siteContent!.generation++;
      expect(await peekChanges()).toBeNull();
      expect((await changes()).files).toEqual([{ key: '/content/site.json', status: 'changed' }]);
    });

    it("asks again when git's own files move (a commit in a terminal), with no change to the content", async () => {
      writeFileSync(join(dir, 'content', 'site.json'), '{"x":1}');
      g.__siteContent!.generation++;
      expect((await changes()).files).toHaveLength(1);
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-am', 'second');
      expect((await changes()).files).toEqual([]);
    });

    it('calls at the same moment share one read; fresh always asks', async () => {
      const [a, b] = await Promise.all([changes(), changes()]);
      expect(a).toBe(b);
      expect(await changes({ fresh: true })).not.toBe(a);
    });
  });
});

describe('region fragments (R4)', () => {
  it('reads the regions asked for; no header is the whole screen', () => {
    expect(regionsAsked(null)).toBeNull();
    expect(regionsAsked('')).toBeNull();
    expect([...regionsAsked('outline, inspector,bad name')!]).toEqual(['outline', 'inspector']);
    expect(wants(null, 'anything')).toBe(true);
    expect(wants(new Set(['outline']), 'inspector', 'outline')).toBe(true);
    expect(wants(new Set(['outline']), 'inspector')).toBe(false);
  });

  it('the counts always come along', () => {
    expect(regionsHeader(['outline']).split(',')).toEqual(['outline', ...ALWAYS]);
    expect(regionsHeader([]).split(',')).toEqual([...ALWAYS]);
  });
});

describe('targeted live updates (R10)', () => {
  it("knows an article's own files", () => {
    expect(articleOf('/content/articles/one.json')).toBe('one');
    expect(articleOf('/private/media/articles/two/pic.webp')).toBe('two');
    expect(articleOf('/content/structures/site.json')).toBeNull();
    expect(mediaIdOf('/content/media/articles/one/pic.json')).toBe('articles/one/pic');
    expect(mediaIdOf('/content/media/shared/pic.dark.webp')).toBe('shared/pic');
  });

  it('a screen is drawn again only where it shows the change', () => {
    expect(screenShows('tests', ['/content/articles/a.json'])).toBe(false);
    expect(screenShows('navigation', ['/content/media/shared/x.json'])).toBe(false);
    expect(screenShows('dashboard', ['/content/media/shared/x.json'])).toBe(true);
    expect(screenShows('access', ['/content/site.json'])).toBe(false);
    expect(screenShows('unknown', ['/content/site.json'])).toBe(true);
    expect(liveRegions('navigation', ['/content/structures/site.json'])).toEqual(['screen']);
    expect(liveRegions('media', ['/content/media/shared/x.json'], 'shared/y')).toEqual(['media-grid']);
    expect(liveRegions('media', ['/content/media/shared/x.json'], 'shared/x')).toEqual(['media-grid', 'media-details']);
    expect(liveRegions('media', ['/content/articles/a.json'])).toEqual(['screen']);
    expect(liveRegions('settings', [])).toEqual(['screen']);
  });

  it("a site page reloads unless every change is another article's own", () => {
    expect(pageShows(['a'], ['/content/articles/b.json', '/content/media/articles/b/p.webp'])).toBe(false);
    expect(pageShows(['a', 'b'], ['/content/articles/b.json'])).toBe(true);
    expect(pageShows(['a'], ['/content/structures/site.json'])).toBe(true);
    expect(pageShows(null, ['/content/articles/b.json'])).toBe(true);
  });
});

describe('never a silent wait: the words (spec §2.2)', () => {
  it('says what it does, how long past 3 s, and how many', () => {
    expect(taskLine([], 0)).toBe('');
    expect(taskLine([{ label: 'Updating the canvas…', started: 0 }], 1000)).toBe('Updating the canvas…');
    expect(taskLine([{ label: 'Updating the canvas…', started: 0 }], 4200)).toBe('Updating the canvas · 4 s');
    expect(taskLine([{ label: 'Saving…', started: 0 }, { label: 'Uploading lettering.png…', started: 0, progress: 0.35 }], 500)).toBe('Uploading lettering.png: 35% · 2 tasks');
    expect(elapsedText(65_000)).toBe('1 min 5 s');
    expect(elapsedText(120_000)).toBe('2 min');
  });

  it('reads the timing tokens', () => {
    expect(cssTime(' 300ms', 0)).toBe(300);
    expect(cssTime('2s', 0)).toBe(2000);
    expect(cssTime('', 7)).toBe(7);
  });

  it('turns what a save says once done into its words while under way', () => {
    expect(underWay('Saved carousel settings')).toBe('Saving carousel settings');
    expect(underWay('Moved slide to place 2')).toBe('Moving slide to place 2');
    expect(underWay('Added Grace’s recommendation')).toBe('Adding Grace’s recommendation');
    expect(underWay('Removed slide')).toBe('Removing slide');
    expect(underWay('Deleted a page')).toBe('Deleting a page');
    expect(underWay('Published')).toBe('Saving: Published');
  });
});

describe('optimistic edits (spec §3.6)', () => {
  const p = (t: string): Block => ({ type: 'text', markdown: t });
  const body = [p('a'), p('b'), p('c'), { type: 'divider' } as Block];

  it('finds where each block went: moved, several moved, removed', () => {
    expect(originsOf(body, ops.move(body, 0, 2))).toEqual([
      { from: 1, copy: false },
      { from: 2, copy: false },
      { from: 0, copy: false },
      { from: 3, copy: false },
    ]);
    const many = ops.moveMany(body, [0, 1], 1).body;
    expect(originsOf(body, many).map((o) => o?.from)).toEqual([2, 0, 1, 3]);
    const gone = ops.removeMany(body, [1, 3]);
    expect(originsOf(body, gone)).toEqual([
      { from: 0, copy: false },
      { from: 2, copy: false },
    ]);
    expect(targetsOf(originsOf(body, gone), body.length)).toEqual([0, -1, 1, -1]);
  });

  it('a duplicate is a copy of its original; a new block has no origin', () => {
    expect(originsOf(body, ops.duplicate(body, 1))[2]).toEqual({ from: 1, copy: true });
    expect(originsOf(body, ops.insert(body, 1, p('new')))[1]).toBeNull();
  });

  it('an edit in place is not a change of order or presence', () => {
    expect(isStructural(body, ops.replace(body, 1, p('B')))).toBe(false);
    expect(isStructural(body, ops.move(body, 0, 3))).toBe(true);
    expect(isStructural(body, ops.insert(body, 4, p('d')))).toBe(true);
  });

  it("renames a form's fields for its block's new place, and only its own position", () => {
    expect(renameIndex('name', 'body.3.caption', 3, 4)).toBe('body.4.caption');
    expect(renameIndex('name', 'body.3.items.3.media', 3, 0)).toBe('body.0.items.3.media');
    expect(renameIndex('name', 'body.30.caption', 3, 4)).toBe('body.30.caption');
    expect(renameIndex('data-editor-pick', 'body.3', 3, 1)).toBe('body.1');
    expect(renameIndex('id', 'f-3-caption', 3, 5)).toBe('f-5-caption');
    expect(renameIndex('aria-describedby', 'f-3-a-hint f-3-a-issue', 3, 5)).toBe('f-5-a-hint f-5-a-issue');
    expect(renameIndex('data-index', '3', 3, 2)).toBe('2');
    expect(renameIndex('data-item', '3', 3, 2)).toBe('3');
    expect(renameIndex('data-block-form', '13', 3, 2)).toBe('13');
  });

  it('renames a whole form; two forms that swap places never collide', () => {
    // a minimal element: renameTree needs only attributes and querySelectorAll('*')
    type Fake = { attrs: Map<string, string>; kids: Fake[] };
    const el = (attrs: Record<string, string>, kids: Fake[] = []): Fake => ({ attrs: new Map(Object.entries(attrs)), kids });
    const asElement = (f: Fake): Element => {
      const all = (n: Fake): Fake[] => n.kids.flatMap((k) => [k, ...all(k)]);
      return {
        get attributes() {
          return [...f.attrs].map(([name, value]) => ({ name, value }));
        },
        setAttribute: (n: string, v: string) => f.attrs.set(n, v),
        querySelectorAll: () => all(f).map(asElement),
      } as unknown as Element;
    };
    const one = el({ 'data-block-form': '1' }, [el({ name: 'body.1.caption', id: 'f-1-caption' }), el({ for: 'f-1-caption' }), el({ 'data-index': '1', 'data-editor-pick': 'body.1.media' })]);
    const two = el({ 'data-block-form': '2' }, [el({ name: 'body.2.alt', id: 'f-2-alt' })]);
    renameTree(asElement(one), 1, 2);
    renameTree(asElement(two), 2, 1);
    const dump = (f: Fake): unknown => [Object.fromEntries(f.attrs), ...f.kids.map(dump)];
    expect(dump(one)).toEqual([{ 'data-block-form': '2' }, [{ name: 'body.2.caption', id: 'f-2-caption' }], [{ for: 'f-2-caption' }], [{ 'data-index': '2', 'data-editor-pick': 'body.2.media' }]]);
    expect(dump(two)).toEqual([{ 'data-block-form': '1' }, [{ name: 'body.1.alt', id: 'f-1-alt' }]]);
  });
});
