import { expect, test, type APIRequestContext } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, seedActiveUser, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

const ACTIVE = { sub: 'pw-dir-active', name: 'PW Danh bạ An' };
const LOCKED = { sub: 'pw-dir-locked', name: 'PW Danh bạ Bình' };

test.describe('E0-S7 Danh bạ (dev-identity admin)', () => {
  asRole('admin');

  test('E0-S7 danh bạ hiện trạng thái; "Đồng bộ ngay" khi PMH ID không liên lạc được → báo lỗi, bảng vẫn còn', async ({
    page,
  }, info) => {
    seedActiveUser(ACTIVE.sub, ACTIVE.name);
    seedActiveUser(LOCKED.sub, LOCKED.name, 'locked');
    await page.route('**/api/admin/directory/sync', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'DIRECTORY_UNAVAILABLE', message: 'x' }) }),
    );
    await page.goto('/admin/users?status=all');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh bạ' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm người' }).fill('PW Danh bạ');
    await expect(page.getByRole('row').filter({ hasText: LOCKED.name }).getByText('Đã khóa', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: ACTIVE.name }).getByText('Đang dùng', { exact: true })).toBeVisible();

    // Dev không có PMH ID thật: chặn POST để lỗi xác định; trang phải báo rõ ràng chứ không làm hỏng
    await page.getByRole('button', { name: 'Đồng bộ ngay' }).click();
    await expect(page.getByRole('alert')).toContainText('Tài khoản D&E');
    await expect(page.getByRole('row').filter({ hasText: ACTIVE.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đồng bộ ngay' })).toBeEnabled();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-users');
  });
});

test.describe('E0-S8 Nhật ký và cấu hình (dev-identity admin)', () => {
  asRole('admin');

  let api: APIRequestContext | undefined;
  let original: Record<string, unknown> | undefined;
  let release: (() => void) | undefined;

  // DB dev dùng chung: đọc giá trị gốc trước, trả lại sau, và giữ khóa để hai viewport không ghi đè nhau
  test.beforeAll(async ({ playwright }, info) => {
    release = await acquireLock('admin-config');
    api = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: devHeaders('admin') });
    const res = await api.get('/api/admin/config');
    expect(res.ok()).toBe(true);
    original = (await res.json()) as Record<string, unknown>;
  });

  test.afterAll(async () => {
    try {
      if (api && original) {
        const res = await api.put('/api/admin/config', { data: { registration_last_day: original.registration_last_day } });
        expect(res.ok()).toBe(true);
      }
    } finally {
      await api?.dispose();
      release?.();
    }
  });

  test('E0-S8 ngày hạn 29 bị chặn tại ô; không còn khối liên hệ, trang "Chưa được cấp quyền" nói câu cố định (A7)', async ({
    page,
    browser,
  }, info) => {
    await page.goto('/admin/config');
    await expect(page.getByRole('heading', { level: 1, name: 'Cấu hình' })).toBeVisible();
    // R-D8.19: dòng sống nói kỳ đang mở giữ hạn cũ, hạn mới áp từ kỳ sau
    await expect(page.getByText(/^Kỳ tháng \d+ \(đang mở\) vẫn khóa 00:00\sngày\s\d\d\/\d\d\. Áp dụng từ kỳ tháng \d+: khóa/)).toBeVisible();

    const day = page.getByLabel('Hạn đăng ký (ngày)');
    await day.fill('29');
    await expect(day).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Lưu kỳ đăng ký' })).toBeDisabled();
    await expect(page.getByText('Nhập số từ 3 đến 28.')).toBeVisible();

    await expect(page.getByRole('form', { name: 'Liên hệ Adm D&E và báo sắp hết hàng' })).toHaveCount(0);
    await expect(page.getByLabel('Tên và cách liên hệ Adm D&E')).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-config');

    const guest = await browser.newContext({ baseURL: info.project.use.baseURL });
    const forbidden = await guest.newPage();
    await forbidden.goto('/?login=forbidden');
    await expect(forbidden.getByText('Tài khoản của bạn không có quyền vào QLVPP. Liên hệ Adm D&E để được hỗ trợ.')).toBeVisible();
    await guest.close();
  });
});

test.describe('TC-06 Việc hôm nay (dev-identity admin)', () => {
  asRole('admin');

  test('TC-06 /admin mở Việc hôm nay; bấm ô "Giao được ngay" tới Giao hàng với thẻ "Giao được ngay" đang chọn', async ({ page, request }, info) => {
    // Phiếu tủ đủ ở tháng đang giao: Giao hàng có hàng thẻ số (kỳ đã khóa)
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 1 }]);
    try {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin\/today$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if (!isMobile(info)) await expect(page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('link').first()).toHaveAccessibleName('Việc hôm nay');
      const tiles = page.getByRole('region', { name: 'Số việc' });
      const ready = tiles.getByRole('link', { name: /^Giao được ngay/ });
      await expect(ready).toBeVisible();
      await expect(tiles.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'today');
      await ready.click();
      await expect(page).toHaveURL(/\/admin\/delivery\?tab=ready/);
      await expect(page.getByRole('tablist', { name: 'Lọc theo trạng thái' }).getByRole('tab', { name: /^Giao được ngay/ })).toHaveAttribute('aria-selected', 'true');
    } finally {
      seed.cleanup();
    }
  });
});
