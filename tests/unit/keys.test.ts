import { describe, expect, it } from 'vitest';
import { KeyboardInput, spaceBack } from '../../src/game/input/keyboard';

// E does, Space goes back (design system §6.7)
describe('keys: E does, Space goes back', () => {
  it('binds E and Enter to interact, Space to back, Escape to the menu', () => {
    expect(KeyboardInput.actionFor('KeyE')).toBe('interact');
    expect(KeyboardInput.actionFor('Enter')).toBe('interact');
    expect(KeyboardInput.actionFor('Space')).toBe('back');
    expect(KeyboardInput.actionFor('Escape')).toBe('menu');
    expect(KeyboardInput.actionFor('Tab')).toBeNull();
  });

  // a stand-in for a focused element: `closest` finds it only if the selector names what it is
  const on = (what: string | null) => ({ closest: (sel: string) => (what && sel.includes(what) ? {} : null) }) as unknown as EventTarget;

  it('in a screen, Space closes it, even on a button (Enter presses that)', () => {
    expect(spaceBack({ code: 'Space', repeat: false, target: on(null) })).toBe(true);
    expect(spaceBack({ code: 'Space', repeat: false, target: null })).toBe(true);
  });

  it("leaves Space to a control whose own key it is, and ignores repeats and other keys", () => {
    for (const c of ['input:not([type=button])', 'select', 'textarea', '[role=slider]', '[role=checkbox]', '[role=switch]', '[role=radio]']) expect(spaceBack({ code: 'Space', repeat: false, target: on(c) })).toBe(false);
    expect(spaceBack({ code: 'Space', repeat: true, target: on(null) })).toBe(false);
    expect(spaceBack({ code: 'KeyE', repeat: false, target: on(null) })).toBe(false);
  });
});
