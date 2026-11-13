import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, pendingConfirm } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';
import { openCopies, openEditable, previewAndPrint } from './report-send-flow';

const SHOTS = '../.superpowers/sdd/2026-10-30-giao-dien-hanh-chinh/task-16-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const snapshotCount = (ym: string) => Number(psql(`SELECT count(*) FROM report_snapshots WHERE period_ym = '${ym}-01'`));

const PRINT_URL = /\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print$/;
const FORM = 'Phiếu đề xuất văn phòng phẩm';

// Báo cáo chỉ đọc: bản chốt tạo qua api (như Gửi ADM gửi), rồi mở trang in riêng của bản đó
async function printSnapshot(page: Page, request: APIRequestContext, ym: string, order: Record<string, number>) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  const keyOf = (name: string) => [...report.byItem, ...report.custom].find((r: { name: string }) => r.name === name).key as string;
  const order_qty = Object.fromEntries(Object.entries(order).map(([name, qty]) => [keyOf(name), qty]));
  const made = await request.post(`/api/admin/reports/${ym}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print', order_qty, ...(await pendingConfirm(request, ym)) } });
  expect(made.ok()).toBe(true);
  const { id } = (await made.json()) as { id: string };
  await page.goto(`/admin/reports/snapshots/${id}/print`);
  return id;
}

type SignBox = { title: string; title_en: string; name: string };

// Hộp in thật không điều khiển được: thay window.print như Chrome (beforeprint rồi afterprint nếu __after),
// ghi lại lúc gọi có tờ trình ký trong vùng in ngoài shell và luật @page hay không
type PrintCall = { sheet: boolean; pageRule: string | null };
type PrintSpy = { __prints: PrintCall[]; __after: boolean };
function spyPrint() {
  const w = window as unknown as PrintSpy;
  w.__prints = [];
  w.__after = true;
  window.print = () => {
    w.__prints.push({ sheet: !!document.querySelector('body > [data-print-portal] h1'), pageRule: document.head.querySelector('style[data-print-page]')?.textContent ?? null });
    window.dispatchEvent(new Event('beforeprint'));
    if (w.__after) window.dispatchEvent(new Event('afterprint'));
  };
}
const printsOf = (page: Page) => page.evaluate(() => (window as unknown as PrintSpy).__prints);
const leftovers = (page: Page) => page.evaluate(() => ({ region: !!document.querySelector('[data-print-portal]'), pageRule: !!document.head.querySelector('style[data-print-page]') }));
const PAGE_RULE = '@page { size: A4 portrait; margin: 14mm 14mm 16mm; }';
const TIP = "Trong hộp in: chọn máy in, khổ A4; tắt 'Đầu trang và chân trang'.";

asRole('admin');

test.describe('E5-S3 E9-S4 trang in từ bản chốt (kỳ trước đã khóa, dev-identity admin)', () => {
  // Kỳ riêng của PW: bản chốt chỉ có món PW và không thay bản đã gửi của kỳ trước thật trên dev
  let run: { releases: (() => void)[]; seed?: Seed; boxes?: SignBox[] };
  test.beforeEach(async () => {
    run = { releases: [await acquireLock('prev-period'), await acquireLock('admin-config')] };
  });
  test.afterEach(async ({ request }) => {
    if (run.boxes) await request.put('/api/admin/config', { headers: devHeaders('admin'), data: { signature_boxes: run.boxes } });
    clearPrivateSnapshots();
    run.seed?.cleanup();
    run.releases.forEach((r) => r());
  });

  const setBoxes = async (request: APIRequestContext, signature_boxes: SignBox[]) => {
    run.boxes ??= (await (await request.get('/api/admin/config', { headers: devHeaders('admin') })).json()).signature_boxes;
    expect((await request.put('/api/admin/config', { headers: devHeaders('admin'), data: { signature_boxes } })).ok()).toBe(true);
  };


  const formTable = (page: Page) => page.getByRole('region', { name: FORM }).getByRole('table');

  test('E5-S3 E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới', async ({ page, request }, info) => {
    clearPrivateSnapshots();
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }], { ym: PRIVATE_YM }));
    const [a] = seed.items;
    const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
    const before = snapshotCount(seed.prevYm);
    const head = `PW Chủ quản ${seed.tag}`;
    await setBoxes(request, [
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: head },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
    ]);

    const snapshotId = await printSnapshot(page, request, PRIVATE_YM, { [a.name]: 9 });
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await expect(page.getByRole('heading', { level: 1, name: FORM })).toBeVisible();
    await expect(formTable(page).getByRole('row', { name: new RegExp(a.name) }).getByRole('cell').last()).toHaveText('9');
    // Tờ 210mm co theo khung ở 390: không cuộn ngang (trang bị phóng thì thanh công cụ lệch, không bấm được)
    // (điện thoại nới khung bố cục theo nội dung nên so với bề rộng màn hình, không với innerWidth)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'không cuộn ngang').toBeLessThanOrEqual(page.viewportSize()!.width);

    // Bản in chỉ có Phiếu đề xuất (phụ lục chỉ còn trong Excel): không còn công tắc "In kèm phụ lục"
    await expect(page.getByRole('checkbox', { name: 'In kèm phụ lục' })).toHaveCount(0);
    const frozenRow = () => formTable(page).getByRole('row', { name: new RegExp(a.name) });
    // Đề nghị đã chốt 9 không đổi sau giao thêm
    const numbers = async () => (await frozenRow().getByRole('cell').allTextContents()).slice(-1);
    const frozen = ['9'];
    expect(await numbers()).toEqual(frozen);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'print-screen');

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' })).toBeHidden();
    const signs = page.getByRole('group', { name: 'Chữ ký' });
    await expect(signs.getByRole('group')).toHaveCount(2);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const box = (label: string) => signs.getByRole('group', { name: label });
    await expect(box('Chủ quản đơn vị')).toHaveText(`Chủ quản đơn vịHead of Dept.${head}`);
    await expect(box('Người yêu cầu')).toHaveText('Người yêu cầuApplicant');
    const clipped = await page
      .locator('.pp-sheet th, .pp-sheet td, .pp-sign__name')
      .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent?.slice(0, 40)));
    expect(clipped).toEqual([]);
    expect(await formTable(page).locator('thead').evaluate((el) => getComputedStyle(el).display)).toBe('table-header-group');
    expect(await frozenRow().evaluate((el) => getComputedStyle(el).breakInside)).toBe('avoid');
    const pdfPath = `${SHOTS}/print-${info.project.name}.pdf`;
    const pdf = await page.pdf({ format: 'A4', path: pdfPath, preferCSSPageSize: true });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    // A4 dọc = 595 × 842 pt
    const media = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
    expect(Number(media?.[1])).toBeCloseTo(595.28, 0);
    expect(Number(media?.[2])).toBeCloseTo(841.89, 0);
    expect(readFileSync(pdfPath).length).toBeGreaterThan(1000);
    await page.emulateMedia({ media: 'screen' });

    const delivered = await request.post(`/api/admin/lines/${lineId}/deliver`, { headers: devHeaders('admin'), data: { qty: 2, expected_delivered_qty: 0 } });
    expect(delivered.ok()).toBe(true);
    await setBoxes(request, [{ title: 'PW Đổi sau', title_en: '', name: 'PW Đổi sau' }]);
    await page.goto(`/admin/reports?ym=${seed.prevYm}`);
    const reprint = (await openCopies(page)).getByRole('link', { name: /^In lại bản lập/ }).first();
    await expect(reprint).toHaveAttribute('href', `/admin/reports/snapshots/${snapshotId}/print`);
    // In lại: trang in riêng cùng tab, không tự mở hộp in
    await reprint.click();
    await expect(page).toHaveURL(PRINT_URL);
    await expect(frozenRow()).toBeVisible();
    expect(await numbers()).toEqual(frozen);
    await expect(page.getByRole('group', { name: 'Chủ quản đơn vị' })).toHaveText(`Chủ quản đơn vịHead of Dept.${head}`);
    await expect(page.getByRole('group', { name: 'Người yêu cầu' })).toHaveText('Người yêu cầuApplicant');
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await snap(page, info, 'print-reopened');
    await page.getByRole('link', { name: 'Quay lại' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/reports\\?ym=${PRIVATE_YM}$`));
  });

  test('E9-S4 Phiếu đề xuất D&E: mọi hàng của bản theo Đề nghị, 2 ô ký đầu của cấu hình, không còn phụ lục trên bản in', async ({ page, request }, info) => {
    // A tổng cần 5 nhưng đề nghị 1 → in 1; B tủ 10 vẫn đề nghị mặc định = đăng ký 1 (tủ không trừ) → in 1
    clearPrivateSnapshots();
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }, { stock: 10, qty: 1 }], { ym: PRIVATE_YM }));
    const [a, b] = seed.items;
    const code = `PW${seed.tag}`.slice(0, 40);
    psql(`UPDATE items SET code = '${code}', name_en = 'PW pen ${seed.tag}' WHERE id = '${a.id}'`);
    const unit = psql(`SELECT u.name FROM items i JOIN units u ON u.code = i.unit WHERE i.id = '${a.id}'`);
    const boxes = [
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: `PW Trưởng ${seed.tag}` },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
      { title: 'Duyệt', title_en: 'Approved', name: `PW Duyệt ${seed.tag}` },
    ];
    await setBoxes(request, boxes);

    await printSnapshot(page, request, PRIVATE_YM, { [a.name]: 1 });
    const rowA = formTable(page).getByRole('row', { name: new RegExp(a.name) });
    await expect(rowA).toBeVisible();
    expect((await rowA.getByRole('cell').allTextContents()).slice(1)).toEqual([code, a.name, `PW pen ${seed.tag}`, unit, '1']);
    const rowB = formTable(page).getByRole('row', { name: new RegExp(b.name) });
    await expect(rowB).toBeVisible();
    await expect(rowB.getByRole('cell').last()).toHaveText('1');
    // Mã dài không bẻ dòng: ở 360/390 tờ giữ bề rộng tối thiểu và cuộn ngang trong khung riêng —
    // trang không cuộn ngang, bảng không lòi khỏi tờ (rà soát 13/11 #4)
    const fit = await page.evaluate(() => {
      const sheet = document.querySelector('.pp-sheet')!.getBoundingClientRect();
      const table = document.querySelector('.pp-sheet table')!.getBoundingClientRect();
      return { pageWidth: document.documentElement.scrollWidth, tableInSheet: table.left >= sheet.left - 1 && table.right <= sheet.right + 1 };
    });
    expect(fit.pageWidth, 'trang không cuộn ngang').toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(fit.tableInSheet, 'bảng nằm trong tờ').toBe(true);
    const signs = page.getByRole('group', { name: 'Chữ ký' }).getByRole('group');
    // Cấu hình 3 ô có "Duyệt" → tờ in chỉ 2 ô đầu (vòng 4 mục 11)
    await expect(signs).toHaveCount(2);
    expect(await signs.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    await expect(page.getByRole('group', { name: 'Chữ ký' })).not.toContainText('Duyệt');
    await expect(page.getByRole('region', { name: /^Phụ lục/ })).toHaveCount(0);

    psql(`UPDATE items SET name = name || ' đổi', code = NULL WHERE id = '${a.id}'`);
    await page.reload();
    await expect(rowA.getByRole('cell').nth(1)).toHaveText(code);
    await expect(rowA.getByRole('cell').nth(2)).toHaveText(a.name);

    // Link cũ ?appendix=1 vẫn mở được, bị bỏ qua
    await page.goto(`${page.url()}?appendix=1`);
    await expect(rowB).toBeVisible();
    await expect(page.getByRole('region', { name: /^Phụ lục/ })).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'print-form');
  });

  test('V2D-19 print in place', async ({ page, request, context }, info) => {
    clearPrivateSnapshots();
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 4 }], { ym: PRIVATE_YM }));
    const [a] = seed.items;
    await openOnPrivatePeriod(page);
    await page.addInitScript(spyPrint);
    const tabs: Page[] = [];
    context.on('page', (p) => tabs.push(p));
    await page.goto('/admin/reports');
    await openEditable(page);
    // Vòng 4 mục 9: bỏ dòng hướng dẫn hộp in / "Không in kèm phụ lục"
    await expect(page.getByText(TIP)).toHaveCount(0);
    await expect(page.getByText('Không in kèm phụ lục')).toHaveCount(0);

    // Lập phiếu: chốt bản rồi mở hộp in ngay tại trang — 1 lần print, URL không đổi, 0 tab mới
    await previewAndPrint(page);
    await expect.poll(() => printsOf(page)).toEqual([{ sheet: true, pageRule: PAGE_RULE }]);
    await expect(page).toHaveURL(/\/admin\/reports/);
    expect(tabs).toEqual([]);
    expect(snapshotCount(PRIVATE_YM)).toBe(1);
    await expect(page.getByText(/^Đã chốt bản \d\d:\d\d \d\d\/\d\d\. Cần in lại: mở Bản chốt\.$/)).toBeVisible();
    expect(await leftovers(page)).toEqual({ region: false, pageRule: false });

    // Đã gửi: In lại in từ bản có sẵn, không tạo bản mới; hộp in không đóng (không afterprint) → vùng in còn
    await page.evaluate(() => void ((window as unknown as PrintSpy).__after = false));
    await page.getByRole('button', { name: 'In lại' }).click();
    await expect.poll(async () => (await printsOf(page)).length).toBe(2);
    expect(snapshotCount(PRIVATE_YM)).toBe(1);
    expect(await leftovers(page)).toEqual({ region: true, pageRule: true });
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('heading', { level: 1, name: FORM })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /^Báo cáo & gửi ADM/ })).toBeHidden();
    await expect(page.getByRole('button', { name: 'In lại' })).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(a.name) }).getByRole('cell').last()).toHaveText('4');
    await page.emulateMedia({ media: 'screen' });
    expect(await leftovers(page)).toEqual({ region: true, pageRule: true });

    // Rời trang trong app mà không có afterprint → vùng in và @page vẫn được gỡ
    await page.evaluate(() => {
      history.pushState({}, '', '/admin/month');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/admin\/month/);
    await expect.poll(() => leftovers(page)).toEqual({ region: false, pageRule: false });

    // Khổ giấy: in lại lần nữa rồi xuất PDF theo @page (page.pdf tự phát beforeprint/afterprint → vùng in gỡ sau đó)
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await page.getByRole('button', { name: 'In lại' }).click();
    await expect.poll(async () => (await printsOf(page)).length).toBe(3);
    expect(snapshotCount(PRIVATE_YM)).toBe(1);
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    const media = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf);
    expect(Number(media?.[1])).toBeCloseTo(595.28, 0);
    expect(Number(media?.[2])).toBeCloseTo(841.89, 0);
    await expect.poll(() => leftovers(page)).toEqual({ region: false, pageRule: false });
    if (isMobile(info)) await expectNoContrastViolations(page);
  });

  test('E5-S3 id không có bản chốt → trang không tìm thấy', async ({ page }) => {
    await page.goto('/admin/reports/snapshots/00000000-0000-4000-8000-000000000000/print');
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });
});
