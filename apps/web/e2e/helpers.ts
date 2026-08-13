import type { Page } from '@playwright/test';

/** Địa chỉ mock-idp — trang chọn user demo nằm ngoài origin của app. */
export const IDP_URL = process.env.E2E_IDP_URL ?? 'http://localhost:9100';

/**
 * Đăng nhập qua mock-idp: bấm "Đăng nhập bằng PMH ID" rồi chọn một user demo.
 * Dùng đúng luồng OIDC thật, không giả lập cookie — nếu SSO hỏng thì test phải hỏng.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/dang-nhap');
  await page.getByRole('button', { name: /Đăng nhập bằng PMH ID/ }).click();
  await page.waitForURL(new RegExp(`${IDP_URL}/interaction/`));
  await page.getByRole('button', { name: new RegExp(email) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/interaction'));
}

/** Đăng xuất toàn hệ để test sau bắt đầu từ trạng thái sạch. */
export async function signOutGlobal(page: Page): Promise<void> {
  await page.goto('/api/auth/logout-global');
  const confirm = page.getByRole('button', { name: /sign me out/i });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForURL(/\/(dang-nhap)?$/);
}
