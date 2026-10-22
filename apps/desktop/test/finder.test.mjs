// @ts-check
/** Plan stage 7E: what the action center finds, and what the main process opens for it (action-center.md §4, §8.4). */
import { describe, expect, it } from 'vitest';
import { addressFor, checkTarget, recentFor, rememberFor } from '../src/core/finder.mjs';
import { ACTION_IDS, appActions, appSettings, checkAppSetting, contentResults, screenControls } from '../src/ui/find-catalogue.mjs';

const INDEX = {
  pages: [
    { id: 'designup', title: 'My journey with DesignUp', kindLabel: 'Article', statusLabel: 'Published', section: { id: 'writing', title: 'Writing' }, path: '/writing/designup/', summary: 'A talk.', text: 'We ship weekly.', picture: 'articles/designup/stage', private: false },
    { id: 'draft-one', title: 'A draft', kindLabel: 'Article', statusLabel: 'Draft', section: null, path: null, summary: 'Not yet.', text: '', picture: null, private: true },
  ],
  sections: [{ id: 'writing', title: 'Writing', path: '/writing/', pages: 4 }],
  albums: [{ id: 'harbour', title: 'Harbour walks', summary: 'By the sea.', statusLabel: 'Published', private: false, items: 3, path: '/gallery/harbour/', picture: null }],
  media: [{ id: 'articles/designup/stage', kind: 'image', title: 'On stage', caption: '', ownerLabel: 'My journey with DesignUp', width: 1600, height: 900 }],
  screens: [
    { id: 'articles', label: 'Pages', href: '/_edit/articles/', words: ['articles'] },
    { id: 'evil', label: 'Elsewhere', href: 'https://example.com/' },
    { id: 'settings', label: 'Settings', href: '/_edit/settings/' },
  ],
  settings: [{ id: 'site-name', title: 'Site name', control: 'text', value: 'Ada', version: 'v1', screen: 'settings', screenLabel: 'Settings' }],
};

describe('what the panel may ask for', () => {
  it('takes known kinds and ids of the right shape, nothing else', () => {
    expect(checkTarget({ kind: 'page', id: 'designup' })).toEqual({ kind: 'page', id: 'designup', alt: false });
    expect(checkTarget({ kind: 'media', id: 'articles/designup/stage', alt: true })).toMatchObject({ alt: true });
    expect(checkTarget({ kind: 'command', id: 's12', value: 'phone' })).toMatchObject({ value: 'phone' });
    for (const bad of [null, 'page', { kind: 'url', id: 'x' }, { kind: 'page', id: '../etc' }, { kind: 'page', id: 'a//b' }, { kind: 'page', id: 'x'.repeat(201) }, { kind: 'page' }]) expect(checkTarget(bad)).toBeNull();
  });

  it("opens what the index holds, at addresses the main process builds; a page without an address isn't on the site", () => {
    expect(addressFor({ kind: 'page', id: 'designup', alt: false }, INDEX)).toEqual({ view: 'editor', path: '/_edit/articles/designup/' });
    expect(addressFor({ kind: 'page', id: 'designup', alt: true }, INDEX)).toEqual({ view: 'site', path: '/writing/designup/' });
    expect(addressFor({ kind: 'page', id: 'draft-one', alt: true }, INDEX)).toBeNull();
    expect(addressFor({ kind: 'page', id: 'nowhere', alt: false }, INDEX)).toBeNull();
    expect(addressFor({ kind: 'section', id: 'writing', alt: false }, INDEX)).toEqual({ view: 'editor', path: '/_edit/sections/?section=writing' });
    // an album opens in its album editor, or its page on the site (gallery spec §9.10)
    expect(addressFor({ kind: 'album', id: 'harbour', alt: false }, INDEX)).toEqual({ view: 'editor', path: '/_edit/albums/harbour/' });
    expect(addressFor({ kind: 'album', id: 'harbour', alt: true }, INDEX)).toEqual({ view: 'site', path: '/gallery/harbour/' });
    expect(contentResults(INDEX).find((r) => r.key === 'album:harbour')).toMatchObject({ group: 'pages', title: 'Harbour walks', facts: ['Album', 'Published'] });
    expect(addressFor({ kind: 'media', id: 'articles/designup/stage', alt: false }, INDEX)).toEqual({ view: 'editor', path: '/_edit/media/?id=articles%2Fdesignup%2Fstage' });
    expect(addressFor({ kind: 'go', id: 'articles', alt: false }, INDEX)).toEqual({ view: 'editor', path: '/_edit/articles/' });
    // a screen's address must be edit mode's own
    expect(addressFor({ kind: 'go', id: 'evil', alt: false }, INDEX)).toBeNull();
    expect(addressFor({ kind: 'setting', id: 'site-name', alt: true }, INDEX)).toEqual({ view: 'editor', path: '/_edit/settings/' });
    expect(addressFor({ kind: 'page', id: 'designup', alt: false }, null)).toBeNull();
  });
});

describe('recent', () => {
  it('is kept per site, never a private page or picture', () => {
    let all = rememberFor({}, 'E:\\Sites\\Ada', 'page:designup', false);
    all = rememberFor(all, 'E:\\Sites\\Ada', 'page:draft-one', true);
    all = rememberFor(all, 'E:\\Sites\\Bo', 'setting:theme', false);
    expect(recentFor(all, 'e:\\sites\\ada')).toEqual(['page:designup']);
    expect(recentFor(all, 'E:\\Sites\\Bo')).toEqual(['setting:theme']);
    expect(recentFor(all, undefined)).toEqual([]);
  });
});

describe('the catalogue', () => {
  const state = { server: { state: 'ready' }, theme: 'dark', prefs: { zoom: 1.2, keepInTray: false }, account: { state: 'signed-in', login: 'ada' }, workspace: { kind: 'developer' }, sites: [{ path: 'A', name: 'Ada', current: true }, { path: 'B', name: 'Bo', address: 'bo.github.io', current: false }] };

  it("lists the app's actions that apply now, with one to switch to each other site", () => {
    const keys = appActions(state).map((r) => r.key);
    expect(keys).toContain('action:restart');
    expect(keys).toContain('action:sign-out');
    expect(keys).toContain('switch:B');
    expect(keys).not.toContain('switch:A');
    // not live, not a managed site, signed in
    expect(keys).not.toContain('action:open-live');
    expect(keys).not.toContain('action:check');
    expect(keys).not.toContain('action:sign-in');
    for (const k of keys.filter((k) => k.startsWith('action:') && k !== 'action:sign-out')) expect(ACTION_IDS.has(k.slice(7))).toBe(true);
  });

  it('says which actions wait for edit mode while it starts', () => {
    const starting = appActions({ ...state, server: { state: 'starting' } });
    expect(starting.find((r) => r.key === 'action:show-site')?.needsEdit).toBe(true);
    expect(starting.find((r) => r.key === 'action:restart')?.needsEdit).toBeUndefined();
  });

  it("draws the app's settings with their values", () => {
    const [theme, zoom, tray] = appSettings(state);
    expect(theme.setting).toMatchObject({ control: 'choice', value: 'dark' });
    expect(zoom.setting).toMatchObject({ control: 'slider', value: 120, min: 50, max: 200, step: 10 });
    expect(tray.setting).toMatchObject({ control: 'switch', value: false });
  });

  it("takes only values a setting knows", () => {
    expect(checkAppSetting('theme', 'dark')).toBe('dark');
    expect(checkAppSetting('theme', 'purple')).toBeUndefined();
    expect(checkAppSetting('zoom', 1.234)).toBe(1.2);
    expect(checkAppSetting('zoom', 9)).toBe(2);
    expect(checkAppSetting('zoom', '1')).toBeUndefined();
    expect(checkAppSetting('tray', 'yes')).toBeUndefined();
    expect(checkAppSetting('other', true)).toBeUndefined();
  });

  it("lists the screen's controls and each choice of its menus, not the disabled", () => {
    const h = { context: [], theme: 'system', busy: false, controls: [
      { kind: 'button', id: 's1', label: 'Undo', icon: 'undo' },
      { kind: 'button', id: 's2', label: 'Redo', disabled: true },
      { kind: 'select', id: 's3', label: 'Preview width', value: 'desktop', options: [{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }] },
      { kind: 'status', text: 'Saved' },
    ] };
    const r = screenControls(/** @type {any} */ (h));
    expect(r.map((x) => x.title)).toEqual(['Undo', 'Preview width: Desktop', 'Preview width: Phone']);
    expect(r[2].target).toEqual({ kind: 'command', id: 's3', value: 'phone' });
  });

  it("turns edit mode's index into results, a page's second action only when it has an address", () => {
    const r = contentResults(INDEX);
    const page = r.find((x) => x.key === 'page:designup');
    expect(page).toMatchObject({ group: 'pages', detail: 'Writing · Published', picture: 'articles/designup/stage', second: { label: 'View on site' } });
    expect(r.find((x) => x.key === 'page:draft-one')).toMatchObject({ private: true, detail: 'Not in a section · Draft · Private' });
    expect(r.find((x) => x.key === 'page:draft-one')?.second).toBeUndefined();
    expect(r.find((x) => x.key === 'media:articles/designup/stage')).toMatchObject({ group: 'media', title: 'On stage', facts: ['Picture', '1600 × 900'] });
    expect(r.find((x) => x.key === 'setting:site-name')?.setting).toMatchObject({ control: 'text', value: 'Ada', version: 'v1' });
    expect(contentResults(null)).toEqual([]);
  });
});
