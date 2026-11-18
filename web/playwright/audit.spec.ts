import { expect, test } from '@playwright/test';
import { asRole, auditRows, expectNoContrastViolations, isMobile, openAuditDetail, psql, shot } from './helpers';

// 12:00 UTC: xa mốc ngày VN; mốc ngày kiểm ở e2e api
// audit_log chỉ thêm, không xóa được: dùng người giả cố định + ngày xa quá khứ, gieo một lần (idempotent) thay vì xóa sau test.
// Đổi dạng dòng gieo thì đổi tên người giả (hậu tố -v2): dòng dạng cũ của lần chạy trước còn mãi trong DB dev
const FULL = { actor: 'pw-audit-full-v2', day: '2001-03-15', rows: 51 };
const EXACT = { actor: 'pw-audit-exact-v2', day: '2001-03-16', rows: 50 };
const PAGE_SIZE = 50;

function seed({ actor, day, rows }: { actor: string; day: string; rows: number }) {
  psql(`INSERT INTO audit_log (actor, action, object_type, object_id, detail, created_at)
    SELECT '${actor}', 'config.updated', 'config', 'pw_marker',
      jsonb_build_object('before', jsonb_build_object('admin_contact', 'cu-' || g, 'pw_marker', 'x1', 'name', 'x'), 'after', jsonb_build_object('admin_contact', 'moi-' || g, 'pw_marker', 'x2', 'name', 'x')),
      timestamptz '${day} 12:00:00+00' + (g || ' seconds')::interval
    FROM generate_series(1, ${rows}) g
    WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE actor = '${actor}')`);
}

const vnToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const bodyRows = auditRows;

test.describe('E9-S6 Nhật ký M1 (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S6 Nhật ký: lọc nhanh Hôm nay, khoảng ngày sai báo tại ô, mở Trước/Sau', async ({ page }, info) => {
    seed(EXACT);
    let calls = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/admin/audit') calls++;
    });
    await page.goto(`/admin/audit?actor=${EXACT.actor}&from=${EXACT.day}&to=${EXACT.day}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Nhật ký' })).toBeVisible();
    await expect(page.getByText('Mọi thay đổi dữ liệu và lần đăng nhập, mới nhất trước.')).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(PAGE_SIZE);
    await expect(page.getByText('Thứ Sáu, 16/03/2001')).toBeVisible();

    const first = bodyRows(page).first();
    const detail = await openAuditDetail(page, first);
    const diff = detail.getByRole('table');
    await expect(diff.getByRole('rowheader', { name: 'Liên hệ Adm D&E' })).toBeVisible();
    // Khóa chưa có nhãn (pw_marker) và khóa không đổi (name) không hiện
    await expect(diff.getByRole('rowheader', { name: 'pw_marker' })).toHaveCount(0);
    await expect(diff.getByRole('rowheader', { name: 'Tên' })).toHaveCount(0);
    await expect(diff.getByRole('cell', { name: 'cu-50', exact: true })).toBeVisible();
    await expect(diff.getByRole('cell', { name: 'moi-50', exact: true })).toBeVisible();
    await expect(detail.getByText(/Mã sự kiện #/)).toHaveCount(0);
    await expect(detail.getByText(/Mã hành động/)).toHaveCount(0);
    await expect(first.getByText('Sửa cấu hình')).toBeVisible();
    await expect(first.getByText('config.updated')).toHaveCount(0);
    await expect(detail.getByText('Chi tiết kỹ thuật')).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'admin-audit');
    await first.press(' ');
    await expect(detail).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'moi-50', exact: true })).toHaveCount(0);

    // "Hôm nay" là lựa chọn trong ô Khoảng ngày, không còn hàng "Nhanh:"
    await expect(page.getByRole('group', { name: 'Nhanh:' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Khoảng ngày/ }).click();
    await page.getByRole('dialog', { name: 'Khoảng ngày' }).getByRole('button', { name: 'Hôm nay', exact: true }).click();
    const today = vnToday();
    await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe(today);
    expect(new URL(page.url()).searchParams.get('to')).toBe(today);

    await page.getByRole('button', { name: 'Xóa lọc', exact: true }).first().click();
    await expect(page.getByText(/^Đang lọc:/)).toHaveCount(0);
    // Khoảng ngày là một ô mở lịch (không gõ được ngày sai); URL có to < from → báo lỗi ở ô, không gọi API
    await page.goto('/admin/audit?from=2026-10-20&to=2026-10-19');
    await page.waitForLoadState('networkidle');
    const before = calls;
    const range = page.getByRole('button', { name: /^Khoảng ngày/ });
    await expect(range).toHaveAccessibleDescription('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    expect(calls).toBe(before);
    await range.click();
    const cal = page.getByRole('dialog', { name: 'Khoảng ngày' });
    await cal.locator('[data-day="2026-10-20"]').click();
    await cal.locator('[data-day="2026-10-20"]').click();
    await expect(cal).toHaveCount(0);
    await expect(range).toHaveAccessibleName('Khoảng ngày 20/10/2026 – 20/10/2026');
    await expect(page).toHaveURL(/from=2026-10-20&to=2026-10-20/);
  });

  test('E9-S6 Nhật ký: 51 dòng → 50 + "Xem thêm"; đúng 50 dòng → "Đã hiện hết"', async ({ page }) => {
    seed(FULL);
    seed(EXACT);
    await page.goto(`/admin/audit?actor=${FULL.actor}&from=${FULL.day}&to=${FULL.day}`);
    await expect(bodyRows(page)).toHaveCount(PAGE_SIZE);
    await expect(page.getByText('Đã hiện hết nhật ký trong khoảng lọc.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem thêm' }).click();
    await expect(bodyRows(page)).toHaveCount(FULL.rows);
    await expect(page.getByText('Đã hiện hết nhật ký trong khoảng lọc.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem thêm' })).toHaveCount(0);

    await page.goto(`/admin/audit?actor=${EXACT.actor}&from=${EXACT.day}&to=${EXACT.day}`);
    await expect(bodyRows(page)).toHaveCount(EXACT.rows);
    await expect(page.getByText('Đã hiện hết nhật ký trong khoảng lọc.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem thêm' })).toHaveCount(0);
  });

  test('E9-S6 Nhật ký: lỗi tải → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/audit?*', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/audit');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });

  test('Vòng8 Nhật ký: thanh lọc một hàng ở 1280 (người, Hành động, khoảng ngày, Xóa lọc; không nút Lọc, không nút Chỉ việc tự động — AD-51, A2), gợi ý ô tìm người không bị cắt', async ({ page }, info) => {
    test.skip(isMobile(info), 'một hàng chỉ đòi ở màn rộng');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/admin/audit?from=2026-11-01&to=2026-11-12`);
    const bar = page.getByRole('form', { name: 'Lọc nhật ký' });
    await expect(bar.getByRole('button', { name: 'Xóa lọc', exact: true })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Lọc', exact: true })).toHaveCount(0);
    const tops = await bar.locator('.au-filters__grid > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops).toHaveLength(4);
    expect(new Set(tops).size, `mọi cụm cùng một hàng: ${tops.join(',')}`).toBe(1);
    const clear = bar.getByRole('button', { name: 'Xóa lọc', exact: true });
    await expect(clear).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Chỉ việc tự động' })).toHaveCount(0);
    // Gợi ý "Tên hoặc email" vừa trọn ô (input không tự báo tràn placeholder nên đo bằng canvas)
    const fits = await bar.getByPlaceholder('Tên hoặc email').evaluate((el: HTMLInputElement) => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = cs.font;
      return ctx.measureText(el.placeholder).width <= el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });
    expect(fits).toBe(true);
    // Khoảng ngày đầy đủ hiện trọn trong ô
    const range = bar.getByText('01/11/2026 – 12/11/2026');
    expect(await range.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
