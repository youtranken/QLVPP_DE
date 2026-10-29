import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
import { deliveryMovements, seedMonth, type MonthSeed, type Person } from './p3-seed';
import { adminPage, newPage } from './sessions';

type Sheet = { name: string; rowCount: number; getRows: (start: number, count: number) => { getCell: (n: number) => { value: unknown } }[] | undefined };
type Workbook = { xlsx: { readFile: (path: string) => Promise<unknown> }; worksheets: Sheet[] };
// exceljs là dependency của api: đọc lại tệp tải về bằng đúng thư viện đã ghi nó, không thêm gói cho web
const ExcelJS = createRequire(new URL('../../api/package.json', import.meta.url))('exceljs') as { Workbook: new () => Workbook };

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-17-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

async function axe390(page: Page, info: TestInfo) {
  if (isMobile(info)) await expectNoContrastViolations(page);
}

const month = (ym: string) => Number(ym.slice(5, 7));
const lineOf = (lines: Locator, name: string) => lines.getByRole('listitem').filter({ hasText: name });
const reportRow = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row').filter({ has: page.getByRole('spinbutton', { name: `Đặt mua ${name}` }) });
// Cột: Món · ĐVT · Đăng ký kỳ này · Nợ kỳ trước · Tồn · Cần mua · Đặt mua
const needCell = (row: Locator) => row.getByRole('cell').nth(5);

// DB dev có thể còn món ngoài danh mục chờ xem của kỳ đó (dữ liệu khác) → hộp nhắc trước khi chốt
async function confirmPendingIfAny(page: Page, request: APIRequestContext, ym: string) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0) return;
  await page.getByRole('dialog', { name: 'Còn món ngoài danh mục chưa xem' }).getByRole('button', { name: 'Vẫn chốt' }).click();
}

async function deliver(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/delivery');
  await expect(admin.getByText(`Tháng ${month(s.prevYm)}/${s.prevYm.slice(0, 4)}`)).toBeVisible();
  const toggle = admin.getByRole('button', { name: new RegExp(`^${s.a.name}`) });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const lines = admin.getByRole('list', { name: `Các dòng của phiếu ${s.a.name}` });
  const paper = lineOf(lines, s.paper.name);
  await paper.getByLabel(`Thực giao ${s.paper.name}`).fill('3');
  await paper.getByRole('button', { name: `Giao ${s.paper.name}` }).dblclick();
  await expect(paper.getByText('đã giao 3/5')).toBeVisible();
  await expect(paper.getByText('còn 2')).toBeVisible();
  await expect(paper.getByLabel(`Thực giao ${s.paper.name}`)).toHaveValue('2');
  expect(deliveryMovements(s.paper.id)).toBe('-3');
  await axe390(admin, info);
  await snap(admin, info, 'p3-delivered-paper');

  await admin.getByRole('button', { name: 'Giao tất cả' }).click();
  const result = admin.getByRole('status').filter({ hasText: 'Đã giao 2 dòng' });
  await expect(result).toBeVisible();
  await expect(result.getByRole('list', { name: 'Không giao được' })).toContainText(`Không giao được: ${s.paper.name} — chỉ còn 0 trong kho`);
  await expect(lineOf(lines, s.pen.name).getByText('Đã giao đủ')).toBeVisible();
  await expect(lineOf(lines, s.custom).getByText('Đã giao đủ')).toBeVisible();
  expect(deliveryMovements(s.pen.id)).toBe('-2');
  await snap(admin, info, 'p3-delivered-all');
}

async function backlogByItem(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/backlog');
  await expect(admin.getByRole('button', { name: 'Theo món' })).toHaveAttribute('aria-pressed', 'true');
  await expect(admin.getByRole('region', { name: s.paper.name }).getByText('còn 2 cái')).toBeVisible();
  await expect(admin.getByRole('region', { name: s.clip.name }).getByText('còn 3 cái')).toBeVisible();
  await expect(admin.getByRole('region', { name: s.pen.name })).toHaveCount(0);
  await axe390(admin, info);
  await snap(admin, info, 'p3-backlog');
}

async function reportAndSnapshot(admin: Page, info: TestInfo, s: MonthSeed, request: APIRequestContext, file: string) {
  await admin.goto(`/admin/reports?ym=${s.ym}`);
  // PRD §10 mục 6: nợ 2 kỳ trước + đăng ký 3 kỳ này, tồn 0 → Cần mua 5
  await expect(needCell(reportRow(admin, s.paper.name))).toHaveText('5');
  await admin.goto(`/admin/reports?ym=${s.prevYm}`);
  await expect(needCell(reportRow(admin, s.paper.name))).toHaveText('2');
  await expect(needCell(reportRow(admin, s.clip.name))).toHaveText('3');
  await expect(reportRow(admin, s.pen.name)).toHaveCount(0);
  await admin.getByRole('spinbutton', { name: `Đặt mua ${s.paper.name}` }).fill('4');
  await axe390(admin, info);
  await snap(admin, info, 'p3-report');

  const downloading = admin.waitForEvent('download');
  await admin.getByRole('button', { name: 'Xuất Excel' }).click();
  await confirmPendingIfAny(admin, request, s.prevYm);
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${s.prevYm}.xlsx`);
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Tổng theo món', 'Chi tiết']);
  const sheet = wb.worksheets[0];
  const row = sheet.getRows(1, sheet.rowCount)!.find((r) => r.getCell(1).value === s.paper.name)!;
  expect([row.getCell(6).value, row.getCell(7).value]).toEqual([2, 4]);
  const detail = wb.worksheets[1];
  const owed = detail.getRows(1, detail.rowCount)!.find((r) => r.getCell(2).value === s.b.name);
  expect([owed?.getCell(3).value, owed?.getCell(4).value]).toEqual([s.clip.name, 3]);

  await admin.getByRole('button', { name: 'In trình ký' }).click();
  await confirmPendingIfAny(admin, request, s.prevYm);
  await expect(admin).toHaveURL(/\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print$/);
  const snapshotId = admin.url().split('/').at(-2)!;
  await expectFrozenPaper(admin, s);
  await expect(admin.getByText(/^Lập lúc \d{2}:\d{2} \d{2}\/\d{2}\/\d{4} bởi .+/)).toBeVisible();
  const signs = admin.getByRole('group', { name: 'Chữ ký' });
  await expect(signs.getByRole('group', { name: 'Người lập' })).toHaveText(`Người lập${s.signers.preparer}`);
  await expect(signs.getByRole('group', { name: 'Trưởng phòng' })).toHaveText(`Trưởng phòng${s.signers.head}`);
  await expect(signs.getByRole('group', { name: 'Duyệt' })).toHaveText(`Duyệt${s.signers.approver}`);
  await snap(admin, info, 'p3-print');
  return snapshotId;
}

// Đăng ký 2 (phần còn lại) · Nợ kỳ trước 0 · Tồn 0 · Cần mua 2 · Đặt mua 4
async function expectFrozenPaper(admin: Page, s: MonthSeed) {
  const row = admin.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row', { name: new RegExp(s.paper.name) });
  await expect(row).toBeVisible();
  expect((await row.getByRole('cell').allTextContents()).slice(2)).toEqual(['2', '0', '0', '2', '4']);
}

async function purchaseAndDeliverMore(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/stock');
  await admin.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(s.paper.name);
  await admin.getByRole('row').filter({ hasText: s.paper.name }).getByRole('button', { name: 'Nhập mua…' }).click();
  const purchase = admin.getByRole('dialog', { name: `Nhập mua · ${s.paper.name}` });
  await purchase.getByLabel('Số lượng').fill('2');
  await purchase.getByRole('button', { name: 'Nhập kho' }).click();
  await expect(purchase).toBeHidden();

  await admin.goto('/admin/backlog');
  const group = admin.getByRole('region', { name: s.paper.name });
  await group.getByRole('listitem').filter({ hasText: s.a.name }).getByRole('button', { name: 'Giao bổ sung…' }).click();
  const dialog = admin.getByRole('dialog', { name: `Giao bổ sung ${s.paper.name} cho ${s.a.name}` });
  await expect(dialog.getByLabel('Số lượng giao')).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Giao', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(group).toHaveCount(0);
  // PRD §10 mục 5: tổng trừ kho đúng 5 qua ba lần giao
  expect(deliveryMovements(s.paper.id)).toBe('-3,-2');
  expect(Number(psql(`SELECT stock_qty FROM items WHERE id = '${s.paper.id}'`))).toBe(0);
  await snap(admin, info, 'p3-backlog-after-purchase');
}

async function openBell(member: Page, text: string) {
  await member.getByRole('banner').getByRole('button', { name: /^Thông báo, [1-9]\d* chưa đọc$/ }).click();
  const item = member.getByRole('dialog', { name: 'Thông báo' }).getByRole('button', { name: new RegExp(text.replace(/[()]/g, '\\$&')) });
  await expect(item).toBeVisible();
  return item;
}

async function memberSeesDelivered(member: Page, info: TestInfo, s: MonthSeed) {
  await member.goto('/');
  const item = await openBell(member, `Phiếu tháng ${month(s.prevYm)} của bạn đã được giao đủ.`);
  await axe390(member, info);
  await item.click();
  await expect(member).toHaveURL(new RegExp(`/history/${s.prevYm}$`));
}

async function reopenSnapshot(admin: Page, s: MonthSeed, snapshotId: string) {
  await admin.goto(`/admin/reports?ym=${s.ym}`);
  await expect(needCell(reportRow(admin, s.paper.name))).toHaveText('3');
  await admin.goto(`/admin/reports?ym=${s.prevYm}`);
  // Kỳ trước đã giao đủ A4 → không còn dòng A4 (Cần mua 0) trong báo cáo sống
  await expect(reportRow(admin, s.paper.name)).toHaveCount(0);
  await expect(needCell(reportRow(admin, s.clip.name))).toHaveText('3');
  const printed = admin.getByRole('region', { name: 'Bản chốt' }).getByRole('row').filter({ hasText: 'Bản in' }).first();
  await printed.getByRole('button', { name: /^In lại bản chốt/ }).click();
  await expect(admin).toHaveURL(new RegExp(`/snapshots/${snapshotId}/print$`));
  await expectFrozenPaper(admin, s);
}

async function cancelClip(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/backlog');
  const group = admin.getByRole('region', { name: s.clip.name });
  await group.getByRole('listitem').filter({ hasText: s.b.name }).getByRole('button', { name: 'Hủy nợ…' }).click();
  const dialog = admin.getByRole('dialog', { name: `Hủy 3 cái còn lại của ${s.b.name}?` });
  await dialog.getByLabel('Lý do hủy nợ').fill('Không mua được');
  await axe390(admin, info);
  await dialog.getByRole('button', { name: 'Hủy nợ', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(group).toHaveCount(0);
}

async function memberSeesCancelled(member: Page, info: TestInfo, s: MonthSeed) {
  await member.goto(`/history/${s.prevYm}`);
  await expect(member.getByText(/^đã hủy 3 — Không mua được$/i)).toBeVisible();
  await openBell(member, `Hành chính hủy phần còn nợ 3 cái ${s.clip.name} (tháng ${month(s.prevYm)}): Không mua được`);
  await axe390(member, info);
  await snap(member, info, 'p3-member-b');
}

test.describe('P3 vòng tháng', () => {
  test('P3 vòng tháng: giao (bấm đúp, giao tất cả) → Còn nợ → Báo cáo, Excel, in trình ký → nhập mua, giao bổ sung, chuông giao đủ → mở lại bản chốt số cũ → hủy nợ, chuông hủy', async ({
    browser,
    request,
  }, info) => {
    test.setTimeout(180_000);
    const releases = [await acquireLock('prev-period'), await acquireLock('admin-config')];
    const since = new Date().toISOString();
    const file = `test-results/downloads/p3-${info.project.name}.xlsx`;
    mkdirSync('test-results/downloads', { recursive: true });
    let seed: MonthSeed | undefined;
    const pages: Page[] = [];
    const open = async (who?: Person) => {
      const p = who ? await newPage(browser, info, who.headers) : await adminPage(browser, info);
      pages.push(p);
      return p;
    };
    try {
      seed = await seedMonth(request, info);
      const admin = await open();
      await deliver(admin, info, seed);
      await backlogByItem(admin, info, seed);
      const snapshotId = await reportAndSnapshot(admin, info, seed, request, file);
      await purchaseAndDeliverMore(admin, info, seed);
      await memberSeesDelivered(await open(seed.a), info, seed);
      await reopenSnapshot(admin, seed, snapshotId);
      await cancelClip(admin, info, seed);
      expect(psql(`SELECT cancelled_qty || '|' || cancel_note FROM request_lines WHERE item_id = '${seed.clip.id}'`)).toBe('3|Không mua được');
      await memberSeesCancelled(await open(seed.b), info, seed);
    } finally {
      for (const p of pages) await p.context().close();
      rmSync(file, { force: true });
      await seed?.cleanup(since);
      releases.forEach((r) => r());
    }
  });
});
