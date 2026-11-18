import { expect, test } from '@playwright/test';
import { deleteTestUsers, expectNoContrastViolations, isMobile, seedActiveUser, skipNewPeriodPopup } from './helpers';

test.describe('V2C-T7 hộp tài khoản nhân viên', () => {
  // Popup kỳ mới (vòng 4) phủ trang Đăng ký của nhân viên chưa lưu phiếu: spec này không thử popup
  test.beforeEach(({ page }) => skipNewPeriodPopup(page));

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
        expect((await box.getByRole('button', { name: /^Đăng xuất/ }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expectNoContrastViolations(page);
      }
      if (isMobile(info)) {
        // Thanh trên điện thoại không còn VI/EN: đổi ngôn ngữ ngay trong sheet "Tôi"
        await expect(page.getByRole('banner').getByRole('radio')).toHaveCount(0);
        const en = box.getByRole('radio', { name: 'English', exact: true });
        expect((await en.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await en.click();
        const boxEn = page.getByRole('dialog', { name: 'Account' });
        await expect(boxEn.getByRole('radio', { name: 'English', exact: true })).toHaveAttribute('aria-checked', 'true');
        await expectNoContrastViolations(page);
        await boxEn.getByRole('radio', { name: 'Tiếng Việt', exact: true }).click();
        await expect(box.getByRole('radio', { name: 'Tiếng Việt', exact: true })).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Escape');
        await expect(box).toBeHidden();
      } else {
        // thanh trên không còn VI/EN — đổi ngôn ngữ trong hộp tài khoản
        // hộp tài khoản nằm trong banner: mọi VI/EN trong banner phải là của hộp
        await expect(page.getByRole('banner').getByRole('radio')).toHaveCount(await box.getByRole('radio').count());
        await box.getByRole('radio', { name: 'English', exact: true }).click();
        const boxEn = page.getByRole('dialog', { name: 'Account' });
        await expect(boxEn.getByRole('radio', { name: 'English', exact: true })).toHaveAttribute('aria-checked', 'true');
        await boxEn.getByRole('radio', { name: 'Tiếng Việt', exact: true }).click();
        await expect(box.getByRole('radio', { name: 'Tiếng Việt', exact: true })).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Escape');
        await expect(box).toBeHidden();
      }
    } finally {
      deleteTestUsers(sub);
    }
  });
});
