import { expect, test } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, pickOption, removeTestItem, shot, seedPwItem } from './helpers';

test.describe('G5 Tủ / Kho (dev-identity admin)', () => {
  asRole('admin');

  test('G5 Tủ / Kho: cột Tồn kho lần nhập trước · Cần thêm, lọc Thiếu kỳ này/Sắp hết/Hết; tab Lịch sử nhập xuất lọc Nhập, tổng Nhập/Ra', async ({ page }, info) => {
    const item = await seedPwItem(page);
    try {
      const buy = await page.request.post(`/api/admin/items/${item.id}/stock`, { headers: devHeaders('admin'), data: { delta: 7, reason: 'purchase', note: 'PW G5 nhập' } });
      expect(buy.ok()).toBe(true);
      await page.goto('/admin/stock');
      await expect(page.getByRole('radio', { name: 'Trong tủ' })).toBeChecked();
      if (isMobile(info)) await expect(page.getByRole('combobox', { name: 'Lọc theo tình trạng tồn' })).toBeVisible();
      else {
        for (const f of [/^Thiếu kỳ này/, /^Sắp hết/, /^Hết/]) await expect(page.getByRole('radio', { name: f })).toBeVisible();
        for (const h of ['Tồn kho lần nhập trước', 'Cần thêm']) await expect(page.getByRole('columnheader', { name: new RegExp(h) })).toBeVisible();
      }

      await page.getByRole('radio', { name: 'Lịch sử nhập xuất' }).click();
      await expect(page).toHaveURL(/tab=history/);
      const ledger = page.getByRole('table', { name: 'Lịch sử nhập xuất' });
      await expect(ledger.getByRole('row').filter({ hasText: item.name }).filter({ hasText: '+7' })).toBeVisible();
      if (isMobile(info)) await pickOption(page.getByRole('combobox', { name: 'Lọc theo loại' }), 'Nhập');
      else await page.getByRole('radio', { name: 'Nhập', exact: true }).click();
      await expect(page).toHaveURL(/kind=purchase/);
      await expect(page.getByText(/^Nhập \+\d+ · Ra 0$/)).toBeVisible();
      await expect(ledger.getByRole('row').filter({ hasText: item.name }).filter({ hasText: '+7' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'không cuộn ngang').toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'g5-ledger', false);
    } finally {
      await removeTestItem(page.request, item.id);
    }
  });
});
