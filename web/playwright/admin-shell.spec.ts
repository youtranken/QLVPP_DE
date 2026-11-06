import { expect, test, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, seedPwItem } from './helpers';

const NAV_ORDER = ['Tháng này', 'Tổng hợp kỳ', 'Gửi ADM', 'Hàng về', 'Giao hàng', 'Còn nợ', 'Báo cáo & in', 'Danh mục món', 'Tủ / Kho', 'Món ngoài danh mục', 'Nhóm & đơn vị', 'Nhân viên', 'Nhật ký', 'Cấu hình'];
const OPEN_MENU = /^(Mở menu quản lý|Open admin menu)$/;

// Bell: topbar on phone, bottom of sidebar (next to avatar) elsewhere
const bellOf = (page: Page, mobile: boolean) =>
  (mobile ? page.getByRole('banner') : page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' })).getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ });

const sidebarWidth = (page: Page) =>
  page.getByRole('navigation', { name: 'Menu quản lý' }).evaluate((nav) => nav.parentElement!.getBoundingClientRect().width);

test.describe('E9-S1 shell Hành chính (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S1 shell Hành chính: sidebar 3 nhóm, 14 mục theo luồng chuẩn (cột và menu điện thoại như nhau), thẻ kỳ, chuông, đổi en đổi nhãn sidebar', async ({ page }, info) => {
    await page.goto('/admin/catalog');
    await expect(page.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeVisible();
    await expect(bellOf(page, isMobile(info))).toBeVisible();
    if (isMobile(info)) {
      await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
      await page.getByRole('button', { name: OPEN_MENU }).click();
    }
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(side.getByRole('group')).toHaveCount(3);
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
    await page.goto('/admin/home');
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
    if (isMobile(info)) await expect(page.getByRole('button', { name: OPEN_MENU })).toBeVisible();
    else await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    if (isMobile(info)) {
      await page.getByRole('button', { name: OPEN_MENU }).click();
      await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toBeVisible();
    }
    await expectNoContrastViolations(page);
  });

  test('v2: số đếm trên mục đang chọn (nền trắng) vẫn đọc được, đạt axe', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    // Số đếm Giao hàng = số người chưa nhận: giả 5 người (không dòng) cho kỳ khóa gần nhất
    await page.route('**/api/admin/periods/*/delivery-people', async (route) => {
      const people = Array.from({ length: 5 }, (_, i) => ({ user_sub: `pw-badge-${i}`, full_name: `PW Badge ${i}`, department: null, user_status: 'active', request_id: null, status: 'pending', owed_lines: 0, open_lines: 0, lines: [] }));
      await route.fulfill({ status: 200, json: { ym: '2000-01', people } });
    });
    await page.goto('/admin/delivery');
    const link = page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('link', { name: /^Giao hàng/ });
    await expect(link).toHaveAttribute('aria-current', 'page');
    const badge = link.getByText('5', { exact: true });
    await expect(badge).toBeVisible();
    const [color, badgeBg, linkBg] = await Promise.all([
      badge.evaluate((el) => getComputedStyle(el).color),
      badge.evaluate((el) => getComputedStyle(el).backgroundColor),
      link.evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(color, 'chữ số đếm khác nền mục đang chọn').not.toBe(linkBg);
    expect(badgeBg, 'nền chấm số khác nền mục đang chọn').not.toBe(linkBg);
    await expectNoContrastViolations(page);
  });

  test('v2: bảng thông báo mở vẫn đủ tương phản (chuông trên nền tối)', async ({ page }, info) => {
    await page.goto('/admin/home');
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
    await bellOf(page, isMobile(info)).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    expect(await panel.locator('strong').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(14, 42, 51)');
    await expectNoContrastViolations(page);
  });

  test('v2: đăng xuất lỗi hiện câu báo đủ tương phản trên nền tối', async ({ page }, info) => {
    await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.goto('/admin/home');
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
    if (isMobile(info)) await page.getByRole('button', { name: OPEN_MENU }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /đăng xuất/i })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test('E9-S1 điểm gãy 767/768 và 1279/1280', async ({ page }) => {
    await page.goto('/admin/home');
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
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
    await page.goto('/admin/home');
    await expect(page.getByText('VPP Công trình', { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1024, height: 720 });
    await bellOf(page, false).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    expect(box.x).toBeGreaterThanOrEqual(72);
  });

  test('v2: hàng người dùng 252px đọc được: tên >= 100px, vai trò một dòng, công cụ nằm dưới', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.goto('/admin/home');
    const user = page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' });
    const name = user.locator('b');
    const role = user.locator('small');
    await expect(name).toBeVisible();
    expect((await name.boundingBox())!.width).toBeGreaterThanOrEqual(100);
    expect((await role.boundingBox())!.height).toBeLessThanOrEqual(20);
    const bell = (await bellOf(page, false).boundingBox())!;
    const logout = (await user.getByRole('button', { name: 'Đăng xuất' }).boundingBox())!;
    expect(bell.y).toBeGreaterThanOrEqual((await name.boundingBox())!.y + 10);
    expect(logout.x + logout.width).toBeLessThanOrEqual(252);
  });

  test('V2D-20 14 mục ở 1280×720: nav cuộn được nếu cần, khối tài khoản vẫn trong màn, mục cuối với tới được', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/home');
    const nav = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(nav.getByRole('group', { name: 'Hằng tháng' }).getByRole('link')).toHaveCount(7);
    await expect(page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' })).toBeInViewport({ ratio: 1 });
    expect(await nav.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
    await nav.getByRole('link', { name: 'Cấu hình' }).scrollIntoViewIfNeeded();
    await expect(nav.getByRole('link', { name: 'Cấu hình' })).toBeInViewport();
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

// Mọi route trong khung Hành chính (bảng route của spec), kể cả 404
const FULL_WIDTH_ROUTES = ['home', 'summary', 'send-adm', 'arrivals', 'delivery', 'delivery/classic', 'backlog', 'reports', 'catalog', 'stock', 'review', 'categories', 'categories/units', 'users', 'audit', 'config', 'khong-co-trang'];

const panelAndViewport = (page: Page) =>
  page.getByRole('main').evaluate((main) => ({ panel: main.firstElementChild!.getBoundingClientRect().width, vw: document.documentElement.clientWidth, scroll: document.scrollingElement!.scrollWidth }));

test.describe('V2D-13 toàn màn hình và panel phủ', () => {
  asRole('admin');

  test('V2D-13 full width every route', async ({ page }, info) => {
    test.setTimeout(240_000);
    for (const width of isMobile(info) ? [390] : [1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of FULL_WIDTH_ROUTES) {
        await page.goto(`/admin/${path}`);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        const m = await panelAndViewport(page);
        if (width === 390) expect(m.scroll, `${path} cuộn ngang ở 390`).toBeLessThanOrEqual(m.vw);
        else expect(Math.abs(m.panel - (m.vw - 252 - 40)), `${path} ở ${width}: panel ${m.panel}, vw ${m.vw}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test('V2D-13 panel phủ Danh mục: không đẩy lưới, nền mờ phủ sidebar, 767/768, Back và F5, axe 390', async ({ page }, info) => {
    const item = await seedPwItem(page);
    try {
      await page.goto(`/admin/catalog?q=${encodeURIComponent(item.name)}`);
      const card = page.getByRole('article').filter({ hasText: item.name });
      await expect(card).toBeVisible();
      const before = (await card.boundingBox())!;
      const length = await page.evaluate(() => history.length);
      await card.getByRole('button', { name: `Sửa ${item.name}` }).click();
      const panel = page.getByRole('dialog', { name: `Sửa món ${item.name}` });
      await expect(panel).toBeVisible();
      expect(await page.evaluate(() => history.length)).toBe(length + 1);
      expect(await card.boundingBox()).toEqual(before);
      if (isMobile(info)) {
        await expect(panel.getByRole('button', { name: '← Đóng' })).toBeVisible();
        expect(Math.round((await panel.boundingBox())!.width)).toBe(390);
        await expectNoContrastViolations(page);
      } else {
        const onScrim = await page.evaluate(() => {
          const hit = document.elementFromPoint(10, 10)!;
          return getComputedStyle(hit).position === 'fixed' && !hit.closest('nav, main, [role="dialog"]');
        });
        expect(onScrim, 'điểm (10,10) thuộc nền mờ, không phải sidebar').toBe(true);
        expect(Math.round((await panel.boundingBox())!.width)).toBe(440);
        await page.setViewportSize({ width: 767, height: 900 });
        await expect(panel.getByRole('button', { name: '← Đóng' })).toBeVisible();
        expect(Math.round((await panel.boundingBox())!.width)).toBe(767);
        await page.setViewportSize({ width: 768, height: 900 });
        await expect(panel.getByRole('button', { name: '← Đóng' })).toHaveCount(0);
        expect(Math.round((await panel.boundingBox())!.width)).toBe(440);
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      await page.goBack();
      await expect(panel).toBeHidden();
      expect(new URL(page.url()).searchParams.get('item')).toBeNull();
      await page.goto(`/admin/catalog?item=${item.id}`);
      await expect(panel).toBeVisible();
      await page.reload();
      await expect(panel).toBeVisible();
      await panel.getByLabel(/^Tên món/).fill(`${item.name} X`);
      const discard = page.getByRole('dialog', { name: 'Bỏ thay đổi?' });
      await page.goBack();
      await expect(discard).toBeVisible();
      await discard.getByRole('button', { name: 'Ở lại' }).click();
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel(/^Tên món/)).toHaveValue(`${item.name} X`);
      expect(new URL(page.url()).searchParams.get('item')).toBe(item.id);
      await page.goBack();
      await expect(discard).toBeVisible();
      await discard.getByRole('button', { name: 'Bỏ thay đổi' }).click();
      await expect(panel).toBeHidden();
      const listUrl = new URL(page.url());
      expect(listUrl.pathname, 'Back lần hai về danh sách, không về trang trước').toBe('/admin/catalog');
      expect(listUrl.searchParams.get('item')).toBeNull();
    } finally {
      await removeTestItem(page.request, item.id);
    }
  });
});

test.describe('E9-S1 trang member giữ giao diện cũ', () => {
  test('E9-S1 trang member giữ giao diện cũ', async ({ page }) => {
    let role: 'admin' | 'member' = 'admin';
    await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...devHeaders(role) } }));

    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
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
