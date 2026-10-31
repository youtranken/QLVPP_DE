import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, psql, shot } from './helpers';

const TONES = ['xanh đá', 'rêu', 'cát mật', 'lam ngọc', 'đất hồng', 'tím khói', 'ô liu'];

async function createCategory(request: APIRequestContext, name: string, sortOrder: number) {
  const res = await request.post('/api/admin/item-categories', { headers: devHeaders('admin'), data: { name, sort_order: sortOrder } });
  expect(res.status()).toBe(201);
}

// "Lưu thứ tự" đánh số lại mọi nhóm lệch vị trí*10: chụp sort_order nhóm thật để trả lại sau test
function snapshotOrder(): string {
  return psql(`SELECT string_agg(format('(%L::uuid, %s)', id, sort_order), ', ') FROM item_categories WHERE name NOT LIKE 'PW nhóm %'`);
}

function restoreOrder(values: string) {
  if (values) psql(`UPDATE item_categories c SET sort_order = v.s FROM (VALUES ${values}) AS v(id, s) WHERE c.id = v.id AND c.sort_order <> v.s`);
}

// Nhóm thử còn sót từ các lần chạy trước (không có món) làm lệch vị trí/màu của test
function deleteTestCategories() {
  psql(`DELETE FROM item_categories c WHERE c.name LIKE 'PW nhóm %' AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id)`);
}

const nameButtons = (page: Page) => page.getByRole('table').getByRole('button', { name: /^Sửa tên nhóm / });
const toneOf = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: `Sửa tên nhóm ${name}`, exact: true }) }).locator('[title]').first();

test.describe('E9-S5 Nhóm món M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const first = `PW nhóm ${stamp} A`;
    const second = `PW nhóm ${stamp} B`;
    deleteTestCategories();
    const original = snapshotOrder();
    try {
      await createCategory(request, first, 900_000);
      await createCategory(request, second, 900_010);
      await page.goto('/admin/categories');
      await expect(page.getByRole('heading', { level: 1, name: 'Nhóm món' })).toBeVisible();
      await expect(nameButtons(page).last()).toHaveText(second);
      const total = await nameButtons(page).count();
      await expect(toneOf(page, second)).toHaveAttribute('title', TONES[(total - 1) % 7]);
      await expect(toneOf(page, first)).toHaveAttribute('title', TONES[(total - 2) % 7]);

      await page.getByRole('button', { name: `Đưa ${second} lên` }).click();
      await expect(page.getByText('Thứ tự đã đổi (2 nhóm)')).toBeVisible();
      await expect(toneOf(page, second)).toHaveAttribute('title', TONES[(total - 2) % 7]);
      const saved = page.waitForResponse((r) => r.url().includes('/api/admin/item-categories/') && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Lưu thứ tự' }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByRole('status').filter({ hasText: /^Đã lưu thứ tự \d+ nhóm$/ })).toBeVisible();
      await expect(page.getByText(/^Thứ tự đã đổi/)).toHaveCount(0);

      await page.reload();
      await expect(nameButtons(page).last()).toHaveText(first);
      await expect(nameButtons(page).nth(total - 2)).toHaveText(second);
      await expect(toneOf(page, second)).toHaveAttribute('title', TONES[(total - 2) % 7]);
      await expect(toneOf(page, first)).toHaveAttribute('title', TONES[(total - 1) % 7]);

      await page.getByRole('main').getByRole('button', { name: 'Thêm nhóm' }).click();
      const dialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
      await expect(dialog.getByText(`Nhóm mới đứng thứ ${total + 1} và nhận màu ${TONES[total % 7]}.`)).toBeVisible();
      await dialog.getByLabel('Tên nhóm').fill(first.toUpperCase());
      await dialog.getByRole('button', { name: 'Thêm nhóm' }).click();
      await expect(dialog.getByLabel('Tên nhóm')).toHaveAttribute('aria-invalid', 'true');
      await expect(dialog.getByText('Đã có nhóm tên này.')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'categories-add-dup', false);
      await dialog.getByRole('button', { name: 'Hủy' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(dialog).toBeHidden();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestCategories();
      restoreOrder(original);
    }
  });

  test('E9-S5 Nhóm món: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"', async ({ page }) => {
    await page.route('**/api/item-categories?all=1', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/admin/categories');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
