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
import { PRIVATE_YM, clearPrivateSnapshots } from './private-period';

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

  test('E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do từng dòng (Khác 2/3 ký tự), lưu ra toast', async ({ page, request }, info) => {
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
      await expect(drawer.getByText('Kỳ đã khóa. Chỉ giảm hoặc bỏ dòng, mỗi dòng giảm cần lý do; không giảm dưới số đã giao.')).toBeVisible();
      // Sau khóa sổ không tăng/thêm được: không nút +, không "Thêm món"
      await expect(drawer.getByRole('button', { name: /^(\+|Tăng|Thêm (?!vào danh mục —))/ })).toHaveCount(0);
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
      await lineB.getByRole('button', { name: `Bớt ${b.name}` }).click();
      await lineB.getByRole('button', { name: `Bớt ${b.name}` }).click();
      await expect(lineB.getByText('Trước khi sửa: 3')).toBeVisible();

      const customLine = drawer.getByRole('listitem').filter({ hasText: custom });
      await expect(customLine.getByRole('group', { name: `Xử lý ${custom}` }).getByRole('button')).toHaveCount(3);
      await expect(customLine.getByRole('link', { name: 'Xem ở Món ngoài danh mục' })).toBeVisible();

      // Mỗi dòng giảm có khối "Vì sao giảm?"; còn dòng thiếu lý do → Lưu vô hiệu
      const save = drawer.getByRole('button', { name: 'Lưu điều chỉnh' });
      await expect(save).toBeDisabled();
      const whyA = lineA.getByRole('radiogroup', { name: 'Vì sao giảm?' });
      await whyA.getByRole('radio', { name: 'Khác' }).check();
      const noteA = lineA.getByLabel(/^Ghi thêm/);
      await noteA.fill('  ab  ');
      await expect(save).toBeDisabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'adjust-locked-reason');

      const reason = `abc`;
      await noteA.fill(reason);
      // Dùng cho dòng giảm còn lại (B chưa chọn lý do)
      await lineA.getByRole('button', { name: 'Dùng cho các món giảm còn lại' }).click();
      await expect(lineB.getByRole('radio', { name: 'Khác' })).toBeChecked();
      await expect(save).toBeEnabled();
      await save.click();
      await expect(drawer).toBeHidden();
      await expect(page.getByText(`Đã lưu điều chỉnh phiếu của ${name}`)).toBeVisible();

      const qty = psql(`SELECT string_agg(qty::text, ',' ORDER BY qty) FROM request_lines WHERE request_id = '${requestId}'`);
      expect(qty).toBe('1,1,2');
      const logged = psql(`SELECT string_agg(DISTINCT reason_code || ':' || reason_note, ',')
        FROM request_line_adjustments WHERE request_id = '${requestId}'`);
      expect(logged).toBe(`other:${reason}`);
    } finally {
      deleteTestUsers(sub);
      for (const it of items) await removeTestItem(request, it.id);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });

  test('E9-S2 Điều chỉnh: Hành chính khác lưu trước → STALE_UPDATE, "Tải bản mới nhất" lấy số mới', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 5 }]);
    const [item] = seed.items;
    const otherAdminSaves = async (qty: number) => {
      const view = await (await request.get(`/api/admin/requests/${seed.requestId}`, { headers: devHeaders('admin') })).json();
      const line = view.lines[0];
      const res = await request.put(`/api/admin/requests/${seed.requestId}/lines`, {
        headers: devHeaders('admin'),
        data: {
          lines: [{ id: line.id, qty, expected_qty: line.qty, reason_code: 'over_quota' }],
          expected_updated_at: view.updated_at,
        },
      });
      expect(res.status()).toBe(200);
    };
    try {
      await page.goto(`/admin/summary?ym=${seed.prevYm}`);
      await searchSummaryPeople(page, seed.tag);
      await page.getByRole('row').filter({ hasText: seed.name }).getByRole('button', { name: 'Điều chỉnh' }).click();
      const drawer = page.getByRole('dialog', { name: `Phiếu của ${seed.name}` });
      const line = drawer.getByRole('listitem').filter({ hasText: item.name });
      await expect(line.getByRole('spinbutton')).toHaveValue('5');
      await line.getByRole('button', { name: `Bớt ${item.name}` }).click();
      await line.getByRole('radiogroup', { name: 'Vì sao giảm?' }).getByRole('radio', { name: 'Vượt định mức' }).check();

      await otherAdminSaves(4);
      await drawer.getByRole('button', { name: 'Lưu điều chỉnh' }).click();
      await expect(drawer.getByRole('alert')).toContainText('Phiếu vừa được người khác sửa — tải lại.');
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

test.describe('Tổng hợp — giảm sau khi đã gửi ADM (Plan v2-D, Task 12)', () => {
  test('V2D-12 reduce after sent', async ({ page, request }, info) => {
    // Kỳ riêng của PW dùng chung với Gửi ADM/Hàng về (cùng xóa bản chốt kỳ riêng) nên vẫn giữ khóa
    const release = await acquireLock('prev-period');
    clearPrivateSnapshots();
    const seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 5 }], { ym: PRIVATE_YM });
    const [item] = seed.items;
    try {
      const made = await request.post(`/api/admin/reports/${PRIVATE_YM}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print' } });
      expect(made.status()).toBe(201);
      await page.goto(`/admin/summary?ym=${PRIVATE_YM}`);
      await searchSummaryPeople(page, seed.tag);
      await page.getByRole('row').filter({ hasText: seed.name }).getByRole('button', { name: 'Điều chỉnh' }).click();
      const drawer = page.getByRole('dialog', { name: `Phiếu của ${seed.name}` });
      const line = drawer.getByRole('listitem').filter({ hasText: item.name });
      await expect(line.getByRole('spinbutton')).toHaveValue('5');
      await expect(line.getByText(/^Phiếu gửi ADM lúc/)).toHaveCount(0);

      const less = line.getByRole('button', { name: `Bớt ${item.name}` });
      await less.click();
      await less.click();
      await expect(line.getByText(/^Phiếu gửi ADM lúc \d\d:\d\d \d\d\/\d\d đã tính số cũ — giảm bây giờ thì hàng về dư 2 cái vào kho\.$/)).toBeVisible();
      const save = drawer.getByRole('button', { name: 'Lưu điều chỉnh' });
      await expect(save).toBeDisabled();
      await line.getByRole('radiogroup', { name: 'Vì sao giảm?' }).getByRole('radio', { name: 'Vượt định mức' }).check();
      await expect(save).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'v2d-12-reduce-after-sent');

      await save.click();
      await expect(drawer).toBeHidden();
      const logged = psql(`SELECT qty_before || '>' || qty_after || ':' || reason_code
        FROM request_line_adjustments WHERE request_id = '${seed.requestId}'`);
      expect(logged).toBe('5>3:over_quota');
    } finally {
      clearPrivateSnapshots();
      seed.cleanup();
      release();
    }
  });
});
