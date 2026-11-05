import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { deleteTestUsers, expectNoContrastViolations, isMobile, psql, seedActiveUser } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-10-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` });
}

function seedNotification(sub: string, topic: string, params: object, link: string, eventId: string, ageMin: number) {
  psql(`INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link, created_at)
    VALUES ('${sub}', '${eventId}', '${topic}', '${JSON.stringify(params)}'::jsonb, '${link}', now() - interval '${ageMin} minutes')`);
}

const asIdentity = (page: Page, sub: string, role: 'member' | 'admin') =>
  page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-user-sub': sub, 'x-dev-role': role } }));

test.describe('E6-S1 chuông', () => {
  test('E6-S1 chuông: member thấy huy hiệu 2, bấm một mục thì đánh dấu đã đọc và về trang đích', async ({ page }, info) => {
    const sub = `pw-notif-m-${Date.now()}-${info.project.name}`;
    seedActiveUser(sub, `PW Chuông ${info.project.name}`);
    await asIdentity(page, sub, 'member');
    try {
      seedNotification(sub, 'request_delivered', { ym: '2026-09' }, '/history/2026-09', `pw:${sub}:1`, 1);
      seedNotification(sub, 'low_stock', { name: 'PW Bút', name_en: 'PW Pen', stock_qty: 2 }, '/', `pw:${sub}:2`, 5);
      await page.goto('/');
      const bell = page.getByRole('banner').getByRole('button', { name: 'Thông báo, 2 chưa đọc' });
      await expect(bell).toBeVisible();
      await expect(bell).toHaveText('2');
      if (isMobile(info)) {
        const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
        await expect(nav.getByRole('link')).toHaveCount(3);
      }

      await bell.click();
      const panel = page.getByRole('dialog', { name: 'Thông báo' });
      await expect(panel.getByText('Phiếu tháng 9 của bạn đã được giao đủ.')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'member-open');

      await panel.getByRole('button', { name: /Phiếu tháng 9 của bạn đã được giao đủ/ }).click();
      await expect(page).toHaveURL(/\/history\/2026-09$/);
      await expect(page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' })).toBeVisible();
      expect(psql(`SELECT count(*) FROM in_app_notifications WHERE user_sub = '${sub}' AND read_at IS NULL`)).toBe('1');

      await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }).click();
      await page.getByRole('button', { name: 'Đánh dấu đã đọc tất cả' }).click();
      await expect(page.getByRole('button', { name: 'Thông báo, 0 chưa đọc' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Thông báo' })).toHaveCount(0);
    } finally {
      psql(`DELETE FROM in_app_notifications WHERE user_sub = '${sub}'`);
      deleteTestUsers(sub);
    }
  });

  test('E6-S1 chuông: Hành chính thấy chuông trong shell quản lý, bấm thông báo về trang Kho', async ({ page }, info) => {
    const sub = `pw-notif-a-${Date.now()}-${info.project.name}`;
    seedActiveUser(sub, `PW Chuông Admin ${info.project.name}`);
    await asIdentity(page, sub, 'admin');
    try {
      seedNotification(sub, 'low_stock', { name: 'PW Bút', name_en: 'PW Pen', stock_qty: 2 }, '/admin/stock?filter=low', `pw:${sub}:1`, 1);
      await page.goto('/admin/summary');
      // ≥ 768 chuông nằm ở khối người dùng cuối sidebar (Plan v2-A); < 768 ở thanh trên
      const bell = (isMobile(info) ? page.getByRole('banner') : page.locator('.side__user')).getByRole('button', { name: 'Thông báo, 1 chưa đọc' });
      await expect(bell).toBeVisible();
      await bell.click();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'admin-open');
      await page.getByRole('dialog', { name: 'Thông báo' }).getByRole('button', { name: /PW Bút sắp hết kho, còn 2/ }).click();
      await expect(page).toHaveURL(/\/admin\/stock\?filter=low$/);
      await expect(page.getByRole('button', { name: 'Thông báo, 0 chưa đọc' })).toBeVisible();
    } finally {
      psql(`DELETE FROM in_app_notifications WHERE user_sub = '${sub}'`);
      deleteTestUsers(sub);
    }
  });
});
