import { expect, test, type Page } from '@playwright/test';
import { asRole } from './helpers';

// Lịch khoảng ngày ở Nhật ký cao ~430px: ở 390×800/844 cả trên lẫn dưới ô đều thiếu chỗ, lịch lật lên và mất 14px trên đỉnh
// (hàng "‹ Tháng 11 Năm 2026 ›"). Popover neo ô (lịch, Listbox) phải luôn nằm trọn trong màn, ô ở sát đỉnh hay sát đáy màn.
asRole('admin');

const SIZES: [number, number][] = [
  [360, 640],
  [390, 800],
  [390, 844],
  [768, 1024],
  [1280, 900],
];

// Chèn khoảng trống trên thanh lọc (đủ cuộn cả hai phía) rồi cuộn cho nút mở nằm ở vị trí muốn đo
async function placeTrigger(page: Page, trigger: string, where: 'top' | 'middle' | 'bottom') {
  await page.evaluate(
    ({ trigger, where }) => {
      const h = window.innerHeight;
      document.body.style.paddingBottom = `${h * 2}px`;
      const form = document.querySelector('.au-filters')!;
      const spacer = document.createElement('div');
      spacer.style.height = `${h}px`;
      form.parentElement!.insertBefore(spacer, form);
      const r = document.querySelector(trigger)!.getBoundingClientRect();
      const want = where === 'top' ? 70 : where === 'bottom' ? h - 60 - r.height : (h - r.height) / 2;
      window.scrollBy(0, r.top - want);
    },
    { trigger, where },
  );
}

async function boxIn(page: Page, selector: string) {
  const pop = page.locator(selector).filter({ visible: true }).first();
  await expect(pop).toBeVisible();
  const vp = page.viewportSize()!;
  // Chờ floating-ui đặt xong vị trí (autoUpdate) rồi mới đo
  await expect.poll(async () => (await pop.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  const b = (await pop.boundingBox())!;
  return { b, vp };
}

for (const [width, height] of SIZES) {
  for (const where of ['top', 'middle', 'bottom'] as const) {
    test(`Vòng8 ${width}×${height} ô ${where}: lịch khoảng ngày và Listbox nằm trọn trong màn`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/admin/audit');
      await expect(page.locator('.date-range__trigger').first()).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      await placeTrigger(page, '.date-range__trigger', where);
      await page.locator('.date-range__trigger').first().click();
      const cal = await boxIn(page, '.cal-pop');
      expect(cal.b.y, 'lịch: đỉnh trong màn').toBeGreaterThanOrEqual(0);
      expect(cal.b.y + cal.b.height, 'lịch: đáy trong màn').toBeLessThanOrEqual(cal.vp.height);
      expect(cal.b.x).toBeGreaterThanOrEqual(0);
      expect(cal.b.x + cal.b.width).toBeLessThanOrEqual(cal.vp.width);
      // Hàng tháng (đỉnh lịch) thấy được và bấm được
      await expect(page.locator('.cal__head')).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
      await expect(page.locator('.cal-pop')).toHaveCount(0);

      await page.reload();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      const lbTrigger = '.au-filters .lb-trigger:not(.date-range__trigger)';
      await expect(page.locator(lbTrigger).first()).toBeVisible();
      await placeTrigger(page, lbTrigger, where);
      await page.locator(lbTrigger).first().click();
      const list = await boxIn(page, '.lb-list');
      expect(list.b.y, 'Listbox: đỉnh trong màn').toBeGreaterThanOrEqual(0);
      expect(list.b.y + list.b.height, 'Listbox: đáy trong màn').toBeLessThanOrEqual(list.vp.height);
    });
  }
}
