// @ts-check
/** Plan stage 7D: one theme for the whole app. */
import { describe, expect, it } from 'vitest';
import { parseTheme, siteThemeScript, THEMES } from '../src/core/theme.mjs';

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
});
