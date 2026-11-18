import type { Pixels, Rect } from '@/lib/crop-rect';

export interface CropSource {
  width: number;
  height: number;
  draw(canvas: HTMLCanvasElement): void;
  pixels(): Pixels;
  crop(rect: Rect): Promise<Blob>;
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

export async function loadCropSource(src: Blob | string): Promise<CropSource> {
  const blob = typeof src === 'string' ? await (await fetch(src, { credentials: 'same-origin' })).blob() : src;
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
    async crop(r) {
      const { c, ctx } = canvasOf(r.w, r.h);
      ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const webp = await toBlob(c, 'image/webp');
      // Safari cũ không xuất WEBP: toBlob trả PNG thay vì lỗi, nên kiểm type
      if (webp?.type === 'image/webp') return webp;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, r.w, r.h);
      const jpeg = await toBlob(c, 'image/jpeg');
      if (!jpeg) throw new Error('toBlob failed');
      return jpeg;
    },
  };
}
