import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fileUrl } from '@/features/catalog/catalog.api';
import { compressImage } from '@/lib/image-compress';
import { useMe } from '@/lib/me';
import { uploadLineImage } from './request.api';

// Ảnh bắt buộc của dòng ngoài danh mục: nén ở máy trước khi tải (ảnh điện thoại vài MB)
export function LineImageField({
  fileId,
  onChange,
  onBusyChange,
}: {
  fileId: string | null;
  onChange: (fileId: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const noteId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? (fileId ? null : t('request.custom.imageRequired'));

  const setBusyBoth = (b: boolean) => {
    setBusy(b);
    onBusyChange(b);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusyBoth(true);
    try {
      const out = await compressImage(file);
      if ('error' in out) {
        setError(t('request.custom.imageUnsupported'));
        return;
      }
      const { id } = await uploadLineImage(out.blob, out.mime, csrfToken);
      onChange(id);
    } catch {
      setError(t('request.custom.uploadFailed'));
    } finally {
      setBusyBoth(false);
    }
  };

  return (
    <fieldset className={`rq-img${shownError ? ' ff--error' : ''}`} aria-describedby={noteId}>
      <legend className="ff-label">{t('request.custom.image')}</legend>
      <div className="rq-img-row">
        <div className="rq-img-preview">
          {fileId ? <img src={fileUrl(fileId)} alt={t('request.custom.imageAlt')} /> : <span aria-hidden="true">+</span>}
        </div>
        <div className="rq-img-actions">
          <label className={`btn btn--sm${busy ? ' is-disabled' : ''}`}>
            {busy ? t('request.custom.imageUploading') : fileId ? t('request.custom.imageChange') : t('request.custom.imagePick')}
            <input
              type="file"
              className="sr-only"
              accept="image/*"
              aria-label={t('request.custom.imagePick')}
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <p id={noteId} className={shownError ? 'ff-error' : 'ff-hint'} role={error ? 'alert' : undefined}>
            {shownError}
          </p>
        </div>
      </div>
    </fieldset>
  );
}
