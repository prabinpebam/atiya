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
}
