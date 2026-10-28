/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { compressImage, type DecodedImage, type ImageCodec, type OutMime } from '@/lib/image-compress';

const OPTS = { maxEdge: 1600, maxBytes: 1_048_576 };
const MB = 1_048_576;

// Codec giả: jsdom không có createImageBitmap/canvas; kích thước tệp ra tỉ lệ theo quality
function fakeCodec(width: number, height: number, bytesAt: (q: number, w: number, h: number) => number) {
  const closed = vi.fn();
  const codec: ImageCodec = {
    decode: vi.fn(async () => ({ width, height, source: {} as CanvasImageSource, close: closed }) as DecodedImage),
    encode: vi.fn(async (_img: DecodedImage, w: number, h: number, mime: OutMime, q?: number) =>
      new Blob([new Uint8Array(bytesAt(q ?? 1, w, h))], { type: mime }),
    ),
  };
  return { codec, closed };
}

function fileOf(type: string, size: number, name = 'a') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('compressImage', () => {
  it('PNG 2400×1800 → cạnh dài 1600 (1600×1200), ≤ 1 MB', async () => {
    const { codec, closed } = fakeCodec(2400, 1800, () => 400_000);
    const r = await compressImage(fileOf('image/png', 3 * MB), OPTS, codec);
    if ('error' in r) throw new Error(r.error);
    expect([r.width, r.height]).toEqual([1600, 1200]);
    expect(r.blob.size).toBeLessThanOrEqual(OPTS.maxBytes);
    expect(closed).toHaveBeenCalled();
  });

  it('ảnh dọc 1800×2400 → 1200×1600', async () => {
    const { codec } = fakeCodec(1800, 2400, () => 300_000);
    const r = await compressImage(fileOf('image/jpeg', 2 * MB), OPTS, codec);
    if ('error' in r) throw new Error(r.error);
    expect([r.width, r.height]).toEqual([1200, 1600]);
    expect(r.mime).toBe('image/jpeg');
  });

  it('JPEG quá 1 MB → hạ quality từng bước tới khi ≤ 1 MB', async () => {
    const { codec } = fakeCodec(1600, 1200, (q) => Math.round(q * 2 * MB));
    const r = await compressImage(fileOf('image/jpeg', 4 * MB), OPTS, codec);
    if ('error' in r) throw new Error(r.error);
    expect(r.blob.size).toBeLessThanOrEqual(OPTS.maxBytes);
    expect(r.blob.size).toBeGreaterThan(0.4 * MB);
    expect(r.mime).toBe('image/jpeg');
  });

  it('hạ quality hết mà vẫn > 1 MB → thu nhỏ thêm kích thước', async () => {
    const { codec } = fakeCodec(1600, 1200, (_q, w, h) => w * h);
    const r = await compressImage(fileOf('image/jpeg', 4 * MB), OPTS, codec);
    if ('error' in r) throw new Error(r.error);
    expect(r.blob.size).toBeLessThanOrEqual(OPTS.maxBytes);
    expect(r.width).toBeLessThan(1600);
  });

  it.each(['image/png', 'image/webp'])('%s nhỏ (800×600, 300 KB) → giữ nguyên tệp gốc', async (type) => {
    const { codec } = fakeCodec(800, 600, () => 1);
    const file = fileOf(type, 300_000);
    const r = await compressImage(file, OPTS, codec);
    if ('error' in r) throw new Error(r.error);
    expect(r.blob).toBe(file);
    expect(r.mime).toBe(type);
    expect(codec.encode).not.toHaveBeenCalled();
  });

  it.each([
    ['image/heic', 'IMG_1.HEIC'],
    ['image/heif', 'a.heif'],
    ['', 'IMG_2.heic'],
  ])('File type %j (%s) → {error: UNSUPPORTED}, không giải mã', async (type, name) => {
    const { codec } = fakeCodec(10, 10, () => 1);
    await expect(compressImage(fileOf(type, 1000, name), OPTS, codec)).resolves.toEqual({ error: 'UNSUPPORTED' });
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('trình duyệt không giải mã được → {error: UNSUPPORTED}', async () => {
    const codec: ImageCodec = {
      decode: vi.fn().mockRejectedValue(new DOMException('bad', 'InvalidStateError')),
      encode: vi.fn(),
    };
    await expect(compressImage(fileOf('image/jpeg', 1000), OPTS, codec)).resolves.toEqual({ error: 'UNSUPPORTED' });
  });

  it('fixture exif6.jpg là JPEG thật lưu ngang 64×32 với EXIF Orientation = 6 (chiều xoay kiểm ở Playwright/Chromium)', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/test/fixtures/exif6.jpg'));
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    const at = bytes.indexOf(Buffer.from([0x01, 0x12, 0x00, 0x03]));
    expect(at).toBeGreaterThan(0);
    const value = bytes.readUInt16BE(at + 8) === 6 ? 6 : bytes.readUInt16LE(at + 8);
    expect(value).toBe(6);
  });
});
