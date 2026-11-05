import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, shot, urlOfNewTab } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

asRole('admin');

const PRINT_URL = /\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print$/;
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Kỳ seed có thể còn món chờ duyệt do dữ liệu dev: hộp hỏi hiện thì chọn "Vẫn chốt"
async function confirmPendingIfAny(page: Page, request: APIRequestContext, ym: string) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0) return;
  await page.getByRole('dialog', { name: /^Còn \d+ món ngoài danh mục chưa xem$/ }).getByRole('button', { name: 'Vẫn chốt' }).click();
}

test.describe('Gửi ADM (Plan v2-B, B5)', () => {
  let run: { release: () => void; since: string; seed?: Seed };
  test.beforeEach(async () => {
    run = { release: await acquireLock('prev-period'), since: new Date().toISOString() };
  });
  test.afterEach(() => {
    // report_snapshots có FK tới periods: xóa bản chốt của lần chạy trước khi dọn kỳ seed
    if (run.seed) psql(`DELETE FROM report_snapshots WHERE period_ym = '${run.seed.prevYm}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${run.since}'`);
    run.seed?.cleanup();
    run.release();
  });

  test('sửa 13 → 10, phiếu hiện 10, Xuất Excel tải vpp-bao-cao-<ym>.xlsx, In trình ký mở trang in có 10', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 13 }]));
    const [item] = seed.items;
    await page.goto('/admin/send-adm');
    await expect(page.getByRole('heading', { level: 1, name: `Gửi ADM, kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
    const checklist = page.getByRole('list', { name: 'Kiểm trước khi gửi' });
    await expect(checklist.getByRole('listitem').filter({ hasText: 'Đã trừ hàng trong tủ' })).toBeVisible();
    const box = page.getByRole('spinbutton', { name: `Đề nghị: ${item.name}` });
    await expect(box).toHaveValue('13');
    const sheet = page.getByRole('region', { name: /^Xem trước phiếu A4/ });
    await expect(sheet.getByRole('row').filter({ hasText: item.name })).toContainText('13');
    await box.fill('10');
    await expect(sheet.getByRole('row').filter({ hasText: item.name })).toContainText('10');
    await settled(page);
    await shot(page, info, 'send-adm');
    if (isMobile(info)) {
      await expectNoContrastViolations(page);
      expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
    }

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất Excel mẫu phòng' }).click();
    await confirmPendingIfAny(page, request, seed.prevYm);
    expect((await downloading).suggestedFilename()).toBe(`vpp-bao-cao-${seed.prevYm}.xlsx`);
    await expect(page.getByRole('region', { name: 'Bản chốt' }).getByRole('listitem').first()).toBeVisible();

    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmPendingIfAny(page, request, seed.prevYm);
    const printUrl = await urlOfNewTab(page, PRINT_URL, () => page.getByRole('button', { name: 'Mở bản in' }).click(), devHeaders('admin'));
    await page.goto(printUrl);
    await expect(page.getByRole('row').filter({ hasText: item.name }).first()).toContainText('10');
  });
});
