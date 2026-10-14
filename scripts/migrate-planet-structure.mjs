#!/usr/bin/env node
/**
 * Moves Little planet's structure to the modes' folder (documentation/desktop/plan.md, stage 8, M1.1):
 * content/structures/planet.json → content/structures/modes/little-planet.json. Run it in a site's folder
 * (or give the content folder); it uses `git mv` when the folder is in git, so the history follows the file.
 * Running it twice changes nothing. Until a site runs it, the engine still reads the old place, with a warning.
 *
 *   node scripts/migrate-planet-structure.mjs [content folder]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const content = resolve(process.argv[2] ?? 'content');
const from = join(content, 'structures', 'planet.json');
const to = join(content, 'structures', 'modes', 'little-planet.json');

if (!existsSync(from)) {
  console.log(existsSync(to) ? 'Already moved: nothing to do.' : 'This site has no little planet: nothing to do.');
  process.exit(0);
}
if (existsSync(to)) {
  console.error(`Both ${from} and ${to} exist: keep the second, delete the first, then run this again.`);
  process.exit(1);
}
mkdirSync(dirname(to), { recursive: true });
let tracked = false;
try {
  execFileSync('git', ['-C', content, 'ls-files', '--error-unmatch', from], { stdio: 'ignore' });
  tracked = true;
} catch {
  // not in git, or not tracked: a plain move
}
if (tracked) execFileSync('git', ['-C', content, 'mv', from, to], { stdio: 'inherit' });
else renameSync(from, to);
console.log(`Moved Little planet's structure to ${to}${tracked ? ' (git mv: commit it, or save to remote)' : ''}.`);
