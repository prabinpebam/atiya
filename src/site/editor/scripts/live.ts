/**
 * Edit mode, live (documentation/editor/spec.md §2.1), for every screen but the article editor (which
 * saves as you go and brings changes in itself, scripts/editor.ts):
 * - a form (or a field saved on its own) typed in and not saved yet is unsaved input: the save status
 *   says so, and leaving asks first (searching isn't);
 * - a change made elsewhere (another tab, a file changed by hand) shows at once: the screen is rendered
 *   again from the server (its `screen` region, with the top bar's counts). With unsaved input, a text
 *   field in use or a dialog open, the screen keeps what's being typed, says it's behind, and catches up
 *   once that's saved, put away or left.
 */
import { announce, onContentChange, saveStatus, swapRegions } from './client';

const UNSAVED = 'Unsaved changes: save them to keep them';

export function initLive(app: HTMLElement, signal: AbortSignal) {
  if (app.dataset.screen === 'article') return;
  const on = (type: string, fn: (e: Event) => void, capture = false) => app.addEventListener(type, fn, { signal, capture });
  const unsaved = () => [...app.querySelectorAll<HTMLElement>('main [data-unsaved]')];
  // a text field in use: what's in it may be about to change, so the screen isn't drawn again under it
  const typingIn = () => {
    const el = document.activeElement;
    return !!el && !!el.closest('main') && (el.matches('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') || (el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file'].includes(el.type)));
  };
  let behind = false;
  // a click or a key just now: the person is doing something here, so the screen isn't drawn again under them
  let touchedAt = 0;
  const acting = () => Date.now() - touchedAt < 1000;
  const busy = () => unsaved().length > 0 || typingIn() || acting() || !!app.querySelector('dialog[open]');
  on('pointerdown', () => (touchedAt = Date.now()), true);
  on('keydown', () => (touchedAt = Date.now()), true);

  // ---------- unsaved input ----------
  const touched = (e: Event) => {
    const field = e.target as HTMLElement;
    // searching isn't a change to save
    if (!field.closest?.('main') || (field instanceof HTMLInputElement && field.type === 'search')) return;
    // a form's input is the form's; a field on its own (a label saved with Enter) is its own
    (field.closest('form') ?? field).dataset.unsaved = '';
    saveStatus.dirty(UNSAVED);
  };
  on('input', touched);
  on('change', touched);
  // a dialog put away (Cancel, Escape) drops what was typed in it
  on(
    'close',
    (e) => {
      (e.target as Element).querySelectorAll?.('[data-unsaved]').forEach((f) => delete (f as HTMLElement).dataset.unsaved);
      settle();
    },
    true,
  );
  // after a save the screen is rendered again: what's left unsaved is what's still there
  document.addEventListener('astro:page-load', () => settle(), { signal });
  // leaving a field may be the moment to catch up
  on('focusout', () => window.setTimeout(() => behind && settle(), 0));

  function settle() {
    if (unsaved().length) return;
    saveStatus.clean();
    if (behind && !typingIn()) void refresh();
  }

  // ---------- changes made elsewhere ----------
  let soon = 0;
  onContentChange(() => {
    clearTimeout(soon);
    soon = window.setTimeout(() => void refresh(), 200);
  }, signal);

  async function refresh() {
    const region = app.querySelector('[data-region="screen"]');
    if (!region) return;
    if (unsaved().length || typingIn() || app.querySelector('dialog[open]')) {
      if (!behind) announce('Changed elsewhere. Your unsaved changes here are kept: save or cancel them to see it.');
      behind = true;
      return;
    }
    // a click or a key just now: try again in a moment
    if (acting()) {
      behind = true;
      clearTimeout(soon);
      soon = window.setTimeout(() => void refresh(), 1000);
      return;
    }
    const focused = document.activeElement as HTMLElement | null;
    const id = focused && region.contains(focused) ? focused.id : '';
    const next = await swapRegions(['screen'], location.href, busy);
    if (!next) {
      // busy by the time it came: a click retries in a moment; a field in use catches up when it's left
      behind = true;
      clearTimeout(soon);
      if (!unsaved().length && !typingIn()) soon = window.setTimeout(() => void refresh(), 1000);
      return;
    }
    behind = false;
    // the whole screen is drawn again: it has every change up to the server's generation now
    const gen = next.querySelector<HTMLElement>('[data-editor-app]')?.dataset.generation;
    if (gen) app.dataset.generation = gen;
    if (id) document.getElementById(id)?.focus({ preventScroll: true });
    announce('Updated with a change made elsewhere');
  }
}
