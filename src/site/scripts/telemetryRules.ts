/**
 * Telemetry's rules for the part that runs on every page (documentation/access/spec.md §9), pure so
 * they're unit-tested: whether to send anything at all (the opt-outs), and what's queued until PostHog
 * loads. How links and videos are described, and what may leave the browser, is
 * scripts/telemetrySanitize.ts, in PostHog's chunk.
 */

/** Stored on a device that opted out with `?telemetry=off` (and cleared by `?telemetry=on`). */
export const OPT_OUT_KEY = 'site.telemetry';

/** `open`: PostHog's own capture. `allowlist`: a protected page, the Sign in page, or a page showing shared cards. */
export type PageMode = 'open' | 'allowlist';

/** What happened on the page, queued by scripts/telemetry.ts until PostHog's chunk has loaded, then run by it. */
export type Queued =
  | { kind: 'capture'; event: string; props: Record<string, unknown>; beacon?: boolean }
  | { kind: 'identify'; grant: string }
  | { kind: 'reset' }
  | { kind: 'pageview' }
  | { kind: 'allowlist' }
  /** A link followed on an allowlisted page: the client sends it as `access_link`. */
  | { kind: 'link'; href: string; here: string }
  /** A video started: the client sends it as `video_played`. */
  | { kind: 'video'; src: string; place: string; open: boolean };

/** What this page is, as `before_send` needs it. */
export interface PageFacts {
  mode: PageMode;
  /** `<html data-access>`: locked or private, on a protected page. */
  access?: string;
  /** The Sign in page (or a page whose only protected part is a sign-in panel). */
  signIn: boolean;
  /** The page's origin and path, without its query or fragment. */
  origin: string;
  pathname: string;
}

export interface OptOutSignals {
  /** `navigator.globalPrivacyControl`. */
  gpc?: boolean;
  /** `navigator.doNotTrack` (or `window.doNotTrack`). */
  dnt?: string | null;
  /** The page's query string. */
  search: string;
  /** What `OPT_OUT_KEY` holds on this device. */
  stored: string | null;
}

/** What the opt-outs say, and what to store: `off` and `on` in the address change the device's choice. */
export function optOut(s: OptOutSignals): { off: boolean; store: 'off' | null | undefined } {
  const q = new URLSearchParams(s.search).get('telemetry');
  const store = q === 'off' ? 'off' : q === 'on' ? null : undefined;
  const choice = store === undefined ? s.stored : store;
  const off = s.gpc === true || s.dnt === '1' || s.dnt === 'yes' || choice === 'off';
  return { off, store };
}
