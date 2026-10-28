import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, seedActiveUser, shot } from './helpers';

// Ở 390 px bảng xếp dọc, ô có nhãn cột phía trước ("Tồn 10")
const stockCell = (row: Locator, qty: number) => row.getByRole('cell', { name: new RegExp(`^(Tồn )?${qty}$`) });

const RECIPIENT = { sub: 'pw-recipient', name: 'PW Người nhận' };

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

test.describe('E1-S4 Kho: nhập, điều chỉnh, xuất lẻ, sổ cái (dev-identity admin)', () => {
  asRole('admin');

  test('E1-S4 nhập 10 → tồn 10; xuất lẻ 3 cho người trong danh bạ → tồn 7; sổ cái hiện 2 dòng; còn 2 → Sắp hết, 0 → Hết hàng', async ({
    page,
    request,
  }, info) => {
    const itemName = `PW kho ${Date.now()}-${info.project.name}`;
    seedActiveUser(RECIPIENT.sub, RECIPIENT.name);
    const itemId = await createItem(request, itemName);

    await page.goto('/admin/stock');
    await expect(page.getByRole('heading', { level: 1, name: 'Kho' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
    const row = page.getByRole('row').filter({ hasText: itemName });
    // Chưa nhập mua lần nào → không cảnh báo dù tồn 0 (FR-50)
    await expect(stockCell(row, 0)).toBeVisible();
    await expect(row.getByText('Hết hàng')).toHaveCount(0);

    await row.getByRole('button', { name: 'Nhập mua…' }).click();
    const purchase = page.getByRole('dialog', { name: `Nhập mua · ${itemName}` });
    await purchase.getByLabel('Số lượng').fill('10');
    await purchase.getByLabel('Ghi chú').fill('Đơn PW');
    await purchase.getByRole('button', { name: 'Nhập kho' }).click();
    await expect(purchase).toBeHidden();
    await expect(stockCell(row, 10)).toBeVisible();
    await expect(row.getByText('Sắp hết')).toHaveCount(0);
    if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
    await shot(page, info, 'stock-table', false);

    await row.getByRole('button', { name: 'Xuất lẻ…' }).click();
    const issue = page.getByRole('dialog', { name: `Xuất lẻ · ${itemName}` });
    await issue.getByLabel('Số lượng').fill('30');
    await issue.getByLabel('Dùng chung').check();
    await issue.getByLabel('Lý do').fill('Thử quá tồn');
    await issue.getByRole('button', { name: 'Xuất kho' }).click();
    await expect(issue.getByText('Chỉ còn 10')).toBeVisible();

    await issue.getByLabel('Số lượng').fill('3');
    await issue.getByLabel('Dùng chung').uncheck();
    await issue.getByRole('searchbox', { name: 'Tìm người nhận' }).fill(RECIPIENT.name);
    await issue.getByRole('button', { name: new RegExp(RECIPIENT.name) }).click();
    await issue.getByLabel('Lý do').fill('Người mới vào giữa kỳ');
    await expect(issue.getByText('Tồn sau khi lưu: 7')).toBeVisible();
    await shot(page, info, 'stock-issue-dialog', false);
    await issue.getByRole('button', { name: 'Xuất kho' }).click();
    await expect(issue).toBeHidden();
    await expect(stockCell(row, 7)).toBeVisible();

    await row.getByRole('button', { name: 'Sổ cái' }).click();
    const ledger = page.getByRole('dialog', { name: `Sổ cái · ${itemName}` });
    await expect(ledger.getByRole('listitem')).toHaveCount(2);
    await expect(ledger.getByText(`Xuất lẻ · ${RECIPIENT.name}`)).toBeVisible();
    await expect(ledger.getByText('Người mới vào giữa kỳ')).toBeVisible();
    await expect(ledger.getByText('Nhập mua', { exact: true })).toBeVisible();
    await expect(ledger.getByText('Đơn PW')).toBeVisible();
    await shot(page, info, 'stock-ledger', false);
    await page.keyboard.press('Escape');
    await expect(ledger).toBeHidden();

    // Mốc = floor(20 % × 10) = 2: còn 2 → Sắp hết; còn 0 → Hết hàng
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
    await expect(row.getByText('Hết hàng')).toBeVisible();
    await expect(row.getByText('Sắp hết')).toHaveCount(0);
    if (info.project.name === 'mobile-390') await expectNoContrastViolations(page);
    await shot(page, info, 'stock-out', false);

    // Dọn: ngừng món thử để không lẫn vào trang đăng ký của nhân viên trên DB dev
    const off = await request.patch(`/api/admin/items/${itemId}`, { headers: devHeaders('admin'), data: { active: false } });
    expect(off.status()).toBe(200);
  });
});
