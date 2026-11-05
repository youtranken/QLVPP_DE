import { expect, test } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, shot } from './helpers';
import { prevYmOf, stockOf } from './locked-request';

asRole('admin');

const fitsWidth = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Hàng về (Plan v2-B, B4)', () => {
  test('Hàng về điền sẵn Cần mua, sửa 10 rồi lưu → tủ 10', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const prevYm = prevYmOf(period.ym);
    const subs = [`pw-arr-a-${tag}`, `pw-arr-b-${tag}`];
    const itemName = `PW Hàng về ${tag}`;
    const itemId = psql(`INSERT INTO items (name, unit, stock_qty) VALUES ('${itemName}', 'cai', 0) RETURNING id`);
    const createdPeriod = psql(`INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`) !== '';
    try {
      // Ví dụ chuẩn: A xin 3, B xin 10, tủ 0 → Cần mua 13
      for (const [sub, qty] of [[subs[0], 3], [subs[1], 10]] as const) {
        psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES ('${sub}', 'PW ${sub}', '${sub}@example.test', 'PW Phòng hàng về', 'active')`);
        psql(`WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id)
          INSERT INTO request_lines (request_id, item_id, qty) SELECT id, '${itemId}', ${qty} FROM r`);
      }

      await page.goto('/admin/arrivals');
      await expect(page.getByRole('heading', { level: 1, name: `Hàng về kỳ tháng ${Number(prevYm.slice(5))}` })).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: itemName });
      const box = row.getByRole('spinbutton', { name: `Về lần này: ${itemName}` });
      await expect(box).toHaveValue('13');
      await expect(row.getByText('Đủ', { exact: true })).toBeVisible();
      await box.fill('10');
      await expect(row.getByText('Thiếu', { exact: true })).toBeVisible();
      await expect(row.getByRole('cell').last()).toHaveText('10');
      await settled(page);
      await shot(page, info, 'arrivals-filled');
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }
      await page.getByRole('button', { name: 'Lưu hàng về' }).click();
      await expect(page.getByText('Đã nhập 1 món vào tủ.', { exact: false }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Giao hàng', exact: true }).last()).toHaveAttribute('href', '/admin/delivery');
      expect(stockOf(itemId)).toBe(10);
      // Cần mua còn 3 sau khi tủ có 10: dòng vẫn hiện, điền sẵn 3
      await expect(box).toHaveValue('3');
      await settled(page);
      await shot(page, info, 'arrivals-saved');
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      psql(`DELETE FROM stock_movements WHERE item_id = '${itemId}';
        DELETE FROM requests WHERE user_sub IN ('${subs.join("', '")}');
        DELETE FROM items WHERE id = '${itemId}';
        DELETE FROM users WHERE sub IN ('${subs.join("', '")}')`);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });
});
