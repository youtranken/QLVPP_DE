import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, settled, shot, pendingConfirm } from './helpers';
import { seedLockedRequest, stockOf } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Tick mọi nhóm đang hiện (đã lọc theo tag của seed) rồi bấm "Nhận đủ hàng / Nhận hàng (n nhóm)": lưu ngay, không hộp xác nhận
async function receivePicked(page: Page) {
  const boxes = page.getByRole('checkbox', { name: /^Chọn nhóm / });
  for (const box of await boxes.all()) if (await box.isEnabled()) await box.check();
  await page.getByRole('button', { name: /^Nhận (đủ )?hàng \(\d+ nhóm\)$/ }).click();
}

test.describe('Nhận hàng theo bản in (Plan v2-D, Task 8)', () => {
  test('Vòng3-HV lưu thiếu rồi lưu nốt: gõ thiếu ra hai dòng "Nhập: n" / "NCC còn nợ: m", chip theo số đã lưu, cột Còn thiếu luôn có; nút nhóm "Nhận hàng"/"Nhận đủ hàng", không hộp xác nhận', async ({ page, request }, info) => {
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
      await expect(page.getByRole('columnheader', { name: 'Còn thiếu' })).toBeVisible();
      await expect(rowA.getByText('Thiếu 5', { exact: true })).toBeVisible();
      await boxA.fill('2');
      await boxB.fill('0');
      await expect(page.getByRole('columnheader', { name: 'Còn thiếu' })).toBeVisible();
      await expect(rowA.getByText('Nhập: 2', { exact: true })).toBeVisible();
      await expect(rowA.getByText('NCC còn nợ: 3', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Nhận hàng: / })).toBeVisible();
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
      await expect(page.getByRole('button', { name: /^Nhận đủ hàng: / })).toBeVisible();
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

  test('Vòng6 kỳ chưa gửi NCC báo cáo: Nhận hàng chỉ hiện lời nhắn + lối sang Báo cáo & gửi NCC, không ô nhận; API trả 409 REPORT_NOT_SENT', async ({ page, request }, info) => {
    const release = await acquireLock('prev-period');
    clearPrivateSnapshots();
    const seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 2 }], { ym: PRIVATE_YM });
    const [a] = seed.items;
    try {
      await openOnPrivatePeriod(page);
      await page.goto('/admin/arrivals');
      const month = Number(seed.prevYm.slice(5));
      await expect(page.getByText(`Chưa gửi NCC báo cáo tháng ${month}. Vào Báo cáo & gửi NCC để chốt trước khi nhận hàng.`)).toBeVisible();
      await expect(page.getByRole('main').getByRole('link', { name: 'Báo cáo & gửi NCC', exact: true }).last()).toHaveAttribute('href', '/admin/reports');
      await expect(page.getByRole('spinbutton', { name: /^Nhận đợt này: / })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Nhận (đủ )?hàng/ })).toHaveCount(0);
      const res = await request.post('/api/admin/stock/receipts', {
        headers: devHeaders('admin'),
        data: { ym: PRIVATE_YM, lines: [{ item_id: a.id, qty: 1, expected_stock_qty: 0 }] },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).code).toBe('REPORT_NOT_SENT');
      expect(stockOf(a.id)).toBe(0);
      await settled(page);
      await shot(page, info, 'arrivals-not-sent');
    } finally {
      clearPrivateSnapshots();
      seed.cleanup();
      release();
    }
  });
});
