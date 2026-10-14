#!/usr/bin/env node
/**
 * Copies the site's generated design tokens and fonts into the app's own pages (src/ui/site/), so the
 * app looks like the site without duplicating its sources: the site's build scripts stay their only
 * writer (AGENTS.md). Run before the app starts (npm start's prestart) and before its tests.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = resolve(APP, '..', '..', 'src', 'site');
const OUT = join(APP, 'src', 'ui', 'site');

mkdirSync(join(OUT, 'fonts'), { recursive: true });
copyFileSync(join(SITE, 'styles', 'tokens.css'), join(OUT, 'tokens.css'));
const fonts = readFileSync(join(SITE, 'styles', 'fonts.css'), 'utf8');
const files = [...fonts.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
for (const f of new Set(files)) copyFileSync(join(SITE, 'assets', 'fonts', f), join(OUT, 'fonts', f));
writeFileSync(join(OUT, 'fonts.css'), fonts.replaceAll("url('../assets/fonts/", "url('fonts/"));
console.log(`synced the site's tokens and ${new Set(files).size} fonts into src/ui/site/`);
