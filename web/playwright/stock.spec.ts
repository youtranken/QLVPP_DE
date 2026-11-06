import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { asRole, deleteTestUsers, devHeaders, expectNoContrastViolations, expectStockCell, isMobile, removeTestItem, seedActiveUser, shot, openPurchase } from './helpers';
import { seedLockedRequest } from './locked-request';

const RECIPIENT = { sub: 'pw-recipient', name: 'PW Người nhận' };

async function rowAction(row: Locator, itemName: string, action: 'Kiểm kê' | 'Xuất lẻ' | 'Sổ cái' | 'Nhập ngoài kỳ (tự mua lẻ)') {
  await row.getByRole('button', { name: `Thao tác khác cho ${itemName}` }).click();
  await row.page().getByRole('menuitem', { name: action }).click();
}

async function createItem(request: APIRequestContext, name: string) {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: {
      purpose: 'item_image',
      file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') },
    },
  });
  expect(file.status()).toBe(201);
  const item = await request.post('/api/admin/items', {
    headers,
    data: { name, unit: 'cai', image_file_id: (await file.json()).id },
  });
  expect(item.status()).toBe(201);
  return (await item.json()).id as string;
}

test.describe('E1-S4 Tủ / Kho: nhập, kiểm kê, xuất lẻ, sổ cái (dev-identity admin)', () => {
  asRole('admin');
  test.afterAll(() => deleteTestUsers(RECIPIENT.sub));

  test('E1-S4 nhập 10 → tồn 10; xuất lẻ 3 cho người trong danh bạ → tồn 7; sổ cái hiện 2 dòng; còn 2 → Sắp hết, 0 không ai chờ → Không có', async ({
    page,
    request,
  }, info) => {
    const itemName = `PW kho ${Date.now()}-${info.project.name}`;
    seedActiveUser(RECIPIENT.sub, RECIPIENT.name);
    const itemId = await createItem(request, itemName);

    try {
      await page.goto('/admin/stock');
      await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      const row = page.getByRole('row').filter({ hasText: itemName });
      // Tủ 0 mà không ai chờ: xám "Không có", không đỏ
      await expectStockCell(row, 0);
      await expect(row.getByText('Không có')).toBeVisible();

      await openPurchase(page, row);
      const purchase = page.getByRole('dialog', { name: `Nhập ngoài kỳ (tự mua lẻ) ${itemName}` });
      await purchase.getByLabel('Số lượng nhập').fill('10');
      await purchase.getByLabel('Ghi chú').fill('Đơn PW');
      await purchase.getByRole('button', { name: 'Lưu nhập mua' }).click();
      await expect(purchase).toBeHidden();
      await expectStockCell(row, 10);
      await expect(row.getByText('Sắp hết')).toHaveCount(0);
      if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
      await shot(page, info, 'stock-table', false);

      await rowAction(row, itemName, 'Xuất lẻ');
      const issue = page.getByRole('dialog', { name: `Xuất lẻ ${itemName}` });
      await issue.getByLabel('Số lượng').fill('30');
      await issue.getByLabel('Dùng chung').check();
      await issue.getByLabel('Lý do').fill('Thử quá tồn');
      await issue.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(issue.getByText(/Chỉ còn 10 /)).toBeVisible();

      await issue.getByLabel('Số lượng').fill('3');
      await issue.getByLabel('Dùng chung').uncheck();
      await issue.getByRole('searchbox', { name: 'Tìm người nhận' }).fill(RECIPIENT.name);
      await issue.getByRole('button', { name: new RegExp(RECIPIENT.name) }).click();
      await issue.getByLabel('Lý do').fill('Người mới vào giữa kỳ');
      await expect(issue.getByText('Tồn sau khi lưu 7')).toBeVisible();
      await shot(page, info, 'stock-issue-dialog', false);
      await issue.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(issue).toBeHidden();
      await expectStockCell(row, 7);

      await rowAction(row, itemName, 'Sổ cái');
      const ledger = page.getByRole('dialog', { name: `Sổ cái ${itemName}` });
      await expect(ledger.getByRole('listitem')).toHaveCount(2);
      await expect(ledger.getByText(`Xuất lẻ · ${RECIPIENT.name}`)).toBeVisible();
      await expect(ledger.getByText('Người mới vào giữa kỳ')).toBeVisible();
      await expect(ledger.getByRole('listitem').getByText('Nhập mua', { exact: true })).toBeVisible();
      await expect(ledger.getByText('Đơn PW')).toBeVisible();
      await shot(page, info, 'stock-ledger', false);
      await page.keyboard.press('Escape');
      await expect(ledger).toBeHidden();

      // Mốc = floor(20 % × 10) = 2 tính trên phần còn trống: còn 2 → Sắp hết; còn 0 không ai chờ → Không có
      const issueApi = (qty: number) =>
        request.post(`/api/admin/items/${itemId}/issue`, { headers: devHeaders('admin'), data: { qty, reason: 'PW mốc' } });
      expect((await issueApi(5)).status()).toBe(201);
      await page.reload();
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      await expect(row.getByText('Sắp hết')).toBeVisible();
      await shot(page, info, 'stock-low', false);
      expect((await issueApi(2)).status()).toBe(201);
      await page.reload();
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      await expect(row.getByText('Không có')).toBeVisible();
      await expect(row.getByText('Sắp hết')).toHaveCount(0);
      if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
      await shot(page, info, 'stock-out', false);
    } finally {
      await removeTestItem(request, itemId);
    }
  });
});

test.describe('E9-S5 Tủ / Kho M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5 Kho: nhập 10, xuất lẻ 3 rồi 4 bị chặn, sổ cái tồn sau từng dòng', async ({ page, request }, info) => {
    const itemName = `PW kho M1 ${Date.now()}-${info.project.name}`;
    const itemId = await createItem(request, itemName);
    try {
      await page.goto('/admin/stock');
      await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      const row = page.getByRole('row').filter({ hasText: itemName });

      await openPurchase(page, row);
      const purchase = page.getByRole('dialog', { name: `Nhập ngoài kỳ (tự mua lẻ) ${itemName}` });
      await purchase.getByLabel('Số lượng nhập').fill('10');
      await expect(purchase.getByText('Tồn sau khi lưu 10')).toBeVisible();
      await purchase.getByRole('button', { name: 'Lưu nhập mua' }).click();
      await expect(purchase).toBeHidden();
      await expectStockCell(row, 10);

      await rowAction(row, itemName, 'Xuất lẻ');
      const first = page.getByRole('dialog', { name: `Xuất lẻ ${itemName}` });
      await first.getByLabel('Số lượng', { exact: false }).first().fill('3');
      await first.getByLabel('Dùng chung').check();
      await first.getByLabel('Lý do').fill('PW xuất 3');
      await first.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(first).toBeHidden();
      await expectStockCell(row, 7);

      const ledgerOf = async () => {
        await rowAction(row, itemName, 'Sổ cái');
        return page.getByRole('dialog', { name: `Sổ cái ${itemName}` });
      };
      const ledger = await ledgerOf();
      await expect(ledger.getByRole('listitem')).toHaveCount(2);
      await expect(ledger.getByRole('listitem').nth(0).getByText('tồn 7')).toBeVisible();
      await expect(ledger.getByRole('listitem').nth(1).getByText('tồn 10')).toBeVisible();
      if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
      await page.keyboard.press('Escape');
      await expect(ledger).toBeHidden();

      // Còn 3: xuất 4 bị chặn tại ô số, xuất 3 qua và về "Không có"
      expect((await request.post(`/api/admin/items/${itemId}/issue`, { headers: devHeaders('admin'), data: { qty: 4, reason: 'PW còn 3' } })).status()).toBe(201);
      await page.reload();
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      await expectStockCell(row, 3);
      await rowAction(row, itemName, 'Xuất lẻ');
      const again = page.getByRole('dialog', { name: `Xuất lẻ ${itemName}` });
      await again.getByLabel('Dùng chung').check();
      await again.getByLabel('Lý do').fill('PW biên');
      await again.getByLabel('Số lượng', { exact: false }).first().fill('4');
      await again.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(again.getByText(/^Chỉ còn 3 /)).toBeVisible();
      await expect(again.getByLabel('Số lượng', { exact: false }).first()).toHaveAttribute('aria-invalid', 'true');
      await again.getByLabel('Số lượng', { exact: false }).first().fill('3');
      await again.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(again).toBeHidden();
      await expectStockCell(row, 0);
      await expect(row.getByText('Không có')).toBeVisible();
    } finally {
      await removeTestItem(request, itemId);
    }
  });

  test('E9-S5 Kho: kiểm kê tồn 10 đếm 12 → "Tồn 10 → 12 (+2)", sổ cái "Điều chỉnh"; tồn đổi ở nơi khác → báo tồn mới, không tự lưu', async ({ page, request }, info) => {
    const itemName = `PW kiểm kê ${Date.now()}-${info.project.name}`;
    const itemId = await createItem(request, itemName);
    const purchaseApi = (delta: number) =>
      request.post(`/api/admin/items/${itemId}/stock`, { headers: devHeaders('admin'), data: { delta, reason: 'purchase', note: null } });
    try {
      expect((await purchaseApi(10)).status()).toBe(201);
      await page.goto('/admin/stock');
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      const row = page.getByRole('row').filter({ hasText: itemName });
      await expectStockCell(row, 10);

      await rowAction(row, itemName, 'Kiểm kê');
      const dialog = page.getByRole('dialog', { name: `Kiểm kê ${itemName}` });
      await expect(dialog.getByText('Tồn hiện tại 10')).toBeVisible();
      const save = dialog.getByRole('button', { name: 'Lưu kiểm kê' });
      await expect(save).toBeDisabled();
      await dialog.getByLabel('Số đếm thực tế').fill('10');
      await expect(save).toBeDisabled();
      await dialog.getByLabel('Số đếm thực tế').fill('12');
      await expect(dialog.getByText('Tồn 10 → 12 (+2)')).toBeVisible();
      await dialog.getByLabel('Lý do').fill('PW kiểm kê cuối tháng');
      await shot(page, info, 'stock-count-dialog', false);
      await save.click();
      await expect(dialog).toBeHidden();
      await expectStockCell(row, 12);

      await rowAction(row, itemName, 'Kiểm kê');
      await dialog.getByLabel('Số đếm thực tế').fill('11');
      await dialog.getByLabel('Lý do').fill('PW hàng hỏng');
      expect((await purchaseApi(3)).status()).toBe(201);
      await save.click();
      await expect(dialog.getByRole('alert')).toHaveText(/Tồn vừa đổi thành 15 .* ở nơi khác — đếm lại rồi lưu\./);
      await expect(dialog.getByText('Tồn 15 → 11 (−4)')).toBeVisible();
      await save.click();
      await expect(dialog).toBeHidden();
      await expectStockCell(row, 11);

      await rowAction(row, itemName, 'Sổ cái');
      const ledger = page.getByRole('dialog', { name: `Sổ cái ${itemName}` });
      await expect(ledger.getByRole('listitem')).toHaveCount(4);
      await expect(ledger.getByRole('listitem').nth(0).getByText('Điều chỉnh')).toBeVisible();
      await expect(ledger.getByRole('listitem').nth(0).getByText('PW hàng hỏng')).toBeVisible();
      if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
    } finally {
      await removeTestItem(request, itemId);
    }
  });

  test('Xuất lẻ: xuất 1 món rồi thấy ở tab Xuất lẻ', async ({ page, request }, info) => {
    const itemName = `PW xuất lẻ ${Date.now()}-${info.project.name}`;
    const itemId = await createItem(request, itemName);
    try {
      const bought = await request.post(`/api/admin/items/${itemId}/stock`, {
        headers: devHeaders('admin'),
        data: { delta: 10, reason: 'purchase', note: null },
      });
      expect(bought.status()).toBe(201);
      await page.goto('/admin/stock');
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
      const row = page.getByRole('row').filter({ hasText: itemName });
      await rowAction(row, itemName, 'Xuất lẻ');
      const issue = page.getByRole('dialog', { name: `Xuất lẻ ${itemName}` });
      await issue.getByLabel('Số lượng').fill('3');
      await issue.getByLabel('Dùng chung').check();
      await issue.getByLabel('Lý do').fill('Họp khách PW');
      await issue.getByRole('button', { name: 'Xuất', exact: true }).click();
      await expect(issue).toBeHidden();

      await page.getByRole('radio', { name: 'Xuất lẻ' }).click();
      await expect(page).toHaveURL(/tab=issues/);
      const issued = page.getByRole('row').filter({ hasText: itemName });
      await expect(issued).toBeVisible();
      await expect(issued).toContainText('3 cái');
      await expect(issued).toContainText('Họp khách PW');
      await expect(issued).toContainText('Dùng chung');
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'stock-issues-tab', false);
    } finally {
      await removeTestItem(request, itemId);
    }
  });

  test('E9-S5 Kho: ?filter=low chỉ còn món Sắp hết và bỏ lọc được', async ({ page }) => {
    await page.goto('/admin/stock?filter=low');
    await expect(page.getByRole('button', { name: /^Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/^Đang lọc: Sắp hết/)).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ lọc' }).click();
    await expect(page).not.toHaveURL(/filter=/);
  });

  test('E9-S5 Kho: lỗi tải → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/items', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/stock');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});

test.describe('V2D-16 Tủ / Kho theo người đang chờ (dev-identity admin)', () => {
  asRole('admin');

  test('V2D-16 held stock: tủ 5 giữ 4 → Trong tủ 5 · Đang giữ 4 · Còn trống 1; xuất 3 "Vẫn xuất" → Thiếu 2 cho người chờ; kiểm kê cảnh báo', async ({ page, request }, info) => {
    const seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 4 }]);
    const item = seed.items[0];
    try {
      await page.goto('/admin/stock');
      await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
      await expect(page.getByRole('main').getByRole('link', { name: 'Hàng ADM về? → Hàng về' })).toHaveAttribute('href', '/admin/arrivals');
      await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(item.name);
      const row = page.getByRole('row').filter({ hasText: item.name });
      await expectStockCell(row, 5);
      await expect(row.getByRole('cell').nth(3)).toHaveText(/4$/);
      await expect(row.getByRole('cell').nth(4)).toHaveText(/1$/);
      await expect(page.getByText('Đủ dùng')).toHaveCount(0);
      await expect(row.getByRole('button', { name: 'Nhập mua' })).toHaveCount(0);

      await rowAction(row, item.name, 'Xuất lẻ');
      const issue = page.getByRole('dialog', { name: `Xuất lẻ ${item.name}` });
      await issue.getByLabel('Số lượng').fill('1');
      await expect(issue.getByRole('note')).toHaveCount(0);
      await expect(issue.getByRole('button', { name: 'Xuất', exact: true })).toBeVisible();
      await issue.getByLabel('Số lượng').fill('3');
      await expect(issue.getByRole('note')).toContainText('Phần này đang giữ cho 1 người chờ nhận.');
      await expect(issue.getByRole('note')).toContainText('Xuất 3 sẽ lấy 2 cái đang giữ.');
      await issue.getByLabel('Dùng chung').check();
      await issue.getByLabel('Lý do').fill('PW phòng họp');
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'v2d16-issue-held', false);
      await issue.getByRole('button', { name: 'Vẫn xuất' }).click();
      await expect(issue).toBeHidden();
      await expectStockCell(row, 2);
      await expect(row.getByText('Thiếu 2 cho người chờ')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'v2d16-stock-short', false);

      await rowAction(row, item.name, 'Kiểm kê');
      const count = page.getByRole('dialog', { name: `Kiểm kê ${item.name}` });
      await count.getByLabel('Số đếm thực tế').fill('1');
      await expect(count.getByRole('note')).toHaveText('Sau kiểm kê tủ còn 1, thiếu 3 cho người đang chờ.');
      await count.getByRole('button', { name: 'Quay lại' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
      await expect(count).toBeHidden();

      await page.getByRole('radio', { name: 'Xuất lẻ' }).click();
      await expect(page.getByRole('button', { name: 'Xuất lẻ một món' })).toBeVisible();
    } finally {
      seed.cleanup();
    }
  });
});
