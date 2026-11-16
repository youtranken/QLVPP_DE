import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// H1, H2: ô Đề nghị nằm gọn trong cột, không đè "N người"; báo lỗi không đổi chiều cao dòng. Chỉ đọc (chặn mọi request ghi).
async function as(page: Page) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('admin') } });
  });
}

for (const width of [1024, 1280]) {
  test(`${width}: nút "+" nằm trong ô Đề nghị, không giao link "N người"; gõ 2.5 → "Nhập số nguyên", dòng không cao thêm`, async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở desktop');
    await page.setViewportSize({ width, height: 900 });
    await as(page);
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');
    const boxes = page.getByRole('spinbutton', { name: /^Đề nghị: / });
    expect(await boxes.count(), 'có ô Đề nghị').toBeGreaterThan(0);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const td of document.querySelectorAll<HTMLElement>('main td.bc-order-col')) {
        const cell = td.getBoundingClientRect();
        const next = td.nextElementSibling?.querySelector('a, button')?.getBoundingClientRect();
        for (const b of td.querySelectorAll('button')) {
          const r = b.getBoundingClientRect();
          if (r.right > cell.right + 0.5) out.push(`nút ra khỏi ô ${Math.round(r.right - cell.right)}px`);
          if (next && r.right > next.left && r.left < next.right) out.push('nút đè link N người');
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
    const name = (await boxes.first().getAttribute('aria-label'))!;
    const box = page.getByRole('spinbutton', { name, exact: true });
    const row = page.locator('main tbody tr').filter({ has: box });
    const before = (await row.boundingBox())!.height;
    await box.fill('2.5');
    await expect(row.getByText('Nhập số nguyên')).toBeVisible();
    expect(Math.abs((await row.boundingBox())!.height - before), 'chiều cao dòng giữ nguyên').toBeLessThanOrEqual(1);
  });
}

test('1024 so với 1280: hàng nút đầu trang không xuống dòng, bảng không tụt', async ({ page }, info) => {
  test.skip(isMobile(info), 'đo ở desktop');
  await as(page);
  const tableTop = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');
    return page.evaluate(() => document.querySelector('main table')!.getBoundingClientRect().top);
  };
  const wide = await tableTop(1280);
  expect(Math.abs((await tableTop(1024)) - wide)).toBeLessThanOrEqual(2);
});
