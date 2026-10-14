// @ts-check
/**
 * The site's services (documentation/desktop/spec.md §6.3, §6.4): the contact form's endpoint and the telemetry
 * key are content, `services` in content/site.json, so the owner's site, built from source, and a managed site,
 * built from an engine release, read them from the same place. This makes them the build's
 * `PUBLIC_CONTACT_ENDPOINT`, `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`, which the pages read as before.
 *
 * - A `--mode test` build never reads them: its endpoint is .env.test's made-up host, and telemetry has its own
 *   test switch, so a test can never reach the real services.
 * - The telemetry key is used only in a build for a published address (`SITE_URL` set, as both workflows do):
 *   a production build on this computer, its preview or a benchmark never sends anything.
 * - Otherwise the content wins over the environment, so a variable left in a terminal can't point a build elsewhere.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { astroMode } from './roots.mjs';

/** The variables the services become. */
export const SERVICE_VARS = ['PUBLIC_CONTACT_ENDPOINT', 'PUBLIC_POSTHOG_KEY', 'PUBLIC_POSTHOG_HOST'];

/**
 * What the build's variables are, from the site's settings. Pure.
 * @param {any} site content/site.json, or null
 * @param {{ command: string, mode?: string, siteUrl?: string }} o
 * @returns {Record<string, string> | null} null: leave them to the environment (a test build)
 */
export function serviceVars(site, { command, mode, siteUrl }) {
  if (mode === 'test') return null;
  const s = site?.services ?? {};
  const published = command === 'build' && !!siteUrl;
  return {
    PUBLIC_CONTACT_ENDPOINT: s.contact?.endpoint ?? '',
    PUBLIC_POSTHOG_KEY: published ? (s.telemetry?.key ?? '') : '',
    PUBLIC_POSTHOG_HOST: published ? (s.telemetry?.host ?? '') : '',
  };
}

/** @returns {import('astro').AstroIntegration} */
export default function services() {
  return {
    name: 'site-services',
    hooks: {
      'astro:config:setup': ({ config, command, updateConfig }) => {
        // a build reads content/; the dev server the folder it was given (CONTENT_ROOT, the editor's tests)
        const root = fileURLToPath(config.root);
        const contentRoot = command === 'dev' && process.env.CONTENT_ROOT ? resolve(root, process.env.CONTENT_ROOT) : join(root, 'content');
        const file = join(contentRoot, 'site.json');
        /** @type {any} */
        let site = null;
        try {
          site = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
        } catch {
          // not JSON: the content check names it, and the build fails there
        }
        const vars = serviceVars(site, { command, mode: astroMode(), siteUrl: process.env.SITE_URL });
        if (!vars) return;
        updateConfig({ vite: { define: Object.fromEntries(Object.entries(vars).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])) } });
      },
    },
  };
}
