import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, shot } from './helpers';

test.describe('E0-S9 khung nhân viên (dev-identity member)', () => {
  asRole('member');

  test('E0-S9 member: 390 px thanh dưới 3 mục (Tôi mở sheet tài khoản), Lịch sử/Tôi trong 1 chạm; 1280 px tab trên, tên ở góc phải mở hộp tài khoản', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^Đăng ký văn phòng phẩm tháng \d+$/ })).toBeVisible();
    const bottom = page.getByRole('navigation', { name: 'Điều hướng chính' });
    if (isMobile(info)) {
      await expect(bottom.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
      await expect(bottom.getByRole('button', { name: 'Tôi' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Chuyển trang' })).toHaveCount(0);
      await expectNoContrastViolations(page);
      await shot(page, info, 'member-home');
      await bottom.getByRole('link', { name: 'Lịch sử' }).tap();
      await expect(page.getByRole('heading', { level: 1, name: 'Lịch sử' })).toBeVisible();
      await expectNoContrastViolations(page);
      await bottom.getByRole('button', { name: 'Tôi' }).tap();
    } else {
      await expect(bottom).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Chuyển trang' }).getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
      await shot(page, info, 'member-home');
      await page.getByRole('button', { name: /^Mở tài khoản của / }).click();
    }
    const account = page.getByRole('dialog', { name: 'Tài khoản' });
    await expect(account).toBeVisible();
    await expect(account.getByText(/Nhân viên$/)).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'member-me');
  });

  test('E0-S9 member: mốc 900 px thanh dưới, 901 px tab trên', async ({ page }) => {
    const bottom = page.getByRole('navigation', { name: 'Điều hướng chính' });
    const tabs = page.getByRole('navigation', { name: 'Chuyển trang' });
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('/');
    await expect(bottom.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
    await expect(bottom.getByRole('button', { name: 'Tôi' })).toBeVisible();
    await expect(tabs).toHaveCount(0);
    await page.setViewportSize({ width: 901, height: 800 });
    await expect(tabs.getByRole('link')).toHaveText(['Đăng ký', 'Lịch sử']);
    await expect(bottom).toHaveCount(0);
  });

  test('E0-S9 member: đổi ngôn ngữ ở trang Tôi đổi toàn bộ nhãn', async ({ page }) => {
    await page.goto('/me');
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
  });

  test('E0-S9 member vào /admin/catalog → về /', async ({ page }) => {
    await page.goto('/admin/catalog');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toHaveCount(0);
  });
});

test.describe('E0-S9 khung Hành chính (dev-identity admin)', () => {
  asRole('admin');

  test('E0-S9 admin: /admin/catalog thấy sidebar; đổi en → tiêu đề sidebar đổi', async ({ page }, info) => {
    await page.goto('/admin/catalog');
    await expect(page.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
    if (isMobile(info)) await page.getByRole('button', { name: 'Mở menu' }).tap();
    const side = page.getByRole('navigation', { name: 'Menu quản lý' });
    await expect(side).toBeVisible();
    await expect(side.getByText('Hằng tháng')).toBeVisible();
    await shot(page, info, 'admin-catalog');
    if (!isMobile(info)) await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.getByRole('navigation', { name: 'Admin menu' }).getByText('Monthly')).toBeVisible();
    await expect(page.getByText('Hằng tháng')).toHaveCount(0);
    // Ngăn menu mở là modal: nội dung phía sau bị ẩn khỏi cây truy cập tới khi đóng
    if (isMobile(info)) await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
  });

  test('E9-S0 Hành chính không có phiếu: đăng nhập vào thẳng Kỳ tháng, mở / bị đưa về /admin, sidebar không có Phiếu của tôi', async ({ page }, info) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin\/month/);
    await expect(page.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
    if (isMobile(info)) await page.getByRole('button', { name: 'Mở menu' }).tap();
    await expect(page.getByRole('navigation', { name: 'Menu quản lý' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Phiếu của tôi/ })).toHaveCount(0);
    if (isMobile(info)) await page.keyboard.press('Escape');
    for (const path of ['/history', '/me']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/month/);
    }
  });
});

test.describe('E0-S9 màn vào (chưa đăng nhập)', () => {
  test('E0-S9 đăng nhập: nút PMH ID trên cùng, "Dành cho IT" mở form SA', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Đăng nhập bằng tài khoản công ty (PMH ID)' })).toBeVisible();
    await expect(page.locator('input[type=email]')).toHaveCount(0);
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'login');
    await page.getByRole('button', { name: 'Dành cho IT' }).click();
    await expect(page.getByLabel('Tên tài khoản', { exact: true })).toHaveAttribute('type', 'text');
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'password');
  });

  test('E0-S9 bị chặn quyền (?login=forbidden) → trang "Chưa được cấp quyền"', async ({ page }, info) => {
    await page.goto('/?login=forbidden');
    await expect(
      page.getByRole('heading', { name: 'Tài khoản chưa được cấp quyền dùng VPP Công trình' }),
    ).toBeVisible();
    await expect(page.getByText(/Liên hệ .+ để được cấp quyền\./)).toBeVisible();
    await expect(page.getByText(/PMH ID chưa cấp quyền vào VPP Công trình cho tài khoản này/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác' })).toBeVisible();
    if (isMobile(info)) await expectNoContrastViolations(page);
    await shot(page, info, 'forbidden');
  });
});

test.describe('nén ảnh trong Chromium thật', () => {
  asRole('member');

  test('JPEG EXIF orientation 6 → ảnh ra dọc (height > width); PNG 2400×1800 → 1600×1200', async ({ page }) => {
    await page.goto('/');
    const exif6 = readFileSync('src/test/fixtures/exif6.jpg').toString('base64');
    const out = await page.evaluate(async (b64) => {
      const modulePath = '/src/lib/image-compress.ts';
      const { compressImage } = (await import(modulePath)) as typeof import('../src/lib/image-compress');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const jpeg = await compressImage(new File([bytes], 'exif6.jpg', { type: 'image/jpeg' }));
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1800;
      canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
      const pngBlob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      const png = await compressImage(new File([pngBlob], 'big.png', { type: 'image/png' }));
      const dims = async (r: typeof jpeg) => {
        if ('error' in r) return r.error;
        const bmp = await createImageBitmap(r.blob);
        return { w: bmp.width, h: bmp.height, mime: r.mime, size: r.blob.size };
      };
      return { jpeg: await dims(jpeg), png: await dims(png) };
    }, exif6);
    expect(out.jpeg).toMatchObject({ w: 32, h: 64, mime: 'image/jpeg' });
    expect(out.png).toMatchObject({ w: 1600, h: 1200 });
  });
});
