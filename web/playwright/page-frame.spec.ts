import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Giao diện A (L4/L5): tiêu đề trang, dòng đếm, bảng đứng yên. Chỉ đọc — mọi request /api khác GET bị chặn.
const ADMIN_ROUTES = [
  '/admin/month',
  '/admin/today',
  '/admin/arrivals',
  '/admin/delivery',
  '/admin/backlog',
  '/admin/reports',
  '/admin/stock',
  '/admin/catalog',
  '/admin/categories',
  '/admin/categories/units',
  '/admin/users',
  '/admin/audit',
  '/admin/config',
];

async function as(page: Page, role: 'member' | 'admin') {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders(role) } });
  });
}

async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

const box = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), size: getComputedStyle(document.querySelector(s)!).fontSize } : null;
  }, sel);

test.describe('Khung trang', () => {
  test('1280: h1 của 13 route admin cùng top ±2px; 404 admin có h1 cùng cỡ và cùng lề trái', async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở 1280');
    test.setTimeout(180_000);
    await as(page, 'admin');
    const tops: Record<string, { x: number; y: number; size: string } | null> = {};
    for (const path of [...ADMIN_ROUTES, '/admin/khong-co']) {
      await go(page, path);
      tops[path] = await box(page, 'main h1');
    }
    const ref = tops['/admin/month']!;
    for (const [path, b] of Object.entries(tops)) {
      expect.soft(b, `${path} có h1`).not.toBeNull();
      if (!b) continue;
      expect.soft(Math.abs(b.y - ref.y), `${path} top ${b.y} vs ${ref.y}`).toBeLessThanOrEqual(2);
      expect.soft(Math.abs(b.x - ref.x), `${path} left ${b.x} vs ${ref.x}`).toBeLessThanOrEqual(2);
      expect.soft(b.size, `${path} cỡ h1`).toBe(ref.size);
    }
  });

  test('1280: h1 trang nhân viên cùng lề trái ở /, /history, /me, /khong-co', async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở 1280');
    await as(page, 'member');
    const xs: Record<string, number | undefined> = {};
    for (const path of ['/', '/history', '/me', '/khong-co']) {
      await go(page, path);
      xs[path] = (await box(page, 'main h1'))?.x;
    }
    for (const [path, x] of Object.entries(xs)) expect.soft(x, `${path} left`).toBe(xs['/']);
  });

  test('Danh bạ 390: bảng cùng top giữa ?status=active và ?status=locked', async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở 390');
    await as(page, 'admin');
    await go(page, '/admin/users?status=active');
    const a = await box(page, 'main table, main .table-stack, main [role=table]');
    await go(page, '/admin/users?status=locked');
    const b = await box(page, 'main table, main .table-stack, main [role=table], main .empty-state');
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThanOrEqual(2);
  });

  for (const width of [1280, 1024, 390]) {
    test(`Giao hàng ${width}: chọn một dòng → ô tìm không co, bảng không tụt (≤ 2px)`, async ({ page }, info) => {
      test.skip(isMobile(info) !== (width === 390), 'mỗi bề rộng một project');
      if (width === 1024) await page.setViewportSize({ width: 1024, height: 800 });
      await as(page, 'admin');
      await go(page, '/admin/delivery');
      const search0 = await box(page, 'main .toolbar__search, main [role=search], main input[type=search]');
      const table0 = await box(page, 'main table');
      const pick = page.getByRole('checkbox', { name: /^Chọn / }).first();
      test.skip((await pick.count()) === 0, 'không có dòng chọn được');
      await pick.check();
      const search1 = await box(page, 'main .toolbar__search, main [role=search], main input[type=search]');
      const table1 = await box(page, 'main table');
      expect.soft(search1!.w, 'ô tìm rộng').toBeGreaterThanOrEqual(search0!.w - 2);
      expect.soft(Math.abs(table1!.y - table0!.y), 'bảng tụt').toBeLessThanOrEqual(2);
    });
  }
});
