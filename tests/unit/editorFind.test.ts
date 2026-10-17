/**
 * The action center's side of edit mode (documentation/desktop/action-center.md §8.2, §8.3; desktop plan 7E.7):
 * edit mode's screens, a page's body as text, and the site's settings a card can change.
 */
import { describe, expect, it } from 'vitest';
import { BODY_TEXT_MAX, bodyText, checkSiteText, editScreens, findSettings, modeOf, wayId, waysWith, withSiteText } from '../../src/site/editor/model/find';
import type { Article, SiteSettings } from '../../src/site/content/schema';

describe('the action center: edit mode', () => {
  it("lists edit mode's screens as the side navigation does: the Planet while it's on, Tests on a source checkout", () => {
    const all = editScreens({ planet: true, managed: false }).map((s) => s.id);
    expect(all).toEqual(['dashboard', 'articles', 'sections', 'navigation', 'planet', 'media', 'settings', 'theme', 'ways', 'access', 'publish', 'tests']);
    const managed = editScreens({ planet: false, managed: true }).map((s) => s.id);
    expect(managed).not.toContain('planet');
    expect(managed).not.toContain('tests');
    // a newcomer's words find each one (§4.4)
    const publish = editScreens({ planet: false, managed: true }).find((s) => s.id === 'publish');
    expect(publish).toMatchObject({ label: 'Save to remote', path: 'publish/' });
    expect(publish?.words).toEqual(expect.arrayContaining(['publish', 'push', 'deploy']));
    for (const s of editScreens({ planet: true, managed: false })) expect(s.words.length, s.id).toBeGreaterThan(0);
  });

  it("reads a page's headings and paragraphs as plain text, in order, and no more than the index carries", () => {
    const body: Article['body'] = [
      { type: 'heading', level: 2, text: 'Why we ship' },
      { type: 'text', markdown: 'We **ship** weekly, and [learn](https://example.com) from it.' },
      { type: 'subheading', text: 'A line   more' },
      { type: 'text', markdown: '- one\n- two' },
    ] as Article['body'];
    const t = bodyText({ body });
    expect(t).toContain('Why we ship We ship weekly, and learn from it. A line more');
    expect(t).not.toContain('**');
    expect(t).not.toContain('https://');
    const long = Array.from({ length: 200 }, () => ({ type: 'text', markdown: 'Lorem ipsum dolor sit amet, consectetur adipiscing.' })) as Article['body'];
    expect(bodyText({ body: long }).length).toBeLessThanOrEqual(BODY_TEXT_MAX);
  });

  it("checks the site's words as their screen does, and changes only that field", () => {
    expect(checkSiteText('site-name', '  Ada   King ')).toEqual({ ok: true, value: 'Ada King' });
    expect(checkSiteText('site-name', '   ')).toEqual({ ok: false, message: 'The site needs a name.' });
    expect(checkSiteText('site-name', 42)).toMatchObject({ ok: false });
    expect(checkSiteText('site-description', 'x'.repeat(161))).toEqual({ ok: false, message: 'Keep it to 160 characters: it has 161.' });
    const site = { name: 'Ada', description: 'Hello.', owner: 'ada', locale: 'en' } as SiteSettings;
    expect(withSiteText(site, 'site-description', 'Hi.')).toEqual({ ...site, description: 'Hi.' });
  });

  it('shows the name, the description and each way to explore as cards, with their versions and screens', () => {
    const s = findSettings({
      site: { name: 'Ada', description: 'Hello.', owner: 'ada', locale: 'en' } as SiteSettings,
      siteVersion: 'v1',
      ways: { modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'site' },
      waysVersion: null,
      modes: [{ id: 'little-planet', name: 'Little planet', summary: 'Walk round a little planet.' }],
    });
    expect(s.map((x) => [x.id, x.control, x.value, x.version, x.screen])).toEqual([
      ['site-name', 'text', 'Ada', 'v1', 'settings'],
      ['site-description', 'text', 'Hello.', 'v1', 'settings'],
      ['way:little-planet', 'switch', true, null, 'ways'],
    ]);
    expect(s[2].restarts).toBe(true);
    expect(modeOf(wayId('little-planet'))).toBe('little-planet');
    expect(modeOf('site-name')).toBeNull();
  });

  it('turns a way off as the Ways to explore screen does: off, and the home page back to the site', () => {
    const next = waysWith({ modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'little-planet' }, 'little-planet', false, 'play');
    expect(next).toEqual({ modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site' });
  });
});
