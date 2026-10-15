// @ts-check
/** Plan stage 7D: one theme for the whole app. */
import { describe, expect, it } from 'vitest';
import { docsThemeScript, isDocsPage, parseTheme, siteThemeScript, THEME_SWITCHES_CSS, THEMES } from '../src/core/theme.mjs';

describe('the app theme', () => {
  it('knows three themes, and anything else is the system', () => {
    expect(THEMES).toEqual(['system', 'light', 'dark']);
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('purple')).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
  });

  it("writes the site's own stored choice, or clears it to follow the system, and never anything it wasn't given", () => {
    const run = (/** @type {unknown} */ t) => {
      /** @type {Record<string, string>} */
      const store = { 'site.theme': 'light' };
      const events = /** @type {string[]} */ ([]);
      const doc = { documentElement: { dataset: /** @type {Record<string, string>} */ ({ theme: 'light' }) }, dispatchEvent: (/** @type {Event} */ e) => events.push(e.type) };
      const ls = { setItem: (/** @type {string} */ k, /** @type {string} */ v) => (store[k] = v), removeItem: (/** @type {string} */ k) => delete store[k] };
      new Function('document', 'localStorage', 'Event', siteThemeScript(t))(doc, ls, Event);
      return { stored: store['site.theme'] ?? null, data: doc.documentElement.dataset.theme ?? null, events };
    };
    expect(run('dark')).toEqual({ stored: 'dark', data: 'dark', events: ['site:theme'] });
    expect(run('system')).toEqual({ stored: null, data: null, events: ['site:theme'] });
    expect(run('"); alert(1); ("')).toEqual({ stored: null, data: null, events: ['site:theme'] });
    expect(siteThemeScript('"); alert(1); ("')).not.toContain('alert');
  });

  it('knows the documentation by its address, under a base path too', () => {
    expect(isDocsPage('http://localhost:4321/docs/')).toBe(true);
    expect(isDocsPage('http://localhost:4321/docs/#engineering/overview.md')).toBe(true);
    expect(isDocsPage('http://localhost:4321/atiya/docs/index.html')).toBe(true);
    expect(isDocsPage('http://localhost:4321/writing/docs-and-notes/')).toBe(false);
    expect(isDocsPage('http://localhost:4321/')).toBe(false);
    expect(isDocsPage('not a url')).toBe(false);
  });

  it("makes the documentation follow the app: Slate's stored choice becomes auto, data-theme the app's theme", () => {
    const run = (/** @type {unknown} */ t, /** @type {boolean} */ systemDark) => {
      /** @type {Record<string, string>} */
      const store = { 'slate-theme-pref': 'light' };
      /** @type {Record<string, string>} */
      const attrs = { 'data-theme': 'light' };
      const doc = { documentElement: { setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => (attrs[k] = v) } };
      const ls = { setItem: (/** @type {string} */ k, /** @type {string} */ v) => (store[k] = v) };
      const mm = () => ({ matches: systemDark });
      new Function('document', 'localStorage', 'matchMedia', docsThemeScript(t))(doc, ls, mm);
      return [store['slate-theme-pref'], attrs['data-theme']];
    };
    expect(run('dark', false)).toEqual(['auto', 'dark']);
    expect(run('light', true)).toEqual(['auto', 'light']);
    expect(run('system', true)).toEqual(['auto', 'dark']);
    expect(run('system', false)).toEqual(['auto', 'light']);
    expect(docsThemeScript('"); alert(1); ("')).not.toContain('alert');
    expect(THEME_SWITCHES_CSS).toContain('.theme-toggle');
  });
});
