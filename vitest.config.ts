import { defineConfig } from 'vitest/config';
import { join } from 'node:path';
export default defineConfig({
  // what integrations/editor.mjs defines for a build of this repository's own site
  define: { __SITE_PARENT_DOMAIN__: JSON.stringify('prabinpebam.github.io') },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // the unit tests read the made-up private pages, never private-pages/ (documentation/access/spec.md §3)
    env: { PRIVATE_ROOT: join(import.meta.dirname, 'tests/fixtures/private-pages') },
  },
});
