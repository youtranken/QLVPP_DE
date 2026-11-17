import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, monthRowAction, removeTestItem, searchMonthPeople, seedActiveUser } from './helpers';
import { seedLockedCustomLines } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-16-shots';
const FIXTURE = 'playwright/fixtures/item.png';

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

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

// G8: không còn trang Món ngoài danh mục — duyệt ngay trong Xem phiếu (Kỳ tháng, kỳ đã khóa)
async function openRequest(page: Page, prevYm: string, tag: string, person: string) {
  await page.goto(`/admin/month?ym=${prevYm}&chip=pending`);
  await expect(page.getByRole('radio', { name: /^Có món chờ duyệt/ }).or(page.getByRole('combobox', { name: 'Lọc phiếu' }))).toBeVisible();
  await searchMonthPeople(page, tag);
  await monthRowAction(page, person, 'Xem phiếu');
  return page.getByRole('dialog', { name: `Phiếu của ${person}` });
}

async function seedPerson(request: APIRequestContext, info: TestInfo, prefix: string, name: string) {
  const tag = `${prefix}${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
  const sub = `pw-${tag}`;
  const person = `PW Duyệt ${tag}`;
  const member = { 'x-dev-user-sub': sub, 'x-dev-role': 'member' };
  seedActiveUser(sub, person);
  const imageId = await uploadLineImage(request, member);
  const seeded = await seedLockedCustomLines(request, sub, [{ name: `${name} ${tag}`, note: 'Loại 2 cm', imageId, qty: 2 }]);
  return { tag, sub, person, member, line: `${name} ${tag}`, ...seeded };
}

test.describe('G8 Duyệt món ngoài danh mục', () => {
  test('G8 Duyệt món ngoài danh mục: /admin/review về Kỳ tháng có lọc, Xem phiếu → Chấp nhận → nhãn "đã chấp nhận"', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const s = await seedPerson(request, info, 'g8a', 'PW kệ mica');
    try {
      await routeAs(page, devHeaders('admin'));
      await page.goto('/admin/review');
      await expect(page).toHaveURL(/\/admin\/month\?.*chip=pending/);
      const dialog = await openRequest(page, s.prevYm, s.tag, s.person);
      const row = dialog.getByRole('listitem').filter({ hasText: s.line });
      await expect(row.getByText('Ngoài danh mục · chờ duyệt')).toBeVisible();
      await expect(row.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' })).not.toBeChecked();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'g8-review');
      await row.getByRole('button', { name: `Chấp nhận ${s.line}` }).click();
      await expect(row.getByText('Ngoài danh mục · đã chấp nhận')).toBeVisible();
      await expect(row.getByRole('button', { name: `Chấp nhận ${s.line}` })).toHaveCount(0);
    } finally {
      deleteTestUsers(s.sub);
      s.cleanup();
      release();
    }
  });

  test('G8 Thêm luôn vào danh mục: tick → điền món mới → nhân viên thấy món mới trong lưới', async ({ page, browser, request }, info) => {
    const release = await acquireLock('prev-period');
    const s = await seedPerson(request, info, 'g8c', 'PW băng keo');
    let itemId: string | undefined;
    try {
      await routeAs(page, devHeaders('admin'));
      const dialog = await openRequest(page, s.prevYm, s.tag, s.person);
      const row = dialog.getByRole('listitem').filter({ hasText: s.line });
      await row.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' }).check();
      await row.getByRole('button', { name: `Chấp nhận ${s.line}` }).click();
      const convert = page.getByRole('dialog', { name: 'Sản phẩm mới' });
      await expect(convert.getByLabel('Tên món')).toHaveValue(s.line);
      await convert.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio').first().click();
      await convert.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click();
      await expect(convert).toBeHidden();
      await expect(row.getByRole('button', { name: `Chấp nhận ${s.line}` })).toHaveCount(0);
      const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers: devHeaders('admin') })).json();
      itemId = items.find((i) => i.name === s.line)?.id;
      expect(itemId).toBeTruthy();

      const mp = await pageAs(browser, info, s.member);
      await mp.goto('/');
      await expect(mp.getByRole('region', { name: 'Danh mục món' }).getByText(s.line)).toHaveCount(1);
      await mp.context().close();
    } finally {
      deleteTestUsers(s.sub);
      s.cleanup();
      release();
      if (itemId) await removeTestItem(request, itemId);
    }
  });

  test('G8 Từ chối có lý do: 2 chữ chưa gửi được, đủ 3 chữ → nhân viên xem Lịch sử thấy "Từ chối: <lý do>"', async ({ page, browser, request }, info) => {
    const release = await acquireLock('prev-period');
    const s = await seedPerson(request, info, 'g8r', 'PW kéo lớn');
    const reason = 'Kho còn kéo, nhận tại Adm D&E';
    try {
      await routeAs(page, devHeaders('admin'));
      const dialog = await openRequest(page, s.prevYm, s.tag, s.person);
      const row = dialog.getByRole('listitem').filter({ hasText: s.line });
      await row.getByRole('button', { name: `Từ chối ${s.line}` }).click();
      const reject = page.getByRole('dialog', { name: `Từ chối “${s.line}”` });
      const submit = reject.getByRole('button', { name: 'Từ chối', exact: true });
      await reject.getByLabel('Lý do từ chối').fill('ab');
      await expect(submit).toBeDisabled();
      await reject.getByLabel('Lý do từ chối').fill(reason);
      await submit.click();
      await expect(reject).toBeHidden();
      // Dòng bị từ chối không hiện trong Xem phiếu (Task 16)
      await expect(dialog.getByRole('listitem').filter({ hasText: s.line })).toHaveCount(0);

      const mp = await pageAs(browser, info, s.member);
      await mp.goto(`/history/${s.prevYm}`);
      await expect(mp.getByText(`Từ chối: ${reason}`)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(mp);
      await mp.context().close();
    } finally {
      deleteTestUsers(s.sub);
      s.cleanup();
      release();
    }
  });
});
