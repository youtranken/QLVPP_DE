import { expect, test, type Page } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, psql, searchSummaryPeople, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

asRole('admin');

// Dev DB có authorized_groups: người seed phải thuộc nhóm được dùng app mới vào mẫu số/danh sách chưa đăng ký
const MEMBER_GROUPS = `'["Test_VPP"]'::jsonb`;

async function openPeriod(page: Page, ym?: string) {
  await page.goto(ym ? `/admin/summary?ym=${ym}` : '/admin/summary');
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
}

test.describe('E9-S2 tổng hợp', () => {
  test('E9-S2 Tổng hợp: thẻ lọc dòng chờ giao, chưa đăng ký không có Hành chính, theo món nhóm có tồn', async ({ page, request, context }, info) => {
    test.setTimeout(90_000);
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 3 }]);
    const item = seed.items[0];
    const subs = { done: `pw-sum-done-${seed.tag}`, member: `pw-sum-mem-${seed.tag}`, admin: `pw-sum-adm-${seed.tag}` };
    const names = { done: `PW Đủ ${seed.tag}`, member: `PW Chưa ĐK ${seed.tag}`, admin: `PW HC ${seed.tag}` };
    const category = psql(`SELECT id || '|' || name FROM item_categories WHERE active ORDER BY sort_order, id LIMIT 1`).split('|');
    psql(`UPDATE items SET category_id = '${category[0]}' WHERE id = '${item.id}';
      UPDATE users SET groups = ${MEMBER_GROUPS} WHERE sub = '${seed.sub}';
      INSERT INTO users (sub, full_name, email, department, status, groups) VALUES
        ('${subs.done}', '${names.done}', '${subs.done}@example.test', 'PW Phòng giao', 'active', ${MEMBER_GROUPS}),
        ('${subs.member}', '${names.member}', '${subs.member}@example.test', 'PW Phòng chờ', 'active', ${MEMBER_GROUPS}),
        ('${subs.admin}', '${names.admin}', '${subs.admin}@example.test', 'PW Phòng chờ', 'active', '["Test_VPP", "vpp_admin"]'::jsonb);
      WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${seed.prevYm}-01', '${subs.done}', '${subs.done}') RETURNING id)
      INSERT INTO request_lines (request_id, item_id, qty, delivered_qty) SELECT r.id, '${item.id}', 2, 2 FROM r`);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    try {
      await openPeriod(page, seed.prevYm);
      await searchSummaryPeople(page, seed.tag);
      const rowPending = page.getByRole('row').filter({ hasText: seed.name });
      const rowDone = page.getByRole('row').filter({ hasText: names.done });
      await expect(rowPending.getByRole('progressbar', { name: 'đã giao 0/3 đơn vị' })).toBeVisible();
      await expect(rowDone.getByRole('progressbar', { name: 'đã giao 2/2 đơn vị' })).toBeVisible();

      const pending = page.getByRole('button', { name: /Dòng chờ giao/ });
      await pending.click();
      await expect(pending).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/filter=pending_delivery/);
      await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByText('Đang lọc: Còn dòng chờ giao · 1 người')).toBeVisible();
      await expect(rowDone).toHaveCount(0);
      await expect(rowPending).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'e9-s2-summary-filtered');
      await pending.click();
      await expect(pending).toHaveAttribute('aria-pressed', 'false');
      await expect(rowDone).toBeVisible();

      await page.getByRole('radio', { name: 'Theo món' }).click();
      await page.getByRole('searchbox', { name: 'Tìm món…' }).fill(seed.tag);
      const itemRow = page.getByRole('row').filter({ hasText: item.name });
      await expect(itemRow).toBeVisible();
      await expect(itemRow.getByRole('cell').last()).toContainText('5');
      await expect(page.getByRole('rowheader').first()).toContainText(category[1]);
      await expect(page.getByRole('link', { name: 'Xem số cần mua ở Báo cáo' })).toHaveAttribute('href', `/admin/reports?ym=${seed.prevYm}`);
      await expect(page.getByRole('columnheader', { name: /Cần mua/ })).toHaveCount(0);

      await openPeriod(page);
      const registered = page.getByRole('button', { name: /Phiếu đã đăng ký/ });
      await registered.click();
      await expect(page).toHaveURL(/filter=unregistered/);
      await expect(page.getByRole('row').filter({ hasText: names.member })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: names.admin })).toHaveCount(0);

      await page.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }).click();
      await expect(page.getByRole('status').filter({ hasText: /^Đã sao chép \d+ người$/ })).toBeVisible();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text.split('\n')[0]).toMatch(/^Chưa đăng ký VPP tháng \d{1,2} \(hạn 23:59 ngày \d{1,2}\):$/);
      expect(text).toContain(`- ${names.member} (PW Phòng chờ)`);
      expect(text).not.toContain(names.admin);
    } finally {
      psql(`DELETE FROM requests WHERE user_sub = '${subs.done}';
        DELETE FROM users WHERE sub IN ('${subs.done}', '${subs.member}', '${subs.admin}')`);
      seed.cleanup();
    }
  });

  test('E9-S2 Tổng hợp: lỗi tải số liệu kỳ → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/periods/*/summary', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await openPeriod(page);
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});
