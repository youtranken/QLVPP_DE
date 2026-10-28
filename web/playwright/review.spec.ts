import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, devHeaders, expectNoContrastViolations, isMobile, seedActiveUser } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-16-shots';
const FIXTURE = 'playwright/fixtures/item.png';

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)), input: sql, encoding: 'utf8' },
  ).trim();
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
    try {
      const period = await (await request.get('/api/periods/current', { headers: member })).json();
      const imageId = await uploadLineImage(request, member);
      const saved = await request.put('/api/me/request/lines', {
        headers: member,
        data: { ym: period.ym, lines: [{ custom_name: name, custom_unit: 'cai', custom_note: 'Loại 2 cm', image_file_id: imageId, qty: 2 }] },
      });
      expect(saved.status()).toBe(200);

      await routeAs(page, admin);
      await page.goto('/admin/review');
      await expect(page.getByRole('heading', { level: 1, name: 'Món ngoài danh mục' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Chờ xem' })).toHaveAttribute('aria-checked', 'true');
      const card = page.getByRole('article', { name });
      await expect(card.getByText('2 cái')).toBeVisible();
      await expect(card.getByText('“Loại 2 cm”')).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      const photo = card.getByRole('img', { name: `Ảnh ${name}` });
      await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'review-list');

      await card.getByRole('button', { name: 'Thêm vào danh mục…' }).click();
      const dialog = page.getByRole('dialog', { name: `Thêm “${name}” vào danh mục` });
      await expect(dialog.getByLabel('Tên món')).toHaveValue(name);
      await expect(dialog.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
      const category = dialog.getByLabel('Nhóm');
      await category.selectOption({ index: 1 });
      await dialog.getByLabel('Đơn vị tính').selectOption('hop');
      await expect(dialog.getByText('ĐVT khác dòng gốc (cái) — số lượng 2 sẽ tính theo ĐVT mới.')).toBeVisible();
      await snap(page, info, 'convert-dialog');
      await dialog.getByLabel('Đơn vị tính').selectOption('cai');
      await dialog.getByRole('button', { name: 'Thêm vào danh mục', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(card.getByText('Đã thêm vào danh mục')).toBeVisible();
      await snap(page, info, 'converted');

      const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers: admin })).json();
      itemId = items.find((i) => i.name === name)?.id;
      expect(itemId).toBeTruthy();

      const mp = await pageAs(browser, info, member);
      await mp.goto('/');
      const cart = mp.getByRole('complementary', { name: 'Phiếu của tôi' });
      const line = cart.locator('li', { hasText: name });
      await expect(line.getByText('Đã thêm vào danh mục')).toBeVisible();
      await expect(line.getByText('Ngoài danh mục')).toHaveCount(0);
      const grid = mp.getByRole('region', { name: 'Danh mục món' });
      await expect(grid.getByText(name)).toHaveCount(1);
      await grid.getByText(name).scrollIntoViewIfNeeded();
      await snap(mp, info, 'member-converted');
      await mp.context().close();
    } finally {
      psql(`DELETE FROM requests WHERE user_sub = '${sub}'`);
      if (itemId) await request.patch(`/api/admin/items/${itemId}`, { headers: admin, data: { active: false } });
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
      await expect(page.getByLabel('Kỳ')).toHaveValue(prevYm);
      const card = page.getByRole('article', { name });
      await card.getByRole('button', { name: 'Từ chối…' }).click();
      const dialog = page.getByRole('dialog', { name: `Từ chối “${name}”` });
      const submit = dialog.getByRole('button', { name: 'Từ chối', exact: true });
      await expect(submit).toBeDisabled();
      await dialog.getByLabel('Lý do từ chối').fill(reason);
      await snap(page, info, 'reject-dialog');
      await submit.click();
      await expect(dialog).toBeHidden();
      await expect(card.getByText(`Từ chối: ${reason}`)).toBeVisible();

      await page.getByRole('radio', { name: 'Từ chối' }).click();
      await expect(page).toHaveURL(/status=rejected/);
      await expect(page.getByRole('article', { name }).getByText(`Từ chối: ${reason}`)).toBeVisible();
      await snap(page, info, 'rejected-list');

      const mp = await pageAs(browser, info, member);
      await mp.goto(`/history/${prevYm}`);
      await expect(mp.getByText(`Từ chối: ${reason}`)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(mp);
      await snap(mp, info, 'member-rejected', true);
      await mp.context().close();
    } finally {
      psql(`DELETE FROM requests WHERE user_sub = '${sub}'`);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
      release();
    }
  });
});
