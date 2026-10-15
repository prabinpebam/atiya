/**
 * Tier-0 helpers the site's components share: the base path (GitHub Pages serves the site under
 * /atiya/) and the theme colours for the browser's chrome, read from the tokens so no component
 * writes a colour literal.
 */
import { siteTokens } from './tokens';
import { resolve } from './tokenModel';

export { withBase } from '../../game/platform/base';

const model = siteTokens();
const bg = model.byPath.get('color.bg')!;

/** <meta name="theme-color"> for each mode: the page's own paper. */
export const THEME_COLOR = {
  light: resolve(bg, model.byPath, 'light'),
  dark: resolve(bg, model.byPath, 'dark'),
} as const;

/** Defined by integrations/editor.mjs from content/site.json for every command (desktop spec §9.2). */
declare const __SITE_NAME__: string | undefined;

/** The site's name, as the header and the titles use it: the site's own settings, never the code. */
export const SITE_NAME: string = (typeof __SITE_NAME__ === 'string' && __SITE_NAME__) || 'This site';

/** A page's default description, from the site's name. */
export const SITE_DESCRIPTION = `The portfolio of ${SITE_NAME}.`;

/** Defined by integrations/editor.mjs (integrations/features.mjs): the parts of the engine this site has. */
declare const __SITE_FEATURES__: { planet: boolean; designLibrary: boolean; docs: boolean; managed?: boolean; residents?: boolean } | undefined;

/**
 * The parts of the engine this site has: the planet, the design library, the documentation (desktop spec
 * §9.1), and whether it's a managed site (a person's, made by Atiya Studio: edit mode leaves out the
 * owner's developer tools), and whether the planet has the owner's residents (plan M3a).
 */
export const SITE_FEATURES: { planet: boolean; designLibrary: boolean; docs: boolean; managed: boolean; residents: boolean } = {
  planet: true,
  designLibrary: true,
  docs: true,
  managed: false,
  residents: true,
  ...(typeof __SITE_FEATURES__ === 'object' && __SITE_FEATURES__ ? __SITE_FEATURES__ : {}),
};
