import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, expectNoContrastViolations, isMobile, psql, searchSummaryPeople, settled } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-15-shots';

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

interface Item {
  id: string;
  name: string;
  active: boolean;
  admin_only: boolean;
  max_qty: number;
}

const asMember = (sub: string) => ({ 'x-dev-user-sub': sub, 'x-dev-role': 'member' });

async function memberItems(request: APIRequestContext, sub: string) {
  const res = await request.get('/api/items', { headers: asMember(sub) });
  const items: Item[] = await res.json();
  return items.filter((i) => i.active && !i.admin_only && !i.name.startsWith('PW ') && i.max_qty >= 5);
}

async function uploadLineImage(request: APIRequestContext, sub: string) {
  const img = await request.post('/api/files', {
    headers: asMember(sub),
    multipart: { purpose: 'line_image', file: { name: 'l.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(img.status()).toBe(201);
  return (await img.json()).id as string;
}

function seedUser(sub: string, name: string) {
  psql(`INSERT INTO users (sub, full_name, email, department, status)
    VALUES ('${sub}', '${name}', '${sub}@example.test', 'PW Phòng điều chỉnh', 'active')`);
}

asRole('admin');

test.describe('E3-S3/E3-S4 điều chỉnh và tạo hộ', () => {
  test('E3-S3 điều chỉnh sau hạn: phiếu kỳ đã khóa → cận dưới = đã giao, Lưu cần lý do, nhật ký ghi lý do', async ({
    page,
    request,
  }, info) => {
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const sub = `pw-adj-${tag}`;
    const name = `PW Điều chỉnh ${tag}`;
    const reason = `PW nhân viên báo nhầm ${tag}`;
    seedUser(sub, name);
    const period = await (await request.get('/api/periods/current', { headers: asMember(sub) })).json();
    const prevYm = prevYmOf(period.ym);
    const [a, b] = await memberItems(request, sub);
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
      const row = page.getByRole('row').filter({ hasText: name });
      await row.getByRole('button', { name: 'Điều chỉnh' }).click();

      const drawer = page.getByRole('dialog', { name: `Phiếu của ${name}` });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText('Đã khóa', { exact: true })).toBeVisible();
      if (isMobile(info)) expect((await drawer.boundingBox())!.width).toBeCloseTo(390, 0);
      else expect((await drawer.boundingBox())!.width).toBeCloseTo(520, 0);

      const lineA = drawer.getByRole('listitem').filter({ hasText: a.name });
      const lineB = drawer.getByRole('listitem').filter({ hasText: b.name });
      await expect(lineA.getByText('đã giao 2')).toBeVisible();
      await expect(lineA.getByRole('button', { name: /^Bỏ / })).toHaveCount(0);
      const lessA = lineA.getByRole('button', { name: `Bớt Số lượng ${a.name}` });
      await lessA.click();
      await lessA.click();
      await expect(lineA.getByRole('spinbutton')).toHaveValue('2');
      await expect(lessA).toBeDisabled();
      await lineB.getByRole('button', { name: `Thêm Số lượng ${b.name}` }).click();
      await lineB.getByRole('button', { name: `Thêm Số lượng ${b.name}` }).click();
      await expect(lineB).toHaveClass(/is-changed/);

      await expect(drawer.getByRole('group', { name: `Xử lý ${custom}` }).getByRole('button')).toHaveCount(3);

      const save = drawer.getByRole('button', { name: 'Lưu điều chỉnh' });
      await expect(save).toBeDisabled();
      await drawer.getByLabel('Lý do điều chỉnh').fill(reason);
      await expect(save).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'adjust-locked');
      await save.click();
      await expect(drawer).toBeHidden();

      const qty = psql(`SELECT string_agg(qty::text, ',' ORDER BY qty) FROM request_lines WHERE request_id = '${requestId}'`);
      expect(qty).toBe('1,2,5');
      const logged = psql(`SELECT detail->>'reason' FROM audit_log
        WHERE object_type = 'request' AND object_id = '${requestId}' AND action = 'request.updated'`);
      expect(logged).toBe(reason);
    } finally {
      psql(`DELETE FROM requests WHERE user_sub = '${sub}'; DELETE FROM users WHERE sub = '${sub}'`);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });

  test('E3-S4 tạo hộ: chọn người + món → phiếu kỳ đang mở; lần hai → "đã có phiếu" + mở Điều chỉnh', async ({
    page,
    request,
  }, info) => {
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const sub = `pw-crt-${tag}`;
    const name = `PW Tạo hộ ${tag}`;
    seedUser(sub, name);
    const [item] = await memberItems(request, sub);
    const period = await (await request.get('/api/periods/current', { headers: asMember(sub) })).json();

    const create = async () => {
      await page.getByRole('button', { name: 'Tạo phiếu hộ' }).click();
      const dialog = page.getByRole('dialog', { name: /^Tạo phiếu hộ — tháng/ });
      await dialog.getByRole('searchbox', { name: 'Tìm người đăng ký' }).fill(tag);
      await dialog.getByRole('button', { name: new RegExp(name) }).click();
      await dialog.getByRole('button', { name: '+ Thêm món vào phiếu' }).click();
      await dialog.getByRole('searchbox', { name: 'Tìm món trong danh mục' }).fill(item.name);
      await dialog.getByRole('list', { name: 'Món tìm thấy' }).getByRole('button').first().click();
      await dialog.getByRole('button', { name: `Thêm Số lượng ${item.name}` }).click();
      return dialog;
    };

    try {
      await page.goto('/admin/summary');
      let dialog = await create();
      await snap(page, info, 'create-filled');
      await dialog.getByRole('button', { name: 'Tạo phiếu' }).click();
      await expect(dialog).toBeHidden();
      const saved = psql(`SELECT r.period_ym::text || ':' || l.qty FROM requests r JOIN request_lines l ON l.request_id = r.id
        WHERE r.user_sub = '${sub}'`);
      expect(saved).toBe(`${period.ym}-01:2`);

      dialog = await create();
      await dialog.getByRole('button', { name: 'Tạo phiếu' }).click();
      await expect(dialog.getByRole('alert')).toContainText('Người này đã có phiếu — mở Điều chỉnh');
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'create-exists');
      await dialog.getByRole('button', { name: 'Mở Điều chỉnh' }).click();
      const drawer = page.getByRole('dialog', { name: `Phiếu của ${name}` });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText('Đang mở', { exact: true })).toBeVisible();
      await expect(drawer.getByRole('listitem').filter({ hasText: item.name }).getByRole('spinbutton')).toHaveValue('2');
      await snap(page, info, 'create-open-adjust');
    } finally {
      psql(`DELETE FROM requests WHERE user_sub = '${sub}'; DELETE FROM users WHERE sub = '${sub}'`);
    }
  });
});
