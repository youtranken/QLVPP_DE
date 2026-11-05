import { expect, test, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile } from './helpers';

const NAV_ORDER = ['Tổng hợp kỳ', 'Giao hàng', 'Báo cáo & in', 'Danh mục món', 'Tủ / Kho', 'Món ngoài danh mục', 'Nhóm món', 'Đơn vị tính', 'Nhân viên', 'Nhật ký', 'Cấu hình', 'Còn nợ'];
const OPEN_MENU = /^(Mở menu quản lý|Open admin menu)$/;

// Bell: topbar on phone, bottom of sidebar (next to avatar) elsewhere
const bellOf = (page: Page, mobile: boolean) =>
  (mobile ? page.getByRole('banner') : page.locator('.side__user')).getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ });

const sidebarWidth = (page: Page) =>
  page.getByRole('navigation', { name: 'Menu quản lý' }).evaluate((nav) => nav.parentElement!.getBoundingClientRect().width);

test.describe('E9-S1 shell Hành chính (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S1 shell Hành chính: sidebar 4 nhóm 12 mục, thẻ kỳ, chuông, đổi en đổi nhãn sidebar', async ({ page }, info) => {
    await page.goto('/admin/catalog');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
    await expect(bellOf(page, isMobile(info))).toBeVisible();
    if (isMobile(info)) {
      await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
      await page.getByRole('button', { name: OPEN_MENU }).click();
    }
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(side.getByRole('group')).toHaveCount(4);
    const titles = await side.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('title')));
    expect(titles).toEqual(NAV_ORDER);
    await expect(side.getByRole('link', { name: 'Danh mục món', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: /Phiếu của tôi/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng \d+ · đang mở/ })).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);

    if (!isMobile(info)) await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
    await page.getByRole('radio', { name: 'English' }).click();
    const sideEn = page.getByRole('navigation', { name: 'Admin menu' });
    await expect(sideEn.getByRole('group', { name: 'Monthly' })).toBeVisible();
    await expect(sideEn.getByRole('link', { name: 'Categories' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Current sign-up period: month \d+ · open/ })).toBeVisible();
    await page.getByRole('radio', { name: 'Tiếng Việt' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('group', { name: 'Hằng tháng' })).toBeVisible();
  });

  test('v2: nhãn dài "Món ngoài danh mục" không vượt cột sidebar 252', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.goto('/admin/catalog');
    const box = await page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('link', { name: /Món ngoài danh mục/ }).boundingBox();
    expect(box!.width).toBeLessThanOrEqual(252);
  });

  test('v2: khung teal + panel, đạt axe', async ({ page }, info) => {
    await page.goto('/admin/summary');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    if (isMobile(info)) await expect(page.getByRole('button', { name: OPEN_MENU })).toBeVisible();
    else await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toBeVisible();
    await expect(page.locator('main .shell__panel')).toBeVisible();
    if (isMobile(info)) {
      await page.getByRole('button', { name: OPEN_MENU }).click();
      await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toBeVisible();
    }
    await expectNoContrastViolations(page);
  });

  test('v2: bảng thông báo mở vẫn đủ tương phản (chuông trên nền tối)', async ({ page }, info) => {
    await page.goto('/admin/summary');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    await bellOf(page, isMobile(info)).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    expect(await panel.locator('strong').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(14, 42, 51)');
    await expectNoContrastViolations(page);
  });

  test('v2: đăng xuất lỗi hiện câu báo đủ tương phản trên nền tối', async ({ page }, info) => {
    await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.goto('/admin/summary');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    if (isMobile(info)) await page.getByRole('button', { name: OPEN_MENU }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /đăng xuất/i })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test('E9-S1 điểm gãy 767/768 và 1279/1280', async ({ page }) => {
    await page.goto('/admin/summary');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    for (const [width, expected] of [
      [768, 72],
      [1279, 72],
      [1280, 252],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole('button', { name: OPEN_MENU })).toHaveCount(0);
      await expect.poll(() => sidebarWidth(page), { message: `sidebar ở ${width}px` }).toBe(expected);
    }
    await page.setViewportSize({ width: 767, height: 800 });
    await expect(page.getByRole('button', { name: OPEN_MENU })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
    await expect.poll(async () => (await page.getByRole('main').boundingBox())?.x).toBe(0);
  });

  test('E9-S1 máy tính bảng: mục chỉ còn icon nhưng vẫn có tên, avatar mở đổi ngôn ngữ và đăng xuất', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/admin/stock');
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    const stock = side.getByRole('link', { name: /^Tủ \/ Kho/ });
    await expect(stock).toHaveAttribute('aria-current', 'page');
    await expect(stock).toHaveAttribute('title', 'Tủ / Kho');
    expect((await stock.boundingBox())!.width).toBeLessThanOrEqual(48);
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tài khoản và ngôn ngữ' }).click();
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toBeVisible();
  });

  test('v2: không còn đầu sidebar thương hiệu; máy tính bảng vẫn bấm được chuông, panel nằm trọn màn hình', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở máy tính');
    await page.goto('/admin/summary');
    await expect(page.locator('.side__brand')).toHaveCount(0);
    await page.setViewportSize({ width: 1024, height: 720 });
    await bellOf(page, false).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    expect(box.x).toBeGreaterThanOrEqual(72);
  });

  test('E9-S1 khối tài khoản luôn trong màn hình, chuông nổi trên nội dung, số đếm không bị cắt', async ({ page }, info) => {
    await page.goto('/admin/summary');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    const crumbs = page.getByRole('navigation', { name: 'Vị trí' });
    if (isMobile(info)) {
      await expect(crumbs).toBeHidden();
      await page.getByRole('button', { name: OPEN_MENU }).click();
    } else {
      await expect(crumbs).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeInViewport({ ratio: 1 });
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    const overflow = await side.getByRole('link').evaluateAll((links) =>
      links.filter((a) => a.getBoundingClientRect().right > a.closest('nav')!.parentElement!.getBoundingClientRect().right).map((a) => a.getAttribute('title')),
    );
    expect(overflow).toEqual([]);
    if (isMobile(info)) return;

    for (const height of [800, 720]) {
      await page.setViewportSize({ width: 1280, height });
      await page.goto('/admin/review');
      await expect(side.getByRole('link', { name: /^Cấu hình/ })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeInViewport({ ratio: 1 });
      const clipped = await side.getByRole('link').evaluateAll((links) =>
        links.map((a) => a.querySelector('span')!).filter((l) => l.scrollWidth > l.clientWidth).map((l) => l.textContent),
      );
      expect(clipped, `nhãn bị cắt ở 1280×${height}`).toEqual([]);
    }
    await page.setViewportSize({ width: 1280, height: 800 });

    await bellOf(page, isMobile(info)).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    expect(box.x).toBeGreaterThanOrEqual(252);
    const onTop = await panel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.right - 8, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
    expect(onTop).toBe(true);
  });
});

test.describe('E9-S1 trang member giữ giao diện cũ', () => {
  test('E9-S1 trang member giữ giao diện cũ', async ({ page }) => {
    let role: 'admin' | 'member' = 'admin';
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...devHeaders(role) } }));

    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(215, 234, 239)');
    expect(await page.getByRole('heading', { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Be Vietnam Pro');

    role = 'member';
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.dataset.shell)).toBe('member');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(244, 247, 245)');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Nunito');
  });
});
