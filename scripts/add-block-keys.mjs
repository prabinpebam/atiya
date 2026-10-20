#!/usr/bin/env node
/**
 * Gives every block in every article a key (documentation/editor/ai-editing.md §3), and changes nothing else.
 * Run twice, it changes nothing. It says counts only, never a title or an ID, so it's safe on private-pages/.
 *
 *   node scripts/add-block-keys.mjs                 content/articles/
 *   node scripts/add-block-keys.mjs --root <folder> another content folder (its articles/)
 *   node scripts/add-block-keys.mjs --check         changes nothing; fails if an article needs keys
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withKeys } from '../src/site/editor/model/keys.ts';

/**
 * An article's JSON text with its blocks keyed, or null when it has them all. Pure.
 * @param {string} text the article file's text
 * @returns {string | null}
 */
export function keyedText(text) {
  const article = JSON.parse(text);
  if (!Array.isArray(article.body)) return null;
  const body = withKeys(article.body);
  return body === article.body ? null : `${JSON.stringify({ ...article, body }, null, 2)}\n`;
}

/**
 * Keys every article in `<root>/articles/`.
 * @param {string} root
 * @param {{ check?: boolean }} [opts]
 * @returns {{ files: number, changed: number }}
 */
export function addBlockKeys(root, opts = {}) {
  const dir = join(root, 'articles');
  if (!existsSync(dir)) return { files: 0, changed: 0 };
  let files = 0;
  let changed = 0;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    files++;
    const path = join(dir, name);
    const next = keyedText(readFileSync(path, 'utf8'));
    if (next === null) continue;
    changed++;
    if (!opts.check) writeFileSync(path, next, 'utf8');
  }
  return { files, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--root');
  const root = resolve(at > 0 ? process.argv[at + 1] : 'content');
  const check = process.argv.includes('--check');
  const r = addBlockKeys(root, { check });
  console.log(`${r.files} articles, ${r.changed} ${check ? 'need keys' : 'given keys'}`);
  if (check && r.changed) process.exit(1);
}
