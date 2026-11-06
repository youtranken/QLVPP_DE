import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, expectNoContrastViolations, isMobile, psql, settled, shot } from './helpers';
import { seedLockedRequest, stockOf } from './locked-request';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Bản in PW chỉ chứa món PW: "Đủ hàng" không bao giờ chạm món thật của kỳ dev
function insertSnapshot(prevYm: string, rows: { id: string; name: string; qty: number }[]): string {
  const byItem = rows.map((r) => ({ key: r.id, item_id: r.id, code: null, name: r.name, name_en: null, unit: 'cai', requested: r.qty, backlog_prev: 0, stock: 0, need: r.qty }));
  const data = { ym: prevYm, byItem, custom: [], byDepartment: [], issues: [], pending_custom_count: 0, order_qty: Object.fromEntries(rows.map((r) => [r.id, r.qty])) };
  return psql(`INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
    VALUES ('${prevYm}-01', 'print', '${JSON.stringify(data).replace(/'/g, "''")}'::jsonb, 'pw-admin', now()) RETURNING id`);
}

test.describe('Hàng về theo bản in (Plan v2-D, Task 8)', () => {
  test('V2D-8 partial then Đủ hàng', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const seed = await seedLockedRequest(request, info, [
      { stock: 0, qty: 5 },
      { stock: 0, qty: 3 },
    ]);
    const [a, b] = seed.items;
    let snapshotId = '';
    try {
      snapshotId = insertSnapshot(seed.prevYm, [
        { ...a, qty: 5 },
        { ...b, qty: 3 },
      ]);
      await page.goto(`/admin/arrivals?q=${encodeURIComponent(seed.tag)}`);
      await expect(page.getByRole('heading', { level: 1, name: `Hàng về kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Theo bản in / })).toBeVisible();
      await expect(page.getByText(/^Đang hiện 2\/\d+ món$/)).toBeVisible();
      const boxA = page.getByRole('spinbutton', { name: `Về đợt này: ${a.name}` });
      const boxB = page.getByRole('spinbutton', { name: `Về đợt này: ${b.name}` });
      await expect(boxA).toHaveValue('5');
      await expect(boxB).toHaveValue('3');

      await boxA.fill('2');
      await boxB.fill('0');
      await expect(page.getByRole('row').filter({ hasText: a.name }).getByText('Thiếu 3 so với bản in')).toBeVisible();
      await settled(page);
      await shot(page, info, 'arrivals-partial');
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }

      await page.getByRole('button', { name: 'Lưu hàng về' }).click();
      const w15 = page.getByRole('dialog');
      await expect(w15).toContainText('Đợt này khác bản in ở 2 món');
      await expect(w15).toContainText(`${a.name}: về 2 / còn 5`);
      await settled(page);
      await shot(page, info, 'arrivals-w15');
      await w15.getByRole('button', { name: 'Lưu hàng về' }).click();
      await expect(page.getByText('Đã nhập 1 món vào tủ.')).toBeVisible();
      expect(stockOf(a.id)).toBe(2);
      await expect(boxA).toHaveValue('3');

      await page.getByRole('button', { name: 'Đủ hàng' }).click();
      const full = page.getByRole('dialog');
      await expect(full).toContainText('Nhập 2 món, 6 đơn vị vào tủ theo bản in');
      await settled(page);
      await shot(page, info, 'arrivals-full-confirm');
      await full.getByRole('button', { name: 'Nhập vào tủ' }).click();
      await expect(page.getByText(/^Hàng kỳ tháng \d+ đã về đủ/)).toBeVisible();
      expect(stockOf(a.id)).toBe(5);
      expect(stockOf(b.id)).toBe(3);
      await expect(page.getByRole('link', { name: 'Sang Giao hàng →' })).toHaveAttribute('href', '/admin/delivery');
      await expect(page.getByRole('button', { name: 'Đủ hàng' })).toBeDisabled();
      await settled(page);
      await shot(page, info, 'arrivals-done');
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }
    } finally {
      if (snapshotId) psql(`DELETE FROM report_snapshots WHERE id = '${snapshotId}'`);
      seed.cleanup();
      release();
    }
  });
});
