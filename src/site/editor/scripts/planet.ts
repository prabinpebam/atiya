/**
 * The Planet screen (documentation/sections/spec.md §7.4): every change to what the buildings hold. Each
 * change is one store transaction (PUT planet, with its version), checked against the content contract:
 * a page on the planet must be on the site (V13), and in one building at most (V15). A refusal says why.
 */
import { api, announce, describeIssue } from './client';
import { movePage, putIn, takeOff, updatePlace } from '../model/planet';
import type { PlaceId, PlanetStructure } from '../../content/schema';

const PLANET = '/content/structures/planet.json';
const FOCUS = 'editor.planet.focus';

export function initPlanet(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-planet-state]')?.textContent ?? '{}') as { planet: PlanetStructure; version: string };
  const say = (where: Element | null, text: string) => {
    const p = where?.querySelector<HTMLElement>('[data-editor-form-issue], [data-planet-issue]');
    if (!p) return;
    p.textContent = text;
    p.hidden = !text;
  };

  /** Saves the planet; on success the screen reloads, with the focus on `focus` (a selector). */
  const put = async (next: PlanetStructure, where: Element | null, focus?: string) => {
    announce('Saving\u2026');
    const r = await api('PUT', 'planet', { planet: next, ifMatch: { [PLANET]: state.version } });
    if (r.ok) {
      if (focus) sessionStorage.setItem(FOCUS, focus);
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    announce(`Not saved: ${why}`, 'negative');
    say(where, why);
  };

  // a building's own words, view and section
  root.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      const place = (form.dataset.planetPlace ?? form.dataset.planetAdd) as PlaceId | undefined;
      if (!place) return;
      e.preventDefault();
      const d = new FormData(form);
      const get = (k: string) => String(d.get(k) ?? '').trim();
      if (form.dataset.planetAdd) {
        const page = get('page');
        if (!page) return say(form.closest('[data-planet-card]'), 'Choose a page to add.');
        return void put(putIn(state.planet, place, page), form.closest('[data-planet-card]'), `[data-planet-card="${place}"] [data-planet-off="${page}"]`);
      }
      const title = get('title');
      const kicker = get('kicker');
      const summary = get('summary');
      if (!title || !kicker || !summary) return say(form, 'A building needs its name, what it holds and a summary.');
      if (summary.length > 160) return say(form, 'The summary is at most 160 characters.');
      const view = get('view');
      void put(
        updatePlace(state.planet, place, { title, kicker, summary, ...(view === 'list' || view === 'tiles' || view === 'bento' ? { view } : {}), site: get('site') }),
        form,
        `[data-planet-place="${place}"] button[type="submit"]`,
      );
    },
    { signal },
  );

  // a page: moved within its building, or taken off the planet
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const mv = t.closest<HTMLElement>('[data-planet-move]');
      if (mv) {
        const place = mv.dataset.place as PlaceId;
        const i = Number(mv.dataset.index);
        const by = mv.dataset.planetMove === 'up' ? -1 : 1;
        return void put(movePage(state.planet, place, i, by), mv.closest('[data-planet-card]'), `[data-planet-move="${mv.dataset.planetMove}"][data-place="${place}"][data-index="${i + by}"]`);
      }
      const off = t.closest<HTMLElement>('[data-planet-off]');
      if (off) return void put(takeOff(state.planet, off.dataset.planetOff!), off.closest('[data-planet-card]'), `[data-planet-put="${off.dataset.planetOff}"] [role="combobox"]`);
    },
    { signal },
  );

  // a page not on the planet, put in a building
  root.querySelectorAll<HTMLElement>('[data-planet-put]').forEach((sel) =>
    sel.addEventListener(
      'select-change',
      (e) => {
        const place = (e as CustomEvent<{ value: string }>).detail.value as PlaceId;
        const page = sel.dataset.planetPut!;
        if (place) void put(putIn(state.planet, place, page), sel.closest('section'), `[data-planet-card="${place}"] [data-planet-off="${page}"]`);
      },
      { signal },
    ),
  );

  // back where the last change left off
  const last = sessionStorage.getItem(FOCUS);
  if (last) {
    sessionStorage.removeItem(FOCUS);
    root.querySelector<HTMLElement>(last)?.focus();
  }
}
