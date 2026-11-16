import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// H3, H4: thẻ món Nhân viên ở màn rất hẹp — ô số hiện đủ 2 chữ số, nút "Thêm vào phiếu" không tràn. Chỉ đọc (chặn request ghi).
async function asMember(page: Page) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('member') } });
  });
}

for (const width of [320, 335, 340]) {
  test(`${width}: ô số hiện đủ "10"; "Thêm vào phiếu" không tràn`, async ({ page }, info) => {
    test.skip(!isMobile(info), 'đo ở điện thoại');
    await page.setViewportSize({ width, height: 740 });
    await asMember(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const adds = page.getByRole('button', { name: /^Thêm .* vào phiếu$|^Thêm vào phiếu/ });
    expect(await adds.count(), 'có nút thêm').toBeGreaterThan(0);
    const spill = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.rq-card-add')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
    expect(spill).toEqual([]);
    await adds.first().click();
    const box = page.getByRole('spinbutton').first();
    await box.fill('10');
    const fits = await box.evaluate((el: HTMLInputElement) => ({ s: el.scrollWidth, c: el.clientWidth, v: el.value }));
    expect(fits.v).toBe('10');
    expect(fits.s, `ô số ${fits.c}px`).toBeLessThanOrEqual(fits.c);
  });
}
