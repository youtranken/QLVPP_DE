import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, psql, removeTestItem, seedActiveUser } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-12-shots';
const FIXTURE = 'playwright/fixtures/item.png';

function memberIdentity(info: TestInfo, tag: string) {
  const sub = `pw-${tag}-${Date.now()}-${info.project.name}`;
  return { sub, headers: { 'x-dev-user-sub': sub, 'x-dev-role': 'member' } };
}

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

async function createItem(request: APIRequestContext, name: string, extra: Record<string, unknown>) {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: { purpose: 'item_image', file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync(FIXTURE) } },
  });
  expect(file.status()).toBe(201);
  const item = await request.post('/api/admin/items', {
    headers,
    data: { name, unit: 'cai', image_file_id: (await file.json()).id, ...extra },
  });
  expect(item.status()).toBe(201);
  return (await item.json()).id as string;
}

async function routeAs(page: Page, headers: Record<string, string>) {
  await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
}

test.describe('Trang Đăng ký — món ngoài danh mục, chép lại', () => {
  test('E2-S5 món ngoài danh mục: chọn ảnh → lưu → tải lại thấy "Chờ Hành chính xem"; rời trang khi chưa lưu thì hỏi', async ({
    page,
  }, info) => {
    const me = memberIdentity(info, 'custom');
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await routeAs(page, me.headers);
    const name = `PW món lạ ${Date.now()}`;

    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const addOther = grid.getByRole('button', { name: '+ Thêm món khác' });
      await expect(addOther).toBeInViewport();
      await addOther.click();
      const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
      await dialog.getByLabel('Tên món').fill(name);
      await dialog.getByLabel('Đơn vị tính').selectOption('hop');
      await expect(dialog.getByText('Ảnh (không bắt buộc)')).toBeVisible();
      await expect(dialog.getByText('Cần có ảnh')).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Thêm vào phiếu' })).toBeEnabled();
      await dialog.getByLabel('Chụp hoặc chọn ảnh').setInputFiles(FIXTURE);
      await expect(dialog.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Thêm Số lượng' }).click();
      await snap(page, info, 'custom-dialog');
      await dialog.getByRole('button', { name: 'Thêm vào phiếu' }).click();
      await expect(dialog).toBeHidden();

      const cart = page.getByRole('complementary', { name: 'Phiếu của tôi' });
      const line = cart.locator('li', { has: page.getByRole('button', { name: `Sửa ${name}` }) });
      await expect(line.getByText('Ngoài danh mục')).toBeVisible();
      await expect(line.getByRole('spinbutton', { name })).toHaveValue('2');
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();

      await page.reload();
      await expect(line.getByText('Chờ Hành chính xem')).toBeVisible();
      // Ảnh dòng (trang trí, alt rỗng, lazy → cuộn tới trước) phải tải được cho chính chủ phiếu
      await line.scrollIntoViewIfNeeded();
      const thumb = line.locator('img');
      await expect(thumb).toBeVisible();
      await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'custom-saved');

      // Còn thay đổi chưa lưu → link nội bộ (Lịch sử) hỏi trước khi rời
      await line.getByRole('button', { name: `Thêm ${name}` }).click();
      const history = isMobile(info)
        ? page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Lịch sử' })
        : page.getByRole('link', { name: 'Lịch sử' });
      await history.click();
      const ask = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
      await expect(ask).toBeVisible();
      await snap(page, info, 'leave-guard');
      await ask.getByRole('button', { name: 'Ở lại' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(line.getByRole('spinbutton', { name })).toHaveValue('3');
    } finally {
      deleteTestUsers(me.sub);
    }
  });

  test('E2-S4 chép lại danh sách tháng trước: thẻ "đang giao", hỏi thay giỏ, tóm tắt món bỏ/giảm, lưu', async ({
    page,
    request,
  }, info) => {
    const me = memberIdentity(info, 'copy');
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await routeAs(page, me.headers);
    const stamp = `${Date.now()}-${info.project.name}`;
    const nameA = `PW chép thường ${stamp}`;
    const nameB = `PW chép HC ${stamp}`;
    const itemA = await createItem(request, nameA, { max_qty: 5 });
    const itemB = await createItem(request, nameB, { admin_only: true });
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const prevYm = prevYmOf(period.ym);
    const prevMonth = Number(prevYm.slice(5));
    // Hai viewport cùng tạo/xóa dòng periods kỳ trước → làm lần lượt
    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${me.sub}', '${me.sub}') RETURNING id
      )
      INSERT INTO request_lines (request_id, item_id, qty, delivered_qty)
      SELECT r.id, x.item::uuid, x.qty, x.dq FROM r, (VALUES ('${itemA}', 8, 3), ('${itemB}', 2, 2)) AS x(item, qty, dq)`);

    try {
      await page.goto('/');
      const card = page.getByRole('link', { name: new RegExp(`Tháng ${prevMonth} đang giao · 1/2 món`) });
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('href', `/history/${prevYm}`);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'copy-hero');

      const items = await (await request.get('/api/items', { headers: me.headers })).json();
      const other = items.find((i: { name: string; active: boolean; admin_only: boolean }) => i.active && !i.admin_only && !i.name.startsWith('PW '));
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await grid.getByRole('button', { name: `Thêm ${other.name}`, exact: true }).click();
      await snap(page, info, 'copy-before');

      await page.getByRole('button', { name: `Chép lại danh sách tháng ${prevMonth}` }).click();
      const ask = page.getByRole('dialog', { name: 'Thay giỏ hiện tại?' });
      await ask.getByRole('button', { name: 'Thay giỏ' }).click();
      const summary = page.getByRole('dialog', { name: `Đã chép danh sách tháng ${prevMonth}` });
      await expect(summary.getByText(`Đã bỏ: ${nameB} — chỉ Hành chính đặt`)).toBeVisible();
      await expect(summary.getByText(`Đã giảm: ${nameA} từ 8 xuống 5 (tối đa mỗi tháng)`)).toBeVisible();
      await snap(page, info, 'copy-summary');
      await summary.getByRole('button', { name: 'Đã hiểu' }).click();

      const cart = page.getByRole('complementary', { name: 'Phiếu của tôi' });
      await expect(cart.getByRole('spinbutton', { name: nameA, exact: true })).toHaveValue('5');
      await expect(cart.getByRole('spinbutton', { name: other.name, exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: /thay đổi chưa lưu · Lưu/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();
      await page.reload();
      await expect(cart.getByRole('spinbutton', { name: nameA, exact: true })).toHaveValue('5');
      await snap(page, info, 'copy-saved');
    } finally {
      deleteTestUsers(me.sub);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
      for (const id of [itemA, itemB]) await removeTestItem(request, id);
    }
  });

  test('Kỳ khóa giữa chừng, chưa từng lưu (PERIOD_LOCKED giả qua route): giỏ chuyển sang tháng sau, câu báo thấy ngay', async ({ page, request }, info) => {
    const me = memberIdentity(info, 'locked');
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    try {
      const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
      const [y, m] = String(period.ym).split('-').map(Number);
      const nextYm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      let locked = false;
      await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        const headers = { ...route.request().headers(), ...me.headers };
        if (url.endsWith('/api/me/request/lines') && route.request().method() === 'PUT') {
          locked = true;
          return route.fulfill({ status: 409, json: { statusCode: 409, code: 'PERIOD_LOCKED', message: 'x', next_ym: nextYm } });
        }
        if (url.endsWith('/api/periods/current') && locked) {
          const res = await route.fetch({ headers });
          return route.fulfill({ response: res, json: { ...(await res.json()), ym: nextYm } });
        }
        // Server thật chưa mở kỳ sau (INVALID_PERIOD) → giả "chưa có phiếu" như khi kỳ sau vừa mở
        if (url.endsWith(`/api/me/request?ym=${nextYm}`)) {
          return route.fulfill({ status: 404, json: { statusCode: 404, code: 'REQUEST_NOT_FOUND', message: 'x' } });
        }
        return route.continue({ headers });
      });
      const items = await (await request.get('/api/items', { headers: me.headers })).json();
      const item = items.find((i: { name: string; active: boolean; admin_only: boolean }) => i.active && !i.admin_only && !i.name.startsWith('PW '));

      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await grid.getByRole('button', { name: `Thêm ${item.name}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();

      const next = Number(nextYm.slice(5));
      await expect(page.getByRole('heading', { level: 1, name: `Phiếu tháng ${next}` })).toBeVisible();
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(
        `Phiếu tháng ${m} đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng ${next} — bấm Lưu phiếu để giữ.`,
      );
      await expect(alert).toBeInViewport();
      await expect(page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Phiếu của tôi' }).getByRole('spinbutton', { name: item.name, exact: true })).toHaveValue('1');
      await snap(page, info, 'period-locked');
    } finally {
      deleteTestUsers(me.sub);
    }
  });

  test('Kỳ khóa giữa chừng, đã có phiếu lưu (PERIOD_LOCKED giả): không mang giỏ, báo phiếu đã lưu vẫn giữ', async ({ page, request }, info) => {
    const me = memberIdentity(info, 'locked-saved');
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const [y, m] = String(period.ym).split('-').map(Number);
    const nextYm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    let puts = 0;
    let locked = false;
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const headers = { ...route.request().headers(), ...me.headers };
      // Lần lưu đầu đi thật (tạo phiếu); lần sau giả kỳ vừa khóa
      if (url.endsWith('/api/me/request/lines') && route.request().method() === 'PUT' && ++puts > 1) {
        locked = true;
        return route.fulfill({ status: 409, json: { statusCode: 409, code: 'PERIOD_LOCKED', message: 'x', next_ym: nextYm } });
      }
      if (url.endsWith('/api/periods/current') && locked) {
        const res = await route.fetch({ headers });
        return route.fulfill({ response: res, json: { ...(await res.json()), ym: nextYm } });
      }
      if (url.endsWith(`/api/me/request?ym=${nextYm}`)) {
        return route.fulfill({ status: 404, json: { statusCode: 404, code: 'REQUEST_NOT_FOUND', message: 'x' } });
      }
      return route.continue({ headers });
    });
    const items = await (await request.get('/api/items', { headers: me.headers })).json();
    const item = items.find((i: { name: string; active: boolean; admin_only: boolean }) => i.active && !i.admin_only && !i.name.startsWith('PW '));

    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const add = grid.getByRole('button', { name: `Thêm ${item.name}`, exact: true });
      await add.click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();
      await add.click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();

      const next = Number(nextYm.slice(5));
      await expect(page.getByRole('heading', { level: 1, name: `Phiếu tháng ${next}` })).toBeVisible();
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(
        new RegExp(`Phiếu tháng ${m} đã khóa lúc 00:00\\. Phiếu đã lưu lúc \\d{2}:\\d{2} vẫn giữ và sẽ được giao; thay đổi chưa lưu không kịp áp dụng\\. Phiếu tháng ${next} đã mở\\.`),
      );
      await expect(alert).toBeInViewport();
      await expect(page.getByText('Chưa chọn món nào — bấm + trên thẻ món để thêm.')).toBeAttached();
      await snap(page, info, 'period-locked-saved');
    } finally {
      deleteTestUsers(me.sub);
    }
  });
});
