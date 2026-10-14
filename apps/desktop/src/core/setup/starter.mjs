// @ts-check
/**
 * A new site's first content: the starter (starter/content in the engine) for the person's choices, with
 * their name in it (documentation/desktop/spec.md §9.3, F6, F7). The result passes the content contract
 * (tests/unit/starter.test.ts loads every combination).
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { engineRoot } from './engine.mjs';

/** The placeholder the starter's files carry where the person's name goes. */
export const PLACEHOLDER = 'Your Name';

/** @param {string} file */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
/** Content JSON as the store writes it: two spaces, LF, a final newline. @param {string} file @param {unknown} data */
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

/** Every file under a folder, relative to it, with / separators. @param {string} dir @param {string} [prefix] @returns {string[]} */
export function listFiles(dir, prefix = '') {
  /** @type {string[]} */
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * Writes `content/` for a new site into `dir`.
 * @param {string} dir the workspace
 * @param {{ name: string, planet: boolean, samples: boolean, today: string, starter?: string }} o
 * @returns {string[]} the files written, relative to `dir`
 */
export function writeStarter(dir, o) {
  const from = o.starter ?? join(engineRoot(), 'starter', 'content');
  const to = join(dir, 'content');
  if (!existsSync(from)) throw new Error(`The starter content isn't in the engine (${from}).`);
  cpSync(from, to, { recursive: true });
  const name = o.name.trim() || PLACEHOLDER;

  if (!o.planet) rmSync(join(to, 'structures', 'modes'), { recursive: true, force: true });
  // which ways in are on (plan stage 8A, D-W1): edit mode's Ways to explore changes it later
  writeJson(join(to, 'structures', 'ways.json'), { modes: o.planet ? [{ id: 'little-planet', on: true, mount: 'play' }] : [], primary: 'site' });

  const structureFile = join(to, 'structures', 'site.json');
  const structure = readJson(structureFile);
  structure.home.title = name;
  if (!o.samples) {
    rmSync(join(to, 'articles'), { recursive: true, force: true });
    for (const section of structure.home.children ?? []) section.children = [];
  } else {
    for (const section of structure.home.children ?? []) {
      for (const child of section.children ?? []) {
        if (child.kind !== 'item') continue;
        const file = join(to, 'articles', `${child.item.id}.json`);
        const article = readJson(file);
        article.publishedAt = o.today;
        article.updatedAt = o.today;
        writeJson(file, article);
      }
    }
  }
  writeJson(structureFile, structure);

  const siteFile = join(to, 'site.json');
  const site = readJson(siteFile);
  site.name = name;
  site.description = `The portfolio of ${name}.`.slice(0, 160);
  writeJson(siteFile, site);

  const personFile = join(to, 'people', `${site.owner}.json`);
  const person = readJson(personFile);
  person.name = name;
  writeJson(personFile, person);

  return listFiles(to).map((f) => `content/${f}`);
}
