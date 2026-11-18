export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

export function isAcceptedImage(file: Blob): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

interface ClipboardLike {
  items?: ArrayLike<{ kind: string; getAsFile(): File | null }>;
}

export function fileFromClipboard(data: ClipboardLike | null | undefined): File | null {
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}
