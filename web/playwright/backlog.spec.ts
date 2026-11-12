import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled } from './helpers';
import { seedLockedRequest, stockOf, type Seed } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-12-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

const asIdentity = (page: Page, sub: string, role: 'member' | 'admin') =>
  page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-user-sub': sub, 'x-dev-role': role } }));

asRole('admin');

test.describe('E4 còn nợ (kỳ trước đã khóa, dev-identity admin)', () => {
  test('Vòng3-CN Còn nợ nhóm theo tháng → người → món: công tắc người đã nghỉ, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao; member thấy "đã hủy 1" và chuông', async ({
    page,
    request,
    browser,
  }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [{ stock: 10, qty: 3 }], { monthsBack: 2 });
      const [a] = seed.items;
      const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
      const first = await request.post(`/api/admin/lines/${lineId}/deliver`, {
        headers: devHeaders('admin'),
        data: { qty: 1, expected_delivered_qty: 0 },
      });
      expect(first.ok()).toBe(true);

      await page.goto('/admin/backlog');
      await expect(page.getByRole('heading', { level: 1, name: 'Còn nợ' })).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: a.name }).filter({ has: page.getByRole('button', { name: 'Giao bổ sung' }) });
      const group = page.getByRole('row').filter({ hasText: seed.name }).filter({ hasText: 'PW Phòng giao' });
      await expect(group).toContainText('PW Phòng giao');
      // Tóm tắt kỳ nằm cuối thanh công cụ (một tháng: "Tháng m/yyyy · …"; nhiều tháng: "n tháng · …" và mỗi tháng một dải tiêu đề)
      await expect(page.getByRole('status').filter({ hasText: /^(Tháng \d+\/\d{4}|\d+ tháng) · \d+ người · \d+ đơn vị$/ })).toBeVisible();
      // Tóm tắt không bao giờ bị cắt: thiếu chỗ thì xuống một dòng riêng canh phải (đo ở các bề rộng hay gặp, rồi trả lại khung cũ)
      const summary = page.locator('.bl-summary');
      const vp = page.viewportSize();
      for (const width of isMobile(info) ? [390, 360] : [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: vp?.height ?? 800 });
        const fit = await summary.evaluate((el) => {
          const bar = el.closest('.bl-bar')!.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return { inside: el.scrollWidth <= el.clientWidth, right: Math.round(box.right), barRight: Math.round(bar.right), barSW: el.closest('.bl-bar')!.scrollWidth, barCW: el.closest('.bl-bar')!.clientWidth };
        });
        expect(fit.inside, `tóm tắt không tràn chính nó ở ${width}`).toBe(true);
        expect(fit.right, `tóm tắt không lố mép phải thanh công cụ ở ${width}`).toBeLessThanOrEqual(fit.barRight);
        expect(fit.barSW, `thanh công cụ không tràn ở ${width}`).toBeLessThanOrEqual(fit.barCW);
      }
      if (vp) await page.setViewportSize(vp);
      // Cột: Món · ĐVT · Đăng ký · Đã giao · Còn nợ · Tủ còn · Thao tác
      await expect(row.getByRole('cell').nth(2)).toHaveText('3');
      await expect(row.getByRole('cell').nth(3)).toHaveText('1');
      await expect(row.getByRole('cell').nth(4)).toHaveText('2');
      await expect(row.getByRole('cell').nth(5)).toHaveText('9');
      const leftSwitch = page.getByRole('switch', { name: /^Chỉ người đã nghỉ/ });
      await leftSwitch.click();
      await expect(page).toHaveURL(/left=1/);
      await expect(row).toHaveCount(0);
      await leftSwitch.click();
      await expect(row).toBeVisible();
      psql(`UPDATE users SET status = 'locked' WHERE sub = '${seed.sub}'`);
      try {
        await page.goto('/admin/backlog?left=1');
        await expect(group.getByText('Người đã nghỉ')).toBeVisible();
        await expect(row).toBeVisible();
      } finally {
        psql(`UPDATE users SET status = 'active' WHERE sub = '${seed.sub}'`);
      }
      await page.goto('/admin/backlog');
      await expect(row).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-person');

      await row.getByRole('button', { name: 'Giao bổ sung' }).click();
      const deliver = page.getByRole('dialog', { name: `Giao bổ sung ${a.name} cho ${seed.name}` });
      const qty = deliver.getByLabel('Số lượng giao');
      await expect(qty).toHaveValue('2');
      await expect(deliver.getByText('Tồn sau khi giao 7')).toBeVisible();
      await expect(deliver.getByRole('button', { name: /^Thêm/ })).toBeDisabled();
      await qty.fill('3');
      await expect(qty).toHaveValue('2');
      await deliver.getByRole('button', { name: /^Bớt/ }).click();
      await expect(qty).toHaveValue('1');
      await expect(deliver.getByText('Tồn sau khi giao 8')).toBeVisible();
      await deliver.getByRole('button', { name: 'Giao', exact: true }).click();
      await expect(deliver).toHaveCount(0);
      await expect(row.getByRole('cell').nth(4)).toHaveText('1');
      await expect(page.getByText(`Đã giao bổ sung 1 cái ${a.name} cho ${seed.name}`)).toBeVisible();
      expect(stockOf(a.id)).toBe(8);

      if (isMobile(info)) {
        await row.getByRole('button', { name: `Thao tác khác ${a.name} — ${seed.name}` }).click();
        await page.getByRole('menuitem', { name: 'Lịch sử giao' }).click();
      } else {
        await row.getByRole('button', { name: `Lịch sử giao ${a.name} — ${seed.name}` }).click();
      }
      const drawer = page.getByRole('dialog', { name: `Lịch sử giao ${seed.name}` });
      const rounds = drawer.getByRole('list', { name: 'Các đợt giao' }).getByRole('listitem');
      await expect(rounds).toHaveCount(2);
      for (const r of await rounds.all()) await expect(r).toHaveText(/^Giao 1 cái\d\d:\d\d \d\d\/\d\d · .+$/);
      await expect(drawer.getByRole('button', { name: /Hoàn tác/ })).toHaveCount(0);
      await snap(page, info, 'backlog-history');
      await drawer.getByRole('button', { name: 'Đóng' }).click();

      // Hủy nợ chỉ nằm trong menu ⋯ của dòng ở mọi bề rộng
      await expect(row.getByRole('button', { name: 'Hủy nợ' })).toHaveCount(0);
      await row.getByRole('button', { name: `Thao tác khác ${a.name} — ${seed.name}` }).click();
      await page.getByRole('menuitem', { name: 'Hủy nợ' }).click();
      const cancel = page.getByRole('dialog', { name: `Hủy nợ 1 cái ${a.name} của ${seed.name}?` });
      const reason = cancel.getByRole('textbox', { name: /^Ghi chú/ });
      const submit = cancel.getByRole('button', { name: 'Hủy nợ', exact: true });
      await expect(cancel.getByRole('radiogroup', { name: 'Lý do hủy nợ' }).getByRole('radio')).toHaveCount(4);
      await expect(submit).toBeDisabled();
      await cancel.getByRole('radio', { name: 'Khác', exact: true }).check();
      // Ô cắt theo mã điểm (như server đếm), không dùng maxlength của trình duyệt (đếm UTF-16)
      await reason.fill('ả'.repeat(201));
      await expect(reason).toHaveValue('ả'.repeat(200));
      await reason.fill('  ab  ');
      await expect(submit).toBeDisabled();
      await reason.fill('  abc  ');
      await expect(submit).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-cancel');
      await submit.click();
      await expect(cancel).toHaveCount(0);
      await expect(page.getByText(`Đã hủy nợ 1 cái ${a.name} của ${seed.name}`)).toBeVisible();
      await expect(group).toHaveCount(0);
      expect(psql(`SELECT cancelled_qty || '|' || cancel_note FROM request_lines WHERE id = '${lineId}'`)).toBe('1|Khác: abc');

      const member = await browser.newPage();
      try {
        await asIdentity(member, seed.sub, 'member');
        await member.goto(`/history/${seed.prevYm}`);
        await expect(member.getByText('đã hủy 1')).toBeVisible();
        const bell = member.getByRole('banner').getByRole('button', { name: 'Thông báo, 1 chưa đọc' });
        await bell.click();
        const month = Number(seed.prevYm.slice(5, 7));
        await expect(
          member.getByRole('dialog', { name: 'Thông báo' }).getByText(`Adm D&E hủy phần còn chờ nhận 1 cái ${a.name} (tháng ${month}): Khác: abc`),
        ).toBeVisible();
      } finally {
        await member.close();
      }
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('V2D-11 Còn nợ chỉ có nợ tháng trước; ?left=1 lọc người đã nghỉ, Hủy nợ qua ⋯ chọn sẵn "Người đã nghỉ"', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    const seeds: Seed[] = [];
    try {
      const current = await seedLockedRequest(request, info, [{ stock: 0, qty: 2 }]);
      seeds.push(current);
      const debt = await seedLockedRequest(request, info, [{ stock: 0, qty: 2 }], { monthsBack: 2 });
      seeds.push(debt);
      psql(`UPDATE users SET status = 'locked' WHERE sub = '${debt.sub}'`);
      await page.goto('/admin/backlog?left=1');
      const debtRow = page.getByRole('row').filter({ hasText: debt.items[0].name }).filter({ has: page.getByRole('button', { name: 'Giao bổ sung' }) });
      await expect(debtRow).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: current.items[0].name })).toHaveCount(0);
      await expect(debtRow.getByRole('button', { name: 'Hủy nợ' })).toHaveCount(0);
      await debtRow.getByRole('button', { name: `Thao tác khác ${debt.items[0].name} — ${debt.name}` }).click();
      await page.getByRole('menuitem', { name: 'Hủy nợ' }).click();
      const cancel = page.getByRole('dialog', { name: `Hủy nợ 2 cái ${debt.items[0].name} của ${debt.name}?` });
      await expect(cancel.getByRole('radio', { name: 'Người đã nghỉ' })).toBeChecked();
      await expect(cancel.getByRole('button', { name: 'Quay lại' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await cancel.getByRole('button', { name: 'Hủy nợ', exact: true }).click();
      await expect(cancel).toHaveCount(0);
      await expect(debtRow).toHaveCount(0);
      expect(psql(`SELECT cancelled_qty || '|' || cancel_note FROM request_lines WHERE request_id = '${debt.requestId}'`)).toBe('2|Người đã nghỉ');
      expect(psql(`SELECT count(*) FROM in_app_notifications WHERE user_sub = '${debt.sub}'`)).toBe('0');
    } finally {
      seeds.forEach((s) => s.cleanup());
      release();
    }
  });

  test('E9-S3 Còn nợ: lỗi tải danh sách → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/backlog?*', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/backlog');
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await page.unroute('**/api/admin/backlog?*');
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Không tải được dữ liệu — thử lại.')).toHaveCount(0);
  });
});
