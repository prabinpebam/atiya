#!/usr/bin/env node
/**
 * The app's window and tray icons, drawn from the site's own favicon (public/favicon.svg) with sharp.
 *   node scripts/build-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(APP, '..', '..', 'public', 'favicon.svg'));
await sharp(svg, { density: 512 }).resize(256, 256).png().toFile(join(APP, 'assets', 'icon.png'));
await sharp(svg, { density: 256 }).resize(32, 32).png().toFile(join(APP, 'assets', 'tray.png'));
console.log('wrote assets/icon.png and assets/tray.png');
