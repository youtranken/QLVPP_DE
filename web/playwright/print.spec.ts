import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, urlOfNewTab } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

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
async function printSnapshot(page: Page, request: APIRequestContext, seed: Seed, order: Record<string, number>) {
  const report = await (await request.get(`/api/admin/reports/${seed.prevYm}`, { headers: devHeaders('admin') })).json();
  const keyOf = (name: string) => [...report.byItem, ...report.custom].find((r: { name: string }) => r.name === name).key as string;
  const order_qty = Object.fromEntries(Object.entries(order).map(([name, qty]) => [keyOf(name), qty]));
  const made = await request.post(`/api/admin/reports/${seed.prevYm}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print', order_qty } });
  expect(made.ok()).toBe(true);
  const { id } = (await made.json()) as { id: string };
  await page.goto(`/admin/reports/snapshots/${id}/print`);
  return id;
}

type SignBox = { title: string; title_en: string; name: string };

asRole('admin');

test.describe('E5-S3 E9-S4 trang in từ bản chốt (kỳ trước đã khóa, dev-identity admin)', () => {
  let run: { releases: (() => void)[]; since: string; seed?: Seed; boxes?: SignBox[] };
  test.beforeEach(async () => {
    run = { releases: [await acquireLock('prev-period'), await acquireLock('admin-config')], since: new Date().toISOString() };
  });
  test.afterEach(async ({ request }) => {
    if (run.boxes) await request.put('/api/admin/config', { headers: devHeaders('admin'), data: { signature_boxes: run.boxes } });
    if (run.seed) {
      psql(`DELETE FROM report_snapshots WHERE period_ym = '${run.seed.prevYm}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${run.since}'`);
      run.seed.cleanup();
    }
    run.releases.forEach((r) => r());
  });

  const setBoxes = async (request: APIRequestContext, signature_boxes: SignBox[]) => {
    run.boxes ??= (await (await request.get('/api/admin/config', { headers: devHeaders('admin') })).json()).signature_boxes;
    expect((await request.put('/api/admin/config', { headers: devHeaders('admin'), data: { signature_boxes } })).ok()).toBe(true);
  };


  const formTable = (page: Page) => page.getByRole('region', { name: FORM }).getByRole('table');
  const appendix = (page: Page) => page.getByRole('region', { name: /^Phụ lục · Chi tiết tháng / });

  test('E5-S3 E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
    const before = snapshotCount(seed.prevYm);
    const head = `PW Chủ quản ${seed.tag}`;
    await setBoxes(request, [
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: head },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
    ]);

    const snapshotId = await printSnapshot(page, request, seed, { [a.name]: 9 });
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await expect(page.getByRole('heading', { level: 1, name: FORM })).toBeVisible();
    await expect(formTable(page).getByRole('row', { name: new RegExp(a.name) }).getByRole('cell').last()).toHaveText('9');

    await page.getByRole('checkbox', { name: 'In kèm phụ lục' }).click();
    await expect(page.getByRole('checkbox', { name: 'In kèm phụ lục' })).toBeChecked();
    await expect(page).toHaveURL(/\?appendix=1$/);
    const frozenRow = () => appendix(page).getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row', { name: new RegExp(a.name) });
    const numbers = async () => (await frozenRow().getByRole('cell').allTextContents()).slice(3, 8);
    // Chưa giao 5 · Nợ kỳ trước 0 · Tồn 2 · Tổng cần 5 (không trừ tủ) · Đề nghị 9
    const frozen = ['5', '0', '2', '5', '9'];
    expect(await numbers()).toEqual(frozen);
    await expect(appendix(page).getByText(/^Lập lúc \d{2}:\d{2} ngày \d{2}\/\d{2}\/\d{4} bởi /)).toBeVisible();
    await expect(appendix(page).getByText(`Bản chốt số ${before + 1} của kỳ`)).toBeVisible();
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
    expect(await appendix(page).evaluate((el) => getComputedStyle(el).breakBefore)).toBe('page');
    const pdfPath = `${SHOTS}/print-${info.project.name}.pdf`;
    const pdf = await page.pdf({ format: 'A4', path: pdfPath, preferCSSPageSize: true });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
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
    const reprint = page.getByRole('region', { name: 'Bản chốt' }).getByRole('link', { name: /^In lại bản lập/ }).first();
    await expect(reprint).toHaveAttribute('href', `/admin/reports/snapshots/${snapshotId}/print`);
    await page.goto(`${await urlOfNewTab(page, PRINT_URL, () => reprint.click(), devHeaders('admin'))}?appendix=1`);
    await expect(frozenRow()).toBeVisible();
    expect(await numbers()).toEqual(frozen);
    await expect(page.getByRole('group', { name: 'Chủ quản đơn vị' })).toHaveText(`Chủ quản đơn vịHead of Dept.${head}`);
    await expect(page.getByRole('group', { name: 'Người yêu cầu' })).toHaveText('Người yêu cầuApplicant');
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await snap(page, info, 'print-reopened');
  });

  test('E9-S4 Phiếu đề xuất D&E: mọi hàng của bản theo Đề nghị, ô ký theo cấu hình, bật phụ lục', async ({ page, request }, info) => {
    // A tổng cần 5 nhưng đề nghị 1 → in 1; B tủ 10 vẫn đề nghị mặc định = đăng ký 1 (tủ không trừ) → in 1
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }, { stock: 10, qty: 1 }]));
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

    await printSnapshot(page, request, seed, { [a.name]: 1 });
    const rowA = formTable(page).getByRole('row', { name: new RegExp(a.name) });
    await expect(rowA).toBeVisible();
    expect((await rowA.getByRole('cell').allTextContents()).slice(1)).toEqual([code, a.name, `PW pen ${seed.tag}`, unit, '1']);
    const rowB = formTable(page).getByRole('row', { name: new RegExp(b.name) });
    await expect(rowB).toBeVisible();
    await expect(rowB.getByRole('cell').last()).toHaveText('1');
    const signs = page.getByRole('group', { name: 'Chữ ký' }).getByRole('group');
    await expect(signs).toHaveCount(3);
    expect(await signs.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(boxes.map((x) => x.title));
    await expect(appendix(page)).toHaveCount(0);

    psql(`UPDATE items SET name = name || ' đổi', code = NULL WHERE id = '${a.id}'`);
    await page.reload();
    await expect(rowA.getByRole('cell').nth(1)).toHaveText(code);
    await expect(rowA.getByRole('cell').nth(2)).toHaveText(a.name);

    await page.getByRole('checkbox', { name: 'In kèm phụ lục' }).click();
    await expect(page.getByRole('checkbox', { name: 'In kèm phụ lục' })).toBeChecked();
    await expect(page).toHaveURL(/\?appendix=1$/);
    await expect(appendix(page).getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row', { name: new RegExp(b.name) })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'In kèm phụ lục' })).toBeChecked();
    await expect(appendix(page)).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'print-form-appendix');
    await page.getByRole('checkbox', { name: 'In kèm phụ lục' }).click();
    await expect(page.getByRole('checkbox', { name: 'In kèm phụ lục' })).not.toBeChecked();
    await expect(appendix(page)).toHaveCount(0);
    await snap(page, info, 'print-form');
  });

  test('E5-S3 id không có bản chốt → trang không tìm thấy', async ({ page }) => {
    await page.goto('/admin/reports/snapshots/00000000-0000-4000-8000-000000000000/print');
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });
});
