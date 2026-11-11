import { expect, test } from '@playwright/test';
import { asRole, auditRows, expectNoContrastViolations, isMobile, openAuditDetail, psql, shot } from './helpers';

// 12:00 UTC: xa mốc ngày VN; mốc ngày kiểm ở e2e api
// audit_log chỉ thêm, không xóa được: dùng người giả cố định + ngày xa quá khứ, gieo một lần (idempotent) thay vì xóa sau test
const FULL = { actor: 'pw-audit-full', day: '2001-03-15', rows: 51 };
const EXACT = { actor: 'pw-audit-exact', day: '2001-03-16', rows: 50 };
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

    await page.getByRole('button', { name: 'Hôm nay', exact: true }).click();
    const today = vnToday();
    await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe(today);
    expect(new URL(page.url()).searchParams.get('to')).toBe(today);
    await expect(page.getByRole('button', { name: 'Hôm nay', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Xóa lọc', exact: true }).first().click();
    await expect(page.getByText(/^Đang lọc:/)).toHaveCount(0);
    await page.getByLabel('Từ ngày').fill('31/02/2026');
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    await expect(page.getByLabel('Từ ngày')).toHaveAccessibleDescription('Ngày không hợp lệ — nhập dd/mm/yyyy.');
    await page.getByLabel('Từ ngày').fill('20/10/2026');
    await page.getByLabel('Đến ngày').fill('19/10/2026');
    const before = calls;
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    await expect(page.getByLabel('Đến ngày')).toHaveAccessibleDescription('“Đến ngày” phải bằng hoặc sau “Từ ngày”.');
    expect(calls).toBe(before);
    await page.getByLabel('Đến ngày').fill('20/10/2026');
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
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
});
