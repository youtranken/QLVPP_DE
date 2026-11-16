import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Không chớp nền khi tải: trước khi shell hiện chỉ một màu nền, chữ không bao giờ là Times; Báo cáo không nhảy bố cục.
async function slow(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 400 * 1024, uploadThroughput: 200 * 1024 });
}

async function as(page: Page) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('admin') } });
  });
}

test.describe('Tải trang', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP chỉ có ở Chromium');

  test('admin: một màu nền trước khi shell hiện; font h1/chữ thân không bao giờ là Times', async ({ page }, info) => {
    test.skip(isMobile(info), 'một bề rộng là đủ');
    test.setTimeout(90_000);
    await as(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __bgs: string[]; __fonts: string[] };
      w.__bgs = [];
      w.__fonts = [];
      const tick = () => {
        if (document.body?.dataset.shell) return;
        const el = document.body ?? document.documentElement;
        const bg = getComputedStyle(el).backgroundColor;
        const html = getComputedStyle(document.documentElement).backgroundColor;
        w.__bgs.push(bg === 'rgba(0, 0, 0, 0)' ? html : bg);
        if (document.body && document.body.innerText.trim()) w.__fonts.push(getComputedStyle(document.body).fontFamily);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await slow(page);
    await page.goto('/admin/month');
    await expect(page.locator('body[data-shell]')).toHaveCount(1, { timeout: 60_000 });
    const { bgs, fonts } = await page.evaluate(() => {
      const w = window as unknown as { __bgs: string[]; __fonts: string[] };
      return { bgs: [...new Set(w.__bgs)], fonts: [...new Set(w.__fonts)] };
    });
    expect(bgs, 'màu nền trước shell').toHaveLength(1);
    expect(fonts.filter((f) => /times/i.test(f) || !/sans|Vietnam|system/i.test(f))).toEqual([]);
  });

  test('/admin/reports: CLS < 0.01', async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở 1280');
    await as(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
  });
});
