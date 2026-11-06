import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, psql, removeTestItem, seedActiveUser, waitForImageLoaded } from './helpers';
import { seedLockedCustomLines } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-16-shots';
const FIXTURE = 'playwright/fixtures/item.png';

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

async function routeAs(page: Page, headers: Record<string, string>) {
  await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
}

async function pageAs(browser: Browser, info: TestInfo, headers: Record<string, string>) {
  const { viewport, hasTouch, isMobile: mobile } = info.project.use;
  const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, hasTouch, isMobile: mobile });
  const page = await ctx.newPage();
  await routeAs(page, headers);
  return page;
}

async function uploadLineImage(request: APIRequestContext, headers: Record<string, string>) {
  const img = await request.post('/api/files', {
    headers,
    multipart: { purpose: 'line_image', file: { name: 'l.png', mimeType: 'image/png', buffer: readFileSync(FIXTURE) } },
  });
  expect(img.status()).toBe(201);
  return (await img.json()).id as string;
}

test.describe('E3-S5 món ngoài danh mục', () => {
  test('E3-S5 món ngoài danh mục: member lưu dòng ngoài DM → Hành chính "Thêm vào danh mục" món mới → member thấy "Đã thêm vào danh mục" và món mới trong lưới', async ({
    page,
    browser,
    request,
  }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const sub = `pw-rv-${stamp}`;
    const member = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    const admin = devHeaders('admin');
    const name = `PW băng keo ${stamp}`;
    seedActiveUser(sub, `PW Review ${info.project.name}`);
    let itemId: string | undefined;
    const release = await acquireLock('prev-period');
    // Hành chính chỉ thấy món ngoài DM của kỳ đã khóa: dòng gieo ở kỳ trước
    const imageId = await uploadLineImage(request, member);
    const seeded = await seedLockedCustomLines(request, sub, [{ name, note: 'Loại 2 cm', imageId, qty: 2 }]);
    try {
      await routeAs(page, admin);
      const photoLoaded = waitForImageLoaded(page, page.getByRole('article', { name }).getByRole('img', { name: `Ảnh ${name}` }), imageId);
      photoLoaded.catch(() => {});
      await page.goto(`/admin/review?ym=${seeded.prevYm}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Món ngoài danh mục' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Chờ xem' })).toHaveAttribute('aria-checked', 'true');
      const card = page.getByRole('article', { name });
      await expect(card.getByText('2 cái · Phiếu tháng')).toBeVisible();
      await expect(card.getByText('“Loại 2 cm”')).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      const photo = card.getByRole('img', { name: `Ảnh ${name}` });
      await expect(photo).toBeVisible();
      await photoLoaded;
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'review-list');

      await card.getByRole('button', { name: /^Mua và thêm vào danh mục —/ }).click();
      const dialog = page.getByRole('dialog', { name: `Mua “${name}” và thêm vào danh mục` });
      await expect(dialog.getByLabel('Tên món')).toHaveValue(name);
      await expect(dialog.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
      await dialog.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio').first().click();
      await dialog.getByLabel('Đơn vị tính').selectOption('hop');
      await expect(dialog.getByText('ĐVT khác dòng gốc (cái) — số lượng 2 sẽ tính theo ĐVT mới.')).toBeVisible();
      await snap(page, info, 'convert-dialog');
      await dialog.getByLabel('Đơn vị tính').selectOption('cai');
      await dialog.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(card.getByText('Đã thêm vào danh mục')).toBeVisible();
      await snap(page, info, 'converted');

      const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers: admin })).json();
      itemId = items.find((i) => i.name === name)?.id;
      expect(itemId).toBeTruthy();

      const mp = await pageAs(browser, info, member);
      // Phiếu kỳ đã khóa: member xem dòng ở Lịch sử kỳ đó, món mới hiện trong lưới kỳ đang mở
      await mp.goto(`/history/${seeded.prevYm}`);
      const line = mp.locator('li', { hasText: name });
      await expect(line.getByText('Đã thêm vào danh mục')).toBeVisible();
      await expect(line.getByText('Ngoài danh mục')).toHaveCount(0);
      await mp.goto('/');
      const grid = mp.getByRole('region', { name: 'Danh mục món' });
      await expect(grid.getByText(name)).toHaveCount(1);
      await grid.getByText(name).scrollIntoViewIfNeeded();
      await snap(mp, info, 'member-converted');
      await mp.context().close();
    } finally {
      deleteTestUsers(sub);
      seeded.cleanup();
      release();
      if (itemId) await removeTestItem(request, itemId);
    }
  });

  test('E3-S5 từ chối có lý do: Hành chính nhập lý do riêng → member xem lịch sử thấy "Từ chối: <lý do>"', async ({
    page,
    browser,
    request,
  }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const sub = `pw-rvj-${stamp}`;
    const member = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
    const name = `PW kéo lớn ${stamp}`;
    const reason = 'Kho còn kéo, nhận tại Hành chính';
    seedActiveUser(sub, `PW Từ chối ${info.project.name}`);
    const period = await (await request.get('/api/periods/current', { headers: member })).json();
    const prevYm = prevYmOf(period.ym);
    const imageId = await uploadLineImage(request, member);
    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    psql(`WITH r AS (
        INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
      )
      INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, review_status)
      SELECT r.id, '${name}', 'cai', '${imageId}'::uuid, 1, 'pending' FROM r`);
    try {
      await routeAs(page, devHeaders('admin'));
      await page.goto(`/admin/review?ym=${prevYm}`);
      const card = page.getByRole('article', { name });
      await expect(card).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Theo tháng' })).toBeChecked();
      await expect(page.getByRole('group', { name: 'Chọn tháng' })).toContainText(`Tháng ${Number(prevYm.slice(5))}/${prevYm.slice(0, 4)}`);
      await card.getByRole('button', { name: /^Không mua —/ }).click();
      const dialog = page.getByRole('dialog', { name: `Không mua “${name}”` });
      const submit = dialog.getByRole('button', { name: 'Không mua', exact: true });
      await expect(submit).toBeDisabled();
      await dialog.getByLabel('Lý do từ chối').fill(reason);
      await snap(page, info, 'reject-dialog');
      await submit.click();
      await expect(dialog).toBeHidden();
      await expect(card.getByText('Đã từ chối')).toBeVisible();
      await expect(card.getByText(`Lý do: ${reason}`)).toBeVisible();

      await page.getByRole('radio', { name: /^Từ chối/ }).click();
      await expect(page).toHaveURL(/status=rejected/);
      await expect(page.getByRole('article', { name }).getByText(`Lý do: ${reason}`)).toBeVisible();
      await snap(page, info, 'rejected-list');

      const mp = await pageAs(browser, info, member);
      await mp.goto(`/history/${prevYm}`);
      await expect(mp.getByText(`Từ chối: ${reason}`)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(mp);
      await snap(mp, info, 'member-rejected', true);
      await mp.context().close();
    } finally {
      deleteTestUsers(sub);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });
});

const longName = (stamp: string, len: number) => `PW ${stamp} `.padEnd(len, 'x');

test.describe('E9-S2 món ngoài danh mục', () => {
  test('E9-S2 Món ngoài danh mục: chấp nhận, từ chối có lý do, thêm vào danh mục món mới', async ({ page, request }, info) => {
    test.setTimeout(120_000);
    const stamp = `${Date.now()}-${info.project.name}`;
    const sub = `pw-rvs-${stamp}`;
    const names = { accept: `PW chấp nhận ${stamp}`, reject: `PW từ chối ${stamp}`, big: `PW món lớn ${stamp}`, one: `PW món một ${stamp}` };
    seedActiveUser(sub, `PW Review ${info.project.name}`);
    const created: string[] = [];
    const release = await acquireLock('prev-period');
    const seeded = await seedLockedCustomLines(request, sub, Object.values(names).map((n) => ({ name: n, qty: 1 })));
    try {
      const pendingCount = ((await (await request.get(`/api/admin/review?status=pending&ym=${seeded.prevYm}`, { headers: devHeaders('admin') })).json()) as { items: unknown[] }).items.length;

      await routeAs(page, devHeaders('admin'));
      await page.goto(`/admin/review?ym=${seeded.prevYm}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('radio', { name: new RegExp(`^Chờ xem,\\s*${pendingCount}$`) })).toBeVisible();
      const cardOf = (n: string) => page.getByRole('article', { name: n });
      await expect(cardOf(names.accept).getByText('Không có ảnh')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);

      const accept = cardOf(names.accept);
      await accept.getByRole('button', { name: /^Mua lần này —/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Mua lần này', exact: true }).click();
      await expect(accept.getByText('Đã chấp nhận', { exact: true })).toBeVisible();

      const reject = cardOf(names.reject);
      await reject.getByRole('button', { name: /^Không mua —/ }).click();
      const rejectDialog = page.getByRole('dialog', { name: `Không mua “${names.reject}”` });
      await rejectDialog.getByLabel('Lý do từ chối').fill('ab');
      await expect(rejectDialog.getByRole('button', { name: 'Không mua', exact: true })).toBeDisabled();
      await rejectDialog.getByLabel('Lý do từ chối').fill('abc');
      await rejectDialog.getByRole('button', { name: 'Không mua', exact: true }).click();
      await expect(reject.getByText('Đã từ chối')).toBeVisible();

      const convert = async (n: string) => {
        await cardOf(n).getByRole('button', { name: /^Mua và thêm vào danh mục —/ }).click();
        const dialog = page.getByRole('dialog', { name: `Mua “${n}” và thêm vào danh mục` });
        await dialog.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio').first().click();
        await expect(dialog.getByRole('group', { name: 'Ảnh món' })).toContainText('*');
        await dialog.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click();
        await expect(dialog.getByText('Món phải có ảnh — chọn hoặc chụp một ảnh.')).toBeVisible();
        await dialog.getByLabel('Chụp hoặc chọn ảnh').setInputFiles(FIXTURE);
        await expect(dialog.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
        return { dialog, submit: () => dialog.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click() };
      };

      const big = await convert(names.big);
      const finalName = longName(stamp, 120);
      await big.dialog.getByLabel('Tên món').fill(longName(stamp, 121));
      await big.submit();
      await expect(big.dialog.getByLabel('Tên món')).toHaveAttribute('aria-invalid', 'true');
      await big.dialog.getByLabel('Tên món').fill(finalName);
      for (const bad of ['0', '1000']) {
        await big.dialog.getByLabel('Tối đa mỗi tháng').fill(bad);
        await big.submit();
        await expect(big.dialog.getByLabel('Tối đa mỗi tháng')).toHaveAttribute('aria-invalid', 'true');
      }
      await big.dialog.getByLabel('Tối đa mỗi tháng').fill('999');
      await big.submit();
      await expect(big.dialog).toBeHidden();
      await expect(cardOf(names.big).getByText('Đã thêm vào danh mục', { exact: true })).toBeVisible();

      const one = await convert(names.one);
      await one.dialog.getByLabel('Tối đa mỗi tháng').fill('1');
      await one.submit();
      await expect(one.dialog).toBeHidden();
      await expect(cardOf(names.one).getByText('Đã thêm vào danh mục', { exact: true })).toBeVisible();

      const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers: devHeaders('admin') })).json();
      created.push(...items.filter((i) => i.name === finalName || i.name === names.one).map((i) => i.id));
      expect(created).toHaveLength(2);
      await page.getByRole('radio', { name: /^Đã chấp nhận/ }).click();
      await expect(cardOf(names.accept)).toBeVisible();
    } finally {
      deleteTestUsers(sub);
      seeded.cleanup();
      release();
      for (const id of created) await removeTestItem(request, id);
    }
  });

  test('E9-S2 Món ngoài danh mục: lỗi tải danh sách → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await routeAs(page, devHeaders('admin'));
    await page.route('**/api/admin/review*', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL' } }));
    await page.goto('/admin/review');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});

const OPEN_PERIOD = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 3, previous: null };
const LOCKED_SUMMARY = { ym: '2026-10', deadline: '2026-10-10T17:00:00.000Z', is_open: false, registered: 6, headcount: 8, outside: 0, unregistered: 2, headcount_source: 'snapshot', lines_pending_delivery: 0, custom_pending: 0, low_stock: 0, receipts: 0 };

// Dữ liệu giả cố định: không chạm kỳ/phiếu thật của dev, ảnh chuẩn không đổi theo ngày chạy
async function mockEmptyReview(page: Page) {
  await routeAs(page, devHeaders('admin'));
  await page.route('**/api/periods/current', (route) => route.fulfill({ json: OPEN_PERIOD }));
  await page.route('**/api/admin/periods/2026-10/summary', (route) => route.fulfill({ json: LOCKED_SUMMARY }));
  await page.route('**/api/admin/review*', (route) => route.fulfill({ json: { items: [] } }));
}

test.describe('V2D-18 trạng thái trống Món ngoài danh mục', () => {
  test('V2D-18 tab Chờ xem rỗng 1440 px: khung trống rộng hết vùng danh sách, ảnh chuẩn', async ({ page }, info) => {
    test.skip(isMobile(info), 'ảnh chuẩn chỉ ở desktop');
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockEmptyReview(page);
    await page.goto('/admin/review');
    const title = page.getByRole('heading', { level: 2, name: 'Không còn món nào chờ xem' });
    await expect(title).toBeVisible();
    await expect(page.getByText('Món ngoài danh mục của kỳ tháng 11 sẽ hiện ở đây từ 00:00 ngày 11/11.')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('main')).toHaveScreenshot('review-empty-pending-1440.png', { maxDiffPixelRatio: 0.01 });
  });

  test('V2D-18 tab rỗng không lỗi tương phản ở 390 (Chờ xem và Đã chấp nhận)', async ({ page }, info) => {
    test.skip(!isMobile(info), 'axe chỉ ở 390');
    await mockEmptyReview(page);
    await page.goto('/admin/review');
    await expect(page.getByRole('heading', { level: 2, name: 'Không còn món nào chờ xem' })).toBeVisible();
    await expectNoContrastViolations(page);
    await page.getByRole('radio', { name: /^Đã chấp nhận/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Chưa chấp nhận món nào' })).toBeVisible();
    await expectNoContrastViolations(page);
  });
});
