import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { cartOf, closeCart, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, openCart, removeTestItem } from './helpers';
import { asNewMember, createItem } from './request-helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-11-shots';

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

// Lưu phiếu, lỗi theo dòng; bố cục/lọc ở request-layout.spec.ts, phiếu cam/sheet ở request-cart.spec.ts
test.describe('E2-S5 Trang Đăng ký (dev-identity member)', () => {
  test('E2-S5 lưu phiếu: chọn 3 món, lưu, tải lại thấy đúng; sửa nơi khác → hộp tải lại', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const month = Number(String(period.ym).slice(5));
    // Ba món riêng (tên ngắn, max_qty đủ lớn) để test không phụ thuộc dữ liệu danh mục thật
    const stamp = `${Date.now()}-${info.project.name}`;
    const ids: string[] = [];
    const [a, b, c] = ['A', 'B', 'C'].map((k) => ({ id: '', name: `PW lưu ${k} ${stamp}` }));
    for (const it of [a, b, c]) {
      it.id = await createItem(request, it.name);
      ids.push(it.id);
    }

    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: `Đăng ký văn phòng phẩm tháng ${month}` })).toBeVisible();
      await expect(page.getByText('Chưa lưu phiếu tháng này')).toBeVisible();
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      // Lọc theo tiền tố riêng để 3 món nằm trong tầm nhìn dù danh mục thật dài
      const search = grid.getByRole('searchbox', { name: 'Tìm món' });
      await search.fill(`PW lưu`);
      await expect(grid.getByText(a.name, { exact: true })).toBeVisible();
      await snap(page, info, 'empty');

      await grid.getByRole('button', { name: `Thêm vào phiếu: ${a.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${b.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm ${b.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${c.name}`, exact: true }).click();
      const cart = cartOf(page);
      await openCart(page, info);
      await expect(cart.getByText('3 loại món · 4 đơn vị')).toBeVisible();
      const save = page.getByRole('button', { name: '3 thay đổi chưa lưu · Lưu' });
      await expect(save).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'filled-cart', !isMobile(info));

      await save.click();
      const confirm = page.getByRole('dialog', { name: `Lưu phiếu tháng ${month}?` });
      await expect(confirm.getByRole('cell', { name: b.name, exact: true })).toBeVisible();
      await snap(page, info, 'confirm');
      await confirm.getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(confirm).toBeHidden();
      await expect(page.getByText(`Đã lưu phiếu tháng ${month}`)).toBeVisible();
      await expect(page.getByRole('region', { name: /^Đăng ký văn phòng phẩm/ }).getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
      await snap(page, info, 'after-save');

      await page.reload();
      await expect(page.getByRole('region', { name: /^Đăng ký văn phòng phẩm/ }).getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
      await openCart(page, info);
      // NV-19: giỏ một chế độ — phiếu đã lưu có ngay ô số lượng, không còn "Sửa phiếu"
      await expect(cart.getByRole('button', { name: 'Sửa phiếu' })).toHaveCount(0);
      for (const [item, qty] of [[a, 1], [b, 2], [c, 1]] as const) {
        await expect(cart.getByRole('spinbutton', { name: item.name, exact: true })).toHaveValue(String(qty));
      }
      // Chưa đổi gì: không nút Lưu (NV-20), không "Hủy"; đổi rồi thì "Hủy" là nút phụ bỏ thay đổi (NV-22)
      await expect(cart.getByRole('button', { name: /Lưu phiếu/ })).toHaveCount(0);
      await expect(cart.getByRole('button', { name: 'Hủy', exact: true })).toHaveCount(0);
      await cart.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await cart.getByRole('button', { name: 'Hủy', exact: true }).click();
      await expect(cart.getByRole('spinbutton', { name: a.name, exact: true })).toHaveValue('1');
      await closeCart(page, info);
      await search.fill(`PW lưu`);

      // Thay đổi chưa lưu → trình duyệt hỏi trước khi rời trang
      await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await expect(page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' })).toBeVisible();
      const leave = page.waitForEvent('dialog');
      void page.reload();
      const dialog = await leave;
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
      await expect(page.getByRole('region', { name: /^Đăng ký văn phòng phẩm/ }).getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
      await search.fill(`PW lưu`);

      // Thiết bị khác sửa phiếu → lưu từ tab này bị STALE_UPDATE
      const view = await (await request.get(`/api/me/request?ym=${period.ym}`, { headers: me.headers })).json();
      const other = await request.put('/api/me/request/lines', {
        headers: me.headers,
        data: {
          ym: period.ym,
          expected_updated_at: view.updated_at,
          lines: view.lines.map((l: { id: string; item_id: string; qty: number }) => ({ id: l.id, qty: l.item_id === c.id ? 3 : l.qty })),
        },
      });
      expect(other.status(), await other.text()).toBe(200);
      await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog', { name: `Lưu phiếu tháng ${month}?` }).getByRole('button', { name: 'Lưu phiếu' }).click();
      const stale = page.getByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
      await expect(stale).toBeVisible();
      await snap(page, info, 'stale');
      await stale.getByRole('button', { name: 'Tải bản mới nhất' }).click();
      await expect(stale).toBeHidden();
      await openCart(page, info);
      await expect(cart.getByRole('spinbutton', { name: c.name, exact: true })).toHaveValue('3');
      await expect(cart.getByRole('spinbutton', { name: a.name, exact: true })).toHaveValue('1');
    } finally {
      deleteTestUsers(me.sub);
      for (const id of ids) await removeTestItem(request, id);
    }
  });

  test('E2-S5 lỗi theo dòng: Adm D&E ngừng món đang có trong phiếu → lưu → thông báo thấy ngay, focus dòng lỗi', async ({
    page,
    request,
  }, info) => {
    const me = await asNewMember(page, info);
    const itemName = `PW ngừng ${Date.now()}-${info.project.name}`;
    const itemId = await createItem(request, itemName);

    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill(itemName);
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${itemName}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(page.getByRole('region', { name: /^Đăng ký văn phòng phẩm/ }).getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();

      const off = await request.patch(`/api/admin/items/${itemId}`, { headers: devHeaders('admin'), data: { active: false } });
      expect(off.status()).toBe(200);
      await grid.getByRole('button', { name: `Thêm ${itemName}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();

      const msg = 'Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.';
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(`Chưa lưu được — ${itemName}: ${msg}`);
      await expect(alert).toBeInViewport();
      // 390: sheet phiếu tự mở để thấy dòng lỗi; thông báo nằm trong sheet
      const stepper = cartOf(page).getByRole('spinbutton', { name: itemName, exact: true });
      await expect(stepper).toBeFocused();
      await expect(stepper).toBeInViewport();
      await expect(stepper).toHaveAccessibleDescription(msg);
      await page.screenshot({ path: `${SHOTS}/line-error-${info.project.name}.png` });
    } finally {
      deleteTestUsers(me.sub);
      await removeTestItem(request, itemId);
    }
  });
});
