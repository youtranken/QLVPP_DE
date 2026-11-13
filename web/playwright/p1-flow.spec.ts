import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, devHeaders, expectNoContrastViolations, expectStockCell, isMobile, seedActiveUser, shot, openPurchase, pickOption } from './helpers';

const SA_USERNAME = process.env.PW_SA_USERNAME ?? 'sa';
const SA_PASSWORD = process.env.PW_SA_PASSWORD;
const RECIPIENT = { sub: 'pw-recipient', name: 'PW Người nhận' };

type SignBox = { title: string; title_en: string; name: string };

async function saLogin(page: Page) {
  await page.goto('/');
  // Một ô như QLTS/QLHS: đúng tên SA (server kiểm) → bước mật khẩu
  await page.getByLabel('Email', { exact: true }).fill(SA_USERNAME);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByLabel('Mật khẩu', { exact: true }).fill(SA_PASSWORD!);
  const login = page.waitForResponse((r) => r.url().endsWith('/api/auth/sa-login'));
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: /^Đăng ký văn phòng phẩm tháng \d+$/ })).toBeVisible();
}

async function createCategoryAndItem(page: Page, category: string, itemName: string) {
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Thêm nhóm' }).click();
  const catDialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
  await catDialog.getByLabel('Tên nhóm').fill(category);
  await catDialog.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(catDialog).toBeHidden();
  await expect(page.getByRole('table').getByRole('button', { name: `Sửa nhóm ${category}` })).toBeVisible();

  await page.goto('/admin/catalog');
  await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Thêm sản phẩm' });
  await form.getByLabel('Tên sản phẩm').fill(itemName);
  await pickOption(form.getByRole('combobox', { name: 'Đơn vị tính' }), 'cái');
  await pickOption(form.getByRole('combobox', { name: 'Nhóm', exact: true }), category);
  const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
  await form.getByLabel('Chụp hoặc chọn ảnh').setInputFiles('playwright/fixtures/item.png');
  const upload = await uploaded;
  expect(upload.status()).toBe(201);
  await expect(form.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
  await form.getByRole('button', { name: 'Thêm món' }).click();
  await expect(form).toBeHidden();
  return (await upload.json()).id as string;
}

async function stockFlow(page: Page, itemName: string) {
  await page.goto('/admin/stock');
  await page.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(itemName);
  const row = page.getByRole('row').filter({ hasText: itemName });

  await openPurchase(page, row);
  const purchase = page.getByRole('dialog', { name: `Nhập ngoài kỳ (tự mua lẻ) ${itemName}` });
  await purchase.getByLabel('Số lượng nhập').fill('10');
  await purchase.getByRole('button', { name: 'Lưu nhập mua' }).click();
  await expect(purchase).toBeHidden();
  await expectStockCell(row, 10);

  await row.getByRole('button', { name: `Thao tác khác cho ${itemName}` }).click();
  await page.getByRole('menuitem', { name: 'Xuất lẻ' }).click();
  const issue = page.getByRole('dialog', { name: `Xuất lẻ ${itemName}` });
  await issue.getByLabel('Số lượng').fill('3');
  await issue.getByRole('searchbox', { name: 'Tìm người nhận' }).fill(RECIPIENT.name);
  await issue.getByRole('button', { name: new RegExp(RECIPIENT.name) }).click();
  await issue.getByLabel('Lý do').fill('Smoke Plan 1');
  await issue.getByRole('button', { name: 'Xuất', exact: true }).click();
  await expect(issue).toBeHidden();
  await expectStockCell(row, 7);

  await row.getByRole('button', { name: `Thao tác khác cho ${itemName}` }).click();
  await page.getByRole('menuitem', { name: 'Lịch sử nhập xuất' }).click();
  const ledger = page.getByRole('dialog', { name: `Lịch sử nhập xuất ${itemName}` });
  await expect(ledger.getByRole('listitem')).toHaveCount(2);
  await expect(ledger.getByRole('listitem').nth(0)).toContainText(`cho ${RECIPIENT.name}`);
  await expect(ledger.getByRole('listitem').nth(1).locator('.tag')).toHaveText('Nhập');
}

async function saveSigner(page: Page, preparer: string) {
  await page.goto('/admin/config');
  const form = page.getByRole('form', { name: 'Ô ký trên phiếu đề xuất' });
  await form.getByRole('group', { name: /Người yêu cầu$/ }).getByLabel('Người ký').fill(preparer);
  await form.getByRole('button', { name: 'Lưu ô ký' }).click();
  await expect(form.getByRole('status')).toHaveText('Đã lưu.');
  await page.reload();
  await expect(page.getByRole('form', { name: 'Ô ký trên phiếu đề xuất' }).getByRole('group', { name: /Người yêu cầu$/ }).getByLabel('Người ký')).toHaveValue(preparer);
}

async function logout(page: Page) {
  await page.goto('/me');
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => fetch('/api/auth/me').then((r) => r.status))).toBe(401);
}

async function memberChecks(page: Page, info: TestInfo, itemName: string, imageId: string) {
  await page.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), ...devHeaders('member') } }),
  );
  await page.goto('/');
  const bottom = page.getByRole('navigation', { name: 'Điều hướng chính' });
  if (isMobile(info)) {
    await expect(bottom.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
    await bottom.getByRole('button', { name: 'Tôi' }).click();
  } else {
    await expect(bottom).toHaveCount(0);
    await page.getByRole('button', { name: /^Mở tài khoản của / }).click();
  }
  await expect(page.getByRole('dialog', { name: 'Tài khoản' })).toBeVisible();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
  if (isMobile(info)) await expectNoContrastViolations(page);
  await shot(page, info, 'p1-member-me-en');

  const seen = await page.evaluate(
    async ({ name, id }) => {
      const items = (await fetch('/api/items').then((r) => r.json())) as { name: string; image_file_id: string }[];
      const img = await fetch(`/api/files/${id}`);
      return {
        listed: items.find((i) => i.name === name)?.image_file_id,
        status: img.status,
        type: img.headers.get('content-type'),
      };
    },
    { name: itemName, id: imageId },
  );
  expect(seen).toEqual({ listed: imageId, status: 200, type: 'image/png' });

  await page.goto('/admin/catalog');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Admin menu' })).toHaveCount(0);
}

async function cleanup(admin: APIRequestContext, t: { itemName: string; category: string; boxes?: SignBox[] }) {
  if (t.boxes) await admin.put('/api/admin/config', { data: { signature_boxes: t.boxes } });
  // Dọn: ngừng nhóm/món thử để không lẫn vào trang đăng ký của nhân viên trên DB dev
  const items = (await (await admin.get('/api/admin/items')).json()) as { id: string; name: string }[];
  const item = items.find((i) => i.name === t.itemName);
  if (item) await admin.patch(`/api/admin/items/${item.id}`, { data: { active: false } });
  const cats = (await (await admin.get('/api/item-categories?all=1')).json()) as { id: string; name: string }[];
  const cat = cats.find((c) => c.name === t.category);
  if (cat) await admin.patch(`/api/admin/item-categories/${cat.id}`, { data: { active: false } });
  await admin.dispose();
}

test.describe('Smoke Plan 1 toàn luồng', () => {
  test('Plan 1: SA tạo nhóm, món có ảnh, nhập 10, xuất lẻ 3, lịch sử nhập xuất 2 dòng, lưu người ký, đăng xuất → nhân viên thấy khung, đổi en, tải được ảnh món, bị chặn trang quản lý', async ({
    page,
    playwright,
  }, info) => {
    test.skip(!SA_PASSWORD, 'Đặt PW_SA_PASSWORD (mật khẩu SA dev khớp LOCAL_SA_PASSWORD_HASH trong .env) để chạy smoke Plan 1');
    const stamp = `${Date.now()}-${info.project.name}`;
    const category = `PW smoke nhóm ${stamp}`;
    const itemName = `PW smoke món ${stamp}`;
    seedActiveUser(RECIPIENT.sub, RECIPIENT.name);

    let admin: APIRequestContext | undefined;
    let release: (() => void) | undefined;
    let originalBoxes: SignBox[] | undefined;
    try {
      admin = await playwright.request.newContext({
        baseURL: info.project.use.baseURL,
        extraHTTPHeaders: devHeaders('admin'),
      });

      await saLogin(page);
      const imageId = await createCategoryAndItem(page, category, itemName);
      await stockFlow(page, itemName);

      // DB dev dùng chung với admin.spec: giữ khóa cấu hình, lưu bản gốc để trả lại
      release = await acquireLock('admin-config');
      originalBoxes = ((await (await admin.get('/api/admin/config')).json()) as { signature_boxes: SignBox[] }).signature_boxes;
      await saveSigner(page, `PW người yêu cầu ${stamp}`);
      await shot(page, info, 'p1-sa-config');
      await logout(page);

      await memberChecks(page, info, itemName, imageId);
    } finally {
      if (admin) await cleanup(admin, { itemName, category, boxes: originalBoxes });
      release?.();
    }
  });
});
