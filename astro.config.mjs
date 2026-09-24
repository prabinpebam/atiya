// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
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
