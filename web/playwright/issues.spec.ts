import { expect, test } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, removeTestItem, shot, seedPwItem } from './helpers';

test.describe('AD-38 Xuất lẻ trong Tủ / Kho (dev-identity admin)', () => {
  asRole('admin');

  test('AD-38 /admin/issues chuyển tới Tủ / Kho tab Lịch sử lọc Xuất lẻ (cột Người xuất); nút chính "Xuất lẻ một món": gõ 21 khi tủ 19 → lỗi dưới ô + nút khóa có lý do; Hủy → không POST', async ({ page }, info) => {
    const item = await seedPwItem(page, { stock: 19 });
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/issue')) posts.push(r.url());
    });
    try {
      await page.goto('/admin/issues');
      await expect(page).toHaveURL(/\/admin\/stock\?tab=history&kind=issue/);
      await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Xuất lẻ' })).toHaveCount(0);
      if (!isMobile(info)) await expect(page.getByRole('columnheader', { name: 'Người xuất' })).toBeVisible();
      await page.getByRole('button', { name: 'Xuất lẻ một món' }).click();
      const dialog = page.getByRole('dialog', { name: /^Xuất lẻ/ });
      await dialog.getByRole('searchbox', { name: 'Tìm món' }).fill(item.name);
      await dialog.getByRole('list', { name: 'Món còn trong tủ' }).getByRole('button', { name: new RegExp(`^${item.name}`) }).click();
      const qty = dialog.getByLabel('Số lượng');
      await qty.fill('21');
      await expect(qty).toHaveAccessibleDescription(/Tủ chỉ còn 19/);
      const submit = dialog.getByRole('button', { name: 'Xuất', exact: true });
      await expect(submit).toBeDisabled();
      await expect(submit).toHaveAccessibleDescription(/.+/);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'g6-issues', false);
      await dialog.getByRole('button', { name: 'Hủy' }).click();
      await expect(dialog).toBeHidden();
      expect(posts).toEqual([]);
    } finally {
      await removeTestItem(page.request, item.id);
    }
  });
});
