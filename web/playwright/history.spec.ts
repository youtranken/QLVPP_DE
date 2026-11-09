import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, expectNoContrastViolations, isMobile, psql, removeTestItem, seedActiveUser, seedPwItem, skipNewPeriodPopup } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-13-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

// Kỳ quá khứ chỉ V2D-21 dùng (khác PRIVATE_YM của Gửi ADM/Hàng về): cũ trước
const OWED_YMS = ['2000-03', '2000-04'] as const;

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

test.describe('E2-S6 lịch sử', () => {
  // Popup kỳ mới (vòng 4) phủ trang Đăng ký của nhân viên chưa lưu phiếu: spec này không thử popup
  test.beforeEach(({ page }) => skipNewPeriodPopup(page));

  test('E2-S6 lịch sử: bottom nav ≤ 2 chạm, kỳ đang mở về /, kỳ cũ có tiến độ và nhãn ngoài danh mục', async ({ page, request }, info) => {
    const sub = `pw-hist-${Date.now()}-${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Lịch sử ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const period = await (await request.get('/api/periods/current', { headers })).json();
    const month = Number(String(period.ym).slice(5));
    const prevYm = prevYmOf(period.ym);
    const prevMonth = Number(prevYm.slice(5));
    const [a, b] = [await seedPwItem(page), await seedPwItem(page)];
    const img = await request.post('/api/files', {
      headers,
      multipart: { purpose: 'line_image', file: { name: 'l.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
    });
    expect(img.status()).toBe(201);
    const imageId = (await img.json()).id as string;

    // Phiếu kỳ hiện tại qua API (kỳ đang mở xuất hiện trong lịch sử)
    const saved = await request.put('/api/me/request/lines', { headers, data: { ym: period.ym, lines: [{ item_id: a.id, qty: 1 }] } });
    expect(saved.status()).toBe(200);

    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      ), m AS (
        INSERT INTO request_lines (request_id, item_id, qty, delivered_qty, cancelled_qty)
        SELECT r.id, x.item::uuid, x.qty, x.dq, x.cq FROM r, (VALUES ('${a.id}', 8, 5, 1), ('${b.id}', 2, 2, 0)) AS x(item, qty, dq, cq)
      )
      INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, review_status, review_note)
      SELECT r.id, y.name, 'cai', '${imageId}'::uuid, 1, y.st, y.note FROM r,
        (VALUES ('PW Bìa còng', 'pending', NULL), ('PW Kéo', 'rejected', 'Đã có trong kho')) AS y(name, st, note)`);

    try {
      await page.goto('/');
      if (isMobile(info)) {
        await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Lịch sử' }).tap();
      } else {
        await page.getByRole('navigation', { name: 'Chuyển trang' }).getByRole('link', { name: 'Lịch sử' }).click();
      }
      await expect(page.getByRole('heading', { level: 1, name: 'Lịch sử' })).toBeVisible();
      const open = page.getByRole('link', { name: new RegExp(`^Tháng ${month}(?!\\d)`) });
      await expect(open).toBeVisible();
      await expect(open.getByText('Đang mở')).toBeVisible();
      await expect(open).toHaveAttribute('href', '/');
      const prev = page.getByRole('link', { name: new RegExp(`^Tháng ${prevMonth}(?!\\d)`) });
      await expect(prev.getByText('Còn chờ 1 món')).toBeVisible();
      await expect(prev.getByText('1 món chờ Hành chính xem · 1 món bị từ chối')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'list');
      await page.screenshot({ path: `../live-real/v2c/final/history-${info.project.name}.png` });

      await open.click();
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^Đăng ký văn phòng phẩm tháng ${month}$`) })).toBeVisible();
      await page.getByRole('navigation', { name: isMobile(info) ? 'Điều hướng chính' : 'Chuyển trang' }).getByRole('link', { name: 'Lịch sử' }).click();
      await prev.click();

      await expect(page).toHaveURL(new RegExp(`/history/${prevYm}$`));
      await expect(page.getByRole('heading', { name: `Phiếu tháng ${prevMonth}/${prevYm.slice(0, 4)}` })).toBeVisible();
      const rowA = page.getByRole('row').filter({ hasText: a.name });
      await expect(rowA.getByText('Chờ 2')).toBeVisible();
      await expect(rowA.getByText('đã hủy 1')).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: b.name }).getByText('Đã nhận 2/2')).toBeVisible();
      await expect(page.getByText('Chờ Hành chính xem', { exact: true })).toBeVisible();
      await expect(page.getByText('Từ chối: Đã có trong kho')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'detail');
    } finally {
      deleteTestUsers(sub);
      for (const it of [a, b]) await removeTestItem(request, it.id);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });

  test('E6 nhận lẻ: Lịch sử có mục Nhận lẻ trong ≤ 2 chạm và "đã hủy 2 — lý do" ở phiếu kỳ khóa', async ({ page, request }, info) => {
    const run = `${Date.now()}-${info.project.name}`;
    const sub = `pw-issue-${run}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Nhận lẻ ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const period = await (await request.get('/api/periods/current', { headers })).json();
    const prevYm = prevYmOf(period.ym);
    const prevMonth = Number(prevYm.slice(5));
    const itemName = `PW Nhận lẻ ${run}`;
    const note = `PW cấp cho người mới ${run}`;
    const itemId = psql(`INSERT INTO items (name, unit, stock_qty) VALUES ('${itemName}', 'cay', 50) RETURNING id`).split('\n')[0];
    psql(`INSERT INTO stock_movements (item_id, delta, reason, note, recipient_sub, actor_sub)
      VALUES ('${itemId}', -3, 'issue', '${note}', '${sub}', 'pw-admin')`);

    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      )
      INSERT INTO request_lines (request_id, item_id, qty, delivered_qty, cancelled_qty, cancel_note)
      SELECT r.id, '${itemId}', 5, 3, 2, 'Người đã nghỉ' FROM r`);

    try {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: isMobile(info) ? 'Điều hướng chính' : 'Chuyển trang' });
      if (isMobile(info)) await nav.getByRole('link', { name: 'Lịch sử' }).tap();
      else await nav.getByRole('link', { name: 'Lịch sử' }).click();
      const section = page.getByRole('region', { name: 'Nhận lẻ' });
      await expect(section).toBeVisible();
      await expect(section.getByText(itemName)).toBeVisible();
      await expect(section.getByText('3 cây')).toBeVisible();
      await expect(section.getByText(note)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'issues');

      await page.getByRole('link', { name: new RegExp(`^Tháng ${prevMonth}(?!\\d)`) }).click();
      await expect(page.getByText('đã hủy 2 — Người đã nghỉ')).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: itemName }).getByText('Đã nhận 3/3')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      psql(`DELETE FROM stock_movements WHERE item_id = '${itemId}'`);
      deleteTestUsers(sub);
      psql(`DELETE FROM items WHERE id = '${itemId}'`);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });

  // Hai kỳ quá khứ riêng của spec (không phải kỳ trước thật của dev); owed liệt kê mọi kỳ đã khóa nên kỳ cũ vẫn hiện
  test('V2D-21 owed across months: Đăng ký nói mọi tháng còn chờ nhận, ≤ 2 chạm tới điều chỉnh của Hành chính trong Lịch sử', async ({ page, request }, info) => {
    const sub = `pw-owed-${Date.now()}-${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Chờ nhận ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const [olderYm, prevYm] = OWED_YMS;
    const [pen, tape, glue] = [await seedPwItem(page), await seedPwItem(page), await seedPwItem(page)];
    const monthOf = (ym: string) => Number(ym.slice(5));
    // Bảng điều chỉnh chỉ-thêm, không dọn được: giả bản ghi "Hành chính giảm 3 → 1" ở trình duyệt; phía server đã có e2e me-request-adjustments
    const adjustment = { before: 3, after: 1, reason_code: 'over_quota', reason_note: null, at: `${prevYm}-13T02:10:00Z` };
    await page.route(
      (url) => url.pathname === '/api/me/request' && url.searchParams.get('ym') === prevYm,
      async (route) => {
        const res = await route.fetch({ headers: { ...route.request().headers(), ...headers } });
        const body = await res.json();
        const lines = body.lines.map((l: { item_id: string | null }) => (l.item_id === tape.id ? { ...l, adjustments: [adjustment] } : l));
        await route.fulfill({ response: res, json: { ...body, lines } });
      },
    );

    const release = await acquireLock('owed-private-periods');
    const created = OWED_YMS.filter((ym) =>
      psql(`INSERT INTO periods (ym, deadline) VALUES ('${ym}-01', '${ym}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`),
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${olderYm}-01', '${sub}', '${sub}') RETURNING id
      ) INSERT INTO request_lines (request_id, item_id, qty, delivered_qty) SELECT r.id, '${pen.id}', 3, 1 FROM r`);
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      ), t AS (
        INSERT INTO request_lines (request_id, item_id, qty) SELECT r.id, '${tape.id}', 1 FROM r
      )
      INSERT INTO request_lines (request_id, item_id, qty, delivered_qty) SELECT r.id, '${glue.id}', 2, 1 FROM r`);

    try {
      await page.goto('/');
      // Vòng 3: một dải duy nhất, các tháng cũ còn chờ là liên kết
      const strip = page.locator('.rq-recv-strip');
      await expect(strip).toHaveCount(1);
      await expect(strip).toContainText(`Tháng ${monthOf(olderYm)} còn chờ 1 món · Tháng ${monthOf(prevYm)} còn chờ 2 món`);
      await expect(page.getByText(/\bnợ\b/)).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);

      const tap = (target: ReturnType<Page['getByRole']>) => (isMobile(info) ? target.tap() : target.click());
      await tap(strip.getByRole('link', { name: `Tháng ${monthOf(prevYm)} còn chờ 2 món` }));
      await expect(page).toHaveURL(new RegExp(`/history/${prevYm}$`));
      await expect(page.getByText(`13/${prevYm.slice(5)} 09:10 · ${tape.name} 3 thành 1 · Lý do: Vượt định mức`)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestUsers(sub);
      for (const it of [pen, tape, glue]) await removeTestItem(request, it.id);
      for (const ym of created) psql(`DELETE FROM periods WHERE ym = '${ym}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${ym}-01')`);
      release();
    }
  });

  test('Vòng3-LS master–detail 1280: danh sách năm → tháng bên trái, phiếu bên phải; 390 danh sách → chi tiết ≤ 2 chạm và quay lại giữ danh sách (axe)', async ({ page, request }, info) => {
    const sub = `pw-hist3-${Date.now()}-${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Lịch sử ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const period = await (await request.get('/api/periods/current', { headers })).json();
    const prevYm = prevYmOf(period.ym);
    const prevMonth = Number(prevYm.slice(5));
    const a = await seedPwItem(page);
    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      ) INSERT INTO request_lines (request_id, item_id, qty, delivered_qty, last_delivered_at)
        SELECT r.id, '${a.id}', 2, 1, '${prevYm}-08T02:10:00Z' FROM r`);
    try {
      await page.goto('/history');
      await expect(page.getByRole('heading', { level: 1, name: 'Lịch sử' })).toBeVisible();
      const master = page.getByRole('navigation', { name: 'Lịch sử' });
      await expect(master.getByRole('heading', { level: 2, name: prevYm.slice(0, 4) })).toBeVisible();
      const link = master.getByRole('link', { name: new RegExp(`^Tháng ${prevMonth}(?!\\d)`) });
      await expect(link).toBeVisible();
      if (isMobile(info)) {
        await expect(page.getByRole('heading', { name: new RegExp('^Phiếu tháng') })).toHaveCount(0);
        await expectNoContrastViolations(page);
        await link.tap();
        await expect(page).toHaveURL(new RegExp(`/history/${prevYm}$`));
        await expect(page.getByRole('heading', { level: 1, name: `Phiếu tháng ${prevMonth}/${prevYm.slice(0, 4)}` })).toBeVisible();
        await expect(master).toHaveCount(0);
        await expectNoContrastViolations(page);
        await page.locator('.m-back').tap();
        await expect(link).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { level: 2, name: `Phiếu tháng ${prevMonth}/${prevYm.slice(0, 4)}` })).toBeVisible();
        await expect(link).toHaveAttribute('aria-current', 'page');
        const row = page.getByRole('row').filter({ hasText: a.name });
        await expect(row.getByText('Chờ 1')).toBeVisible();
        await expect(row.getByText(`Nhận 09:10 08/${prevYm.slice(5)}`)).toBeVisible();
        await snap(page, info, 'master-detail');
      }
    } finally {
      deleteTestUsers(sub);
      await removeTestItem(request, a.id);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });
});
