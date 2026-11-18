import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Giao diện A: một họ điều khiển thanh công cụ. Chỉ đọc — mọi request /api khác GET bị chặn.
const ADMIN_ROUTES = [
  '/admin/month',
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

async function open(page: Page, role: 'member' | 'admin', path: string, lang: 'vi' | 'en' = 'vi') {
  await skipNewPeriodPopup(page);
  if (lang === 'en') await page.addInitScript(() => localStorage.setItem('vpp_lang', 'en'));
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders(role) } });
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

interface Ctl {
  kind: string;
  h: number;
  bg: string;
  border: string;
  radius: string;
}

// Ô tìm (khung bao), ô chọn thanh lọc, nhóm lọc nằm trong main
function controls(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const out: Ctl[] = [];
    const push = (kind: string, el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      out.push({ kind, h: Math.round(r.height), bg: cs.backgroundColor, border: cs.borderTopWidth, radius: cs.borderTopLeftRadius });
    };
    for (const el of main.querySelectorAll('.toolbar__search')) push('search', el);
    for (const el of main.querySelectorAll('.toolbar .lb--pill .lb-trigger, .toolbar [role=combobox].lb-trigger')) push('select', el);
    for (const el of main.querySelectorAll('[role=radiogroup].seg-m1')) push('radiogroup', el);
    return out;
  });
}

test.describe('Hệ điều khiển', () => {
  for (const path of ADMIN_ROUTES) {
    test(`${path}: ô tìm, ô chọn, nhóm lọc cùng chiều cao 40 (1280) / 44 (390); ô tìm và ô chọn nền trắng, viền 1px, bo 6px`, async ({ page }, info) => {
      await open(page, 'admin', path);
      const want = isMobile(info) ? 44 : 40;
      const found = await controls(page);
      for (const c of found) {
        expect.soft(Math.abs(c.h - want), `${c.kind} cao ${c.h}`).toBeLessThanOrEqual(1);
        if (c.kind === 'radiogroup') continue;
        expect.soft(c.bg, `${c.kind} nền`).toBe('rgb(255, 255, 255)');
        expect.soft(c.border, `${c.kind} viền`).toBe('1px');
        expect.soft(c.radius, `${c.kind} bo`).toBe('6px');
      }
    });
  }

  test('tiếng Anh, 1024: nhãn dài không làm điều khiển Kỳ tháng, Tủ / Kho, Nhật ký đổi cao', async ({ page }, info) => {
    test.skip(isMobile(info), 'chỉ đo ở 1024');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1024, height: 800 });
    for (const path of ['/admin/month', '/admin/stock', '/admin/audit']) {
      await open(page, 'admin', path, 'en');
      for (const c of await controls(page)) expect.soft(Math.abs(c.h - 40), `${path} ${c.kind} cao ${c.h}`).toBeLessThanOrEqual(1);
    }
  });

  test('390: nhóm lọc không có lựa chọn bị khuất — mọi radio nằm trong khung nhìn, hoặc nhóm đã thành ô chọn', async ({ page }, info) => {
    test.skip(!isMobile(info), 'chỉ đo ở 390');
    test.setTimeout(180_000);
    for (const path of ADMIN_ROUTES) {
      await open(page, 'admin', path);
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('main [role=radiogroup] [role=radio]')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
          .map(({ el }) => (el.textContent ?? '').trim()),
      );
      expect.soft(hidden, path).toEqual([]);
    }
  });

  test('320×568: Xem phiếu (Kỳ tháng) và Giao (Giao hàng) — chân popup trong khung nhìn, nút chính bấm được', async ({ page }, info) => {
    test.skip(!isMobile(info), 'chỉ đo ở điện thoại');
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, 'admin', '/admin/month?ym=2026-12');
    await page.getByRole('button', { name: /^Thao tác cho / }).first().click();
    await page.getByRole('menuitem', { name: 'Xem phiếu' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    // AD-13: ngăn Phiếu của … chỉ còn nút ✕ "Đóng" ở đầu, không có chân
    const close = sheet.getByRole('button', { name: 'Đóng' });
    await expect(close).toHaveCount(1);
    await expect(close).toBeInViewport({ ratio: 1 });
    await open(page, 'admin', '/admin/delivery');
    await page.getByRole('button', { name: /^Giao…, / }).first().click();
    const give = page.getByRole('dialog').getByRole('button', { name: /^(Xác nhận giao|Giao)/ }).last();
    await expect(give).toBeInViewport({ ratio: 1 });
  });

  test('390: mọi nút trong popup Xem phiếu và Giao ≥ 44×44', async ({ page }, info) => {
    test.skip(!isMobile(info), 'chỉ đo ở 390');
    const small = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[role=dialog] button')]
          .map((b) => ({ b, r: b.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
          .map(({ b, r }) => `${b.getAttribute('aria-label') ?? b.textContent?.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
    await open(page, 'admin', '/admin/month?ym=2026-12');
    await page.getByRole('button', { name: /^Thao tác cho / }).first().click();
    await page.getByRole('menuitem', { name: 'Xem phiếu' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect.soft(await small(), 'Xem phiếu').toEqual([]);
    await open(page, 'admin', '/admin/delivery');
    await page.getByRole('button', { name: /^Giao…, / }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect.soft(await small(), 'Giao').toEqual([]);
  });
});
