import { mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Download } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

// exceljs là dependency của api: đọc lại tệp tải về bằng đúng thư viện đã ghi nó, không thêm gói cho web
type Workbook = { xlsx: { readFile: (path: string) => Promise<unknown> }; worksheets: Sheet[] };
type Cell = { value: unknown };
type Sheet = { name: string; rowCount: number; getCell: (ref: string) => Cell; getRows: (start: number, count: number) => { getCell: (n: number) => Cell }[] | undefined };
const ExcelJS = createRequire(new URL('../../api/package.json', import.meta.url))('exceljs') as { Workbook: new () => Workbook };

const DOWNLOADS = 'test-results/downloads';
const PART1 = 'Phần 1 · Tổng hợp theo món';

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
    // Báo cáo chỉ đọc: không nút chốt, không ô nhập
    await expect(page.getByRole('button', { name: /^(Xuất Excel|In trình ký)/ })).toHaveCount(0);

    const part1 = page.getByRole('region', { name: PART1 });
    const rowA = part1.getByRole('row').filter({ hasText: a.name });
    // Đăng ký 5 · Nợ 0 · Tủ 2 · Tổng cần 5 · Đề nghị 5 (theo bản đã gửi, không trừ tủ) · Đã về 0 · Đã giao 0
    await expect(rowA).toBeVisible();
    expect((await rowA.getByRole('cell').allTextContents()).slice(2, 9)).toEqual(['5', '0', '2', '5', '5', '0', '0']);
    await expect(part1.getByRole('textbox')).toHaveCount(0);
    await expect(part1.getByText(/^Theo bản đã gửi \d{2}:\d{2} \d{2}\/\d{2}$/)).toBeVisible();
    await expect(part1.getByRole('link', { name: 'Sửa số đề nghị ở Gửi ADM →' })).toHaveAttribute('href', '/admin/send-adm');
    // Món seed không có nhóm → "Chưa xếp nhóm"
    await expect(part1.getByRole('rowheader', { name: /^Chưa xếp nhóm/ })).toBeVisible();
    const issues = page.getByRole('region', { name: 'Xuất lẻ trong kỳ' });
    await expect(issues.getByRole('row').filter({ hasText: reason }).getByText(seed.name)).toBeVisible();
    await expect(issues.getByRole('link', { name: 'Mở Tủ / Kho' })).toHaveAttribute('href', '/admin/stock');
    const part2 = page.getByRole('region', { name: 'Phần 2 · Chi tiết theo phòng ban' });
    await expect(part2.getByRole('rowheader', { name: 'PW Phòng giao' })).toBeVisible();
    await expect(part2.getByRole('row').filter({ hasText: seed.name })).toContainText(`${a.name} 5`);
    const list = page.getByRole('region', { name: 'Bản chốt' });
    const printed = list.getByRole('listitem').filter({ hasText: 'Bản in' }).first();
    await expect(printed.getByRole('link', { name: /^In lại bản lập/ })).toHaveAttribute('target', '_blank');
    await part1.getByRole('button', { name: 'Cách tính Tổng cần' }).click();
    await expect(page.getByRole('dialog', { name: 'Cách tính Tổng cần' })).toContainText('Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ.');
    await page.keyboard.press('Escape');

    await expect(month.getByRole('button', { name: 'Tháng sau' })).toBeEnabled();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'reports');
  });

  test('V2D-7 E5-S2 Báo cáo chỉ đọc theo bản đã gửi, Excel của bản tải về và tải lại không tạo bản mới', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    psql(`INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
      VALUES ('${seed.requestId}', 'PW chờ xem ${seed.tag}', 'cai', 1, 'pending')`);
    const report = await (await request.get(`/api/admin/reports/${seed.prevYm}`, { headers: devHeaders('admin') })).json();
    const key = report.byItem.find((r: { name: string }) => r.name === a.name).key as string;
    await page.goto('/admin/reports');
    const part1 = page.getByRole('region', { name: PART1 });
    const rowA = part1.getByRole('row').filter({ hasText: a.name });
    // Chưa gửi (dev không còn bản gửi của kỳ): Đề nghị = số gộp 5, không trừ tủ 2
    const state = (await (await request.get(`/api/admin/periods/${seed.prevYm}/send-state`, { headers: devHeaders('admin') })).json()).state;
    if (state === 'unsent') {
      await expect(part1.getByText('Gợi ý, chưa gửi')).toBeVisible();
      await expect(rowA.getByRole('cell').nth(6)).toHaveText('5');
    }
    await expect(page.getByText(/^Còn \d+ món ngoài danh mục chưa xem — chưa được tính vào báo cáo này\./)).toBeVisible();

    // Gửi ADM chốt bản Excel với Đề nghị 9 (sửa ở Gửi ADM)
    const made = await request.post(`/api/admin/reports/${seed.prevYm}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'xlsx', order_qty: { [key]: 9 } } });
    expect(made.ok()).toBe(true);
    const before = await snapshotsOf(request, seed.prevYm);
    await page.reload();
    await expect(part1.getByText(/^Theo bản đã gửi \d{2}:\d{2} \d{2}\/\d{2}$/)).toBeVisible();
    await expect(rowA.getByRole('cell').nth(6)).toHaveText('9');

    const list = page.getByRole('region', { name: 'Bản chốt' });
    const mine = list.getByRole('listitem').filter({ hasText: 'Excel' }).first();
    const downloading = page.waitForEvent('download');
    await mine.getByRole('button', { name: /^Tải lại Excel lập/ }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    const file = `${DOWNLOADS}/${seed.tag}.xlsx`;
    run.files.push(file);
    await saveDownload(download, file);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Phiếu đề xuất', 'Phụ lục']);
    expect(wb.worksheets[0].getCell('A1').value).toBe('Phiếu đề xuất văn phòng phẩm');
    const formRow = wb.worksheets[0].getRows(1, wb.worksheets[0].rowCount)!.find((r) => r.getCell(3).value === a.name)!;
    expect(formRow.getCell(6).value).toBe(9);
    const sheetRow = wb.worksheets[1].getRows(1, wb.worksheets[1].rowCount)!.find((r) => r.getCell(1).value === a.name)!;
    // Tổng cần 5 · Đề nghị 9
    expect([sheetRow.getCell(6).value, sheetRow.getCell(7).value]).toEqual([5, 9]);
    expect(await snapshotsOf(request, seed.prevYm)).toBe(before);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'reports-sent');
  });

  test('E9-S4 Báo cáo: kỳ đang mở → 409 PERIOD_NOT_LOCKED {ym, deadline} (chặn ghi bản chốt kiểm ở api e2e report-snapshots)', async ({ request }) => {
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const ym: string = period.ym;
    const report = await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') });
    expect(report.status()).toBe(409);
    expect(await report.json()).toMatchObject({ code: 'PERIOD_NOT_LOCKED', ym, deadline: period.deadline });
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
