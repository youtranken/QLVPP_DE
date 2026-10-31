import { mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Download } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

// exceljs là dependency của api: đọc lại tệp tải về bằng đúng thư viện đã ghi nó, không thêm gói cho web
type Workbook = { xlsx: { readFile: (path: string) => Promise<unknown> }; worksheets: Sheet[] };
type Sheet = { name: string; rowCount: number; getRows: (start: number, count: number) => { getCell: (n: number) => { value: unknown } }[] | undefined };
const ExcelJS = createRequire(new URL('../../api/package.json', import.meta.url))('exceljs') as { Workbook: new () => Workbook };

const DOWNLOADS = 'test-results/downloads';
const PART1 = 'Phần 1 · Tổng hợp theo món';
const PENDING_DIALOG = /^Còn \d+ món ngoài danh mục chưa xem$/;

const monthLabel = (ym: string) => `Tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;
const snapshotsOf = async (request: APIRequestContext, ym: string) =>
  ((await (await request.get(`/api/admin/reports/${ym}/snapshots`, { headers: devHeaders('admin') })).json()) as { items: unknown[] }).items.length;

// Bản chốt tạo trong lần chạy này; xóa trước kỳ seed vì report_snapshots có FK tới periods
const dropSnapshots = (ym: string, since: string) =>
  psql(`DELETE FROM report_snapshots WHERE period_ym = '${ym}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${since}'`);

async function saveDownload(download: Download, file: string) {
  mkdirSync(DOWNLOADS, { recursive: true });
  await download.saveAs(file);
  expect(statSync(file).size).toBeGreaterThan(0);
}

asRole('admin');

test.describe('E5 báo cáo (kỳ trước đã khóa, dev-identity admin)', () => {
  // Dọn ở afterEach thay vì finally: afterEach vẫn chạy khi test hết giờ
  let run: { release: () => void; since: string; seed?: Seed; files: string[] };
  test.beforeEach(async () => {
    run = { release: await acquireLock('prev-period'), since: new Date().toISOString(), files: [] };
  });
  test.afterEach(() => {
    for (const f of run.files) rmSync(f, { force: true });
    if (run.seed) dropSnapshots(run.seed.prevYm, run.since);
    run.seed?.cleanup();
    run.release();
  });

  test('E5-S4 trang Báo cáo: Phần 1 nhóm, Xuất lẻ trong kỳ, Phần 2 theo phòng ban, Bản chốt', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    // Phòng ban của Phần 2 lấy từ phiếu (chốt lúc tạo phiếu), seed chung không đặt
    psql(`UPDATE requests SET department = 'PW Phòng giao' WHERE id = '${seed.requestId}'`);
    const reason = `PW họp ${seed.tag}`;
    psql(`INSERT INTO stock_movements (item_id, delta, reason, recipient_sub, note, actor_sub, created_at)
      VALUES ('${a.id}', -1, 'issue', '${seed.sub}', '${reason}', 'pw-admin', '${seed.prevYm}-15T03:00:00Z')`);
    const made = await request.post(`/api/admin/reports/${seed.prevYm}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print' } });
    expect(made.ok()).toBe(true);

    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Báo cáo & in');
    const month = page.getByRole('group', { name: 'Chọn tháng báo cáo' });
    await expect(month.getByText(monthLabel(seed.prevYm))).toBeVisible();
    await expect(month.getByText('Đã khóa', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xuất Excel' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'In trình ký' })).toBeEnabled();

    const part1 = page.getByRole('region', { name: PART1 });
    await expect(part1.getByRole('textbox', { name: `Đặt mua ${a.name}` })).toHaveValue('3');
    // Món seed không có nhóm → "Chưa xếp nhóm"
    await expect(part1.getByRole('rowheader', { name: /^Chưa xếp nhóm/ })).toBeVisible();
    const issues = page.getByRole('region', { name: 'Xuất lẻ trong kỳ' });
    await expect(issues.getByRole('row').filter({ hasText: reason }).getByText(seed.name)).toBeVisible();
    await expect(issues.getByRole('link', { name: 'Mở Kho' })).toHaveAttribute('href', '/admin/stock');
    const part2 = page.getByRole('region', { name: 'Phần 2 · Chi tiết theo phòng ban' });
    await expect(part2.getByRole('rowheader', { name: 'PW Phòng giao' })).toBeVisible();
    await expect(part2.getByRole('row').filter({ hasText: seed.name })).toContainText(`${a.name} 5`);
    const list = page.getByRole('region', { name: 'Bản chốt' });
    const printed = list.getByRole('listitem').filter({ hasText: 'Bản in' }).first();
    await expect(printed.getByRole('link', { name: /^In lại bản lập/ })).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('region', { name: 'Cách tính Cần mua' })).toBeVisible();

    await expect(month.getByRole('button', { name: 'Tháng sau' })).toBeEnabled();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'reports');
  });

  test('E5-S2 E9-S4 Báo cáo: Đặt mua biên 0/99999/100000, chốt hỏi món chưa xem, Excel tải về và tải lại không tạo bản mới', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    psql(`INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
      VALUES ('${seed.requestId}', 'PW chờ xem ${seed.tag}', 'cai', 1, 'pending')`);
    const before = await snapshotsOf(request, seed.prevYm);
    await page.goto('/admin/reports');
    const order = page.getByRole('textbox', { name: `Đặt mua ${a.name}` });
    const exportBtn = page.getByRole('button', { name: 'Xuất Excel' });
    await expect(order).toHaveValue('3');
    await expect(page.getByText(/^Còn \d+ món ngoài danh mục chưa xem — chưa được tính vào báo cáo này\./)).toBeVisible();

    await order.fill('100000');
    await expect(page.getByText('Từ 0 đến 99 999.')).toBeVisible();
    await exportBtn.click();
    await expect(page.getByText('Sửa 1 ô Đặt mua đang lỗi trước khi chốt.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const ok of ['99999', '0']) {
      await order.fill(ok);
      await expect(order).not.toHaveAttribute('aria-invalid');
    }
    await expect(page.getByText('Sửa 1 ô Đặt mua đang lỗi trước khi chốt.')).toHaveCount(0);

    await exportBtn.click();
    await page.getByRole('dialog', { name: PENDING_DIALOG }).getByRole('button', { name: 'Xem món chờ' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/review\\?ym=${seed.prevYm}$`));
    expect(await snapshotsOf(request, seed.prevYm)).toBe(before);

    await page.goto(`/admin/reports?ym=${seed.prevYm}`);
    await order.fill('9');
    await expect(page.getByRole('button', { name: `Về Cần mua (3) ${a.name}` })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await exportBtn.click();
    await page.getByRole('dialog', { name: PENDING_DIALOG }).getByRole('button', { name: 'Vẫn chốt' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    await expect(page.getByText(new RegExp(`^Đã xuất Excel ${monthLabel(seed.prevYm).replace('Tháng', 'tháng')} · bản chốt \\d{2}:\\d{2}$`))).toBeVisible();
    const file = `${DOWNLOADS}/${seed.tag}.xlsx`;
    run.files.push(file);
    await saveDownload(download, file);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Tổng theo món', 'Chi tiết']);
    const sheetRow = wb.worksheets[0].getRows(1, wb.worksheets[0].rowCount)!.find((r) => r.getCell(1).value === a.name)!;
    expect([sheetRow.getCell(6).value, sheetRow.getCell(7).value]).toEqual([3, 9]);
    expect(await snapshotsOf(request, seed.prevYm)).toBe(before + 1);

    const list = page.getByRole('region', { name: 'Bản chốt' });
    const fresh = list.getByRole('listitem').filter({ hasText: 'Mới' });
    await expect(fresh).toHaveCount(1);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'reports-exported');

    const again = page.waitForEvent('download');
    await fresh.getByRole('button', { name: /^Tải lại Excel lập/ }).click();
    const second = await again;
    expect(second.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    const file2 = `${DOWNLOADS}/${seed.tag}-again.xlsx`;
    run.files.push(file2);
    await saveDownload(second, file2);
    expect(await snapshotsOf(request, seed.prevYm)).toBe(before + 1);
  });

  test('E9-S4 Báo cáo: kỳ đang mở → cảnh báo tạm tính, vẫn chốt được', async ({ page, request }) => {
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    await page.goto(`/admin/reports?ym=${period.ym}`);
    await expect(page.getByText(`Kỳ tháng ${Number(period.ym.slice(5, 7))} đang mở — số liệu tạm tính theo phiếu đã lưu.`)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Chọn tháng báo cáo' }).getByText(/^Đang mở · hạn /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'In trình ký' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
  });

  test('E9-S4 Báo cáo: lỗi tải báo cáo → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    let fail = true;
    await page.route('**/api/admin/reports/20*', (route) => (fail ? route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }) : route.fallback()));
    await page.goto('/admin/reports');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toHaveCount(0);
    await expect(page.getByRole('region', { name: PART1 })).toBeVisible();
  });
});
