import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, monthRowAction, pendingConfirm, psql, removeTestItem, searchMonthPeople, seedActiveUser, seedPwItem, settled } from './helpers';
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

  test('G2 Điều chỉnh phiếu: tick dòng, Giảm còn (≥ đã giao) / Từ chối, một lý do chip (Khác 2/3 ký tự), câu xem trước, lưu ra toast', async ({ page, request }, info) => {
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
      await page.goto(`/admin/month?ym=${prevYm}`);
      await searchMonthPeople(page, tag);
      await monthRowAction(page, name, 'Điều chỉnh phiếu');

      const dialog = page.getByRole('dialog', { name: `Điều chỉnh phiếu ${name}` });
      await expect(dialog).toBeVisible();
      // Sau khóa sổ không tăng/thêm được: không nút +, không "Thêm món"
      await expect(dialog.getByRole('button', { name: /^(\+|Tăng|Thêm )/ })).toHaveCount(0);
      // Dòng ngoài DM chờ duyệt: duyệt ở Xem phiếu, không tick ở đây
      await expect(dialog.getByRole('checkbox', { name: `Chọn ${custom}` })).toHaveCount(0);
      await expect(dialog.getByText('Chờ duyệt — duyệt ở Xem phiếu')).toBeVisible();

      const save = dialog.getByRole('button', { name: /^Lưu \d+ thay đổi$/ });
      await expect(save).toBeDisabled();
      await dialog.getByRole('checkbox', { name: `Chọn ${a.name}` }).check();
      const qtyA = dialog.getByRole('spinbutton', { name: `Giảm còn: ${a.name}` });
      await expect(qtyA).toHaveAttribute('min', '2');
      await qtyA.fill('1');
      await expect(qtyA).toHaveAttribute('aria-invalid', 'true');
      await qtyA.fill('3');
      await dialog.getByRole('checkbox', { name: `Chọn ${b.name}` }).check();
      await dialog.getByRole('radiogroup', { name: `Cách điều chỉnh ${b.name}` }).getByRole('radio', { name: 'Từ chối' }).check();
      await dialog.getByRole('radiogroup', { name: 'Lý do' }).getByRole('radio', { name: 'Khác', exact: true }).check();
      const note = dialog.getByLabel(/^Ghi thêm/);
      await note.fill('  ab  ');
      await expect(save).toBeDisabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'g2-adjust');

      const reason = 'abc';
      await note.fill(reason);
      const preview = dialog.getByText(/^Adm D&E /);
      await expect(preview).toContainText(`giảm ${a.name} 4 → 3 cái`);
      await expect(preview).toContainText(`từ chối ${b.name}`);
      await expect(preview).toContainText(`(tháng ${Number(prevYm.slice(5))}): ${reason}.`);
      await expect(save).toBeEnabled();
      await expect(save).toHaveText('Lưu 2 thay đổi');
      await save.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(`Đã lưu điều chỉnh phiếu của ${name}`)).toBeVisible();

      const qty = psql(`SELECT string_agg(qty::text, ',' ORDER BY qty) FROM request_lines WHERE request_id = '${requestId}'`);
      expect(qty).toBe('1,3');
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

  test('E9-S2 Điều chỉnh: Adm D&E khác lưu trước → STALE_UPDATE, "Tải bản mới nhất" lấy số mới', async ({ page, request }, info) => {
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
      await page.goto(`/admin/month?ym=${seed.prevYm}`);
      await searchMonthPeople(page, seed.tag);
      await monthRowAction(page, seed.name, 'Điều chỉnh phiếu');
      const dialog = page.getByRole('dialog', { name: `Điều chỉnh phiếu ${seed.name}` });
      const line = dialog.getByRole('listitem').filter({ hasText: item.name });
      await expect(line).toContainText('5 cái');
      await dialog.getByRole('checkbox', { name: `Chọn ${item.name}` }).check();
      await dialog.getByRole('radiogroup', { name: 'Lý do' }).getByRole('radio', { name: 'Hết hàng' }).check();

      await otherAdminSaves(4);
      await dialog.getByRole('button', { name: /^Lưu \d+ thay đổi$/ }).click();
      await expect(dialog.getByRole('alert')).toContainText('Phiếu vừa được người khác sửa — tải lại.');
      await snap(page, info, 'adjust-stale');
      await dialog.getByRole('button', { name: 'Tải bản mới nhất' }).click();
      await expect(line).toContainText('4 cái');
      await expect(dialog.getByRole('alert')).toHaveCount(0);
    } finally {
      seed.cleanup();
      release();
    }
  });
});

test.describe('Tổng hợp — giảm sau khi đã gửi NCC (Plan v2-D, Task 12)', () => {
  test('V2D-12 reduce after sent', async ({ page, request }, info) => {
    // Kỳ riêng của PW dùng chung với Gửi ADM/Hàng về (cùng xóa bản chốt kỳ riêng) nên vẫn giữ khóa
    const release = await acquireLock('prev-period');
    clearPrivateSnapshots();
    const seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 5 }], { ym: PRIVATE_YM });
    const [item] = seed.items;
    try {
      const made = await request.post(`/api/admin/reports/${PRIVATE_YM}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print', ...(await pendingConfirm(request, PRIVATE_YM)) } });
      expect(made.status()).toBe(201);
      await page.goto(`/admin/month?ym=${PRIVATE_YM}`);
      await searchMonthPeople(page, seed.tag);
      await monthRowAction(page, seed.name, 'Điều chỉnh phiếu');
      const dialog = page.getByRole('dialog', { name: `Điều chỉnh phiếu ${seed.name}` });
      const line = dialog.getByRole('listitem').filter({ hasText: item.name });
      await expect(line).toContainText('5 cái');
      await expect(line.getByText(/^Phiếu gửi NCC lúc/)).toHaveCount(0);

      await dialog.getByRole('checkbox', { name: `Chọn ${item.name}` }).check();
      await dialog.getByRole('spinbutton', { name: `Giảm còn: ${item.name}` }).fill('3');
      await expect(line.getByText(/^Phiếu gửi NCC lúc \d\d:\d\d \d\d\/\d\d đã tính số cũ — giảm bây giờ thì hàng về dư 2 cái vào kho\.$/)).toBeVisible();
      const save = dialog.getByRole('button', { name: /^Lưu \d+ thay đổi$/ });
      await expect(save).toBeDisabled();
      await dialog.getByRole('radiogroup', { name: 'Lý do' }).getByRole('radio', { name: 'Hết hàng' }).check();
      await expect(save).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'v2d-12-reduce-after-sent');

      await save.click();
      await expect(dialog).toBeHidden();
      const logged = psql(`SELECT qty_before || '>' || qty_after || ':' || reason_code
        FROM request_line_adjustments WHERE request_id = '${seed.requestId}'`);
      expect(logged).toBe('5>3:adm_out_of_stock');
    } finally {
      clearPrivateSnapshots();
      seed.cleanup();
      release();
    }
  });
});
