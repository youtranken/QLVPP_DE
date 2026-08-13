import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Trùng alias với vite.config.ts để test và bundle dùng cùng một nguồn @vpp/shared. */
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@vpp/shared': sharedSrc } },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
