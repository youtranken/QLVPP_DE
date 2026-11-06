import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, expectNoContrastViolations, isMobile, settled, shot } from './helpers';
import { confirmIfAsked, openDraft } from './send-adm-flow';
import { seedLockedRequest, type Seed } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Gửi ADM (Plan v2-D, Task 6)', () => {
  // Kỳ riêng của PW: bản chốt chỉ có món PW và không thay bản đã gửi của kỳ trước thật trên dev
  let run: { release: () => void; seed?: Seed };
  test.beforeEach(async ({ page }) => {
    run = { release: await acquireLock('prev-period') };
    clearPrivateSnapshots();
    await openOnPrivatePeriod(page);
    // In trình ký mở hộp in tại chỗ: thay hộp in thật bằng bộ đếm (như Chrome: beforeprint rồi afterprint)
    await page.addInitScript(() => {
      const w = window as unknown as { __printed: number };
      w.__printed = 0;
      window.print = () => {
        w.__printed++;
        window.dispatchEvent(new Event('beforeprint'));
        window.dispatchEvent(new Event('afterprint'));
      };
    });
  });
  test.afterEach(() => {
    clearPrivateSnapshots();
    run.seed?.cleanup();
    run.release();
  });

  test('V2D-6 draft→print→new draft', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 13 }], { ym: PRIVATE_YM }));
    const [item] = seed.items;
    await page.goto('/admin/send-adm');
    await expect(page.getByRole('heading', { level: 1, name: `Gửi ADM, kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
    await openDraft(page);

    const rowOf = () => page.getByRole('table', { name: 'Số đề nghị theo món' }).getByRole('row').filter({ hasText: item.name });
    await expect(rowOf()).toContainText('= 13 đăng ký + 0 nợ');
    await expect(rowOf().getByRole('spinbutton')).toHaveCount(0);
    await rowOf().getByRole('button', { name: 'Sửa số' }).click();
    await rowOf().getByRole('spinbutton').fill('10');
    await expect(rowOf()).toContainText('Đã sửa: 10 (gợi ý 13)');
    await expect(rowOf().getByRole('status')).toContainText('Thiếu 3 — 3');
    await settled(page);
    await shot(page, info, 'send-adm-draft');
    if (isMobile(info)) {
      await expectNoContrastViolations(page);
      expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
    } else {
      await page.setViewportSize({ width: 1024, height: 800 });
      const desc = page.locator('header p').filter({ hasText: 'Phiếu đúng mẫu sheet phòng' });
      expect(await desc.evaluate((el) => el.scrollWidth <= el.clientWidth && getComputedStyle(el).whiteSpace !== 'nowrap'), 'dòng giới thiệu không bị cắt ở 1024').toBe(true);
      await page.setViewportSize({ width: 1280, height: 800 });
    }

    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmIfAsked(page, request, seed.prevYm, false);
    await expect(page.getByText(/^Đã gửi ADM lúc \d\d:\d\d \d\d\/\d\d · /)).toBeVisible();
    const sentRow = page.getByRole('table', { name: 'Số đã gửi theo món' }).getByRole('row').filter({ hasText: item.name });
    await expect(sentRow).toContainText('10');
    await shot(page, info, 'send-adm-sent');

    await page.getByRole('button', { name: 'Làm bản mới' }).click();
    await page.getByRole('dialog', { name: 'Làm bản mới?' }).getByRole('button', { name: 'Làm bản mới' }).click();
    await expect(rowOf()).toContainText('Đã sửa: 10 (gợi ý 13)');
    await rowOf().getByRole('button', { name: 'Về số gợi ý' }).click();
    await page.getByRole('button', { name: 'In trình ký' }).click();
    const replace = page.getByRole('dialog', { name: /^Bản mới thay thế bản in lúc/ });
    await expect(replace.getByRole('listitem').filter({ hasText: item.name })).toHaveText(`${item.name} 10 → 13`);
    await confirmIfAsked(page, request, seed.prevYm, true);
    await expect(page.getByText(/\(thay thế bản \d\d:\d\d \d\d\/\d\d\)$/)).toBeVisible();
    await expect(sentRow).toContainText('13');

    const printed = () => page.evaluate(() => (window as unknown as { __printed: number }).__printed);
    await expect.poll(printed).toBe(2);
    await page.getByRole('button', { name: 'In lại bản này' }).click();
    await expect.poll(printed).toBe(3);
    await expect(page).toHaveURL(/\/admin\/send-adm$/);
  });
});
