import { vi } from 'vitest';
import { screen, userEvent } from '@/test/test-utils';
import type { CropSource } from '@/lib/crop-source';

// jsdom không có canvas/createImageBitmap: màn cắt chạy trên nguồn giả, "Dùng ảnh" trả lại đúng tệp đã chọn
export const cropSourceMock = {
  loadCropSource: vi.fn(
    async (src: Blob | string): Promise<CropSource> => ({
      width: 10,
      height: 10,
      draw: () => {},
      pixels: () => ({ width: 10, height: 10, data: new Uint8ClampedArray(400) }),
      crop: async () => (typeof src === 'string' ? new Blob(['x'], { type: 'image/webp' }) : src),
    }),
  ),
};

export async function uploadCropped(input: HTMLElement, file: File) {
  await userEvent.upload(input, file);
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng ảnh' }));
}
