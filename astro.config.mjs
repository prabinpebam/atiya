// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsSite from './integrations/docs-site.mjs';

// GitHub Pages serves this repository as a project site, https://<user>.github.io/<repo>/, so the
// deploy workflow (.github/workflows/deploy.yml) builds with SITE_URL and BASE_PATH set. Locally, in
// dev and in the tests, the site lives at the root.
const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  // the documentation site (documentation/, Slate) is published beside the game at <base>/docs/
  integrations: [react(), docsSite()],
  devToolbar: { enabled: false },
  vite: {
    resolve: {
      // A second copy of three (e.g. pre-bundled separately with an addon) breaks R3F.
      dedupe: ['three', 'react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/geometries/RoundedBoxGeometry.js',
        'three/examples/jsm/utils/BufferGeometryUtils.js',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'postprocessing',
        'zustand',
        'zustand/vanilla',
      ],
    },
    build: {
      // three.js is intentionally large; budgets are enforced by scripts/size-report.mjs instead.
      chunkSizeWarningLimit: 2000,
    },
  },
});
