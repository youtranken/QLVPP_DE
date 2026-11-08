import { mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Download, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';
import { confirmIfAsked, openCopies, openEditable } from './report-send-flow';

// exceljs là dependency của api: đọc lại tệp tải về bằng đúng thư viện đã ghi nó, không thêm gói cho web
type Workbook = { xlsx: { readFile: (path: string) => Promise<unknown> }; worksheets: Sheet[] };
type Cell = { value: unknown };
type Sheet = { name: string; rowCount: number; getCell: (ref: string) => Cell; getRows: (start: number, count: number) => { getCell: (n: number) => Cell }[] | undefined };
const ExcelJS = createRequire(new URL('../../api/package.json', import.meta.url))('exceljs') as { Workbook: new () => Workbook };

const DOWNLOADS = 'test-results/downloads';
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const monthLabel = (ym: string) => `Tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;
const snapshotsOf = async (request: APIRequestContext, ym: string) =>
  ((await (await request.get(`/api/admin/reports/${ym}/snapshots`, { headers: devHeaders('admin') })).json()) as { items: unknown[] }).items.length;

async function saveDownload(download: Download, file: string) {
  mkdirSync(DOWNLOADS, { recursive: true });
  await download.saveAs(file);
  expect(statSync(file).size).toBeGreaterThan(0);
}

asRole('admin');

test.describe('Vòng3-BC Báo cáo & gửi ADM', () => {
  // Kỳ riêng của PW: bản chốt chỉ có món PW và không thay bản đã gửi của kỳ trước thật trên dev
  let run: { release: () => void; seed?: Seed; files: string[] };
  test.beforeEach(async () => {
    run = { release: await acquireLock('prev-period'), files: [] };
    clearPrivateSnapshots();
  });
  test.afterEach(() => {
    for (const f of run.files) rmSync(f, { force: true });
    clearPrivateSnapshots();
    run.seed?.cleanup();
    run.release();
  });

  test('Vòng3-BC sửa Đề nghị trong bảng → In trình ký → bản mới trong "Các bản đã in / xuất"; bản thay thế liệt kê món đổi', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 13 }], { ym: PRIVATE_YM }));
    const [item] = seed.items;
    await openOnPrivatePeriod(page);
    // In trình ký mở hộp in tại chỗ: thay hộp in thật bằng bộ đếm (như Chrome: beforeprint rồi afterprint)
    await page.addInitScript(() => {
      const w = window as unknown as { __printed: number };
      w.__printed = 0;
      window.print = () => {
        w.__printed++;
        window.dispatchEvent(new Event('beforeprint'));
        window.dispatchEvent(new Event('afterprint'));
      };
    });
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo & gửi ADM' })).toBeVisible();
    const replacing = await openEditable(page);
    const rowOf = () => page.getByRole('table').first().getByRole('row').filter({ hasText: item.name });
    const qty = () => page.getByRole('spinbutton', { name: `Đề nghị: ${item.name}` });
    await expect(qty()).toHaveValue('13');
    await qty().fill('10');
    await qty().fill('100000');
    await expect(page.getByText('Tối đa 99.999')).toBeVisible();
    await expect(page.getByRole('button', { name: 'In trình ký' })).toBeDisabled();
    await qty().fill('10');
    await expect(page.getByText('Tối đa 99.999')).toHaveCount(0);
    await settled(page);
    await shot(page, info, 'vong3-report-send');
    if (isMobile(info)) {
      await expectNoContrastViolations(page);
      expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
    }

    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmIfAsked(page, request, seed.prevYm, replacing);
    await expect(page.getByText(/^Đã gửi ADM \d\d:\d\d \d\d\/\d\d/)).toBeVisible();
    const copies = await openCopies(page);
    await expect(copies.getByText('Đã gửi ADM', { exact: true })).toBeVisible();
    await expect(page.locator('details.bc-snaps-box summary')).toContainText('Các bản đã in / xuất (1)');

    await qty().fill('13');
    await page.getByRole('button', { name: 'In trình ký' }).click();
    const replace = page.getByRole('dialog', { name: /^Bản mới thay thế bản in lúc/ });
    await expect(replace.getByRole('listitem').filter({ hasText: item.name })).toHaveText(`${item.name} 10 → 13`);
    await replace.getByRole('button', { name: 'In trình ký' }).click();
    await expect(page.locator('details.bc-snaps-box summary')).toContainText('Các bản đã in / xuất (2)');
    await expect(rowOf().getByRole('spinbutton')).toHaveValue('13');
    const printed = () => page.evaluate(() => (window as unknown as { __printed: number }).__printed);
    await expect.poll(printed).toBe(2);
    await page.getByRole('button', { name: 'In lại' }).click();
    await expect.poll(printed).toBe(3);
    await expect(page).toHaveURL(/\/admin\/reports/);
  });

  test('Vòng3-BC kỳ cũ hơn chỉ đọc; "Ai đăng ký" mở popup rồi phiếu; Excel tải lại không tạo bản mới', async ({ page, request }, info) => {
    clearPrivateSnapshots();
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }], { ym: PRIVATE_YM }));
    const [a] = seed.items;
    psql(`UPDATE requests SET department = 'PW Phòng giao' WHERE id = '${seed.requestId}'`);
    const report = await (await request.get(`/api/admin/reports/${seed.prevYm}`, { headers: devHeaders('admin') })).json();
    const key = report.byItem.find((r: { name: string }) => r.name === a.name).key as string;
    const made = await request.post(`/api/admin/reports/${PRIVATE_YM}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'xlsx', order_qty: { [key]: 9 } } });
    expect(made.ok()).toBe(true);
    const before = await snapshotsOf(request, seed.prevYm);

    await page.goto(`/admin/reports?ym=${PRIVATE_YM}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Báo cáo & gửi ADM');
    await expect(page.getByRole('group', { name: 'Chọn tháng báo cáo' }).getByText(monthLabel(seed.prevYm))).toBeVisible();
    const rowA = page.getByRole('table').first().getByRole('row').filter({ hasText: a.name });
    await expect(rowA).toBeVisible();
    // Đăng ký 5 · Nợ 0 · Tủ 2 · Tổng cần 5 · Đề nghị 9 (theo bản đã gửi, chỉ đọc)
    expect((await rowA.getByRole('cell').allTextContents()).slice(2, 7)).toEqual(['5', '0', '2', '5', '9']);
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    await expect(page.getByRole('rowheader', { name: /^Chưa xếp nhóm/ })).toBeVisible();

    await rowA.getByRole('button', { name: /^Xem ai đăng ký/ }).click();
    const people = page.getByRole('dialog', { name: a.name });
    await expect(people.getByText(seed.name)).toBeVisible();
    await expect(people.getByText('Tổng sau điều chỉnh')).toBeVisible();
    await people.getByRole('button', { name: `Xem phiếu của ${seed.name}` }).click();
    await expect(page.getByRole('dialog', { name: `Phiếu của ${seed.name}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    const copies = await openCopies(page);
    const downloading = page.waitForEvent('download');
    await copies.getByRole('button', { name: /^Tải lại Excel lập/ }).first().click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    const file = `${DOWNLOADS}/${seed.tag}.xlsx`;
    run.files.push(file);
    await saveDownload(download, file);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Phiếu đề xuất', 'Phụ lục']);
    const formRow = wb.worksheets[0].getRows(1, wb.worksheets[0].rowCount)!.find((r) => r.getCell(3).value === a.name)!;
    expect(formRow.getCell(6).value).toBe(9);
    expect(await snapshotsOf(request, seed.prevYm)).toBe(before);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'vong3-report-readonly');
  });

  test('Vòng3-BC kỳ đang mở → 409 PERIOD_NOT_LOCKED; lỗi tải báo cáo có "Thử lại"; /admin/send-adm chuyển về /admin/reports', async ({ page, request }) => {
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const open = await request.get(`/api/admin/reports/${period.ym}`, { headers: devHeaders('admin') });
    expect(open.status()).toBe(409);
    expect(await open.json()).toMatchObject({ code: 'PERIOD_NOT_LOCKED', ym: period.ym, deadline: period.deadline });

    let fail = true;
    await page.route('**/api/admin/reports/20*', (route) => (fail ? route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }) : route.fallback()));
    await page.goto('/admin/reports');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Chỉ món có Tổng cần' })).toBeVisible();

    await page.goto('/admin/send-adm?ym=2026-10');
    await expect(page).toHaveURL(/\/admin\/reports\?ym=2026-10/);
  });
});
