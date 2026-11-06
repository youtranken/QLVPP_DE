import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, expectNoContrastViolations, isMobile, psql, seedActiveUser } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-13-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

test.describe('E2-S6 lịch sử', () => {
  test('E2-S6 lịch sử: bottom nav ≤ 2 chạm, kỳ đang mở về /, kỳ cũ có tiến độ và nhãn ngoài danh mục', async ({ page, request }, info) => {
    const sub = `pw-hist-${Date.now()}-${info.project.name}`;
    const headers = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    seedActiveUser(sub, `PW Lịch sử ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const period = await (await request.get('/api/periods/current', { headers })).json();
    const month = Number(String(period.ym).slice(5));
    const prevYm = prevYmOf(period.ym);
    const prevMonth = Number(prevYm.slice(5));
    const items: { id: string; name: string; active: boolean; admin_only: boolean }[] = await (await request.get('/api/items', { headers })).json();
    const [a, b] = items.filter((i) => i.active && !i.admin_only && !i.name.startsWith('PW '));
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
      const open = page.getByRole('link', { name: new RegExp(`Tháng ${month}/`) });
      await expect(open).toBeVisible();
      await expect(open.getByText('Đang mở')).toBeVisible();
      await expect(open).toHaveAttribute('href', '/');
      const prev = page.getByRole('link', { name: new RegExp(`Tháng ${prevMonth}/`) });
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
      await expect(page.getByRole('heading', { level: 1, name: `Phiếu tháng ${prevMonth}/${prevYm.slice(0, 4)}` })).toBeVisible();
      const bars = page.getByRole('progressbar');
      await expect(bars).toHaveCount(2);
      await expect(page.getByRole('progressbar', { name: 'Đã nhận 5 trên 7' })).toBeVisible();
      await expect(page.getByText('đã hủy 1')).toBeVisible();
      await expect(page.getByText('Chờ Hành chính xem')).toBeVisible();
      await expect(page.getByText('Từ chối: Đã có trong kho')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'detail');
    } finally {
      deleteTestUsers(sub);
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

      await page.getByRole('link', { name: new RegExp(`Tháng ${prevMonth}/`) }).click();
      await expect(page.getByText('đã hủy 2 — Người đã nghỉ')).toBeVisible();
      const bar = page.getByRole('progressbar', { name: 'Đã nhận 3 trên 3' });
      await expect(bar).toHaveAttribute('aria-valuemax', '3');
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      psql(`DELETE FROM stock_movements WHERE item_id = '${itemId}'`);
      deleteTestUsers(sub);
      psql(`DELETE FROM items WHERE id = '${itemId}'`);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });
});
