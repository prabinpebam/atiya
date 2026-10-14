import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { engineFiles, INCLUDE } from '../../scripts/pack-engine.mjs';

const wf = (name: string) => readFileSync(`.github/workflows/${name}`, 'utf8').replace(/\r\n/g, '\n');
/** The steps' names and their run lines, roughly: enough to hold what a workflow does. */
const runs = (y: string) => y.split('\n').filter((l) => /^\s+run:|^\s{10,}\S/.test(l)).join('\n');

describe('one engine, two builds (desktop plan stage 10)', () => {
  it('both published builds, and their rehearsal, build and check only through scripts/build-site.mjs', () => {
    for (const name of ['deploy.yml', 'site-build.yml']) {
      const y = wf(name);
      expect(y, name).toMatch(/run: node scripts\/build-site\.mjs\n/);
      expect(runs(y), name).not.toMatch(/astro build|npm run build|verify-sealed|size-report/);
    }
    const local = readFileSync('scripts/site-build-local.mjs', 'utf8');
    expect(local).toContain("'scripts/build-site.mjs'");
    expect(local).not.toMatch(/'build'\]|verify-sealed\.mjs'\]|size-report\.mjs'/);
  });

  it('every engine release carries the build script and what it runs', () => {
    expect(INCLUDE).toContain('scripts/build-site.mjs');
    expect(engineFiles(['scripts/build-site.mjs', 'scripts/build-parity.mjs', 'scripts/lib/parity.mjs', 'integrations/features.mjs', 'integrations/services.mjs'])).toEqual(['integrations/features.mjs', 'integrations/services.mjs', 'scripts/build-site.mjs']);
  });

  it("the live deploy keeps its triggers, schedule, permissions, secret, concurrency, Pages steps and deploy gate", () => {
    const y = wf('deploy.yml');
    for (const line of [
      'branches: [main]',
      'workflow_dispatch:',
      "- cron: '45 18 * * *'",
      'pages: write',
      'id-token: write',
      'group: pages',
      'cancel-in-progress: false',
      'PRIVATE_CONTENT_KEY: ${{ secrets.PRIVATE_CONTENT_KEY }}',
      'run: npm ci',
      'uses: actions/configure-pages@v6',
      'SITE_URL: ${{ steps.pages.outputs.origin }}',
      'BASE_PATH: ${{ steps.pages.outputs.base_path }}',
      'uses: actions/upload-pages-artifact@v5',
      "if: github.ref == 'refs/heads/main'",
      'uses: actions/deploy-pages@v5',
      'run: node scripts/activity-guard.mjs',
    ])
      expect(y).toContain(line);
    // the site's services are content now: no variable can point the live site elsewhere
    expect(y).not.toMatch(/PUBLIC_POSTHOG|PUBLIC_CONTACT|vars\./);
  });

  it('CI runs the parity check beside the deploy, never in its way, and the release runs it on the starter', () => {
    const p = wf('parity.yml');
    expect(p).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(p).toContain('workflow_dispatch:');
    expect(p).toContain('run: node scripts/build-parity.mjs --install');
    expect(p).not.toMatch(/deploy-pages|pages: write|id-token/);
    expect(wf('deploy.yml')).not.toContain('parity');
    expect(wf('release.yml')).toMatch(/run: \|?\s*\n?\s*node scripts\/build-parity\.mjs --starter/);
  });
});
