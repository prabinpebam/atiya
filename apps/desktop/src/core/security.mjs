// @ts-check
/**
 * The app's rules for its views (documentation/desktop/spec.md §7.2, §8): their web preferences, which
 * navigations stay in the window, and which callers the bridge answers. Pure.
 */

/** The app's own pages' origin. */
export const APP_ORIGIN = 'app://ui';

/**
 * Every view's web preferences: sandboxed, isolated, no Node. Only the app's own pages get the preload.
 * @param {{ preload?: string }} [o]
 */
export function viewPreferences(o = {}) {
  return {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
    ...(o.preload ? { preload: o.preload } : {}),
  };
}

/** @param {string} url */
export function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'app:' ? `app://${u.host}` : u.origin;
  } catch {
    return null;
  }
}

/**
 * May a view showing `from` navigate to `to` in place? Only within its own origin, or between the app's
 * pages and the dev server it was given (setup hands over to edit mode). Everything else opens outside.
 * @param {string} from
 * @param {string} to
 * @param {string[]} [allowed] extra origins the view may load (the dev server's)
 */
export function staysInWindow(from, to, allowed = []) {
  const target = originOf(to);
  if (!target) return false;
  if (target === originOf(from)) return true;
  return allowed.includes(target);
}

/** Only these open in the system browser. @param {string} url */
export function isExternalSafe(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** The bridge answers only the app's own pages. @param {string | undefined | null} senderUrl */
export function isBridgeCaller(senderUrl) {
  return !!senderUrl && originOf(senderUrl) === APP_ORIGIN;
}
