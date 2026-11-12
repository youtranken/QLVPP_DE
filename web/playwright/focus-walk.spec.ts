import { expect, test, type Page } from '@playwright/test';
import { asRole } from './helpers';

// Đi Tab qua từng trang: mọi phần tử nhận focus phải vẽ được vòng (outline hoặc box-shadow, không "none")
// và vòng đó không bị khung overflow của tổ tiên cắt mất. Chỉ đọc: chặn mọi request /api khác GET.
const STEPS = 80;

interface Finding {
  where: string;
  what: string;
}

async function readOnly(page: Page) {
  await page.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.fallback() : route.abort()));
}

// Chạy trong trình duyệt: đo phần tử đang focus
function probeFocused(): { label: string; ring: boolean; clippedBy: string | null } | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"`;
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? parseFloat(cs.outlineWidth) + Math.max(0, parseFloat(cs.outlineOffset) || 0) : 0;
  const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : '';
  // Bóng sẵn có lúc thường (nút nổi) không phải vòng: so với lúc bỏ focus, phải khác mới tính là có vòng
  const borderFocused = cs.borderColor;
  el.blur();
  const rest = getComputedStyle(el);
  const restShadow = rest.boxShadow;
  const restBorder = rest.borderColor;
  el.focus({ preventScroll: true });
  const ring = outline > 0 || (shadow !== '' && shadow !== restShadow) || borderFocused !== restBorder;
  // Độ loe ra ngoài của vòng: spread lớn nhất của các bóng không inset; bóng inset thì nằm trong phần tử
  let outset = outline;
  for (const part of shadow.split(/,(?![^(]*\))/)) {
    if (!part.trim() || /inset/.test(part)) continue;
    const nums = (part.replace(/rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    // Bóng mờ (blur) nhẹ của nút nổi không phải vòng focus: chỉ tính spread + độ lệch
    const [x = 0, y = 0, , spread = 0] = nums;
    outset = Math.max(outset, spread + Math.max(Math.abs(x), Math.abs(y)));
  }
  const r = el.getBoundingClientRect();
  const want = { left: r.left - outset, top: r.top - outset, right: r.right + outset, bottom: r.bottom + outset };
  let clippedBy: string | null = null;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const ps = getComputedStyle(p);
    if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
    const b = p.getBoundingClientRect();
    // Cho lệch 0.5px do làm tròn
    const cut = (ps.overflowX !== 'visible' && (want.left < b.left - 0.5 || want.right > b.right + 0.5)) || (ps.overflowY !== 'visible' && (want.top < b.top - 0.5 || want.bottom > b.bottom + 0.5));
    // Phần tử nằm khuất trong khung cuộn (chưa cuộn tới) không phải lỗi vòng: trình duyệt cuộn vào khi focus
    if (cut && r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom) {
      clippedBy = `${p.tagName.toLowerCase()}.${String(p.className).trim().split(/\s+/).join('.')}`;
      break;
    }
  }
  return { label, ring, clippedBy };
}

async function walk(page: Page, where: string): Promise<Finding[]> {
  const found: Finding[] = [];
  const seen = new Set<string>();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < STEPS; i++) {
    await page.keyboard.press('Tab');
    const res = await page.evaluate(probeFocused);
    if (!res) continue;
    if (seen.has(res.label)) {
      if (seen.size > 3 && i > STEPS / 2) break;
      continue;
    }
    seen.add(res.label);
    if (!res.ring) found.push({ where, what: `không có vòng focus: ${res.label}` });
    else if (res.clippedBy) found.push({ where, what: `vòng focus bị cắt bởi ${res.clippedBy}: ${res.label}` });
  }
  return found;
}

const ADMIN_PAGES: [string, string][] = [
  ['/admin/month', 'Kỳ tháng'],
  ['/admin/reports', 'Báo cáo & gửi NCC'],
  ['/admin/arrivals', 'Nhận hàng'],
  ['/admin/delivery', 'Giao hàng'],
  ['/admin/backlog', 'Còn nợ'],
  ['/admin/catalog', 'Sản phẩm'],
  ['/admin/stock', 'Tủ / Kho'],
  ['/admin/review', 'Món ngoài danh mục'],
  ['/admin/categories', 'Danh mục'],
  ['/admin/categories/units', 'Danh mục'],
  ['/admin/users', 'Nhân viên'],
  ['/admin/audit', 'Nhật ký'],
  ['/admin/config', 'Cấu hình'],
];

test.describe('Đi Tab: vòng focus thấy được, không bị khung cuộn cắt (admin)', () => {
  asRole('admin');
  for (const [path, title] of ADMIN_PAGES) {
    test(`Tab qua ${path}`, async ({ page }) => {
      await readOnly(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      expect(await walk(page, path)).toEqual([]);
    });
  }
});

test.describe('Đi Tab: vòng focus thấy được, không bị khung cuộn cắt (nhân viên)', () => {
  asRole('member');
  for (const path of ['/', '/history', '/me']) {
    test(`Tab qua ${path}`, async ({ page }) => {
      await readOnly(page);
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      expect(await walk(page, path)).toEqual([]);
    });
  }
});

test('Đi Tab: màn đăng nhập — mục ngôn ngữ đang chọn vẫn có vòng focus', async ({ browser }) => {
  const page = await browser.newPage();
  await readOnly(page);
  await page.goto('/');
  const vi = page.getByRole('radio', { name: 'Tiếng Việt' });
  if (await vi.count()) {
    await vi.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const res = await page.evaluate(probeFocused);
    expect(res?.ring).toBe(true);
  }
  await page.close();
});
