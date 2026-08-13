import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình e2e — chạy vào app ĐANG CHẠY (không tự dựng server) vì luồng đăng nhập
 * cần cả mock-idp và api sống.
 *
 * Mặc định trỏ vào **stack Docker demo**, dựng bằng một lệnh:
 *   docker compose -f deploy/docker-compose.yml --profile app up -d
 *   pnpm test:e2e
 *
 * Chế độ dev trên máy (README "Cách 2") thì chỉ định địa chỉ khác:
 *   E2E_BASE_URL=http://localhost:8090 E2E_IDP_URL=http://localhost:9000 pnpm test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // các test dùng chung một CSDL demo
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
