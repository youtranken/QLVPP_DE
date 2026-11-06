import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, devHeaders, expectNoContrastViolations, isMobile, psql, settled, urlOfNewTab, openPurchase } from './helpers';
import { confirmIfAsked, openDraft } from './send-adm-flow';
import { deliveryMovements, seedMonth, type MonthSeed, type Person } from './p3-seed';
import { adminPage, newPage, SA_PASSWORD } from './sessions';

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

const PRINT_URL = /\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print(\?.*)?$/;
const month = (ym: string) => Number(ym.slice(5, 7));
const reportRow = (page: Page, name: string) => page.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row').filter({ hasText: name });
// Cột: Món · ĐVT · Đăng ký · Nợ tháng trước · Tủ hiện có · Tổng cần · Đề nghị · [Đã về] · [Đã giao]
const needCell = (row: Locator) => row.getByRole('cell').nth(5);
const orderCell = (row: Locator) => row.getByRole('cell').nth(6);

async function deliver(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/delivery');
  await admin.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).fill(s.a.name);
  const card = admin.getByRole('heading', { level: 3, name: s.a.name, exact: true }).locator('xpath=ancestor::article');
  await card.getByRole('button', { name: `Giao…, ${s.a.name}` }).click();
  const dialog = admin.getByRole('dialog', { name: `Giao cho ${s.a.name}?` });
  // Tủ giấy 3, cần 5: đề xuất 3 và phần thiếu còn ở Chưa nhận
  await expect(dialog.getByRole('spinbutton', { name: `Giao lần này: ${s.paper.name}` })).toHaveValue('3');
  await expect(dialog.getByText('Chưa nhận 2')).toBeVisible();
  await expect(dialog.getByRole('spinbutton', { name: `Giao lần này: ${s.custom}` })).toHaveValue('1');
  await axe390(admin, info);
  await snap(admin, info, 'p3-deliver-dialog');
  // Bấm đúp vẫn chỉ một lượt giao
  await dialog.getByRole('button', { name: 'Xác nhận giao' }).dblclick();
  await expect(admin.getByText(`Đã giao cho ${s.a.name}`)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(deliveryMovements(s.paper.id)).toBe('-3');
  expect(deliveryMovements(s.pen.id)).toBe('-2');
  // Món ngoài DM đã duyệt, chưa có bản gửi ADM: giao cùng lượt, không trừ kho
  expect(psql(`SELECT delivered_qty FROM request_lines WHERE custom_name = '${s.custom}'`)).toBe('1');
  await snap(admin, info, 'p3-delivered-all');
}

async function backlogByItem(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/backlog');
  await expect(admin.getByRole('radio', { name: 'Theo món' })).toBeChecked();
  await expect(admin.getByRole('rowheader', { name: new RegExp(s.tape.name) })).toContainText('còn 2 cái');
  await expect(admin.getByRole('rowheader', { name: new RegExp(s.glue.name) })).toContainText('còn 3 cái');
  await expect(admin.getByRole('rowheader', { name: new RegExp(s.pen.name) })).toHaveCount(0);
  // Phần thiếu của tháng đang giao (giấy 2 của A, kẹp 3 của B) là Chưa nhận, không phải nợ
  await expect(admin.getByRole('rowheader', { name: new RegExp(s.paper.name) })).toHaveCount(0);
  await expect(admin.getByRole('rowheader', { name: new RegExp(s.clip.name) })).toHaveCount(0);
  await axe390(admin, info);
  await snap(admin, info, 'p3-backlog');
}

async function reportAndSnapshot(admin: Page, info: TestInfo, s: MonthSeed, request: APIRequestContext, file: string) {
  // Báo cáo kỳ đang mở bị chặn (Hành chính chỉ làm việc trên kỳ đã khóa); cộng nợ kỳ trước vào kỳ sau kiểm ở api e2e reports
  expect((await request.get(`/api/admin/reports/${s.ym}`, { headers: devHeaders('admin') })).status()).toBe(409);
  await admin.goto(`/admin/reports?ym=${s.prevYm}`);
  // Báo cáo chỉ đọc: Tổng cần = chưa giao + nợ, không trừ tủ; sửa số ở Gửi ADM
  await expect(needCell(reportRow(admin, s.paper.name))).toHaveText('2');
  await expect(needCell(reportRow(admin, s.clip.name))).toHaveText('3');
  await expect(reportRow(admin, s.pen.name)).toHaveCount(0);
  await expect(admin.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('textbox')).toHaveCount(0);
  await axe390(admin, info);
  await snap(admin, info, 'p3-report');

  await admin.getByRole('link', { name: 'Sửa số đề nghị ở Gửi ADM →' }).click();
  await expect(admin).toHaveURL(/\/admin\/send-adm$/);
  const replacing = await openDraft(admin);
  const paper = admin.getByRole('table', { name: 'Số đề nghị theo món' }).getByRole('row').filter({ hasText: s.paper.name });
  await paper.getByRole('button', { name: 'Sửa số' }).click();
  await paper.getByRole('spinbutton').fill('4');
  await admin.getByRole('button', { name: 'In trình ký' }).click();
  await confirmIfAsked(admin, request, s.prevYm, replacing);
  await expect(admin.getByText(/^Đã gửi ADM lúc \d\d:\d\d \d\d\/\d\d · /)).toBeVisible();

  // Excel của chính bản vừa gửi, không tạo bản mới
  const downloading = admin.waitForEvent('download');
  await admin.getByRole('button', { name: 'Xuất Excel bản này' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`vpp-bao-cao-${s.prevYm}.xlsx`);
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Phiếu đề xuất', 'Phụ lục']);
  const sheet = wb.worksheets[1];
  const row = sheet.getRows(1, sheet.rowCount)!.find((r) => r.getCell(1).value === s.paper.name)!;
  expect([row.getCell(6).value, row.getCell(7).value]).toEqual([2, 4]);
  const detail = wb.worksheets[1];
  const owed = detail.getRows(1, detail.rowCount)!.find((r) => r.getCell(2).value === s.b.name);
  expect([owed?.getCell(3).value, owed?.getCell(4).value]).toEqual([s.clip.name, 3]);

  await admin.getByRole('button', { name: 'In lại bản này' }).click();
  await expect(admin).toHaveURL(PRINT_URL);
  const snapshotId = new URL(admin.url()).pathname.split('/').at(-2)!;
  await admin.getByRole('checkbox', { name: 'In kèm phụ lục' }).click();
  await expect(admin.getByRole('checkbox', { name: 'In kèm phụ lục' })).toBeChecked();
  await expectFrozenPaper(admin, s);
  await expect(admin.getByText(/^Lập lúc \d{2}:\d{2} ngày \d{2}\/\d{2}\/\d{4} bởi .+/)).toBeVisible();
  const signs = admin.getByRole('group', { name: 'Chữ ký' });
  for (const b of s.signatureBoxes) await expect(signs.getByRole('group', { name: b.title })).toHaveText(`${b.title}${b.title_en}${b.name}`);
  await snap(admin, info, 'p3-print');
  return snapshotId;
}

// Chưa giao 2 · Nợ kỳ trước 0 · Tồn 0 · Tổng cần 2 · Đề nghị 4
async function expectFrozenPaper(admin: Page, s: MonthSeed) {
  const row = admin.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row', { name: new RegExp(s.paper.name) });
  await expect(row).toBeVisible();
  expect((await row.getByRole('cell').allTextContents()).slice(3, 8)).toEqual(['2', '0', '0', '2', '4']);
}

async function purchase(admin: Page, item: { name: string }, qty: number) {
  await admin.goto('/admin/stock');
  await admin.getByRole('searchbox', { name: 'Tìm theo tên món' }).fill(item.name);
  await openPurchase(admin, admin.getByRole('row').filter({ hasText: item.name }));
  const dialog = admin.getByRole('dialog', { name: `Nhập ngoài kỳ (tự mua lẻ) ${item.name}` });
  await dialog.getByLabel('Số lượng nhập').fill(String(qty));
  await dialog.getByRole('button', { name: 'Lưu nhập mua' }).click();
  await expect(dialog).toBeHidden();
}

async function purchaseAndDeliverMore(admin: Page, info: TestInfo, s: MonthSeed) {
  await purchase(admin, s.tape, 2);

  await admin.goto('/admin/backlog');
  const group = admin.getByRole('rowheader', { name: new RegExp(s.tape.name) });
  await admin.getByRole('row').filter({ hasText: s.a.name }).getByRole('button', { name: 'Giao bổ sung' }).click();
  const dialog = admin.getByRole('dialog', { name: `Giao bổ sung ${s.tape.name} cho ${s.a.name}` });
  await expect(dialog.getByLabel('Số lượng giao')).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Giao', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(group).toHaveCount(0);
  // Giao bổ sung trừ kho đúng phần nợ; giấy tháng đang giao không bị đụng
  expect(deliveryMovements(s.tape.id)).toBe('-2');
  expect(deliveryMovements(s.paper.id)).toBe('-3');
  expect(Number(psql(`SELECT stock_qty FROM items WHERE id = '${s.tape.id}'`))).toBe(0);
  await snap(admin, info, 'p3-backlog-after-purchase');
}

// Hàng về thêm cho phần Chưa nhận của tháng đang giao: giao qua hộp, PRD §10 mục 5 — tổng trừ kho đúng 5 qua hai lần giao
async function deliverRestOfPaper(admin: Page, info: TestInfo, s: MonthSeed) {
  await purchase(admin, s.paper, 2);
  await admin.goto('/admin/delivery');
  await admin.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).fill(s.a.name);
  const card = admin.getByRole('heading', { level: 3, name: s.a.name, exact: true }).locator('xpath=ancestor::article');
  await card.getByRole('button', { name: `Giao…, ${s.a.name}` }).click();
  const dialog = admin.getByRole('dialog', { name: `Giao cho ${s.a.name}?` });
  await expect(dialog.getByRole('spinbutton', { name: `Giao lần này: ${s.paper.name}` })).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Xác nhận giao' }).click();
  await expect(admin.getByText(`Đã giao cho ${s.a.name}`)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(deliveryMovements(s.paper.id)).toBe('-3,-2');
  expect(Number(psql(`SELECT stock_qty FROM items WHERE id = '${s.paper.id}'`))).toBe(0);
  await expect(card.getByText('Chưa nhận', { exact: true })).toHaveCount(0);
  await snap(admin, info, 'p3-delivered-rest');
}

async function openBell(member: Page, text: string) {
  await member.getByRole('banner').getByRole('button', { name: /^Thông báo, [1-9]\d* chưa đọc$/ }).click();
  const item = member.getByRole('dialog', { name: 'Thông báo' }).getByRole('button', { name: new RegExp(text.replace(/[()]/g, '\\$&')) });
  await expect(item).toBeVisible();
  return item;
}

async function memberSeesDelivered(member: Page, info: TestInfo, s: MonthSeed) {
  await member.goto('/');
  const item = await openBell(member, `Phiếu tháng ${month(s.debtYm)} của bạn đã được giao đủ.`);
  await axe390(member, info);
  await item.click();
  await expect(member).toHaveURL(new RegExp(`/history/${s.debtYm}$`));
}

async function reopenSnapshot(admin: Page, s: MonthSeed, snapshotId: string) {
  await admin.goto(`/admin/reports?ym=${s.prevYm}`);
  // Kỳ đã gửi: Phần 1 theo bản đã gửi, Đề nghị 4 theo bản, Đã giao 3 sống (phần còn lại vẫn Chưa nhận)
  await expect(orderCell(reportRow(admin, s.paper.name))).toHaveText('4');
  await expect(reportRow(admin, s.paper.name).getByRole('cell').nth(8)).toHaveText('3');
  await expect(needCell(reportRow(admin, s.clip.name))).toHaveText('3');
  const printed = admin.getByRole('region', { name: 'Bản chốt' }).getByRole('listitem').filter({ hasText: 'Bản in' }).first();
  const reprint = printed.getByRole('link', { name: /^In lại bản lập/ });
  await expect(reprint).toHaveAttribute('href', `/admin/reports/snapshots/${snapshotId}/print`);
  await admin.goto(`${await urlOfNewTab(admin, PRINT_URL, () => reprint.click(), SA_PASSWORD ? undefined : devHeaders('admin'))}?appendix=1`);
  await expectFrozenPaper(admin, s);
}

async function cancelClip(admin: Page, info: TestInfo, s: MonthSeed) {
  await admin.goto('/admin/backlog');
  const group = admin.getByRole('rowheader', { name: new RegExp(s.glue.name) });
  const line = admin.getByRole('row').filter({ hasText: s.b.name });
  // "Hủy nợ" nằm trong menu ⋯ của dòng ở mọi bề rộng, không còn nút riêng
  await expect(line.getByRole('button', { name: 'Hủy nợ' })).toHaveCount(0);
  await line.getByRole('button', { name: `Thao tác khác ${s.glue.name} — ${s.b.name}` }).click();
  await admin.getByRole('menu', { name: `Thao tác khác ${s.glue.name} — ${s.b.name}` }).getByRole('menuitem', { name: 'Hủy nợ' }).click();
  const dialog = admin.getByRole('dialog', { name: `Hủy nợ 3 cái ${s.glue.name} của ${s.b.name}?` });
  await dialog.getByRole('radio', { name: 'Khác' }).check();
  await dialog.getByRole('textbox', { name: /^Ghi chú/ }).fill('Không mua được');
  await axe390(admin, info);
  await dialog.getByRole('button', { name: 'Hủy nợ', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(group).toHaveCount(0);
}

async function memberSeesCancelled(member: Page, info: TestInfo, s: MonthSeed) {
  await member.goto(`/history/${s.debtYm}`);
  await expect(member.getByText(/^đã hủy 3 — Khác: Không mua được$/i)).toBeVisible();
  await openBell(member, `Hành chính hủy phần còn nợ 3 cái ${s.glue.name} (tháng ${month(s.debtYm)}): Khác: Không mua được`);
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
      await deliverRestOfPaper(admin, info, seed);
      await cancelClip(admin, info, seed);
      expect(psql(`SELECT cancelled_qty || '|' || cancel_note FROM request_lines WHERE item_id = '${seed.glue.id}'`)).toBe('3|Khác: Không mua được');
      await memberSeesCancelled(await open(seed.b), info, seed);
    } finally {
      for (const p of pages) await p.context().close();
      rmSync(file, { force: true });
      await seed?.cleanup(since);
      releases.forEach((r) => r());
    }
  });
});
