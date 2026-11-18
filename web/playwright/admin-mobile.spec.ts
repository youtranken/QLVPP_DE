import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, expectNoContrastViolations, expectTouchTargets, settled } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

const PAGES = [
  ['month', 'Kỳ tháng'],
  ['delivery', 'Giao hàng'],
  ['backlog', 'Còn nợ'],
  ['reports', 'Báo cáo & gửi NCC'],
  ['stock', 'Tủ / Kho'],
  ['catalog', 'Sản phẩm'],
  ['categories', 'Danh mục'],
  ['users', 'Danh bạ'],
  ['audit', 'Nhật ký'],
  ['config', 'Cấu hình'],
] as const;

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// Giao hàng theo người ghi tháng vào tiêu đề: "Giao hàng kỳ tháng 10"
const headingName = (title: string) => (title === 'Giao hàng' ? /^Giao hàng kỳ tháng \d+$/ : title === 'Kỳ tháng' ? /^Kỳ tháng \d+$/ : title);
const heading = (page: Page, title: string) => page.getByRole('heading', { level: 1, name: headingName(title), exact: typeof headingName(title) === 'string' });
const menu = (page: Page) => page.getByRole('dialog', { name: 'Menu quản lý' });
// Nhãn menu trùng tiêu đề trang (kể cả Danh bạ)
const menuLink = (page: Page, title: string) => {
  const label = title;
  return menu(page).getByRole('link', { name: new RegExp(`^${label.replace('&', '\\&').replace('/', '\\/')}(?! \\()`) });
};

async function openPage(page: Page, path: string, title: string) {
  await page.goto(`/admin/${path}`);
  await expect(heading(page, title)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  await expect.poll(() => overflowOf(page), { message: `cuộn ngang ở ${where}` }).toBeLessThanOrEqual(0);
}

test.describe('E9-S7 Adm D&E 390 px (dev-identity admin)', () => {
  asRole('admin');
  test.skip(({ isMobile: phone }) => !phone, 'Bố cục điện thoại chỉ kiểm ở 390 px');

  test('E9-S7 Adm D&E 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang', async ({ page }) => {
    test.setTimeout(120_000);
    await openPage(page, PAGES[0][0], PAGES[0][1]);
    for (let i = 0; i < PAGES.length; i++) {
      const [path, title] = PAGES[i];
      await expect(heading(page, title)).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expectNoHorizontalScroll(page, path);
      const sub = page.getByRole('banner').getByText(/^Kỳ hiện tại: tháng \d+ · đang mở$/);
      expect(await sub.evaluate((el) => el.scrollWidth - el.clientWidth), `dòng phụ thanh trên bị cắt ở ${path}`).toBeLessThanOrEqual(0);
      const [nextPath, nextTitle] = PAGES[(i + 1) % PAGES.length];
      await page.getByRole('button', { name: 'Mở menu quản lý' }).tap();
      await expect(menu(page)).toBeVisible();
      await expectNoHorizontalScroll(page, `${path} + menu`);
      await menuLink(page, nextTitle).tap();
      await expect(page).toHaveURL(new RegExp(`/admin/${nextPath}`));
      await expect(menu(page)).toHaveCount(0);
    }

    await openPage(page, 'catalog?view=table', 'Sản phẩm');
    await expect(page.getByRole('group', { name: 'Trạng thái' }).getByRole('button', { name: /^Đang dùng/ })).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).tap();
    const drawer = page.getByRole('dialog', { name: 'Thêm sản phẩm' });
    await expect(drawer).toBeVisible();
    await settled(page);
    expect(Math.round((await drawer.boundingBox())!.width)).toBe(390);
    await expectNoHorizontalScroll(page, 'ngăn kéo Thêm món');

    await openPage(page, 'categories/units', 'Danh mục');
    await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Thêm đơn vị tính' });
    await expect(dialog).toBeVisible();
    await settled(page);
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    await expectNoHorizontalScroll(page, 'hộp thoại Thêm đơn vị tính');
  });

  test('E9-S7 Giao hàng 390: thẻ → hộp tấm đáy → xác nhận → về ô tìm', async ({ page, request }, info) => {
    test.setTimeout(120_000);
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [
        { stock: 10, qty: 2 },
        { stock: 10, qty: 1 },
      ]);
      const [a] = seed.items;
      await page.goto('/admin/delivery');
      await page.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }).fill(seed.name);
      await expectNoContrastViolations(page);
      await page.getByRole('button', { name: `Giao…, ${seed.name}` }).tap();
      const dialog = page.getByRole('dialog', { name: `Giao cho ${seed.name}?` });
      await expect(dialog.getByRole('spinbutton', { name: `Giao lần này: ${a.name}` })).toHaveValue('2');
      await expectNoHorizontalScroll(page, 'hộp giao');
      await expectNoContrastViolations(page);
      await expectTouchTargets(page, 'hộp giao');
      await dialog.getByRole('button', { name: 'Xác nhận giao' }).tap();
      await expect(page.getByText(`Đã giao cho ${seed.name}`)).toBeVisible();
      await expect(dialog).toHaveCount(0);

      for (const [path, title] of PAGES) {
        await page.goto('/admin/delivery');
        await page.getByRole('button', { name: /, Adm D&E$/ }).tap();
        await menuLink(page, title).tap();
        await expect(page).toHaveURL(new RegExp(`/admin/${path}`));
        await expect(heading(page, title)).toBeVisible();
      }
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E9-S7 axe 390 các màn Adm D&E', async ({ page }) => {
    test.setTimeout(120_000);
    for (const [path, title] of PAGES) {
      await openPage(page, path, title);
      await expectNoContrastViolations(page);
    }
    await page.getByRole('button', { name: 'Mở menu quản lý' }).tap();
    await expect(menu(page)).toBeVisible();
    await expectNoContrastViolations(page);

    for (const [path, title] of [['month', 'Kỳ tháng'], ['delivery', 'Giao hàng'], ['backlog', 'Còn nợ'], ['categories', 'Danh mục'], ['categories/units', 'Danh mục']] as const) {
      await openPage(page, path, title);
      await expectTouchTargets(page, title);
    }
    await openPage(page, 'catalog', 'Sản phẩm');
    await expectTouchTargets(page, 'Sản phẩm');
    await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: 'Thêm sản phẩm' })).toBeVisible();
    await settled(page);
    await expectNoContrastViolations(page);

    await openPage(page, 'categories/units', 'Danh mục');
    await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).tap();
    await expect(page.getByRole('dialog', { name: 'Thêm đơn vị tính' })).toBeVisible();
    await expectNoContrastViolations(page);
  });
});
