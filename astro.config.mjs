// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsSite from './integrations/docs-site.mjs';
import editor from './integrations/editor.mjs';
import devIsolation from './integrations/dev-isolation.mjs';
import contentFiles from './integrations/content-files.mjs';
import sealer from './integrations/seal.mjs';

// GitHub Pages serves this repository as a project site, https://<user>.github.io/<repo>/, so the
// deploy workflow (.github/workflows/deploy.yml) builds with SITE_URL and BASE_PATH set. Locally, in
// dev and in the tests, the site lives at the root.
const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH || '/';

/**
 * The shaders' GLSL lives in template literals, so the minifier keeps their `//` comments as string
 * content (about 1.5 KB gz in the game's initial JS). Once a chunk is minified, a line that's only a
 * `//` comment can only be inside a template literal, so drop it: never `//#` / `//!` pragmas or a
 * licence. For the same reason a line's leading indentation is the shaders' own, and GLSL doesn't
 * need it: drop that too (about 0.5 KB gz).
 */
function stripShaderComments() {
  return {
    name: 'strip-shader-comments',
    apply: /** @type {const} */ ('build'),
    /** @param {unknown} _ @param {Record<string, { type: string; code?: string }>} bundle */
    generateBundle(_, bundle) {
      for (const c of Object.values(bundle)) {
        if (c.type === 'chunk' && c.code) c.code = c.code.replace(/^[ \t]*\/\/(?![#!])(?![^\n]*@(?:license|preserve))[^\n]*\n/gm, '').replace(/^[ \t]+/gm, '');
      }
    },
  };
}

export default defineConfig({
  site,
  base,
  // the documentation site (documentation/, Slate) is published beside the game at <base>/docs/;
  // contentFiles: the content's files to download (the résumé's PDF) at <base>/media/<id>.pdf;
  // devIsolation: a running dev server's caches are its own, never rewritten by a build or a check (app-separation.md §1)
  // the sealer runs last: it seals what the others have written (documentation/access/spec.md §6.2)
  integrations: [devIsolation(), react(), docsSite(), contentFiles(), editor(), sealer()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [stripShaderComments()],
    resolve: {
      // A second copy of three (e.g. pre-bundled separately with an addon) breaks R3F.
      dedupe: ['three', 'react', 'react-dom'],
    },
    optimizeDeps: {
      // Pre-bundled at dev start-up, so none is discovered mid-session: a late discovery re-bundles the
      // deps under a new hash, and the game's lazily loaded modules, already served with the old one, get
      // "504 Outdated Optimize Dep" and a second copy of three and React. tests/unit/devDeps.test.ts
      // fails when the game imports a package that isn't listed here.
      include: [
        // also pre-bundled by @astrojs/react; listed so the game's list is complete on its own
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'three',
        'three/examples/jsm/geometries/RoundedBoxGeometry.js',
        'three/examples/jsm/utils/BufferGeometryUtils.js',
        'three/examples/jsm/utils/SkeletonUtils.js',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'postprocessing',
        'zustand',
        'zustand/vanilla',
        // the game's icons, reached only through its lazily loaded chunk
        '@fortawesome/free-solid-svg-icons',
        // the design library's client-side router (astro:transitions)
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-types.js',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-swap-functions.js',
      ],
    },
    build: {
      // three.js is intentionally large; budgets are enforced by scripts/size-report.mjs instead.
      chunkSizeWarningLimit: 2000,
    },
  },
});
