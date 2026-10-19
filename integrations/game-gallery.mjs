/**
 * The game UI's gallery (documentation/game-ui/design-system.md §9.1; review DS2-05): its page,
 * /play/gallery/, exists in development and in `--mode test` builds (like the test hook, window.__game),
 * never in a production build. scripts/size-report.mjs fails `verify:prod` if it reaches dist/.
 */
import { GALLERY_ROUTE, galleryWanted } from './game-gallery-rules.mjs';

/** @returns {import('astro').AstroIntegration} */
export default function gameGallery() {
  return {
    name: 'game-gallery',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (!galleryWanted(command, process.argv)) return;
        injectRoute({ pattern: GALLERY_ROUTE, entrypoint: './src/game/gallery/GalleryPage.astro' });
      },
    },
  };
}
