import { expect, test } from '@playwright/test';
import { cartOf, deleteTestUsers, expectNoContrastViolations, isMobile, removeTestItem, pickOption } from './helpers';
import { asNewMember, createItem, createTestGroup, shotTo } from './request-helpers';

// Phiếu cam (1280) và sheet phiếu + thanh nổi (390)
test.describe('E2-S5 Trang Đăng ký (dev-identity member)', () => {
  test('V2C-T5 phiếu dài vẫn thấy nút Lưu: 16 dòng → danh sách cuộn trong khung, nút Lưu phiếu và ghi chú luôn trong màn hình', async ({ page, request }, info) => {
    test.skip(isMobile(info), 'phiếu 1280; điện thoại là C6');
    const me = await asNewMember(page, info);
    const group = await createTestGroup(request, info, 16);
    try {
      await page.goto(`/?g=${group.categoryId}`);
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await expect(grid.getByRole('button', { name: /^Thêm vào phiếu: / }).first()).toBeVisible();
      for (let i = 0; i < 16; i++) await grid.getByRole('button', { name: /^Thêm vào phiếu: / }).first().click();
      const cart = page.getByRole('complementary', { name: /^Phiếu tháng \d+$/ });
      await expect(cart.getByText('16 loại món · 16 đơn vị')).toBeVisible();
      const list = cart.getByRole('list');
      const { scrolls, bounded } = await list.evaluate((el) => ({
        scrolls: el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto',
        bounded: el.clientHeight <= 520,
      }));
      expect(scrolls && bounded).toBe(true);
      const save = cart.getByRole('button', { name: '16 thay đổi chưa lưu · Lưu' });
      await expect(save).toBeInViewport({ ratio: 1 });
      expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(52 - 0.5);
      await shotTo(page, info, 'long-cart', 'task-C5');
    } finally {
      await group.cleanup(me.sub);
    }
  });


  test('V2C-T5 phiếu cam: rỗng, 3 dòng gồm dòng ngoài danh mục chờ xem, sau khi lưu (chụp 1280)', async ({ page, request }, info) => {
    test.skip(isMobile(info), 'phiếu 1280; điện thoại là C6');
    const me = await asNewMember(page, info);
    // Hai món riêng: một tên ngắn (dòng gọn), một tên dài như hàng thật (tối đa 2 dòng trong phiếu 340px)
    const stamp = String(Date.now()).slice(-5);
    const shortName = `PW ${stamp.slice(-3)}`;
    const longName = `PW cam Băng keo trong đóng gói loại dày 5cm x 70 yard lõi nhựa ${stamp}`;
    const ids = [await createItem(request, shortName), await createItem(request, longName)];
    try {
      await page.goto('/');
      const cart = page.getByRole('complementary', { name: /^Phiếu tháng \d+$/ });
      await expect(cart.getByText('Chưa lưu', { exact: true })).toHaveCount(0);
      await expect(cart.getByText('0 loại món · 0 đơn vị')).toBeVisible();
      await shotTo(page, info, 'empty', 'task-C5');

      const grid = page.getByRole('region', { name: 'Danh mục món' });
      await grid.getByRole('button', { name: '+ Thêm món khác' }).click();
      const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
      await dialog.getByLabel('Tên món').fill(`PW món lạ ${Date.now()}`);
      await pickOption(dialog.getByRole('combobox', { name: 'Đơn vị tính' }), 'hộp');
      await dialog.getByRole('button', { name: 'Thêm vào phiếu' }).click();
      await page.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(cart.getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
      await page.reload();
      await expect(cart.getByText(/^Adm D&E xem từ 00:00\sngày\s\d{2}\/\d{2}$/)).toBeVisible();

      await grid.getByRole('searchbox', { name: 'Tìm món' }).fill('PW');
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${shortName}`, exact: true }).click();
      await grid.getByRole('button', { name: `Thêm vào phiếu: ${longName}`, exact: true }).click();
      await expect(cart.getByText('3 loại món · 3 đơn vị')).toBeVisible();
      await expect(cart.getByText('Chưa lưu', { exact: true })).toHaveCount(0);
      // 3 dòng (tên đủ rộng, stepper dưới tên) → nút Lưu nằm trọn trong màn 1280×800 không cần cuộn, không dòng nào bị cắt
      await expect(cart.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' })).toBeInViewport({ ratio: 1 });
      const rows = cart.getByRole('listitem');
      await expect(rows).toHaveCount(3);
      expect(await cart.getByRole('list').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
      // dòng món thường < 100px (tên + số lượng + stepper 34px; dòng ngoài danh mục có thêm nhãn nên cao hơn)
      const plain = rows.filter({ hasNot: page.getByText('Ngoài danh mục') });
      await expect(plain).toHaveCount(2);
      const shortRow = plain.filter({ hasText: shortName });
      expect((await shortRow.boundingBox())!.height).toBeLessThan(100);
      // cột tên đủ rộng để đọc tên thật
      expect((await shortRow.locator('.rq-line-name').boundingBox())!.width).toBeGreaterThan(180);
      // tên dài tối đa 2 dòng (cắt bằng line-clamp, tên đầy đủ nằm ở title)
      const longLabel = plain.filter({ hasText: longName }).locator('.rq-line-name');
      await expect(longLabel).toHaveAttribute('title', longName);
      const lines = await longLabel.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
      expect(lines).toBeLessThanOrEqual(2.05);
      await page.evaluate(() => document.fonts.ready);
      await shotTo(page, info, 'three-lines-desktop-1280', 'task-C5');
      await shotTo(page, info, 'cart', 'final');

      await page.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' }).click();
      await shotTo(page, info, 'confirm', 'task-C5');
      await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(cart.getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
      await expect(cart.getByText(/^Phiếu đã lưu\. Thêm, bớt ngay trên thẻ món hoặc bấm Sửa phiếu\. Sửa được tới hết \d{2}\/\d{2}\.$/)).toBeVisible();
      await expect(cart.getByRole('button', { name: 'Sửa phiếu' })).toBeVisible();
      await shotTo(page, info, 'after-save', 'task-C5');
    } finally {
      deleteTestUsers(me.sub);
      for (const id of ids) await removeTestItem(request, id);
    }
  });
  test('V2C-T6 390: chip cuộn ngang, 2 cột, thanh phiếu nổi, mở phiếu (sheet), lưu từ sheet; 1280 không có thanh nổi', async ({ page }, info) => {
    const me = await asNewMember(page, info);
    const period = await (await page.request.get('/api/periods/current', { headers: me.headers })).json();
    const month = Number(String(period.ym).slice(5));
    // Nhóm thử 3 món riêng: lưới 390 luôn có đủ thẻ để đo 2 cột, không phụ thuộc nhóm đầu của danh mục thật
    const group = await createTestGroup(page.request, info, 3);
    try {
      await page.goto(`/?g=${group.categoryId}`);
      const grid = page.getByRole('region', { name: 'Danh mục món' });
      const adds = grid.getByRole('button', { name: /^Thêm vào phiếu: / });
      await expect(adds.first()).toBeVisible();
      if (!isMobile(info)) {
        await expect(page.getByRole('button', { name: /^Xem phiếu \(/ })).toHaveCount(0);
        await expect(cartOf(page)).toBeVisible();
        await shotTo(page, info, 'desktop-unchanged', 'task-C6');
        return;
      }
      // chip nhóm: một hàng, cuộn ngang (không xuống dòng)
      // khung cuộn là cha của nhóm chip (ScrollFade: mép phải mờ khi còn chip khuất)
      const chips = grid.getByRole('group').first();
      const row = await chips.evaluate((el) => {
        const tops = new Set([...el.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)));
        const scroller = el.parentElement!;
        return { overflowX: getComputedStyle(scroller).overflowX, lines: tops.size, scrolls: scroller.scrollWidth > scroller.clientWidth };
      });
      expect(row.overflowX).toBe('auto');
      expect(row.lines).toBe(1);
      // lưới 2 cột
      const [b0, b1, b2] = await Promise.all([0, 1, 2].map(async (i) => (await adds.nth(i).boundingBox())!));
      expect(b1.x).toBeGreaterThan(b0.x + b0.width / 2);
      expect(Math.abs(b2.x - b0.x)).toBeLessThan(2);
      expect(b2.y).toBeGreaterThan(b0.y);

      // thanh nổi: giỏ trống, chưa có gì để lưu → không có thanh; thêm món thì hiện
      await expect(page.locator('.rq-bar')).toHaveCount(0);
      await adds.first().click();
      await adds.nth(1).click();
      const open = page.getByRole('button', { name: 'Xem phiếu (2 món)' });
      await expect(open).toBeVisible();
      // số thay đổi chưa lưu hiện bằng chữ trên nút Lưu của thanh nổi
      await expect(page.getByText('2 thay đổi chưa lưu', { exact: true })).toBeVisible();
      await expectNoContrastViolations(page);
      await shotTo(page, info, 'grid-bar', 'task-C6');
      await shotTo(page, info, 'phone-bar', 'final');

      await open.click();
      const sheet = page.getByRole('dialog', { name: `Phiếu tháng ${month}` });
      await expect(sheet.getByText('2 loại món · 2 đơn vị')).toBeVisible();
      await expect(sheet.getByRole('listitem')).toHaveCount(2);
      const save = sheet.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' });
      await expect(save).toBeInViewport({ ratio: 1 });
      expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.5);
      await expectNoContrastViolations(page);
      await shotTo(page, info, 'sheet-open', 'task-C6');
      // Esc đóng, focus về nút mở
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(open).toBeFocused();

      await open.click();
      await save.click();
      const confirm = page.getByRole('dialog', { name: `Lưu phiếu tháng ${month}?` });
      await expect(confirm).toBeVisible();
      await shotTo(page, info, 'save-dialog-from-sheet', 'task-C6');
      await confirm.getByRole('button', { name: 'Lưu phiếu' }).click();
      await expect(confirm).toBeHidden();
      await expect(sheet).toBeHidden();
      await expect(page.getByText(`Đã lưu phiếu tháng ${month}`)).toBeVisible();
      await expect(open).toBeFocused();
      await expect(page.getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();
    } finally {
      await group.cleanup(me.sub);
    }
  });
});
