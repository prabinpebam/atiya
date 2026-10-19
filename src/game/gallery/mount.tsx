/**
 * Mounts the game UI's gallery (./Gallery.tsx) into its page, on the surface and theme the address asks for:
 * `?surface=paper` (light) or `?surface=wood` (its own look, dark, unless `&theme=light`), and `?view=` for one view.
 */
import { createRoot } from 'react-dom/client';
import { Gallery } from './Gallery';

/** Reads the address, sets the surface and the theme on the page, and draws the gallery into `root`. */
export function mountGallery(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  const surface = q.get('surface') === 'paper' ? 'paper' : 'wood';
  const theme = q.get('theme') === 'light' || q.get('theme') === 'dark' ? q.get('theme')! : surface === 'paper' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.body.classList.remove('surface-paper', 'surface-wood');
  document.body.classList.add(`surface-${surface}`);
  createRoot(root).render(<Gallery view={q.get('view')} surface={surface} />);
}
