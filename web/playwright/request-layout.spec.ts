import { expect, test } from '@playwright/test';
import { deleteTestUsers, expectNoContrastViolations, isMobile, removeTestItem, seedActiveUser } from './helpers';
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
        expect(await cart.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 244, 232)');
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
  });  test('V2C-T3 lọc: tìm + Đã chọn + Xóa bộ lọc', async ({ page, request }, info) => {
    const me = await asNewMember(page, info);
    const stamp = Date.now();
    const name = `PW Bút lọc ${stamp}`;
    const itemId = await createItem(request, name);
    try {
      await page.goto('/');
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const chips = grid.getByRole('group', { name: 'Nhóm món' });
      await expect(chips.getByRole('button', { name: /^Tất cả/ })).toBeVisible();
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
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${name}`, exact: true }).click();
      const picked = grid.getByRole('button', { name: 'Đã chọn 1' });
      await picked.click();
      await expect(picked).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/picked=1/);
      await expect(addButtons).toHaveCount(1); // giao của Đã chọn và từ khóa: đúng món này
      await expect(grid.getByRole('spinbutton', { name, exact: true })).toHaveValue('1');
      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill('khong co mon nay');
      await expect(grid.getByText('Không có món phù hợp')).toBeVisible();
      await grid.getByRole('button', { name: 'Xóa bộ lọc' }).click();
      await expect(grid.getByRole('searchbox', { name: 'Tìm món' })).toHaveValue('');
      await expect(picked).toHaveAttribute('aria-pressed', 'false');
      await expect(page).not.toHaveURL(/q=|picked=|g=/);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.evaluate(() => document.fonts.ready);
    } finally {
      deleteTestUsers(me.sub);
      await removeTestItem(request, itemId);
    }
  });
  test('V2C-T4 lưới: 1280 ≥ 4 thẻ một hàng, 390 hai cột; stepper 44px; món không nhóm tới được qua chip "Chưa có nhóm"', async ({ page, request }, info) => {
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
      // Món không có nhóm: chip "Chưa có nhóm" → URL g=none → món hiện ra và thêm được
      await chips.getByRole('button', { name: /^Chưa có nhóm/ }).click();
      await expect(page).toHaveURL(/g=none/);
      const add = grid.getByRole('button', { name: `Thêm vào phiếu: ${name}`, exact: true });
      await expect(add).toBeVisible();
      await add.click();
      const plus = grid.getByRole('button', { name: `Thêm ${name}`, exact: true });
      const minus = grid.getByRole('button', { name: `Bớt ${name}`, exact: true });
      for (const b of [plus, minus]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.5);
      if (isMobile(info)) await expectNoContrastViolations(page);
      await page.evaluate(() => document.fonts.ready);
      await shotTo(page, info, 'order');
    } finally {
      await group.cleanup(me.sub);
      await removeTestItem(request, itemId);
    }
  });
});
