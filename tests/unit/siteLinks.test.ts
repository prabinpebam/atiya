import { describe, expect, it } from 'vitest';
import { leavesParentDomain, linkAttrs, SITE_PARENT_DOMAIN } from '../../src/site/design/links';

describe('site link tab policy', () => {
  it('keeps relative, browser-native and parent-domain links in the current tab', () => {
    for (const href of [
      '/work/',
      '#chapter',
      'mailto:hello@example.com',
      'tel:+911234567890',
      `https://${SITE_PARENT_DOMAIN}/atiya/`,
      `https://projects.${SITE_PARENT_DOMAIN}/demo/`,
    ]) {
      expect(leavesParentDomain(href), href).toBe(false);
      expect(linkAttrs(href)).toEqual({ newTab: false, target: undefined, rel: undefined });
    }
  });

  it('opens an HTTP(S) link outside the parent domain in a protected new tab', () => {
    for (const href of ['https://github.com/prabinpebam/atiya', 'http://example.com/', 'https://prabinpebam.github.io.example.com/']) {
      expect(leavesParentDomain(href), href).toBe(true);
      expect(linkAttrs(href)).toEqual({ newTab: true, target: '_blank', rel: 'noopener noreferrer' });
    }
  });

  it('also treats the current development host as local and allows an explicit workflow exception', () => {
    expect(leavesParentDomain('http://localhost:4321/work/', 'localhost')).toBe(false);
    expect(linkAttrs('/preview/', 'localhost', true)).toEqual({ newTab: true, target: '_blank', rel: 'noopener noreferrer' });
  });
});
