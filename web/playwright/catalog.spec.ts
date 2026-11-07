import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';
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
      await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
      await page.getByRole('button', { name: 'Thêm nhóm' }).click();
      const catDialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
      await catDialog.getByLabel('Tên nhóm').fill(category);
      await catDialog.getByLabel('Tên tiếng Anh').fill(`PW category ${stamp}`);
      await catDialog.getByRole('button', { name: 'Thêm nhóm' }).click();
      await expect(catDialog).toBeHidden();
      const catTable = page.getByRole('table');
      await expect(catTable.getByRole('button', { name: `Sửa nhóm ${category}` })).toBeVisible();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toHaveCount(0);
      await page.getByRole('button', { name: 'Sắp xếp' }).click();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeDisabled();
      await page.getByRole('button', { name: `Đưa ${category} lên` }).click();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeEnabled();
      await page.getByRole('button', { name: 'Hủy' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(page.getByRole('button', { name: 'Sắp xếp' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'categories');

      await page.goto('/admin/catalog?view=table');
      await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Thêm sản phẩm' });
      await form.getByRole('button', { name: 'Thêm món' }).click();
      await expect(form.getByText('Cần thêm: ảnh, tên, ĐVT.')).toBeVisible();
      await expect(form.getByLabel('Chụp hoặc chọn ảnh')).toHaveAttribute('aria-invalid', 'true');
      await form.getByLabel('Tên sản phẩm').fill(itemName);
      await form.getByLabel('Đơn vị tính').selectOption({ label: 'hộp' });
      await form.getByLabel('Quy cách').fill('hộp 10 cây');
      await form.getByLabel('Nhóm', { exact: true }).selectOption({ label: category });
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

      await page.getByRole('button', { name: `Tạm ngưng ${itemName}` }).click();
      await expect(page.getByRole('status').filter({ hasText: `Đã tạm ngưng ${itemName}` })).toBeVisible();
      const itemRow = page.getByRole('row').filter({ hasText: itemName });
      await expect(itemRow.getByText('Tạm ngưng', { exact: true })).toBeVisible();
      await page.getByRole('group', { name: 'Trạng thái' }).getByRole('button', { name: /^Tạm ngưng \d/ }).click();
      await expect(itemRow.getByRole('button', { name: `Dùng lại ${itemName}` })).toBeVisible();

      await page.getByRole('main').getByRole('link', { name: 'Danh mục' }).click();
      await page.getByRole('button', { name: `Tạm ngưng nhóm ${category}` }).click();
      const pause = page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` });
      await expect(pause.getByText('0 món sẽ ẩn với nhân viên. Dùng lại nhóm chỉ hiện lại những món này; món đã ngừng riêng vẫn ngừng.')).toBeVisible();
      await pause.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(page.getByRole('row').filter({ hasText: category }).getByText('Đã ngừng', { exact: true })).toBeVisible();
    } finally {
      await cleanupCatalog(request, itemName, category);
    }
  });

  test('E1-S5 trang Danh mục hiện nhãn "Thiếu ảnh" cho món seed', async ({ page, request }, info) => {
    // Danh mục dev đã đặt lại (50 món thật có ảnh): test tự tạo món "PW … Thiếu ảnh" không ảnh, chỉ Hành chính
    const name = `PW Giấy A4 ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    const imageId = psql(`SELECT image_file_id FROM items WHERE id = '${id}'`);
    expect((await request.patch(`/api/admin/items/${id}`, { headers: devHeaders('admin'), data: { admin_only: true } })).ok()).toBe(true);
    psql(`UPDATE items SET image_file_id = NULL WHERE id = '${id}'`);
    deleteTestFiles([imageId]);
    try {
      await page.goto('/admin/catalog?view=table');
      const search = page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ });
      await search.fill(name);
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row.getByText('Thiếu ảnh', { exact: true })).toBeVisible();
      await expect(row.getByText('Chỉ Hành chính')).toBeVisible();
      await search.fill('');
      await expect(page.getByText('Bút bi xanh')).toBeHidden();
      await shot(page, info, 'catalog-seed', false);
    } finally {
      await removeTestItem(request, id);
    }
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
      await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Thêm sản phẩm' });
      await drawer.getByLabel('Tên sản phẩm').fill(nameA);
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

      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(stamp);
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
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
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
      await expect(drawer.getByLabel('Tên sản phẩm')).toHaveValue(name);
      await expect(drawer.getByRole('region', { name: 'Nhân viên sẽ thấy' })).toHaveCount(0);
      await expect(drawer.getByLabel('Thứ tự hiển thị')).toHaveCount(0);
      await shot(page, info, 'catalog-grid-drawer', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Tạm ngưng một món bằng nút trung tính cạnh "Sửa" trên thẻ lưới; "Dùng lại" ở tab Tạm ngưng', async ({ page, request }, info) => {
    const name = `PW Tạm ngưng ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    const patched = () => page.waitForResponse((r) => r.url().endsWith(`/api/admin/items/${id}`) && r.request().method() === 'PATCH');
    try {
      await page.goto('/admin/catalog');
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const card = page.getByRole('article').filter({ hasText: name });
      const pause = card.getByRole('button', { name: `Tạm ngưng ${name}` });
      await expect(pause).toHaveText('Tạm ngưng');
      await expect(card.getByRole('button', { name: `Sửa ${name}` })).toBeVisible();
      if (isMobile(info)) expect((await pause.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await shot(page, info, 'catalog-card-pause', false);
      const off = patched();
      await pause.click();
      expect((await off).status()).toBe(200);
      await expect(page.getByRole('status').filter({ hasText: `Đã tạm ngưng ${name}` })).toBeVisible();
      await expect(card.getByRole('img', { name: 'Tạm ngưng', exact: true })).toBeVisible();

      await page.getByRole('button', { name: /^Tạm ngưng \d/ }).click();
      await expect(card.getByText('Ngừng riêng')).toHaveCount(0);
      const back = card.getByRole('button', { name: `Dùng lại ${name}` });
      await expect(back).toHaveText('Dùng lại');
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog-card-reactivate', false);
      const on = patched();
      await back.click();
      expect((await on).status()).toBe(200);
      await expect(card).toHaveCount(0);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Lưới: tab Tạm ngưng đủ tương phản ở 390 px', async ({ page, request }, info) => {
    // Danh mục dev đã đặt lại (không còn món ngừng): test tự tạo một món "PW …" rồi ngừng nó
    const id = await createItemViaApi(request, `PW Ngừng ${Date.now()}-${info.project.name}`);
    expect((await request.patch(`/api/admin/items/${id}`, { headers: devHeaders('admin'), data: { active: false } })).ok()).toBe(true);
    try {
      await inactiveTabAxe(page, info);
    } finally {
      await removeTestItem(request, id);
    }
  });

  async function inactiveTabAxe(page: Page, info: TestInfo) {
    await page.goto('/admin/catalog?tab=inactive');
    await expect(page.getByRole('button', { name: /^Tạm ngưng \d/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('article').first()).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'catalog-grid-inactive', false);
  }

  test('Nhóm 1 · mục 6: tab Tất cả mặc định, thẻ tạm ngưng có dấu đỏ chéo, nút Tạm ngưng trung tính, bấm xong có Hoàn tác', async ({ page, request }, info) => {
    const name = `PW Nhóm1 ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    try {
      await page.goto('/admin/catalog');
      await expect(page.getByRole('button', { name: /^Tất cả \d/ })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const card = page.getByRole('article').filter({ hasText: name });
      const pause = card.getByRole('button', { name: `Tạm ngưng ${name}` });
      const idle = await pause.evaluate((el) => getComputedStyle(el).backgroundColor);
      await pause.hover();
      await expect.poll(() => pause.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(idle);
      await pause.click();
      const toast = page.getByRole('status').filter({ hasText: `Đã tạm ngưng ${name}` });
      await expect(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
      await expect(card.getByRole('img', { name: 'Tạm ngưng' })).toBeVisible();
      expect(await card.getByRole('heading', { name }).evaluate((el) => getComputedStyle(el).textDecorationLine)).not.toContain('line-through');
      await toast.getByRole('button', { name: 'Hoàn tác' }).click();
      await expect(card.getByRole('img', { name: 'Tạm ngưng' })).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'nhom1-catalog-grid', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Nhóm 1 · mục 7: tab Tạm ngưng chọn dòng → thanh sáng chỉ Dùng lại, Chuyển nhóm, Bỏ chọn; 390 dính đáy', async ({ page, request }, info) => {
    const name = `PW Nhóm1 bảng ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    expect((await request.patch(`/api/admin/items/${id}`, { headers: devHeaders('admin'), data: { active: false } })).ok()).toBe(true);
    try {
      await page.goto('/admin/catalog?view=table&tab=inactive');
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row.locator('.ct-item__name--paused')).toBeVisible();
      await row.getByRole('checkbox', { name: 'Chọn dòng' }).check();
      const bar = page.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' });
      await expect(bar.getByRole('button', { name: 'Dùng lại' })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'Chuyển nhóm' })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'Đổi tối đa/tháng' })).toHaveCount(0);
      await expect(bar.getByRole('button', { name: 'Tạm ngưng' })).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ })).toBeVisible();
      if (isMobile(info)) {
        expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
        const barBox = (await bar.boundingBox())!;
        const pad = await page.locator('.ct-page').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
        expect(pad).toBeGreaterThanOrEqual(barBox.height + 12);
        const vh = page.viewportSize()!.height;
        const lift = await page.locator('.toast-host').evaluate((el, h) => h - el.getBoundingClientRect().bottom, vh);
        expect(lift).toBeGreaterThanOrEqual(barBox.height + 12);
        await expectNoContrastViolations(page);
      }
      await shot(page, info, 'nhom1-catalog-bulk', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Nhóm 1 · mục 9: panel Sửa sản phẩm có đầu (ảnh, mã · nhóm · vị trí, trạng thái), hai khối, Tạm ngưng + Hoàn tác ở chân', async ({ page, request }, info) => {
    const name = `PW Nhóm1 panel ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    try {
      await page.goto(`/admin/catalog?q=${encodeURIComponent(name)}`);
      await page.getByRole('button', { name: `Sửa ${name}` }).click();
      const panel = page.getByRole('dialog', { name: `Sửa món ${name}` });
      await expect(panel.getByText('Đang dùng', { exact: true })).toBeVisible();
      await expect(panel.getByRole('heading', { level: 3, name: 'Thông tin' })).toBeVisible();
      await expect(panel.getByRole('heading', { level: 3, name: 'Đặt hàng' })).toBeVisible();
      await expect(panel.getByLabel('Nhóm', { exact: true })).toBeVisible();
      if (isMobile(info)) {
        expect(await panel.locator('.ovp-bar').count()).toBe(0);
        await expectNoContrastViolations(page);
      }
      await shot(page, info, 'nhom1-item-panel', false);
      await panel.getByRole('button', { name: `Tạm ngưng ${name}` }).click();
      const toast = panel.getByRole('status').filter({ hasText: `Đã tạm ngưng ${name}` });
      await expect(toast.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
      await expect(panel.locator('.ct-panel-status')).toHaveText('Tạm ngưng');
      await toast.getByRole('button', { name: 'Hoàn tác' }).click();
      await expect(panel.locator('.ct-panel-status')).toHaveText('Đang dùng');
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
