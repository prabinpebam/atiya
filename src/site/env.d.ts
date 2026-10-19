/** Astro.locals on the design library's pages: the current story's example code, by title. */
declare namespace App {
  interface Locals {
    storyCode?: Record<string, string>;
  }
}

/** Telemetry's project (documentation/access/spec.md §9.5): Actions variables, public by design; a build without them sends nothing. */
interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG_KEY?: string;
  readonly PUBLIC_POSTHOG_HOST?: string;
  /** The other counting tools, for a build of the site's own address (integrations/services.mjs countsVar): a JSON list, or ''. */
  readonly PUBLIC_COUNTS?: string;
  /** A build's Content Security Policy (integrations/services.mjs cspVar, src/site/services/csp.ts), or '' in dev. */
  readonly PUBLIC_CSP?: string;
}
