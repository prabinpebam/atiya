/**
 * The Planet screen (documentation/sections/spec.md §7.4): what a move on the board writes (a page into a
 * building, at its place, or off the planet), and each building's settings. Each change is one store
 * transaction (PUT planet, with its version), checked against the content contract: a page on the planet
 * must be on the site (V13), in one building at most (V15). A refusal says why, on the board or in the form.
 */
import { api, announce, describeIssue } from './client';
import { putIn, takeOff, updatePlace } from '../model/planet';
import type { BoardMove } from './board';
import type { PlaceId, PlanetStructure } from '../../content/schema';

const PLANET = '/content/structures/planet.json';
const FOCUS = 'editor.planet.focus';

export function initPlanet(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-planet-state]')?.textContent ?? '{}') as { planet: PlanetStructure; version: string };
  const board = document.querySelector<HTMLElement>('[data-board]');
  const say = (form: Element | null, text: string) => {
    const p = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
    if (p) {
      p.textContent = text;
      p.hidden = !text;
    } else board?.dispatchEvent(new CustomEvent('board:issue', { detail: text }));
  };

  /** Saves the planet; on success the screen reloads, with the focus on focus (a selector). */
  const put = async (next: PlanetStructure, focus?: string, form?: Element | null) => {
    announce('Saving\u2026');
    const r = await api('PUT', 'planet', { planet: next, ifMatch: { [PLANET]: state.version } });
    if (r.ok) {
      if (focus) sessionStorage.setItem(FOCUS, focus);
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    announce(`Not saved: ${why}`, 'negative');
    say(form ?? null, why);
  };

  // ---------- a page moved on the board ----------
  board?.addEventListener(
    'board:move',
    (e) => {
      const m = (e as CustomEvent<BoardMove>).detail;
      const next = m.to === '_off' ? takeOff(state.planet, m.page) : putIn(state.planet, m.to as PlaceId, m.page, m.index);
      void put(next, `[data-board-grip="${m.page}"]`);
    },
    { signal },
  );

  // ---------- a building's words, view and section ----------
  root.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      const place = form.dataset.planetPlace as PlaceId | undefined;
      if (!place) return;
      e.preventDefault();
      const d = new FormData(form);
      const get = (k: string) => String(d.get(k) ?? '').trim();
      const title = get('title');
      const kicker = get('kicker');
      const summary = get('summary');
      if (!title || !kicker || !summary) return say(form, 'A building needs its name, what it holds and a summary.');
      if (summary.length > 160) return say(form, 'The summary is at most 160 characters.');
      const view = get('view');
      void put(
        updatePlace(state.planet, place, { title, kicker, summary, ...(view === 'list' || view === 'tiles' || view === 'bento' ? { view } : {}), site: get('site') }),
        `[data-dialog-open="place-settings-${place}"]`,
        form,
      );
    },
    { signal },
  );

  // back where the last change left off
  const last = sessionStorage.getItem(FOCUS);
  if (last) {
    sessionStorage.removeItem(FOCUS);
    document.querySelector<HTMLElement>(last)?.focus();
  }
}
