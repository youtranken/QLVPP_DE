import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
import { prevYmOf, stockOf } from './locked-request';

asRole('admin');

const month = (ym: string) => Number(ym.slice(5, 7));
const cardOf = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
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
  test('V2D-10 row opens dialog: A đủ 3, B giao 7 chưa nhận 3, kho cuối 0', async ({ page, request }, info) => {
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
      const more = await cardA.getByRole('button', { name: `Thao tác cho ${s.a.name}` }).boundingBox();
      const act = await actA.boundingBox();
      expect(more!.x - (act!.x + act!.width), '"⋯" cách "Giao…" ≥ 8 px').toBeGreaterThanOrEqual(8);
      await actA.click();
      const dlgA = page.getByRole('dialog', { name: `Giao cho ${s.a.name}?` });
      await expect(dlgA).toBeVisible();
      await expect(dlgA.getByRole('heading', { name: `Giao cho ${s.a.name}?` })).toBeFocused();
      expect(posts, 'mở hộp chưa gửi gì').toEqual([]);
      expect(page.url()).toMatch(/\/admin\/delivery(\?.*)?$/);
      if (isMobile(info)) {
        // Đo sau hiệu ứng mở (scale .98 → 1), không đo giữa chừng
        await settled(page);
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
      // B được giao thiếu (7/10) tháng đang giao → vẫn ở tab Chưa nhận tới khi tháng sau khóa sổ
      const stillB = cardOf(page, s.b.name);
      await expect(stillB.getByText('7/10', { exact: true })).toBeVisible();
      await expect(stillB.getByRole('button', { name: /^Tủ chưa có hàng/ })).toBeDisabled();
      await settled(page);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      s.cleanup();
      release();
    }
  });

  test('Vòng3-GH chọn 2 phiếu giao một lần, tủ thiếu → phần thiếu chờ; bấm đúp chỉ một lượt', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}b${isMobile(info) ? 'm' : 'd'}`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const prevYm = prevYmOf(period.ym);
    const s = await seedStandard(tag, prevYm);
    try {
      // Tủ 5, A cần 3 (đăng ký trước), B cần 10: A đủ, B nhận 2, phần còn lại 8 vẫn chờ
      const stock = await request.post(`/api/admin/items/${s.pen.id}/stock`, { headers: devHeaders('admin'), data: { delta: 5, reason: 'purchase', note: 'PW nhập tồn' } });
      expect(stock.ok()).toBe(true);
      const bulkPosts: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/deliveries/bulk')) bulkPosts.push(r.url());
      });
      await page.goto('/admin/delivery');
      await find(page, 'PW Phòng giao');
      await expect(cardOf(page, s.b.name).getByText(`Thiếu: ${s.pen.name}`)).toBeVisible();
      await page.getByRole('checkbox', { name: `Chọn ${s.a.name}` }).check();
      await page.getByRole('checkbox', { name: `Chọn ${s.b.name}` }).check();
      await expect(page.getByText(/Đã chọn/)).toHaveCount(0);
      await settled(page);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.getByRole('button', { name: 'Giao 2 phiếu' }).click();
      const dlg = page.getByRole('dialog', { name: 'Giao 2 phiếu?' });
      await expect(dlg.getByText('Phần thiếu 8 chờ hàng về')).toBeVisible();
      await settled(page);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await dlg.getByRole('button', { name: 'Xác nhận giao' }).dblclick();
      await expect(page.getByText('Đã giao 2 phiếu')).toBeVisible();
      await expect(dlg).toHaveCount(0);
      expect(bulkPosts, 'bấm đúp chỉ một lượt').toHaveLength(1);
      expect(stockOf(s.pen.id)).toBe(0);
      const delivered = (sub: string) => psql(`SELECT l.delivered_qty || '/' || l.cancelled_qty FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub = '${sub}'`);
      expect(delivered(s.a.sub)).toBe('3/0');
      expect(delivered(s.b.sub), 'B nhận 2, phần thiếu không bị hủy').toBe('2/0');
      await expect(cardOf(page, s.b.name).getByText('2/10', { exact: true })).toBeVisible();
    } finally {
      s.cleanup();
      release();
    }
  });

  test('G4 Giao hàng: bảng Tiến độ/Tủ/Còn nợ, "Từ chối / giảm dòng…" trong hộp Giao mở Điều chỉnh, lưu xong hộp Giao lấy số mới', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const release = await acquireLock('prev-period');
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}g4`;
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const prevYm = prevYmOf(period.ym);
    const s = await seedStandard(tag, prevYm);
    try {
      const stock = await request.post(`/api/admin/items/${s.pen.id}/stock`, { headers: devHeaders('admin'), data: { delta: 10, reason: 'purchase', note: 'PW nhập tồn' } });
      expect(stock.ok()).toBe(true);
      await page.goto('/admin/delivery');
      await find(page, tag);
      const cardB = cardOf(page, s.b.name);
      await expect(cardB.getByText('0/10')).toBeVisible();
      await expect(cardB.getByText(`Thiếu: ${s.pen.name}`)).toBeVisible();
      expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);

      await cardB.getByRole('button', { name: `Giao…, ${s.b.name}` }).click();
      const dlg = page.getByRole('dialog', { name: `Giao cho ${s.b.name}?` });
      await dlg.getByRole('button', { name: 'Từ chối / giảm dòng…' }).click();
      const adjust = page.getByRole('dialog', { name: `Điều chỉnh phiếu ${s.b.name}` });
      await adjust.getByRole('checkbox', { name: `Chọn ${s.pen.name}` }).check();
      await adjust.getByRole('spinbutton', { name: `Giảm còn: ${s.pen.name}` }).fill('5');
      await adjust.getByRole('radiogroup', { name: 'Lý do' }).getByRole('radio', { name: 'Hết hàng' }).check();
      await adjust.getByRole('button', { name: 'Lưu 1 thay đổi' }).click();
      await expect(adjust).toBeHidden();
      const row = dlg.getByRole('row').filter({ hasText: s.pen.name });
      await expect(row.getByText(/^Cần 5 ·/)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await dlg.getByRole('button', { name: 'Đóng', exact: true }).click();
    } finally {
      s.cleanup();
      release();
    }
  });
});

