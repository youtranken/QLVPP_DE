export type OutMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close(): void;
}

export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(img: DecodedImage, width: number, height: number, mime: OutMime, quality?: number): Promise<Blob>;
}

export type CompressResult =
  | { blob: Blob; mime: OutMime; width: number; height: number }
  | { error: 'UNSUPPORTED' };

export const DEFAULT_COMPRESS = { maxEdge: 1600, maxBytes: 1_048_576 };

const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
const SHRINK_STEP = 0.8;
const MAX_SHRINKS = 4;

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export const browserCodec: ImageCodec = {
  async decode(file) {
    // from-image: xoay theo EXIF Orientation trước khi vẽ (ảnh điện thoại chụp dọc lưu ngang)
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close() };
  },
  async encode(img, width, height, mime, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    if (mime === 'image/jpeg') {
      // JPEG không có kênh alpha: nền trong suốt của PNG sẽ thành đen nếu không lót trắng
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img.source, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, quality),
    );
  },
};

function fit(width: number, height: number, maxEdge: number): [number, number] {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function encodeJpegUnder(
  codec: ImageCodec,
  img: DecodedImage,
  start: [number, number],
  maxBytes: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  let [w, h] = start;
  let smallest: { blob: Blob; width: number; height: number } | null = null;
  for (let shrink = 0; shrink <= MAX_SHRINKS; shrink++) {
    for (const q of JPEG_QUALITIES) {
      const blob = await codec.encode(img, w, h, 'image/jpeg', q);
      if (!smallest || blob.size < smallest.blob.size) smallest = { blob, width: w, height: h };
      if (blob.size <= maxBytes) return { blob, width: w, height: h };
    }
    [w, h] = [Math.max(1, Math.round(w * SHRINK_STEP)), Math.max(1, Math.round(h * SHRINK_STEP))];
  }
  return smallest!;
}

export async function compressImage(
  file: File,
  opts: { maxEdge: number; maxBytes: number } = DEFAULT_COMPRESS,
  codec: ImageCodec = browserCodec,
): Promise<CompressResult> {
  if (isHeic(file)) return { error: 'UNSUPPORTED' };
  let img: DecodedImage;
  try {
    img = await codec.decode(file);
  } catch {
    return { error: 'UNSUPPORTED' };
  }
  try {
    const [w, h] = fit(img.width, img.height, opts.maxEdge);
    const keepOriginal =
      (file.type === 'image/png' || file.type === 'image/webp') &&
      w === img.width &&
      file.size <= opts.maxBytes;
    if (keepOriginal) return { blob: file, mime: file.type as OutMime, width: w, height: h };
    // JPEG luôn mã hóa lại: áp chiều EXIF vào điểm ảnh và bỏ metadata (GPS) trước khi tải lên
    const out = await encodeJpegUnder(codec, img, [w, h], opts.maxBytes);
    return { ...out, mime: 'image/jpeg' };
  } finally {
    img.close();
  }
}
