import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, monthRowAction, pickOption, searchMonthPeople, settled, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const steps = (page: Page) => page.getByRole('list', { name: /^(Các bước của tháng|Steps of the month)$/ });

// Chip lọc: nhóm radio ở 1280, ô chọn ở 390 (Segmented > 2 lựa chọn)
async function pickChip(page: Page, info: TestInfo, name: string) {
  if (isMobile(info)) await pickOption(page.getByRole('combobox', { name: 'Lọc phiếu' }), new RegExp(`^${name}`));
  else await page.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
}

async function openMonth(page: Page, ym?: string) {
  await page.goto(ym ? `/admin/month?ym=${ym}` : '/admin/month');
  await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
}

test.describe('Vòng3-KT Kỳ tháng', () => {
  test('Vòng3-KT Kỳ tháng: dải 4 bước gọn, chip lọc, bảng kẻ ô, không cuộn ngang', async ({ page, request }, info) => {
    // Tự seed kỳ đã khóa (tháng đang giao): dữ liệu dev có thể chỉ còn kỳ đang mở, khi đó /admin rơi vào kỳ đăng ký không có chip
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 1 }]);
    try {
      await page.goto('/admin/month');
      await expect(page).toHaveURL(/\/admin\/month/);
      await expect(page.getByRole('heading', { level: 1, name: `Kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
      const items = steps(page).getByRole('listitem');
      await expect(items).toHaveCount(4);
      for (const [i, name] of ['Đã đặt', 'Gửi NCC', 'Nhận hàng', 'Giao'].entries()) await expect(items.nth(i)).toContainText(name);
      if (isMobile(info)) await expect(page.getByRole('combobox', { name: 'Lọc phiếu' })).toBeVisible();
      else for (const chip of [/^Tất cả/, /^Có ghi chú/, /^Chưa giao xong/, /^Có món chờ duyệt/]) await expect(page.getByRole('radio', { name: chip })).toBeVisible();
      await expect(page.getByRole('button', { name: /Chép tin nhắc/ })).toHaveCount(0);
      await settled(page);
      await shot(page, info, 'vong3-month');
      expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      seed.cleanup();
    }
  });

  test('Vòng3-KT chip Chưa giao xong lọc, Xem mở popup phiếu, Điều chỉnh mở ?request=', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 3 }]);
    try {
      await openMonth(page, seed.prevYm);
      await searchMonthPeople(page, seed.tag);
      const row = page.getByRole('row').filter({ hasText: seed.name });
      await expect(row.getByText('Chưa giao', { exact: true })).toBeVisible();
      await pickChip(page, info, 'Chưa giao xong');
      await expect(page).toHaveURL(/chip=undelivered/);
      await expect(row).toBeVisible();
      await monthRowAction(page, seed.name, 'Xem phiếu');
      const dialog = page.getByRole('dialog', { name: `Phiếu của ${seed.name}` });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(seed.items[0].name)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await monthRowAction(page, seed.name, 'Điều chỉnh phiếu');
      await expect(page).toHaveURL(/request=/);
      await expect(page.getByRole('dialog', { name: `Điều chỉnh phiếu ${seed.name}` })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'vong3-month-adjust');
    } finally {
      seed.cleanup();
    }
  });

  test('Vòng3-KT lỗi tải số liệu kỳ → "Không tải được dữ liệu — thử lại." + "Thử lại"', async ({ page }) => {
    await page.route('**/api/admin/periods/*/summary', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'x' } }));
    await page.goto('/admin/month');
    await expect(page.getByRole('main').getByText('Không tải được dữ liệu — thử lại.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });

  test('Vòng3-KT kỳ đang đăng ký chỉ xem, Xem mở popup, ‹ › chuyển người', async ({ page, request }, info) => {
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
    await openMonth(page);
    await page.getByRole('group', { name: 'Chọn kỳ' }).getByRole('button', { name: 'Tháng sau' }).click();
    await expect(page).toHaveURL(new RegExp(`ym=${ym}`));
    await expect(page.getByRole('row').filter({ hasText: 'PW Người một' })).toBeVisible();
    await expect(steps(page).getByText('—')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Điều chỉnh/ })).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await expect(page.getByRole('button', { name: /^Xem phiếu của/ })).toHaveCount(0);
    await page.getByRole('row').filter({ hasText: 'PW Người một' }).getByText('PW Người một').click();
    const dialog = page.getByRole('dialog', { name: 'Phiếu của PW Người một' });
    await expect(dialog.getByText('PW món ngoài')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Người trước' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Người sau' }).click();
    const next = page.getByRole('dialog', { name: 'Phiếu của PW Người hai' });
    await expect(next.getByRole('button', { name: 'Người sau' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Thao tác cho PW Người hai' })).toBeFocused();
    await shot(page, info, 'vong3-month-open');
  });

  test('Vòng3-KT đường cũ /admin/summary và /admin/home chuyển về Kỳ tháng giữ query; ?filter cũ thành chip', async ({ page }) => {
    await page.goto('/admin/summary?ym=2026-10&filter=pending_delivery');
    await expect(page).toHaveURL(/\/admin\/month\?.*ym=2026-10/);
    await expect(page).toHaveURL(/chip=undelivered/);
    await page.goto('/admin/home');
    await expect(page).toHaveURL(/\/admin\/month/);
  });

  test('Vòng3-KT đổi sang English thì tên bước đổi theo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vpp_lang', 'en'));
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^(January|February|March|April|May|June|July|August|September|October|November|December) period$/ })).toBeVisible();
    for (const name of ['Ordered', 'Send to supplier', 'Receiving', 'Delivery']) await expect(steps(page).getByText(name, { exact: true })).toBeVisible();
  });

  test('G1 Kỳ tháng: chỉ người đã đặt, cột Đặt hàng/Tủ, lọc khu, chế độ Theo món', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const seed: Seed = await seedLockedRequest(request, info, [{ stock: 5, qty: 1 }, { stock: 0, qty: 2 }]);
    try {
      await openMonth(page, seed.prevYm);
      await searchMonthPeople(page, seed.tag);
      const row = page.getByRole('row').filter({ hasText: seed.name });
      await expect(row.getByText('2 món · 3 SL')).toBeVisible();
      await expect(row.getByText(/^PW Phòng giao · .*lưu \d{2}\/\d{2}$/)).toBeVisible();
      await expect(row.getByText(`Thiếu: ${seed.items[1].name}`)).toBeVisible();

      await page.getByRole('toolbar', { name: 'Thanh công cụ Kỳ tháng' }).getByRole('button', { name: 'Lọc phòng' }).click();
      const areas = page.getByRole('dialog', { name: 'Lọc phòng' });
      await areas.getByRole('checkbox', { name: 'PW Phòng giao' }).check();
      await areas.getByRole('button', { name: 'Áp dụng' }).click();
      await expect(page).toHaveURL(/area=PW\+Ph%C3%B2ng\+giao/);
      await expect(page.getByRole('button', { name: 'Lọc phòng: PW Phòng giao' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Bỏ lọc PW Phòng giao' })).toBeVisible();
      await expect(row).toBeVisible();
      expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'g1-month-people');

      await page.getByRole('radio', { name: 'Theo món' }).click();
      await expect(page).toHaveURL(/view=items/);
      const items = page.getByRole('table', { name: 'Theo món' });
      const short = items.getByRole('row').filter({ hasText: seed.items[1].name });
      // Đặt 2, Tủ 0, không nợ → Cần mua 2 (số của Báo cáo)
      await expect(short.getByRole('cell')).toHaveText([seed.items[1].name, /.+/, '1', '2', '0', '2']);
      expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'g1-month-items');
    } finally {
      seed.cleanup();
    }
  });
});


test.describe('Kỳ tháng theo bản Sau (TC-05, TC-08, AD-04…14)', () => {
  test('TC-08 AD-06 lọc người đã nghỉ: băng một dòng, "Lọc N người này" bật chip, bảng còn N dòng vạch cam', async ({ page }, info) => {
    await page.goto('/admin/month?ym=2026-12');
    const band = page.getByText(/^\d+ người đã nghỉ còn phần chưa nhận\.$/);
    await expect(band).toBeVisible();
    const n = Number((await band.textContent())!.match(/^\d+/)![0]);
    await expect(page.getByRole('link', { name: 'Xem nợ tháng trước' })).toHaveCount(0);
    await page.getByRole('button', { name: `Lọc ${n} người này` }).click();
    await expect(page).toHaveURL(/left=1/);
    await expect(page.getByRole('button', { name: /^Người đã nghỉ/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Thao tác cho / })).toHaveCount(n);
    await expect(page.getByRole('table').getByText('Người đã nghỉ', { exact: true })).toHaveCount(n);
    await expect(page.getByText(new RegExp(`^Đang hiện ${n}/\\d+ người$`))).toBeVisible();
    expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'month-left-filter');
  });

  test('TC-05 AD-04 dải tiến trình không bấm được; bộ chọn kỳ trong thanh công cụ', async ({ page }) => {
    await openMonth(page);
    await expect(steps(page).getByRole('link')).toHaveCount(0);
    await expect(steps(page).locator('[aria-current="step"]')).toHaveCount(1);
    await expect(page.getByRole('toolbar', { name: 'Thanh công cụ Kỳ tháng' }).getByRole('group', { name: 'Chọn kỳ' })).toBeVisible();
  });
});

test.describe('Kỳ tháng 390: việc chính thấy ngay khi mở', () => {
  test('390: dòng người đầu tiên nằm trong màn 390×844 không cần cuộn (kỳ 2026-12 có băng người đã nghỉ)', async ({ page }, info) => {
    test.skip(!isMobile(info), 'chỉ đo ở 390');
    await page.goto('/admin/month?ym=2026-12');
    const first = page.getByRole('button', { name: /^Thao tác cho / }).first();
    await expect(first).toBeVisible();
    await settled(page);
    const top = await first.evaluate((el) => el.closest('tr')!.getBoundingClientRect().top);
    expect(top).toBeLessThan(844);
  });
});

test.describe('A3 Kỳ tháng: dải 4 bước giãn hết bề ngang', () => {
  test('A3 bước 4 chạm mép phải dải (lệch ≤ 24 px), 4 bước cùng một hàng, không cuộn ngang', async ({ page }) => {
    await openMonth(page);
    const list = steps(page);
    const items = list.getByRole('listitem');
    await expect(items).toHaveCount(4);
    const box = (await list.boundingBox())!;
    const lastText = (await items.nth(3).locator('.mk-step__text').boundingBox())!;
    const tops = await items.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    expect(box.x + box.width - (lastText.x + lastText.width)).toBeLessThanOrEqual(24);
    expect(await fitsWidth(page)).toBe(true);
  });
});
