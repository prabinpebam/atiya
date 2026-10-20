/**
 * Change view's choices and the home page's status (documentation/home-views/switcher.md §1, §3, §7, §8).
 * A choice is kept on this device; the next page says which view it shows, in a polite live region, and
 * tells telemetry the view, the lens and how the visitor got there: view IDs only, never text or an address.
 */
import { HOME_KEYS, homeEvents, type HomeChange } from './homeRoute';
import { startTelemetry, track } from './telemetry';

const storage = (kind: 'localStorage' | 'sessionStorage'): Storage | null => {
  try {
    return window[kind];
  } catch {
    return null;
  }
};
const put = (s: Storage | null, key: string, value: string) => {
  try {
    s?.setItem(key, value);
  } catch {}
};
const take = (s: Storage | null, key: string): string | null => {
  try {
    const v = s?.getItem(key) ?? null;
    s?.removeItem(key);
    return v;
  } catch {
    return null;
  }
};

/** Change view's choices: a card or Use the default keeps the choice; another way to explore keeps the mode. */
export function setupViewChoices(root: HTMLElement) {
  const from = document.documentElement.dataset.homeView ?? '';
  const local = storage('localStorage');
  const session = storage('sessionStorage');
  root.querySelectorAll<HTMLAnchorElement>('a[data-view-choice]').forEach((a) =>
    a.addEventListener('click', () => {
      const to = a.dataset.viewChoice!;
      put(local, HOME_KEYS.view, to);
      put(session, HOME_KEYS.changed, JSON.stringify({ from, to } satisfies HomeChange));
      put(session, HOME_KEYS.arrival, 'stored');
    }),
  );
  root.querySelector<HTMLAnchorElement>('a[data-view-default]')?.addEventListener('click', () => {
    try {
      local?.removeItem(HOME_KEYS.view);
    } catch {}
    put(session, HOME_KEYS.changed, JSON.stringify({ from, default: true } satisfies HomeChange));
    put(session, HOME_KEYS.arrival, 'default');
  });
  root.querySelectorAll<HTMLAnchorElement>('a[data-mode]').forEach((a) => a.addEventListener('click', () => put(local, 'site.mode', a.dataset.mode!)));
}

/** Once a home page is shown: the events, and "Showing the Bento view" in the status (when the page has one) after a change. */
export function homeStatus(status: HTMLElement | null) {
  const html = document.documentElement;
  const view = html.dataset.homeView;
  if (!view) return;
  const session = storage('sessionStorage');
  const arrival = take(session, HOME_KEYS.arrival);
  let changed: HomeChange | null = null;
  try {
    changed = JSON.parse(take(session, HOME_KEYS.changed) ?? 'null');
  } catch {}
  const { events, announce } = homeEvents({ view, at: html.dataset.homeAt ?? '', lens: html.dataset.homeLens ?? '' }, arrival, changed);
  startTelemetry();
  for (const [event, props] of events) track(event, props);
  // after a beat, so the live region is in the page before its words change
  if (announce && status) setTimeout(() => (status.textContent = `Showing the ${status.dataset.label} view`), 400);
}
