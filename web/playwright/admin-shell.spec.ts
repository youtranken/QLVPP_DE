import { expect, test, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, seedPwItem } from './helpers';

const NAV_ORDER = ['Việc hôm nay', 'Kỳ tháng', 'Báo cáo & gửi NCC', 'Nhận hàng', 'Giao hàng', 'Còn nợ', 'Sản phẩm', 'Tủ / Kho', 'Danh mục', 'Danh bạ', 'Nhật ký', 'Cấu hình'];
const OPEN_MENU = /^(Mở menu quản lý|Open admin menu)$/;

// Bell: topbar on phone, bottom of sidebar (next to avatar) elsewhere
const bellOf = (page: Page, mobile: boolean) =>
  (mobile ? page.getByRole('banner') : page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' })).getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ });

const sidebarWidth = (page: Page) =>
  page.getByRole('navigation', { name: 'Menu quản lý' }).evaluate((nav) => nav.parentElement!.getBoundingClientRect().width);

test.describe('E9-S1 shell Adm D&E (dev-identity admin)', () => {
  asRole('admin');

  test('E9-S1 shell Adm D&E: sidebar 3 nhóm, 12 mục theo luồng chuẩn (TC-06 Việc hôm nay đứng đầu) (cột và menu điện thoại như nhau), thẻ kỳ, chuông, đổi en đổi nhãn sidebar', async ({ page }, info) => {
    await page.goto('/admin/catalog');
    await expect(page.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
    await expect(bellOf(page, isMobile(info))).toBeVisible();
    if (isMobile(info)) {
      await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
      await page.getByRole('button', { name: OPEN_MENU }).click();
    }
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(side.getByRole('group')).toHaveCount(3);
    // title chỉ còn ở cột thu gọn hoặc khi nhãn bị cắt: đọc chữ nhãn của từng mục
    const labels = await side.getByRole('link').evaluateAll((links) => links.map((a) => a.querySelector('.side__label')?.textContent?.trim()));
    expect(labels).toEqual(NAV_ORDER);
    await expect(side.getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: /Phiếu của tôi/ })).toHaveCount(0);
    const periodCard = page.getByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng \d+ · đang mở/ });
    await expect(periodCard).toBeVisible();
    await expect(periodCard).toHaveAttribute('href', /^\/admin\/month\?ym=\d{4}-\d{2}$/);
    if (isMobile(info)) await expectNoContrastViolations(page);

    if (!isMobile(info)) await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
    await page.getByRole('radio', { name: 'English' }).click();
    const sideEn = page.getByRole('navigation', { name: 'Admin menu' });
    await expect(sideEn.getByRole('group', { name: 'Monthly' })).toBeVisible();
    await expect(sideEn.getByRole('link', { name: 'Categories' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Current sign-up period: (January|February|March|April|May|June|July|August|September|October|November|December) · open/ })).toBeVisible();
    await page.getByRole('radio', { name: 'Tiếng Việt' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('group', { name: 'Hằng tháng' })).toBeVisible();
  });

  test('v2: nhãn dài "Báo cáo & gửi NCC" không vượt cột sidebar 252', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.goto('/admin/catalog');
    const box = await page.getByRole('navigation', { name: 'Menu quản lý' }).getByRole('link', { name: /Báo cáo & gửi NCC/ }).boundingBox();
    expect(box!.width).toBeLessThanOrEqual(252);
  });

  test('v2: khung teal + panel, đạt axe', async ({ page }, info) => {
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
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
    // Số đếm Giao hàng = số thẻ Chưa nhận: giả 5 người chưa nhận cho kỳ khóa gần nhất
    await page.route('**/api/admin/periods/*/delivery-people', async (route) => {
      const people = Array.from({ length: 5 }, (_, i) => ({ user_sub: `pw-badge-${i}`, full_name: `PW Badge ${i}`, department: null, user_status: 'active', request_id: null, status: 'pending', owed_lines: 0, open_lines: 1, has_pending: true, has_debt: false, deliverable_now: true, lines: [] }));
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

  test('AD-01 AD-02 số sidebar trùng số ở trang đích: Giao hàng = thẻ Chưa nhận, Kỳ tháng mở đúng kỳ có món chờ duyệt', async ({ page }, info) => {
    test.skip(isMobile(info), 'sidebar chỉ ở ≥ 768');
    await page.route('**/api/admin/periods/*/delivery-people', async (route) => {
      // 2 người tủ trống vẫn là "Chưa nhận": số không còn theo "giao được ngay"
      const people = Array.from({ length: 5 }, (_, i) => ({ user_sub: `pw-ad02-${i}`, full_name: `PW AD02 ${i}`, department: null, user_status: 'active', request_id: null, status: 'pending', owed_lines: 0, open_lines: 1, has_pending: true, has_debt: false, deliverable_now: i < 3, lines: [] }));
      await route.fulfill({ status: 200, json: { ym: '2000-01', people } });
    });
    await page.route('**/api/admin/review?status=pending', (route) =>
      route.fulfill({ status: 200, json: { items: [{ line_id: 'pw-l1', period_ym: '2000-01', user_sub: 'pw-a' }, { line_id: 'pw-l2', period_ym: '2000-01', user_sub: 'pw-b' }, { line_id: 'pw-l3', period_ym: '2000-02', user_sub: 'pw-c' }] } }),
    );
    await page.goto('/admin/delivery');
    const nav = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(nav.getByRole('link', { name: /^Giao hàng/ }).getByText('5', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Chưa nhận/ })).toHaveText(/^Chưa nhận\s*5\D/);
    const month = nav.getByRole('link', { name: /^Kỳ tháng/ });
    await expect(month.getByText('2', { exact: true })).toBeVisible();
    await expect(month).toHaveAttribute('href', '/admin/month?ym=2000-01&chip=pending');
  });

  test('v2: bảng thông báo mở vẫn đủ tương phản', async ({ page }, info) => {
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    await bellOf(page, isMobile(info)).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    expect(await panel.locator('strong').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(17, 26, 44)');
    await expectNoContrastViolations(page);
  });

  test('Đăng xuất = form POST điều hướng cả trang tới /api/auth/logout (csrf trong thân), không qua fetch', async ({ page }, info) => {
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    // Không để dev api xử lý thật: chỉ bắt request điều hướng
    await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'logged-out' }));
    if (isMobile(info)) await page.getByRole('button', { name: OPEN_MENU }).click();
    const nav = page.waitForRequest((r) => r.url().endsWith('/api/auth/logout'));
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    const req = await nav;
    expect(req.method()).toBe('POST');
    expect(req.isNavigationRequest()).toBe(true);
    expect(new URLSearchParams(req.postData() ?? '').get('ui_locales')).toBe('vi');
    await expect(page.getByText('logged-out')).toBeVisible();
  });

  test('E9-S1 điểm gãy 767/768 và 1279/1280', async ({ page }) => {
    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    for (const [width, expected] of [
      [768, 72],
      [1279, 72],
      [1280, 236],
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
    await expect(page.getByRole('button', { name: /^Đăng xuất/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tài khoản và ngôn ngữ' }).click();
    await expect(page.getByRole('button', { name: /^Đăng xuất/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toBeVisible();
  });

  test('Q2: đầu sidebar có logo + QLVPP; máy tính bảng vẫn bấm được chuông, panel nằm trọn màn hình', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở máy tính');
    await page.goto('/admin/month');
    await expect(page.locator('.side').getByRole('link', { name: 'QLVPP' })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 720 });
    await bellOf(page, false).click();
    const panel = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    expect(box.x).toBeGreaterThanOrEqual(72);
  });

  test('TC-01 thanh trên trắng 1280: đường dẫn "QLVPP › Kỳ tháng", tên + vai một dòng, chuông và Đăng xuất bên phải', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.goto('/admin/month');
    const header = page.locator('.adm-head');
    await expect(header.getByRole('navigation', { name: 'Đường dẫn' })).toContainText('QLVPP›Kỳ tháng');
    expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    const user = page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' });
    expect((await user.locator('small').boundingBox())!.height).toBeLessThanOrEqual(20);
    const bell = (await bellOf(page, false).boundingBox())!;
    const logout = (await user.getByRole('button', { name: /^Đăng xuất/ }).boundingBox())!;
    for (const b of [bell, logout]) expect(b.y + b.height).toBeLessThanOrEqual(60);
    expect(bell.x).toBeGreaterThan(1280 / 2);
  });

  test('TC-01 cuộn Sản phẩm 1280: đầu cột dính ngay dưới thanh trên (không bị che), đầu nhóm dưới đầu cột', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.goto('/admin/catalog?view=table');
    const th = page.locator('.table thead th').first();
    await expect(th).toBeVisible();
    await page.mouse.wheel(0, 900);
    // Chờ cuộn xong (đầu cột đã lên dính) rồi mới đo: poll ≥ 60 đúng ngay từ trước khi cuộn nên không chờ được gì
    await expect.poll(async () => (await th.boundingBox())!.y).toBeLessThan(62);
    expect((await th.boundingBox())!.y).toBeGreaterThanOrEqual(60);
    const head = await th.evaluate((el) => document.elementFromPoint(el.getBoundingClientRect().left + 20, el.getBoundingClientRect().top + 18)?.closest('th') === el);
    expect(head, 'đầu cột thấy được, không nằm dưới thanh trên').toBe(true);
  });

  test('V2D-20 12 mục ở 1280×720: nav cuộn được nếu cần, khối tài khoản vẫn trong màn, mục cuối với tới được', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1280');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/month');
    const nav = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(nav.getByRole('group', { name: 'Hằng tháng' }).getByRole('link')).toHaveCount(6);
    await expect(page.getByRole('group', { name: 'Tài khoản và ngôn ngữ' })).toBeInViewport({ ratio: 1 });
    expect(await nav.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
    await nav.getByRole('link', { name: 'Cấu hình' }).scrollIntoViewIfNeeded();
    await expect(nav.getByRole('link', { name: 'Cấu hình' })).toBeInViewport();
  });

  test('E9-S1 khối tài khoản luôn trong màn hình, chuông nổi trên nội dung, số đếm không bị cắt', async ({ page }, info) => {
    await page.goto('/admin/stock');
    await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
    const crumbs = page.getByRole('navigation', { name: 'Vị trí' });
    if (isMobile(info)) {
      await expect(crumbs).toBeHidden();
      await page.getByRole('button', { name: OPEN_MENU }).click();
    } else {
      // đường dẫn nằm ở thanh trên, đầu trang không lặp
      await expect(crumbs).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Đường dẫn' })).toContainText('Tủ / Kho');
    }
    await expect(page.getByRole('button', { name: /^Đăng xuất/ })).toBeInViewport({ ratio: 1 });
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    const overflow = await side.getByRole('link').evaluateAll((links) =>
      links.filter((a) => a.getBoundingClientRect().right > a.closest('nav')!.parentElement!.getBoundingClientRect().right).map((a) => a.getAttribute('title')),
    );
    expect(overflow).toEqual([]);
    if (isMobile(info)) return;

    for (const height of [800, 720]) {
      await page.setViewportSize({ width: 1280, height });
      await page.goto('/admin/stock');
      // 12 mục (bỏ Xuất lẻ, thêm Việc hôm nay): ở 720 nav tự cuộn, mục cuối vẫn tới được; khối tài khoản không cuộn theo
      await side.getByRole('link', { name: /^Cấu hình/ }).scrollIntoViewIfNeeded();
      await expect(side.getByRole('link', { name: /^Cấu hình/ })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: /^Đăng xuất/ })).toBeInViewport({ ratio: 1 });
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
const FULL_WIDTH_ROUTES = ['month', 'send-adm', 'arrivals', 'delivery', 'delivery/classic', 'backlog', 'reports', 'catalog', 'stock', 'review', 'categories', 'categories/units', 'users', 'audit', 'config', 'khong-co-trang'];

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
        else expect(Math.abs(m.panel - (m.vw - 236)), `${path} ở ${width}: panel ${m.panel}, vw ${m.vw}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test('V2D-13 panel phủ Danh mục: không đẩy lưới, nền mờ phủ sidebar, 767/768, Back và F5, axe 390', async ({ page }, info) => {
    const item = await seedPwItem(page);
    try {
      await page.goto(`/admin/catalog?q=${encodeURIComponent(item.name)}`);
      const card = page.getByRole('article').filter({ hasText: item.name });
      await expect(card).toBeVisible();
      // Font web (display=swap) về muộn làm hàng chip nhóm xuống 2 dòng (+52px) → chốt bố cục trước khi đo
      await page.evaluate(() => document.fonts.ready);
      // Panel modal làm nền aria-hidden: đo thẻ qua handle DOM giữ từ trước, toạ độ theo trang
      const cardEl = (await card.elementHandle())!;
      const pageBox = () =>
        cardEl.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
        });
      const before = await pageBox();
      const length = await page.evaluate(() => history.length);
      await card.getByRole('button', { name: `Sửa ${item.name}` }).click();
      const panel = page.getByRole('dialog', { name: `Sửa món ${item.name}` });
      await expect(panel).toBeVisible();
      expect(await page.evaluate(() => history.length)).toBe(length + 1);
      expect(await pageBox()).toEqual(before);
      if (isMobile(info)) {
        await expect(panel.getByRole('button', { name: 'Đóng' })).toBeVisible();
        expect(Math.round((await panel.boundingBox())!.width)).toBe(390);
        await expectNoContrastViolations(page);
      } else {
        const onScrim = await page.evaluate(() => {
          const hit = document.elementFromPoint(10, 10)!;
          return getComputedStyle(hit).position === 'fixed' && !hit.closest('nav, main, [role="dialog"]');
        });
        expect(onScrim, 'điểm (10,10) thuộc nền mờ, không phải sidebar').toBe(true);
        expect(Math.round((await panel.boundingBox())!.width)).toBe(560);
        await page.setViewportSize({ width: 767, height: 900 });
        await expect(panel.getByRole('button', { name: 'Đóng' })).toBeVisible();
        expect(Math.round((await panel.boundingBox())!.width)).toBe(767);
        await page.setViewportSize({ width: 768, height: 900 });
        await expect(panel.getByRole('button', { name: 'Đóng' })).toBeVisible();
        expect(Math.round((await panel.boundingBox())!.width)).toBe(560);
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      await page.goBack();
      await expect(panel).toBeHidden();
      expect(new URL(page.url()).searchParams.get('item')).toBeNull();
      await page.goto(`/admin/catalog?item=${item.id}`);
      await expect(panel).toBeVisible();
      await page.reload();
      await expect(panel).toBeVisible();
      // Back sau F5/dán URL là rời tài liệu (chỉ beforeunload, R-D1.6): hỏi "Bỏ thay đổi?" kiểm trên panel mở bằng bấm
      await page.goto(`/admin/catalog?q=${encodeURIComponent(item.name)}`);
      await card.getByRole('button', { name: `Sửa ${item.name}` }).click();
      await expect(panel).toBeVisible();
      await panel.getByLabel(/^Tên sản phẩm/).fill(`${item.name} X`);
      const discard = page.getByRole('dialog', { name: 'Bỏ thay đổi?' });
      await page.goBack();
      await expect(discard).toBeVisible();
      await discard.getByRole('button', { name: 'Ở lại' }).click();
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel(/^Tên sản phẩm/)).toHaveValue(`${item.name} X`);
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

    await page.goto('/admin/month');
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 246, 251)');
    expect(await page.getByRole('heading', { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Be Vietnam Pro');

    role = 'member';
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.dataset.shell)).toBe('member');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 246, 251)');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Be Vietnam Pro');
  });
});
