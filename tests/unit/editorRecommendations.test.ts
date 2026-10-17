import { describe, expect, it } from 'vitest';
import { chosenSection, cleanRecommendation, cleanSettings, removeRecommendation, upsertRecommendation, withSectionSettings } from '../../src/site/editor/model/recommendations';
import type { SiteStructure } from '../../src/site/content/schema';

const tree = {
  home: {
    id: 'home',
    kind: 'hub',
    slug: '',
    title: 'Home',
    children: [
      { id: 'work', kind: 'hub', slug: 'work', title: 'Work', view: 'bento', children: [] },
      { id: 'about', kind: 'hub', slug: 'about', title: 'About', summary: 'Me.', children: [] },
    ],
  },
  menus: { primary: [] },
} as unknown as SiteStructure;

describe('edit mode: recommendations', () => {
  it('adds a new one at the end and replaces one in place', () => {
    const a = { id: 'a', name: 'A', title: 'T', text: 'x' };
    const b = { id: 'b', name: 'B', title: 'T', text: 'y' };
    expect(upsertRecommendation([a], b).map((r) => r.id)).toEqual(['a', 'b']);
    expect(upsertRecommendation([a, b], { ...a, name: 'A2' })).toEqual([{ ...a, name: 'A2' }, b]);
    expect(removeRecommendation([a, b], 'a')).toEqual([b]);
  });

  it('leaves out empty optional fields and trims the rest', () => {
    expect(cleanRecommendation({ id: 'a', name: ' Ada ', title: ' CTO ', link: ' ', relationship: '', date: '', text: ' Hi\r\n\r\nThere ', hidden: false })).toEqual({ id: 'a', name: 'Ada', title: 'CTO', text: 'Hi\n\nThere' });
    expect(cleanRecommendation({ id: 'a', name: 'A', title: 'T', link: 'https://x.dev', date: '2025-03', text: 'w', hidden: true })).toMatchObject({ link: 'https://x.dev', date: '2025-03', hidden: true });
  });

  it("keeps a page to follow only for 'after a page', and no empty heading", () => {
    expect(cleanSettings({ show: true, at: 'start', after: 'x', layout: 'wall', open: 'inline', heading: ' ' })).toEqual({ show: true, at: 'start', layout: 'wall', open: 'inline' });
    expect(cleanSettings({ show: true, at: 'after', after: 'x', layout: 'nope' as never })).toMatchObject({ at: 'after', after: 'x', layout: 'tiles', open: 'dialog' });
  });

  it("writes a section's settings and keeps every other field", () => {
    const s = { show: true, at: 'end' as const, layout: 'rows' as const, open: 'dialog' as const };
    const next = withSectionSettings(tree, 'about', s)!;
    const about = next.home.children!.find((n) => n.id === 'about')!;
    expect(about).toMatchObject({ title: 'About', summary: 'Me.', recommendations: s });
    expect(next.home.children![0]).toBe(tree.home.children![0]);
    expect(next.menus).toBe(tree.menus);
    expect(withSectionSettings(tree, 'nope', s)).toBeNull();
  });

  it('opens on the section asked for, else About, else the first', () => {
    const list = [
      { id: 'work', title: 'Work' },
      { id: 'about', title: 'About' },
    ];
    expect(chosenSection(list, 'work')).toBe('work');
    expect(chosenSection(list, null)).toBe('about');
    expect(chosenSection([{ id: 'me', title: 'About' }, { id: 'x', title: 'X' }], 'gone')).toBe('me');
    expect(chosenSection([{ id: 'x', title: 'X' }], null)).toBe('x');
  });
});

describe('recommendations: photos', () => {
  it('takes a photo only from a LinkedIn profile address', async () => {
    const { isLinkedInProfile, wantsProfilePhoto } = await import('../../src/site/content/recommendations');
    expect(isLinkedInProfile('https://www.linkedin.com/in/someone/')).toBe(true);
    expect(isLinkedInProfile('https://linkedin.com/in/someone')).toBe(true);
    expect(isLinkedInProfile('https://www.linkedin.com/company/x')).toBe(false);
    expect(isLinkedInProfile('https://evil.example/in/someone')).toBe(false);
    expect(isLinkedInProfile('http://www.linkedin.com/in/someone')).toBe(false);
    expect(wantsProfilePhoto({ link: 'https://www.linkedin.com/in/a' })).toBe(true);
    expect(wantsProfilePhoto({ link: 'https://www.linkedin.com/in/a', photo: 'shared/a' })).toBe(false);
    expect(wantsProfilePhoto({ link: 'https://www.linkedin.com/in/a', noPhoto: true })).toBe(false);
    expect(wantsProfilePhoto({ link: 'https://example.com/' })).toBe(false);
  });

  it("reads the profile's og:image from LinkedIn's media host, and nothing else", async () => {
    const { profilePhoto } = await import('../../src/site/editor/server/recommendations');
    const page = (html: string, url = 'https://www.linkedin.com/in/a') => Object.defineProperty(new Response(html, { status: 200 }), 'url', { value: url });
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const asked: string[] = [];
    const fake = (html: string, url?: string) =>
      (async (input: RequestInfo | URL) => {
        asked.push(String(input));
        return String(input).includes('licdn') ? new Response(png, { status: 200, headers: { 'content-type': 'image/jpeg' } }) : page(html, url);
      }) as typeof fetch;
    const ok = await profilePhoto('https://www.linkedin.com/in/a', fake('<meta property="og:image" content="https://media.licdn.com/dms/image/x/profile-displayphoto?e=1&amp;v=2">'));
    expect(ok).toEqual({ ok: true, bytes: png });
    expect(asked.at(-1)).toBe('https://media.licdn.com/dms/image/x/profile-displayphoto?e=1&v=2');
    // LinkedIn's stand-in picture, another host, no tag, a sign-in wall: nothing
    expect((await profilePhoto('https://www.linkedin.com/in/a', fake('<meta property="og:image" content="https://static.licdn.com/ghost.png">'))).ok).toBe(false);
    expect((await profilePhoto('https://www.linkedin.com/in/a', fake('<html></html>'))).ok).toBe(false);
    expect((await profilePhoto('https://www.linkedin.com/in/a', fake('<meta property="og:image" content="https://media.licdn.com/x">', 'https://www.linkedin.com/authwall?x=1'))).ok).toBe(false);
    expect((await profilePhoto('https://example.com/a', fake(''))).ok).toBe(false);
  });

  it('keeps a photo, and drops it for initials only', async () => {
    const { cleanRecommendation } = await import('../../src/site/editor/model/recommendations');
    expect(cleanRecommendation({ id: 'a', name: 'A', title: 'T', text: 'w', photo: 'shared/a-photo' }).photo).toBe('shared/a-photo');
    expect(cleanRecommendation({ id: 'a', name: 'A', title: 'T', text: 'w', photo: 'shared/a-photo', noPhoto: true })).toEqual({ id: 'a', name: 'A', title: 'T', text: 'w', noPhoto: true });
  });
});

describe('edit mode: recommendations screen', () => {
  it('says where they show in a line', async () => {
    const { placeLine } = await import('../../src/site/editor/model/recommendations');
    expect(placeLine([{ title: 'About' }])).toBe('Not on any section yet');
    expect(placeLine([{ title: 'About', settings: { show: true, at: 'end', layout: 'wall', open: 'dialog' } }, { title: 'Work', settings: { show: false, at: 'start', layout: 'tiles', open: 'dialog' } }])).toBe('About, after the pages, as a wall');
    expect(placeLine([{ title: 'About', settings: { show: true, at: 'start', layout: 'rows', open: 'dialog' } }])).toBe('About, before the pages, as rows');
    const on = { show: true, at: 'end' as const, layout: 'tiles' as const, open: 'dialog' as const };
    expect(placeLine([{ title: 'A', settings: on }, { title: 'B', settings: on }])).toBe('On 2 sections');
  });

  it('opens on the one asked for, else the first, else a new one', async () => {
    const { chosenDetail } = await import('../../src/site/editor/model/recommendations');
    expect(chosenDetail([{ id: 'a' }, { id: 'b' }], 'b')).toBe('b');
    expect(chosenDetail([{ id: 'a' }], 'gone')).toBe('a');
    expect(chosenDetail([{ id: 'a' }], 'place')).toBe('place');
    expect(chosenDetail([], null)).toBe('new');
  });
});
