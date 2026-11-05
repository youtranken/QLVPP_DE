import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { asRole, devHeaders, deleteTestFiles, expectNoContrastViolations, isMobile, psql, removeTestItem, shot } from './helpers';

// Ảnh đã tải xong thật (không phải icon ảnh vỡ) và GET /api/files/:id trả 200
async function expectImageServed(page: Page, img: Locator) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const src = (await img.getAttribute('src'))!;
  expect(src).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
  expect(await page.evaluate((u) => fetch(u).then((r) => r.status), src)).toBe(200);
}

// Lỗi giữa chừng vẫn phải dọn: nhóm/món thử không được lẫn vào trang đăng ký của nhân viên trên DB dev
async function cleanupCatalog(request: APIRequestContext, itemName: string, category: string) {
  const headers = devHeaders('admin');
  const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers })).json();
  const item = items.find((i) => i.name === itemName);
  if (item) await removeTestItem(request, item.id);
  const cats: { id: string; name: string }[] = await (await request.get('/api/item-categories?all=1', { headers })).json();
  const cat = cats.find((c) => c.name === category);
  if (cat) await request.patch(`/api/admin/item-categories/${cat.id}`, { headers, data: { active: false } });
}

test.describe('E1-S3 Danh mục và Nhóm món (dev-identity admin)', () => {
  asRole('admin');

  test('E1-S3 tạo nhóm + món có ảnh → món hiện trong bảng với thumbnail; ngừng món qua xác nhận', async ({
    page,
    request,
  }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW nhóm ${stamp}`;
    const itemName = `PW món ${stamp}`;

    try {
      await page.goto('/admin/categories');
      await expect(page.getByRole('heading', { level: 1, name: 'Nhóm món' })).toBeVisible();
      await page.getByRole('button', { name: 'Thêm nhóm' }).click();
      const catDialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
      await catDialog.getByLabel('Tên nhóm').fill(category);
      await catDialog.getByLabel('Tên tiếng Anh').fill(`PW category ${stamp}`);
      await catDialog.getByRole('button', { name: 'Thêm nhóm' }).click();
      await expect(catDialog).toBeHidden();
      const catTable = page.getByRole('table');
      await expect(catTable.getByRole('button', { name: `Thao tác cho ${category}` })).toBeVisible();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toHaveCount(0);
      await page.getByRole('button', { name: 'Sắp xếp' }).click();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeDisabled();
      await page.getByRole('button', { name: `Đưa ${category} lên` }).click();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeEnabled();
      await page.getByRole('button', { name: 'Hủy' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(page.getByRole('button', { name: 'Sắp xếp' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'categories');

      await page.goto('/admin/catalog?view=table');
      await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Thêm món' });
      await form.getByRole('button', { name: 'Thêm món' }).click();
      await expect(form.getByText('Cần thêm: ảnh, tên, ĐVT.')).toBeVisible();
      await expect(form.getByLabel('Chụp hoặc chọn ảnh')).toHaveAttribute('aria-invalid', 'true');
      await form.getByLabel('Tên món').fill(itemName);
      await form.getByLabel('Đơn vị tính').selectOption({ label: 'hộp' });
      await form.getByLabel('Quy cách').fill('hộp 10 cây');
      await form.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio', { name: category }).click();
      const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
      await form.getByLabel('Chụp hoặc chọn ảnh').setInputFiles('playwright/fixtures/item.png');
      expect((await uploaded).status()).toBe(201);
      await expectImageServed(page, form.getByRole('img', { name: 'Ảnh món' }));
      await expect(form.getByText(/^Cần thêm/)).toHaveCount(0);
      // Ngăn kéo cố định: chụp khung nhìn, không kéo cả bảng dài phía sau
      await shot(page, info, 'item-form', false);
      await form.getByRole('button', { name: 'Thêm món' }).click();
      await expect(form).toBeHidden();

      await page.getByRole('group', { name: 'Lọc theo nhóm' }).getByRole('button', { name: category }).click();
      await expect(page.getByText(itemName, { exact: true })).toBeVisible();
      await expect(page.getByText('hộp 10 cây')).toBeVisible();
      await expectImageServed(page, page.getByRole('img', { name: itemName }));
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog');

      await page.getByRole('switch', { name: `Ngừng ${itemName}` }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng ${itemName}?` });
      await confirm.getByRole('button', { name: 'Ngừng', exact: true }).click();
      await expect(page.getByText(itemName, { exact: true })).toBeHidden();
      await page.getByRole('switch', { name: /^Hiện món đã ngừng/ }).click();
      const itemRow = page.getByRole('row').filter({ hasText: itemName });
      await expect(itemRow.getByText('Ngừng', { exact: true })).toBeVisible();
      await expect(itemRow.getByRole('switch', { name: `Mở lại ${itemName}` })).toBeVisible();

      await page.getByRole('main').getByRole('link', { name: 'Nhóm món' }).click();
      await page.getByRole('button', { name: `Thao tác cho ${category}` }).click();
      await page.getByRole('menu', { name: `Thao tác cho ${category}` }).getByRole('menuitem', { name: 'Ngừng nhóm' }).click();
      const pause = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(pause.getByText('0 món trong nhóm sẽ ẩn khỏi trang Đăng ký. Mở lại nhóm thì món hiện lại.')).toBeVisible();
      await pause.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(page.getByRole('row').filter({ hasText: category }).getByText('Đã ngừng', { exact: true })).toBeVisible();
    } finally {
      await cleanupCatalog(request, itemName, category);
    }
  });

  test('E1-S5 trang Danh mục hiện nhãn "Thiếu ảnh" cho món seed', async ({ page }, info) => {
    await page.goto('/admin/catalog?view=table');
    const search = page.getByRole('searchbox', { name: /^Tìm trong \d+ món$/ });
    await search.fill('Giấy A4');
    const row = page.getByRole('row').filter({ hasText: 'Giấy A4' });
    await expect(row.getByText('Thiếu ảnh', { exact: true })).toBeVisible();
    await expect(row.getByText('Chỉ Hành chính')).toBeVisible();
    await search.fill('');
    await expect(page.getByText('Bút bi xanh')).toBeHidden();
    await shot(page, info, 'catalog-seed', false);
  });
});

async function createItemViaApi(request: APIRequestContext, name: string): Promise<string> {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: { purpose: 'item_image', file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(file.status()).toBe(201);
  const res = await request.post('/api/admin/items', { headers, data: { name, unit: 'cai', image_file_id: (await file.json()).id, max_qty: 5 } });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function editMax(page: Page, name: string, from: number, to: number) {
  await page.getByRole('button', { name: `Sửa tối đa/tháng của ${name}, đang là ${from}` }).click();
  const input = page.getByRole('spinbutton', { name: `Sửa tối đa/tháng của ${name}, đang là ${from}` });
  await input.fill(String(to));
  await input.press('Enter');
  return input;
}

test.describe('E9-S5 Danh mục M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5 Danh mục: sửa tại chỗ tối đa 0/1/999/1000, thêm món có ảnh trong ngăn kéo, hàng loạt đổi tối đa', async ({ page, request }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const nameA = `PW E9 ${stamp} A`;
    const nameB = `PW E9 ${stamp} B`;
    const ids: string[] = [];
    try {
      await page.goto('/admin/catalog?view=table');
      await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Thêm món' });
      await drawer.getByLabel('Tên món').fill(nameA);
      await drawer.getByLabel('Đơn vị tính').selectOption({ label: 'cái' });
      await drawer.getByLabel('Tối đa mỗi tháng').fill('5');
      const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
      await drawer.getByLabel('Chụp hoặc chọn ảnh').setInputFiles('playwright/fixtures/item.png');
      expect((await uploaded).status()).toBe(201);
      await expectImageServed(page, drawer.getByRole('img', { name: 'Ảnh món' }));
      const created = page.waitForResponse((r) => r.url().endsWith('/api/admin/items') && r.request().method() === 'POST');
      await drawer.getByRole('button', { name: 'Thêm món' }).click();
      const createdRes = await created;
      expect(createdRes.status()).toBe(201);
      ids.push((await createdRes.json()).id);
      await expect(drawer).toBeHidden();
      await expect(page.getByRole('status').filter({ hasText: `Đã thêm ${nameA}` })).toBeVisible();

      await page.getByRole('searchbox', { name: /^Tìm trong \d+ món$/ }).fill(stamp);
      const rowA = page.getByRole('row').filter({ hasText: nameA });
      await expectImageServed(page, rowA.getByRole('img', { name: nameA }));

      for (const [from, bad] of [[5, 0], [5, 1000]] as const) {
        const input = await editMax(page, nameA, from, bad);
        await expect(rowA.getByText('Tối đa từ 1 đến 999.')).toBeVisible();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await input.press('Escape');
      }
      await editMax(page, nameA, 5, 1);
      await expect(page.getByRole('status').filter({ hasText: `Đã lưu tối đa 1 cho ${nameA}` })).toBeVisible();
      await editMax(page, nameA, 1, 999);
      await expect(page.getByRole('status').filter({ hasText: `Đã lưu tối đa 999 cho ${nameA}` })).toBeVisible();
      await expect(rowA.getByRole('button', { name: `Sửa tối đa/tháng của ${nameA}, đang là 999` })).toBeVisible();

      ids.push(await createItemViaApi(request, nameB));
      await page.reload();
      const rowB = page.getByRole('row').filter({ hasText: nameB });
      await rowA.getByRole('checkbox', { name: 'Chọn dòng' }).check();
      await rowB.getByRole('checkbox', { name: 'Chọn dòng' }).check();
      await page.getByRole('toolbar').getByRole('button', { name: 'Đổi tối đa/tháng' }).click();
      const bulk = page.getByRole('dialog', { name: 'Đổi tối đa/tháng của 2 món' });
      await bulk.getByLabel('Tối đa mỗi tháng').fill('7');
      await bulk.getByRole('button', { name: 'Đổi tối đa/tháng' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Đã đổi tối đa/tháng của 2 món' })).toBeVisible();
      await expect(rowA.getByRole('button', { name: `Sửa tối đa/tháng của ${nameA}, đang là 7` })).toBeVisible();
      await expect(rowB.getByRole('button', { name: `Sửa tối đa/tháng của ${nameB}, đang là 7` })).toBeVisible();
      await shot(page, info, 'catalog-e9-s5', false);
    } finally {
      for (const id of ids) await removeTestItem(request, id);
    }
  });

  test('Lưới: tải ảnh lên cho món chưa có ảnh', async ({ page, request }, info) => {
    const name = `PW Grid ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    try {
      const oldImage = psql(`SELECT image_file_id FROM items WHERE id = '${id}'`);
      psql(`UPDATE items SET image_file_id = NULL WHERE id = '${id}'`);
      deleteTestFiles([oldImage]);
      await page.goto('/admin/catalog');
      await expect(page.getByRole('group', { name: 'Chế độ xem' }).getByRole('button', { name: 'Lưới' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: /^Chưa có ảnh/ }).click();
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ món$/ }).fill(name);
      const card = page.getByRole('article').filter({ hasText: name });
      await expect(card.getByText('Tải ảnh lên', { exact: true })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog-grid', false);
      const patched = page.waitForResponse((r) => r.url().endsWith(`/api/admin/items/${id}`) && r.request().method() === 'PATCH');
      await card.getByLabel(`Tải ảnh lên cho ${name}`).setInputFiles('playwright/fixtures/item.png');
      expect((await patched).status()).toBe(200);
      await expect(page.getByText(`Đã thêm ảnh cho ${name}`)).toBeVisible();
      await page.getByRole('button', { name: /^Đang dùng/ }).click();
      await expectImageServed(page, page.getByRole('article').filter({ hasText: name }).getByRole('img', { name }));
      await expect(page.getByRole('article').filter({ hasText: name }).getByText('Tải ảnh lên', { exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: `Sửa ${name}` }).click();
      const drawer = page.getByRole('dialog', { name: 'Sửa món' });
      await expect(drawer.getByRole('region', { name: 'Nhân viên sẽ thấy' }).getByText(name)).toBeVisible();
      await drawer.getByLabel('Tên món').fill(`${name} mới`);
      await expect(drawer.getByRole('region', { name: 'Nhân viên sẽ thấy' }).getByText(`${name} mới`)).toBeVisible();
      await shot(page, info, 'catalog-grid-drawer', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('E9-S5 Danh mục: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/items', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/admin/catalog');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
