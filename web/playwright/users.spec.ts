import { expect, test, type Page } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, seedActiveUser, shot } from './helpers';

const ACTIVE = { sub: 'pw-dir-active', name: 'PW Danh bạ An' };
const LOCKED = { sub: 'pw-dir-locked', name: 'PW Danh bạ Bình' };
const SEARCH = 'Tìm người';

const rowOf = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

// Dev không có PMH ID thật: chặn POST đồng bộ để kết quả xác định
async function stubSync(page: Page, handler: () => { status: number; body: unknown }) {
  await page.route('**/api/admin/directory/sync', (route) => {
    const { status, body } = handler();
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('E9-S6 Danh bạ M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S6 Danh bạ: thẻ lọc trạng thái, đồng bộ lỗi PMH ID bảng vẫn còn, ngăn kéo người', async ({ page }, info) => {
    seedActiveUser(ACTIVE.sub, ACTIVE.name);
    seedActiveUser(LOCKED.sub, LOCKED.name, 'locked');
    let fail = true;
    await stubSync(page, () => (fail ? { status: 503, body: { code: 'SSO_UNAVAILABLE', message: 'x' } } : { status: 200, body: { created: 2, updated: 1 } }));
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh bạ' })).toBeVisible();
    await page.getByRole('searchbox', { name: SEARCH }).fill('PW Danh bạ');
    await expect(page).toHaveURL(/q=PW/);
    await expect(rowOf(page, ACTIVE.name)).toBeVisible();
    await expect(rowOf(page, LOCKED.name).getByText('Đã khóa', { exact: true })).toBeVisible();
    await expect(rowOf(page, ACTIVE.name).getByText('Đang dùng', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Đã khóa/ }).click();
    await expect(page.getByText(/^Đang lọc: Đã khóa/)).toBeVisible();
    await expect(rowOf(page, LOCKED.name)).toBeVisible();
    await expect(rowOf(page, ACTIVE.name)).toHaveCount(0);
    await page.getByRole('button', { name: 'Bỏ lọc' }).click();
    await page.getByRole('button', { name: /^Đang dùng/ }).click();
    await expect(rowOf(page, ACTIVE.name)).toBeVisible();
    await expect(rowOf(page, LOCKED.name)).toHaveCount(0);
    await page.getByRole('button', { name: 'Bỏ lọc' }).click();

    await page.getByRole('button', { name: 'Đồng bộ ngay' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Không liên lạc được PMH ID — thử lại sau ít phút.');
    await expect(rowOf(page, ACTIVE.name)).toBeVisible();
    fail = false;
    await alert.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Đã đồng bộ từ PMH ID: 2 người mới, 1 cập nhật.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đồng bộ ngay' })).toBeEnabled();

    await page.getByRole('button', { name: LOCKED.name, exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Thông tin người dùng' });
    await expect(drawer.getByText(/Tài khoản đã khóa ở PMH ID/)).toBeVisible();
    await expect(drawer.getByText(/Vai trò trong app/)).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-users');
    await drawer.getByRole('link', { name: 'Xem nhật ký' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/audit\\?actor=${LOCKED.sub}`));
  });

  test('E9-S6 Danh bạ: ô tìm nhận 200 ký tự, không gõ được ký tự 201', async ({ page }) => {
    await page.goto('/admin/users');
    const box = page.getByRole('searchbox', { name: SEARCH });
    await box.fill('a'.repeat(200));
    await expect(box).toHaveValue('a'.repeat(200));
    await box.press('End');
    await page.keyboard.type('b');
    await expect(box).toHaveValue('a'.repeat(200));
  });

  test('E9-S6 Danh bạ: lỗi tải → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/users?*', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/users');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
