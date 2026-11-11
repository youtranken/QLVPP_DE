import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acquireLock, asRole, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, seedActiveUser, shot } from './helpers';

const PW_ADMIN = { sub: 'pw-cfg-admin', name: 'PW Cấu hình Adm D&E' };

type Config = Record<string, unknown>;
// Mọi khóa test này đổi được; khối Quyền truy cập chỉ đọc nên không có khóa nào bị đổi ngoài danh sách này
const RESTORED = ['registration_last_day', 'reminder_days_left', 'default_max_qty', 'signature_boxes', 'admin_contact', 'low_stock_notify'];
const TWO_BOXES = [
  { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: '' },
  { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
];

const block = (page: Page, name: string) => page.getByRole('form', { name });
const saved = (form: ReturnType<typeof block>) => expect(form.getByRole('status')).toHaveText('Đã lưu.');
// R-D8.19: đổi sang hạn hợp lệ thì hỏi lại, hộp lặp đúng câu kỳ áp dụng dưới ô
async function confirmDeadline(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Đổi hạn đăng ký?' });
  await expect(dialog.getByText(/^Kỳ tháng \d+ \(đang mở\) vẫn khóa 00:00 ngày \d\d\/\d\d\. Áp dụng từ kỳ tháng \d+: khóa 00:00 ngày \d\d\/\d\d\.$/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Lưu hạn mới' }).click();
}
const putBody = (page: Page) =>
  page.waitForRequest((r) => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/admin/config').then((r) => r.postDataJSON() as Config);

test.describe('E9-S6 Cấu hình M1 (dev-identity admin)', () => {
  asRole('admin');

  let api: APIRequestContext | undefined;
  let original: Config | undefined;
  let release: (() => void) | undefined;

  // DB dev dùng chung: giữ khóa với admin.spec/p1-flow, đọc bản gốc trước và trả lại đủ mọi khóa đã đổi
  test.beforeAll(async ({ playwright }, info) => {
    release = await acquireLock('admin-config');
    api = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: devHeaders('admin') });
    const res = await api.get('/api/admin/config');
    expect(res.ok()).toBe(true);
    original = (await res.json()) as Config;
  });

  test.afterAll(async () => {
    deleteTestUsers(PW_ADMIN.sub);
    try {
      if (api && original) {
        const restore = Object.fromEntries(RESTORED.map((k) => [k, original?.[k]]));
        const res = await api.put('/api/admin/config', { data: restore });
        expect(res.ok()).toBe(true);
      }
    } finally {
      await api?.dispose();
      release?.();
    }
  });

  test('E9-S6 Cấu hình: ngày hạn 2/3/28/29, liên hệ 500 ký tự, mỗi khối lưu riêng', async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.goto('/admin/config');
    await expect(page.getByRole('heading', { level: 1, name: 'Cấu hình' })).toBeVisible();
    await expect(page.getByText('Tham số chung của app, áp dụng cho mọi người dùng.', { exact: true })).toBeVisible();

    const period = block(page, 'Kỳ đăng ký');
    const lastDay = page.getByLabel('Hạn đăng ký (ngày)');
    const reminder = page.getByLabel('Nhắc trước (ngày)');
    for (const typed of ['2', '29']) {
      await lastDay.fill(typed);
      await expect(page.getByText('Nhập ngày hạn hợp lệ để xem trước')).toBeVisible();
      const sent = putBody(page);
      await period.getByRole('button', { name: 'Lưu kỳ đăng ký' }).click();
      expect(await sent).toEqual({ registration_last_day: Number(typed) });
      await expect(lastDay).toHaveAttribute('aria-invalid', 'true');
      await expect(lastDay).toHaveAccessibleDescription('Nhập số từ 3 đến 28.');
    }

    await lastDay.fill('4');
    await reminder.fill('2');
    await period.getByRole('button', { name: 'Lùi một ngày' }).click();
    await expect(lastDay).toHaveValue('3');
    await expect(period.getByRole('button', { name: 'Lùi một ngày' })).toBeDisabled();
    await period.getByRole('button', { name: 'Lưu kỳ đăng ký' }).click();
    await confirmDeadline(page);
    await saved(period);
    await expect(period.getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
    await expect(period.getByText('Chỉ lưu khối này · ghi vào Nhật ký')).toBeVisible();

    await lastDay.fill('27');
    await period.getByRole('button', { name: 'Thêm một ngày' }).click();
    await expect(lastDay).toHaveValue('28');
    await expect(period.getByRole('button', { name: 'Thêm một ngày' })).toBeDisabled();
    await expect(period.getByRole('list', { name: /^Xem trước lịch tháng/ }).getByRole('listitem').filter({ hasText: 'Ngày hạn (đến 23:59)' })).toContainText('28');
    const onlyPeriod = putBody(page);
    await period.getByRole('button', { name: 'Lưu kỳ đăng ký' }).click();
    await confirmDeadline(page);
    expect(await onlyPeriod).toEqual({ registration_last_day: 28 });
    await saved(period);

    await reminder.fill('8');
    await period.getByRole('button', { name: 'Lưu kỳ đăng ký' }).click();
    await expect(reminder).toHaveAccessibleDescription('Nhập số từ 1 đến 7, nhỏ hơn ngày hạn.');
    await period.getByRole('button', { name: 'Hủy' }).click();
    await expect(reminder).toHaveValue('2');

    const contact = block(page, 'Liên hệ & thông báo');
    const contactBox = page.getByLabel('Tên và cách liên hệ Adm D&E');
    await contactBox.fill('');
    await contactBox.pressSequentially(`PW ${info.project.name} `.padEnd(501, 'x'), { delay: 0 });
    await expect(contactBox).toHaveValue(`PW ${info.project.name} `.padEnd(500, 'x'));
    await expect(contact.getByText('500/500')).toBeVisible();
    const recent = page.getByRole('region', { name: 'Thay đổi gần đây' });
    const before = ((await (await api!.get('/api/admin/audit?action=config.updated&limit=1')).json()) as { items: { id: string }[] }).items[0]?.id;
    const onlyContact = putBody(page);
    const refetched = page.waitForResponse((r) => r.url().includes('/api/admin/audit?action=config.updated') && r.request().method() === 'GET');
    await contact.getByRole('button', { name: 'Lưu liên hệ' }).click();
    expect(Object.keys(await onlyContact)).toEqual(['admin_contact']);
    await saved(contact);
    const latest = ((await (await refetched).json()) as { items: { id: string; objectId: string }[] }).items[0];
    expect(latest.objectId).toBe('admin_contact');
    expect(latest.id).not.toBe(before);
    await expect(recent.getByRole('listitem').first()).toContainText(' · ');
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-config-m1');
  });

  test('E9-S6 Cấu hình: thêm/xóa ô ký 1–3 lưu cả mảng', async ({ page }) => {
    expect((await api!.put('/api/admin/config', { data: { signature_boxes: TWO_BOXES } })).ok()).toBe(true);
    await page.goto('/admin/config');
    const signers = block(page, 'Ô ký trên phiếu đề xuất');
    await signers.getByRole('button', { name: 'Thêm ô ký' }).click();
    await expect(signers.getByRole('button', { name: 'Thêm ô ký' })).toHaveCount(0);
    const third = signers.getByRole('group', { name: /^Ô ký 3/ });
    await third.getByRole('textbox', { name: /^Chức danh( \*)?$/ }).fill('PW Duyệt');
    await third.getByLabel('Người ký').fill('a'.repeat(200));
    const sent = putBody(page);
    await signers.getByRole('button', { name: 'Lưu ô ký' }).click();
    expect(((await sent).signature_boxes as unknown[]).length).toBe(3);
    await saved(signers);
    await expect(signers.getByRole('table', { name: 'Xem trước ô ký' }).getByRole('columnheader')).toHaveCount(3);

    await third.getByRole('button', { name: 'Xóa ô ký' }).click();
    await signers.getByRole('group', { name: /^Ô ký 2/ }).getByRole('button', { name: 'Xóa ô ký' }).click();
    await expect(signers.getByRole('group')).toHaveCount(1);
    await expect(signers.getByRole('button', { name: 'Xóa ô ký' })).toHaveCount(0);
    const one = putBody(page);
    await signers.getByRole('button', { name: 'Lưu ô ký' }).click();
    expect(((await one).signature_boxes as unknown[]).length).toBe(1);
    await saved(signers);
  });

  test('E9-S6 Cấu hình: Quyền truy cập chỉ đọc, liệt kê Adm D&E seed (role admin)', async ({ page }) => {
    seedActiveUser(PW_ADMIN.sub, PW_ADMIN.name, 'active', { team: 'Admin', role: 'admin' });
    await page.goto('/admin/config');
    const access = page.getByRole('region', { name: 'Quyền truy cập' });
    await expect(access.getByRole('list', { name: 'Adm D&E hiện tại' }).getByText(PW_ADMIN.name)).toBeVisible();
    await expect(access.getByRole('textbox')).toHaveCount(0);
    await expect(access.getByRole('button')).toHaveCount(0);
    await expect(access.getByText(/Ai được vào VPP do PMH ID quyết định/)).toBeVisible();
    await expect(access.getByRole('link', { name: 'Mở Danh bạ' })).toHaveAttribute('href', '/admin/users');
  });

  test('E9-S6 Cấu hình: lỗi tải → "Không tải được dữ liệu — thử lại." + Thử lại', async ({ page }) => {
    await page.route('**/api/admin/config', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL"}' }));
    await page.goto('/admin/config');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
