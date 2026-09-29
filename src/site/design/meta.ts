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

/** The site's name, as the header and the titles use it. */
export const SITE_NAME = 'Prabin Pebam';
