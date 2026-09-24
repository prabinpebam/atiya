// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    build: {
      // three.js is intentionally large; budgets are enforced by scripts/size-report.mjs instead.
      chunkSizeWarningLimit: 2000,
    },
  },
});
