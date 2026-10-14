/**
 * An engine release (documentation/desktop/plan.md, stage 6, 6.1): it holds the site's code and the
 * starter, and nothing from the owner's content, private pages, own mode, asset sources, documentation,
 * tests or secrets' addresses.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain JavaScript script
import { engineFiles, EXCLUDE } from '../../scripts/pack-engine.mjs';

const ROOT = join(__dirname, '../..');
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const files: string[] = engineFiles(tracked);

describe('an engine release', () => {
  it('holds what a site needs to build', () => {
    for (const f of ['package.json', 'package-lock.json', 'astro.config.mjs', 'src/pages/index.astro', 'src/site/content/schema.ts', 'integrations/site-only.mjs', 'integrations/seal.mjs', 'scripts/verify-sealed.mjs', 'starter/content/site.json', 'public/favicon.svg', 'contact-api/src/rules.mjs']) expect(files, f).toContain(f);
    expect(files.filter((f) => f.startsWith('contact-api/'))).toEqual(['contact-api/src/rules.mjs']);
  });

  it("holds nothing of the owner's, and no tests, docs or asset sources", () => {
    const leaked = files.filter((f) => EXCLUDE.some((p: string) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
    expect(leaked).toEqual([]);
    expect(files.some((f) => f.startsWith('content/') || f.startsWith('private-pages/') || f === '.env')).toBe(false);
  });

  it('decides by prefix and exact name', () => {
    expect(engineFiles(['content/site.json', 'src/a.ts', 'scripts/serve.ps1', 'scripts/verify-sealed.mjs', '.env', '.env.test', 'starter/content/site.json'])).toEqual(['scripts/verify-sealed.mjs', 'src/a.ts', 'starter/content/site.json']);
  });
});
