import { expect, test } from '@playwright/test';
import { deleteTestUsers, expectNoContrastViolations, isMobile, seedActiveUser } from './helpers';

test.describe('V2C-T7 hộp tài khoản nhân viên', () => {
  test('V2C-T7 Tài khoản: hộp ở đầu trang (1280 bấm tên, 390 bấm "Tôi" mở sheet), đổi ngôn ngữ, đăng xuất đạt 44px ở 390, axe sạch', async ({ page }, info) => {
    const sub = `pw-me-${Date.now()}-${info.project.name}`;
    const name = `PW Tôi ${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, name);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    try {
      await page.goto('/');
      if (isMobile(info)) {
        const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
        await expect(nav.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
        await nav.getByRole('button', { name: 'Tôi' }).click();
      } else {
        await expect(page.getByRole('navigation', { name: 'Chuyển trang' }).getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
        await page.getByRole('button', { name: `Mở tài khoản của ${name}` }).click();
      }
      const box = page.getByRole('dialog', { name: 'Tài khoản' });
      await expect(box).toBeVisible();
      await expect(box.getByText(name)).toBeVisible();
      if (isMobile(info)) {
        await expect(page).toHaveURL(/\/$/);
        for (const target of [box.getByRole('radio', { name: 'English' }), box.getByRole('button', { name: 'Đăng xuất' })]) {
          expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await expectNoContrastViolations(page);
      }
      await box.getByRole('radio', { name: 'English' }).click();
      const en = page.getByRole('dialog', { name: 'Account' });
      await expect(en).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await en.getByRole('radio', { name: 'Tiếng Việt' }).click();
      await expect(page.getByRole('dialog', { name: 'Tài khoản' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Tài khoản' })).toBeHidden();
    } finally {
      deleteTestUsers(sub);
    }
  });
});
