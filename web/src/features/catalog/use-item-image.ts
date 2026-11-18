import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Rect } from '@/lib/crop-rect';
import { loadCropSource } from '@/lib/crop-source';
import type { CropSource } from '@/lib/crop-source';
import { compressImage } from '@/lib/image-compress';
import { fileFromClipboard, isAcceptedImage } from '@/lib/image-input';
import { useMe } from '@/lib/me';
import { fileUrl, uploadItemImage } from '@/features/catalog/catalog.api';
import { catalogErrorKey } from '@/features/catalog/catalog-errors';

// Server từ chối > 5 MB (413): kiểm trên ảnh đã nén, lớn hơn thì báo ngay, không tải lên
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function useItemImage(onChange: (fileId: string) => void, onBusyChange: (busy: boolean) => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<CropSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setBusyBoth = (b: boolean) => {
    setBusy(b);
    onBusyChange(b);
  };

  // Lỗi khi Dùng ảnh giữ màn cắt mở (vùng cắt còn nguyên); chỉ đóng khi xong hoặc người dùng bỏ
  const close = () => {
    source?.close();
    setSource(null);
  };

  const open = async (src: Blob | string) => {
    setError(null);
    setBusyBoth(true);
    try {
      setSource(await loadCropSource(src));
    } catch {
      setError(t('catalog.errors.IMAGE_UNSUPPORTED'));
    } finally {
      setBusyBoth(false);
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedImage(file)) {
      setError(t('catalog.errors.IMAGE_TYPE'));
      return;
    }
    void open(file);
  };

  const recrop = (fileId: string) => void open(fileUrl(fileId));

  const confirm = async (rect: Rect) => {
    if (!source) return;
    setBusyBoth(true);
    try {
      setError(null);
      const blob = await source.crop(rect);
      const out = await compressImage(new File([blob], 'item', { type: blob.type }));
      if ('error' in out) return setError(t('catalog.errors.IMAGE_UNSUPPORTED'));
      if (out.blob.size > MAX_UPLOAD_BYTES) return setError(t('catalog.errors.FILE_TOO_LARGE'));
      const { id } = await uploadItemImage(out.blob, out.mime, csrfToken);
      onChange(id);
      close();
    } catch (e) {
      const key = catalogErrorKey(e);
      setError(t(key === 'catalog.errors.UNKNOWN' ? 'catalog.errors.UPLOAD_FAILED' : key));
    } finally {
      setBusyBoth(false);
    }
  };

  const pickRef = useRef(pick);
  const blockedRef = useRef(false);
  useEffect(() => {
    pickRef.current = pick;
    blockedRef.current = busy || source !== null;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = fileFromClipboard(e.clipboardData);
      if (!file || blockedRef.current) return;
      e.preventDefault();
      pickRef.current(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  return { busy, error, source, pick, recrop, confirm, cancel: close };
}
