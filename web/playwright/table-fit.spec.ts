import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// L1: bảng vừa khung ở 768–1280 (sidebar mở), chữ không tràn ô, cột không nhảy khi lọc. Chỉ đọc.
const ROUTES = ['/admin/month?ym=2026-11', '/admin/month?ym=2026-12', '/admin/delivery', '/admin/reports', '/admin/users', '/admin/audit', '/admin/catalog?view=table', '/admin/stock'];

async function as(page: Page) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('admin') } });
  });
}

async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

function fit(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const table of document.querySelectorAll<HTMLTableElement>('main table')) {
      if (table.closest('.table-stack') && getComputedStyle(table.querySelector('tbody tr') ?? table).display !== 'table-row') continue;
      const frame = (table.closest('.table-wrap, .dt-wrap') ?? table.parentElement)!.getBoundingClientRect();
      const t = table.getBoundingClientRect();
      const acts = table.querySelector('tbody tr td:last-child');
      const actsOk = acts ? acts.getBoundingClientRect().right <= window.innerWidth + 1 : true;
      if (t.width > frame.width + 1 && !actsOk) out.push(`bảng ${Math.round(t.width)} > khung ${Math.round(frame.width)}, cột cuối ngoài màn`);
      for (const td of table.querySelectorAll<HTMLElement>('tbody td')) {
        const r = td.getBoundingClientRect();
        if (r.width === 0) continue;
        for (const el of td.querySelectorAll<HTMLElement>('*')) {
          const e = el.getBoundingClientRect();
          if (e.width > 0 && e.right > r.right + 2 && getComputedStyle(el).position !== 'absolute') {
            out.push(`tràn ô: "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(e.right - r.right)}px`);
            break;
          }
        }
      }
    }
    return [...new Set(out)].slice(0, 8);
  });
}

test.describe('Bảng vừa khung', () => {
  for (const width of [1280, 1024, 768]) {
    test(`${width}: bảng không rộng hơn khung (hoặc cột thao tác trong màn), chữ không tràn ô`, async ({ page }, info) => {
      test.skip(isMobile(info), 'đo ở desktop');
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 900 });
      await as(page);
      for (const path of ROUTES) {
        await go(page, path);
        expect.soft(await fit(page), `${path} @${width}`).toEqual([]);
      }
    });
  }

  test('1280: Kỳ tháng — vị trí và bề rộng cột tiêu đề lệch ≤ 2px giữa ?ym=2026-12, tìm, chip, ?ym=2026-11', async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở 1280');
    await as(page);
    const cols = () => page.evaluate(() => [...document.querySelectorAll('main thead th')].map((th) => { const r = th.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
    await go(page, '/admin/month?ym=2026-12');
    const base = await cols();
    for (const path of ['/admin/month?ym=2026-12&q=Ho%C3%A0ng', '/admin/month?ym=2026-12&chip=note', '/admin/month?ym=2026-11']) {
      await go(page, path);
      const now = await cols();
      const moved = now.map((c, i) => (base[i] ? Math.max(Math.abs(c[0]! - base[i]![0]!), Math.abs(c[1]! - base[i]![1]!)) : 0));
      expect.soft(Math.max(0, ...moved), path).toBeLessThanOrEqual(2);
    }
  });
});
