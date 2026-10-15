#!/usr/bin/env node
/**
 * Brings the GitHub CLI the app carries for device login (documentation/desktop/spec.md §4.1, decision O8) into
 * apps/desktop/vendor/gh/: the pinned release from GitHub (cli/cli, MIT), checked against the checksum pinned here
 * before anything is unpacked. electron-builder puts it in the packaged app's resources (gh/).
 *   node scripts/fetch-gh.mjs [--platform win32|darwin] [--arch x64|arm64]
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '2.102.0';
/** From the release's gh_<version>_checksums.txt, pinned so a changed download is refused. */
const SHA256 = {
  'windows_amd64.zip': 'ae64e556ecc240b200f7eba60d550e4bb60d78e860e69dd88c449405b86067f4',
  'windows_arm64.zip': '5dcf12aa8525eabd0c46ec414f323ab6cf65229fc2cd46543cc705001bbaf223',
  'macOS_amd64.zip': 'b245f24eb2bf5f75b426b4c26da3651a107f8d5b6f4fddfbfccc5679041378b3',
  'macOS_arm64.zip': 'da922c20d1792e5b2cbf375593d7a658acf034c12c84e007e71c76ef959c337e',
};

const arg = (/** @type {string} */ k, /** @type {string} */ d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const platform = arg('platform', process.platform);
const arch = arg('arch', process.arch);
const kind = `${platform === 'darwin' ? 'macOS' : 'windows'}_${arch === 'arm64' ? 'arm64' : 'amd64'}.zip`;
const sha = SHA256[/** @type {keyof typeof SHA256} */ (kind)];
const target = join(APP, 'vendor', 'gh');
const exe = join(target, 'bin', platform === 'win32' ? 'gh.exe' : 'gh');

const marker = join(target, 'VERSION');
if (existsSync(exe) && existsSync(marker) && readdirSync(target).includes('VERSION') && execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(marker)},'utf8'))`], { encoding: 'utf8' }).trim() === `${VERSION} ${kind}`) {
  console.log(`the GitHub CLI ${VERSION} is already in vendor/gh`);
  process.exit(0);
}

const url = `https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_${kind}`;
console.log(`fetching ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
const bytes = Buffer.from(await res.arrayBuffer());
const got = createHash('sha256').update(bytes).digest('hex');
if (got !== sha) throw new Error(`the GitHub CLI's download doesn't match its pinned checksum (${got}, expected ${sha}): nothing was unpacked`);

const scratch = `${target}.unpacking`;
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const zip = join(scratch, 'gh.zip');
writeFileSync(zip, bytes);
// Windows' and macOS's own tar read zip archives
execFileSync('tar', ['-xf', zip, '-C', scratch], { stdio: 'inherit' });
rmSync(zip);
// the macOS archive keeps its files in a folder of its own name
const inner = existsSync(join(scratch, 'bin')) ? scratch : join(scratch, readdirSync(scratch)[0]);
rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
renameSync(inner, target);
rmSync(scratch, { recursive: true, force: true });
writeFileSync(marker, `${VERSION} ${kind}\n`);
if (!existsSync(exe)) throw new Error(`the GitHub CLI's archive had no ${exe}`);
console.log(`the GitHub CLI ${VERSION} is in vendor/gh (${kind})`);
