import { expect, test } from '@playwright/test';

// Bộ khung e2e. Bật khi có app chạy (M5) — hiện skip để không phụ thuộc server.
test.skip('trang chủ hiển thị tiêu đề', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DE-VPP' })).toBeVisible();
});
