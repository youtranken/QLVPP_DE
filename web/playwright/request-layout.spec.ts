import { expect, test } from '@playwright/test';
import { deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, removeTestItem, seedActiveUser } from './helpers';
import { asNewMember, createItem, createTestGroup, memberIdentity, shotTo } from './request-helpers';

// Bố cục trang Đăng ký, trạng thái tải, thanh lọc, lưới thẻ
test.describe('E2-S5 Trang Đăng ký (dev-identity member)', () => {
  test('V2C-T2 bố cục: 1280 phiếu cam bên phải panel lưới; 390 nút lưu nổi và thanh dưới đều thấy đủ, bấm được, không chồng nhau', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const period = await (await request.get('/api/periods/current', { headers: me.headers })).json();
    const group = await createTestGroup(request, info, 1);
    const [a] = group.items;
    try {
      await page.goto(`/?g=${group.categoryId}`);
      await expect(page.getByRole('heading', { level: 1, name: `Đăng ký văn phòng phẩm tháng ${Number(String(period.ym).slice(5))}` })).toBeVisible();
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const cart = page.getByRole('complementary', { name: /^Phiếu tháng \d+$/ });
      await expect(grid.getByText(a.name, { exact: true })).toBeVisible();
      if (!isMobile(info)) {
        const g = (await grid.boundingBox())!;
        const c = (await cart.boundingBox())!;
        expect(c.x).toBeGreaterThanOrEqual(g.x + g.width);
        expect(c.width).toBeLessThanOrEqual(380);
        expect(await cart.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 246, 229)');
      } else {
        await grid.getByRole('button', { name: `Thêm vào phiếu: ${a.name}`, exact: true }).click();
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
      await group.cleanup(me.sub);
    }
  });
  test('Vòng3-ĐK trang Đăng ký dùng hết bề ngang (1280): khung không bị bó 1440, lưới + phiếu chia hết chiều ngang; 390 không tràn ngang', async ({ page }, info) => {
    const me = await asNewMember(page, info);
    try {
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Danh mục món' })).toBeVisible();
      const frame = (await page.locator('.m-page.rq-v2').boundingBox())!;
      const vw = page.viewportSize()!.width;
      expect(frame.width).toBeGreaterThanOrEqual(vw - 48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestUsers(me.sub);
    }
  });
  test('V2C-T2 đang tải/lỗi tải nằm trong khung sáng: /api/me/request 500 → "Thử lại" thấy, không lỗi tương phản (390)', async ({ page }, info) => {
    const me = memberIdentity(info);
    seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
    await page.route('**/api/**', (route) => {
      if (route.request().url().includes('/api/me/request?ym=')) return route.fulfill({ status: 500, json: { code: 'INTERNAL' } });
      return route.continue({ headers: { ...route.request().headers(), ...me.headers } });
    });
    try {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      deleteTestUsers(me.sub);
    }
  });  test('V2C-T3 lọc: tìm + Xóa lọc; không Sắp xếp/Đã chọn/+ Thêm món khác (NV-09…12, NV-14)', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const stamp = Date.now();
    const name = `PW Bút lọc ${stamp}`;
    const itemId = await createItem(request, name);
    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const chips = grid.getByRole('group', { name: 'Nhóm món' });
      await expect(chips.getByRole('button', { name: /^Tất cả/ })).toBeVisible();
      await expect(grid.getByRole('combobox', { name: 'Sắp xếp' })).toHaveCount(0);
      await expect(grid.getByRole('button', { name: /^Đã chọn/ })).toHaveCount(0);
      await expect(grid.getByRole('button', { name: '+ Thêm món khác' })).toHaveCount(0);
      await expect(grid.getByText(/món trong danh mục|món khớp/)).toHaveCount(0);
      const addButtons = grid.getByRole('button', { name: /^Thêm (?!món khác|tại đây)/ });
      if (isMobile(info)) {
        // Review Focus 1: 390 px mặc định nhóm đầu → số thẻ không vượt số món của nhóm
        const first = chips.getByRole('button').nth(1);
        await expect(first).toHaveAttribute('aria-pressed', 'true');
        const n = Number(((await first.innerText()).match(/(\d+)\s*$/) ?? [])[1]);
        expect(await addButtons.count()).toBeLessThanOrEqual(n);
        for (const chip of await chips.getByRole('button').all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.5);
      }
      // Tìm không dấu, không phân biệt hoa thường, trên mọi nhóm
      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill(`BUT LOC ${stamp}`);
      await expect(addButtons).toHaveCount(1);
      await expect(page).toHaveURL(/q=BUT\+LOC/);
      await expect(grid.getByText('1 món khớp', { exact: true })).toBeVisible();
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${name}`, exact: true }).click();
      await expect(grid.getByRole('spinbutton', { name, exact: true })).toHaveValue('1');
      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill('khong co mon nay');
      await expect(grid.getByText('Không có món phù hợp')).toBeVisible();
      await grid.getByRole('button', { name: 'Xóa lọc' }).click();
      await expect(grid.getByRole('searchbox', { name: 'Tìm món' })).toHaveValue('');
      await expect(page).not.toHaveURL(/q=|g=/);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.evaluate(() => document.fonts.ready);
    } finally {
      deleteTestUsers(me.sub);
      await removeTestItem(request, itemId);
    }
  });
  test('V2C-T4 lưới: 1280 ≥ 4 thẻ một hàng, 390 hai cột; stepper 44px; món không nhóm tới được qua chip "Khác" (NV-13); thẻ đã chọn không số tròn (NV-15)', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const name = `PW Món không nhóm ${Date.now()}`;
    const itemId = await createItem(request, name);
    // Lưới đo trên nhóm thử 4 món riêng: không phụ thuộc cỡ/thứ tự danh mục thật
    const group = await createTestGroup(request, info, 4);
    try {
      await page.goto(`/?g=${group.categoryId}`);
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const chips = grid.getByRole('group', { name: 'Nhóm món' });
      const cards = grid.getByRole('article');
      await expect(cards).toHaveCount(4);
      const ys: number[] = [];
      const xs: number[] = [];
      for (let i = 0; i < 4; i++) {
        const box = (await cards.nth(i).boundingBox())!;
        ys.push(Math.round(box.y));
        xs.push(Math.round(box.x));
      }
      if (isMobile(info)) {
        expect(ys[0]).toBe(ys[1]);
        expect(ys[2]).toBeGreaterThan(ys[0]);
        expect(xs[2]).toBe(xs[0]);
      } else {
        expect(new Set(ys).size).toBe(1);
      }
      // Món không có nhóm nằm trong chip "Khác" (gộp vào nhóm tên Khác nếu có), không còn chip "Chưa có nhóm"
      await expect(chips.getByRole('button', { name: /^Chưa có nhóm/ })).toHaveCount(0);
      await chips.getByRole('button', { name: /^Khác/ }).click();
      await expect(page).toHaveURL(/g=/);
      const add = grid.getByRole('button', { name: `Thêm vào phiếu: ${name}`, exact: true });
      await expect(add).toBeVisible();
      await add.click();
      const plus = grid.getByRole('button', { name: `Thêm ${name}`, exact: true });
      const minus = grid.getByRole('button', { name: `Bớt ${name}`, exact: true });
      for (const b of [plus, minus]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.5);
      await expect(grid.getByRole('article').filter({ hasText: name }).getByText('1', { exact: true })).toHaveCount(0);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.evaluate(() => document.fonts.ready);
      await shotTo(page, info, 'order');
    } finally {
      await group.cleanup(me.sub);
      await removeTestItem(request, itemId);
    }
  });

  test('Nhóm 1 · đầu trang 1280 nền đặc khi cuộn', async ({ page }, info) => {
    test.skip(isMobile(info), 'đầu trang nền đặc kiểm ở 1280; 390 đã có nền riêng');
    await asNewMember(page, info);
    await page.goto('/');
    const banner = page.getByRole('banner');
    await expect(banner).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bg = await banner.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    const box = (await banner.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
    await expect(banner).toBeInViewport({ ratio: 1 });
  });

  test('Nhóm 1 · món tạm ngưng có dấu, không thêm được', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const group = await createTestGroup(request, info, 1);
    const [a] = group.items;
    try {
      const off = await request.patch(`/api/admin/items/${a.id}`, { headers: devHeaders('admin'), data: { active: false } });
      expect(off.status()).toBe(200);
      await page.goto(`/?g=${group.categoryId}`);
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const card = grid.getByRole('article').filter({ hasText: a.name });
      await expect(card.getByRole('img', { name: 'Tạm ngưng' })).toBeVisible();
      await expect(card.getByRole('button', { name: /Không đặt được/ })).toBeDisabled();
      await expect(card.getByRole('button', { name: `Thêm vào phiếu: ${a.name}`, exact: true })).toHaveCount(0);
      // Giới hạn tháng một cụm: đơn vị nằm trong "Tối đa N đvt/tháng"
      await expect(card.getByText(/^Tối đa \d+ \S+\/tháng$/)).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
    } finally {
      await group.cleanup(me.sub);
    }
  });
});
