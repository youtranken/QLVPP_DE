import { mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

// exceljs là dependency của api: đọc lại tệp tải về bằng đúng thư viện đã ghi nó, không thêm gói cho web
type Workbook = { xlsx: { readFile: (path: string) => Promise<unknown> }; worksheets: Sheet[] };
type Sheet = { name: string; rowCount: number; getRows: (start: number, count: number) => { getCell: (n: number) => { value: unknown } }[] | undefined };
const ExcelJS = createRequire(new URL('../../api/package.json', import.meta.url))('exceljs') as { Workbook: new () => Workbook };

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-13-shots';
const DOWNLOADS = 'test-results/downloads';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const snapshotCount = (ym: string) => Number(psql(`SELECT count(*) FROM report_snapshots WHERE period_ym = '${ym}-01'`));
const monthLabel = (ym: string) => `Tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;

// Bản chốt tạo trong lần chạy này; xóa trước kỳ seed vì report_snapshots có FK tới periods
const dropSnapshots = (ym: string, since: string) =>
  psql(`DELETE FROM report_snapshots WHERE period_ym = '${ym}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${since}'`);

async function confirmPendingIfAny(page: Page, request: APIRequestContext, ym: string) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0) return;
  const dialog = page.getByRole('dialog', { name: 'Còn món ngoài danh mục chưa xem' });
  await expect(dialog.getByText(`Còn ${report.pending_custom_count} món chưa xem — chốt vẫn thiếu các món này`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Vẫn chốt' }).click();
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

  test('E5-S4 trang Báo cáo: 2 bảng + bảng phụ Xuất lẻ trong kỳ + danh sách bản chốt', async ({ page, request }, info) => {
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
    await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo & in' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Chọn tháng báo cáo' }).getByText(monthLabel(seed.prevYm))).toBeVisible();
    await expect(page.getByRole('main').getByText('Đã khóa', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xuất Excel' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'In trình ký' })).toBeEnabled();

    const part1 = page.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    const row = part1.getByRole('row').filter({ has: page.getByRole('spinbutton', { name: `Đặt mua ${a.name}` }) });
    await expect(row.getByRole('spinbutton')).toHaveValue('3');
    const issues = page.getByRole('region', { name: 'Xuất lẻ trong kỳ' });
    const issue = issues.getByRole('row').filter({ hasText: reason });
    await expect(issue.getByText(seed.name)).toBeVisible();
    const part2 = page.getByRole('region', { name: 'Phần 2 · Chi tiết theo phòng ban' });
    await expect(part2.getByRole('rowheader', { name: 'PW Phòng giao' })).toBeVisible();
    await expect(part2.getByRole('row').filter({ hasText: seed.name }).getByText(a.name)).toBeVisible();
    const list = page.getByRole('region', { name: 'Bản chốt' });
    await expect(list.getByRole('row').filter({ hasText: 'Bản in' }).first()).toBeVisible();

    await expect(page.getByRole('group', { name: 'Chọn tháng báo cáo' }).getByRole('button', { name: 'Tháng sau' })).toBeEnabled();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'reports');
  });

  test('E5-S2 xuất Excel: sửa Đặt mua → tải .xlsx 2 sheet → bản chốt vào danh sách → "Tải lại" không tạo bản mới', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    const before = snapshotCount(seed.prevYm);
    await page.goto('/admin/reports');
    const order = page.getByRole('spinbutton', { name: `Đặt mua ${a.name}` });
    const exportBtn = page.getByRole('button', { name: 'Xuất Excel' });
    await expect(order).toHaveValue('3');
    await order.fill('100000');
    await expect(page.getByText('Nhập số nguyên 0–99999')).toBeVisible();
    await expect(exportBtn).toBeDisabled();
    await order.fill('9');
    await expect(page.getByRole('button', { name: `Về Cần mua ${a.name}` })).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    const downloading = page.waitForEvent('download');
    await exportBtn.click();
    await confirmPendingIfAny(page, request, seed.prevYm);
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    const file = `${DOWNLOADS}/${seed.tag}.xlsx`;
    mkdirSync(DOWNLOADS, { recursive: true });
    run.files.push(file);
    await download.saveAs(file);
    expect(statSync(file).size).toBeGreaterThan(0);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Tổng theo món', 'Chi tiết']);
    const sheetRow = wb.worksheets[0].getRows(1, wb.worksheets[0].rowCount)!.find((r) => r.getCell(1).value === a.name)!;
    expect(sheetRow.getCell(6).value).toBe(3);
    expect(sheetRow.getCell(7).value).toBe(9);

    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    const list = page.getByRole('region', { name: 'Bản chốt' });
    await expect(list.getByRole('row').filter({ hasText: 'Excel' })).toHaveCount(
      Number(psql(`SELECT count(*) FROM report_snapshots WHERE period_ym = '${seed.prevYm}-01' AND kind = 'xlsx'`)),
    );
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'reports-exported');

    const again = page.waitForEvent('download');
    await list.getByRole('button', { name: /^Tải lại bản chốt/ }).first().click();
    const second = await again;
    expect(second.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    const file2 = `${DOWNLOADS}/${seed.tag}-again.xlsx`;
    run.files.push(file2);
    await second.saveAs(file2);
    expect(statSync(file2).size).toBeGreaterThan(0);
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
  });
});
