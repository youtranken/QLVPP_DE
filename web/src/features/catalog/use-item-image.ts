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

// Server từ chối > 5 MB (413); ảnh cắt xong lớn hơn thì báo ngay, không tải lên
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
      const blob = await source.crop(rect);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(t('catalog.errors.FILE_TOO_LARGE'));
        return;
      }
      const out = await compressImage(new File([blob], 'item', { type: blob.type }));
      if ('error' in out) {
        setError(t('catalog.errors.IMAGE_UNSUPPORTED'));
        return;
      }
      const { id } = await uploadItemImage(out.blob, out.mime, csrfToken);
      onChange(id);
    } catch (e) {
      const key = catalogErrorKey(e);
      setError(t(key === 'catalog.errors.UNKNOWN' ? 'catalog.errors.UPLOAD_FAILED' : key));
    } finally {
      setSource(null);
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

  return { busy, error, source, pick, recrop, confirm, cancel: () => setSource(null) };
}
