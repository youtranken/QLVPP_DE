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

const deliverPosts = (page: Page) => {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(deliver|deliver-all|cancel-remaining)$/.test(r.url())) seen.push(r.url());
  });
  return seen;
};

test.describe('Giao hàng theo người — mọi lần giao qua hộp xác nhận', () => {
  test('V2D-10 card opens dialog: A đủ 3, B giao 7 chưa nhận 3, kho cuối 0', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const prevYm = prevYmOf(period.ym);
    const s = await seedStandard(tag, prevYm);
    try {
      const stock = await request.post(`/api/admin/items/${s.pen.id}/stock`, { headers: devHeaders('admin'), data: { delta: 10, reason: 'purchase', note: 'PW nhập tồn' } });
      expect(stock.ok()).toBe(true);
      const posts = deliverPosts(page);

      await page.goto('/admin/delivery');
      await expect(page.getByRole('heading', { level: 1, name: `Giao hàng kỳ tháng ${month(prevYm)}` })).toBeVisible();
      await find(page, s.a.name);
      const cardA = cardOf(page, s.a.name);
      const actA = cardA.getByRole('button', { name: `Giao…, ${s.a.name}` });
      const view = await cardA.getByRole('button', { name: `Xem ${s.a.name}` }).boundingBox();
      const act = await actA.boundingBox();
      expect(act!.x - (view!.x + view!.width), '"Giao…" cách "Xem" ≥ 8 px').toBeGreaterThanOrEqual(8);
      await actA.click();
      const dlgA = page.getByRole('dialog', { name: `Giao cho ${s.a.name}?` });
      await expect(dlgA).toBeVisible();
      await expect(dlgA.getByRole('heading', { name: `Giao cho ${s.a.name}?` })).toBeFocused();
      expect(posts, 'mở hộp chưa gửi gì').toEqual([]);
      expect(page.url()).toMatch(/\/admin\/delivery(\?.*)?$/);
      if (isMobile(info)) {
        const box = await dlgA.boundingBox();
        const vp = page.viewportSize()!;
        expect(Math.round(box!.width), 'tấm đáy toàn rộng').toBe(vp.width);
        expect(Math.round(box!.y + box!.height), 'tấm đáy sát đáy màn').toBe(vp.height);
        expect(await fitsWidth(page), 'hộp không cuộn ngang ở 390').toBe(true);
        await expectNoContrastViolations(page);
      }
      await dlgA.getByRole('button', { name: 'Xác nhận giao' }).click();
      await expect(page.getByText(`Đã giao cho ${s.a.name}`)).toBeVisible();
      await expect(dlgA).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' })).toBeFocused();
      expect(stockOf(s.pen.id)).toBe(7);

      await find(page, s.b.name);
      await cardOf(page, s.b.name).getByRole('button', { name: `Giao…, ${s.b.name}` }).click();
      const dlgB = page.getByRole('dialog', { name: `Giao cho ${s.b.name}?` });
      await expect(dlgB.getByRole('spinbutton', { name: `Giao lần này: ${s.pen.name}` })).toHaveValue('7');
      await expect(dlgB.getByText('Chưa nhận 3')).toBeVisible();
      await expect(dlgB.getByRole('button', { name: `Thêm Giao lần này: ${s.pen.name}` })).toBeDisabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await dlgB.getByRole('button', { name: 'Xác nhận giao' }).click();
      await expect(page.getByText(`Đã giao cho ${s.b.name}`)).toBeVisible();
      expect(stockOf(s.pen.id)).toBe(0);
      expect(posts).toHaveLength(2);

      await page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).clear();
      // B được giao thiếu (7/10) tháng đang giao → vẫn "Chưa nhận" tới khi tháng sau khóa sổ
      const stillB = cardOf(page, s.b.name);
      await expect(stillB.getByText('Chưa nhận', { exact: true })).toBeVisible();
      await expect(stillB.getByText('Đã giao 7/10')).toBeVisible();
      await expect(stillB.getByRole('button', { name: /^Tủ chưa có hàng/ })).toBeDisabled();
      await settled(page);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      s.cleanup();
      release();
    }
  });
});
