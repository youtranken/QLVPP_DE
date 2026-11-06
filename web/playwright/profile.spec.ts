import { expect, test } from '@playwright/test';
import { deleteTestUsers, expectNoContrastViolations, isMobile, seedActiveUser } from './helpers';

test.describe('V2C-T7 trang Tôi', () => {
  test('V2C-T7 Tôi: thẻ thông tin, đổi ngôn ngữ, đăng xuất đạt 44px ở 390, axe sạch', async ({ page }, info) => {
    const sub = `pw-me-${Date.now()}-${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Tôi ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    try {
      await page.goto('/me');
      await expect(page.getByRole('heading', { level: 1, name: 'Tôi' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Tài khoản' })).toBeVisible();
      await expect(page.getByRole('main').getByText(`PW Tôi ${info.project.name}`)).toBeVisible();
      if (isMobile(info)) {
        for (const target of [page.getByRole('radio', { name: 'English' }), page.getByRole('button', { name: 'Đăng xuất' })]) {
          expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await expectNoContrastViolations(page);
      }
      await page.getByRole('radio', { name: 'English' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.getByRole('radio', { name: 'Tiếng Việt' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Tôi' })).toBeVisible();
    } finally {
      deleteTestUsers(sub);
    }
  });
});
