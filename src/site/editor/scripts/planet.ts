/**
 * The Planet screen (documentation/sections/spec.md §7.4): each building's settings, its words and the
 * section it shows. Its pages are its section's, so they move in Sections, never here. Each change is one
 * store transaction (PUT planet, with its version), checked against the content contract: a building shows
 * a section of the site (V16), and a section is shown by one building at most (V15). A refusal says why, in
 * the form.
 */
import { api, describeIssue, saveStatus } from './client';
import { updatePlace } from '../model/planet';
import type { PlaceId, PlanetStructure } from '../../content/schema';

const PLANET = '/content/structures/planet.json';
const FOCUS = 'editor.planet.focus';

export function initPlanet(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-planet-state]')?.textContent ?? '{}') as { planet: PlanetStructure; version: string };
  const on = (type: string, fn: (e: Event) => void) => root.addEventListener(type, fn, { signal });
  const say = (form: Element | null, text: string) => {
    const p = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
    if (p) {
      p.textContent = text;
      p.hidden = !text;
    } else root.dispatchEvent(new CustomEvent('manager:issue', { detail: text }));
  };

  /** Saves the planet; on success the screen reloads, with the focus on `focus` (a selector) and `notice` announced. */
  const put = async (next: PlanetStructure, o: { focus?: string; form?: Element | null; notice?: string } = {}) => {
    saveStatus.saving();
    const r = await api('PUT', 'planet', { planet: next, ifMatch: { [PLANET]: state.version } });
    if (r.ok) {
      if (o.focus) sessionStorage.setItem(FOCUS, o.focus);
      saveStatus.carry(o.notice ?? 'Saved');
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    saveStatus.failed(`Not saved: ${why}`);
    say(o.form ?? null, why);
  };

  // ---------- a building's words and section ----------
  on('submit', (e) => {
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
    const site = get('site');
    if (!site) return say(form, 'A building needs the section it shows.');
    void put(updatePlace(state.planet, place, { title, kicker, summary, site }), {
      focus: `[data-planet-place="${place}"] button[type="submit"]`,
      form,
      notice: `Saved ${title}`,
    });
  });

  // back where the last change left off (the status says what it was)
  const last = sessionStorage.getItem(FOCUS);
  sessionStorage.removeItem(FOCUS);
  if (last) document.querySelector<HTMLElement>(last)?.focus();
}
