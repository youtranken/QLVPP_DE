import { apiFetchBlob } from '@/lib/api-client';
import type { Pixels, Rect } from '@/lib/crop-rect';
import { DEFAULT_COMPRESS } from '@/lib/image-compress';

export interface CropSource {
  width: number;
  height: number;
  draw(canvas: HTMLCanvasElement): void;
  pixels(): Pixels;
  crop(rect: Rect): Promise<Blob>;
  close(): void;
}

function canvasOf(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  return { c, ctx };
}

function toBlob(c: HTMLCanvasElement, mime: string): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob(resolve, mime, 0.9));
}

// Xuất thẳng ở cỡ mà bước nén giữ nguyên (cạnh dài ≤ maxEdge): WEBP ≤ 1 MB không phải mã hóa lần hai
function outputSize(r: Rect): [number, number] {
  const scale = Math.min(1, DEFAULT_COMPRESS.maxEdge / Math.max(r.w, r.h));
  return [Math.max(1, Math.round(r.w * scale)), Math.max(1, Math.round(r.h * scale))];
}

// Cắt lại tải qua apiFetchBlob: 401 theo luồng hết phiên, lỗi khác thành ApiError cho người gọi báo
export async function loadCropSource(src: Blob | string): Promise<CropSource> {
  const blob = typeof src === 'string' ? (await apiFetchBlob(src)).blob : src;
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width, height } = bmp;
  return {
    width,
    height,
    draw(canvas) {
      canvas.getContext('2d')?.drawImage(bmp, 0, 0);
    },
    pixels() {
      const { ctx } = canvasOf(width, height);
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, width, height);
    },
    close() {
      bmp.close();
    },
    async crop(r) {
      const [w, h] = outputSize(r);
      const { c, ctx } = canvasOf(w, h);
      ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, w, h);
      const webp = await toBlob(c, 'image/webp');
      // Safari cũ không xuất WEBP: toBlob trả PNG thay vì lỗi, nên kiểm type
      if (webp?.type === 'image/webp') return webp;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      const jpeg = await toBlob(c, 'image/jpeg');
      if (!jpeg) throw new Error('toBlob failed');
      return jpeg;
    },
  };
}
