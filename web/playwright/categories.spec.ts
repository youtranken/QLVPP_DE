import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, expectReorderArrowKeepsFocus, isMobile, psql, removeTestItem, shot } from './helpers';

const TONES = ['xanh đá', 'rêu', 'cát mật', 'lam ngọc', 'đất hồng', 'tím khói', 'ô liu'];

async function createCategory(request: APIRequestContext, name: string, sortOrder?: number): Promise<string> {
  const res = await request.post('/api/admin/item-categories', { headers: devHeaders('admin'), data: { name, sort_order: sortOrder } });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function createItem(request: APIRequestContext, data: { name: string; name_en: string; category_id: string }): Promise<string> {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: { purpose: 'item_image', file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(file.status()).toBe(201);
  const res = await request.post('/api/admin/items', { headers, data: { ...data, unit: 'cai', image_file_id: (await file.json()).id, max_qty: 5 } });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
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

const menuButtons = (page: Page) => page.getByRole('table').getByRole('button', { name: /^Thao tác cho / });
const nameOf = (page: Page, i: number | 'last') => (i === 'last' ? menuButtons(page).last() : menuButtons(page).nth(i));
const toneOf = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: `Thao tác cho ${name}`, exact: true }) }).locator('[title]:not([aria-hidden="true"])').first();
const openMenu = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `Thao tác cho ${name}`, exact: true }).click();
  return page.getByRole('menu', { name: `Thao tác cho ${name}` });
};

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
      await expect(page.getByRole('heading', { level: 1, name: 'Nhóm & đơn vị' })).toBeVisible();
      await expect(nameOf(page, 'last')).toHaveAttribute('aria-label', `Thao tác cho ${second}`);
      const total = await menuButtons(page).count();
      await expect(toneOf(page, second)).toHaveAttribute('title', TONES[(total - 1) % 7]);
      await expect(toneOf(page, first)).toHaveAttribute('title', TONES[(total - 2) % 7]);

      await expect(page.getByRole('button', { name: `Đưa ${second} lên` })).toHaveCount(0);
      await page.getByRole('button', { name: 'Sắp xếp' }).click();
      await page.getByRole('button', { name: `Đưa ${second} lên` }).click();
      await expect(page.getByText('Thứ tự đã đổi (2 nhóm)')).toBeVisible();
      await expect(toneOf(page, second)).toHaveAttribute('title', TONES[(total - 2) % 7]);
      const saved = page.waitForResponse((r) => r.url().includes('/api/admin/item-categories/') && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Lưu thứ tự' }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByRole('status').filter({ hasText: /^Đã lưu thứ tự \d+ nhóm$/ })).toBeVisible();
      await expect(page.getByText(/^Thứ tự đã đổi/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sắp xếp' })).toBeVisible();

      await page.reload();
      await expect(nameOf(page, 'last')).toHaveAttribute('aria-label', `Thao tác cho ${first}`);
      await expect(nameOf(page, total - 2)).toHaveAttribute('aria-label', `Thao tác cho ${second}`);
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
      await dialog.getByRole('button', { name: 'Quay lại' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(dialog).toBeHidden();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestCategories();
      restoreOrder(original);
    }
  });

  test('E9-S5 Nhóm món: menu ⋯ Ngừng nhóm báo số món sẽ ẩn; Danh mục thu gọn mặc định, cột Tên tiếng Anh, nhãn "Nhóm đang ngừng"', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW nhóm ${stamp} ngừng`;
    const names = [`PW món ${stamp} 1`, `PW món ${stamp} 2`];
    const itemIds: string[] = [];
    deleteTestCategories();
    try {
      const catId = await createCategory(request, category);
      for (const name of names) itemIds.push(await createItem(request, { name, name_en: `PW item EN ${name.slice(-1)}`, category_id: catId }));

      await page.goto('/admin/categories');
      await expect(page.getByRole('row').filter({ hasText: category }).getByRole('switch')).toHaveCount(0);
      const menu = await openMenu(page, category);
      await expect(menu.getByRole('menuitem')).toHaveText(['Sửa', 'Ngừng nhóm']);
      await menu.getByRole('menuitem', { name: 'Ngừng nhóm' }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(confirm.getByText('2 món sẽ ẩn với nhân viên. Dùng lại nhóm chỉ hiện lại những món này; món đã ngừng riêng vẫn ngừng.')).toBeVisible();
      await shot(page, info, 'categories-pause-confirm', false);
      await confirm.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(page.getByRole('row').filter({ hasText: category }).getByText('Đã ngừng', { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

      await page.goto('/admin/catalog?view=table');
      await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Thu tất cả' })).toBeVisible();
      const head = page.getByRole('row').filter({ hasText: category });
      await expect(head.getByText('Nhóm đang ngừng')).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: names[0] });
      await expect(row.getByText('Ngừng theo nhóm')).toBeVisible();
      await expect(row.getByText('PW item EN 1')).toBeVisible();
      if (!isMobile(info)) await expect(page.getByRole('columnheader', { name: 'Tên tiếng Anh' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('row').filter({ hasText: names[1] })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog-paused-group', false);
    } finally {
      for (const id of itemIds) await removeTestItem(request, id);
      deleteTestCategories();
    }
  });

  test('E9-S5 Nhóm món: Enter trên ▲▼ giữ tiêu điểm ở mũi tên của dòng vừa dời, tới dòng cuối chuyển sang ▲', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { level: 1, name: 'Nhóm & đơn vị' })).toBeVisible();
    await expectReorderArrowKeepsFocus(page, /^Thao tác cho /);
  });

  test('E9-S5 Nhóm món: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"', async ({ page }) => {
    await page.route('**/api/item-categories?all=1', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/admin/categories');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });

  test('V2D-15 group panel: mở nhóm, tắt một món + Hoàn tác, ngừng nhóm, bật lại; axe 390 khi panel mở', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW nhóm ${stamp} panel`;
    const names = [`PW món ${stamp} 1`, `PW món ${stamp} 2`, `PW món ${stamp} 3`];
    const itemIds: string[] = [];
    deleteTestCategories();
    try {
      const catId = await createCategory(request, category);
      for (const name of names) itemIds.push(await createItem(request, { name, name_en: `PW item EN ${name.slice(-1)}`, category_id: catId }));

      await page.goto('/admin/categories');
      await page.getByRole('button', { name: category, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]group=${catId}`));
      const panel = page.getByRole('dialog', { name: `Nhóm ${category}` });
      await expect(panel.getByRole('listitem')).toHaveCount(3);
      if (isMobile(info)) await expectNoContrastViolations(page);

      const one = panel.getByRole('switch', { name: names[0], exact: true });
      await one.click();
      await expect(one).toHaveAttribute('aria-checked', 'false');
      await expect(panel.getByText(`Đã ngừng ${names[0]}`)).toBeVisible();
      await panel.getByRole('button', { name: 'Hoàn tác' }).click();
      await expect(one).toHaveAttribute('aria-checked', 'true');
      await one.click();
      await expect(one).toHaveAttribute('aria-checked', 'false');

      await panel.getByRole('switch', { name: `Nhóm ${category}` }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(confirm.getByText(/^2 món trong nhóm sẽ ẩn/)).toBeVisible();
      await confirm.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(panel.getByText('Ngừng theo nhóm')).toHaveCount(2);
      await expect(panel.getByText('Ngừng riêng')).toHaveCount(1);
      await expect(panel.getByRole('switch', { name: names[1], exact: true })).toBeDisabled();
      await expect(panel.getByText('Bật lại nhóm để đổi từng món')).toBeVisible();

      await panel.getByRole('switch', { name: `Nhóm ${category}` }).click();
      await expect(page.getByText('2 món dùng lại; 1 món vẫn ngừng riêng')).toBeVisible();
      await expect(panel.getByRole('switch', { name: names[1], exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(one).toHaveAttribute('aria-checked', 'false');
      await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'v2d-15-group-panel', false);
    } finally {
      for (const id of itemIds) await removeTestItem(request, id);
      deleteTestCategories();
    }
  });
});
