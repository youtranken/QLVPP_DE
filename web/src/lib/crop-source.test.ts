import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { loadCropSource } from '@/lib/crop-source';
import { handleSessionExpired } from '@/lib/session-relogin';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn(), isLoggingOut: () => false }));

const drawImage = vi.fn();
let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };

beforeEach(() => {
  bitmap = { width: 4000, height: 2000, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb, type) {
    cb(new Blob([`${this.width}x${this.height}`], { type: type ?? 'image/png' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  drawImage.mockClear();
});

describe('loadCropSource', () => {
  it('close() đóng ImageBitmap đã giải mã', async () => {
    const src = await loadCropSource(new Blob(['x'], { type: 'image/png' }));
    src.close();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('vùng cắt 4000×2000 xuất thẳng ở cạnh dài 1600 (1600×800), một lần mã hóa WEBP', async () => {
    const src = await loadCropSource(new Blob(['x'], { type: 'image/png' }));
    const out = await src.crop({ x: 0, y: 0, w: 4000, h: 2000 });
    expect([out.type, await out.text()]).toEqual(['image/webp', '1600x800']);
    expect(drawImage).toHaveBeenLastCalledWith(bitmap, 0, 0, 4000, 2000, 0, 0, 1600, 800);
  });

  it('biên cạnh dài: vùng 1600×10 giữ nguyên cỡ; 1601×10 thu về 1600 cạnh dài', async () => {
    const src = await loadCropSource(new Blob(['x'], { type: 'image/png' }));
    expect(await (await src.crop({ x: 0, y: 0, w: 1600, h: 10 })).text()).toBe('1600x10');
    expect(await (await src.crop({ x: 0, y: 0, w: 1601, h: 10 })).text()).toBe('1600x10');
  });

  it('Cắt lại: tải ảnh 500 → ApiError 500, không giải mã', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await expect(loadCropSource('/api/files/abc')).rejects.toMatchObject({ status: 500 });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('Cắt lại: tải ảnh 401 → theo luồng hết phiên (handleSessionExpired), ApiError 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    const err = await loadCropSource('/api/files/abc').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(handleSessionExpired).toHaveBeenCalled();
  });
});
