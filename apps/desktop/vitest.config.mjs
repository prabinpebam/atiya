// @ts-check
import { defineConfig } from 'vitest/config';

/** The app's unit and integration tests (documentation/desktop/plan.md §5), run from the repository's root. */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['test/**/*.test.mjs'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
