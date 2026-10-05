import { defineConfig } from 'vitest/config';
import { join } from 'node:path';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // the unit tests read the made-up private pages, never private-pages/ (documentation/access/spec.md §3)
    env: { PRIVATE_ROOT: join(import.meta.dirname, 'tests/fixtures/private-pages') },
  },
});
