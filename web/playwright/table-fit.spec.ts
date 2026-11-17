import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// L1: bảng vừa khung ở 768–1280 (sidebar mở), chữ không tràn ô, cột không nhảy khi lọc. Chỉ đọc.
const ROUTES = ['/admin/month?ym=2026-11', '/admin/month?ym=2026-12', '/admin/delivery', '/admin/reports', '/admin/users', '/admin/audit', '/admin/catalog?view=table', '/admin/stock', '/admin/stock?tab=ledger', '/admin/issues'];

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
      // Khung gần nhất không để tràn tự do: clip/hidden thì bảng phải vừa khung; auto thì ô thao tác (.col-actions) phải dính trong khung
      let wrap = table.parentElement!;
      while (wrap.parentElement && getComputedStyle(wrap).overflowX === 'visible') wrap = wrap.parentElement;
      const frame = wrap.getBoundingClientRect();
      const t = table.getBoundingClientRect();
      const ox = getComputedStyle(wrap).overflowX;
      if (t.width > frame.width + 1 && (ox === 'clip' || ox === 'hidden')) out.push(`bảng ${Math.round(t.width)} > khung ${Math.round(frame.width)} mà khung không cuộn (${ox})`);
      for (const acts of table.querySelectorAll('tbody td.col-actions')) {
        const r = acts.getBoundingClientRect();
        if (r.width > 0 && r.right > Math.min(frame.right, window.innerWidth) + 1) {
          out.push(`cột thao tác ra ngoài khung ${Math.round(r.right - frame.right)}px`);
          break;
        }
      }
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
        // cả trang không cuộn ngang (chữ ẩn sr-only trong ô không được thoát khỏi khung bảng)
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect.soft(over, `${path} @${width} trang cuộn ngang`).toBeLessThanOrEqual(0);
      }
    });
  }

  for (const width of [1280, 1024]) {
    test(`${width}: menu ⋯ của từng dòng Giao hàng nằm trên mọi dòng khác, bấm trúng mục`, async ({ page }, info) => {
      test.skip(isMobile(info), 'đo ở desktop');
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await as(page);
      await go(page, '/admin/delivery');
      const triggers = page.getByRole('button', { name: /^Thao tác cho / });
      const n = await triggers.count();
      expect(n, 'cần dữ liệu Giao hàng có dòng').toBeGreaterThan(1);
      const blocked: string[] = [];
      for (let i = 0; i < n; i++) {
        await triggers.nth(i).click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        const hit = await menu.evaluate((m) =>
          [...m.querySelectorAll<HTMLElement>('[role=menuitem]')].every((it) => {
            const r = it.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!el && it.contains(el);
          }),
        );
        if (!hit) blocked.push((await triggers.nth(i).getAttribute('aria-label')) ?? String(i));
        await page.keyboard.press('Escape');
      }
      expect(blocked).toEqual([]);
    });
  }

  test('1280: Kỳ tháng — vị trí và bề rộng cột tiêu đề lệch ≤ 2px giữa ?ym=2026-12, tìm, chip, ?ym=2026-11', async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở 1280');
    await as(page);
    const cols = () => page.evaluate(() => [...document.querySelectorAll('main thead th')].map((th) => { const r = th.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
    await go(page, '/admin/month?ym=2026-12');
    const base = await cols();
    for (const path of ['/admin/month?ym=2026-12&q=Ho%C3%A0ng', '/admin/month?ym=2026-12&chip=noted', '/admin/month?ym=2026-12&chip=undelivered', '/admin/month?ym=2026-11']) {
      await go(page, path);
      const now = await cols();
      if (now.every((c) => c[1] === 0)) continue;
      const moved = now.map((c, i) => (base[i] ? Math.max(Math.abs(c[0]! - base[i]![0]!), Math.abs(c[1]! - base[i]![1]!)) : 0));
      expect.soft(Math.max(0, ...moved), path).toBeLessThanOrEqual(2);
    }
  });

  for (const width of [767, 768, 1024]) {
    test(`${width}: ô thao tác dính phải không đè nền dòng đang chọn; đầu nhóm giữ nền nhóm`, async ({ page }, info) => {
      test.skip(isMobile(info), 'đo ở desktop');
      await page.setViewportSize({ width, height: 900 });
      await as(page);
      await go(page, '/admin/delivery');
      const pick = page.getByRole('checkbox', { name: /^Chọn / }).first();
      expect(await pick.count(), 'có dòng chọn được').toBeGreaterThan(0);
      await pick.check();
      const bg = await page.evaluate(() => {
        const tr = document.querySelector('main tr.is-picked')!;
        const first = getComputedStyle(tr.querySelector('td:nth-child(2)')!).backgroundColor;
        const last = getComputedStyle(tr.querySelector('td:last-child')!).backgroundColor;
        return { first, last };
      });
      expect(bg.last, 'ô cuối cùng nền với dòng').toBe(bg.first);
      await go(page, '/admin/month?ym=2026-12');
      const group = await page.evaluate(() => {
        const th = document.querySelector('main .dt-group th, main tr.dt-group > :last-child');
        return th ? getComputedStyle(th).backgroundColor : null;
      });
      expect(group, 'đầu nhóm có nền nhóm (không trắng)').not.toBe('rgb(255, 255, 255)');
    });
  }
});
