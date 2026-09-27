// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsSite from './integrations/docs-site.mjs';

// GitHub Pages serves this repository as a project site, https://<user>.github.io/<repo>/, so the
// deploy workflow (.github/workflows/deploy.yml) builds with SITE_URL and BASE_PATH set. Locally, in
// dev and in the tests, the site lives at the root.
const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH || '/';

/**
 * The shaders' GLSL lives in template literals, so the minifier keeps their `//` comments as string
 * content (about 1.5 KB gz in the game's initial JS). Once a chunk is minified, a line that's only a
 * `//` comment can only be inside a template literal, so drop it: never `//#` / `//!` pragmas or a
 * licence.
 */
function stripShaderComments() {
  return {
    name: 'strip-shader-comments',
    apply: /** @type {const} */ ('build'),
    /** @param {unknown} _ @param {Record<string, { type: string; code?: string }>} bundle */
    generateBundle(_, bundle) {
      for (const c of Object.values(bundle)) {
        if (c.type === 'chunk' && c.code) c.code = c.code.replace(/^[ \t]*\/\/(?![#!])(?![^\n]*@(?:license|preserve))[^\n]*\n/gm, '');
      }
    },
  };
}

export default defineConfig({
  site,
  base,
  // the documentation site (documentation/, Slate) is published beside the game at <base>/docs/
  integrations: [react(), docsSite()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [stripShaderComments()],
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
