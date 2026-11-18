import { expect, test } from '@playwright/test';
import { createItemViaApi } from './catalog-helpers';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, shot } from './helpers';

test.describe('Nhóm 1 · Sản phẩm (dev-identity admin)', () => {
  asRole('admin');

  test('Nhóm 1 · mục 6: tab Tất cả mặc định, thẻ tạm ngưng có dấu đỏ chéo, nút Tạm ngưng trung tính, hỏi xác nhận cả hai chiều (vòng 2)', async ({ page, request }, info) => {
    const name = `PW Nhóm1 ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    try {
      await page.goto('/admin/catalog');
      await expect(page.getByRole('button', { name: /^Tất cả \d/ })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const card = page.getByRole('article').filter({ hasText: name });
      // AD-43: thẻ chỉ còn "Sửa"; Tạm ngưng / Dùng lại ở chân ngăn Sửa
      await expect(card.getByRole('button', { name: `Tạm ngưng ${name}` })).toHaveCount(0);
      await card.getByRole('button', { name: `Sửa ${name}` }).click();
      const drawer = page.getByRole('dialog', { name: `Sửa món ${name}` });
      const pause = drawer.getByRole('button', { name: `Tạm ngưng ${name}` });
      const idle = await pause.evaluate((el) => getComputedStyle(el).backgroundColor);
      await pause.hover();
      await expect.poll(() => pause.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(idle);
      await pause.click();
      const ask = page.getByRole('dialog', { name: `Tạm ngưng ${name}?` });
      await expect(ask.getByText('Nhân viên vẫn thấy món nhưng không đặt thêm được. Phiếu đã lưu giữ nguyên.')).toBeVisible();
      await ask.getByRole('button', { name: 'Tạm ngưng' }).click();
      const toast = page.getByRole('status').filter({ hasText: `Đã tạm ngưng ${name}` });
      await expect(toast).toBeVisible();
      await expect(toast.getByRole('button', { name: 'Hoàn tác' })).toHaveCount(0);
      await expect(drawer.getByRole('button', { name: `Dùng lại ${name}` })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(card.getByRole('img', { name: 'Tạm ngưng' })).toBeVisible();
      expect(await card.getByRole('heading', { name }).evaluate((el) => getComputedStyle(el).textDecorationLine)).not.toContain('line-through');
      await card.getByRole('button', { name: `Sửa ${name}` }).click();
      await drawer.getByRole('button', { name: `Dùng lại ${name}` }).click();
      await page.getByRole('dialog', { name: `Dùng lại ${name}?` }).getByRole('button', { name: 'Dùng lại' }).click();
      await expect(drawer.getByRole('button', { name: `Tạm ngưng ${name}` })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(card.getByRole('img', { name: 'Tạm ngưng' })).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'nhom1-catalog-grid', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Nhóm 1 · mục 7: tab Tạm ngưng chọn dòng → thanh sáng chỉ Dùng lại, Chuyển nhóm, Bỏ chọn; 390 dính đáy', async ({ page, request }, info) => {
    const name = `PW Nhóm1 bảng ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    expect((await request.patch(`/api/admin/items/${id}`, { headers: devHeaders('admin'), data: { active: false } })).ok()).toBe(true);
    try {
      await page.goto('/admin/catalog?view=table&tab=inactive');
      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row.locator('.ct-item__name--paused')).toBeVisible();
      await row.getByRole('checkbox', { name: 'Chọn dòng' }).check();
      const bar = page.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' });
      await expect(bar.getByRole('button', { name: 'Dùng lại (1)' })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'Chuyển nhóm' })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'Đổi tối đa/tháng' })).toHaveCount(0);
      await expect(bar.getByRole('button', { name: /^Tạm ngưng/ })).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ })).toBeVisible();
      if (isMobile(info)) {
        expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
        const barBox = (await bar.boundingBox())!;
        // Khung trang (.shell__main) chừa chỗ thanh qua --bulkbar-h, không còn chừa riêng ở .ct-page
        const pad = await page.locator('.shell__main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
        expect(pad).toBeGreaterThanOrEqual(barBox.height + 12);
        const vh = page.viewportSize()!.height;
        const lift = await page.locator('.toast-host').evaluate((el, h) => h - el.getBoundingClientRect().bottom, vh);
        expect(lift).toBeGreaterThanOrEqual(barBox.height + 12);
        await expectNoContrastViolations(page);
      }
      await shot(page, info, 'nhom1-catalog-bulk', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Nhóm 1 vòng 2 · thanh lọc: hàng 1 tìm + trạng thái cùng cao 40px, Lưới/Bảng cuối hàng chip nhóm; chip nhóm một dòng; chọn món ngừng riêng ở tab Tất cả có "Dùng lại (n)"', async ({ page, request }, info) => {
    const name = `PW Vòng2 ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    expect((await request.patch(`/api/admin/items/${id}`, { headers: devHeaders('admin'), data: { active: false } })).ok()).toBe(true);
    try {
      await page.goto('/admin/catalog?view=table');
      const search = page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ });
      const status = page.getByRole('group', { name: 'Trạng thái' });
      const view = page.getByRole('group', { name: 'Chế độ xem' });
      const chips = page.getByRole('group', { name: 'Lọc theo nhóm' });
      await expect(chips).toBeVisible();
      // AD-44: màn hẹp không có Lưới/Bảng
      if (isMobile(info)) await expect(view).toBeHidden();
      const [s, st, c] = await Promise.all([search, status, chips].map(async (l) => (await l.boundingBox())!));
      if (!isMobile(info)) {
        const v = (await view.boundingBox())!;
        for (const box of [s, st, v]) expect(Math.round(box.height)).toBe(40);
        expect(Math.abs(s.y - st.y)).toBeLessThanOrEqual(1);
        // Lưới/Bảng nằm cuối hàng chip nhóm (hàng 2), không ở hàng tìm
        expect(v.y).toBeGreaterThan(st.y);
        expect(Math.abs(v.y + v.height / 2 - (c.y + c.height / 2))).toBeLessThanOrEqual(4);
        expect(v.x).toBeGreaterThan(c.x);
      } else {
        expect(s.width).toBeGreaterThan(300);
      }
      const chip = chips.getByRole('button').first();
      const chipH = (await chip.boundingBox())!.height;
      if (isMobile(info)) {
        // ≤767px: ô trạng thái và chip nhóm cùng nâng lên vùng chạm --hit 44px (vòng 3), nên chip không còn thấp hơn ô trạng thái
        expect(Math.round(st.height)).toBeGreaterThanOrEqual(44);
        expect(Math.round(chipH)).toBeGreaterThanOrEqual(44);
      } else {
        expect(chipH).toBeLessThan(st.height);
      }
      expect(c.y).toBeGreaterThan(st.y);
      const tops = await chips.getByRole('button').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
      expect(tops).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await search.fill(name);
      const row = page.getByRole('row').filter({ hasText: name });
      await row.getByRole('checkbox', { name: 'Chọn dòng' }).check();
      const bar = page.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' });
      await expect(bar.getByRole('button', { name: 'Dùng lại (1)' })).toBeVisible();
      await expect(bar.getByRole('button', { name: /^Tạm ngưng/ })).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await shot(page, info, 'nhom1-v2-toolbar', false);
    } finally {
      await removeTestItem(request, id);
    }
  });

  test('Nhóm 1 · mục 9: panel Sửa sản phẩm có đầu (ảnh, mã · nhóm · vị trí, trạng thái), hai khối, Tạm ngưng / Dùng lại ở chân có hỏi xác nhận', async ({ page, request }, info) => {
    const name = `PW Nhóm1 panel ${Date.now()}-${info.project.name}`;
    const id = await createItemViaApi(request, name);
    try {
      await page.goto(`/admin/catalog?q=${encodeURIComponent(name)}`);
      await page.getByRole('button', { name: `Sửa ${name}` }).click();
      const panel = page.getByRole('dialog', { name: `Sửa món ${name}` });
      await expect(panel.getByText('Đang dùng', { exact: true })).toBeVisible();
      await expect(panel.getByRole('heading', { level: 3, name: 'Thông tin' })).toBeVisible();
      await expect(panel.getByRole('heading', { level: 3, name: 'Đặt hàng' })).toBeVisible();
      await expect(panel.getByLabel('Nhóm', { exact: true })).toBeVisible();
      if (isMobile(info)) {
        expect(await panel.locator('.ovp-bar').count()).toBe(0);
        await expectNoContrastViolations(page);
      }
      await shot(page, info, 'nhom1-item-panel', false);
      await panel.getByRole('button', { name: `Tạm ngưng ${name}` }).click();
      await page.getByRole('dialog', { name: `Tạm ngưng ${name}?` }).getByRole('button', { name: 'Tạm ngưng' }).click();
      await expect(panel.getByRole('status').filter({ hasText: `Đã tạm ngưng ${name}` })).toBeVisible();
      await expect(panel.locator('.ct-panel-status')).toHaveText('Tạm ngưng');
      await panel.getByRole('button', { name: `Dùng lại ${name}` }).click();
      await page.getByRole('dialog', { name: `Dùng lại ${name}?` }).getByRole('button', { name: 'Dùng lại' }).click();
      await expect(panel.locator('.ct-panel-status')).toHaveText('Đang dùng');
    } finally {
      await removeTestItem(request, id);
    }
  });
});
