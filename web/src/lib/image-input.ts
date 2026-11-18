export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

export function isAcceptedImage(file: Blob): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

interface ClipboardLike {
  items?: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }>;
}

export function fileFromClipboard(data: ClipboardLike | null | undefined): File | null {
  for (const item of Array.from(data?.items ?? [])) {
    // Tệp khác (PDF…) để trình duyệt xử lý như thường; ảnh gif vẫn nhận để báo đúng câu lỗi loại ảnh
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}
