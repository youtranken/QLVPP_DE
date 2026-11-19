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

// Nhóm thử sót (không có món) làm lệch vị trí/màu: xóa mọi nhóm thử của spec này cùng project (tên có hậu tố sau project, khác nhóm của catalog); nhóm project khác chỉ xóa khi đã cũ vì có thể đang chạy song song
function deleteTestCategories(project: string) {
  const own = project.replace(/'/g, "''");
  psql(`DELETE FROM item_categories c WHERE c.name LIKE 'PW nhóm %' AND (c.name LIKE '%-${own} %' OR c.created_at < now() - interval '15 minutes') AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id)`);
}

const menuButtons = (page: Page) => page.getByRole('table').getByRole('button', { name: /^Sửa nhóm / });
const nameOf = (page: Page, i: number | 'last') => (i === 'last' ? menuButtons(page).last() : menuButtons(page).nth(i));
const toneOf = (page: Page, name: string) =>
  // Chấm màu là trang trí (aria-hidden), tên màu nằm ở title của chấm
  page.getByRole('row').filter({ has: page.getByRole('button', { name: `Sửa nhóm ${name}`, exact: true }) }).locator('.cg-dot[title]').first();

test.describe('E9-S5 Nhóm món M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const first = `PW nhóm ${stamp} A`;
    const second = `PW nhóm ${stamp} B`;
    deleteTestCategories(info.project.name);
    const original = snapshotOrder();
    try {
      // Đứng sau mọi nhóm hiện có, kể cả nhóm thử sót còn món mà dọn không xóa được
      const tail = Number(psql(`SELECT COALESCE(MAX(sort_order), 0) FROM item_categories`)) + 10;
      await createCategory(request, first, tail);
      await createCategory(request, second, tail + 10);
      await page.goto('/admin/categories');
      await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
      await expect(nameOf(page, 'last')).toHaveAttribute('aria-label', `Sửa nhóm ${second}`);
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
      await expect(nameOf(page, 'last')).toHaveAttribute('aria-label', `Sửa nhóm ${first}`);
      await expect(nameOf(page, total - 2)).toHaveAttribute('aria-label', `Sửa nhóm ${second}`);
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
      await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(dialog).toBeHidden();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestCategories(info.project.name);
      restoreOrder(original);
    }
  });

  test('Nhóm 1 · mục 8: Tạm ngưng nhóm báo số món sẽ ẩn, tên gạch + "Tạm ngưng"; ở Sản phẩm nhóm tự thu gọn, món có nhãn "Tạm ngưng"; Dùng lại nhóm bật lại', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW nhóm ${stamp} ngừng`;
    const names = [`PW món ${stamp} 1`, `PW món ${stamp} 2`];
    const itemIds: string[] = [];
    deleteTestCategories(info.project.name);
    try {
      const catId = await createCategory(request, category);
      for (const name of names) itemIds.push(await createItem(request, { name, name_en: `PW item EN ${name.slice(-1)}`, category_id: catId }));

      await page.goto('/admin/categories');
      const catRow = page.getByRole('row').filter({ hasText: category });
      await expect(catRow.getByRole('switch')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Nhân viên sẽ thấy' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Thao tác cho ${category}` })).toHaveCount(0);
      await expect(catRow.getByRole('button', { name: `Sửa nhóm ${category}` })).toBeVisible();
      // Sửa nhóm là ngăn kéo phải, bảng vẫn thấy phía sau; chưa tìm thì không có "Đang hiện"
      await expect(page.getByText(/^Đang hiện \d+\/\d+ nhóm$/)).toHaveCount(0);
      await catRow.getByRole('button', { name: `Sửa nhóm ${category}` }).click();
      const edit = page.getByRole('dialog', { name: 'Sửa nhóm' });
      await expect(edit).toHaveAttribute('data-placement', 'end');
      // Ngăn kéo là modal (nền aria-hidden) nhưng bảng vẫn thấy được phía sau
      await expect(page.getByRole('table', { includeHidden: true })).toBeVisible();
      await edit.getByRole('button', { name: 'Hủy' }).click();
      await expect(edit).toBeHidden();
      await catRow.getByRole('button', { name: `Tạm ngưng nhóm ${category}` }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(confirm.getByText('2 món sẽ ẩn với nhân viên. Dùng lại nhóm chỉ hiện lại những món này; món đã ngừng riêng vẫn ngừng.')).toBeVisible();
      await shot(page, info, 'categories-pause-confirm', false);
      await confirm.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(catRow.getByText('Tạm ngưng', { exact: true })).toBeVisible();
      expect(await catRow.locator('.cg-name--stopped').evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('line-through');
      await expect(page.getByRole('status').filter({ hasText: `Đã tạm ngưng nhóm ${category}` }).getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

      await page.goto('/admin/catalog?view=table');
      await expect(page.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
      const head = page.getByRole('row').filter({ hasText: category });
      await expect(head.getByText('Tạm ngưng cả nhóm')).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: names[0] })).toHaveCount(0);
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(names[0]);
      const row = page.getByRole('row').filter({ hasText: names[0] });
      await expect(row.getByText('Tạm ngưng', { exact: true })).toBeVisible();
      await expect(row.getByText('PW item EN 1')).toBeVisible();
      if (!isMobile(info)) await expect(page.getByRole('columnheader', { name: 'Tên tiếng Anh' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog-paused-group', false);

      await page.goto('/admin/categories');
      await catRow.getByRole('button', { name: `Dùng lại nhóm ${category}` }).click();
      await expect(catRow.getByRole('button', { name: `Tạm ngưng nhóm ${category}` })).toBeVisible();
    } finally {
      for (const id of itemIds) await removeTestItem(request, id);
      deleteTestCategories(info.project.name);
    }
  });

  test('E9-S5 Nhóm món: Enter trên ▲▼ giữ tiêu điểm ở mũi tên của dòng vừa dời, tới dòng cuối chuyển sang ▲', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
    await expectReorderArrowKeepsFocus(page, /^Sửa nhóm /);
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
    deleteTestCategories(info.project.name);
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
      await expect(panel.getByText(`Đã tạm ngưng ${names[0]}`)).toBeVisible();
      await panel.getByRole('button', { name: 'Hoàn tác' }).click();
      await expect(one).toHaveAttribute('aria-checked', 'true');
      // Công tắc lạc quan bật ngay nhưng bấm khi lượt Hoàn tác còn đang gửi/tải lại bị bỏ qua (có chủ ý): bấm lại tới khi nhận
      await expect(async () => {
        if ((await one.getAttribute('aria-checked')) === 'true') await one.click();
        await expect(one).toHaveAttribute('aria-checked', 'false', { timeout: 1_000 });
      }).toPass();
      // Công tắc đổi lạc quan trước khi server lưu; chờ lưu xong thì hộp ngừng nhóm mới đếm đúng 2 món
      await expect.poll(() => psql(`SELECT active FROM items WHERE id = '${itemIds[0]}'`)).toBe('f');

      await panel.getByRole('switch', { name: `Nhóm ${category}` }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(confirm.getByText(/^2 món sẽ ẩn với nhân viên/)).toBeVisible();
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
      deleteTestCategories(info.project.name);
    }
  });
});
