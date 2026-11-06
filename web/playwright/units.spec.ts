import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { asRole, deleteTestUsers, devHeaders, expectNoContrastViolations, expectReorderArrowKeepsFocus, isMobile, seedActiveUser, shot } from './helpers';
import { newPage } from './sessions';

interface ApiUnit {
  code: string;
  name: string;
  in_use?: boolean;
}

async function listUnits(request: APIRequestContext): Promise<ApiUnit[]> {
  const res = await request.get('/api/units?all=1', { headers: devHeaders('admin') });
  expect(res.status()).toBe(200);
  return (await res.json()) as ApiUnit[];
}

// Đơn vị thử chưa dùng thì xóa được; lỡ dính món/phiếu thì ngừng và đổi tên kèm hậu tố lần chạy
async function cleanUp(request: APIRequestContext, name: string, stamp: string) {
  const unit = (await listUnits(request)).find((u) => u.name === name);
  if (!unit) return;
  const headers = devHeaders('admin');
  const del = await request.delete(`/api/admin/units/${unit.code}`, { headers });
  if (del.status() !== 204) await request.patch(`/api/admin/units/${unit.code}`, { headers, data: { active: false, name: `PW cũ ${stamp}` } });
}

async function memberOtherItemUnits(browser: Browser, info: TestInfo, sub: string, name: string): Promise<number> {
  const page = await newPage(browser, info, { 'x-dev-user-sub': sub, 'x-dev-role': 'member' });
  try {
    await page.goto('/');
    const addOther = page.getByRole('region', { name: 'Danh mục món' }).getByRole('button', { name: '+ Thêm món khác' });
    await expect(addOther).toBeInViewport();
    await addOther.click();
    const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
    await expect(dialog.getByLabel('Đơn vị tính').locator('option', { hasText: /^hộp$/ })).toHaveCount(1);
    return await dialog.getByLabel('Đơn vị tính').locator('option', { hasText: name }).count();
  } finally {
    await page.context().close();
  }
}

const menuButton = (page: Page, name: string) => page.getByRole('button', { name: `Thao tác cho ${name}`, exact: true });
const rowOf = (page: Page, name: string) => page.getByRole('row').filter({ has: menuButton(page, name) });
async function menuItems(page: Page, name: string) {
  await menuButton(page, name).click();
  const menu = page.getByRole('menu', { name: `Thao tác cho ${name}` });
  const labels = await menu.getByRole('menuitem').allTextContents();
  return { menu, labels };
}

test.describe('E9-S5b Đơn vị tính (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5b Đơn vị tính: thêm, trùng tên, ngừng thì mất khỏi ô chọn Món khác, xóa đang dùng bị chặn', async ({ page, request, browser }, info) => {
    const stamp = `${Date.now() % 1e9}${isMobile(info) ? 'm' : 'd'}`;
    const name = `PWĐV ${stamp}`;
    const sub = `pw-units-${stamp}`;
    seedActiveUser(sub, `PW Nhân viên ${stamp}`);
    try {
      await page.goto('/admin/categories/units');
      await expect(page.getByRole('heading', { level: 1, name: 'Nhóm & đơn vị' })).toBeVisible();
      const inUse = (await listUnits(request)).find((u) => u.in_use);
      expect(inUse).toBeDefined();
      await expect(page.getByRole('main').getByRole('switch')).toHaveCount(0);
      const used = await menuItems(page, inUse!.name);
      expect(used.labels).toEqual(['Sửa', 'Ngừng']);
      await page.keyboard.press('Escape');
      const blocked = await request.delete(`/api/admin/units/${inUse!.code}`, { headers: devHeaders('admin') });
      expect(blocked.status()).toBe(409);
      expect(((await blocked.json()) as { code: string }).code).toBe('UNIT_IN_USE');

      await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      const dialog = page.getByRole('dialog', { name: 'Thêm đơn vị tính' });
      await dialog.getByLabel(/Tên đơn vị/).fill(name);
      await dialog.getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('status').filter({ hasText: `Đã thêm đơn vị tính ${name}` })).toBeVisible();
      await expect(rowOf(page, name)).toHaveCount(1);
      const fresh = await menuItems(page, name);
      expect(fresh.labels).toEqual(['Sửa', 'Ngừng', 'Xóa']);
      await page.keyboard.press('Escape');

      await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      await dialog.getByLabel(/Tên đơn vị/).fill(name.toLowerCase());
      await dialog.getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      await expect(dialog.getByLabel(/Tên đơn vị/)).toHaveAttribute('aria-invalid', 'true');
      await expect(dialog.getByText('Đã có đơn vị tính tên này.')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'units-add-dup', false);
      await dialog.getByRole('button', { name: 'Hủy' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(dialog).toBeHidden();

      expect(await memberOtherItemUnits(browser, info, sub, name)).toBe(1);

      await (await menuItems(page, name)).menu.getByRole('menuitem', { name: 'Ngừng' }).click();
      await page.getByRole('dialog', { name: `Ngừng đơn vị “${name}”?` }).getByRole('button', { name: 'Ngừng', exact: true }).click();
      await expect(rowOf(page, name).getByText('Đã ngừng', { exact: true })).toBeVisible();
      expect((await menuItems(page, name)).labels).toEqual(['Sửa', 'Dùng lại', 'Xóa']);
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(await memberOtherItemUnits(browser, info, sub, name)).toBe(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      await cleanUp(request, name, stamp);
      deleteTestUsers(sub);
    }
  });

  test('E9-S5b Đơn vị tính: chế độ Sắp xếp — ▲▼ xếp dọc chỉ khi bật, biên đầu/cuối tắt, Hủy hỏi rồi trả thứ tự cũ', async ({ page }, info) => {
    await page.goto('/admin/categories/units');
    await expect(page.getByRole('heading', { level: 1, name: 'Nhóm & đơn vị' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Thứ tự' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Đưa / })).toHaveCount(0);
    const names = () => page.getByRole('table').getByRole('button', { name: /^Thao tác cho / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const before = await names();
    await page.getByRole('button', { name: 'Sắp xếp' }).click();
    const ups = page.getByRole('button', { name: /^Đưa .+ lên$/ });
    const downs = page.getByRole('button', { name: /^Đưa .+ xuống$/ });
    await expect(ups.first()).toBeDisabled();
    await expect(downs.last()).toBeDisabled();
    await expect(ups.first()).toHaveCSS('opacity', '0.5');
    await expect(ups.first()).toHaveAttribute('title', 'Đã ở đầu danh sách');
    await expect(ups.nth(1)).toHaveCSS('opacity', '1');
    await expect(page.getByRole('button', { name: 'Lưu thứ tự' })).toBeDisabled();
    const up = (await ups.nth(1).boundingBox())!;
    const down = (await downs.nth(1).boundingBox())!;
    expect(down.y).toBeGreaterThan(up.y + up.height - 1);
    expect(Math.abs(down.x - up.x)).toBeLessThan(1);
    await ups.nth(1).click();
    await expect(page.getByText(/^Thứ tự đã đổi \(2 đơn vị\)$/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'units-sort', false);
    await page.getByRole('button', { name: 'Hủy' }).click();
    await page.getByRole('dialog', { name: 'Bỏ thay đổi?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
    await expect(page.getByRole('button', { name: /^Đưa / })).toHaveCount(0);
    expect(await names()).toEqual(before);
  });

  test('E9-S5b Đơn vị tính: Enter trên ▲▼ giữ tiêu điểm ở mũi tên của dòng vừa dời, tới dòng cuối chuyển sang ▲', async ({ page }) => {
    await page.goto('/admin/categories/units');
    await expect(page.getByRole('heading', { level: 1, name: 'Nhóm & đơn vị' })).toBeVisible();
    await expectReorderArrowKeepsFocus(page, /^Thao tác cho /);
  });

  test('E9-S5b Đơn vị tính: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"', async ({ page }) => {
    await page.route('**/api/units?all=1', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/admin/categories/units');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
