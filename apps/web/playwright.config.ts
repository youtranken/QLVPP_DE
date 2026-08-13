import { defineConfig } from '@playwright/test';

/** Cấu hình e2e. Chạy: `pnpm --filter @vpp/web test:e2e` (cần app đang chạy ở M5). */
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:8080' },
});
