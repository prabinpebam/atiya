// @ts-check
/**
 * Just the site, and only the parts of the engine a site has (documentation/desktop/plan.md, stage 4):
 * a site whose content has no planet structure ships none of the planet, and a managed site ships the
 * design library and the documentation only if its atiya.json turns them on (integrations/features.mjs).
 * The pages already leave them out (no Explore link, no planet on the home page, /play/ sends home, the
 * footer's links follow the features); after the build this removes what Astro still emits for them: the
 * game's chunks, the planet's assets, and /design/ and /docs/. The owner's site has them all, and is
 * untouched. The mode host (stage 8) replaces the planet's part with modes that are only built when on.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteFeatures } from './features.mjs';

/** The owner's residents' files (Chopper's photos, the family's skins and portraits) and his music: only on his site (plan M3a). */
export const RESIDENT_ASSETS = ['chopper', 'models/skins', 'avatars/npc', 'audio/music-1.mp3', 'audio/music-2.mp3'];

/** The residents' chunks (`import()`s the game gates with `__GAME_RESIDENTS__`; Rolldown folds the constant only after it has emitted them). */
export const RESIDENT_CHUNKS = /^(Chopper|ChopperCard|home)\.[\w-]+\.js$/;

/** public/ folders only the planet uses. */
export const PLANET_ASSETS = ['textures', 'models', 'audio', 'chopper', 'poster', 'avatars', 'icons'];

/** @returns {import('astro').AstroIntegration} */
export default function siteOnly() {
  /** @type {ReturnType<typeof siteFeatures>} */
  let features = { planet: true, designLibrary: true, docs: true, managed: false, residents: true };
  return {
    name: 'site-only',
    hooks: {
      'astro:config:setup': ({ config, command }) => {
        if (command !== 'build') return;
        // a build reads content/ (CONTENT_ROOT is refused in a build: integrations/editor.mjs)
        const root = fileURLToPath(config.root);
        features = siteFeatures({ root, contentRoot: join(root, 'content') });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        /** @type {string[]} */
        const gone = [];
        const drop = (/** @type {string} */ rel) => {
          if (!existsSync(join(out, rel))) return;
          rmSync(join(out, rel), { recursive: true, force: true });
          gone.push(rel);
        };
        if (!features.planet) {
          for (const folder of PLANET_ASSETS) drop(folder);
          const chunks = join(out, '_astro');
          if (existsSync(chunks)) for (const f of readdirSync(chunks)) if (f.startsWith('game-')) drop(`_astro/${f}`);
        }
        else if (!features.residents) {
          for (const f of RESIDENT_ASSETS) drop(f);
          // their chunks, once nothing in the build names them (a chunk something still imports is kept, and said)
          const chunks = join(out, '_astro');
          const all = existsSync(chunks) ? readdirSync(chunks) : [];
          const theirs = all.filter((n) => RESIDENT_CHUNKS.test(n));
          // every other script, read once, before anything goes
          const others = all.filter((f) => f.endsWith('.js') && !theirs.includes(f)).map((f) => readFileSync(join(chunks, f), 'utf8'));
          for (const f of theirs) {
            if (others.some((src) => src.includes(f))) logger.warn(`kept _astro/${f}: another chunk still imports it`);
            else drop(`_astro/${f}`);
          }
        }
        if (!features.designLibrary) drop('design');
        if (!features.docs) drop('docs');
        if (gone.length) logger.info(`left out what this site doesn't have: ${gone.filter((g) => !g.startsWith('_astro/')).join(', ') || 'nothing but chunks'} and ${gone.filter((g) => g.startsWith('_astro/')).length} game chunks`);
      },
    },
  };
}
