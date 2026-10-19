#!/usr/bin/env node
/**
 * Rewrites the screenshot baselines on purpose (documentation/site-ui/design-system-review.md DS2-03) and lists
 * what changed: `npm run visual:update [-- <playwright args, e.g. -g "Button">]`. A baseline changes only this way;
 * review the listed images (git shows the before and after) before committing them.
 */
import { spawnSync } from 'node:child_process';

const DIR = 'tests/e2e/__screenshots__';
const extra = process.argv.slice(2);
const run = spawnSync(
  process.execPath,
  ['scripts/test-run.mjs', '--by', 'script', '--purpose', 'Update screenshot baselines', '--', '--project=visual', '--update-snapshots', '--reporter=line', ...extra],
  { stdio: 'inherit' },
);
const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', DIR], { encoding: 'utf8' }).stdout.trimEnd();
const changed = status ? status.split('\n') : [];
const label = { '??': 'new', ' M': 'changed', ' D': 'removed', M: 'changed', A: 'new', D: 'removed' };
console.log(`\n${changed.length} baseline${changed.length === 1 ? '' : 's'} changed:`);
for (const line of changed) console.log(`  ${label[line.slice(0, 2)] ?? label[line.slice(0, 2).trim()] ?? line.slice(0, 2)}  ${line.slice(3)}`);
process.exit(run.status ?? 1);
