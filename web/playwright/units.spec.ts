import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { asRole, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, seedActiveUser, shot } from './helpers';
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
    await expect(dialog.getByLabel('Đơn vị tính').locator('option', { hasText: 'hộp' })).toHaveCount(1);
    return await dialog.getByLabel('Đơn vị tính').locator('option', { hasText: name }).count();
  } finally {
    await page.context().close();
  }
}

const rowOf = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByRole('button', { name: `Sửa tên đơn vị ${name}`, exact: true }) });

test.describe('E9-S5b Đơn vị tính (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S5b Đơn vị tính: thêm, trùng tên, ngừng thì mất khỏi ô chọn Món khác, xóa đang dùng bị chặn', async ({ page, request, browser }, info) => {
    const stamp = `${Date.now() % 1e9}${isMobile(info) ? 'm' : 'd'}`;
    const name = `PWĐV ${stamp}`;
    const sub = `pw-units-${stamp}`;
    seedActiveUser(sub, `PW Nhân viên ${stamp}`);
    try {
      await page.goto('/admin/units');
      await expect(page.getByRole('heading', { level: 1, name: 'Đơn vị tính' })).toBeVisible();
      const inUse = (await listUnits(request)).find((u) => u.in_use);
      expect(inUse).toBeDefined();
      await expect(page.getByRole('button', { name: `Xóa ${inUse!.name}`, exact: true })).toHaveCount(0);
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
      await expect(page.getByRole('button', { name: `Xóa ${name}`, exact: true })).toBeVisible();

      await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      await dialog.getByLabel(/Tên đơn vị/).fill(name.toLowerCase());
      await dialog.getByRole('button', { name: 'Thêm đơn vị tính' }).click();
      await expect(dialog.getByLabel(/Tên đơn vị/)).toHaveAttribute('aria-invalid', 'true');
      await expect(dialog.getByText('Đã có đơn vị tính tên này.')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'units-add-dup', false);
      await dialog.getByRole('button', { name: 'Hủy' }).click();
      await page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(dialog).toBeHidden();

      expect(await memberOtherItemUnits(browser, info, sub, name)).toBe(1);

      await page.getByRole('switch', { name: `Ngừng ${name}` }).click();
      await expect(page.getByRole('switch', { name: `Mở lại ${name}` })).toBeVisible();
      await expect(rowOf(page, name).getByText('Ngừng', { exact: true })).toBeVisible();
      expect(await memberOtherItemUnits(browser, info, sub, name)).toBe(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      await cleanUp(request, name, stamp);
      deleteTestUsers(sub);
    }
  });

  test('E9-S5b Đơn vị tính: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"', async ({ page }) => {
    await page.route('**/api/units?all=1', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/admin/units');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
