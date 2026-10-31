import { crc32, deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { asRole, deleteTestFiles } from './helpers';

const MAX_UPLOAD = 1_048_576;

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

// Nhiễu + deflate 0 để PNG thật sự ~4 MB như ảnh camera mà không thêm thư viện ảnh
function noisyPng(width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let seed = 7;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    raw[i] = i % (width * 3 + 1) === 0 ? 0 : seed >>> 24;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

asRole('admin');

// Món khác của nhân viên không còn ô ảnh (T3b): kiểm nén ảnh ở ô ảnh món trong Danh mục của Hành chính
test.describe('E2-S5 ảnh từ camera', () => {
  test('E2-S5 ảnh 4 MB 2400 px từ ô "Chọn hoặc chụp ảnh" → nén trước khi tải: ≤ 1 MB, cạnh dài ≤ 1600 px', async ({ page }) => {
    const photo = noisyPng(2400, 560);
    expect(photo.length).toBeGreaterThan(4_000_000);
    let fileId = '';
    try {
      await page.goto('/admin/catalog');
      await page.getByRole('main').getByRole('button', { name: 'Thêm món', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Thêm món' });
      const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/files') && r.request().method() === 'POST');
      await dialog.getByLabel('Chọn hoặc chụp ảnh').setInputFiles({ name: 'camera.png', mimeType: 'image/png', buffer: photo });
      const res = await uploaded;
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { id: string; size_bytes: number; mime: string };
      fileId = body.id;
      expect(body.size_bytes).toBeLessThanOrEqual(MAX_UPLOAD);
      expect(body.mime).toBe('image/jpeg');
      const preview = dialog.getByRole('img', { name: 'Ảnh món' });
      await expect(preview).toBeVisible();
      const longEdge = () => preview.evaluate((img: HTMLImageElement) => Math.max(img.naturalWidth, img.naturalHeight));
      await expect.poll(longEdge).toBeGreaterThan(0);
      expect(await longEdge()).toBeLessThanOrEqual(1600);
    } finally {
      deleteTestFiles([fileId]);
    }
  });
});
