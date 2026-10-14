/**
 * Edit mode inside Atiya Studio (documentation/desktop/spec.md §4.4, F8): a managed site's edit mode
 * offers private pages before they exist, by sending the person to the app's own page that sets them
 * up. Only the app's views can open it; edit mode in a browser (the engine's own repository) never
 * offers it.
 */

/** The app's page that sets up private pages. */
export const PRIVATE_SETUP_URL = 'app://ui/private.html';

/** Where edit mode offers to set up private pages: a managed site that has none yet. */
export const privateSetupHref = (managed: boolean, hasPrivate: boolean): string | null => (managed && !hasPrivate ? PRIVATE_SETUP_URL : null);
