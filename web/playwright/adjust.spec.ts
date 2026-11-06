import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import {
  acquireLock,
  asRole,
  deleteTestUsers,
  devHeaders,
  expectNoContrastViolations,
  isMobile,
  psql,
  removeTestItem,
  searchSummaryPeople,
  seedActiveUser,
  seedPwItem,
  settled,
} from './helpers';
import { seedLockedRequest } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-30-giao-dien-hanh-chinh/task-11-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  // Ngăn trượt vào 180 ms: chụp sau khi chuyển động xong
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` });
}

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const asMember = (sub: string) => ({ 'x-dev-user-sub': sub, 'x-dev-role': 'member' });

async function uploadLineImage(request: APIRequestContext, sub: string) {
  const img = await request.post('/api/files', {
    headers: asMember(sub),
    multipart: { purpose: 'line_image', file: { name: 'l.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(img.status()).toBe(201);
  return (await img.json()).id as string;
}

function seedUser(sub: string, name: string) {
  seedActiveUser(sub, name, 'active', { department: 'PW Phòng điều chỉnh' });
}

asRole('admin');

test.describe('E3-S3 điều chỉnh phiếu kỳ khóa (M1)', () => {
  // Mỗi test tự gieo món PW có ảnh qua API (tải ảnh + tạo món) nên dài hơn mặc định 30 s
  test.describe.configure({ timeout: 60_000 });

  test('E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do 2/3 ký tự, lưu ra toast', async ({ page, request }, info) => {
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const sub = `pw-adj-${tag}`;
    const name = `PW Điều chỉnh ${tag}`;
    seedUser(sub, name);
    const period = await (await request.get('/api/periods/current', { headers: asMember(sub) })).json();
    const prevYm = prevYmOf(period.ym);
    const items = [await seedPwItem(page), await seedPwItem(page)];
    const [a, b] = items;
    const imageId = await uploadLineImage(request, sub);
    const custom = `PW băng keo ${tag}`;
    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    const requestId = psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      ), l AS (
        INSERT INTO request_lines (request_id, item_id, qty, delivered_qty)
        SELECT r.id, x.item_id::uuid, x.qty, x.delivered FROM r,
          (VALUES ('${a.id}', 4, 2), ('${b.id}', 3, 0)) AS x(item_id, qty, delivered)
      ), c AS (
        INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, review_status)
        SELECT r.id, '${custom}', 'cai', '${imageId}'::uuid, 1, 'pending' FROM r
      )
      SELECT id FROM r`);
    try {
      await page.goto(`/admin/summary?ym=${prevYm}`);
      await searchSummaryPeople(page, tag);
      await page.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Điều chỉnh' }).click();

      const drawer = page.getByRole('dialog', { name: `Phiếu của ${name}` });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText('Đã khóa', { exact: true })).toBeVisible();
      await expect(drawer.getByText('Kỳ đã khóa. Chỉ Hành chính sửa được, phải ghi lý do; không giảm dưới số đã giao.')).toBeVisible();
      expect((await drawer.boundingBox())!.width).toBeCloseTo(isMobile(info) ? 390 : 384, 0);

      const lineA = drawer.getByRole('listitem').filter({ hasText: a.name });
      const lineB = drawer.getByRole('listitem').filter({ hasText: b.name });
      await expect(lineA.getByText('đã giao 2')).toBeVisible();
      await expect(lineA.getByRole('button', { name: /^Bỏ / })).toHaveCount(0);
      const lessA = lineA.getByRole('button', { name: `Bớt ${a.name}` });
      await lessA.click();
      await expect(lineA.getByRole('spinbutton')).toHaveValue('3');
      await expect(lessA).toBeEnabled();
      await lessA.click();
      await expect(lineA.getByRole('spinbutton')).toHaveValue('2');
      await expect(lessA).toBeDisabled();
      await lineB.getByRole('button', { name: `Thêm ${b.name}` }).click();
      await lineB.getByRole('button', { name: `Thêm ${b.name}` }).click();
      await expect(lineB.getByText('Trước khi sửa: 3')).toBeVisible();

      const customLine = drawer.getByRole('listitem').filter({ hasText: custom });
      await expect(customLine.getByRole('group', { name: `Xử lý ${custom}` }).getByRole('button')).toHaveCount(3);
      await expect(customLine.getByRole('link', { name: 'Xem ở Món ngoài danh mục' })).toBeVisible();

      const save = drawer.getByRole('button', { name: 'Lưu điều chỉnh' });
      const reasonBox = drawer.getByLabel('Lý do điều chỉnh');
      await reasonBox.fill('  ab  ');
      await save.click();
      await expect(reasonBox).toHaveAttribute('aria-invalid', 'true');
      await expect(drawer.getByText('Kỳ đã khóa — nhập lý do điều chỉnh (ít nhất 3 ký tự).')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'adjust-locked-reason');

      const reason = `abc`;
      await reasonBox.fill(reason);
      await save.click();
      await expect(drawer).toBeHidden();
      await expect(page.getByText(`Đã lưu điều chỉnh phiếu của ${name}`)).toBeVisible();

      const qty = psql(`SELECT string_agg(qty::text, ',' ORDER BY qty) FROM request_lines WHERE request_id = '${requestId}'`);
      expect(qty).toBe('1,2,5');
      const logged = psql(`SELECT detail->>'reason' FROM audit_log
        WHERE object_type = 'request' AND object_id = '${requestId}' AND action = 'request.updated'`);
      expect(logged).toBe(reason);
    } finally {
      deleteTestUsers(sub);
      for (const it of items) await removeTestItem(request, it.id);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });

  test('E9-S2 Điều chỉnh: Hành chính khác lưu trước → STALE_UPDATE, "Tải bản mới nhất" lấy số mới', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 1 }]);
    const [item] = seed.items;
    const otherAdminSaves = async (qty: number) => {
      const view = await (await request.get(`/api/admin/requests/${seed.requestId}`, { headers: devHeaders('admin') })).json();
      const line = view.lines[0];
      const res = await request.put(`/api/admin/requests/${seed.requestId}/lines`, {
        headers: devHeaders('admin'),
        data: { lines: [{ id: line.id, qty }], expected_updated_at: view.updated_at, reason: 'Hành chính khác sửa' },
      });
      expect(res.status()).toBe(200);
    };
    try {
      await page.goto(`/admin/summary?ym=${seed.prevYm}`);
      await searchSummaryPeople(page, seed.tag);
      await page.getByRole('row').filter({ hasText: seed.name }).getByRole('button', { name: 'Điều chỉnh' }).click();
      const drawer = page.getByRole('dialog', { name: `Phiếu của ${seed.name}` });
      const line = drawer.getByRole('listitem').filter({ hasText: item.name });
      await expect(line.getByRole('spinbutton')).toHaveValue('1');
      await line.getByRole('button', { name: `Thêm ${item.name}` }).click();
      await drawer.getByLabel('Lý do điều chỉnh').fill('Bổ sung theo email');

      await otherAdminSaves(4);
      await drawer.getByRole('button', { name: 'Lưu điều chỉnh' }).click();
      await expect(drawer.getByRole('alert')).toContainText('Nhân viên vừa sửa phiếu này — tải bản mới nhất rồi sửa lại.');
      await snap(page, info, 'adjust-stale');
      await drawer.getByRole('button', { name: 'Tải bản mới nhất' }).click();
      await expect(line.getByRole('spinbutton')).toHaveValue('4');
      await expect(drawer.getByRole('alert')).toHaveCount(0);
    } finally {
      seed.cleanup();
      release();
    }
  });
});
