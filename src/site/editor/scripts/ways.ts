/**
 * The Ways to explore screen (plan stage 8A): one Save writes the ways file (PUT ways, with its version),
 * checked by the content contract (V33 to V37). The home page's first offer follows the switches as they
 * change. Turning a way on or off restarts the dev server (what's built is decided at its start), so the
 * screen waits for the new server, saying so, before it shows the result.
 */
import { api, editorUrl, refused, saveStatus, startTask } from './client';
import { setMode, setPrimary } from '../model/ways';
import type { Ways } from '../../modes/contract';

const FOCUS = 'editor.ways.focus';
/** How long a restart may take before the screen gives up waiting and says so. */
const RESTART_WAIT_MS = 90_000;

/** The dev server's start mark (null while it's away). */
async function started(): Promise<string | null> {
  try {
    const r = await fetch(editorUrl('__warm'), { cache: 'no-store', headers: { 'X-Editor-Warm': '1' } });
    return r.ok ? (((await r.json()) as { started?: string }).started ?? null) : null;
  } catch {
    return null;
  }
}

export function initWays(form: HTMLFormElement, signal: AbortSignal) {
  const state = JSON.parse(form.querySelector('[data-editor-ways-state]')?.textContent ?? '{}') as { ways: Ways; version: string | null; mounts: Record<string, string> };
  const on = (type: string, fn: (e: Event) => void) => form.addEventListener(type, fn, { signal });
  const issue = form.querySelector<HTMLElement>('[data-editor-form-issue]');
  const say = (text: string) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
  };
  const modes = () => [...form.querySelectorAll<HTMLInputElement>('input[name="mode"]')];
  const primaries = () => [...form.querySelectorAll<HTMLInputElement>('input[name="primary"]')];

  /** Only a way that's on can be the home page's first offer: the others are disabled, and the site takes over. */
  const follow = () => {
    const onNow = new Set(modes().filter((m) => m.checked).map((m) => m.value));
    for (const r of primaries()) {
      if (r.value === 'site') continue;
      r.disabled = !onNow.has(r.value);
      if (r.disabled && r.checked) primaries().find((x) => x.value === 'site')!.checked = true;
    }
  };

  on('change', () => {
    follow();
    say('');
    saveStatus.dirty('Ways to explore');
  });

  on('submit', async (e) => {
    e.preventDefault();
    let next = state.ways;
    for (const m of modes()) next = setMode(next, m.value, m.checked, state.mounts[m.value] ?? m.value);
    next = setPrimary(next, primaries().find((r) => r.checked)?.value ?? 'site');
    const wasOn = new Set(state.ways.modes.filter((m) => m.on).map((m) => m.id));
    const nowOn = new Set(next.modes.filter((m) => m.on).map((m) => m.id));
    const restarts = wasOn.size !== nowOn.size || [...nowOn].some((id) => !wasOn.has(id));
    const before = restarts ? await started() : null;
    saveStatus.saving();
    const r = await api('PUT', 'ways', { ways: next, ifMatch: { '/content/structures/ways.json': state.version } });
    if (!r.ok) {
      const why = refused(r, "The change wasn't saved.");
      saveStatus.failed(`Not saved: ${why}`);
      say(why);
      return;
    }
    sessionStorage.setItem(FOCUS, '[data-editor-ways] button[type="submit"]');
    // saved: said now, so whichever reload comes first (the dev server's own, after its restart, or this one) says so
    saveStatus.carry('Saved ways to explore');
    if (restarts) {
      // the server starts again to build what's on now: wait for the new one, then show it
      const task = startTask('Starting the site again with the new ways to explore', { el: form, busyLabel: 'Starting the site again' });
      performance.mark('editor:ways-restart:start');
      const end = Date.now() + RESTART_WAIT_MS;
      let now: string | null = before;
      while (Date.now() < end && (now === before || now === null)) {
        await new Promise((res) => setTimeout(res, 500));
        now = await started();
      }
      // the new server can still be settling as it first answers: wait until its mark holds steady
      for (let steady = 0; steady < 2 && Date.now() < end && now !== before && now !== null; ) {
        await new Promise((res) => setTimeout(res, 500));
        const again = await started();
        steady = again === now ? steady + 1 : 0;
        now = again;
      }
      performance.measure('editor:ways-restart', 'editor:ways-restart:start');
      void task.done();
      if (now === before || now === null) {
        saveStatus.failed('Saved, but the site is taking long to start again: reload this page in a moment.');
        return;
      }
    }
    location.reload();
  });

  follow();
  const last = sessionStorage.getItem(FOCUS);
  sessionStorage.removeItem(FOCUS);
  if (last) document.querySelector<HTMLElement>(last)?.focus();
}
