import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, seedActiveUser } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-11-shots';

interface Item {
  id: string;
  name: string;
  active: boolean;
  admin_only: boolean;
}

// Mỗi lần chạy một người riêng: phiếu là 1 người/kỳ nên hai viewport không được dùng chung danh tính
function memberIdentity(info: TestInfo) {
  const sub = `pw-req-${Date.now()}-${info.project.name}`;
  return { sub, headers: { 'x-dev-user-sub': sub, 'x-dev-role': 'member' } };
}

async function snap(page: Page, info: TestInfo, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage });
}

async function createItem(request: APIRequestContext, name: string) {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: {
      purpose: 'item_image',
      file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') },
    },
  });
  expect(file.status()).toBe(201);
  const item = await request.post('/api/admin/items', {
    headers,
    data: { name, unit: 'cai', image_file_id: (await file.json()).id },
  });
  expect(item.status()).toBe(201);
  return (await item.json()).id as string;
}

test.describe('E2-S5 Trang Đăng ký (dev-identity member)', () => {
  test('E2-S5 lưu phiếu: chọn 3 món, lưu, tải lại thấy đúng; sửa nơi khác → hộp tải lại', async ({ page, request }, info) => {
    const me = memberIdentity(info);
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...me.headers } }));
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const month = Number(String(period.ym).slice(5));
    const items: Item[] = await (await request.get('/api/items', { headers: me.headers })).json();
    // Bỏ món "PW …" do test khác tạo (có thể bị ngừng giữa chừng ở viewport chạy song song)
    const [a, b, c] = items.filter((i) => i.active && !i.admin_only && !i.name.startsWith('PW '));

    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: `Đăng ký văn phòng phẩm tháng ${month}` })).toBeVisible();
      await expect(page.getByText('Chưa lưu phiếu tháng này')).toBeVisible();
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await expect(grid.getByText(a.name, { exact: true })).toBeVisible();
      await snap(page, info, 'empty');

      await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm ${b.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm ${b.name}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm ${c.name}`, exact: true }).click();
      const cart = page.getByRole('complementary', { name: 'Phiếu của tôi' });
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
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2} · sửa tiếp đến hết \d{2}\/\d{2}$/)).toBeVisible();
      await snap(page, info, 'after-save');

      await page.reload();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();
      for (const [item, qty] of [[a, 1], [b, 2], [c, 1]] as const) {
        await expect(cart.getByRole('spinbutton', { name: item.name, exact: true })).toHaveValue(String(qty));
      }
      await expect(page.getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();

      // Thay đổi chưa lưu → trình duyệt hỏi trước khi rời trang
      await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await expect(page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' })).toBeVisible();
      const leave = page.waitForEvent('dialog');
      void page.reload();
      const dialog = await leave;
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();

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
      expect(other.status()).toBe(200);
      await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog', { name: `Lưu phiếu tháng ${month}?` }).getByRole('button', { name: 'Lưu phiếu' }).click();
      const stale = page.getByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
      await expect(stale).toBeVisible();
      await snap(page, info, 'stale');
      await stale.getByRole('button', { name: 'Tải bản mới nhất' }).click();
      await expect(stale).toBeHidden();
      await expect(cart.getByRole('spinbutton', { name: c.name, exact: true })).toHaveValue('3');
      await expect(cart.getByRole('spinbutton', { name: a.name, exact: true })).toHaveValue('1');
    } finally {
      deleteTestUsers(me.sub);
    }
  });

  test('E2-S5 lỗi theo dòng: Hành chính ngừng món đang có trong phiếu → lưu → thông báo thấy ngay, focus dòng lỗi', async ({
    page,
    request,
  }, info) => {
    const me = memberIdentity(info);
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...me.headers } }));
    const itemName = `PW ngừng ${Date.now()}-${info.project.name}`;
    const itemId = await createItem(request, itemName);

    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill(itemName);
      await grid.getByRole('button', { name: `Thêm ${itemName}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();

      const off = await request.patch(`/api/admin/items/${itemId}`, { headers: devHeaders('admin'), data: { active: false } });
      expect(off.status()).toBe(200);
      await grid.getByRole('button', { name: `Thêm ${itemName}`, exact: true }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();

      const msg = 'Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.';
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(`Chưa lưu được — ${itemName}: ${msg}`);
      await expect(alert).toBeInViewport();
      const stepper = page.getByRole('complementary', { name: 'Phiếu của tôi' }).getByRole('spinbutton', { name: itemName, exact: true });
      await expect(stepper).toBeFocused();
      await expect(stepper).toBeInViewport();
      await expect(stepper).toHaveAccessibleDescription(msg);
      await page.screenshot({ path: `${SHOTS}/line-error-${info.project.name}.png` });
    } finally {
      deleteTestUsers(me.sub);
      await removeTestItem(request, itemId);
    }
  });
  test('V2C-T2 bố cục: 1280 phiếu cam bên phải panel lưới; 390 nút lưu nổi và thanh dưới đều thấy đủ, bấm được, không chồng nhau', async ({ page, request }, info) => {
    const me = memberIdentity(info);
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...me.headers } }));
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const items: Item[] = await (await request.get('/api/items', { headers: me.headers })).json();
    const [a] = items.filter((i) => i.active && !i.admin_only && !i.name.startsWith('PW '));
    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: `Đăng ký văn phòng phẩm tháng ${Number(String(period.ym).slice(5))}` })).toBeVisible();
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const cart = page.getByRole('complementary', { name: 'Phiếu của tôi' });
      await expect(grid.getByText(a.name, { exact: true })).toBeVisible();
      if (!isMobile(info)) {
        const g = (await grid.boundingBox())!;
        const c = (await cart.boundingBox())!;
        expect(c.x).toBeGreaterThanOrEqual(g.x + g.width);
        expect(c.width).toBeLessThanOrEqual(380);
        expect(await cart.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 244, 232)');
      } else {
        await grid.getByRole('button', { name: `Thêm ${a.name}`, exact: true }).click();
        const save = page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' });
        await expect(save).toBeVisible();
        const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
        const vh = page.viewportSize()!.height;
        const barBox = (await save.locator('xpath=..').boundingBox())!; // cả thanh nổi, không chỉ nút
        const navBox = (await nav.boundingBox())!;
        expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 0.5);
        expect(navBox.y + navBox.height).toBeLessThanOrEqual(vh + 0.5);
        for (const target of [save, ...(await nav.getByRole('link').all())]) {
          const box = (await target.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44 - 0.5);
          const hit = await target.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          });
          expect(hit).toBe(true);
        }
        await expectNoContrastViolations(page);
      }
    } finally {
      deleteTestUsers(me.sub);
    }
  });
});
