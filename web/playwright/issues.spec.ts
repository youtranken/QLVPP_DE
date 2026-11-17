import { expect, test } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, removeTestItem, shot, seedPwItem } from './helpers';

test.describe('G6 Xuất lẻ (dev-identity admin)', () => {
  asRole('admin');

  test('G6 Xuất lẻ: trang riêng, hộp chọn món có tìm, gõ 21 khi tủ 19 → lỗi dưới ô + nút khóa có lý do; Hủy → không POST', async ({ page }, info) => {
    const item = await seedPwItem(page, { stock: 19 });
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/issue')) posts.push(r.url());
    });
    try {
      await page.goto('/admin/issues');
      await expect(page.getByRole('heading', { level: 1, name: 'Xuất lẻ' })).toBeVisible();
      await expect(page.getByText(/^Đang hiện \d+ lần xuất/)).toBeVisible();
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
