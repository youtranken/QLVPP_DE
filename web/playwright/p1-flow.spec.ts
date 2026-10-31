import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, devHeaders, expectNoContrastViolations, isMobile, seedActiveUser, shot } from './helpers';

const SA_USERNAME = process.env.PW_SA_USERNAME ?? 'sa';
const SA_PASSWORD = process.env.PW_SA_PASSWORD;
const RECIPIENT = { sub: 'pw-recipient', name: 'PW Người nhận' };

type SignBox = { title: string; title_en: string; name: string };

async function saLogin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dành cho IT' }).click();
  await page.getByLabel('Tên tài khoản').fill(SA_USERNAME);
  await page.getByLabel('Mật khẩu').fill(SA_PASSWORD!);
  const login = page.waitForResponse((r) => r.url().endsWith('/api/auth/sa-login'));
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: /^Phiếu tháng \d+$/ })).toBeVisible();
}

async function createCategoryAndItem(page: Page, category: string, itemName: string) {
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Thêm nhóm' }).click();
  const catDialog = page.getByRole('dialog', { name: 'Thêm nhóm' });
  await catDialog.getByLabel('Tên nhóm').fill(category);
  await catDialog.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(catDialog).toBeHidden();
  await expect(page.getByRole('table').getByRole('button', { name: `Sửa tên nhóm ${category}` })).toBeVisible();

  await page.getByRole('link', { name: 'Về Danh mục' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Thêm món' });
  await form.getByLabel('Tên món').fill(itemName);
  await form.getByLabel('Đơn vị tính').selectOption({ label: 'cái' });
  await form.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio', { name: category }).click();
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

  await row.getByRole('button', { name: 'Nhập mua…' }).click();
  const purchase = page.getByRole('dialog', { name: `Nhập mua · ${itemName}` });
  await purchase.getByLabel('Số lượng').fill('10');
  await purchase.getByRole('button', { name: 'Nhập kho' }).click();
  await expect(purchase).toBeHidden();
  await expect(row.getByRole('cell', { name: /^(Tồn )?10$/ })).toBeVisible();

  await row.getByRole('button', { name: 'Xuất lẻ…' }).click();
  const issue = page.getByRole('dialog', { name: `Xuất lẻ · ${itemName}` });
  await issue.getByLabel('Số lượng').fill('3');
  await issue.getByRole('searchbox', { name: 'Tìm người nhận' }).fill(RECIPIENT.name);
  await issue.getByRole('button', { name: new RegExp(RECIPIENT.name) }).click();
  await issue.getByLabel('Lý do').fill('Smoke Plan 1');
  await issue.getByRole('button', { name: 'Xuất kho' }).click();
  await expect(issue).toBeHidden();
  await expect(row.getByRole('cell', { name: /^(Tồn )?7$/ })).toBeVisible();

  await row.getByRole('button', { name: 'Sổ cái' }).click();
  const ledger = page.getByRole('dialog', { name: `Sổ cái · ${itemName}` });
  await expect(ledger.getByRole('listitem')).toHaveCount(2);
  await expect(ledger.getByText(`Xuất lẻ · ${RECIPIENT.name}`)).toBeVisible();
  await expect(ledger.getByText('Nhập mua', { exact: true })).toBeVisible();
}

async function saveSigner(page: Page, preparer: string) {
  await page.goto('/admin/config');
  const form = page.getByRole('form', { name: 'Người ký báo cáo' });
  await form.getByLabel('Người yêu cầu').fill(preparer);
  await form.getByRole('button', { name: 'Lưu người ký' }).click();
  await expect(form.getByRole('status')).toHaveText('Đã lưu.');
  await page.reload();
  await expect(page.getByRole('form', { name: 'Người ký báo cáo' }).getByLabel('Người yêu cầu')).toHaveValue(preparer);
}

async function logout(page: Page) {
  await page.goto('/me');
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập bằng tài khoản công ty (PMH ID)' })).toBeVisible();
  expect(await page.evaluate(() => fetch('/api/auth/me').then((r) => r.status))).toBe(401);
}

async function memberChecks(page: Page, info: TestInfo, itemName: string, imageId: string) {
  await page.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), ...devHeaders('member') } }),
  );
  await page.goto('/');
  const bottom = page.getByRole('navigation', { name: 'Điều hướng chính' });
  if (isMobile(info)) {
    await expect(bottom.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử', 'Tôi']);
    await bottom.getByRole('link', { name: 'Tôi' }).click();
  } else {
    await expect(bottom).toHaveCount(0);
    await page.getByRole('link', { name: 'Tôi' }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Tôi' })).toBeVisible();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
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
  test('Plan 1: SA tạo nhóm, món có ảnh, nhập 10, xuất lẻ 3, sổ cái 2 dòng, lưu người ký, đăng xuất → nhân viên thấy khung, đổi en, tải được ảnh món, bị chặn trang quản lý', async ({
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
