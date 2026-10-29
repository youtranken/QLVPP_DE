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
  test('E4-S3 còn nợ: nợ 2 → giao bổ sung 1 → lịch sử 2 đợt → hủy nợ 1 có lý do → dòng biến mất; member thấy "đã hủy 1" và chuông', async ({
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
      await expect(page.getByRole('button', { name: 'Theo món' })).toHaveAttribute('aria-pressed', 'true');
      const itemGroup = page.getByRole('region', { name: a.name });
      await expect(itemGroup.getByText('còn 2 cái')).toBeVisible();
      await expect(itemGroup.getByText('Tồn 9')).toBeVisible();

      await page.getByRole('button', { name: 'Theo người' }).click();
      await expect(page).toHaveURL(/\/admin\/backlog\?by=person$/);
      await expect(page.getByRole('button', { name: 'Theo người' })).toHaveAttribute('aria-pressed', 'true');
      const group = page.getByRole('region', { name: seed.name });
      const row = group.getByRole('listitem').filter({ hasText: a.name });
      await expect(group.getByText('PW Phòng giao')).toBeVisible();
      await expect(row.getByText('đã giao 1/3')).toBeVisible();
      await expect(row.getByText('còn 2', { exact: true })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-person');

      await row.getByRole('button', { name: 'Giao bổ sung…' }).click();
      const deliver = page.getByRole('dialog', { name: `Giao bổ sung ${a.name} cho ${seed.name}` });
      const qty = deliver.getByLabel('Số lượng giao');
      await expect(qty).toHaveValue('2');
      await qty.fill('3');
      await expect(deliver.getByText('Tối đa 2')).toBeVisible();
      await expect(deliver.getByRole('button', { name: 'Giao', exact: true })).toBeDisabled();
      await qty.fill('1');
      await deliver.getByRole('button', { name: 'Giao', exact: true }).click();
      await expect(deliver).toHaveCount(0);
      await expect(row.getByText('còn 1', { exact: true })).toBeVisible();
      await expect(row.getByText('đã giao 2/3')).toBeVisible();
      expect(stockOf(a.id)).toBe(8);

      await row.getByRole('button', { name: 'Lịch sử' }).click();
      const drawer = page.getByRole('dialog', { name: `Lịch sử giao ${a.name}` });
      const rounds = drawer.getByRole('list', { name: 'Các đợt giao' }).getByRole('listitem');
      await expect(rounds).toHaveCount(2);
      for (const r of await rounds.all()) await expect(r).toHaveText(/^\d\d:\d\d \d\d\/\d\d · 1 · .+$/);
      await expect(drawer.getByRole('button', { name: /Hoàn tác/ })).toHaveCount(0);
      await snap(page, info, 'backlog-history');
      await drawer.getByRole('button', { name: 'Đóng' }).click();

      await row.getByRole('button', { name: 'Hủy nợ…' }).click();
      const cancel = page.getByRole('dialog', { name: `Hủy 1 cái còn lại của ${seed.name}?` });
      const reason = cancel.getByLabel('Lý do hủy nợ');
      const submit = cancel.getByRole('button', { name: 'Hủy nợ', exact: true });
      await reason.fill('  ab  ');
      await expect(submit).toBeDisabled();
      await reason.fill('Hết mẫu, đổi loại khác');
      await expect(submit).toBeEnabled();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'backlog-cancel');
      await submit.click();
      await expect(cancel).toHaveCount(0);
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
});
