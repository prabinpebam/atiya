/**
 * The site's tokens, loaded: the resolver and its sources, bundled as JSON imports so the same model
 * works in Node (the build script, the tests) and in Astro (the design library, meta.ts).
 */
import resolver from './site.resolver.json';
import base from './tokens.json';
import light from './tokens.light.json';
import dark from './tokens.dark.json';
import { loadSite, type Model, type Resolver } from './tokenModel';

export const SOURCES: Record<string, Record<string, unknown>> = {
  'tokens.json': base,
  'tokens.light.json': light,
  'tokens.dark.json': dark,
};

export function siteTokens(): Model {
  return loadSite(resolver as Resolver, (ref) => {
    const doc = SOURCES[ref];
    if (!doc) throw new Error(`site.resolver.json: unknown source ${ref}`);
    return doc;
  });
}
