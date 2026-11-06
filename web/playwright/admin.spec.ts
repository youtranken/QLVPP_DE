import { expect, test, type APIRequestContext } from '@playwright/test';
import { acquireLock, asRole, auditRows, devHeaders, expectNoContrastViolations, isMobile, openAuditDetail, seedActiveUser, shot } from './helpers';

const ACTIVE = { sub: 'pw-dir-active', name: 'PW Danh bạ An' };
const LOCKED = { sub: 'pw-dir-locked', name: 'PW Danh bạ Bình' };

test.describe('E0-S7 Danh bạ (dev-identity admin)', () => {
  asRole('admin');

  test('E0-S7 danh bạ hiện trạng thái; "Đồng bộ ngay" khi PMH ID không liên lạc được → báo lỗi, bảng vẫn còn', async ({
    page,
  }, info) => {
    seedActiveUser(ACTIVE.sub, ACTIVE.name);
    seedActiveUser(LOCKED.sub, LOCKED.name, 'locked');
    await page.route('**/api/admin/directory/sync', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'DIRECTORY_UNAVAILABLE', message: 'x' }) }),
    );
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh bạ' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm người' }).fill('PW Danh bạ');
    await expect(page.getByRole('row').filter({ hasText: LOCKED.name }).getByText('Đã khóa', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: ACTIVE.name }).getByText('Đang dùng', { exact: true })).toBeVisible();

    // Dev không có PMH ID thật: chặn POST để lỗi xác định; trang phải báo rõ ràng chứ không làm hỏng
    await page.getByRole('button', { name: 'Đồng bộ ngay' }).click();
    await expect(page.getByRole('alert')).toContainText('PMH ID');
    await expect(page.getByRole('row').filter({ hasText: ACTIVE.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đồng bộ ngay' })).toBeEnabled();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-users');
  });
});

test.describe('E0-S8 Nhật ký và cấu hình (dev-identity admin)', () => {
  asRole('admin');

  let api: APIRequestContext | undefined;
  let original: Record<string, unknown> | undefined;
  let release: (() => void) | undefined;

  // DB dev dùng chung: đọc giá trị gốc trước, trả lại sau, và giữ khóa để hai viewport không ghi đè nhau
  test.beforeAll(async ({ playwright }, info) => {
    release = await acquireLock('admin-config');
    api = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: devHeaders('admin') });
    const res = await api.get('/api/admin/config');
    expect(res.ok()).toBe(true);
    original = (await res.json()) as Record<string, unknown>;
  });

  test.afterAll(async () => {
    try {
      if (api && original) {
        const res = await api.put('/api/admin/config', { data: { admin_contact: original.admin_contact } });
        expect(res.ok()).toBe(true);
      }
    } finally {
      await api?.dispose();
      release?.();
    }
  });

  test('E0-S8 ngày hạn 29 bị chặn tại ô; lưu admin_contact → trang "Chưa được cấp quyền" hiện đúng tên; nhật ký ghi config.updated', async ({
    page,
    browser,
  }, info) => {
    const contact = `PW Hành chính ${info.project.name} ${Date.now()}`;
    await page.goto('/admin/config');
    await expect(page.getByRole('heading', { level: 1, name: 'Cấu hình' })).toBeVisible();
    // R-D8.19: dòng sống nói kỳ đang mở giữ hạn cũ, hạn mới áp từ kỳ sau
    await expect(page.getByText(/^Kỳ tháng \d+ \(đang mở\) vẫn khóa 00:00 ngày \d\d\/\d\d\. Áp dụng từ kỳ tháng \d+: khóa/)).toBeVisible();

    const day = page.getByLabel('Hạn đăng ký (ngày)');
    await day.fill('29');
    await page.getByRole('button', { name: 'Lưu kỳ đăng ký' }).click();
    await expect(day).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Nhập số từ 3 đến 28.')).toBeVisible();

    const contactForm = page.getByRole('form', { name: 'Liên hệ & thông báo' });
    await page.getByLabel('Tên và cách liên hệ Hành chính').fill(contact);
    await contactForm.getByRole('button', { name: 'Lưu liên hệ' }).click();
    await expect(contactForm.getByRole('status')).toHaveText('Đã lưu.');
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-config');

    const guest = await browser.newContext({ baseURL: info.project.use.baseURL });
    const forbidden = await guest.newPage();
    await forbidden.goto('/?login=forbidden');
    await expect(forbidden.getByText(`Liên hệ ${contact} để được thêm vào nhóm.`)).toBeVisible();
    await guest.close();

    await page.goto('/admin/audit?action=config.updated');
    await expect(page.getByRole('heading', { level: 1, name: 'Nhật ký' })).toBeVisible();
    const entry = auditRows(page).first();
    const detail = await openAuditDetail(page, entry);
    const diff = detail.getByRole('table');
    const changed = diff.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Liên hệ Hành chính', exact: true }) });
    await expect(changed.getByRole('cell').last()).toHaveText(contact);
    await detail.getByText('Chi tiết kỹ thuật').click();
    await expect(detail.getByText(`Sau: {"admin_contact":"${contact}"}`)).toBeVisible();
    await expect(detail.getByText('Trước: {"admin_contact":')).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-audit');
  });
});
