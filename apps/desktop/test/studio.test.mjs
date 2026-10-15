// @ts-check
/** Plan stage 7B: edit mode's header as the row draws it; the main process checks what the dev server's page sends. */
import { describe, expect, it } from 'vitest';
import { isEditMode, sanitizeCommand, sanitizeHeader } from '../src/core/studio-header.mjs';

describe("edit mode's header in the row", () => {
  it('keeps what the row can draw: words, icons by name, known kinds and states', () => {
    const h = sanitizeHeader({
      context: [{ kind: 'link', id: 's1', label: 'Pages', text: 'Pages' }, { kind: 'text', text: '  An   article ', strong: true }, { kind: 'tag', text: 'Published', tone: 'positive', icon: 'circle-check' }],
      controls: [
        { kind: 'status', state: 'saved', text: 'All changes saved' },
        { kind: 'button', id: 's2', label: 'Undo', icon: 'undo', pressed: false, disabled: true },
        { kind: 'select', id: 's3', label: 'Colour theme', value: 'dark', options: [{ value: 'system', label: 'System', icon: 'theme-system' }, { value: 'dark', label: 'Dark' }] },
      ],
      theme: 'dark',
      busy: true,
    });
    expect(h).toEqual({
      context: [{ kind: 'link', id: 's1', label: 'Pages', text: 'Pages' }, { kind: 'text', text: 'An article', strong: true }, { kind: 'tag', text: 'Published', tone: 'positive', icon: 'circle-check' }],
      controls: [
        { kind: 'status', text: 'All changes saved', state: 'saved' },
        { kind: 'button', id: 's2', label: 'Undo', icon: 'undo', pressed: false, disabled: true },
        { kind: 'select', id: 's3', label: 'Colour theme', value: 'dark', options: [{ value: 'system', label: 'System', icon: 'theme-system' }, { value: 'dark', label: 'Dark' }] },
      ],
      theme: 'dark',
      busy: true,
    });
  });

  it('drops what it can not draw or trust: an unknown kind, a control without an id or a name, markup in an icon, a select without options', () => {
    const h = sanitizeHeader({
      context: [{ kind: 'html', text: '<b>x</b>' }, { kind: 'text', text: '' }],
      controls: [
        { kind: 'button', label: 'No id' },
        { kind: 'button', id: 'x1', label: 'Bad id' },
        { kind: 'button', id: 's9', label: '' },
        { kind: 'button', id: 's4', label: 'Odd icon', icon: '<svg onload=x>', variant: 'primary"' },
        { kind: 'select', id: 's5', label: 'Empty', options: [] },
      ],
      theme: 'purple',
    });
    expect(h).toEqual({ context: [], controls: [{ kind: 'button', id: 's4', label: 'Odd icon' }], theme: 'system', busy: false });
    expect(sanitizeHeader(null)).toBeNull();
    expect(sanitizeHeader('a header')).toBeNull();
    // bounded: at most 40 items, words at most 160 characters
    const many = sanitizeHeader({ controls: Array.from({ length: 100 }, (_, i) => ({ kind: 'text', text: 'x'.repeat(500) + i })) });
    expect(many?.controls).toHaveLength(40);
    expect(many?.controls[0].text).toHaveLength(160);
  });

  it('passes on only a press or a choice, of a control it described', () => {
    expect(sanitizeCommand({ id: 's2', action: 'click' })).toEqual({ id: 's2', action: 'click' });
    expect(sanitizeCommand({ id: 's3', action: 'select', value: 'dark' })).toEqual({ id: 's3', action: 'select', value: 'dark' });
    expect(sanitizeCommand({ id: 's3', action: 'select', value: 'x"]' })).toBeNull();
    expect(sanitizeCommand({ id: 'a"]', action: 'click' })).toBeNull();
    expect(sanitizeCommand({ id: 's2', action: 'eval' })).toBeNull();
    expect(sanitizeCommand(null)).toBeNull();
  });

  it("answers only edit mode, on the app's own dev server", () => {
    expect(isEditMode('http://localhost:4321/_edit/articles/', 'http://localhost:4321')).toBe(true);
    expect(isEditMode('http://localhost:4321/', 'http://localhost:4321')).toBe(false);
    expect(isEditMode('http://localhost:9999/_edit/', 'http://localhost:4321')).toBe(false);
    expect(isEditMode('app://ui/frame.html', 'http://localhost:4321')).toBe(false);
    expect(isEditMode('not a url', 'http://localhost:4321')).toBe(false);
  });
});
