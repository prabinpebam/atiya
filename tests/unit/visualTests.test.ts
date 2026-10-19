import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The screenshot tests cover what they should (documentation/site-ui/design-system-review.md WS1): the visual
 * project runs on its own, finds every story itself, and a baseline exists for every story once they've been
 * made. Baselines change only through `npm run visual:update` (scripts/visual-update.mjs).
 */
const ROOT = process.cwd();
const config = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8');
const spec = readFileSync(join(ROOT, 'tests/e2e/visual.spec.ts'), 'utf8');
const slug = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

describe('screenshot tests', () => {
  it('have their own project, which a plain run of the site or edit mode never includes', () => {
    expect(config).toMatch(/name: 'visual',\s*testMatch: VISUAL_SPECS/);
    expect(config).toMatch(/name: 'chromium',\s*testIgnore: \[EDITOR_SPECS, VISUAL_SPECS\]/);
    // visual-editor.spec.ts ends in editor.spec.ts: the editor project must leave it to the visual one
    expect(config).toMatch(/name: 'editor',\s*testMatch: EDITOR_SPECS,\s*testIgnore: VISUAL_SPECS/);
    expect(config).toMatch(/snapshotPathTemplate: '\{testDir\}\/__screenshots__\/\{testFilePath\}\/\{arg\}-\{platform\}\{ext\}'/);
  });

  it('find the stories on disk, in light and dark at three widths, with animations off', () => {
    expect(spec).toMatch(/readdirSync\(join\(ROOT, 'src\/site\/stories'\)\)/);
    expect(spec).toMatch(/WIDTHS = \[360, 768, 1280\]/);
    expect(spec).toMatch(/MODES = \['light', 'dark'\]/);
    expect(spec).toMatch(/animations: 'disabled'/);
  });

  it('have a baseline for every story and key page, once baselines exist', () => {
    const dir = join(ROOT, 'tests/e2e/__screenshots__/visual.spec.ts');
    if (!existsSync(dir)) return;
    const files = new Set(readdirSync(dir));
    const stories = readdirSync(join(ROOT, 'src/site/stories')).filter((f) => f.endsWith('.stories.astro')).map((f) => f.replace('.stories.astro', ''));
    const missing = stories.filter((s) => ![...files].some((f) => f.startsWith(`${slug(s)}-1-light-1280-`)));
    expect(missing).toEqual([]);
    for (const page of [...spec.matchAll(/\{ name: '([\w-]+)', path: /g)].map((m) => m[1])) expect([...files].some((f) => f.startsWith(`page-${page}-dark-360-`)), page).toBe(true);
  });

  it('change only through npm run visual:update, which says what changed', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    expect(pkg.visual).toMatch(/--project=visual/);
    expect(pkg['visual:update']).toBe('node scripts/visual-update.mjs');
    expect(readFileSync(join(ROOT, 'scripts/visual-update.mjs'), 'utf8')).toMatch(/--update-snapshots[\s\S]*git', \['status', '--porcelain'/);
  });
});
