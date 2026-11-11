import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, settled, shot, pendingConfirm } from './helpers';
import { seedLockedRequest, stockOf } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Tick mọi nhóm đang hiện (đã lọc theo tag của seed) rồi bấm "Nhận đủ hàng (n nhóm)": lưu ngay, không hộp xác nhận
async function receivePicked(page: Page) {
  const boxes = page.getByRole('checkbox', { name: /^Chọn nhóm / });
  for (const box of await boxes.all()) if (await box.isEnabled()) await box.check();
  await page.getByRole('button', { name: /^Nhận đủ hàng \(\d+ nhóm\)$/ }).click();
}

test.describe('Nhận hàng theo bản in (Plan v2-D, Task 8)', () => {
  test('Vòng3-HV lưu thiếu rồi lưu nốt: chip Sau lưu thành chip nền, đầu nhóm khớp dòng, cột Còn thiếu; Nhận đủ hàng theo nhóm đã tick, không hộp xác nhận', async ({ page, request }, info) => {
    // Kỳ riêng của PW: bản in thật của server (chỉ món PW), không ghi vào kỳ trước thật trên dev
    const release = await acquireLock('prev-period');
    clearPrivateSnapshots();
    const seed = await seedLockedRequest(
      request,
      info,
      [
        { stock: 0, qty: 5 },
        { stock: 0, qty: 3 },
      ],
      { ym: PRIVATE_YM },
    );
    const [a, b] = seed.items;
    try {
      const made = await request.post(`/api/admin/reports/${PRIVATE_YM}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print', ...(await pendingConfirm(request, PRIVATE_YM)) } });
      expect(made.status()).toBe(201);
      await openOnPrivatePeriod(page);
      await page.goto(`/admin/arrivals?q=${encodeURIComponent(seed.tag)}`);
      await expect(page.getByRole('heading', { level: 1, name: `Nhận hàng kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
      await expect(page.getByRole('link', { name: /^theo bản gửi NCC / })).toBeVisible();
      await expect(page.getByText(/^Đang hiện 2\/\d+ món$/)).toBeVisible();
      const boxA = page.getByRole('spinbutton', { name: `Nhận đợt này: ${a.name}` });
      const boxB = page.getByRole('spinbutton', { name: `Nhận đợt này: ${b.name}` });
      await expect(boxA).toHaveValue('5');
      await expect(boxB).toHaveValue('3');

      const rowA = page.getByRole('row').filter({ hasText: a.name });
      await expect(page.getByRole('columnheader', { name: 'Còn thiếu' })).toHaveCount(0);
      await expect(rowA.getByText('Sau lưu: Nhập đủ số lượng')).toBeVisible();
      await boxA.fill('2');
      await boxB.fill('0');
      await expect(page.getByRole('columnheader', { name: 'Còn thiếu' })).toBeVisible();
      await expect(rowA.getByText('Thiếu 5', { exact: true })).toBeVisible();
      await expect(rowA.getByText('Sau lưu: Thiếu 3')).toBeVisible();
      await settled(page);
      await shot(page, info, 'arrivals-partial');
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }

      await receivePicked(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText('Đã nhập 1 món vào tủ.')).toBeVisible();
      expect(stockOf(a.id)).toBe(2);
      await expect(boxA).toHaveValue('3');

      await expect(rowA.getByText('Thiếu 3', { exact: true })).toBeVisible();
      await expect(rowA.getByText('Sau lưu: Nhập đủ số lượng')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đủ hàng', exact: true })).toHaveCount(0);
      await settled(page);
      await shot(page, info, 'arrivals-after-first-save');
      await expect(rowA.getByText('đã nhận 2')).toBeVisible();
      await receivePicked(page);
      await expect(page.getByText('Đã nhập 2 món vào tủ.')).toBeVisible();
      await expect(page.getByText(/^Hàng kỳ tháng \d+ đã về đủ/)).toBeVisible();
      expect(stockOf(a.id)).toBe(5);
      expect(stockOf(b.id)).toBe(3);
      await expect(page.getByRole('link', { name: 'Sang Giao hàng →' })).toHaveAttribute('href', '/admin/delivery');
      await settled(page);
      await shot(page, info, 'arrivals-done');
      if (isMobile(info)) {
        await expectNoContrastViolations(page);
        expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
      }
    } finally {
      clearPrivateSnapshots();
      seed.cleanup();
      release();
    }
  });
});
