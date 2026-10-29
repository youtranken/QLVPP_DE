import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, searchSummaryPeople, settled } from './helpers';
import { seedLockedRequest, stockOf, type Seed } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-11-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

async function openRequest(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: new RegExp(`^${name}`) });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const row = page.getByRole('listitem').filter({ has: toggle });
  return { row, lines: page.getByRole('list', { name: `Các dòng của phiếu ${name}` }) };
}

asRole('admin');

test.describe('E4 giao hàng (kỳ trước đã khóa, dev-identity admin)', () => {
  test('E4-S4 giao thiếu rồi kiểm Còn nợ: giao 3/5 → còn 2 → Tổng hợp 3/7 → Giao tất cả, món thiếu kho được liệt kê', async ({
    page,
    request,
  }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [
        { stock: 10, qty: 5 },
        { stock: 1, qty: 2 },
      ]);
      const [a, b] = seed.items;
      await page.goto('/admin/delivery');
      const [y, m] = seed.prevYm.split('-');
      await expect(page.getByText(`Tháng ${Number(m)}/${y}`)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
      let { row, lines } = await openRequest(page, seed.name);
      const lineA = lines.getByRole('listitem').filter({ hasText: a.name });
      const qtyA = lineA.getByLabel(`Thực giao ${a.name}`);
      await expect(qtyA).toHaveValue('5');
      await qtyA.fill('6');
      await expect(lineA.getByText('Tối đa 5')).toBeVisible();
      await expect(lineA.getByRole('button', { name: `Giao ${a.name}` })).toBeDisabled();
      await qtyA.fill('3');
      await lineA.getByRole('button', { name: `Giao ${a.name}` }).click();
      await expect(lineA.getByText('đã giao 3/5')).toBeVisible();
      await expect(lineA.getByText('còn 2')).toBeVisible();
      await expect(row.getByRole('progressbar', { name: 'Đã giao 3/7' })).toBeVisible();
      expect(stockOf(a.id)).toBe(7);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'delivery-partial');

      await page.goto('/admin/backlog?by=person');
      const owed = page.getByRole('region', { name: seed.name });
      await expect(owed.getByRole('listitem').filter({ hasText: a.name }).getByText('còn 2', { exact: true })).toBeVisible();
      await expect(owed.getByRole('listitem').filter({ hasText: b.name }).getByText('còn 2', { exact: true })).toBeVisible();

      await page.goto(`/admin/summary?ym=${seed.prevYm}`);
      await searchSummaryPeople(page, seed.tag);
      const summaryRow = page.getByRole('row').filter({ hasText: seed.name });
      await expect(summaryRow.getByRole('progressbar', { name: 'Đã giao 3/7' })).toBeVisible();
      await summaryRow.getByRole('link', { name: 'Giao' }).click();

      ({ row, lines } = await openRequest(page, seed.name));
      await page.getByRole('button', { name: 'Giao tất cả' }).click();
      const result = page.getByRole('status').filter({ hasText: 'Đã giao 1 dòng' });
      await expect(result).toBeVisible();
      await expect(result.getByRole('list', { name: 'Không giao được' })).toContainText(`Không giao được: ${b.name} — chỉ còn 1 trong kho`);
      await expect(lines.getByRole('listitem').filter({ hasText: a.name }).getByText('Đã giao đủ')).toBeVisible();
      await expect(row.getByRole('progressbar', { name: 'Đã giao 5/7' })).toBeVisible();
      expect(stockOf(a.id)).toBe(5);
      expect(stockOf(b.id)).toBe(1);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'delivery-all');

      await page.goto(`/admin/summary?ym=${seed.prevYm}`);
      await searchSummaryPeople(page, seed.tag);
      await expect(page.getByRole('row').filter({ hasText: seed.name }).getByRole('progressbar', { name: 'Đã giao 5/7' })).toBeVisible();
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E4-S1 bấm giao hai lần liên tiếp → tồn kho trừ một lần; request thứ hai lọt tới server nhận 409 STALE_UPDATE', async ({
    page,
    request,
  }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [{ stock: 10, qty: 5 }]);
      const [a] = seed.items;
      await page.goto(`/admin/delivery?request=${seed.requestId}`);
      const { lines } = await openRequest(page, seed.name);
      const lineA = lines.getByRole('listitem').filter({ hasText: a.name });
      await lineA.getByRole('button', { name: `Giao ${a.name}` }).dblclick();
      await expect(lineA.getByText('Đã giao đủ')).toBeVisible();
      expect(stockOf(a.id)).toBe(5);
      expect(psql(`SELECT count(*) FROM stock_movements WHERE item_id = '${a.id}'`)).toBe('1');
      const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
      expect(psql(`SELECT count(*) FROM line_deliveries WHERE line_id = '${lineId}'`)).toBe('1');

      const again = await request.post(`/api/admin/lines/${lineId}/deliver`, {
        headers: devHeaders('admin'),
        data: { qty: 5, expected_delivered_qty: 0 },
      });
      expect(again.status()).toBe(409);
      expect((await again.json()).code).toBe('STALE_UPDATE');
      expect(stockOf(a.id)).toBe(5);
    } finally {
      seed?.cleanup();
      release();
    }
  });
});
