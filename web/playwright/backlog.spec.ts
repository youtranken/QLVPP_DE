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
  test('E4-S3 E9-S3 Còn nợ: thẻ lọc, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao; member thấy "đã hủy 1" và chuông', async ({
    page,
    request,
    browser,
  }, info) => {
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [{ stock: 10, qty: 3 }]);
      const [a] = seed.items;
      const lineId = psql(`SELECT id FROM request_lines WHERE request_id = '${seed.requestId}'`);
      const first = await request.post(`/api/admin/lines/${lineId}/deliver`, {
        headers: devHeaders('admin'),
        data: { qty: 1, expected_delivered_qty: 0 },
      });
      expect(first.ok()).toBe(true);

      await page.goto('/admin/backlog');
      await expect(page.getByRole('radio', { name: 'Theo món' })).toBeChecked();
      const itemGroup = page.getByRole('rowheader', { name: new RegExp(a.name) });
      await expect(itemGroup).toContainText('còn 2 cái');
      await expect(itemGroup).toContainText('Tồn 9');
      await expect(page.getByRole('button', { name: /^Có hàng để giao bổ sung/ })).toBeVisible();
      await page.getByRole('button', { name: /^Của người đã nghỉ/ }).click();
      await expect(page).toHaveURL(/filter=left/);
      await expect(page.getByText(/^Đang lọc: Của người đã nghỉ/)).toBeVisible();
      await expect(itemGroup).toHaveCount(0);
      await page.getByRole('button', { name: 'Bỏ lọc' }).click();
      await expect(itemGroup).toBeVisible();

      await page.getByRole('radio', { name: 'Theo người' }).click();
      await expect(page).toHaveURL(/\/admin\/backlog\?by=person$/);
      await expect(page.getByRole('radio', { name: 'Theo người' })).toBeChecked();
      const group = page.getByRole('rowheader', { name: new RegExp(seed.name) });
      const row = page.getByRole('row').filter({ hasText: a.name }).filter({ has: page.getByRole('button', { name: 'Hủy nợ…' }) });
      await expect(group).toContainText('PW Phòng giao');
      await expect(row.getByText('còn 2 cái')).toBeVisible();
      await expect(row.getByText('/ 3')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-person');

      await row.getByRole('button', { name: 'Giao bổ sung…' }).click();
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
      await expect(row.getByText('còn 1 cái')).toBeVisible();
      await expect(page.getByText(`Đã giao bổ sung 1 cái ${a.name} cho ${seed.name}`)).toBeVisible();
      expect(stockOf(a.id)).toBe(8);

      await row.getByRole('button', { name: 'Lịch sử giao' }).click();
      const drawer = page.getByRole('dialog', { name: `Lịch sử giao ${seed.name}` });
      const rounds = drawer.getByRole('list', { name: 'Các đợt giao' }).getByRole('listitem');
      await expect(rounds).toHaveCount(2);
      for (const r of await rounds.all()) await expect(r).toHaveText(/^Giao 1 cái\d\d:\d\d \d\d\/\d\d · .+$/);
      await expect(drawer.getByRole('button', { name: /Hoàn tác/ })).toHaveCount(0);
      await snap(page, info, 'backlog-history');
      await drawer.getByRole('button', { name: 'Đóng' }).click();

      await row.getByRole('button', { name: 'Hủy nợ…' }).click();
      const cancel = page.getByRole('dialog', { name: `Hủy 1 cái còn lại của ${seed.name}?` });
      const reason = cancel.getByLabel('Lý do hủy nợ', { exact: false });
      const submit = cancel.getByRole('button', { name: 'Hủy nợ', exact: true });
      await expect(reason).toHaveAttribute('maxlength', '500');
      await reason.fill('  ab  ');
      await expect(submit).toBeDisabled();
      await reason.fill('Hết mẫu, đổi loại khác');
      await expect(submit).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-cancel');
      await submit.click();
      await expect(cancel).toHaveCount(0);
      await expect(page.getByText(`Đã hủy nợ 1 cái ${a.name} của ${seed.name}`)).toBeVisible();
      await expect(group).toHaveCount(0);
      expect(psql(`SELECT cancelled_qty || '|' || cancel_note FROM request_lines WHERE id = '${lineId}'`)).toBe('1|Hết mẫu, đổi loại khác');

      const member = await browser.newPage();
      try {
        await asIdentity(member, seed.sub, 'member');
        await member.goto(`/history/${seed.prevYm}`);
        await expect(member.getByText('đã hủy 1')).toBeVisible();
        const bell = member.getByRole('banner').getByRole('button', { name: 'Thông báo, 1 chưa đọc' });
        await bell.click();
        const month = Number(seed.prevYm.slice(5, 7));
        await expect(
          member.getByRole('dialog', { name: 'Thông báo' }).getByText(`Hành chính hủy phần còn nợ 1 cái ${a.name} (tháng ${month}): Hết mẫu, đổi loại khác`),
        ).toBeVisible();
      } finally {
        await member.close();
      }
    } finally {
      seed?.cleanup();
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
