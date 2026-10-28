import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compressImage } from '@/lib/image-compress';
import { useMe } from '@/lib/me';
import { fileUrl, uploadItemImage } from '@/features/catalog/catalog.api';
import { catalogErrorKey } from '@/features/catalog/catalog-errors';

export function ImageField({
  fileId,
  error,
  onChange,
  onBusyChange,
}: {
  fileId: string | null;
  error?: string;
  onChange: (fileId: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const noteId = useId();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

  const setBusyBoth = (b: boolean) => {
    setBusy(b);
    onBusyChange(b);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    setBusyBoth(true);
    try {
      const out = await compressImage(file);
      if ('error' in out) {
        setLocalError(t('catalog.errors.IMAGE_UNSUPPORTED'));
        return;
      }
      const { id } = await uploadItemImage(out.blob, out.mime, csrfToken);
      onChange(id);
    } catch (e) {
      const key = catalogErrorKey(e);
      setLocalError(t(key === 'catalog.errors.UNKNOWN' ? 'catalog.errors.UPLOAD_FAILED' : key));
    } finally {
      setBusyBoth(false);
    }
  };

  return (
    <fieldset className={`img-field${shownError ? ' ff--error' : ''}`} aria-describedby={noteId}>
      <legend className="ff-label">{t('catalog.form.image')}</legend>
      <div className="img-field-row">
        <div className="img-field-preview">
          {fileId ? (
            <img src={fileUrl(fileId)} alt={t('catalog.form.imageAlt')} />
          ) : (
            <span className="tag tag--warn">{t('catalog.page.missingImage')}</span>
          )}
        </div>
        <div className="img-field-actions">
          <label className={`btn btn--sm${busy ? ' is-disabled' : ''}`}>
            {busy ? t('catalog.form.imageUploading') : fileId ? t('catalog.form.imageChange') : t('catalog.form.imagePick')}
            <input
              type="file"
              className="sr-only"
              accept="image/*"
              aria-label={t('catalog.form.imagePick')}
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <p id={noteId} className={shownError ? 'ff-error' : 'ff-hint'} role={shownError ? 'alert' : undefined}>
            {shownError ?? t('catalog.form.imageHint')}
          </p>
        </div>
      </div>
    </fieldset>
  );
}
