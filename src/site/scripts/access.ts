/**
 * Loads the sign-in runtime (scripts/sealed.ts) only where it's needed (documentation/access/spec.md §7;
 * benchmark QB7): a page with something sealed or a sign-in panel, a magic link, or any page while signed
 * in on this device (the head's inline script marks that before the first paint). Every other page pays
 * for this check alone.
 */
import { onEveryPage } from './page';

export function startAccess(): void {
  onEveryPage(() => {
    const d = document;
    const needed =
      d.documentElement.dataset.signedIn !== undefined || !!d.querySelector('template[data-sealed], [data-unlock-panel], [data-access-gate], [data-sealed-cards]') || /(^#|&)a=/.test(location.hash);
    if (needed) void import('./sealed').then((m) => m.start());
  });
}
