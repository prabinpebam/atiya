// @ts-check
/**
 * The site's services (documentation/desktop/spec.md §6.3, §6.4): the contact form's endpoint and the telemetry
 * key are content, `services` in content/site.json, so the owner's site, built from source, and a managed site,
 * built from an engine release, read them from the same place. This makes them the build's
 * `PUBLIC_CONTACT_ENDPOINT`, `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`, which the pages read as before.
 *
 * - A `--mode test` build never reads them: its endpoint is .env.test's made-up host, and telemetry has its own
 *   test switch, so a test can never reach the real services.
 * - The telemetry key is used only in a build for the address it names (`services.telemetry.site`, compared with
 *   `SITE_URL` and `BASE_PATH`, which both workflows set): a production build on this computer, its preview, a
 *   benchmark, and a copy of the site published anywhere else never send to the owner's project.
 * - Otherwise the content wins over the environment, so a variable left in a terminal can't point a build elsewhere.
 * - A build's Content Security Policy is made from the same settings (`PUBLIC_CSP`, src/site/services/csp.ts), so it
 *   allows exactly the services the site uses; dev has none.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { astroMode } from './roots.mjs';
import { cspPolicy, POSTHOG_DEFAULT, TEST_TELEMETRY } from '../src/site/services/csp.ts';

/** The variables the services become. */
export const SERVICE_VARS = ['PUBLIC_CONTACT_ENDPOINT', 'PUBLIC_POSTHOG_KEY', 'PUBLIC_POSTHOG_HOST', 'PUBLIC_COUNTS'];

/**
 * What the build's variables are, from the site's settings. Pure.
 * @param {any} site content/site.json, or null
 * @param {{ command: string, mode?: string, siteUrl?: string, base?: string }} o
 * @returns {Record<string, string> | null} null: leave them to the environment (a test build)
 */
export function serviceVars(site, { command, mode, siteUrl, base }) {
  if (mode === 'test') return null;
  const s = site?.services ?? {};
  const forHere = (/** @type {string | undefined} */ site) => command === 'build' && !!siteUrl && !!site && sameAddress(site, siteUrl, base);
  const published = forHere(s.telemetry?.site);
  return {
    PUBLIC_CONTACT_ENDPOINT: s.contact?.endpoint ?? '',
    PUBLIC_POSTHOG_KEY: published ? (s.telemetry?.key ?? '') : '',
    PUBLIC_POSTHOG_HOST: published ? (s.telemetry?.host ?? '') : '',
    PUBLIC_COUNTS: countsVar(s, forHere(s.counts?.site ?? s.telemetry?.site)),
  };
}

/**
 * The other counting tools (desktop spec §9.5) as one variable, for the telemetry shim to load their own chunk:
 * a JSON list of `{ tool, …ids }` (`goatcounter`, `umami`, `ga4`, `clarity`), or '' (none, or a build for another
 * address). Clarity counts beside the site's tool and, without one, at the address of PostHog's. Pure.
 * @param {any} s services @param {boolean} here a build for the tools' address
 */
export function countsVar(s, here) {
  if (!here) return '';
  const c = s.counts;
  const tools = [
    ...(c?.kind === 'goatcounter' ? [{ tool: 'goatcounter', code: c.code }] : []),
    ...(c?.kind === 'umami' ? [{ tool: 'umami', id: c.id, ...(c.host ? { host: c.host } : {}) }] : []),
    ...(c?.kind === 'ga4' ? [{ tool: 'ga4', id: c.id }] : []),
    ...(s.clarity?.id ? [{ tool: 'clarity', id: s.clarity.id }] : []),
  ];
  return tools.length ? JSON.stringify(tools) : '';
}

/**
 * Why a published build leaves out a telemetry key the site has, or null: so a wrong address is said, never a
 * silent loss of telemetry. Only addresses, which are public. Pure.
 * @param {any} site content/site.json
 * @param {{ siteUrl?: string, base?: string }} o
 */
export function telemetryNote(site, { siteUrl, base }) {
  const t = site?.services?.telemetry;
  if (!t?.key || !siteUrl) return null;
  if (!t.site) return 'content/site.json has a telemetry key but no `site` address, so this build leaves it out: add the site\'s address to services.telemetry.site.';
  if (sameAddress(t.site, siteUrl, base)) return null;
  return `This build is for ${new URL((base ?? '/').replace(/^\/?/, '/'), siteUrl).href}, not ${t.site} (services.telemetry.site), so it leaves the telemetry key out.`;
}

/**
 * Is the build for this address? `https://ada.github.io/` and `https://ada.github.io` with base `/` are, and
 * `https://ada.github.io/atiya/` is `https://ada.github.io` with base `/atiya`. Pure.
 * @param {string} address @param {string} siteUrl @param {string} [base]
 */
export function sameAddress(address, siteUrl, base = '/') {
  try {
    const norm = (/** @type {URL} */ u) => `${u.origin}${u.pathname.replace(/\/?$/, '/')}`;
    return norm(new URL(address)) === norm(new URL(base.replace(/^\/?/, '/'), siteUrl));
  } catch {
    return false;
  }
}

/**
 * The site's Content Security Policy for a build (src/site/services/csp.ts), from the same settings as the
 * variables, or '' in dev (Vite needs inline modules, eval and a websocket). A test build allows its made-up
 * hosts only, so the E2E tests run under the policy. Its scripts are `'unsafe-inline'` here, swapped for the
 * build's inline scripts' hashes once the pages are written (integrations/csp.mjs). Pure.
 * @param {any} site content/site.json, or null
 * @param {Record<string, string> | null} vars what serviceVars made (null: a test build)
 * @param {{ command: string, testEndpoint?: string }} o
 */
export function cspVar(site, vars, { command, testEndpoint }) {
  if (command !== 'build') return '';
  if (!vars) return cspPolicy({ contactEndpoint: testEndpoint, telemetryHost: TEST_TELEMETRY });
  /** @type {any[]} */
  let counts = [];
  try {
    counts = vars.PUBLIC_COUNTS ? JSON.parse(vars.PUBLIC_COUNTS) : [];
  } catch {
    // countsVar wrote it: always JSON
  }
  return cspPolicy({
    contact: site?.services?.contact,
    contactEndpoint: vars.PUBLIC_CONTACT_ENDPOINT,
    telemetryHost: vars.PUBLIC_POSTHOG_KEY ? vars.PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT : undefined,
    counts,
  });
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
        const mode = astroMode();
        const vars = serviceVars(site, { command, mode, siteUrl: process.env.SITE_URL, base: process.env.BASE_PATH });
        // the test build's endpoint, as its pages will read it (.env.test, unless the environment overrides it)
        const testEndpoint = vars ? undefined : loadEnv(mode ?? 'test', root, 'PUBLIC_').PUBLIC_CONTACT_ENDPOINT;
        const csp = cspVar(site, vars, { command, testEndpoint });
        updateConfig({ vite: { define: Object.fromEntries(Object.entries({ ...vars, PUBLIC_CSP: csp }).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])) } });
      },
    },
  };
}
