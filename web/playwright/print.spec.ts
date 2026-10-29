import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
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
  await page.getByRole('dialog', { name: 'Còn món ngoài danh mục chưa xem' }).getByRole('button', { name: 'Vẫn chốt' }).click();
}

asRole('admin');

test.describe('E5-S3 trang in từ bản chốt (kỳ trước đã khóa, dev-identity admin)', () => {
  let run: { release: () => void; since: string; seed?: Seed };
  test.beforeEach(async () => {
    run = { release: await acquireLock('prev-period'), since: new Date().toISOString() };
  });
  test.afterEach(() => {
    if (run.seed) {
      psql(`DELETE FROM report_snapshots WHERE period_ym = '${run.seed.prevYm}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${run.since}'`);
      run.seed.cleanup();
    }
    run.release();
  });

  test('E5-S3 trang in: số đã chốt không đổi khi giao thêm, "In lại" không tạo bản mới, PDF A4 lặp tiêu đề bảng', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 2, qty: 5 }]));
    const [a] = seed.items;
    const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
    const before = snapshotCount(seed.prevYm);

    await page.goto('/admin/reports');
    await page.getByRole('spinbutton', { name: `Đặt mua ${a.name}` }).fill('9');
    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmPendingIfAny(page, request, seed.prevYm);
    await expect(page).toHaveURL(/\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print$/);
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
    for (const label of ['Người lập', 'Trưởng phòng', 'Duyệt']) await expect(signs.getByRole('group', { name: label })).toBeVisible();
    const signers = JSON.parse(psql(`SELECT data->'signers' FROM report_snapshots WHERE id = '${snapshotId}'`)) as Record<string, string>;
    for (const name of Object.values(signers).filter(Boolean)) await expect(signs.getByText(name)).toBeVisible();
    const headDisplay = await page.locator('thead').first().evaluate((el) => getComputedStyle(el).display);
    expect(headDisplay).toBe('table-header-group');
    expect(await frozenRow().evaluate((el) => getComputedStyle(el).breakInside)).toBe('avoid');
    const pdfPath = `${SHOTS}/print-${info.project.name}.pdf`;
    const pdf = await page.pdf({ format: 'A4', path: pdfPath, preferCSSPageSize: true });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toMatch(/\/Type\s*\/Page[^s]/);
    // A4 dọc = 595 × 842 pt
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
    expect(Number(box?.[1])).toBeCloseTo(595.28, 0);
    expect(Number(box?.[2])).toBeCloseTo(841.89, 0);
    expect(readFileSync(pdfPath).length).toBeGreaterThan(1000);
    await page.emulateMedia({ media: 'screen' });

    const delivered = await request.post(`/api/admin/lines/${lineId}/deliver`, { headers: devHeaders('admin'), data: { qty: 2, expected_delivered_qty: 0 } });
    expect(delivered.ok()).toBe(true);
    await page.goto(`/admin/reports?ym=${seed.prevYm}`);
    const list = page.getByRole('region', { name: 'Bản chốt' });
    await list.getByRole('button', { name: /^In lại bản chốt/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/snapshots/${snapshotId}/print$`));
    await expect(frozenRow()).toBeVisible();
    expect(await numbers()).toEqual(frozen);
    expect(snapshotCount(seed.prevYm)).toBe(before + 1);
    await snap(page, info, 'print-reopened');
  });

  test('E5-S3 id không có bản chốt → trang không tìm thấy', async ({ page }) => {
    await page.goto('/admin/reports/snapshots/00000000-0000-4000-8000-000000000000/print');
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });
});
