import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, shot } from './helpers';

// Ảnh đã tải xong thật (không phải icon ảnh vỡ) và GET /api/files/:id trả 200
async function expectImageServed(page: Page, img: Locator) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const src = (await img.getAttribute('src'))!;
  expect(src).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
  expect(await page.evaluate((u) => fetch(u).then((r) => r.status), src)).toBe(200);
}

// Lỗi giữa chừng vẫn phải dọn: nhóm/món thử không được lẫn vào trang đăng ký của nhân viên trên DB dev
async function cleanupCatalog(request: APIRequestContext, itemName: string, category: string) {
  const headers = devHeaders('admin');
  const items: { id: string; name: string }[] = await (await request.get('/api/admin/items', { headers })).json();
  const item = items.find((i) => i.name === itemName);
  if (item) await removeTestItem(request, item.id);
  const cats: { id: string; name: string }[] = await (await request.get('/api/item-categories?all=1', { headers })).json();
  const cat = cats.find((c) => c.name === category);
  if (cat) await request.patch(`/api/admin/item-categories/${cat.id}`, { headers, data: { active: false } });
}

test.describe('E1-S3 Danh mục và Nhóm món (dev-identity admin)', () => {
  asRole('admin');

  test('E1-S3 tạo nhóm + món có ảnh → món hiện trong bảng với thumbnail; ngừng món qua xác nhận', async ({
    page,
    request,
  }, info) => {
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW nhóm ${stamp}`;
    const itemName = `PW món ${stamp}`;

    try {
      await page.goto('/admin/categories');
      await expect(page.getByRole('heading', { level: 1, name: 'Nhóm món' })).toBeVisible();
      await page.getByRole('button', { name: 'Thêm nhóm' }).click();
      const catDialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
      await catDialog.getByLabel('Tên nhóm').fill(category);
      await catDialog.getByLabel('Tên tiếng Anh').fill(`PW category ${stamp}`);
      await catDialog.getByRole('button', { name: 'Thêm nhóm' }).click();
      await expect(catDialog).toBeHidden();
      await expect(page.getByText(category, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeDisabled();
      await page.getByRole('button', { name: `Đưa ${category} lên` }).click();
      await expect(page.getByRole('button', { name: `Đưa ${category} xuống` })).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'categories');

      await page.getByRole('link', { name: 'Về Danh mục' }).click();
      await page.getByRole('button', { name: 'Thêm món' }).click();
      const form = page.getByRole('dialog', { name: 'Thêm món' });
      await expect(form.getByText('Cần có ảnh')).toBeVisible();
      await expect(form.getByRole('button', { name: 'Thêm món' })).toBeDisabled();
      await form.getByLabel('Tên món').fill(itemName);
      await form.getByLabel('Đơn vị tính').selectOption({ label: 'hộp' });
      await form.getByLabel('Quy cách').fill('hộp 10 cây');
      await form.getByLabel('Nhóm').selectOption({ label: category });
      const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
      await form.getByLabel('Chọn hoặc chụp ảnh').setInputFiles('playwright/fixtures/item.png');
      expect((await uploaded).status()).toBe(201);
      await expectImageServed(page, form.getByRole('img', { name: 'Ảnh món' }));
      await expect(form.getByText('Cần có ảnh')).toHaveCount(0);
      // Hộp thoại cố định: chụp khung nhìn, không kéo cả bảng dài phía sau
      await shot(page, info, 'item-form', false);
      await form.getByRole('button', { name: 'Thêm món' }).click();
      await expect(form).toBeHidden();

      await page.getByLabel('Lọc theo nhóm').selectOption({ label: category });
      await expect(page.getByText(itemName, { exact: true })).toBeVisible();
      await expect(page.getByText('hộp 10 cây')).toBeVisible();
      await expectImageServed(page, page.getByRole('img', { name: itemName }));
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'catalog');

      await page.getByRole('button', { name: 'Ngừng món' }).click();
      const confirm = page.getByRole('dialog', { name: `Ngừng món “${itemName}”?` });
      await confirm.getByRole('button', { name: 'Ngừng món' }).click();
      await expect(page.getByText(itemName, { exact: true })).toBeHidden();
      await page.getByLabel('Hiện món đã ngừng').check();
      const itemRow = page.getByRole('row').filter({ hasText: itemName });
      await expect(itemRow.getByText('đã ngừng', { exact: true })).toBeVisible();
      await expect(itemRow.getByRole('button', { name: 'Mở lại' })).toBeVisible();

      await page.getByRole('link', { name: 'Nhóm món' }).click();
      const row = page.getByRole('row').filter({ hasText: category });
      await row.getByRole('button', { name: 'Ngừng nhóm' }).click();
      await page.getByRole('dialog', { name: `Ngừng nhóm “${category}”?` }).getByRole('button', { name: 'Ngừng nhóm' }).click();
      await expect(row.getByText('đã ngừng', { exact: true })).toBeVisible();
    } finally {
      await cleanupCatalog(request, itemName, category);
    }
  });

  test('E1-S5 trang Danh mục hiện nhãn "thiếu ảnh" cho món seed', async ({ page }, info) => {
    await page.goto('/admin/catalog');
    await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill('Giấy A4');
    const row = page.getByRole('row').filter({ hasText: 'Giấy A4' });
    await expect(row.getByText('thiếu ảnh')).toBeVisible();
    await expect(row.getByText('Chỉ Hành chính')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill('');
    await expect(page.getByText('Bút bi xanh')).toBeVisible();
    await shot(page, info, 'catalog-seed', false);
  });
});
