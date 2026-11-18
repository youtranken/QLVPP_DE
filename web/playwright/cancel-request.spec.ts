import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql } from './helpers';
import { prevYmOf } from './locked-request';

asRole('admin');

const rowOf = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });

// Người đã nghỉ có phiếu kỳ khóa: bút 10 đã giao 4, giấy 2 chưa giao
function seedLeft(tag: string, ym: string) {
  const sub = `pw-cr-${tag}`;
  const name = `PW Nghỉ ${tag}`;
  psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES ('${sub}', '${name}', '${sub}@example.test', 'PW Phòng', 'locked')`);
  const pen = psql(`INSERT INTO items (name, unit, stock_qty) VALUES ('PW Bút hủy ${tag}', 'cai', 0) RETURNING id`);
  const paper = psql(`INSERT INTO items (name, unit, stock_qty) VALUES ('PW Giấy hủy ${tag}', 'cai', 0) RETURNING id`);
  const createdPeriod = psql(`INSERT INTO periods (ym, deadline) VALUES ('${ym}-01', '${ym}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`) !== '';
  psql(`WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${ym}-01', '${sub}', '${sub}') RETURNING id)
    INSERT INTO request_lines (request_id, item_id, qty, delivered_qty) SELECT id, '${pen}', 10, 4 FROM r UNION ALL SELECT id, '${paper}', 2, 0 FROM r`);
  const cleanup = () => {
    psql(`DELETE FROM undo_actions WHERE payload->>'request_id' IN (SELECT id::text FROM requests WHERE user_sub = '${sub}');
      DELETE FROM requests WHERE user_sub = '${sub}';
      DELETE FROM items WHERE id IN ('${pen}', '${paper}');
      DELETE FROM users WHERE sub = '${sub}'`);
    if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${ym}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${ym}-01')`);
  };
  return { sub, name, cleanup };
}

const cancelledOf = (sub: string) =>
  psql(`SELECT string_agg(l.cancelled_qty::text, ',' ORDER BY l.qty DESC) FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub = '${sub}'`);

test.describe('Hủy phiếu người đã nghỉ', () => {
  test('E2-B2 Hủy phiếu người đã nghỉ: nút ở bảng và hộp Giao, xác nhận liệt kê món, hủy rồi Hoàn tác', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const s = seedLeft(tag, prevYmOf(period.ym));
    try {
      await page.goto('/admin/delivery');
      await page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).fill(s.name);
      const row = rowOf(page, s.name);
      await row.getByRole('button', { name: `Giao…, ${s.name}` }).click();
      const deliver = page.getByRole('dialog', { name: `Giao cho ${s.name}?` });
      await deliver.getByRole('button', { name: 'Hủy phiếu' }).click();

      const confirm = page.getByRole('dialog', { name: `Hủy phiếu của ${s.name}?` });
      await expect(confirm).toBeVisible();
      await expect(confirm.getByText(/^6 /)).toBeVisible();
      await expect(confirm.getByText(/^2 /)).toBeVisible();
      await expect(confirm.getByText(/giữ nguyên trong lịch sử/)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await confirm.getByRole('button', { name: 'Đóng' }).click();
      await expect(confirm).toHaveCount(0);
      expect(cancelledOf(s.sub)).toBe('0,0');

      await rowOf(page, s.name).getByRole('button', { name: `Hủy phiếu, ${s.name}` }).click();
      await page.getByRole('dialog', { name: `Hủy phiếu của ${s.name}?` }).getByRole('button', { name: 'Hủy phiếu' }).click();
      await expect(page.getByText(`Đã hủy phiếu của ${s.name} (2 món chưa giao).`)).toBeVisible();
      expect(cancelledOf(s.sub)).toBe('6,2');
      await page.getByRole('button', { name: /Hoàn tác/ }).click();
      await expect.poll(() => cancelledOf(s.sub)).toBe('0,0');
    } finally {
      s.cleanup();
      release();
    }
  });
});
