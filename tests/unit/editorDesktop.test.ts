/** Edit mode inside Atiya Studio (src/site/editor/model/desktop.ts; documentation/desktop/spec.md F8). */
import { describe, expect, it } from 'vitest';
import { PRIVATE_SETUP_URL, privateSetupHref } from '../../src/site/editor/model/desktop';

describe('setting up private pages from edit mode', () => {
  it('is offered only on a managed site that has none yet', () => {
    expect(privateSetupHref(true, false)).toBe(PRIVATE_SETUP_URL);
    expect(privateSetupHref(true, true)).toBeNull();
    expect(privateSetupHref(false, false)).toBeNull();
    expect(privateSetupHref(false, true)).toBeNull();
  });

  it("goes to the app's own page, which only the app's views can open", () => {
    expect(PRIVATE_SETUP_URL).toBe('app://ui/private.html');
  });
});
