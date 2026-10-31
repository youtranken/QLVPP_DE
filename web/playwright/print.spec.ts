import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, urlOfNewTab } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-14-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const snapshotCount = (ym: string) => Number(psql(`SELECT count(*) FROM report_snapshots WHERE period_ym = '${ym}-01'`));

async function confirmPendingIfAny(page: Page, request: APIRequestContext, ym: string) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0) return;
  await page.getByRole('dialog', { name: /^Còn \d+ món ngoài danh mục chưa xem$/ }).getByRole('button', { name: 'Vẫn chốt' }).click();
}

const PRINT_URL = /\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print$/;

type SignBox = { title: string; title_en: string; name: string };

asRole('admin');

test.describe('E5-S3 trang in từ bản chốt (kỳ trước đã khóa, dev-identity admin)', () => {
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

  test('E5-S3 trang in: số đã chốt không đổi khi giao thêm, "In lại" không tạo bản mới, PDF A4 lặp tiêu đề bảng', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
    const before = snapshotCount(seed.prevYm);
    const setBoxes = async (signature_boxes: SignBox[]) =>
      expect((await request.put('/api/admin/config', { headers: devHeaders('admin'), data: { signature_boxes } })).ok()).toBe(true);
    run.boxes = (await (await request.get('/api/admin/config', { headers: devHeaders('admin') })).json()).signature_boxes;
    const head = `PW Chủ quản ${seed.tag}`;
    await setBoxes([
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: head },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
    ]);

    await page.goto('/admin/reports');
    await page.getByRole('textbox', { name: `Đặt mua ${a.name}` }).fill('9');
    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmPendingIfAny(page, request, seed.prevYm);
    await page.goto(await urlOfNewTab(page, PRINT_URL, () => page.getByRole('button', { name: 'Mở bản in' }).click(), devHeaders('admin')));
    const snapshotId = page.url().split('/').at(-2)!;
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);

    const month = Number(seed.prevYm.slice(5, 7));
    await expect(page.getByRole('heading', { level: 1, name: `Báo cáo văn phòng phẩm tháng ${month}/${seed.prevYm.slice(0, 4)}` })).toBeVisible();
    const frozenRow = () => page.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' }).getByRole('row', { name: new RegExp(a.name) });
    const numbers = async () => (await frozenRow().getByRole('cell').allTextContents()).slice(2);
    // Đăng ký 5 · Nợ kỳ trước 0 · Tồn 2 · Cần mua 3 · Đặt mua 9
    const frozen = ['5', '0', '2', '3', '9'];
    expect(await numbers()).toEqual(frozen);
    await expect(page.getByText(/^Lập lúc \d{2}:\d{2} \d{2}\/\d{2}\/\d{4} bởi /)).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await snap(page, info, 'print-screen');

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'In', exact: true })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Quay lại Báo cáo' })).toBeHidden();
    const signs = page.getByRole('group', { name: 'Chữ ký' });
    await expect(signs.getByRole('group')).toHaveCount(2);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const box = (label: string) => signs.getByRole('group', { name: label });
    await expect(box('Chủ quản đơn vị')).toHaveText(`Chủ quản đơn vịHead of Dept.${head}`);
    await expect(box('Người yêu cầu')).toHaveText('Người yêu cầuApplicant');
    const clipped = await page
      .locator('.pr-sheet th, .pr-sheet td, .pr-sheet .pr-sign-name')
      .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent?.slice(0, 40)));
    expect(clipped).toEqual([]);
    const headDisplay = await page.locator('thead').first().evaluate((el) => getComputedStyle(el).display);
    expect(headDisplay).toBe('table-header-group');
    expect(await frozenRow().evaluate((el) => getComputedStyle(el).breakInside)).toBe('avoid');
    const pdfPath = `${SHOTS}/print-${info.project.name}.pdf`;
    const pdf = await page.pdf({ format: 'A4', path: pdfPath, preferCSSPageSize: true });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toMatch(/\/Type\s*\/Page[^s]/);
    // A4 dọc = 595 × 842 pt
    const media = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
    expect(Number(media?.[1])).toBeCloseTo(595.28, 0);
    expect(Number(media?.[2])).toBeCloseTo(841.89, 0);
    expect(readFileSync(pdfPath).length).toBeGreaterThan(1000);
    await page.emulateMedia({ media: 'screen' });

    const delivered = await request.post(`/api/admin/lines/${lineId}/deliver`, { headers: devHeaders('admin'), data: { qty: 2, expected_delivered_qty: 0 } });
    expect(delivered.ok()).toBe(true);
    await setBoxes([{ title: 'PW Đổi sau', title_en: '', name: 'PW Đổi sau' }]);
    await page.goto(`/admin/reports?ym=${seed.prevYm}`);
    const list = page.getByRole('region', { name: 'Bản chốt' });
    const reprint = list.getByRole('link', { name: /^In lại bản lập/ }).first();
    await expect(reprint).toHaveAttribute('href', `/admin/reports/snapshots/${snapshotId}/print`);
    await page.goto(await urlOfNewTab(page, PRINT_URL, () => reprint.click(), devHeaders('admin')));
    await expect(frozenRow()).toBeVisible();
    expect(await numbers()).toEqual(frozen);
    await expect(page.getByRole('group', { name: 'Chủ quản đơn vị' })).toHaveText(`Chủ quản đơn vịHead of Dept.${head}`);
    await expect(page.getByRole('group', { name: 'Người yêu cầu' })).toHaveText('Người yêu cầuApplicant');
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await snap(page, info, 'print-reopened');
  });

  test('E5-S3 id không có bản chốt → trang không tìm thấy', async ({ page }) => {
    await page.goto('/admin/reports/snapshots/00000000-0000-4000-8000-000000000000/print');
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });
});
