/**
 * Protected content, phase A1 (documentation/access/plan.md): two content folders read as one, the
 * overlay's locked pages placed in their open sections, private pages at /p/<token>/, and the rules
 * that keep protected pages off open ones (V23 to V32). The private folder here is always the made-up
 * fixtures (tests/fixtures/private-pages), never private-pages/.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readSnapshot, privateRoot } from '../../src/site/content/source';
import { ContentError, loadContent } from '../../src/site/content/load';
import { withOverlay, RESERVED } from '../../src/site/content/routes';
import type { Article } from '../../src/site/content/schema';

const ROOT = join(__dirname, '../..');
const FIXTURES = join(ROOT, 'tests/fixtures/private-pages');
const snap = () => readSnapshot(join(ROOT, 'content'), FIXTURES);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The issues the content would have after `change`, as text. */
function problems(change: (docs: Record<string, any>, masters: Set<string>) => void): string {
  const s = snap();
  const docs = clone(s.docs);
  const masters = new Set(s.masters);
  change(docs, masters);
  try {
    loadContent(docs, masters, s.errors);
    return '';
  } catch (e) {
    if (e instanceof ContentError) return e.problems.join('\n');
    throw e;
  }
}
const warnings = (change: (docs: Record<string, any>) => void) => {
  const s = snap();
  const docs = clone(s.docs);
  change(docs);
  return loadContent(docs, s.masters, s.errors).warnings.join('\n');
};

describe('the private folder, as a submodule', () => {
  it('private-pages is a submodule entry, and the public repository tracks no file under it', () => {
    const entry = execFileSync('git', ['ls-files', '-s', '--', 'private-pages'], { cwd: ROOT }).toString().trim();
    expect(entry).toMatch(/^160000 [0-9a-f]{40} 0\tprivate-pages$/);
    const under = execFileSync('git', ['ls-files', '--', 'private-pages/'], { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
    expect(under).toEqual(['private-pages']);
    expect(execFileSync('git', ['config', '-f', '.gitmodules', 'submodule.private-pages.url'], { cwd: ROOT }).toString().trim()).toBe('https://github.com/prabinpebam/atiya-private.git');
  });

  it('the unit tests read the fixtures, never private-pages/', () => {
    expect(privateRoot()).toBe(FIXTURES);
  });
});

describe('one source, two origins', () => {
  it('keys private files /private/…, and leaves out the private repository README', () => {
    const s = snap();
    expect(s.docs['/private/articles/fx-locked-alpha.json']).toBeTruthy();
    expect(s.docs['/private/structures/overlay.json']).toBeTruthy();
    expect(s.masters.has('/private/media/articles/fx-locked-alpha/harbour.webp')).toBe(true);
    expect(s.masters.has('/private/media/articles/fx-locked-beta/tidepool.mp4')).toBe(true);
    expect(s.errors.filter((e) => e.startsWith('private/'))).toEqual([]);
  });

  it('without a private folder (or one without its access file), only the public folder is read', () => {
    const pub = readSnapshot(join(ROOT, 'content'), null);
    expect(Object.keys(pub.docs).some((k) => k.startsWith('/private/'))).toBe(false);
    const empty = readSnapshot(join(ROOT, 'content'), join(ROOT, 'tests/fixtures'));
    expect(Object.keys(empty.docs).some((k) => k.startsWith('/private/'))).toBe(false);
  });

  it('a public-only build has exactly the routes it had, all open', () => {
    const pub = readSnapshot(join(ROOT, 'content'), null);
    const index = loadContent(pub.docs, pub.masters, pub.errors);
    expect(index.routes.every((r) => r.access === 'open')).toBe(true);
    const both = loadContent(snap().docs, snap().masters, snap().errors);
    expect(both.routes.filter((r) => r.access === 'open').map((r) => r.path)).toEqual(index.routes.map((r) => r.path));
  });

  it('every private media record knows its origin', () => {
    const s = snap();
    const index = loadContent(s.docs, s.masters, s.errors);
    expect(index.media.get('articles/fx-locked-alpha/harbour')?.origin).toBe('private');
    expect(index.media.get('articles/fx-locked-alpha/harbour')?.darkMaster).toBe('/private/media/articles/fx-locked-alpha/harbour.dark.webp');
    expect(index.videos.get('articles/fx-locked-beta/tidepool')?.origin).toBe('private');
    expect([...index.media.values()].filter((m) => m.origin === 'public').length).toBeGreaterThan(0);
  });
});

describe('locked and private pages in the route table', () => {
  const s = snap();
  const index = loadContent(s.docs, s.masters, s.errors);
  const route = (id: string) => index.routes.find((r) => r.node.kind === 'item' && r.node.item.id === id)!;

  it('a locked page sits at its token in its open section; a private page at /p/<token>/', () => {
    expect(route('fx-locked-alpha')).toMatchObject({ path: '/side-projects/alphaaaaa2/', access: 'locked', published: true });
    expect(route('fx-locked-delta')).toMatchObject({ path: '/work/deltaddd55/', access: 'locked' });
    expect(route('fx-private-one')).toMatchObject({ path: '/p/privone222/', access: 'private' });
    expect(route('fx-private-one').parent).toBeUndefined();
    expect(index.access.get('fx-private-two')).toBe('private');
    expect(index.access.get('atiya')).toBe('open');
  });

  it("a section's order is the overlay's: locked pages between open ones, then the rest", () => {
    const kids = index.routes.filter((r) => r.parent?.id === 'side-projects').map((r) => r.node.id);
    expect(kids.slice(0, 6)).toEqual(['atiya', 'fx-locked-alpha', 'watai', 'fx-locked-beta', 'story', 'fx-locked-gamma']);
    expect(kids).toContain('khonjel');
  });

  it('the public structure is untouched; the merge is a copy', () => {
    const before = JSON.stringify(index.structure);
    const merged = withOverlay(index.structure, index.overlay);
    expect(JSON.stringify(index.structure)).toBe(before);
    expect(merged.locked.has('fx-locked-alpha')).toBe(true);
  });

  it('the code reserves the addresses it owns', () => {
    for (const p of ['p', 'sign-in', '_sealed', '_access']) expect(RESERVED).toContain(p);
  });

  it('loads the grants and the share message', () => {
    expect(index.grants.map((g) => g.id)).toContain('gfixall22');
    expect(index.accessMessage?.code).toMatch(/\{code\}/);
  });
});

describe('the rules (V23 to V32)', () => {
  it('V23: the public structure never places a private page, and the overlay never a public one', () => {
    expect(
      problems((d) => {
        d['/content/structures/site.json'].home.children.find((c: any) => c.id === 'writing').children.push({ id: 'fx-locked-gamma', kind: 'item', item: { type: 'article', id: 'fx-locked-gamma' } });
      }),
    ).toMatch(/places "fx-locked-gamma", which is in private-pages\/.*V23/);
    expect(
      problems((d) => {
        d['/private/structures/overlay.json'].private.push({ id: 'khonjel-locked', token: 'khonjelaaa', item: { type: 'article', id: 'khonjel' } });
      }),
    ).toMatch(/"khonjel" is in content\/: a locked or private page lives in private-pages\/ \(V23\)/);
  });

  it('V24: tokens, article IDs and media IDs are unique across both folders; a token has its form', () => {
    expect(problems((d) => (d['/private/structures/overlay.json'].private[1].token = 'privone222'))).toMatch(/token "privone222" is also .*V24/);
    expect(problems((d) => (d['/private/structures/overlay.json'].private[1].token = 'Bad-Token!'))).toMatch(/a token: 10 characters/);
    expect(
      problems((d) => {
        d['/private/articles/khonjel.json'] = { ...d['/content/articles/khonjel.json'] };
      }),
    ).toMatch(/article "khonjel" is in both content\/ and private-pages\/.*V24/);
  });

  it('V25: an open page never shows private media, links to a protected page, or names one in related or the navigation', () => {
    expect(problems((d) => (d['/content/articles/khonjel.json'].thumbnail = 'articles/fx-locked-alpha/harbour'))).toMatch(/media "articles\/fx-locked-alpha\/harbour" is private.*V25/);
    expect(problems((d) => d['/content/articles/khonjel.json'].body.push({ type: 'video', media: 'articles/fx-locked-beta/tidepool' }))).toMatch(/the video .* is private.*V25/);
    expect(problems((d) => d['/content/articles/khonjel.json'].body.push({ type: 'text', markdown: 'See [it](ref:article/fx-locked-alpha).' }))).toMatch(/links to "fx-locked-alpha".*V25/);
    expect(problems((d) => (d['/content/articles/khonjel.json'].related = [{ type: 'article', id: 'fx-locked-beta' }]))).toMatch(/related names "fx-locked-beta".*V25/);
    expect(problems((d) => d['/content/structures/site.json'].menus.primary.push({ node: 'fx-locked-alpha' }))).toMatch(/node "fx-locked-alpha" is a locked or private page.*V25/);
  });

  it('V25: a redirect never leads to a protected page (skipped, with a warning)', () => {
    expect(warnings((d) => d['/content/redirects.json'].push({ from: '/gone-alpha/', to: '/side-projects/alphaaaaa2/' }))).toMatch(/is a locked or private page \(V25\)/);
  });

  it("V26: a grant's scope names what exists, and a code never opens a private page", () => {
    expect(problems((d) => (d['/private/access.json'].grants[0].scope.sections = ['nowhere']))).toMatch(/"nowhere" isn't a section of the site \(V26\)/);
    expect(problems((d) => (d['/private/access.json'].grants[1].scope.pages = ['khonjel']))).toMatch(/"khonjel" isn't a locked or private page \(V26\)/);
    expect(problems((d) => (d['/private/access.json'].grants[1].scope.pages = ['fx-private-one']))).toMatch(/private page: it opens from a magic link only.*V26/);
  });

  it('V28: a locked or private page is never on the planet', () => {
    expect(problems((d) => d['/content/structures/planet.json'].places[0].pages.push({ type: 'article', id: 'fx-locked-alpha' }))).toMatch(/"fx-locked-alpha" is locked or private: it can't be on the planet \(V28\)/);
  });

  it('V29: grant IDs are never reused; code names are unique among codes that work', () => {
    expect(problems((d) => d['/private/access.json'].grants.push(clone(d['/private/access.json'].grants[0])))).toMatch(/grant gfixall22 is listed twice.*V29/);
    expect(
      problems((d) => {
        const g = clone(d['/private/access.json'].grants[1]);
        d['/private/access.json'].grants.push({ ...g, id: 'gfixdup22' });
      }),
    ).toMatch(/the code name "lantern" is also .*V29/);
    // a name is free again once its grant has expired or been withdrawn
    expect(problems((d) => d['/private/access.json'].grants.push({ ...clone(d['/private/access.json'].grants[3]), id: 'gfixnew22' }))).toBe('');
  });

  it('V30: a grant expires after it is made', () => {
    expect(problems((d) => (d['/private/access.json'].grants[0].expiresAt = '2026-09-01T00:00:00+05:30'))).toMatch(/expires/i);
  });

  it("V31: an overlay order naming a page that isn't in the section is skipped, with a warning", () => {
    expect(warnings((d) => d['/private/structures/overlay.json'].sections[0].order.push('khonjel-nope'))).toMatch(/names "khonjel-nope", which isn't a page of it: skipped/);
  });

  it('V32: a protected page lists open pages only in related', () => {
    expect(problems((d) => (d['/private/articles/fx-locked-gamma.json'].related = [{ type: 'article', id: 'fx-locked-alpha' }]))).toMatch(/another protected page: a protected page lists open pages only \(V32\)/);
    expect(problems((d) => (d['/private/articles/fx-locked-gamma.json'].related = [{ type: 'article', id: 'khonjel' }]))).toBe('');
  });

  it('the eligibility table: a protected draft, or one not for publishing, is not built', () => {
    const s = snap();
    const docs = clone(s.docs);
    (docs['/private/articles/fx-locked-gamma.json'] as Article).status = 'draft';
    (docs['/private/articles/fx-private-two.json'] as Article).visibility = 'privateDiscussionOnly';
    const index = loadContent(docs, s.masters, s.errors);
    const built = index.routes.filter((r) => r.published).map((r) => r.node.id);
    expect(built).not.toContain('fx-locked-gamma');
    expect(built).not.toContain('fx-private-two');
    expect(built).toContain('fx-locked-alpha');
  });

  it('a private file to download is refused (v1: pictures and videos only)', () => {
    expect(
      problems((d, m) => {
        d['/private/media/articles/fx-locked-alpha/brief.json'] = { kind: 'document', file: 'brief.pdf', title: 'Brief', visibility: 'public' };
        m.add('/private/media/articles/fx-locked-alpha/brief.pdf');
      }),
    ).toMatch(/a file to download can't be private yet/);
  });
});
