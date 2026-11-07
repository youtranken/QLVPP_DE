import { expect, test, type Page } from '@playwright/test';
import { asRole, copyUnregisteredList, devHeaders, expectNoContrastViolations, isMobile, psql, searchSummaryPeople, shot } from './helpers';
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

      await copyUnregisteredList(page, info);
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

  test('Nhóm 1 · Tổng hợp kỳ mở chỉ xem, Xem mở popup, ‹ › chuyển người', async ({ page, request }, info) => {
    const current = await request.get('/api/periods/current', { headers: devHeaders('admin') });
    const { ym } = (await current.json()) as { ym: string };
    const row = (id: string, name: string, team: string | null) => ({
      request_id: id, user_sub: `pw-${id}`, full_name: name, email: null, team, line_count: 1, total_qty: 2, custom_count: 0, saved_at: '2026-11-07T04:06:00.000Z',
    });
    const rows = [row('q-1', 'PW Người một', 'Team Test'), row('q-2', 'PW Người hai', null)];
    const view = (id: string) => ({
      id, period_ym: ym, user_sub: `pw-${id}`, full_name: rows.find((r) => r.request_id === id)!.full_name, department: null, updated_at: '2026-11-07T04:06:00.000Z',
      is_open: true, user_status: 'active', team: null,
      lines: [{ id: `${id}-l`, item_id: null, item: null, custom_name: 'PW món ngoài', custom_unit: 'cai', custom_note: null, image_file_id: null, qty: 2, delivered_qty: 0, cancelled_qty: 0, cancel_note: null, review_status: 'pending', review_note: null, added_by_admin: false, readonly_for_member: true, max_qty: null }],
    });
    await page.route(/\/api\/admin\/periods\/\d{4}-\d{2}\/registrations(\/[\w-]+)?$/, (route) => {
      const id = /registrations\/([\w-]+)$/.exec(route.request().url())?.[1];
      return route.fulfill({ status: 200, json: id ? view(id) : { items: rows } });
    });
    // Vòng 2 (7c): mục "Tổng hợp kỳ" (không ?ym) → kỳ khóa, có lời mời sang kỳ đang mở
    await openPeriod(page);
    const month = Number(ym.slice(5, 7));
    const offer = page.getByRole('link', { name: `Xem đăng ký kỳ tháng ${month}` });
    await expect(offer).toBeVisible();
    await offer.click();
    await expect(page).toHaveURL(new RegExp(`ym=${ym}`));
    await expect(page.getByRole('radio', { name: 'Đã đăng ký (2)' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/đang nhận đăng ký, chỉ xem/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Sang Gửi ADM/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Điều chỉnh/ })).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await page.getByRole('button', { name: 'Xem phiếu của PW Người một' }).click();
    const dialog = page.getByRole('dialog', { name: 'Phiếu của PW Người một' });
    await expect(dialog.getByText('PW món ngoài')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Người trước' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Người sau' }).click();
    const next = page.getByRole('dialog', { name: 'Phiếu của PW Người hai' });
    await expect(next.getByRole('button', { name: 'Người sau' })).toBeDisabled();
    await expect(next.getByRole('button', { name: 'Người trước' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Xem phiếu của PW Người hai' })).toBeFocused();
    await shot(page, info, 'nhom1-summary-open');
  });
});
