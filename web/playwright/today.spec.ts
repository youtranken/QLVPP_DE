import { expect, test } from '@playwright/test';
import { asRole, isMobile, settled } from './helpers';

asRole('admin');

test.describe('A4 Việc hôm nay: hàng thẻ số', () => {
  test('A4 1280: 7 thẻ trên một hàng, chữ phụ không bị cắt; 390: lưới 2 cột', async ({ page }, info) => {
    await page.goto('/admin/today');
    const tiles = page.getByRole('region', { name: 'Số việc' }).locator(':scope > *');
    await expect(tiles).toHaveCount(7);
    await settled(page);
    const tops = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    if (isMobile(info)) {
      expect(tops[0]).toBe(tops[1]);
      expect(tops[2]).toBeGreaterThan(tops[1]);
    } else {
      expect(new Set(tops).size, `một hàng: ${tops.join(',')}`).toBe(1);
      const clipped = await tiles.evaluateAll(
        (els) => els.flatMap((e) => [...e.querySelectorAll('*')]).filter((n) => (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) && getComputedStyle(n).overflow !== 'visible').length,
      );
      expect(clipped).toBe(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
