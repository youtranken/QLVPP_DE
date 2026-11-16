import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Vùng chạm 44 trên điện thoại (Global Constraints giao diện A). Chỉ đọc.
const ADMIN = ['/admin/month', '/admin/arrivals', '/admin/delivery', '/admin/backlog', '/admin/reports', '/admin/stock', '/admin/catalog', '/admin/categories', '/admin/users', '/admin/audit', '/admin/config'];
const MEMBER = ['/', '/history', '/me'];

async function as(page: Page, role: 'admin' | 'member') {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders(role) } });
  });
}

// Hộp chạm = hộp nút hợp với ::after (nhiều nút nhỏ nới vùng chạm bằng ::after)
function small(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(`${scope} :is(button, a[href], [role=radio], [role=tab])`)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('p, li > p, .sr-only, [aria-hidden=true], table td p')) continue;
      if (getComputedStyle(el).display === 'inline' && el.closest('p, small')) continue;
      const after = getComputedStyle(el, '::after');
      let w = r.width;
      let h = r.height;
      if (after.content !== 'none' && after.position === 'absolute') {
        // Khối chứa của ::after: chính nút nếu nút đã định vị, không thì tổ tiên định vị gần nhất (ô bảng)
        const cb = getComputedStyle(el).position !== 'static' ? el : (el.offsetParent as HTMLElement | null);
        if (cb) {
          const c = cb.getBoundingClientRect();
          const px = (v: string) => (v === 'auto' ? 0 : parseFloat(v) || 0);
          w = Math.max(w, c.width - px(after.left) - px(after.right));
          h = Math.max(h, c.height - px(after.top) - px(after.bottom));
        }
      }
      if (w < 43.5 || h < 43.5) out.push(`${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 28)} ${Math.round(w)}×${Math.round(h)}`);
    }
    return [...new Set(out)].slice(0, 10);
  }, scope);
}

test.describe('Vùng chạm 44', () => {
  test('390 admin: mọi nút/liên kết/lựa chọn trong main ≥ 44×44 (hoặc nới bằng ::after)', async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở 390');
    test.setTimeout(180_000);
    await as(page, 'admin');
    for (const path of ADMIN) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect.soft(await small(page, 'main'), path).toEqual([]);
    }
  });

  test('390 nhân viên: mọi nút trong main ≥ 44×44', async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở 390');
    await as(page, 'member');
    for (const path of MEMBER) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect.soft(await small(page, 'main'), path).toEqual([]);
    }
  });

  test('390×667: menu quản lý — nút trong menu ≥ 44, "Cấu hình" không bị chân menu che', async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở 390');
    await page.setViewportSize({ width: 390, height: 667 });
    await as(page, 'admin');
    await page.goto('/admin/month');
    await page.getByRole('button', { name: 'Mở menu quản lý' }).click();
    const menu = page.getByRole('dialog');
    await expect(menu).toBeVisible();
    expect.soft(await small(page, '[role=dialog]'), 'menu').toEqual([]);
    const link = menu.getByRole('link', { name: /^Cấu hình/ });
    await link.scrollIntoViewIfNeeded();
    const hit = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (el === top || el.contains(top));
    });
    expect(hit, '"Cấu hình" bấm được').toBe(true);
  });

  test('320: hộp chọn năm-tháng ở Báo cáo không tràn mép phải (right ≤ 312)', async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở điện thoại');
    await page.setViewportSize({ width: 320, height: 640 });
    await as(page, 'admin');
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');
    await page.locator('[aria-haspopup=dialog]').filter({ hasText: /\d/ }).first().click();
    const pop = page.getByRole('dialog', { name: 'Chọn năm-tháng' });
    await expect(pop).toBeVisible();
    const r = await pop.boundingBox();
    expect(r!.x).toBeGreaterThanOrEqual(8);
    expect(r!.x + r!.width).toBeLessThanOrEqual(312);
  });
});
