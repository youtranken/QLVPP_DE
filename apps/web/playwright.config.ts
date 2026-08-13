import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình e2e — chạy vào app ĐANG CHẠY (không tự dựng server) vì luồng đăng nhập
 * cần cả mock-idp và api sống.
 *
 *   pnpm --filter @vpp/mock-idp start
 *   pnpm --filter @vpp/api dev
 *   pnpm --filter @vpp/web dev
 *   pnpm test:e2e
 *
 * Đổi địa chỉ khi cần: `E2E_BASE_URL=http://localhost:8090 pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // các test dùng chung một CSDL demo
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8090',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
