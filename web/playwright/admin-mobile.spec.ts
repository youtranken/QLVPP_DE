import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, expectNoContrastViolations, expectTouchTargets, settled } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

const PAGES = [
  ['summary', 'Tổng hợp kỳ'],
  ['review', 'Món ngoài danh mục'],
  ['delivery', 'Giao hàng'],
  ['backlog', 'Còn nợ'],
  ['reports', 'Báo cáo & in'],
  ['stock', 'Kho'],
  ['catalog', 'Danh mục'],
  ['categories', 'Nhóm món'],
  ['units', 'Đơn vị tính'],
  ['users', 'Danh bạ'],
  ['audit', 'Nhật ký'],
  ['config', 'Cấu hình'],
] as const;

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const heading = (page: Page, title: string) => page.getByRole('heading', { level: 1, name: title, exact: true });
const menu = (page: Page) => page.getByRole('dialog', { name: 'Menu quản lý' });
const menuLink = (page: Page, title: string) => menu(page).getByRole('link', { name: new RegExp(`^${title.replace('&', '\\&')}`) });

async function openPage(page: Page, path: string, title: string) {
  await page.goto(`/admin/${path}`);
  await expect(heading(page, title)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  await expect.poll(() => overflowOf(page), { message: `cuộn ngang ở ${where}` }).toBeLessThanOrEqual(0);
}

test.describe('E9-S7 Hành chính 390 px (dev-identity admin)', () => {
  asRole('admin');
  test.skip(({ isMobile: phone }) => !phone, 'Bố cục điện thoại chỉ kiểm ở 390 px');

  test('E9-S7 Hành chính 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang', async ({ page }) => {
    test.setTimeout(120_000);
    await openPage(page, PAGES[0][0], PAGES[0][1]);
    for (let i = 0; i < PAGES.length; i++) {
      const [path, title] = PAGES[i];
      await expect(heading(page, title)).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expectNoHorizontalScroll(page, path);
      const [nextPath, nextTitle] = PAGES[(i + 1) % PAGES.length];
      await page.getByRole('button', { name: 'Mở menu quản lý' }).tap();
      await expect(menu(page)).toBeVisible();
      await expectNoHorizontalScroll(page, `${path} + menu`);
      await menuLink(page, nextTitle).tap();
      await expect(page).toHaveURL(new RegExp(`/admin/${nextPath}`));
      await expect(menu(page)).toHaveCount(0);
    }

    await openPage(page, 'catalog', 'Danh mục');
    const [first, second, third] = await Promise.all(
      [/^Đang dùng/, /^Sắp hết/, /^Hết hàng/].map(async (name) => (await page.getByRole('button', { name }).boundingBox())!),
    );
    expect(Math.round(first.y)).toBe(Math.round(second.y));
    expect(Math.round(first.width)).toBe(Math.round(second.width));
    expect(third.y).toBeGreaterThan(first.y + first.height);
    await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).tap();
    const drawer = page.getByRole('dialog', { name: 'Thêm món' });
    await expect(drawer).toBeVisible();
    await settled(page);
    expect(Math.round((await drawer.boundingBox())!.width)).toBe(390);
    await expectNoHorizontalScroll(page, 'ngăn kéo Thêm món');

    await openPage(page, 'units', 'Đơn vị tính');
    await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Thêm đơn vị tính' });
    await expect(dialog).toBeVisible();
    await settled(page);
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    await expectNoHorizontalScroll(page, 'hộp thoại Thêm đơn vị tính');
  });

  test('E9-S7 Giao hàng 390: danh sách → chi tiết → giao tất cả → về danh sách', async ({ page, request }, info) => {
    test.setTimeout(120_000);
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    try {
      seed = await seedLockedRequest(request, info, [
        { stock: 10, qty: 2 },
        { stock: 10, qty: 1 },
      ]);
      const [a] = seed.items;
      const rowName = `Mở phiếu của ${seed.name}, đã giao 0 trên 3 đơn vị`;
      await page.goto('/admin/delivery?all=1');
      await expect(page.getByRole('radio', { name: /^Tất cả/ })).toHaveAttribute('aria-checked', 'true');
      await expectNoContrastViolations(page);
      await page.getByRole('button', { name: rowName }).tap();
      await expect(page).toHaveURL(new RegExp(`request=${seed.requestId}`));
      const lines = page.getByRole('table', { name: `Các dòng của phiếu ${seed.name}` });
      const line = lines.getByRole('row').filter({ hasText: a.name });
      // Đăng ký / Đã giao / Tồn vẫn hiện trong thẻ dòng (trước đây bị ẩn ở < 768)
      const cells = line.getByRole('cell');
      for (const [i, value] of [[2, '2'], [3, '0'], [4, '10']] as const) {
        await expect(cells.nth(i)).toBeVisible();
        await expect(cells.nth(i)).toHaveText(value);
      }
      await expect(page.getByRole('list', { name: 'Danh sách phiếu' })).toHaveCount(0);
      await expectNoHorizontalScroll(page, 'chi tiết Giao hàng');
      await expectNoContrastViolations(page);
      await expect(page.getByRole('button', { name: 'Giao tất cả' })).toBeVisible();
      await expect(line.getByRole('button', { name: `Giao ${a.name}` })).toBeVisible();
      await expectTouchTargets(page, 'Giao hàng chi tiết');

      await page.getByRole('button', { name: 'Quay lại danh sách phiếu' }).tap();
      await expect(page).not.toHaveURL(/request=/);
      await expect(page).toHaveURL(/all=1/);
      await page.getByRole('button', { name: rowName }).tap();
      await page.getByRole('button', { name: 'Giao tất cả' }).tap();
      await expect(page.getByText(`Đã giao đủ phiếu · Đã báo cho ${seed.name}.`)).toBeVisible();
      await expect(page).not.toHaveURL(/request=/, { timeout: 5_000 });
      await expect(page).toHaveURL(/all=1/);
      await expect(page.getByRole('button', { name: `Mở phiếu của ${seed.name}, đã giao 3 trên 3 đơn vị` })).toBeVisible();

      for (const [path, title] of PAGES) {
        await page.goto(`/admin/delivery?request=${seed.requestId}`);
        await page.getByRole('button', { name: /, Hành chính$/ }).tap();
        await menuLink(page, title).tap();
        await expect(page).toHaveURL(new RegExp(`/admin/${path}`));
        await expect(heading(page, title)).toBeVisible();
      }
    } finally {
      seed?.cleanup();
      release();
    }
  });

  test('E9-S7 axe 390 các màn Hành chính', async ({ page }) => {
    test.setTimeout(120_000);
    for (const [path, title] of PAGES) {
      await openPage(page, path, title);
      await expectNoContrastViolations(page);
    }
    await page.getByRole('button', { name: 'Mở menu quản lý' }).tap();
    await expect(menu(page)).toBeVisible();
    await expectNoContrastViolations(page);

    for (const [path, title] of [['review', 'Món ngoài danh mục'], ['delivery', 'Giao hàng'], ['backlog', 'Còn nợ'], ['categories', 'Nhóm món'], ['units', 'Đơn vị tính']] as const) {
      await openPage(page, path, title);
      await expectTouchTargets(page, title);
    }
    await openPage(page, 'catalog', 'Danh mục');
    await expectTouchTargets(page, 'Danh mục');
    await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: 'Thêm món' })).toBeVisible();
    await settled(page);
    await expectNoContrastViolations(page);

    await openPage(page, 'units', 'Đơn vị tính');
    await page.getByRole('main').getByRole('button', { name: 'Thêm đơn vị tính' }).tap();
    await expect(page.getByRole('dialog', { name: 'Thêm đơn vị tính' })).toBeVisible();
    await expectNoContrastViolations(page);
  });
});
