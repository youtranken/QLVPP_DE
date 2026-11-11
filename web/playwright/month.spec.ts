import { expect, test, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, searchMonthPeople, settled, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const steps = (page: Page) => page.getByRole('list', { name: /^(Các bước của tháng|Steps of the month)$/ });

async function openMonth(page: Page, ym?: string) {
  await page.goto(ym ? `/admin/month?ym=${ym}` : '/admin/month');
  await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
}

test.describe('Vòng3-KT Kỳ tháng', () => {
  test('Vòng3-KT /admin vào Kỳ tháng: dải 4 bước gọn, chip lọc, bảng kẻ ô, không cuộn ngang', async ({ page }, info) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/month/);
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    const items = steps(page).getByRole('listitem');
    await expect(items).toHaveCount(4);
    for (const [i, name] of ['Đăng ký', 'Gửi NCC', 'Nhận hàng', 'Giao'].entries()) await expect(items.nth(i)).toContainText(name);
    await expect(page.getByRole('button', { name: /^Tất cả/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Có ghi chú/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Chưa giao xong/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Chép/ })).toHaveCount(0);
    await settled(page);
    await shot(page, info, 'vong3-month');
    expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
    if (isMobile(info)) await expectNoContrastViolations(page);
  });

  test('Vòng3-KT chip Chưa giao xong lọc, Xem mở popup phiếu, Điều chỉnh mở ?request=', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 3 }]);
    try {
      await openMonth(page, seed.prevYm);
      await searchMonthPeople(page, seed.tag);
      const row = page.getByRole('row').filter({ hasText: seed.name });
      await expect(row.getByRole('progressbar', { name: 'đã giao 0/3 đơn vị' })).toBeVisible();
      const undelivered = page.getByRole('button', { name: /^Chưa giao xong/ });
      await undelivered.click();
      await expect(undelivered).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/chip=undelivered/);
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: `Xem phiếu của ${seed.name}` }).click();
      const dialog = page.getByRole('dialog', { name: `Phiếu của ${seed.name}` });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(seed.items[0].name)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await row.getByRole('button', { name: `Điều chỉnh phiếu của ${seed.name}` }).click();
      await expect(page).toHaveURL(/request=/);
      await expect(page.getByRole('dialog', { name: `Điều chỉnh phiếu ${seed.name}` })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'vong3-month-adjust');
    } finally {
      seed.cleanup();
    }
  });

  test('Vòng3-KT lỗi tải số liệu kỳ → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/periods/*/summary', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/month');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });

  test('Vòng3-KT kỳ đang đăng ký chỉ xem, Xem mở popup, ‹ › chuyển người', async ({ page, request }, info) => {
    const current = await request.get('/api/periods/current', { headers: devHeaders('admin') });
    const { ym } = (await current.json()) as { ym: string };
    const row = (id: string, name: string, team: string | null) => ({
      request_id: id, user_sub: `pw-${id}`, full_name: name, email: null, team, line_count: 1, total_qty: 2, custom_count: 0, saved_at: '2026-11-07T04:06:00.000Z',
    });
    const rows = [row('q-1', 'PW Người một', 'Team Test'), row('q-2', 'PW Người hai', null)];
    const view = (id: string) => ({
      id, period_ym: ym, user_sub: `pw-${id}`, full_name: rows.find((r) => r.request_id === id)!.full_name, department: null, updated_at: '2026-11-07T04:06:00.000Z',
      is_open: true, user_status: 'active', team: null,
      lines: [{ id: `${id}-l`, item_id: null, item: null, custom_name: 'PW món ngoài', custom_unit: 'cai', custom_note: null, image_file_id: null, qty: 2, delivered_qty: 0, cancelled_qty: 0, cancel_note: null, review_status: 'pending', review_note: null, added_by_admin: false, readonly_for_member: true, max_qty: null }],
    });
    await page.route(/\/api\/admin\/periods\/\d{4}-\d{2}\/registrations(\/[\w-]+)?$/, (route) => {
      const id = /registrations\/([\w-]+)$/.exec(route.request().url())?.[1];
      return route.fulfill({ status: 200, json: id ? view(id) : { items: rows } });
    });
    await openMonth(page);
    await page.getByRole('radio', { name: /^Kỳ đang đăng ký/ }).click();
    await expect(page).toHaveURL(new RegExp(`ym=${ym}`));
    await expect(page.getByRole('row').filter({ hasText: 'PW Người một' })).toBeVisible();
    await expect(steps(page).getByText('—')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Điều chỉnh/ })).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await page.getByRole('button', { name: 'Xem phiếu của PW Người một' }).click();
    const dialog = page.getByRole('dialog', { name: 'Phiếu của PW Người một' });
    await expect(dialog.getByText('PW món ngoài')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Người trước' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Người sau' }).click();
    const next = page.getByRole('dialog', { name: 'Phiếu của PW Người hai' });
    await expect(next.getByRole('button', { name: 'Người sau' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Xem phiếu của PW Người hai' })).toBeFocused();
    await shot(page, info, 'vong3-month-open');
  });

  test('Vòng3-KT đường cũ /admin/summary và /admin/home chuyển về Kỳ tháng giữ query; ?filter cũ thành chip', async ({ page }) => {
    await page.goto('/admin/summary?ym=2026-10&filter=pending_delivery');
    await expect(page).toHaveURL(/\/admin\/month\?.*ym=2026-10/);
    await expect(page).toHaveURL(/chip=undelivered/);
    await page.goto('/admin/home');
    await expect(page).toHaveURL(/\/admin\/month/);
  });

  test('Vòng3-KT đổi sang English thì tên bước đổi theo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vpp_lang', 'en'));
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Month \d+$/ })).toBeVisible();
    for (const name of ['Sign-up', 'Send to supplier', 'Receiving', 'Delivery']) await expect(steps(page).getByText(name, { exact: true })).toBeVisible();
  });
});

