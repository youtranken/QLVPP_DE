export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const FILE_PURPOSES = ['item_image', 'line_image'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<ImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

// Không tin đuôi tệp hay Content-Type client gửi: chỉ magic bytes quyết định
export function sniff(buf: Buffer): ImageMime | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // RIFF....WEBP — RIFF không kèm WEBP có thể là WAVE/AVI
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionFor(mime: ImageMime): string {
  return EXTENSIONS[mime];
}
