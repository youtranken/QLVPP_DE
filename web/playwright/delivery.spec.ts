import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, searchSummaryPeople } from './helpers';
import { seedLockedRequest, stockOf, type Seed } from './locked-request';

asRole('admin');

const linesOf = (page: Page, name: string) => page.getByRole('table', { name: `Các dòng của phiếu ${name}` });
const changeStock = (request: APIRequestContext, itemId: string, delta: number) =>
  request.post(`/api/admin/items/${itemId}/stock`, {
    headers: devHeaders('admin'),
    data: { delta, reason: delta < 0 ? 'adjust' : 'purchase', note: delta < 0 ? 'PW giảm tồn giữa chừng' : null },
  });

test.describe('E9-S3 Giao hàng (kỳ trước đã khóa, dev-identity admin)', () => {
  test('E9-S3 Giao hàng: thực giao kẹp theo tồn và còn lại, giao dòng đã chọn, giao tất cả rời bộ lọc', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [
        { stock: 3, qty: 5 },
        { stock: 10, qty: 2 },
        { stock: 10, qty: 1 },
      ]);
      const [a, b, c] = seed.items;
      await page.goto(`/admin/delivery?request=${seed.requestId}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Giao hàng' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
      const lines = linesOf(page, seed.name);
      const row = (name: string) => lines.getByRole('row').filter({ hasText: name });
      await expect(lines.getByLabel(`Thực giao ${a.name}`)).toHaveValue('3');
      await expect(row(a.name).getByRole('button', { name: `Thêm ${a.name}` })).toBeDisabled();
      await expect(lines.getByLabel(`Thực giao ${b.name}`)).toHaveValue('2');
      await expect(row(b.name).getByRole('button', { name: `Thêm ${b.name}` })).toBeDisabled();
      if (isMobile(info)) await expectNoContrastViolations(page);

      expect((await changeStock(request, a.id, -1)).ok()).toBe(true);
      await row(a.name).getByRole('button', { name: `Giao ${a.name}` }).click();
      await expect(row(a.name).getByText('Chỉ còn 2 cái.')).toBeVisible();
      await expect(lines.getByLabel(`Thực giao ${a.name}`)).toHaveValue('2');
      expect(stockOf(a.id)).toBe(2);

      await row(a.name).getByRole('checkbox', { name: `Chọn ${a.name}` }).check();
      await row(b.name).getByRole('checkbox', { name: `Chọn ${b.name}` }).check();
      expect((await changeStock(request, a.id, -2)).ok()).toBe(true);
      await page.getByRole('button', { name: 'Giao dòng đã chọn (2)' }).click();
      await expect(page.getByRole('status', { name: 'Kết quả giao' })).toHaveText(`Đã giao 1 dòng · Không giao được 1: ${a.name} — chỉ còn 0`);
      await expect(row(a.name).getByText('Chỉ còn 0 cái.')).toBeVisible();
      await expect(row(a.name).getByText('Hết hàng — còn nợ 5')).toBeVisible();
      await expect(row(b.name).getByText('Đã giao đủ')).toBeVisible();
      expect(stockOf(a.id)).toBe(0);
      expect(stockOf(b.id)).toBe(8);

      expect((await changeStock(request, a.id, 5)).ok()).toBe(true);
      await page.reload();
      await expect(linesOf(page, seed.name).getByLabel(`Thực giao ${a.name}`)).toHaveValue('5');
      await page.route('**/api/admin/requests/*/deliver-all', (route) =>
        route.fulfill({ status: 409, json: { code: 'PERIOD_NOT_LOCKED', message: 'x' } }),
      );
      await page.getByRole('button', { name: 'Giao tất cả' }).click();
      await expect(page.getByRole('alert')).toHaveText(`Kỳ chưa khóa — giao sau 00:00 ngày 11/${Number(seed.prevYm.slice(5))}.`);
      await page.unroute('**/api/admin/requests/*/deliver-all');
      await page.getByRole('button', { name: 'Giao tất cả' }).click();
      await expect(page.getByText(`Đã giao đủ phiếu của ${seed.name}`)).toBeVisible();
      await expect(page.getByRole('list', { name: 'Danh sách phiếu' }).getByRole('button', { name: new RegExp(`^${seed.name}`) })).toHaveCount(0);
      expect(stockOf(a.id)).toBe(0);
      expect(stockOf(c.id)).toBe(9);
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E4-S1 E9-S3 Giao hàng bấm đúp: tồn trừ một lần', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [{ stock: 10, qty: 5 }]);
      const [a] = seed.items;
      await page.goto(`/admin/delivery?request=${seed.requestId}`);
      const line = linesOf(page, seed.name).getByRole('row').filter({ hasText: a.name });
      await line.getByRole('button', { name: `Giao ${a.name}` }).dblclick();
      await expect(line.getByText('Đã giao đủ')).toBeVisible();
      expect(stockOf(a.id)).toBe(5);
      const ledger = await (await request.get(`/api/admin/items/${a.id}/movements`, { headers: devHeaders('admin') })).json();
      expect(ledger.items.filter((m: { reason: string }) => m.reason === 'delivery')).toHaveLength(1);

      const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
      const again = await request.post(`/api/admin/lines/${lineId}/deliver`, { headers: devHeaders('admin'), data: { qty: 5, expected_delivered_qty: 0 } });
      expect(again.status()).toBe(409);
      expect((await again.json()).code).toBe('STALE_UPDATE');
      expect(stockOf(a.id)).toBe(5);
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E4-S4 E9-S3 Giao hàng giao thiếu: Còn nợ hiện phần còn lại, Tổng hợp cập nhật thanh tiến độ', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [
        { stock: 10, qty: 5 },
        { stock: 1, qty: 2 },
      ]);
      const [a, b] = seed.items;
      await page.goto(`/admin/delivery?request=${seed.requestId}`);
      const line = linesOf(page, seed.name).getByRole('row').filter({ hasText: a.name });
      await line.getByLabel(`Thực giao ${a.name}`).fill('3');
      await line.getByRole('button', { name: `Giao ${a.name}` }).click();
      await expect(page.getByText(`Đã giao 3 cái ${a.name}`)).toBeVisible();
      await expect(line.getByLabel(`Thực giao ${a.name}`)).toHaveValue('2');
      expect(stockOf(a.id)).toBe(7);

      await page.goto('/admin/backlog?by=person');
      const owed = page.getByRole('region', { name: seed.name });
      await expect(owed.getByRole('listitem').filter({ hasText: a.name }).getByText('còn 2', { exact: true })).toBeVisible();
      await expect(owed.getByRole('listitem').filter({ hasText: b.name }).getByText('còn 2', { exact: true })).toBeVisible();

      await page.goto(`/admin/summary?ym=${seed.prevYm}`);
      await searchSummaryPeople(page, seed.tag);
      await expect(page.getByRole('row').filter({ hasText: seed.name }).getByRole('progressbar', { name: 'đã giao 3/7' })).toBeVisible();
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E9-S3 Giao hàng: lỗi tải danh sách → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/periods/*/requests?*', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/delivery');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
