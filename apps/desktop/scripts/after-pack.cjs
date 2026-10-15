// electron-builder's afterPack hook (documentation/desktop/plan.md, stage 9P): puts the bundled engine in the app's
// resources as one archive, `engine.tar`, with its manifest `engine.json` beside it. The installer writes one large
// file in seconds where the engine's ~29,000 files took it more than ten minutes; the app unpacks it on its first
// start (src/core/setup/engine-archive.mjs).
const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

// left out: only what never runs, source maps and caches. Not type declarations: Astro reads one of its own at run
// time (astro/templates/content/types.d.ts), so they all go in
const LEAVE_OUT = ['*.map', './.astro', './node_modules/.cache'];

exports.default = async function afterPack(context) {
  const from = resolve(__dirname, '..', 'engine');
  if (!existsSync(join(from, 'engine.json'))) throw new Error('no engine in apps/desktop/engine: run node scripts/bundle-engine.mjs first');
  const resources = context.electronPlatformName === 'darwin' ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources') : join(context.appOutDir, 'resources');
  const tar = join(resources, 'engine.tar');
  execFileSync('tar', ['-cf', tar, ...LEAVE_OUT.flatMap((p) => ['--exclude', p]), '-C', from, '.'], { stdio: 'inherit', windowsHide: true });
  copyFileSync(join(from, 'engine.json'), join(resources, 'engine.json'));
  console.log(`  • engine archive  ${(statSync(tar).size / 1024 / 1024).toFixed(0)} MB`);
};
