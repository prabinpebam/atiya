// @ts-check
/**
 * The Content Security Policy's scripts (src/site/services/csp.ts): once the build has written its pages, every
 * inline script any page runs is hashed, and every page's policy allows those hashes instead of
 * `'unsafe-inline'`. One list for the whole site, since the client-side router keeps the first page's policy
 * while it swaps in others. It runs before the sealer, so a private page's own inline scripts (re-created when
 * it opens: scripts/sealed.ts `activateScripts`) are hashed while they're still readable; only hashes are
 * written, never their text. A page some other part of the build wrote without the policy (Astro's own
 * redirect pages) gets it here, and scripts/verify-sealed.mjs then checks every page. The docs (Slate) are
 * their own site, out of its scope. Build only.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineScripts, policyIn, referrerPolicy, withScriptHashes } from '../src/site/services/csp.ts';

/** An inline script's hash as a policy names it (without the quotes). @param {string} text */
export const scriptHash = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

/** The site's pages: every HTML file but the docs'. @param {string} dist */
export const sitePages = (dist) => walk(dist).filter((f) => f.endsWith('.html') && !relative(dist, f).split(sep).join('/').startsWith('docs/'));

const escapeAttr = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Every page's policy with the site's script hashes, and the two meta tags put on a page that has none. Pure.
 * @param {Map<string, string>} pages file → HTML @param {string} policy the build's policy, before hashes
 * @returns {{ pages: Map<string, string>, hashes: number, added: number }}
 */
export function finishPolicies(pages, policy) {
  const hashes = new Set([...pages.values()].flatMap((html) => inlineScripts(html).map(scriptHash)));
  const finished = withScriptHashes(policy, [...hashes]);
  const tag = `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(finished)}">`;
  const out = new Map();
  let added = 0;
  for (const [file, html] of pages) {
    const current = /<meta\b[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/i.exec(html)?.[0];
    if (current) out.set(file, html.replace(current, tag));
    else {
      added++;
      const metas = `${tag}<meta name="referrer" content="${referrerPolicy(false)}">`;
      const anchor = /<meta charset=[^>]*>/i.exec(html) ?? /<head\b[^>]*>/i.exec(html) ?? /<!doctype[^>]*>/i.exec(html);
      const at = anchor ? anchor.index + anchor[0].length : 0;
      out.set(file, html.slice(0, at) + metas + html.slice(at));
    }
  }
  return { pages: out, hashes: hashes.size, added };
}

/** @returns {import('astro').AstroIntegration} */
export default function csp() {
  return {
    name: 'site-csp',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const files = sitePages(dist);
        const pages = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
        // the build's policy, as the services made it (every page that has one carries the same)
        const policy = [...pages.values()].map(policyIn).find(Boolean);
        if (!policy) {
          logger.warn('No page carries a Content Security Policy: none was added.');
          return;
        }
        const done = finishPolicies(pages, policy);
        for (const [f, html] of done.pages) if (html !== pages.get(f)) writeFileSync(f, html);
        logger.info(`${files.length} pages carry the policy, with ${done.hashes} inline script hash${done.hashes === 1 ? '' : 'es'}${done.added ? ` (${done.added} added here)` : ''}.`);
      },
    },
  };
}
