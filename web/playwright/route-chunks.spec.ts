import { expect, test, type Page } from '@playwright/test';
import { skipNewPeriodPopup } from './helpers';

// Màn nạp lười theo nhóm (shell/route-chunks.ts). Chỉ đọc: mọi request /api không phải GET bị chặn.
// Chunk mất (deploy mới xoá file hash cũ mà tab còn giữ index cũ) → giữ khung, hiện câu "vừa cập nhật" + Tải lại trang.
const SUB = process.env.PW_DEV_SUB ?? 'pw-admin';

async function as(page: Page, role: 'member' | 'admin') {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const r = route.request();
    if (r.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...r.headers(), 'x-dev-user-sub': SUB, 'x-dev-role': role } });
  });
}

// Vite dev phục vụ module nguồn (/src/shell/admin-pages.ts), bản build là /static/admin-pages-<hash>.js
async function dropChunk(page: Page, name: 'admin-pages' | 'member-pages' | 'print-pages') {
  await page.route(new RegExp(`/(src/shell/${name}\\.ts|static/${name}-[\\w-]+\\.js)(\\?.*)?$`), (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }),
  );
}

test.describe('Chunk theo route', () => {
  test('Hành chính: Kỳ tháng vẽ ngay sau khi kiểm phiên, đổi sang Tủ / Kho trong cùng chunk', async ({ page }) => {
    await as(page, 'admin');
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng/ })).toBeVisible();
    await page.goto('/admin/stock');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Ứng dụng vừa được cập nhật')).toHaveCount(0);
  });

  test('Hành chính: chunk admin 404 → khung vẫn còn, câu cập nhật + nút Tải lại trang', async ({ page }) => {
    await as(page, 'admin');
    await dropChunk(page, 'admin-pages');
    await page.goto('/admin/month');
    const alert = page.getByRole('alert').filter({ hasText: 'Ứng dụng vừa được cập nhật' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Tải lại trang' })).toBeVisible();
    await expect(page.locator('#main')).toBeVisible();
  });

  test('Nhân viên: chunk member 404 → câu cập nhật trong khung nhân viên', async ({ page }) => {
    await as(page, 'member');
    await dropChunk(page, 'member-pages');
    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: 'Ứng dụng vừa được cập nhật' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tải lại trang' })).toBeVisible();
  });

  test('Trang in: chunk print 404 → câu cập nhật, không trắng màn', async ({ page }) => {
    await as(page, 'admin');
    await dropChunk(page, 'print-pages');
    await page.goto('/admin/reports/snapshots/00000000-0000-4000-8000-000000000000/print');
    await expect(page.getByRole('alert').filter({ hasText: 'Ứng dụng vừa được cập nhật' })).toBeVisible();
  });
});
