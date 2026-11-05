import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { compressImage } from '@/lib/image-compress';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { patchItem, uploadItemImage, useRefreshCatalog } from './catalog.api';
import { catalogErrorKey } from './catalog-errors';

// Thẻ có câu riêng cho ảnh quá lớn (ngắn, vừa chỗ thẻ); lỗi còn lại dùng câu của ngăn kéo
function errorKey(e: unknown): string {
  if (apiErrorCode(e) === 'FILE_TOO_LARGE') return 'catalog.grid.tooLarge';
  const key = catalogErrorKey(e);
  return key === 'catalog.errors.UNKNOWN' ? 'catalog.errors.UPLOAD_FAILED' : key;
}

export function useCardUpload(itemId: string, itemName: string) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const upload = async (file: File | undefined) => {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      const out = await compressImage(file);
      if ('error' in out) {
        setError(t('catalog.errors.IMAGE_UNSUPPORTED'));
        return;
      }
      const { id } = await uploadItemImage(out.blob, out.mime, csrfToken);
      await patchItem(itemId, { image_file_id: id }, csrfToken);
      toast.show({ text: t('catalog.grid.uploaded', { name: itemName }), tone: 'ok' });
      await refresh();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, error, upload, dismiss: () => setError(null) };
}
