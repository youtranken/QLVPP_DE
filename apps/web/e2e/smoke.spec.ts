import { expect, test } from '@playwright/test';
import { signIn, signOutGlobal } from './helpers';

const ADMIN = 'admin@pmh.com.vn';
const MEMBER = 'chi@pmh.com.vn';

test.describe('Xác thực', () => {
  test('chưa đăng nhập thì bị đưa về trang đăng nhập, và trang đó KHÔNG có ô mật khẩu', async ({
    page,
  }) => {
    await signOutGlobal(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByRole('button', { name: /Đăng nhập bằng PMH ID/ })).toBeVisible();
    // AUTH-1 AC1: app không quản mật khẩu nên tuyệt đối không có ô nhập mật khẩu.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('đăng nhập rồi quay lại đúng trang đang định vào', async ({ page }) => {
    await signOutGlobal(page);
    await page.goto('/don-cua-toi');
    await expect(page).toHaveURL(/\/dang-nhap/);

    await page.getByRole('button', { name: /Đăng nhập bằng PMH ID/ }).click();
    await page.getByRole('button', { name: new RegExp(MEMBER) }).click();
    await expect(page).toHaveURL(/\/don-cua-toi/);
  });
});

test.describe('Nhân viên', () => {
  test.beforeEach(async ({ page }) => {
    await signOutGlobal(page);
    await signIn(page, MEMBER);
  });

  test('thấy đúng tên, phòng ban và trạng thái kỳ đăng ký', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Xin chào, Lê Văn Chí/ })).toBeVisible();
    await expect(page.getByText(/(Đang mở|Đã đóng) đăng ký/)).toBeVisible();
  });

  test('món chỉ dành cho admin bị khoá với nhân viên (CORE-4)', async ({ page }) => {
    await page.goto('/dang-ky');
    const a4Row = page
      .locator('div')
      .filter({ hasText: /^Giấy A4/ })
      .first();
    await expect(page.getByText('chỉ admin').first()).toBeVisible();
    // Nhân viên không có ô nhập số lượng cho món admin_only.
    await expect(a4Row.locator('input[aria-label*="Giấy A4"]')).toHaveCount(0);
  });
});

test.describe('Quản trị viên', () => {
  test.beforeEach(async ({ page }) => {
    await signOutGlobal(page);
    await signIn(page, ADMIN);
  });

  test('được chọn món admin_only và bỏ qua khung ngày (CORE-16)', async ({ page }) => {
    await page.goto('/dang-ky');
    await expect(page.locator('input[aria-label*="Giấy A4"]')).toBeVisible();
  });

  test('giỏ cộng dồn món đã chọn', async ({ page }) => {
    await page.goto('/dang-ky');
    await page.locator('input[aria-label="Số lượng Bút bi xanh"]').fill('4');
    await expect(page.getByText('Đã chọn: 1 món')).toBeVisible();
    await expect(page.getByText('4 cây')).toBeVisible();
  });

  test('vượt giới hạn số lượng thì không gửi được', async ({ page }) => {
    await page.goto('/dang-ky');
    // InputNumber tự kẹp về max khi rời ô ⇒ gõ rồi kiểm giá trị đã bị kẹp.
    const input = page.locator('input[aria-label="Số lượng Bút bi xanh"]');
    await input.fill('999');
    await input.blur();
    await expect(input).toHaveValue('20');
  });
});
