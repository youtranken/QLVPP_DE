import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, searchSummaryPeople, settled } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-11-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

interface Seed {
  tag: string;
  sub: string;
  name: string;
  prevYm: string;
  requestId: string;
  items: { id: string; name: string }[];
  cleanup: () => void;
}

// Kỳ trước đã khóa (hạn đã qua) seed bằng SQL; món tạo bằng SQL dùng lại một ảnh có sẵn để không tải tệp mới lên kho tệp
async function seedLockedRequest(request: APIRequestContext, info: TestInfo, lines: { stock: number; qty: number }[]): Promise<Seed> {
  const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
  const sub = `pw-dlv-${tag}`;
  const name = `PW Giao ${tag}`;
  const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
  const prevYm = prevYmOf(period.ym);
  const fileId = psql(`SELECT id FROM files WHERE purpose = 'item_image' ORDER BY created_at LIMIT 1`);
  expect(fileId).not.toBe('');
  psql(`INSERT INTO users (sub, full_name, email, department, status)
    VALUES ('${sub}', '${name}', '${sub}@example.test', 'PW Phòng giao', 'active')`);
  const items = lines.map((l, i) => {
    const itemName = `PW món ${String.fromCharCode(65 + i)} ${tag}`;
    const id = psql(`INSERT INTO items (name, unit, image_file_id, stock_qty)
      VALUES ('${itemName}', 'cai', '${fileId}', ${l.stock}) RETURNING id`);
    return { id, name: itemName };
  });
  const createdPeriod = psql(
    `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
  );
  // created_at tăng dần theo thứ tự seed: listLines xếp theo created_at, id → thứ tự dòng và ảnh chụp tất định
  const values = lines.map((l, i) => `('${items[i].id}', ${l.qty}, ${i})`).join(', ');
  const requestId = psql(`WITH r AS (
      INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
    ), l AS (
      INSERT INTO request_lines (request_id, item_id, qty, created_at)
      SELECT r.id, x.item_id::uuid, x.qty, now() + x.pos * interval '1 second'
      FROM r, (VALUES ${values}) AS x(item_id, qty, pos)
    )
    SELECT id FROM r`);
  const ids = items.map((i) => `'${i.id}'`).join(', ');
  const cleanup = () => {
    psql(`DELETE FROM line_deliveries WHERE line_id IN (
        SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub = '${sub}');
      DELETE FROM stock_movements WHERE item_id IN (${ids});
      DELETE FROM in_app_notifications WHERE user_sub = '${sub}';
      DELETE FROM requests WHERE user_sub = '${sub}';
      DELETE FROM items WHERE id IN (${ids});
      DELETE FROM users WHERE sub = '${sub}'`);
    if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
  };
  return { tag, sub, name, prevYm, requestId, items, cleanup };
}

const stockOf = (id: string) => Number(psql(`SELECT stock_qty FROM items WHERE id = '${id}'`));

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

      // Trang Còn nợ là Task 12: kiểm phần còn lại qua chính API trang đó sẽ đọc
      const backlog = await (await request.get('/api/admin/backlog?by=person', { headers: devHeaders('admin') })).json();
      const owed = backlog.groups.flatMap((g: { lines: { name: string; remaining_qty: number }[] }) => g.lines);
      expect(owed.find((l: { name: string }) => l.name === a.name)?.remaining_qty).toBe(2);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'delivery-partial');

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
