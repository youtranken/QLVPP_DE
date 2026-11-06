import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
import { prevYmOf, stockOf } from './locked-request';

asRole('admin');

const month = (ym: string) => Number(ym.slice(5, 7));
const cardOf = (page: Page, name: string) => page.getByRole('heading', { level: 3, name, exact: true }).locator('xpath=ancestor::article');
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const find = (page: Page, text: string) => page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).fill(text);

// Ví dụ chuẩn của quyết định 2026-11-05: tủ 10 bút, A cần 3, B cần 10 → A đủ, B giao 7 nợ 3
async function seedStandard(tag: string, prevYm: string) {
  const a = { sub: `pw-gp-a-${tag}`, name: `PW Giao A ${tag}` };
  const b = { sub: `pw-gp-b-${tag}`, name: `PW Giao B ${tag}` };
  const pen = { name: `PW Bút giao ${tag}`, id: '' };
  for (const p of [a, b]) {
    psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES ('${p.sub}', '${p.name}', '${p.sub}@example.test', 'PW Phòng giao', 'active')`);
  }
  pen.id = psql(`INSERT INTO items (name, unit, stock_qty) VALUES ('${pen.name}', 'cai', 0) RETURNING id`);
  const createdPeriod = psql(`INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`) !== '';
  for (const [p, qty] of [[a, 3], [b, 10]] as const) {
    psql(`WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${p.sub}', '${p.sub}') RETURNING id)
      INSERT INTO request_lines (request_id, item_id, qty) SELECT id, '${pen.id}', ${qty} FROM r`);
  }
  const cleanup = () => {
    const subs = `'${a.sub}', '${b.sub}'`;
    psql(`DELETE FROM line_deliveries WHERE line_id IN (SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub IN (${subs}));
      DELETE FROM stock_movements WHERE item_id = '${pen.id}';
      DELETE FROM in_app_notifications WHERE user_sub IN (${subs});
      DELETE FROM requests WHERE user_sub IN (${subs});
      DELETE FROM items WHERE id = '${pen.id}';
      DELETE FROM users WHERE sub IN (${subs})`);
    if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
  };
  return { a, b, pen, cleanup };
}

test.describe('Giao hàng theo người (Plan v2-B, B3)', () => {
  test('Ví dụ chuẩn: A đủ 3, B giao 7 nợ 3', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const prevYm = prevYmOf(period.ym);
    const s = await seedStandard(tag, prevYm);
    try {
      const stock = await request.post(`/api/admin/items/${s.pen.id}/stock`, { headers: devHeaders('admin'), data: { delta: 10, reason: 'purchase', note: 'PW nhập tồn' } });
      expect(stock.ok()).toBe(true);

      await page.goto('/admin/delivery');
      await expect(page.getByRole('heading', { level: 1, name: `Giao hàng kỳ tháng ${month(prevYm)}` })).toBeVisible();
      await find(page, s.a.name);
      const cardA = cardOf(page, s.a.name);
      await expect(cardA.getByText('Chưa nhận', { exact: true })).toBeVisible();
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }
      await cardA.getByRole('button', { name: /^Giao đủ/ }).click();
      await expect(page.getByText(`Đã giao cho ${s.a.name}`)).toBeVisible();
      expect(stockOf(s.pen.id)).toBe(7);
      await expect(cardA.getByText('Đã nhận', { exact: true })).toBeVisible();

      await find(page, s.b.name);
      const cardB = cardOf(page, s.b.name);
      await expect(cardB.getByRole('button', { name: /^Giao 7\/10/ })).toBeVisible();
      await cardB.getByRole('button', { name: `Xem ${s.b.name}` }).click();
      const panel = isMobile(info) ? page.getByRole('dialog', { name: s.b.name }) : page.getByRole('region', { name: s.b.name, exact: true });
      await expect(panel.getByRole('spinbutton', { name: `Giao ${s.pen.name}` })).toHaveValue('7');
      await expect(panel.getByText('Giao 7 · Chưa nhận 3')).toBeVisible();
      await expect(panel.getByRole('button', { name: `Thêm Giao ${s.pen.name}` })).toBeDisabled();
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'ngăn kéo không rộng hơn màn 390').toBe(true);
      }
      await panel.getByRole('button', { name: 'Giao', exact: true }).click();
      await expect(page.getByText(`Đã giao cho ${s.b.name}`)).toBeVisible();
      expect(stockOf(s.pen.id)).toBe(0);
      if (isMobile(info)) await page.getByRole('button', { name: 'Đóng' }).click();

      await page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).clear();
      await expect(page.getByRole('radio', { name: /^Chưa nhận/ })).toBeChecked();
      // B được giao thiếu (7/10) tháng đang giao → vẫn "Chưa nhận" tới khi tháng sau khóa sổ
      const stillB = cardOf(page, s.b.name);
      await expect(stillB.getByText('Chưa nhận', { exact: true })).toBeVisible();
      await expect(stillB.getByText('Đã giao 7/10')).toBeVisible();
      await expect(stillB.getByRole('button', { name: /^Tủ chưa có hàng/ })).toBeDisabled();
      await expect(cardOf(page, s.a.name)).toHaveCount(0);
      await settled(page);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      s.cleanup();
      release();
    }
  });
});
