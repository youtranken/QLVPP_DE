import { expect, test, type Page } from '@playwright/test';
import { asRole, removeTestItem, pickOption } from './helpers';

// Ảnh 300×200 nền trắng, khối màu 120×80 tại (90,60): dán bằng sự kiện paste như Ctrl+V từ clipboard
async function pasteWhiteBorderPng(page: Page) {
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 300, 200);
    g.fillStyle = '#1d4ed8';
    g.fillRect(90, 60, 120, 80);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'clip.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
}

test.describe('Cắt ảnh món', () => {
  asRole('admin');

  test('Cắt ảnh món: dán ảnh, Tự cắt viền trắng, Dùng ảnh → ảnh hiện ở danh mục', async ({ page, request }, info) => {
    const name = `PW Cắt ${Date.now()}-${info.project.name}`;
    let id = '';
    try {
      await page.goto('/admin/catalog?view=table');
      await page.getByRole('main').getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Thêm sản phẩm' });
      await drawer.getByLabel('Tên sản phẩm').fill(name);
      await pickOption(drawer.getByRole('combobox', { name: 'Đơn vị tính' }), 'cái');
      await expect(drawer.getByText('Ctrl+V để dán ảnh')).toBeVisible();

      await pasteWhiteBorderPng(page);
      const crop = page.getByRole('dialog', { name: 'Cắt ảnh món' });
      await expect(crop.getByText('300 × 200 px')).toBeVisible();
      await crop.getByRole('button', { name: 'Tự cắt viền trắng' }).click();
      await expect(crop.getByText('120 × 80 px')).toBeVisible();

      const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
      await crop.getByRole('button', { name: 'Dùng ảnh' }).click();
      const up = await uploaded;
      expect(up.status()).toBe(201);
      await expect(crop).toBeHidden();
      const preview = drawer.getByRole('img', { name: 'Ảnh món' });
      await expect.poll(() => preview.evaluate((el: HTMLImageElement) => `${el.naturalWidth}x${el.naturalHeight}`)).toBe('120x80');

      const created = page.waitForResponse((r) => r.url().endsWith('/api/admin/items') && r.request().method() === 'POST');
      await drawer.getByRole('button', { name: 'Thêm món' }).click();
      const res = await created;
      expect(res.status()).toBe(201);
      id = (await res.json()).id;
      await expect(drawer).toBeHidden();

      await page.getByRole('searchbox', { name: /^Tìm trong \d+ sản phẩm$/ }).fill(name);
      const thumb = page.getByRole('row').filter({ hasText: name }).getByRole('img', { name });
      await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    } finally {
      if (id) await removeTestItem(request, id);
    }
  });
});
